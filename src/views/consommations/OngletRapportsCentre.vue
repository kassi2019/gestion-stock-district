<!--
  =============================================================================
  ONGLET « RAPPORTS CENTRE » (spec nov. 2026, §5)
  =============================================================================
  Liste des rapports centre (un par centre et par mois), avec filtres.
  « Ouvrir un rapport » : choisir le centre et le mois -> le rapport s'ouvre
  (il est créé en brouillon s'il n'existe pas encore, pré-rempli).
  Le détail se fait dans FenetreRapportCentre.vue.

  Propriété : aOuvrir ({ id } ou { centreId, annee, mois }) — depuis le suivi
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre petit">
        <ListeDeroulante v-model="filtres.mois" :options="OPTIONS_MOIS" placeholder="Tous les mois" />
      </div>
      <input v-model.number="filtres.annee" type="number" min="2020" max="2100" class="champ-annee" title="Année" />
      <div class="filtre petit">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts" placeholder="Tous les statuts" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Rapports centre de santé" :sous-titre="sousTitreExport" nom-fichier="rapports_centre" :colonnes-pdf="COLONNES_EXPORT" :lignes="rapportsAffiches" />
      <button v-si-modif @click="choix = { centreId: null, annee: anneeCourante, mois: moisPrecedent }">+ Ouvrir un rapport</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <th>N°</th>
            <th>Centre</th>
            <th>Mois</th>
            <th class="nombre">Produits</th>
            <th>Facture générée</th>
            <th>Statut</th>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rapportsAffiches" :key="r.id">
            <td class="code">{{ r.numero }}</td>
            <td><strong>{{ r.centre.nom }}</strong></td>
            <td>{{ libellePeriode(r.annee, r.mois) }}</td>
            <td class="nombre">{{ r._count.lignes }}</td>
            <td>
              <span v-if="r.facture" class="code">{{ r.facture.numero }}</span>
              <span v-else class="detail">{{ r.statut === 'VALIDE' ? 'Aucune (rien à livrer)' : '—' }}</span>
            </td>
            <td><span class="badge" :class="STATUTS_RAPPORT_CENTRE[r.statut]?.badge">{{ STATUTS_RAPPORT_CENTRE[r.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="rapportOuvert = r.id">{{ r.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!chargement && rapportsAffiches.length === 0" class="tableau-vide">Aucun rapport centre.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- Choix du centre et du mois -->
    <FenetreModale v-if="choix" titre="Ouvrir le rapport d'un centre" @fermer="choix = null">
      <form id="form-choix-rapport" class="grille-formulaire" @submit.prevent="ouvrirChoix">
        <div class="pleine-largeur">
          <label class="obligatoire">Centre de santé</label>
          <ListeDeroulante v-model="choix.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" />
        </div>
        <div>
          <label class="obligatoire">Mois</label>
          <ListeDeroulante v-model="choix.mois" :options="OPTIONS_MOIS" :effacable="false" />
        </div>
        <div>
          <label class="obligatoire">Année</label>
          <input v-model.number="choix.annee" type="number" min="2020" max="2100" required />
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" type="button" @click="choix = null">Annuler</button>
        <button type="submit" form="form-choix-rapport" :disabled="enCours">Ouvrir</button>
      </template>
    </FenetreModale>

    <!-- Détail du rapport -->
    <FenetreRapportCentre v-if="rapportOuvert" :rapport-id="rapportOuvert" @fermer="rapportOuvert = null" @modifie="charger" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import FenetreRapportCentre from './FenetreRapportCentre.vue'
import { listerRapportsCentre, ouvrirRapportCentre } from '@/api/consommations'
import { libellePeriode, OPTIONS_MOIS, STATUTS_RAPPORT_CENTRE } from './consommationsCommun'

const props = defineProps({
  /** Rapport à ouvrir (depuis le tableau de suivi) : { id } ou { centreId, annee, mois } */
  aOuvrir: { type: Object, default: null },
})
const store = useStore()

const maintenant = new Date()
const anneeCourante = maintenant.getFullYear()
/** Par défaut, on ouvre le rapport du mois écoulé (le mois en cours n'est pas terminé). */
const moisPrecedent = maintenant.getMonth() === 0 ? 12 : maintenant.getMonth()

const rapports = ref([])
const chargement = ref(false)
const enCours = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, annee: anneeCourante, mois: null, statut: null })
const choix = ref(null) // { centreId, annee, mois } : fenêtre « Ouvrir un rapport »
const rapportOuvert = ref(null) // id du rapport affiché

const optionsStatuts = Object.entries(STATUTS_RAPPORT_CENTRE).map(([id, s]) => ({ id, libelle: s.libelle }))
const centres = computed(() => store.state.referentiel.centres)
const centresActifs = computed(() => centres.value.filter((c) => c.actif))

const rapportsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return rapports.value
  return rapports.value.filter((r) => [r.numero, r.centre.nom].some((v) => (v || '').toLowerCase().includes(texte)))
})

// ---------------------------------------------------------------------------
// EXPORT PDF / EXCEL : les lignes affichées (filtres et recherche appliqués)
// ---------------------------------------------------------------------------
const sousTitreExport = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  const m = OPTIONS_MOIS.find((x) => x.id === filtres.mois)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    m ? `${m.libelle} ${filtres.annee || ''}` : `Année ${filtres.annee || 'toutes'}`,
    filtres.statut ? STATUTS_RAPPORT_CENTRE[filtres.statut]?.libelle : '',
  ]
    .filter(Boolean)
    .join(' — ')
})

const COLONNES_EXPORT = [
  { titre: 'N°', valeur: (r) => r.numero },
  { titre: 'Centre', valeur: (r) => r.centre.nom },
  { titre: 'Mois', valeur: (r) => libellePeriode(r.annee, r.mois) },
  { titre: 'Produits', valeur: (r) => r._count.lignes, droite: true },
  { titre: 'Facture générée', valeur: (r) => r.facture?.numero || '—' },
  { titre: 'Statut', valeur: (r) => STATUTS_RAPPORT_CENTRE[r.statut]?.libelle || r.statut },
]

async function charger() {
  chargement.value = true
  try {
    rapports.value = await listerRapportsCentre(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

/** Ouvre (ou crée) le rapport du centre et du mois choisis. */
async function ouvrirPour(centreId, annee, mois) {
  enCours.value = true
  try {
    const r = await ouvrirRapportCentre(centreId, annee, mois)
    choix.value = null
    rapportOuvert.value = r.id
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enCours.value = false
  }
}

function ouvrirChoix() {
  const c = choix.value
  if (!c.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  ouvrirPour(c.centreId, Number(c.annee), Number(c.mois))
}

// Rapport demandé depuis le tableau de suivi
watch(
  () => props.aOuvrir,
  (r) => {
    if (!r) return
    if (r.id) rapportOuvert.value = r.id
    else ouvrirPour(r.centreId, r.annee, r.mois)
  },
  { immediate: true },
)

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.detail { font-size: 0.8rem; color: var(--muted); }
.champ-annee { width: 90px; }
</style>
