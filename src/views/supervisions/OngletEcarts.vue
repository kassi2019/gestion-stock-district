<!--
  =============================================================================
  ONGLET « HISTORIQUE DES ÉCARTS »
  =============================================================================
  Tous les écarts constatés lors des supervisions VALIDÉES ou CLÔTURÉES, par
  centre, médicament et période, avec la décision prise (cahier des charges
  §3.7 « conservation de l'historique des contrôles et des décisions » et
  §3.8 « écarts relevés lors des inventaires et supervisions »).
  Événement : @ouvrir(supervisionId)
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (médicament, n°)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="periode">
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="sens" :options="SENS" placeholder="Manquants et excédents" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Écarts constatés en supervision" :sous-titre="sousTitrePdf" nom-fichier="ecarts_supervision" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
    </div>

    <div class="totaux">
      <div class="total-case rouge"><span>Valeur des manquants</span><strong>{{ formaterMontant(totaux.manquants) }}</strong></div>
      <div class="total-case orange"><span>Valeur des excédents</span><strong>{{ formaterMontant(totaux.excedents) }}</strong></div>
      <div class="total-case"><span>Lignes en écart</span><strong>{{ ecartsAffiches.length }}</strong></div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="supervision">Supervision</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="medicament">Médicament</ColonneTri>
            <ColonneTri v-model="tri" cle="theorique" class="nombre">Théorique</ColonneTri>
            <ColonneTri v-model="tri" cle="physique" class="nombre">Physique</ColonneTri>
            <ColonneTri v-model="tri" cle="ecart" class="nombre">Écart</ColonneTri>
            <ColonneTri v-model="tri" cle="valeur" class="nombre">Valeur</ColonneTri>
            <ColonneTri v-model="tri" cle="decision">Décision</ColonneTri>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in lignesPage" :key="e.id">
            <td>{{ formaterDate(e.supervision.dateSupervision) }}</td>
            <td><button class="bouton-lien code" @click="emit('ouvrir', e.supervision.id)">{{ e.supervision.numero }}</button></td>
            <td>{{ e.supervision.centre.nom }}</td>
            <td>
              {{ e.medicament.code }} — {{ e.medicament.designation }}
              <small v-if="e.lot || e.commentaire" class="detail">{{ [e.lot ? `lot ${e.lot.numeroLot}` : '', e.commentaire].filter(Boolean).join(' · ') }}</small>
            </td>
            <td class="nombre">{{ formaterNombre(e.stockTheorique) }}</td>
            <td class="nombre">{{ formaterNombre(e.stockPhysique) }}</td>
            <td class="nombre" :class="e.ecart < 0 ? 'ecart-negatif' : 'ecart-positif'">{{ texteEcart(e.ecart) }}</td>
            <td class="nombre">{{ e.valeurEcart === null ? '—' : formaterMontant(e.valeurEcart) }}</td>
            <td>{{ e.supervision.decision ? DECISIONS[e.supervision.decision]?.libelle : 'À décider' }}</td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="ecartsAffiches.length" />
      <p v-if="!chargement && ecartsAffiches.length === 0" class="tableau-vide">Aucun écart constaté.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { listerEcarts } from '@/api/supervisions'
import { DECISIONS, texteEcart } from './supervisionsCommun'

const emit = defineEmits(['ouvrir'])
const store = useStore()
const SENS = [
  { id: 'MANQUANTS', libelle: 'Manquants seulement' },
  { id: 'EXCEDENTS', libelle: 'Excédents seulement' },
]

const ecarts = ref([])
const chargement = ref(false)
const recherche = ref('')
const sens = ref(null)
const filtres = reactive({ centreId: null, du: '', au: '' })
const centres = computed(() => store.state.referentiel.centres)

const ecartsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return ecarts.value.filter(
    (e) =>
      (!sens.value || (sens.value === 'MANQUANTS' ? e.ecart < 0 : e.ecart > 0)) &&
      (!texte || [e.medicament.designation, e.medicament.code, e.supervision.numero].some((v) => (v || '').toLowerCase().includes(texte))),
  )
})
const totaux = computed(() => ({
  manquants: -ecartsAffiches.value.filter((e) => e.ecart < 0).reduce((t, e) => t + Number(e.valeurEcart ?? 0), 0),
  excedents: ecartsAffiches.value.filter((e) => e.ecart > 0).reduce((t, e) => t + Number(e.valeurEcart ?? 0), 0),
}))

async function charger() {
  chargement.value = true
  try {
    ecarts.value = await listerEcarts(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

const VALEURS_TRI = {
  date: (e) => e.supervision.dateSupervision,
  supervision: (e) => e.supervision.numero,
  centre: (e) => e.supervision.centre.nom,
  medicament: (e) => e.medicament.designation,
  theorique: (e) => e.stockTheorique,
  physique: (e) => e.stockPhysique,
  ecart: (e) => e.ecart,
  valeur: (e) => Number(e.valeurEcart ?? 0),
  decision: (e) => (e.supervision.decision ? DECISIONS[e.supervision.decision]?.libelle : ''),
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(ecartsAffiches, [recherche, sens], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [c ? `Centre : ${c.nom}` : 'Tous les centres', sens.value ? SENS.find((s) => s.id === sens.value).libelle : ''].filter(Boolean).join(' — ')
})
const COLONNES_PDF = [
  { titre: 'Date', valeur: (e) => formaterDate(e.supervision.dateSupervision) },
  { titre: 'Supervision', valeur: (e) => e.supervision.numero },
  { titre: 'Centre', valeur: (e) => e.supervision.centre.nom },
  { titre: 'Médicament', valeur: (e) => e.medicament.designation },
  { titre: 'Théorique', valeur: (e) => formaterNombre(e.stockTheorique), droite: true },
  { titre: 'Physique', valeur: (e) => formaterNombre(e.stockPhysique), droite: true },
  { titre: 'Écart', valeur: (e) => texteEcart(e.ecart), droite: true },
  { titre: 'Valeur', valeur: (e) => formaterMontant(e.valeurEcart ?? 0), droite: true, somme: (e) => Number(e.valeurEcart ?? 0), formatTotal: formaterMontant },
  { titre: 'Décision', valeur: (e) => (e.supervision.decision ? DECISIONS[e.supervision.decision]?.libelle : 'À décider') },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.totaux { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin: 0.5rem 0 1rem; }
.total-case { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1rem; border-radius: 12px; background: var(--primary-light); }
.total-case span { font-size: 0.8rem; color: var(--muted); }
.total-case strong { font-size: 1.1rem; color: var(--primary-dark); }
.total-case.rouge { background: #fdecec; }
.total-case.rouge strong { color: var(--danger); }
.total-case.orange { background: #fff4e5; }
.total-case.orange strong { color: #b35c00; }
.ecart-negatif { color: var(--danger); font-weight: 700; }
.ecart-positif { color: #b35c00; font-weight: 700; }
</style>
