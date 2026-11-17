<!--
  =============================================================================
  ONGLET « ANCIENS BONS DE LIVRAISON » — LECTURE SEULE (spec nov. 2026)
  =============================================================================
  Les sorties du district vers les centres se font maintenant par FACTURE
  (module Facturation : générée par le rapport centre, ou manuelle).
  Les anciens bons de livraison (BL-...) restent consultables : liste filtrée,
  détail par lot, bon de livraison en PDF, pièces jointes.
  =============================================================================
-->
<template>
  <div>
    <div class="encart-info">
      Historique seulement : les nouvelles livraisons aux centres se font par <strong>facture</strong> (module Facturation).
    </div>

    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_LIVRAISON)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <th>N° livraison</th>
            <th>Date</th>
            <th>Centre</th>
            <th class="nombre">Lignes</th>
            <th class="nombre">Montant</th>
            <th>Statut</th>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lignesPage" :key="l.id">
            <td class="code">{{ l.numero }}</td>
            <td>{{ formaterDate(l.dateLivraison) }}</td>
            <td><strong>{{ l.centre.nom }}</strong></td>
            <td class="nombre">{{ l._count.lignes }}</td>
            <td class="nombre">{{ formaterMontant(l.montantTotal) }}</td>
            <td><span class="badge" :class="STATUTS_LIVRAISON[l.statut]?.badge">{{ STATUTS_LIVRAISON[l.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(l)">Voir</button>
              <button v-si-imprimer class="bouton-lien" @click="imprimer(l)">Bon PDF</button>
              <button class="bouton-lien" @click="docPieces = l">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="livraisonsAffichees.length" />
      <p v-if="!chargement && livraisonsAffichees.length === 0" class="tableau-vide">Aucun bon de livraison.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- Détail d'un bon -->
    <FenetreModale v-if="detail" :titre="`Bon de livraison ${detail.numero} — ${detail.centre.nom}`" tres-large @fermer="detail = null">
      <div class="bandeau-statut">
        <span class="badge" :class="STATUTS_LIVRAISON[detail.statut]?.badge">{{ STATUTS_LIVRAISON[detail.statut]?.libelle }}</span>
        <small>Du {{ formaterDate(detail.dateLivraison) }}<template v-if="detail.validateur"> — validé par {{ nomPersonne(detail.validateur) }}</template></small>
      </div>
      <table class="tableau lignes">
        <thead>
          <tr><th>Médicament</th><th>Lot</th><th>Péremption</th><th class="nombre">Quantité livrée</th><th class="nombre">Prix unitaire</th><th class="nombre">Montant</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in detail.lignes" :key="l.id">
            <td>{{ l.medicament.code }} — {{ l.medicament.designation }}</td>
            <td>{{ l.lot?.numeroLot || '—' }}</td>
            <td>{{ l.lot?.datePeremption ? formaterDate(l.lot.datePeremption) : '—' }}</td>
            <td class="nombre">{{ formaterNombre(l.quantiteLivree) }}</td>
            <td class="nombre">{{ formaterMontant(l.prixUnitaire) }}</td>
            <td class="nombre">{{ formaterMontant(l.montant) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="5" class="nombre"><strong>MONTANT TOTAL</strong></td><td class="nombre"><strong>{{ formaterMontant(detail.montantTotal) }}</strong></td></tr>
        </tfoot>
      </table>
      <p v-if="detail.observations" class="aide">{{ detail.observations }}</p>
      <template #pied>
        <button class="bouton-secondaire" @click="detail = null">Fermer</button>
        <button v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer(detail)">Bon de livraison PDF</button>
      </template>
    </FenetreModale>

    <PiecesJointes
      v-if="docPieces"
      module="livraisons"
      type="Livraison"
      :id="docPieces.id"
      :titre="`Pièces du bon ${docPieces.numero}`"
      @fermer="docPieces = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Pagination from '@/components/Pagination.vue'
import PiecesJointes from '@/components/PiecesJointes.vue'
import { utiliserTableau } from '@/utils/pagination'
import { nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { listerLivraisons, trouverLivraison } from '@/api/livraisons'
import { bonDeLivraisonPdf, optionsStatuts, STATUTS_LIVRAISON } from './livraisonsCommun'

const store = useStore()
const livraisons = ref([])
const chargement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, statut: null, du: '', au: '' })
const detail = ref(null)
const docPieces = ref(null)

const centres = computed(() => store.state.referentiel.centres)

const livraisonsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return livraisons.value
  return livraisons.value.filter((l) => [l.numero, l.centre.nom].some((v) => (v || '').toLowerCase().includes(texte)))
})
const { page, taille, lignesPage } = utiliserTableau(livraisonsAffichees, [recherche], {})

async function charger() {
  chargement.value = true
  try {
    livraisons.value = await listerLivraisons(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

async function ouvrir(l) {
  try {
    detail.value = await trouverLivraison(l.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function imprimer(l) {
  try {
    await bonDeLivraisonPdf(await trouverLivraison(l.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.encart-info { margin-bottom: 1rem; padding: 0.6rem 0.9rem; border-radius: 8px; background: #e3eefc; color: #1d4f91; font-size: 0.88rem; }
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
