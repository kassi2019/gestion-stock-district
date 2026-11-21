<!--
  =============================================================================
  ONGLET « PAIEMENTS ET AVANCES »
  =============================================================================
  Encaissements des centres (cahier des charges §3.6) :
  - NOUVEAU PAIEMENT : centre, date, mode, référence, montant. Le montant est
    RÉPARTI sur les factures non soldées du centre ; le reste devient une
    AVANCE. Formulaire commun : FormulairePaiement.vue.
  - AVANCE : paiement sans facture ; « Imputer » la répartit plus tard.
  - REÇU en PDF ; ANNULATION tracée (motif) : factures recalculées.
  Propriété : preparation ({ centreId, factureId }) venant d'une facture
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n° reçu, centre, référence)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.mode" :options="options(MODES_PAIEMENT)" placeholder="Tous les modes" />
      </div>
      <div class="periode">
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <label class="case-a-cocher"><input v-model="filtres.avecAvance" type="checkbox" /> Avances disponibles</label>
      <span class="espace"></span>
      <ImportExportTableau titre="Paiements et avances" :sous-titre="sousTitrePdf" nom-fichier="paiements" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="nouveau()">+ Nouveau paiement</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° reçu</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="mode">Mode</ColonneTri>
            <th>Factures réglées</th>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="avance" class="nombre">Avance restante</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in lignesPage" :key="p.id" :class="{ 'ligne-inactive': p.annule }">
            <td class="code">{{ p.numero }}</td>
            <td>{{ formaterDate(p.datePaiement) }}</td>
            <td><strong>{{ p.centre.nom }}</strong></td>
            <td>
              {{ MODES_PAIEMENT[p.mode] || p.mode }}
              <small v-if="p.reference" class="detail">{{ p.reference }}</small>
            </td>
            <td>
              <span v-if="p.annule" class="badge badge-rouge">Annulé</span>
              <span v-else-if="p.imputations.length">{{ p.imputations.map((i) => i.facture.numero).join(', ') }}</span>
              <span v-else class="badge badge-orange">Avance</span>
            </td>
            <td class="nombre">{{ formaterMontant(p.montant) }}</td>
            <td class="nombre"><strong v-if="Number(p.montantNonImpute) > 0" class="avance">{{ formaterMontant(p.montantNonImpute) }}</strong><span v-else>—</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(p)">Voir</button>
              <button v-si-imprimer class="bouton-lien" title="Reçu (PDF)" @click="imprimer(p)">Reçu</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="paiementsAffiches.length" />
      <p v-if="!chargement && paiementsAffiches.length === 0" class="tableau-vide">Aucun paiement.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== NOUVEAU PAIEMENT / IMPUTATION ===================== -->
    <!-- Le formulaire lui-même est dans FormulairePaiement.vue (réutilisé par la Facturation) -->
    <FenetreModale v-if="saisie" :titre="saisie.avance ? `Imputer l'avance du reçu ${saisie.avance.numero}` : 'Nouveau paiement'" tres-large @fermer="saisie = null">
      <FormulairePaiement
        ref="formPaiement"
        :centre-id="saisie.centreId"
        :facture-cible="saisie.factureCible"
        :avance="saisie.avance"
        @enregistre="apresEnregistrement"
        @impossible="saisie = null"
      />
      <template #pied>
        <button class="bouton-secondaire" @click="saisie = null">Annuler</button>
        <button type="submit" form="form-paiement" :disabled="formPaiement?.enregistrement">{{ saisie.avance ? "Imputer l'avance" : 'Enregistrer le paiement' }}</button>
      </template>
    </FenetreModale>

    <!-- ===================== DÉTAIL D'UN PAIEMENT ===================== -->
    <FenetreModale v-if="detail" :titre="`Reçu ${detail.numero} — ${detail.centre.nom}`" large @fermer="detail = null">
      <div v-if="detail.annule" class="encart encart-alerte">
        <strong>Paiement annulé</strong> le {{ formaterDate(detail.dateAnnulation) }}
        <span v-if="detail.annulateur"> par {{ nomPersonne(detail.annulateur) }}</span> — motif : {{ detail.motifAnnulation }}
      </div>
      <div class="fiche">
        <div><span>Date</span><strong>{{ formaterDate(detail.datePaiement) }}</strong></div>
        <div><span>Mode</span><strong>{{ MODES_PAIEMENT[detail.mode] }}</strong></div>
        <div><span>Référence</span><strong>{{ detail.reference || '—' }}</strong></div>
        <div><span>Enregistré par</span><strong>{{ nomPersonne(detail.utilisateur) }}</strong></div>
        <div><span>Montant reçu</span><strong>{{ formaterMontant(detail.montant) }}</strong></div>
        <div><span>Avance restante</span><strong class="avance">{{ formaterMontant(detail.montantNonImpute) }}</strong></div>
      </div>
      <div class="titre-avec-export">
        <h4 class="section">Factures réglées</h4>
        <ImportExportTableau
          v-if="detail.imputations.length"
          :titre="`Factures réglées par le reçu ${detail.numero}`"
          :sous-titre="detail.centre.nom"
          :nom-fichier="`recu_${detail.numero}_factures`"
          :colonnes-pdf="COLONNES_FACTURES_REGLEES"
          :lignes="detail.imputations"
        />
      </div>
      <table v-if="detail.imputations.length" class="tableau lignes">
        <thead><tr><th>Facture</th><th>Date</th><th class="nombre">Montant facture</th><th class="nombre">Montant réglé</th></tr></thead>
        <tbody>
          <tr v-for="i in detail.imputations" :key="i.id">
            <td class="code">{{ i.facture.numero }}</td>
            <td>{{ formaterDate(i.facture.dateEmission) }}</td>
            <td class="nombre">{{ formaterMontant(i.facture.montantTotal) }}</td>
            <td class="nombre">{{ formaterMontant(i.montant) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="aide">{{ detail.annule ? 'Imputations retirées à l\'annulation.' : 'Aucune facture réglée : avance.' }}</p>
      <p v-if="detail.observations" class="aide">Observations : {{ detail.observations }}</p>
      <template #pied>
        <button class="bouton-secondaire" @click="detail = null">Fermer</button>
        <button v-si-imprimer type="button" class="bouton-secondaire" @click="recuPdf(detail)">Reçu (PDF)</button>
        <template v-if="!detail.annule">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler le paiement</button>
          <button v-if="Number(detail.montantNonImpute) > 0" v-si-modif type="button" @click="imputer">Imputer l'avance</button>
        </template>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import FormulairePaiement from './FormulairePaiement.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant } from '@/utils/format'
import { annulerPaiement, listerPaiements, trouverPaiement } from '@/api/facturation'
import { MODES_PAIEMENT, options, recuPdf } from '@/views/facturation/financesCommun'

const props = defineProps({
  /** { centreId, factureId } : paiement d'une facture précise (depuis Facturation) */
  preparation: { type: Object, default: null },
})
const emit = defineEmits(['modifie'])
const store = useStore()

const paiements = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, mode: null, du: '', au: '', avecAvance: false })
const saisie = ref(null) // fenêtre « Nouveau paiement / Imputer l'avance » ouverte
const formPaiement = ref(null) // composant FormulairePaiement (bouton désactivé pendant l'envoi)
const detail = ref(null)

