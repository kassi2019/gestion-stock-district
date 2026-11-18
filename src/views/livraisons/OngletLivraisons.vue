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
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Anciens bons de livraison" :sous-titre="sousTitreExport" nom-fichier="bons_de_livraison" :colonnes-pdf="COLONNES_EXPORT" :lignes="livraisonsAffichees" />
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
        <span class="espace"></span>
        <ImportExportTableau
          :titre="`Bon de livraison ${detail.numero}`"
          :sous-titre="`${detail.centre.nom} — ${formaterDate(detail.dateLivraison)}`"
          :nom-fichier="`bon_livraison_${detail.numero}`"
          :colonnes-pdf="COLONNES_DETAIL"
          :lignes="detail.lignes"
        />
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
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Pagination from '@/components/Pagination.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
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

// ---------------------------------------------------------------------------
// EXPORT PDF / EXCEL : liste des bons (filtres appliqués) et détail d'un bon
// ---------------------------------------------------------------------------
const sousTitreExport = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    filtres.du || filtres.au ? `Du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ]
    .filter(Boolean)
    .join(' — ')
})
const COLONNES_EXPORT = [
  { titre: 'N° livraison', valeur: (l) => l.numero },
  { titre: 'Date', valeur: (l) => formaterDate(l.dateLivraison) },
  { titre: 'Centre', valeur: (l) => l.centre?.nom || '' },
  { titre: 'Lignes', valeur: (l) => l._count?.lignes ?? 0, droite: true },
  { titre: 'Montant', valeur: (l) => formaterMontant(l.montantTotal), droite: true, somme: (l) => Number(l.montantTotal), formatTotal: formaterMontant },
  { titre: 'Statut', valeur: (l) => STATUTS_LIVRAISON[l.statut]?.libelle || l.statut },
]
const COLONNES_DETAIL = [
  { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` },
  { titre: 'Lot', valeur: (l) => l.lot?.numeroLot || '—' },
  { titre: 'Péremption', valeur: (l) => (l.lot?.datePeremption ? formaterDate(l.lot.datePeremption) : '—') },
  { titre: 'Quantité livrée', valeur: (l) => formaterNombre(l.quantiteLivree), droite: true },
  { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true },
  { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, somme: (l) => Number(l.montant), formatTotal: formaterMontant },
]

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
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut .espace { flex: 1; }
.bandeau-statut small { color: var(--muted); }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
