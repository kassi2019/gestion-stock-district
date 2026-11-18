<!--
  =============================================================================
  ONGLET « INVENTAIRE » — inventaire PAR LOT, au fil de l'eau
  (même présentation et mêmes fonctions que la pharmacie de l'application Clinique)
  =============================================================================
  Une CARTE par médicament :
    - en-tête : nom, stock total, lots à 0 masqués, « + Ajouter un lot » ;
    - alerte « stock sans lot » (médicament suivi par lot) + « Rattacher à un lot » ;
    - tableau des lots : n° de lot et péremption MODIFIABLES (lus sur la boîte),
      stock actuel, STOCK RÉEL (COMPTÉ), écart, boutons « Valider » et « Retirer ».
  Barre : recherche, « Valider tout l'inventaire (n) », « Fiche d'inventaire ».
  Filtres : n° de lot ; État (périmés, péremption proche, stock à zéro, stock
  sans lot, sous le seuil) ; Comptage (non comptés, comptés, avec écart) ;
  Trier par ; Effacer. Les filtres n'effacent pas les quantités déjà saisies.

  Valider un lot = son stock devient le stock compté (mouvement « Inventaire
  + / − » de l'écart) ; n° de lot / péremption corrigés si modifiés. Chaque lot
  compté est TRACÉ, même sans écart (« Inventaire — conforme ») : la FICHE
  D'INVENTAIRE liste tout ce qui a été compté sur une période (PDF A4).
  Retirer = sortie du lot (retour fournisseur, périmé, casse, perte, autre).

  Propriétés : etat (stock de tous les médicaments, avec lignesStock), delaiAlerte
  Événement  : @modifie -> la page recharge l'état du stock
  =============================================================================
-->
<template>
  <div>
    <!-- ===================== BARRE ===================== -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher un médicament…" />
      <span class="espace"></span>
      <!-- Export de la feuille de comptage : tous les lots affichés (filtres appliqués) -->
      <ImportExportTableau
        titre="Inventaire du dépôt — feuille de comptage"
        :sous-titre="`Au ${formaterDate(dateDuJour())}`"
        nom-fichier="inventaire_depot"
        :colonnes-pdf="COLONNES_EXPORT"
        :lignes="lignesExport"
      />
      <button v-si-modif class="bouton-valider-tout" :disabled="nbSaisies === 0 || enregistrement" @click="validerTout">
        ✅ Valider tout l'inventaire ({{ nbSaisies }})
      </button>
      <button class="bouton-secondaire" title="Récapitulatif des lots comptés, à imprimer en A4" @click="ouvrirFiche">
        🖨️ Fiche d'inventaire
      </button>
    </div>

    <!-- ===================== FILTRES ===================== -->
    <div class="inv-filtres">
      <input v-model="filtreLot" class="inv-lot" type="search" placeholder="N° de lot…" />
      <div class="inv-groupe">
        <span class="inv-libelle">État :</span>
        <button
          v-for="o in ETATS"
          :key="o.v"
          type="button"
          class="bouton-filtre"
          :class="{ actif: filtreEtat === o.v }"
          @click="filtreEtat = o.v"
        >
          {{ o.l }}
        </button>
      </div>
      <div class="inv-groupe">
        <span class="inv-libelle">Comptage :</span>
        <button
          v-for="o in COMPTAGES"
          :key="o.v"
          type="button"
          class="bouton-filtre"
          :class="{ actif: filtreComptage === o.v }"
          @click="filtreComptage = o.v"
        >
          {{ o.l }}
        </button>
      </div>
      <div class="inv-groupe">
        <span class="inv-libelle">Trier par :</span>
        <div class="inv-tri">
          <ListeDeroulante v-model="tri" :options="TRIS" :effacable="false" />
        </div>
      </div>
      <button v-if="filtreActif" type="button" class="bouton-secondaire petit" @click="effacerFiltres">✖ Effacer</button>
      <span class="inv-compteur">{{ produits.length }} produit(s) · {{ produits.reduce((n, p) => n + p.lignes.length, 0) }} lot(s) affiché(s)</span>
    </div>

    <!-- ===================== PRODUITS ET LOTS ===================== -->
    <p v-if="etat.length === 0" class="tableau-vide">Aucun médicament.</p>
    <div v-else-if="produits.length === 0" class="tableau-vide">
      Aucun lot ne correspond aux filtres.
      <button type="button" class="bouton-lien" @click="effacerFiltres">✖ Effacer les filtres</button>
    </div>

    <div v-else class="inventaire-produits">
      <div v-for="{ m, lignes } in produitsPage" :key="m.id" class="inventaire-produit">
        <!-- En-tête du produit -->
        <div class="inventaire-produit-entete">
          <strong>{{ m.designation }}</strong>
          <span v-if="m.dosage" class="detail">{{ m.dosage }}</span>
          <span class="code">{{ m.code }}</span>
          <span class="badge" :class="m.stock > 0 ? 'badge-vert' : 'badge-orange'">Stock total : {{ formaterNombre(m.stock) }}</span>
          <span v-if="nbLotsVides(m) && filtreEtat !== 'ZERO'" class="lots-vides" title="Choisir « Stock à zéro » dans les filtres pour les revoir">
            {{ nbLotsVides(m) }} lot(s) à 0 masqué(s)
          </span>
          <button v-si-modif type="button" class="bouton-ajout-lot" title="Ajouter un lot oublié ou mal enregistré à l'entrée" @click="ouvrirAjoutLot(m)">
            ＋ Ajouter un lot
          </button>
        </div>

        <!-- Stock sans lot (médicament suivi par lot) -->
        <div v-if="m.suiviLot && stockSansLot(m) > 0" class="inventaire-sans-lot">
          <span>
            ⚠️ <strong>{{ stockSansLot(m) }} unité(s) sans lot</strong>
            (stock total {{ m.stock }}, lots {{ m.stock - stockSansLot(m) }}). Rattachez-les au lot lu sur la boîte :
            le stock total ne change pas.
          </span>
          <button v-si-modif type="button" class="bouton-rattacher" @click="ouvrirRattachement(m)">🔗 Rattacher à un lot</button>
        </div>

        <p v-if="lignes.length === 0" class="inventaire-aucun-lot">Aucun lot en stock pour ce produit.</p>
        <table v-else class="inventaire-lots">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Péremption</th>
              <th>Stock actuel</th>
              <th>Stock réel (compté)</th>
              <th>Écart</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lignes" :key="l.stockId" :class="{ 'lot-corrige': lotCorrige(l), 'lot-compte': estCompte(l) }">
              <!-- N° de lot et péremption corrigeables pendant le comptage (lus sur la boîte) -->
              <td>
                <template v-if="l.lotId && corrections[l.stockId]">
                  <input
                    v-model="corrections[l.stockId].numeroLot"
                    class="inventaire-input inventaire-lot"
                    :class="{ modifie: corrections[l.stockId].numeroLot.trim() !== l.numeroLot }"
                    :title="`N° de lot enregistré : ${l.numeroLot}`"
                    :disabled="!peutModifier"
                  />
                </template>
                <span v-else class="sans-lot">Sans lot</span>
              </td>
              <td>
                <template v-if="l.lotId && corrections[l.stockId]">
                  <ChampDate
                    v-model="corrections[l.stockId].datePeremption"
                    class="inventaire-date"
                    :class="{ modifie: corrections[l.stockId].datePeremption !== jourIso(l.datePeremption) }"
                    :title="`Péremption enregistrée : ${l.datePeremption ? formaterDate(l.datePeremption) : '—'}`"
                    :desactive="!peutModifier"
                  />
                  <span v-if="etatPeremption(l.datePeremption, delaiAlerte)?.code !== 'NORMAL' && l.datePeremption" class="badge peremption" :class="etatPeremption(l.datePeremption, delaiAlerte).badge">
                    {{ etatPeremption(l.datePeremption, delaiAlerte).libelle }}
                  </span>
                </template>
                <span v-else class="detail">—</span>
              </td>
              <td>{{ formaterNombre(l.quantite) }}</td>
              <td>
                <input
                  v-model="saisies[l.stockId]"
                  type="number"
                  min="0"
                  class="inventaire-input"
                  :placeholder="String(l.quantite)"
                  :disabled="!peutModifier"
                />
              </td>
              <td>
                <span class="badge" :class="ecart(l) === 0 ? 'badge-vert' : ecart(l) > 0 ? 'badge-orange' : 'badge-rouge'">
                  {{ ecart(l) > 0 ? '+' : '' }}{{ ecart(l) }}
                </span>
              </td>
              <td class="actions">
                <button v-si-modif type="button" class="bouton-valider" :disabled="!aValider(l) || enregistrement" @click="validerLot(m, l)">
                  ✅ Valider
                </button>
                <button
                  v-si-modif
                  type="button"
                  class="bouton-retirer"
                  :disabled="l.quantite <= 0"
                  title="Retirer du stock (retour fournisseur, périmé, casse, perte…)"
                  @click="ouvrirRetrait(m, l)"
                >
                  ↩️ Retirer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination v-model:page="page" v-model:taille="taille" :total="produits.length" />
    </div>

    <!-- ===================== RETRAIT ===================== -->
    <FenetreModale v-if="retrait" :titre="`↩️ Retirer du stock — ${retrait.m.designation} (${retrait.l.numeroLot ? 'lot ' + retrait.l.numeroLot : 'sans lot'})`" @fermer="retrait = null">
      <p class="note">
        Stock actuel du lot : <strong>{{ retrait.l.quantite }}</strong> unité(s).
        Le retrait est tracé (utilisateur, motif, date) dans les mouvements de stock.
      </p>
      <form id="form-retrait" class="grille-formulaire" @submit.prevent="confirmerRetrait">
        <div>
          <label class="obligatoire">Quantité à retirer</label>
          <input v-model.number="retrait.quantite" type="number" min="1" :max="retrait.l.quantite" required />
        </div>
        <div>
          <label class="obligatoire">Motif</label>
          <ListeDeroulante v-model="retrait.motif" :options="MOTIFS_RETRAIT" placeholder="— Choisir —" />
        </div>
        <div class="pleine-largeur">
          <label>Commentaire</label>
          <input v-model.trim="retrait.commentaire" maxlength="200" placeholder="Ex : boîte abîmée…" />
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="retrait = null">✖ Annuler</button>
        <button type="submit" form="form-retrait" class="bouton-danger" :disabled="enregistrement">
          {{ enregistrement ? 'Retrait…' : '↩️ Retirer' }}
        </button>
      </template>
    </FenetreModale>

    <!-- ===================== AJOUT / RATTACHEMENT D'UN LOT ===================== -->
    <FenetreModale
      v-if="ajoutLot"
      :titre="`${ajoutLot.rattachement ? '🔗 Rattacher le stock sans lot' : '＋ Ajouter un lot'} — ${ajoutLot.m.designation}`"
      @fermer="ajoutLot = null"
    >
      <p v-if="ajoutLot.rattachement" class="note">
        {{ ajoutLot.rattachement }} unité(s) sont comptées dans le stock total mais sans lot. Indiquez le lot lu sur la
        boîte : le lot est créé <strong>sans augmenter le stock total</strong>. S'il y a plusieurs lots, rattachez-les un
        par un (quantité de chaque lot).
      </p>
      <p v-else class="note">
        Lot oublié ou mal enregistré à l'entrée : il est ajouté au stock (ajustement +) et apparaît tout de suite dans
        l'inventaire.
      </p>
      <form id="form-ajout-lot" class="grille-formulaire" @submit.prevent="confirmerAjoutLot">
        <div>
          <label class="obligatoire">Numéro de lot</label>
          <input v-model.trim="ajoutLot.numeroLot" required maxlength="50" />
        </div>
        <div>
          <label class="obligatoire">Quantité</label>
          <input v-model.number="ajoutLot.quantite" type="number" min="1" :max="ajoutLot.rattachement || undefined" required />
        </div>
        <div>
          <label class="obligatoire">Date de péremption</label>
          <ChampDate v-model="ajoutLot.datePeremption" obligatoire />
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="ajoutLot = null">✖ Annuler</button>
        <button type="submit" form="form-ajout-lot" :disabled="enregistrement">
          {{ ajoutLot.rattachement ? 'Rattacher' : 'Ajouter le lot' }}
        </button>
      </template>
    </FenetreModale>

    <!-- ===================== FICHE D'INVENTAIRE ===================== -->
    <FenetreModale v-if="fiche" titre="🖨️ Fiche d'inventaire" tres-large @fermer="fiche = null">
      <div class="barre-outils">
        <label class="fiche-date">Du <ChampDate v-model="fiche.du" @change="chargerFiche" /></label>
        <label class="fiche-date">au <ChampDate v-model="fiche.au" @change="chargerFiche" /></label>
        <button type="button" class="bouton-secondaire petit" @click="chargerFiche">🔄 Actualiser</button>
        <span class="espace"></span>
        <ImportExportTableau
          v-if="fiche.donnees && fiche.donnees.lignes.length"
          titre="Fiche d'inventaire"
          :sous-titre="`Du ${formaterDate(fiche.du)} au ${formaterDate(fiche.au)}`"
          nom-fichier="fiche_inventaire"
          :colonnes-pdf="COLONNES_FICHE"
          :lignes="fiche.donnees.lignes"
        />
      </div>
      <p v-if="fiche.chargement" class="tableau-vide">Chargement…</p>
      <p v-else-if="!fiche.donnees || fiche.donnees.lignes.length === 0" class="tableau-vide">
        Aucun lot compté sur cette période. Validez d'abord l'inventaire, puis revenez ici.
      </p>
      <template v-else>
        <div class="fiche-resume">
          <span><strong>{{ fiche.donnees.resume.lotsComptes }}</strong> lot(s) compté(s)</span>
          <span><strong>{{ fiche.donnees.resume.lotsConformes }}</strong> conforme(s)</span>
          <span><strong>{{ fiche.donnees.resume.lotsAvecEcart }}</strong> avec écart</span>
          <span>Manquants : <strong>{{ fiche.donnees.resume.manquants }}</strong></span>
          <span>Excédents : <strong>+{{ fiche.donnees.resume.excedents }}</strong></span>
          <span>Valeur des écarts : <strong>{{ formaterMontant(fiche.donnees.resume.valeurEcarts) }}</strong></span>
        </div>
        <div class="tableau-conteneur fiche-table">
          <table class="tableau">
            <thead>
              <tr>
                <th>Médicament</th><th>Lot</th><th>Péremption</th><th class="nombre">Stock théorique</th>
                <th class="nombre">Stock compté</th><th>Écart</th><th class="nombre">Valeur de l'écart</th><th>Compté par</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in fiche.donnees.lignes" :key="l.id">
                <td><strong>{{ l.medicament }}</strong> <span class="detail">{{ l.code }}</span></td>
                <td>{{ l.lot }}</td>
                <td>{{ l.peremption ? formaterDate(l.peremption) : '—' }}</td>
                <td class="nombre">{{ l.stockAvant ?? '—' }}</td>
                <td class="nombre">{{ l.stockApres ?? '—' }}</td>
                <td>
                  <span class="badge" :class="l.ecart === 0 ? 'badge-vert' : l.ecart > 0 ? 'badge-orange' : 'badge-rouge'">
                    {{ l.ecart > 0 ? '+' : '' }}{{ l.ecart }}
                  </span>
                </td>
                <td class="nombre">{{ formaterMontant(l.valeurEcart) }}</td>
                <td class="detail">{{ l.par }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #pied>
        <button class="bouton-secondaire" @click="fiche = null">✖ Fermer</button>
        <button v-si-imprimer :disabled="!fiche.donnees || fiche.donnees.lignes.length === 0" @click="ficheInventairePdf(fiche.donnees, fiche.du, fiche.au)">
          🖨️ Imprimer (A4)
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Pagination from '@/components/Pagination.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { utiliserPagination } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { creerMouvement, ficheInventaire, rattacherLot, validerComptage } from '@/api/stock'
import { etatPeremption, ficheInventairePdf, joursAvantPeremption } from './stockCommun'

const props = defineProps({
  etat: { type: Array, required: true },
  delaiAlerte: { type: Number, default: 90 },
})
const emit = defineEmits(['modifie'])
const store = useStore()

const peutModifier = computed(() => store.getters['auth/peutModifier']('stock'))

// ---------------------------------------------------------------------------
// FILTRES ET TRI (sans effet sur les saisies : un lot masqué garde sa quantité comptée)
// ---------------------------------------------------------------------------
const ETATS = computed(() => [
  { v: 'TOUS', l: 'Tous' },
  { v: 'PERIMES', l: 'Périmés' },
  { v: 'PROCHES', l: `Péremption ≤ ${props.delaiAlerte} j` },
  { v: 'ZERO', l: 'Stock à zéro' },
  { v: 'SANS_LOT', l: 'Stock sans lot' },
  { v: 'SOUS_SEUIL', l: 'Sous le seuil' },
])
const COMPTAGES = [
  { v: 'TOUS', l: 'Tous' },
  { v: 'NON_COMPTES', l: 'Non comptés' },
  { v: 'COMPTES', l: 'Comptés' },
  { v: 'ECART', l: 'Avec écart' },
]
const TRIS = [
  { id: 'STOCK_HAUT', libelle: 'Stock total le plus élevé' },
  { id: 'NOM', libelle: 'Nom A→Z' },
  { id: 'PEREMPTION', libelle: 'Péremption la plus proche' },
  { id: 'STOCK', libelle: 'Stock le plus bas' },
  { id: 'ECART', libelle: 'Écart le plus grand' },
]
const TRI_DEFAUT = 'STOCK_HAUT'

const recherche = ref('')
const filtreLot = ref('')
const filtreEtat = ref('TOUS')
const filtreComptage = ref('TOUS')
const tri = ref(TRI_DEFAUT)
const filtreActif = computed(
  () => !!filtreLot.value.trim() || filtreEtat.value !== 'TOUS' || filtreComptage.value !== 'TOUS' || tri.value !== TRI_DEFAUT,
)
function effacerFiltres() {
  filtreLot.value = ''
  filtreEtat.value = 'TOUS'
  filtreComptage.value = 'TOUS'
  tri.value = TRI_DEFAUT
}

// ---------------------------------------------------------------------------
// SAISIES (stock compté) ET CORRECTIONS DE LOT, par ligne de stock
// ---------------------------------------------------------------------------
const saisies = reactive({}) // { [stockId]: quantité comptée }
const corrections = reactive({}) // { [stockId]: { numeroLot, datePeremption } }

/** « 2027-05-31T00:00:00.000Z » -> « 2027-05-31 » */
function jourIso(date) {
  return date ? String(date).substring(0, 10) : ''
}

/** Prépare les corrections des nouvelles lignes (n° de lot et péremption enregistrés). */
watch(
  () => props.etat,
  (etat) => {
    for (const m of etat) {
      for (const l of m.lignesStock || []) {
        if (l.lotId && !corrections[l.stockId]) {
          corrections[l.stockId] = { numeroLot: l.numeroLot || '', datePeremption: jourIso(l.datePeremption) }
        }
      }
    }
  },
  { immediate: true },
)

const estCompte = (l) => saisies[l.stockId] !== undefined && saisies[l.stockId] !== '' && saisies[l.stockId] !== null
function ecart(l) {
  return estCompte(l) ? Number(saisies[l.stockId]) - l.quantite : 0
}
/** N° de lot ou péremption différents de ceux enregistrés. */
function lotCorrige(l) {
  const c = corrections[l.stockId]
  if (!l.lotId || !c) return false
  return c.numeroLot.trim() !== l.numeroLot || (!!c.datePeremption && c.datePeremption !== jourIso(l.datePeremption))
}
const aValider = (l) => estCompte(l) || lotCorrige(l)

/** Ligne envoyée au serveur : stock compté (inchangé s'il n'est pas saisi) + corrections du lot. */
function ligneComptage(l) {
  const ligne = { stockId: l.stockId, quantiteReelle: estCompte(l) ? Number(saisies[l.stockId]) : l.quantite }
  if (lotCorrige(l)) {
    ligne.numeroLot = corrections[l.stockId].numeroLot.trim()
    ligne.datePeremption = corrections[l.stockId].datePeremption || undefined
  }
  return ligne
}

// ---------------------------------------------------------------------------
// PRODUITS ET LIGNES AFFICHÉS
// ---------------------------------------------------------------------------
const toutesLignes = computed(() => props.etat.flatMap((m) => (m.lignesStock || []).map((l) => ({ m, l }))))
const nbSaisies = computed(() => toutesLignes.value.filter(({ l }) => aValider(l)).length)

/** Unités du médicament sans lot. */
function stockSansLot(m) {
  return (m.lignesStock || []).filter((l) => !l.lotId).reduce((t, l) => t + l.quantite, 0)
}
/** Nombre de lots épuisés (masqués sauf avec le filtre « Stock à zéro »). */
function nbLotsVides(m) {
  return (m.lignesStock || []).filter((l) => l.lotId && l.quantite <= 0).length
}
const peremptionMs = (l) => (l.datePeremption ? new Date(l.datePeremption).getTime() : Infinity)

function ligneVisible(l) {
  const lot = filtreLot.value.trim().toUpperCase()
  if (lot && !String(l.numeroLot ?? '').toUpperCase().includes(lot)) return false
  const jours = joursAvantPeremption(l.datePeremption)
  if (filtreEtat.value === 'PERIMES' && !(jours !== null && jours < 0)) return false
  if (filtreEtat.value === 'PROCHES' && !(jours !== null && jours >= 0 && jours <= props.delaiAlerte)) return false
  if (filtreEtat.value === 'ZERO' && l.quantite !== 0) return false
  // Lots épuisés masqués : visibles seulement avec le filtre « Stock à zéro »
  if (filtreEtat.value !== 'ZERO' && l.quantite <= 0) return false
  if (filtreComptage.value === 'NON_COMPTES' && estCompte(l)) return false
  if (filtreComptage.value === 'COMPTES' && !estCompte(l)) return false
  if (filtreComptage.value === 'ECART' && ecart(l) === 0) return false
  return true
}

/** Produits (actifs) et leurs lignes affichés, après filtres et tri. */
const produits = computed(() => {
  const texte = recherche.value.toLowerCase()
  const filtreLignes = !!filtreLot.value.trim() || ['PERIMES', 'PROCHES', 'ZERO'].includes(filtreEtat.value) || filtreComptage.value !== 'TOUS'
  let liste = props.etat
    .filter((m) => m.actif)
    .filter((m) => !texte || [m.code, m.designation].some((v) => (v || '').toLowerCase().includes(texte)))
    .filter((m) => filtreEtat.value !== 'SOUS_SEUIL' || (m.seuilAlerte > 0 && m.stock <= m.seuilAlerte) || m.stock <= 0)
    .filter((m) => filtreEtat.value !== 'SANS_LOT' || stockSansLot(m) > 0)
    .map((m) => ({ m, lignes: (m.lignesStock || []).filter(ligneVisible) }))
    .filter((p) => p.lignes.length > 0 || !filtreLignes)

  const plusProche = (p) => Math.min(...p.lignes.map(peremptionMs))
  const plusGrandEcart = (p) => Math.max(0, ...p.lignes.map((l) => Math.abs(ecart(l))))
  const nom = (a, b) => a.m.designation.localeCompare(b.m.designation, 'fr')
  if (tri.value === 'PEREMPTION') {
    liste = liste.map((p) => ({ ...p, lignes: [...p.lignes].sort((a, b) => peremptionMs(a) - peremptionMs(b)) }))
    liste.sort((a, b) => plusProche(a) - plusProche(b))
  } else if (tri.value === 'STOCK_HAUT') liste.sort((a, b) => b.m.stock - a.m.stock || nom(a, b))
  else if (tri.value === 'STOCK') liste.sort((a, b) => a.m.stock - b.m.stock || nom(a, b))
  else if (tri.value === 'ECART') liste.sort((a, b) => plusGrandEcart(b) - plusGrandEcart(a) || nom(a, b))
  else liste.sort(nom)
  return liste
})

// Pagination des produits (retour à la page 1 quand un filtre change)
const { page, taille, lignesPage: produitsPage } = utiliserPagination(produits, [recherche, filtreLot, filtreEtat, filtreComptage, tri])

// ---------------------------------------------------------------------------
// VALIDATION DU COMPTAGE
// ---------------------------------------------------------------------------
const enregistrement = ref(false)

/** Remet à vide la saisie et les corrections d'une ligne (après validation). */
function oublier(stockId) {
  delete saisies[stockId]
  delete corrections[stockId] // recréées avec les nouvelles valeurs au rechargement
}

async function validerLot(m, l) {
  if (!aValider(l)) return
  const ligne = ligneComptage(l)
  if (ligne.numeroLot === '') return store.dispatch('notifications/erreur', 'Le numéro de lot ne peut pas être vide.')
  enregistrement.value = true
  try {
    await validerComptage([ligne])
    store.dispatch(
      'notifications/succes',
      estCompte(l)
        ? `${m.designation} — ${ligne.numeroLot || l.numeroLot || 'sans lot'} : stock ajusté à ${ligne.quantiteReelle}.`
        : `${m.designation} — lot ${ligne.numeroLot || l.numeroLot} : n° de lot / péremption corrigés.`,
    )
    oublier(l.stockId)
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Valide d'un coup toutes les quantités saisies et corrections. */
async function validerTout() {
  const aEnvoyer = toutesLignes.value.filter(({ l }) => aValider(l))
  const lignes = aEnvoyer.map(({ l }) => ligneComptage(l))
  if (lignes.length === 0) return
  if (lignes.some((l) => l.numeroLot === '')) return store.dispatch('notifications/erreur', 'Le numéro de lot ne peut pas être vide.')
  const confirme = await confirmer({
    titre: "Valider tout l'inventaire ?",
    texte: `${lignes.length} lot(s) seront validés : le stock de chaque lot devient le stock compté.`,
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const resultat = await validerComptage(lignes)
    store.dispatch('notifications/succes', `${resultat.ajustes} lot(s) ajusté(s) sur ${resultat.total} compté(s).`)
    for (const { l } of aEnvoyer) oublier(l.stockId)
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------
// RETRAIT D'UN LOT (retour fournisseur, périmé, casse, perte...)
// ---------------------------------------------------------------------------
const MOTIFS_RETRAIT = [
  { id: 'RETOUR_FOURNISSEUR', libelle: 'Retour fournisseur' },
  { id: 'PERIME', libelle: 'Périmé' },
  { id: 'CASSE', libelle: 'Casse' },
  { id: 'PERTE', libelle: 'Perte' },
  { id: 'AUTRE', libelle: 'Autre' },
]
const retrait = ref(null)

function ouvrirRetrait(m, l) {
  retrait.value = { m, l, quantite: l.quantite, motif: null, commentaire: '' }
}

async function confirmerRetrait() {
  const r = retrait.value
  if (!r.motif || !(r.quantite >= 1)) return store.dispatch('notifications/erreur', 'Renseignez la quantité et le motif.')
  if (r.quantite > r.l.quantite) return store.dispatch('notifications/erreur', `Seulement ${r.l.quantite} unité(s) dans ce lot.`)
  const libelle = MOTIFS_RETRAIT.find((x) => x.id === r.motif).libelle
  enregistrement.value = true
  try {
    await creerMouvement({
      // Périmé -> « Sortie — périmés » ; les autres motifs -> « Ajustement − » avec le motif
      type: r.motif === 'PERIME' ? 'PERIME' : 'AJUSTEMENT_NEGATIF',
      medicamentId: r.m.id,
      lotId: r.l.lotId || undefined,
      quantite: Number(r.quantite),
      motif: `${libelle}${r.commentaire ? ' : ' + r.commentaire : ''}`,
    })
    store.dispatch('notifications/succes', 'Retrait enregistré — stock mis à jour.')
    delete saisies[r.l.stockId]
    retrait.value = null
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------
// AJOUT D'UN LOT / RATTACHEMENT DU STOCK SANS LOT
// ---------------------------------------------------------------------------
const ajoutLot = ref(null)

function ouvrirAjoutLot(m) {
  ajoutLot.value = { m, rattachement: 0, numeroLot: '', quantite: null, datePeremption: '' }
}
function ouvrirRattachement(m) {
  const quantite = stockSansLot(m)
  ajoutLot.value = { m, rattachement: quantite, numeroLot: '', quantite, datePeremption: '' }
}

async function confirmerAjoutLot() {
  const a = ajoutLot.value
  enregistrement.value = true
  try {
    if (a.rattachement) {
      await rattacherLot({ medicamentId: a.m.id, numeroLot: a.numeroLot, datePeremption: a.datePeremption, quantite: Number(a.quantite) })
      store.dispatch('notifications/succes', `${a.quantite} unité(s) rattachée(s) au lot ${a.numeroLot}.`)
    } else {
      await creerMouvement({
        type: 'AJUSTEMENT_POSITIF',
        medicamentId: a.m.id,
        numeroLot: a.numeroLot,
        datePeremption: a.datePeremption,
        quantite: Number(a.quantite),
        motif: "Lot ajouté à l'inventaire (oublié ou mal enregistré à l'entrée)",
      })
      store.dispatch('notifications/succes', `Lot ${a.numeroLot} ajouté au stock.`)
    }
    ajoutLot.value = null
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------
// FICHE D'INVENTAIRE (récapitulatif imprimable)
// ---------------------------------------------------------------------------
const fiche = ref(null)

// ---------------------------------------------------------------------------
// EXPORT PDF / EXCEL
// ---------------------------------------------------------------------------
/** Feuille de comptage : une ligne par lot affiché (toutes les pages). */
const lignesExport = computed(() => produits.value.flatMap(({ m, lignes }) => lignes.map((l) => ({ m, l }))))
const COLONNES_EXPORT = [
  { titre: 'Code', valeur: ({ m }) => m.code },
  { titre: 'Médicament', valeur: ({ m }) => [m.designation, m.dosage].filter(Boolean).join(' ') },
  { titre: 'Lot', valeur: ({ l }) => (l.lotId ? l.numeroLot : 'Sans lot') },
  { titre: 'Péremption', valeur: ({ l }) => (l.datePeremption ? formaterDate(l.datePeremption) : '—') },
  { titre: 'Stock actuel', valeur: ({ l }) => formaterNombre(l.quantite), droite: true },
  { titre: 'Stock compté', valeur: ({ l }) => (estCompte(l) ? formaterNombre(saisies[l.stockId]) : ''), droite: true },
  { titre: 'Écart', valeur: ({ l }) => (estCompte(l) ? String(ecart(l)) : ''), droite: true },
]
/** Fiche d'inventaire : lots comptés sur la période. */
const COLONNES_FICHE = [
  { titre: 'Médicament', valeur: (l) => `${l.medicament} (${l.code})` },
  { titre: 'Lot', valeur: (l) => l.lot },
  { titre: 'Péremption', valeur: (l) => (l.peremption ? formaterDate(l.peremption) : '—') },
  { titre: 'Stock théorique', valeur: (l) => l.stockAvant ?? '—', droite: true },
  { titre: 'Stock compté', valeur: (l) => l.stockApres ?? '—', droite: true },
  { titre: 'Écart', valeur: (l) => String(l.ecart), droite: true },
  { titre: "Valeur de l'écart", valeur: (l) => formaterMontant(l.valeurEcart), droite: true, somme: (l) => Number(l.valeurEcart) || 0, formatTotal: formaterMontant },
  { titre: 'Compté par', valeur: (l) => l.par },
]

function ouvrirFiche() {
  fiche.value = { du: dateDuJour(), au: dateDuJour(), donnees: null, chargement: false }
  chargerFiche()
}

async function chargerFiche() {
  const f = fiche.value
  f.chargement = true
  try {
    f.donnees = await ficheInventaire(f.du, f.au || f.du)
  } catch (erreur) {
    f.donnees = null
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    f.chargement = false
  }
}
</script>

<style scoped>
.detail { font-size: 0.78rem; color: var(--muted); }
.note { margin: 0 0 1rem; font-size: 0.88rem; color: var(--muted); line-height: 1.5; }
.petit { padding: 0.35rem 0.7rem; font-size: 0.82rem; }

.bouton-valider-tout { background: #16a34a; }
.bouton-valider-tout:hover:not(:disabled) { background: #15803d; }

/* ---------- Filtres ---------- */
.inv-filtres { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.9rem; margin: -0.25rem 0 1rem; }
.inv-lot { width: 170px; }
.inv-groupe { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; }
.inv-libelle { font-size: 0.78rem; font-weight: 600; color: var(--muted); }
.inv-tri { width: 250px; }
.inv-compteur { margin-left: auto; font-size: 0.78rem; color: var(--muted); }
.bouton-filtre {
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  background: #fff;
  border: 1.5px solid var(--border);
  color: var(--texte-sur-fond);
  font-size: 0.8rem;
  font-weight: 600;
}
.bouton-filtre:hover { border-color: var(--primary); }
.bouton-filtre.actif { background: var(--primary); border-color: var(--primary); color: #fff; }

/* ---------- Carte d'un produit ---------- */
.inventaire-produit {
  margin-bottom: 1.1rem;
  border: 2px solid #4b6358;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}
.inventaire-produit-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: #e3efe9;
  border-bottom: 2px solid #4b6358;
}
.inventaire-produit-entete strong { color: var(--texte-sur-fond); }
.lots-vides { font-size: 0.75rem; font-style: italic; color: var(--muted); }
.bouton-ajout-lot { margin-left: auto; padding: 0.4rem 0.8rem; font-size: 0.82rem; font-weight: 700; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25); }

.inventaire-sans-lot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #facc15;
  border-radius: 8px;
  background: #fef9c3;
  font-size: 0.82rem;
}
.inventaire-sans-lot span { flex: 1; min-width: 260px; }
.bouton-rattacher { padding: 0.35rem 0.75rem; background: #ca8a04; font-size: 0.8rem; font-weight: 700; }
.bouton-rattacher:hover { background: #a16207; }
.inventaire-aucun-lot { margin: 0.4rem 0.75rem; font-size: 0.82rem; color: var(--muted); }

/* ---------- Tableau des lots ---------- */
.inventaire-lots { width: 100%; border-collapse: collapse; }
.inventaire-lots th {
  padding: 0.4rem 0.65rem;
  background: #f8fafc;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  text-align: left;
}
.inventaire-lots td { padding: 0.4rem 0.65rem; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.inventaire-lots tr.lot-corrige td { background: #fffdf5; }
.inventaire-lots tr.lot-compte td { background: #f3fbf6; }
.inventaire-input { width: 90px; padding: 0.3rem 0.5rem; border: 1.5px solid #c8d3cd; border-radius: 6px; }
.inventaire-lot { width: 130px; }
.inventaire-input.modifie { border-color: #d97706; background: #fffbeb; }
/* Péremption (3 cases jour / mois / année) : même repère orange quand elle est corrigée */
.inventaire-date.modifie :deep(input) { border-color: #d97706; background: #fffbeb; }
.sans-lot { font-style: italic; color: var(--muted); }
.badge.peremption { margin-left: 0.35rem; }
.actions { text-align: right; white-space: nowrap; }
.bouton-valider { padding: 0.3rem 0.65rem; font-size: 0.8rem; }
.bouton-retirer {
  margin-left: 0.3rem;
  padding: 0.3rem 0.65rem;
  background: #fff;
  border: 1.5px solid #f1b4b4;
  color: var(--danger);
  font-size: 0.8rem;
}
.bouton-retirer:hover:not(:disabled) { background: #fdecec; }

/* ---------- Fiche d'inventaire ---------- */
.fiche-date { display: flex; align-items: center; gap: 0.35rem; margin: 0; font-size: 0.85rem; color: var(--muted); }
.fiche-resume {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin-bottom: 0.9rem;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  background: var(--fond-pale);
  font-size: 0.88rem;
}
.fiche-table { max-height: 50vh; overflow-y: auto; }
</style>
