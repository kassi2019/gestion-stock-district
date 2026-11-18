<!--
  =============================================================================
  ONGLET « MOUVEMENTS »
  =============================================================================
  - HISTORIQUE de tous les mouvements du stock du dépôt : date et heure, type
    (entrée réception, ajustement, périmés, transfert, inventaire...),
    médicament, lot, quantité (+/−), stock avant -> après, motif, pièce,
    auteur. Filtres : médicament, type, période (le mois en cours par défaut).
  - NOUVEAU MOUVEMENT (droit « Modifier ») : ajustement +/−, sortie de
    périmés, transfert entrant/sortant. MOTIF OBLIGATOIRE, référence de pièce,
    et pièce justificative (fichier) à joindre ensuite.
    • SORTIE : on choisit le LOT à diminuer (lots en stock, avec quantité) ;
    • ENTRÉE : n° de lot et péremption (obligatoires si suivi par lot).
    Le mouvement est appliqué IMMÉDIATEMENT au stock (après confirmation).
  Une RÉCEPTION (module Achats) reste une entrée réelle, distincte d'un ajustement.

  Propriété : etat (stock actuel, pour proposer les lots)
  Événement : @modifie -> la page recharge l'état du stock
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <div class="filtre large">
        <ListeDeroulante
          v-model="filtres.medicamentId"
          :options="etat"
          :champ-libelle="(m) => `${m.code} — ${m.designation}`"
          placeholder="Tous les médicaments"
        />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.type" :options="OPTIONS_TYPES" placeholder="Tous les types" />
      </div>
      <div class="periode">
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau
        titre="Mouvements de stock du dépôt"
        :sous-titre="sousTitrePdf"
        nom-fichier="mouvements_stock"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouveau mouvement</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="type">Mouvement</ColonneTri>
            <ColonneTri v-model="tri" cle="medicament">Médicament</ColonneTri>
            <ColonneTri v-model="tri" cle="lot">Lot</ColonneTri>
            <ColonneTri v-model="tri" cle="quantite" class="nombre">Quantité</ColonneTri>
            <th class="nombre">Stock avant → après</th>
            <ColonneTri v-model="tri" cle="motif">Motif / pièce</ColonneTri>
            <ColonneTri v-model="tri" cle="auteur">Par</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mv in lignesPage" :key="mv.id">
            <td>{{ formaterDateHeure(mv.dateMouvement) }}</td>
            <td><span class="badge" :class="TYPES_MOUVEMENT[mv.type]?.badge">{{ TYPES_MOUVEMENT[mv.type]?.libelle || mv.type }}</span></td>
            <td><strong>{{ mv.medicament.designation }}</strong> <div class="detail">{{ mv.medicament.code }}</div></td>
            <td>{{ mv.lot?.numeroLot || '—' }}</td>
            <td class="nombre"><strong :class="TYPES_MOUVEMENT[mv.type]?.sens > 0 ? 'entree' : 'sortie'">{{ quantiteSignee(mv) }}</strong></td>
            <td class="nombre detail">{{ formaterNombre(mv.stockAvant) }} → <strong>{{ formaterNombre(mv.stockApres) }}</strong></td>
            <td class="motif">
              {{ mv.motif || '—' }}
              <div v-if="mv.pieceRef" class="detail code">{{ mv.pieceRef }}</div>
            </td>
            <td class="detail">{{ mv.utilisateur?.prenoms }} {{ mv.utilisateur?.nom }}</td>
            <td class="actions">
              <button v-if="mv.sourceType === 'MANUEL'" class="bouton-lien" @click="docPieces = mv">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="mouvements.length" />
      <p v-if="!chargement && mouvements.length === 0" class="tableau-vide">Aucun mouvement pour ces critères.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== NOUVEAU MOUVEMENT ===================== -->
    <FenetreModale v-if="formulaire" titre="Nouveau mouvement de stock" large @fermer="formulaire = null">
      <form id="form-mouvement" class="grille-formulaire" @submit.prevent="enregistrer">
        <div class="pleine-largeur">
          <label class="obligatoire">Type de mouvement</label>
          <div class="choix-types">
            <label v-for="t in TYPES_MANUELS" :key="t.id" class="choix-type" :class="{ choisi: formulaire.type === t.id, sortie: t.sens < 0 }">
              <input v-model="formulaire.type" type="radio" :value="t.id" hidden @change="changerType" />
              <strong>{{ t.sens > 0 ? '▲' : '▼' }} {{ t.libelle }}</strong>
              <small>{{ t.aide }}</small>
            </label>
          </div>
        </div>

        <div class="pleine-largeur">
          <label class="obligatoire">Médicament</label>
          <ListeDeroulante
            v-model="formulaire.medicamentId"
            :options="etatActifs"
            :champ-libelle="(m) => `${m.code} — ${m.designation} (stock : ${m.stock})`"
            placeholder="Choisir le médicament…"
            @update:model-value="formulaire.lotChoisi = null"
          />
        </div>

        <!-- SORTIE : lot à diminuer -->
        <template v-if="estSortie">
          <div class="pleine-largeur">
            <label class="obligatoire">Lot à diminuer</label>
            <ListeDeroulante
              v-model="formulaire.lotChoisi"
              :options="lotsDisponibles"
              placeholder="Choisir le lot…"
              :effacable="false"
            />
            <small v-if="medicamentChoisi && lotsDisponibles.length === 0" class="aide erreur-texte">Ce médicament n'a aucun stock.</small>
          </div>
        </template>
        <!-- ENTRÉE : lot (nouveau ou existant) -->
        <template v-else>
          <div>
            <label :class="{ obligatoire: medicamentChoisi?.suiviLot }">N° de lot</label>
            <input v-model.trim="formulaire.numeroLot" maxlength="50" :required="medicamentChoisi?.suiviLot" placeholder="ex. LOT2026-01" />
          </div>
          <div>
            <label :class="{ obligatoire: medicamentChoisi?.suiviLot }">Date de péremption</label>
            <ChampDate v-model="formulaire.datePeremption" :obligatoire="medicamentChoisi?.suiviLot" />
          </div>
        </template>

        <div>
          <label class="obligatoire">Quantité</label>
          <input v-model.number="formulaire.quantite" type="number" min="1" :max="estSortie ? disponible : undefined" step="1" required />
          <small v-if="estSortie && formulaire.lotChoisi !== null" class="aide">{{ disponible }} disponible(s)</small>
        </div>
        <div>
          <label>Référence de la pièce</label>
          <input v-model.trim="formulaire.pieceRef" maxlength="50" placeholder="ex. PV-2026-03, bordereau n°…" />
        </div>
        <div class="pleine-largeur">
          <label class="obligatoire">Motif</label>
          <input v-model.trim="formulaire.motif" required maxlength="255" placeholder="ex. Cartons abîmés lors du rangement" />
        </div>

        <p v-if="apercu" class="pleine-largeur apercu" :class="estSortie ? 'sortie' : 'entree'">
          Stock de {{ medicamentChoisi.designation }} : <strong>{{ formaterNombre(medicamentChoisi.stock) }}</strong>
          → <strong>{{ formaterNombre(apercu) }}</strong>
        </p>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-mouvement" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Enregistrer le mouvement' }}
        </button>
      </template>
    </FenetreModale>

    <PiecesJointes
      v-if="docPieces"
      module="stock"
      type="MouvementStock"
      :id="docPieces.id"
      :titre="`Pièces du mouvement du ${formaterDateHeure(docPieces.dateMouvement)}`"
      @fermer="docPieces = null"
    />
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import PiecesJointes from '@/components/PiecesJointes.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { formaterDate, formaterNombre } from '@/utils/format'
import { creerMouvement, listerMouvements } from '@/api/stock'
import { OPTIONS_TYPES, quantiteSignee, TYPES_MANUELS, TYPES_MOUVEMENT } from './stockCommun'

