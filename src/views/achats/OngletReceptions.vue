<!--
  =============================================================================
  ONGLET « RÉCEPTIONS FOURNISSEURS » (spec nov. 2026, §3)
  =============================================================================
  Enregistrement de chaque livraison reçue d'un fournisseur du district.
  Il n'y a plus de commande (le district commande dans l'application nationale).
  - Saisie : fournisseur, date, n° de facture / bon de livraison du fournisseur,
    et pour chaque produit : unité de comptage (affichée), quantité reçue,
    prix d'achat, n° de lot et date de péremption (obligatoires seulement
    pour un médicament « suivi par lot »), observation de la ligne.
    Un même médicament reçu en plusieurs lots : bouton « + lot ».
  - UNITÉ DE COMPTAGE : celle de la fiche du médicament (Paramétrage >
    Unités de comptage) ; elle dit à quoi correspond la quantité saisie
    (boîte, plaquette, flacon...). Non modifiable ici.
  - PRIX D'ACHAT : le DERNIER PRIX D'ACHAT est proposé (dernière réception
    validée, sinon Paramétrage > Prix) mais reste MODIFIABLE ; il est
    enregistré sur la ligne de réception, pas sur la fiche du médicament.
  - PÉREMPTION : trois cases jour / mois / année (composant ChampDate).
  - OBSERVATIONS : une générale (toute la réception) + une par ligne.
  - Brouillon (modifiable) -> VALIDÉE : c'est la VALIDATION qui fait entrer
    les médicaments dans le STOCK du district (irréversible ; une erreur se
    corrige par un ajustement dans le module Stock).
  - Bon de réception (PDF) et pièces justificatives.
  - CODES-BARRES (réception en brouillon) : champ « Scanner ou saisir le
    code-barres » (caméra, clavier, douchette) ou « 📱 Scanner avec le téléphone »
    (les boîtes scannées sur le téléphone arrivent ici à la suite).
      * boîte CONNUE   : le médicament est ajouté (dernier prix d'achat proposé) ;
        le même médicament rescanné = + 1 sur sa dernière ligne (dernier lot) ;
      * boîte INCONNUE : une ligne à compléter est ajoutée ; le code est RATTACHÉ
        au médicament choisi sur cette ligne (reconnu aux prochains scans).

  Événement : @modifie -> la page met à jour les compteurs
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, fournisseur, facture)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.fournisseurId" :options="fournisseurs" champ-libelle="raisonSociale" placeholder="Tous les fournisseurs" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_RECEPTION)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau
        titre="Réceptions fournisseurs"
        :sous-titre="sousTitrePdf"
        nom-fichier="receptions"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle réception</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° réception</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="fournisseur">Fournisseur</ColonneTri>
            <ColonneTri v-model="tri" cle="bonLivraison">Bon de livraison</ColonneTri>
            <ColonneTri v-model="tri" cle="facture">Facture fourn.</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in lignesPage" :key="r.id">
            <td class="code">{{ r.numero }}</td>
            <td>{{ formaterDate(r.dateReception) }}</td>
            <td><strong>{{ r.fournisseur.raisonSociale }}</strong></td>
            <td>{{ r.numBonLivraison || '—' }}</td>
            <td>{{ r.numFactureFourn || '—' }}</td>
            <td class="nombre">{{ formaterMontant(r.montantTotal) }}</td>
            <td><span class="badge" :class="STATUTS_RECEPTION[r.statut]?.badge">{{ STATUTS_RECEPTION[r.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrirFormulaire(r)">{{ r.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-si-imprimer class="bouton-lien" title="Bon de réception (PDF)" @click="imprimer(r)">Bon PDF</button>
              <button class="bouton-lien" @click="docPieces = r">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="receptionsAffichees.length" />
      <p v-if="!chargement && receptionsAffichees.length === 0" class="tableau-vide">Aucune réception.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== FORMULAIRE / CONSULTATION ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? `Réception ${formulaire.numero}` : 'Nouvelle réception'"
      tres-large
      class="fenetre-reception"
      @fermer="formulaire = null"
    >
      <!-- Réception validée : rappel et bon de réception -->
      <div v-if="formulaire.statut === 'VALIDEE'" class="encart-suite">
        <div><strong>Réception validée : les médicaments sont en stock au district.</strong>
          Une erreur se corrige par un ajustement (module Stock).</div>
        <div class="encart-suite-boutons">
          <button v-si-imprimer type="button" @click="imprimer(formulaire)">Imprimer le bon de réception</button>
        </div>
      </div>

      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_RECEPTION[formulaire.statut]?.badge">{{ STATUTS_RECEPTION[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'VALIDEE'">
          Validée le {{ formaterDate(formulaire.dateValidation) }} : les médicaments sont entrés en stock.
        </small>
        <small v-else-if="formulaire.statut === 'BROUILLON'">Brouillon : le stock ne bouge qu'à la validation.</small>
      </div>

      <form id="form-reception" class="grille-formulaire quatre-colonnes" @submit.prevent="enregistrer(false)">
        <div>
          <label class="obligatoire">Fournisseur</label>
          <ListeDeroulante
            v-model="formulaire.fournisseurId"
            :options="fournisseursActifs"
            champ-libelle="raisonSociale"
            placeholder="— Choisir le fournisseur —"
            :desactive="lectureSeule"
            @update:model-value="actualiserPrix"
          />
        </div>
        <div>
          <label class="obligatoire">Date de réception</label>
          <ChampDate v-model="formulaire.dateReception" obligatoire :desactive="lectureSeule" @change="actualiserPrix" />
        </div>
        <div>
          <label>N° facture fournisseur</label>
          <input v-model.trim="formulaire.numFactureFourn" maxlength="50" :disabled="lectureSeule" />
        </div>
        <div>
          <label>N° bon de livraison</label>
          <input v-model.trim="formulaire.numBonLivraison" maxlength="50" :disabled="lectureSeule" />
        </div>

        <!-- ---------- Lignes ---------- -->
        <div class="pleine-largeur">
          <div class="titre-avec-export">
            <h4 class="section">Médicaments reçus</h4>
            <ImportExportTableau
              :titre="`Réception ${formulaire.numero || '(nouvelle)'}`"
              :sous-titre="formulaire.dateReception ? `Du ${formaterDate(formulaire.dateReception)}` : ''"
              :nom-fichier="`reception_${formulaire.numero || 'nouvelle'}`"
              :colonnes-pdf="COLONNES_LIGNES"
              :lignes="formulaire.lignes.filter((l) => l.medicamentId)"
            />
          </div>
          <!-- Scan des boîtes reçues : caméra, clavier / douchette, ou téléphone -->
          <div v-if="!lectureSeule" class="zone-scan">
            <div class="ligne-scan">
              <ChampCodeBarre continu titre-camera="Scanner les boîtes reçues" @code="ajouterParCode" />
              <button v-if="!telephone.actif.value" type="button" class="bouton-secondaire" @click="telephone.demarrer()">
                📱 Scanner avec le téléphone
              </button>
            </div>
            <div v-if="telephone.actif.value" class="attente-telephone">
              <span class="pulsation"></span>
              <div>
                <strong>Le téléphone peut scanner les boîtes…</strong>
                <small>
                  Sur le téléphone : page <strong>/scanner</strong> de l’application → « Le poste attend un code » → <strong>Scanner</strong>.
                  {{ telephone.recus.value ? `${telephone.recus.value} boîte(s) reçue(s).` : '' }}
                </small>
              </div>
              <button type="button" class="bouton-secondaire" @click="telephone.arreter()">Terminer</button>
            </div>
            <p v-if="dernierScan" class="dernier-scan" :class="{ inconnu: dernierScan.inconnu }">{{ dernierScan.texte }}</p>
          </div>

          <p v-if="!lectureSeule" class="aide-prix">
            Le prix d'achat proposé est le dernier prix payé pour ce médicament : modifiez-le s'il a changé.
            Les quantités et prix sont par unité de comptage.
          </p>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Unité de comptage</th>
                <th class="nombre">Qté reçue</th>
                <th class="nombre">Prix d'achat</th>
                <th>N° de lot</th>
                <th>Péremption</th>
                <th class="nombre">Montant</th>
                <th>Observation</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.lignes" :key="index">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="ligne.medicamentId"
                    :options="medicamentsActifs"
                    :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                    placeholder="Choisir…"
                    @update:model-value="(id) => choisirMedicament(ligne, id)"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                  <small v-if="!lectureSeule && ligne.codeARattacher" class="detail code-a-rattacher">
                    Code <strong class="code">{{ ligne.codeARattacher }}</strong> inconnu : choisissez le médicament, le code lui sera rattaché.
                  </small>
                  <small v-if="suiviLot(ligne.medicamentId)" class="detail lot-requis">lot et péremption obligatoires</small>
                </td>
                <!-- Unité de comptage : celle de la fiche du médicament (à quoi correspond la quantité) -->
                <td class="col-unite">{{ uniteDe(ligne.medicamentId) || '—' }}</td>
                <td class="nombre"><input v-model.number="ligne.quantite" type="number" min="1" step="1" required :disabled="lectureSeule" /></td>
                <!-- Prix d'achat : dernier prix proposé, modifiable -->
                <td class="nombre">
                  <ChampMontant
                    v-model="ligne.prixUnitaire"
                    decimales
                    class="champ-prix"
                    :class="{ 'prix-manquant': ligne.medicamentId && !prixSaisi(ligne) }"
                    :placeholder="ligne.medicamentId ? 'À saisir' : ''"
                    :required="!!ligne.medicamentId"
                    :disabled="lectureSeule"
                  />
                </td>
                <td><input v-model.trim="ligne.numeroLot" maxlength="50" class="champ-lot" :required="suiviLot(ligne.medicamentId)" :disabled="lectureSeule" /></td>
                <td><ChampDate v-model="ligne.datePeremption" :obligatoire="suiviLot(ligne.medicamentId)" :desactive="lectureSeule" /></td>
                <td class="nombre"><strong>{{ formaterMontant((ligne.quantite || 0) * (ligne.prixUnitaire || 0)) }}</strong></td>
                <td>
                  <input
                    v-if="!lectureSeule"
                    v-model.trim="ligne.observation"
                    maxlength="500"
                    class="champ-observation"
                    placeholder="Facultatif"
                  />
                  <span v-else>{{ ligne.observation || '' }}</span>
                </td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien" title="Même médicament, autre lot" @click="ajouterLot(index)">+ lot</button>
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6">
                  <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="ajouterLigne">
                    + Ajouter un médicament
                  </button>
                </td>
                <td class="nombre total">{{ formaterMontant(totalFormulaire) }}</td>
                <td></td>
                <td v-if="!lectureSeule"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="pleine-largeur">
          <label>Observations générales (toute la réception)</label>
          <textarea v-model.trim="formulaire.observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button v-if="formulaire.id" type="button" class="bouton-secondaire" @click="docPieces = formulaire">Pièces jointes</button>
        <button v-if="formulaire.id && formulaire.statut !== 'ANNULEE'" v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer(formulaire)">
          Bon de réception PDF
        </button>
        <template v-if="!lectureSeule">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">
            Annuler la réception
          </button>
          <button v-si-modif type="submit" form="form-reception" class="bouton-secondaire" :disabled="enregistrement">
            Enregistrer le brouillon
          </button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Valider (entrée en stock)</button>
        </template>
      </template>
    </FenetreModale>

    <!-- Pièces jointes -->
    <PiecesJointes
      v-if="docPieces"
      type="Reception"
      :id="docPieces.id"
      :titre="`Pièces de la réception ${docPieces.numero}`"
      @fermer="docPieces = null"
    />
  </div>
</template>

<script setup>
import ChampMontant from '@/components/ChampMontant.vue'
import ChampCodeBarre from '@/components/ChampCodeBarre.vue'
import { bip, codeValide } from '@/utils/codeBarre'
import { utiliserScanDistant } from '@/utils/scanDistant'
import http from '@/api/http'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ChampDate from '@/components/ChampDate.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import PiecesJointes from '@/components/PiecesJointes.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import {
  annulerReception,
  creerReception,
  listerReceptions,
  modifierReception,
  prixAchatReception,
  trouverReception,
  validerReception,
} from '@/api/achats'
import { bonDeReceptionPdf, optionsStatuts, STATUTS_RECEPTION } from './achatsCommun'

const emit = defineEmits(['modifie'])
const store = useStore()

const receptions = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ fournisseurId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const docPieces = ref(null)

// Listes du Paramétrage
const fournisseurs = computed(() => store.state.referentiel.fournisseurs)
const fournisseursActifs = computed(() => fournisseurs.value.filter((f) => f.actif || f.id === formulaire.value?.fournisseurId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

/** Réception non modifiable (validée ou annulée). */
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

const receptionsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return receptions.value
  return receptions.value.filter((r) =>
    [r.numero, r.fournisseur.raisonSociale, r.numFactureFourn, r.numBonLivraison].some((v) => (v || '').toLowerCase().includes(texte)),
  )
})

async function charger() {
  chargement.value = true
  try {
    receptions.value = await listerReceptions(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// FORMULAIRE
// ---------------------------------------------------------------------------

function videFormulaire() {
  return {
    fournisseurId: null,
    dateReception: dateDuJour(),
    numFactureFourn: '',
    numBonLivraison: '',
    observations: '',
    lignes: [nouvelleLigne()],
  }
}
/**
 * Ligne vide. prixUnitaire = null tant que le prix n'est ni proposé ni saisi.
 * codeARattacher : code-barres inconnu scanné, rattaché au médicament choisi sur la ligne.
 */
function nouvelleLigne(medicamentId = null, quantite = 1, prixUnitaire = null) {
  return { medicamentId, quantite, prixUnitaire, numeroLot: '', datePeremption: '', observation: '', codeARattacher: null }
}

/** Vrai si la ligne a un prix d'achat (0 accepté, ex. don). */
function prixSaisi(ligne) {
  return ligne.prixUnitaire !== null && ligne.prixUnitaire !== undefined && ligne.prixUnitaire !== '' && Number(ligne.prixUnitaire) >= 0
}

/** Ouvre une réception existante (détail) ou une nouvelle réception. */
async function ouvrirFormulaire(reception = null) {
  if (!reception) {
    formulaire.value = videFormulaire()
    return
  }
  try {
    const r = await trouverReception(reception.id)
    formulaire.value = {
      ...r,
      dateReception: r.dateReception.substring(0, 10),
      numFactureFourn: r.numFactureFourn || '',
      numBonLivraison: r.numBonLivraison || '',
      observations: r.observations || '',
      lignes: r.lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: l.quantite,
        prixUnitaire: Number(l.prixUnitaire),
        numeroLot: l.numeroLot || '',
        datePeremption: l.datePeremption ? l.datePeremption.substring(0, 10) : '',
        observation: l.observation || '',
      })),
    }
    // Brouillon : les prix saisis sont gardés tels quels (pas de recalcul)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/**
 * Propose le DERNIER PRIX D'ACHAT (calculé par le serveur : dernière réception
 * validée chez ce fournisseur, sinon chez un autre, sinon Paramétrage > Prix).
 * Seules les lignes SANS PRIX sont remplies : un prix déjà tapé par
 * l'utilisateur n'est jamais écrasé.
 * Appelé quand le fournisseur, la date ou un médicament change.
 */
async function actualiserPrix() {
  const f = formulaire.value
  if (!f || lectureSeule.value) return
  const aCompleter = f.lignes.filter((l) => l.medicamentId && !prixSaisi(l))
  const ids = [...new Set(aCompleter.map((l) => l.medicamentId))]
  if (ids.length === 0) return
  try {
    const prix = await prixAchatReception({ medicamentIds: ids, fournisseurId: f.fournisseurId, date: f.dateReception })
    for (const ligne of aCompleter) {
      // L'utilisateur a pu taper un prix pendant l'appel au serveur : on ne l'écrase pas
      if (!prixSaisi(ligne)) ligne.prixUnitaire = prix[ligne.medicamentId] ?? null
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

function ajouterLigne() {
  formulaire.value.lignes.push(nouvelleLigne())
}

/** Même médicament reçu dans un autre lot : nouvelle ligne juste en dessous. */
function ajouterLot(index) {
  const l = formulaire.value.lignes[index]
  formulaire.value.lignes.splice(index + 1, 0, nouvelleLigne(l.medicamentId, 1, l.prixUnitaire))
}

/** Médicament choisi : son dernier prix d'achat est proposé (+ code-barres inconnu rattaché). */
function choisirMedicament(ligne, medicamentId) {
  ligne.prixUnitaire = null
  if (medicamentId) actualiserPrix()
  if (medicamentId && ligne.codeARattacher) rattacherCode(ligne)
}

// ---------------------------------------------------------------------------
// CODES-BARRES : une boîte scannée = 1 unité de comptage sur la ligne du médicament
// ---------------------------------------------------------------------------
const dernierScan = ref(null)

/** Médicament d'un code : liste déjà chargée, sinon serveur (code ajouté entre-temps). */
async function medicamentDuCode(code) {
  const local = medicaments.value.find((m) => m.codesBarres?.some((c) => c.code === code))
  if (local) return local
  try {
    const { data } = await http.get(`/medicaments/code-barre/${encodeURIComponent(code)}`)
    store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
    return data.medicament
  } catch {
    return null
  }
}

/** Ligne vide à remplir (sinon une nouvelle ligne en bas). */
function ligneLibre() {
  const f = formulaire.value
  let ligne = f.lignes.find((l) => !l.medicamentId && !l.codeARattacher)
  if (!ligne) {
    f.lignes.push(nouvelleLigne())
    ligne = f.lignes[f.lignes.length - 1]
  }
  return ligne
}

async function ajouterParCode(code) {
  const f = formulaire.value
  if (!f || lectureSeule.value) return
  if (!codeValide(code)) {
    bip(true)
    dernierScan.value = { inconnu: true, texte: `✗ Code-barres invalide : ${code}` }
    return
  }
  const m = await medicamentDuCode(code)
  if (!m) {
    // Code inconnu : ligne à compléter, le code sera rattaché au médicament choisi
    bip(true)
    ligneLibre().codeARattacher = code
    dernierScan.value = { inconnu: true, texte: `✗ Code ${code} inconnu : choisissez le médicament sur la ligne ajoutée, le code lui sera rattaché.` }
    return
  }
  if (!m.actif) {
    bip(true)
    dernierScan.value = { inconnu: true, texte: `✗ ${m.designation} est désactivé (Paramétrage > Médicaments).` }
    return
  }
  // Même médicament déjà sur une ligne : + 1 sur sa DERNIÈRE ligne (dernier lot saisi)
  const lignesDuMedicament = f.lignes.filter((l) => l.medicamentId === m.id)
  let ligne = lignesDuMedicament[lignesDuMedicament.length - 1]
  if (ligne) ligne.quantite = (Number(ligne.quantite) || 0) + 1
  else {
    ligne = ligneLibre()
    ligne.medicamentId = m.id
    ligne.quantite = 1
    choisirMedicament(ligne, m.id)
  }
  bip()
  dernierScan.value = {
    texte: `✓ ${m.designation} — quantité ${ligne.quantite}.${m.suiviLot ? ' Saisissez le n° de lot et la péremption.' : ''}`,
  }
}

/** Rattache le code inconnu de la ligne au médicament choisi. */
async function rattacherCode(ligne) {
  const code = ligne.codeARattacher
  ligne.codeARattacher = null
  try {
    await http.post(`/medicaments/${ligne.medicamentId}/codes-barres`, { code })
    store.dispatch('notifications/succes', `Code ${code} rattaché à ${libelleMedicament(ligne.medicamentId)}.`)
    await store.dispatch('referentiel/charger', { liste: 'medicaments' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// Scan avec le téléphone : les boîtes scannées sur le téléphone arrivent à la suite
const telephone = utiliserScanDistant({
  libelle: () => {
    const f = fournisseurs.value.find((x) => x.id === formulaire.value?.fournisseurId)
    return `Réception${f ? ` — ${f.raisonSociale}` : ''}`
  },
  continu: true,
  surCode: ajouterParCode,
})
watch(() => formulaire.value?.fournisseurId, () => telephone.renommer())
// Fenêtre fermée ou autre réception ouverte : l'attente du téléphone s'arrête
watch(formulaire, (nouveau, ancien) => {
  if (nouveau !== ancien) {
    dernierScan.value = null
    if (telephone.actif.value) telephone.arreter()
  }
})

function medicament(id) {
  return medicaments.value.find((m) => m.id === id)
}
function libelleMedicament(id) {
  const m = medicament(id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function uniteDe(id) {
  return medicament(id)?.uniteVente?.libelle || ''
}
function suiviLot(id) {
  return !!medicament(id)?.suiviLot
}

const totalFormulaire = computed(() =>
  (formulaire.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0),
)

/**
 * Enregistre la réception (brouillon) ; avec « valider », la valide ensuite :
 * les médicaments entrent alors dans le STOCK du dépôt.
 */
async function enregistrer(valider) {
  const f = formulaire.value
  // Champs obligatoires et dates incomplètes : message du navigateur sur la case concernée
  if (!document.getElementById('form-reception')?.reportValidity()) return
  if (!f.fournisseurId) return store.dispatch('notifications/erreur', 'Choisissez le fournisseur.')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament reçu.')
  if (lignes.some((l) => !(l.quantite >= 1))) return store.dispatch('notifications/erreur', 'Chaque quantité reçue doit être au moins 1.')
  const sansPrix = lignes.find((l) => !prixSaisi(l))
  if (sansPrix) {
    return store.dispatch('notifications/erreur', `${libelleMedicament(sansPrix.medicamentId)} : saisissez le prix d'achat.`)
  }

  if (valider) {
    const sansLot = lignes.find((l) => suiviLot(l.medicamentId) && (!l.numeroLot || !l.datePeremption))
    if (sansLot) {
      return store.dispatch('notifications/erreur', `${libelleMedicament(sansLot.medicamentId)} : n° de lot et péremption obligatoires.`)
    }
    const confirme = await confirmer({
      titre: 'Valider la réception ?',
      texte: `Les ${lignes.length} ligne(s) reçue(s) vont ENTRER EN STOCK au dépôt. Une réception validée ne peut plus être modifiée (correction par ajustement).`,
      boutonConfirmer: 'Oui, valider et mettre en stock',
    })
    if (!confirme) return
  }

  enregistrement.value = true
  try {
    const donnees = {
      fournisseurId: f.fournisseurId,
      dateReception: f.dateReception,
      numFactureFourn: f.numFactureFourn || undefined,
      numBonLivraison: f.numBonLivraison || undefined,
      observations: f.observations || undefined,
      lignes: lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire),
        numeroLot: l.numeroLot || undefined,
        datePeremption: l.datePeremption || undefined,
        observation: l.observation || undefined,
      })),
    }
    let reception = f.id ? await modifierReception(f.id, donnees) : await creerReception(donnees)
    if (valider) reception = await validerReception(reception.id)
    store.dispatch(
      'notifications/succes',
      valider ? `Réception ${reception.numero} validée : stock mis à jour.` : `Réception ${reception.numero} enregistrée (brouillon).`,
    )
    await ouvrirFormulaire(reception)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function annuler() {
  const f = formulaire.value
  const confirme = await confirmer({
    titre: `Annuler la réception ${f.numero} ?`,
    texte: 'Elle restera dans l\'historique avec le statut « Annulée » (le stock n\'a pas bougé).',
    boutonConfirmer: 'Oui, annuler',
    danger: true,
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const reception = await annulerReception(f.id)
    store.dispatch('notifications/succes', `Réception ${reception.numero} annulée.`)
    await ouvrirFormulaire(reception)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function imprimer(reception) {
  try {
    await bonDeReceptionPdf(await trouverReception(reception.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination, PDF de la liste
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (r) => r.numero,
  date: (r) => r.dateReception,
  fournisseur: (r) => r.fournisseur.raisonSociale,
  bonLivraison: (r) => r.numBonLivraison,
  facture: (r) => r.numFactureFourn,
  montant: (r) => Number(r.montantTotal),
  statut: (r) => STATUTS_RECEPTION[r.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(receptionsAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const f = fournisseurs.value.find((x) => x.id === filtres.fournisseurId)
  return [
    f ? `Fournisseur : ${f.raisonSociale}` : 'Tous les fournisseurs',
    filtres.statut ? STATUTS_RECEPTION[filtres.statut].libelle : 'tous les statuts',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ].filter(Boolean).join(' — ')
})

// Export PDF / Excel des lignes de la fenêtre de réception
const COLONNES_LIGNES = [
  { titre: 'Médicament', valeur: (l) => libelleMedicament(l.medicamentId) },
  { titre: 'Unité de comptage', valeur: (l) => uniteDe(l.medicamentId) },
  { titre: 'Qté reçue', valeur: (l) => formaterNombre(Number(l.quantite) || 0), droite: true, somme: (l) => Number(l.quantite) || 0 },
  { titre: "Prix d'achat", valeur: (l) => (prixSaisi(l) ? formaterMontant(l.prixUnitaire) : 'À saisir'), droite: true },
  { titre: 'N° de lot', valeur: (l) => l.numeroLot || '' },
  { titre: 'Péremption', valeur: (l) => (l.datePeremption ? formaterDate(l.datePeremption) : '') },
  { titre: 'Montant', valeur: (l) => formaterMontant((l.quantite || 0) * (l.prixUnitaire || 0)), droite: true,
    somme: (l) => (l.quantite || 0) * (l.prixUnitaire || 0), formatTotal: formaterMontant },
  { titre: 'Observation', valeur: (l) => l.observation || '' },
]

const COLONNES_PDF = [
  { titre: 'N° réception', valeur: (r) => r.numero },
  { titre: 'Date', valeur: (r) => formaterDate(r.dateReception) },
  { titre: 'Fournisseur', valeur: (r) => r.fournisseur.raisonSociale },
  { titre: 'Bon de livraison', valeur: (r) => r.numBonLivraison },
  { titre: 'Facture', valeur: (r) => r.numFactureFourn },
  { titre: 'Montant', valeur: (r) => formaterMontant(r.montantTotal), droite: true, somme: (r) => r.montantTotal, formatTotal: formaterMontant },
  { titre: 'Statut', valeur: (r) => STATUTS_RECEPTION[r.statut]?.libelle },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'fournisseurs' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.detail { font-size: 0.78rem; color: var(--muted); }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.section {
  margin: 0.25rem 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
/* Fenêtre de réception : un peu plus large que « très large » (1200 px) pour éviter de défiler */
.fenetre-reception :deep(.fenetre) { max-width: 1400px; }
.grille-formulaire.quatre-colonnes { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 900px) {
  .grille-formulaire.quatre-colonnes { grid-template-columns: 1fr 1fr; }
}
.lignes td { padding: 0.45rem 0.4rem; }
.lignes .col-medicament { min-width: 240px; }
.lignes .col-medicament .detail { display: block; }
.lignes input[type='number'] { width: 90px; text-align: right; }
.champ-lot { width: 120px; }
.lignes .champ-prix { width: 110px; }
.champ-observation { width: 160px; }
.col-unite { white-space: nowrap; color: var(--muted); }
.lot-requis { color: #b35c00; font-weight: 600; }
.lignes .prix-manquant { border-color: #c0392b; }
.aide-prix { margin: 0 0 0.5rem; font-size: 0.8rem; color: var(--muted); }
.lignes .total { font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
textarea { width: 100%; resize: vertical; }
/* Scan des boîtes */
.zone-scan { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
.ligne-scan { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.ligne-scan > :first-child { flex: 1; min-width: 260px; }
.attente-telephone {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: var(--primary-light);
}
.attente-telephone > div { flex: 1; }
.attente-telephone small { display: block; color: var(--muted); }
.pulsation {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulsation 1.2s infinite;
}
@keyframes pulsation {
  0% { box-shadow: 0 0 0 0 rgba(0, 163, 108, 0.6); }
  100% { box-shadow: 0 0 0 10px rgba(0, 163, 108, 0); }
}
.dernier-scan { margin: 0; font-size: 0.88rem; color: #15803d; }
.dernier-scan.inconnu { color: var(--danger); }
.code-a-rattacher { color: var(--danger); }
</style>