const centres = computed(() => store.state.referentiel.centres)

const paiementsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return paiements.value
  return paiements.value.filter((p) => [p.numero, p.centre.nom, p.reference].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    paiements.value = await listerPaiements({ ...filtres, avecAvance: filtres.avecAvance ? 1 : '' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// NOUVEAU PAIEMENT (formulaire : FormulairePaiement.vue)
// ---------------------------------------------------------------------------
/** saisie = { centreId, factureCible, avance } : ouvre la fenêtre du formulaire. */
function nouveau(centreId = null, factureCible = null) {
  saisie.value = { centreId, factureCible, avance: null }
}

/** Paiement enregistré (ou avance imputée) : on affiche le reçu. */
async function apresEnregistrement(paiement) {
  saisie.value = null
  detail.value = paiement
  await charger()
  emit('modifie')
}

// ---------------------------------------------------------------------------
// DÉTAIL, IMPUTATION D'UNE AVANCE, ANNULATION
// ---------------------------------------------------------------------------
async function ouvrir(p) {
  try {
    detail.value = await trouverPaiement(p.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function imprimer(p) {
  try {
    await recuPdf(await trouverPaiement(p.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Imputer l'avance restante d'un reçu sur les factures non soldées du centre. */
function imputer() {
  saisie.value = { centreId: detail.value.centreId, factureCible: null, avance: detail.value }
  detail.value = null
}

async function annuler() {
  const motif = await demanderTexte({
    titre: `Annuler le paiement ${detail.value.numero} ?`,
    texte: 'Le paiement reste dans l\'historique (annulé) ; les factures réglées redeviennent à payer.',
    libelle: "Motif de l'annulation (ex. chèque rejeté)",
    boutonConfirmer: 'Annuler le paiement',
  })
  if (motif === null) return
  enregistrement.value = true
  try {
    detail.value = await annulerPaiement(detail.value.id, motif)
    store.dispatch('notifications/succes', 'Paiement annulé : factures recalculées.')
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// Paiement d'une facture précise (bouton « Enregistrer un paiement » de Facturation)
watch(
  () => props.preparation,
  (p) => p && nouveau(p.centreId, p.factureId),
  { immediate: true },
)

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (p) => p.numero,
  date: (p) => p.datePaiement,
  centre: (p) => p.centre.nom,
  mode: (p) => MODES_PAIEMENT[p.mode],
  montant: (p) => Number(p.montant),
  avance: (p) => Number(p.montantNonImpute),
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(paiementsAffiches, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    filtres.mode ? MODES_PAIEMENT[filtres.mode] : 'tous les modes',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ]
    .filter(Boolean)
    .join(' — ')
})
// Export PDF / Excel du tableau de la fenêtre « reçu »
const COLONNES_FACTURES_REGLEES = [
  { titre: 'Facture', valeur: (i) => i.facture.numero },
  { titre: 'Date', valeur: (i) => formaterDate(i.facture.dateEmission) },
  { titre: 'Montant facture', valeur: (i) => formaterMontant(i.facture.montantTotal), droite: true },
  { titre: 'Montant réglé', valeur: (i) => formaterMontant(i.montant), droite: true, somme: (i) => Number(i.montant), formatTotal: formaterMontant },
]

const COLONNES_PDF = [
  { titre: 'N° reçu', valeur: (p) => p.numero },
  { titre: 'Date', valeur: (p) => formaterDate(p.datePaiement) },
  { titre: 'Centre', valeur: (p) => p.centre.nom },
  { titre: 'Mode', valeur: (p) => `${MODES_PAIEMENT[p.mode] || p.mode}${p.reference ? ` ${p.reference}` : ''}` },
  { titre: 'Factures', valeur: (p) => (p.annule ? 'ANNULÉ' : p.imputations.map((i) => i.facture.numero).join(', ') || 'Avance') },
  { titre: 'Montant', valeur: (p) => formaterMontant(p.montant), droite: true, somme: (p) => (p.annule ? 0 : Number(p.montant)), formatTotal: formaterMontant },
  { titre: 'Avance restante', valeur: (p) => formaterMontant(p.montantNonImpute), droite: true, somme: (p) => Number(p.montantNonImpute), formatTotal: formaterMontant },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.case-a-cocher { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; white-space: nowrap; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.avance { color: #b35c00; }
.encart { padding: 0.65rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.9rem; }
.encart-alerte { margin-bottom: 1rem; background: #fdecec; color: #8f1d1d; }
.section { flex: 1; margin: 0.75rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes td { padding: 0.45rem 0.5rem; }
.fiche { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem 1rem; margin-bottom: 1rem; padding: 0.85rem 1rem; border-radius: 10px; background: #f7faf8; }
.fiche div { display: flex; flex-direction: column; gap: 0.1rem; }
.fiche span { font-size: 0.75rem; color: var(--muted); }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