const props = defineProps({
  etat: { type: Array, required: true },
})
const emit = defineEmits(['modifie'])
const store = useStore()

/** 1er jour du mois en cours (AAAA-MM-JJ) : période par défaut. */
function debutDuMois() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const mouvements = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const filtres = reactive({ medicamentId: null, type: null, du: debutDuMois(), au: '' })
const formulaire = ref(null)
const docPieces = ref(null)

function formaterDateHeure(valeur) {
  const d = new Date(valeur)
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

async function charger() {
  chargement.value = true
  try {
    mouvements.value = await listerMouvements(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// NOUVEAU MOUVEMENT
// ---------------------------------------------------------------------------
/** Changement de type : lot à rechoisir ; produit retiré s'il n'est plus dans la liste (sortie d'un produit à 0). */
function changerType() {
  formulaire.value.lotChoisi = null
  if (!etatActifs.value.some((m) => m.id === formulaire.value.medicamentId)) formulaire.value.medicamentId = null
}
// Médicaments actifs ; pour une SORTIE, seulement ceux qui ont du stock (> 0)
const etatActifs = computed(() => props.etat.filter((m) => m.actif && (!estSortie.value || m.stock > 0)))
const medicamentChoisi = computed(() => props.etat.find((m) => m.id === formulaire.value?.medicamentId) || null)
const estSortie = computed(() => (TYPES_MOUVEMENT[formulaire.value?.type]?.sens ?? 1) < 0)

/**
 * Lots en stock du médicament choisi (pour une sortie).
 * id = identifiant du lot, ou 'SANS_LOT' pour le stock sans lot.
 */
const lotsDisponibles = computed(() =>
  (medicamentChoisi.value?.lots || []).map((l) => ({
    id: l.lotId ?? 'SANS_LOT',
    libelle: `${l.numeroLot || 'Sans lot'}${l.datePeremption ? ' — exp. ' + formaterDate(l.datePeremption) : ''} — ${l.quantite} en stock`,
    quantite: l.quantite,
  })),
)
const disponible = computed(() => lotsDisponibles.value.find((l) => l.id === formulaire.value?.lotChoisi)?.quantite ?? 0)

/** Aperçu du stock du médicament après le mouvement. */
const apercu = computed(() => {
  const f = formulaire.value
  if (!medicamentChoisi.value || !(f.quantite > 0)) return null
  return medicamentChoisi.value.stock + (estSortie.value ? -f.quantite : f.quantite)
})

function ouvrirFormulaire() {
  formulaire.value = {
    type: 'AJUSTEMENT_NEGATIF',
    medicamentId: null,
    lotChoisi: null,
    numeroLot: '',
    datePeremption: '',
    quantite: 1,
    motif: '',
    pieceRef: '',
  }
}

async function enregistrer() {
  const f = formulaire.value
  if (!f.medicamentId) return store.dispatch('notifications/erreur', 'Choisissez le médicament.')
  if (estSortie.value && f.lotChoisi === null) return store.dispatch('notifications/erreur', 'Choisissez le lot à diminuer.')
  if (estSortie.value && f.quantite > disponible.value) {
    return store.dispatch('notifications/erreur', `Seulement ${disponible.value} disponible(s) dans ce lot.`)
  }

  const type = TYPES_MOUVEMENT[f.type]
  const confirme = await confirmer({
    titre: `${type.libelle} : confirmer ?`,
    texte: `${type.sens > 0 ? '+' : '−'}${f.quantite} ${medicamentChoisi.value.designation}. Le stock passe de ${medicamentChoisi.value.stock} à ${apercu.value}. Le mouvement est enregistré définitivement (motif, auteur, date).`,
    boutonConfirmer: 'Oui, enregistrer',
    danger: type.sens < 0,
  })
  if (!confirme) return

  enregistrement.value = true
  try {
    const mouvement = await creerMouvement({
      type: f.type,
      medicamentId: f.medicamentId,
      quantite: Number(f.quantite),
      motif: f.motif,
      pieceRef: f.pieceRef || undefined,
      ...(estSortie.value
        ? { lotId: f.lotChoisi === 'SANS_LOT' ? undefined : f.lotChoisi }
        : { numeroLot: f.numeroLot || undefined, datePeremption: f.datePeremption || undefined }),
    })
    store.dispatch('notifications/succes', 'Mouvement enregistré : stock mis à jour.')
    emit('modifie')
    await charger()
    // La fenêtre reste ouverte, vidée (même type), pour un autre mouvement
    const typeGarde = f.type
    ouvrirFormulaire()
    formulaire.value.type = typeGarde
    // Proposer de joindre la pièce justificative
    const joindre = await confirmer({
      titre: 'Joindre une pièce justificative ?',
      texte: 'Procès-verbal, bordereau de transfert, constat de péremption… (PDF ou image)',
      boutonConfirmer: 'Oui, joindre un fichier',
    })
    if (joindre) docPieces.value = mouvement
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  date: (mv) => mv.dateMouvement,
  type: (mv) => TYPES_MOUVEMENT[mv.type]?.libelle,
  medicament: (mv) => mv.medicament.designation,
  lot: (mv) => mv.lot?.numeroLot,
  quantite: (mv) => mv.quantite * (TYPES_MOUVEMENT[mv.type]?.sens ?? 1),
  motif: (mv) => mv.motif,
  auteur: (mv) => mv.utilisateur?.nom,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(mouvements, [], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const m = props.etat.find((x) => x.id === filtres.medicamentId)
  return [
    m ? `Médicament : ${m.designation}` : 'Tous les médicaments',
    filtres.type ? TYPES_MOUVEMENT[filtres.type].libelle : 'tous les types',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : 'toutes périodes',
  ].join(' — ')
})

const COLONNES_PDF = [
  { titre: 'Date', valeur: (mv) => formaterDateHeure(mv.dateMouvement) },
  { titre: 'Mouvement', valeur: (mv) => TYPES_MOUVEMENT[mv.type]?.libelle || mv.type },
  { titre: 'Médicament', valeur: (mv) => `${mv.medicament.code} — ${mv.medicament.designation}` },
  { titre: 'Lot', valeur: (mv) => mv.lot?.numeroLot },
  { titre: 'Quantité', valeur: (mv) => quantiteSignee(mv), droite: true },
  { titre: 'Avant', valeur: (mv) => formaterNombre(mv.stockAvant), droite: true },
  { titre: 'Après', valeur: (mv) => formaterNombre(mv.stockApres), droite: true },
  { titre: 'Motif', valeur: (mv) => mv.motif },
  { titre: 'Pièce', valeur: (mv) => mv.pieceRef },
  { titre: 'Par', valeur: (mv) => `${mv.utilisateur?.prenoms || ''} ${mv.utilisateur?.nom || ''}`.trim() },
]

onMounted(charger)
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.filtre.large { min-width: 300px; }
.detail { font-size: 0.75rem; color: var(--muted); }
.motif { max-width: 260px; font-size: 0.85rem; }
.entree { color: var(--primary-dark); }
.sortie { color: var(--danger); }

/* Choix du type de mouvement (cartes) */
.choix-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; }
.choix-type {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  color: var(--texte-sur-fond);
}
.choix-type strong { font-size: 0.85rem; color: var(--primary-dark); }
.choix-type.sortie strong { color: #b35c00; }
.choix-type small { font-size: 0.72rem; color: var(--muted); line-height: 1.3; }
.choix-type:hover { border-color: var(--primary); }
.choix-type.choisi { border-color: var(--primary); background: var(--primary-light); }
.choix-type.sortie.choisi { border-color: #e67e22; background: #fff6e5; }

.aide { display: block; margin-top: 0.2rem; font-size: 0.78rem; color: var(--muted); }
.erreur-texte { color: var(--danger); }
.apercu { margin: 0; padding: 0.65rem 1rem; border-radius: 10px; font-size: 0.9rem; }
.apercu.entree { background: var(--primary-light); }
.apercu.sortie { background: #fff6e5; color: #7a4a00; }
</style>
