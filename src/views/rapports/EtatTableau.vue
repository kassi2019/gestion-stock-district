<!--
  =============================================================================
  ÉCRAN D'UN ÉTAT (le même pour tous les états de etatsConfig.js)
  =============================================================================
  - Charge les données de l'état avec les filtres de la page (période,
    centre, fournisseur, médicament) ;
  - Vues : « Détail », « Par centre », « Par médicament »... (selon l'état) ;
  - Tableau triable (clic sur un titre de colonne), recherche, pagination,
    ligne TOTAL ;
  - Export PDF (paysage si nombreuses colonnes) et Excel (.xlsx), dans l'ordre
    trié et avec le filtre de recherche appliqué.
  Propriétés : etat (définition), filtres (de la page), sousTitre (texte des filtres)
  =============================================================================
-->
<template>
  <div>
    <div class="entete-etat">
      <div>
        <h3>{{ etat.titre }}</h3>
        <p>{{ etat.description }}</p>
      </div>
      <div class="exports">
        <button v-si-imprimer class="bouton-secondaire" :disabled="exportEnCours || !lignesTriees.length" @click="exporter('pdf')">PDF</button>
        <button v-si-imprimer class="bouton-secondaire" :disabled="exportEnCours || !lignesTriees.length" @click="exporter('excel')">Excel</button>
      </div>
    </div>

    <div class="barre-outils">
      <nav v-if="etat.vues.length > 1" class="vues">
        <button v-for="v in etat.vues" :key="v.code" :class="{ actif: vue.code === v.code }" @click="codeVue = v.code">{{ v.libelle }}</button>
      </nav>
      <span class="espace"></span>
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher dans le tableau…" />
    </div>

    <div class="tableau-conteneur" :class="{ rechargement: chargement && donnees }">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-for="(c, i) in vue.colonnes" :key="vue.code + i" v-model="tri" :cle="String(i)" :class="{ nombre: c.droite }">{{ c.titre }}</ColonneTri>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(l, n) in lignesPage" :key="n">
            <td v-for="(c, i) in vue.colonnes" :key="i" :class="{ nombre: c.droite }">{{ c.valeur(l) }}</td>
          </tr>
        </tbody>
        <tfoot v-if="totaux && lignesTriees.length">
          <tr>
            <td v-for="(c, i) in vue.colonnes" :key="i" :class="{ nombre: c.droite }">
              <strong v-if="i === 0 && !c.somme">TOTAL</strong>
              <strong v-else-if="c.somme">{{ (c.formatTotal || formaterNombre)(totaux[i]) }}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="lignesFiltrees.length" />
      <p v-if="!chargement && lignesFiltrees.length === 0" class="tableau-vide">Aucune donnée pour ces filtres.</p>
      <p v-if="chargement && !donnees" class="tableau-vide">Chargement…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import ColonneTri from '@/components/ColonneTri.vue'
import Pagination from '@/components/Pagination.vue'
import { utiliserTableau } from '@/utils/pagination'
import { exporterPdf } from '@/utils/exportPdf'
import { exporterExcel } from '@/utils/exportExcel'
import { formaterNombre } from '@/utils/format'
import { chargerEtat } from '@/api/etats'

const props = defineProps({
  etat: { type: Object, required: true },
  filtres: { type: Object, required: true },
  sousTitre: { type: String, default: '' },
})
const store = useStore()

const donnees = ref(null)
const chargement = ref(false)
const exportEnCours = ref(false)
const recherche = ref('')
const codeVue = ref(props.etat.vues[0].code)
const vue = computed(() => props.etat.vues.find((v) => v.code === codeVue.value) || props.etat.vues[0])

// Changement d'état : première vue
watch(
  () => props.etat.code,
  () => {
    codeVue.value = props.etat.vues[0].code
    recherche.value = ''
  },
)

/** Seuls les filtres utilisés par cet état sont envoyés. */
const filtresEnvoyes = computed(() => {
  const f = props.filtres
  const utilises = props.etat.filtres
  return {
    ...(utilises.includes('periode') ? { du: f.du, au: f.au } : {}),
    ...(utilises.includes('centre') ? { centreId: f.centreId } : {}),
    ...(utilises.includes('fournisseur') ? { fournisseurId: f.fournisseurId } : {}),
    ...(utilises.includes('medicament') ? { medicamentId: f.medicamentId } : {}),
  }
})

async function charger() {
  chargement.value = true
  try {
    donnees.value = await chargerEtat(props.etat.source, filtresEnvoyes.value)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
// Rechargement quand l'état ou ses filtres changent (le tableau précédent reste affiché, estompé)
watch(() => [props.etat.source, JSON.stringify(filtresEnvoyes.value)], charger, { immediate: true })

const lignes = computed(() => (donnees.value ? vue.value.lignes(donnees.value) : []))
const lignesFiltrees = computed(() => {
  const texte = recherche.value.trim().toLowerCase()
  if (!texte) return lignes.value
  return lignes.value.filter((l) => vue.value.colonnes.some((c) => String(c.valeur(l) ?? '').toLowerCase().includes(texte)))
})

// Tri : par la valeur numérique si elle existe, sinon par le texte affiché
const VALEURS_TRI = new Proxy(
  {},
  {
    get: (_, cle) => {
      const c = vue.value.colonnes[Number(cle)]
      return c ? (l) => (c.nombre ? c.nombre(l) : c.valeur(l)) : undefined
    },
  },
)
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(lignesFiltrees, [recherche, codeVue], VALEURS_TRI)

const totaux = computed(() => {
  if (!vue.value.colonnes.some((c) => c.somme)) return null
  return vue.value.colonnes.map((c) => (c.somme ? lignesFiltrees.value.reduce((t, l) => t + (Number(c.somme(l)) || 0), 0) : null))
})

async function exporter(format) {
  exportEnCours.value = true
  const titre = `${props.etat.titre}${props.etat.vues.length > 1 ? ` — ${vue.value.libelle}` : ''}`
  const nomFichier = `${props.etat.code}_${vue.value.code}`
  try {
    if (format === 'pdf') {
      await exporterPdf({ titre, sousTitre: props.sousTitre, colonnes: vue.value.colonnes, lignes: lignesTriees.value, nomFichier })
    } else {
      await exporterExcel({ titre, sousTitre: props.sousTitre, colonnes: vue.value.colonnes, lignes: lignesTriees.value, nomFichier })
    }
  } catch (erreur) {
    console.error(erreur)
    store.dispatch('notifications/erreur', `Impossible de créer le fichier ${format === 'pdf' ? 'PDF' : 'Excel'}.`)
  } finally {
    exportEnCours.value = false
  }
}
</script>

<style scoped>
.entete-etat { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
.entete-etat h3 { margin: 0; font-size: 1.1rem; color: var(--primary-dark); }
.entete-etat p { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--muted); }
.exports { display: flex; gap: 0.5rem; }
.vues { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.vues button { padding: 0.4rem 0.85rem; border-radius: 999px; background: #f2f4f5; color: var(--texte-sur-fond); font-weight: 600; font-size: 0.82rem; }
.vues button.actif { background: var(--primary); color: #fff; }
.tableau-conteneur.rechargement { opacity: 0.55; transition: opacity 0.2s; }
tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; background: #f7faf8; }
</style>
