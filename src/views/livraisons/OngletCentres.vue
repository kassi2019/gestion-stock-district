<!--
  =============================================================================
  ONGLET « SUIVI DES CENTRES »
  =============================================================================
  Fiche d'un centre de santé (cahier des charges §3.4) :
    - STOCK THÉORIQUE du centre (alimenté par les livraisons validées) ;
    - HISTORIQUE des livraisons reçues ;
    - MOUVEMENTS du stock du centre.
  Impression : état du stock théorique en PDF.
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <div class="choix-centre">
        <ListeDeroulante v-model="centreId" :options="centres" champ-libelle="nom" placeholder="— Choisir un centre de santé —" />
      </div>
      <span class="espace"></span>
      <button v-if="fiche" v-si-imprimer class="bouton-secondaire" @click="stockCentrePdf(fiche)">Stock du centre (PDF)</button>
    </div>

    <p v-if="!centreId" class="tableau-vide">Choisissez un centre pour afficher son stock théorique et l'historique de ses livraisons.</p>
    <p v-else-if="chargement" class="tableau-vide">Chargement…</p>

    <template v-else-if="fiche">
      <!-- Identité et chiffres clés -->
      <div class="resume">
        <div class="carte identite">
          <strong>{{ fiche.centre.nom }}</strong>
          <small>{{ [fiche.centre.type?.libelle, fiche.centre.localite].filter(Boolean).join(' — ') }}</small>
          <small v-if="fiche.centre.responsable">Responsable : {{ fiche.centre.responsable }}{{ fiche.centre.telephone ? ` (${fiche.centre.telephone})` : '' }}</small>
        </div>
        <div class="carte"><span>{{ fiche.stock.filter((s) => s.quantiteTheorique > 0).length }}</span><small>médicament(s) en stock</small></div>
        <div class="carte"><span>{{ livraisonsValidees.length }}</span><small>livraison(s) reçue(s)</small></div>
        <div class="carte"><span>{{ formaterMontant(montantLivre) }}</span><small>montant total livré</small></div>
        <div class="carte"><span>{{ derniereLivraison ? formaterDate(derniereLivraison.dateLivraison) : '—' }}</span><small>dernière livraison</small></div>
      </div>

      <nav class="sous-onglets">
        <button :class="{ actif: vue === 'stock' }" @click="vue = 'stock'">Stock théorique ({{ fiche.stock.length }})</button>
        <button :class="{ actif: vue === 'livraisons' }" @click="vue = 'livraisons'">Livraisons ({{ fiche.livraisons.length }})</button>
        <button :class="{ actif: vue === 'mouvements' }" @click="vue = 'mouvements'">Mouvements ({{ fiche.mouvements.length }})</button>
      </nav>

      <!-- Stock théorique -->
      <div v-if="vue === 'stock'" class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr><th>Code</th><th>Médicament</th><th>Unité</th><th class="nombre">Stock théorique</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in pageStock.lignesPage.value" :key="s.id">
              <td class="code">{{ s.medicament.code }}</td>
              <td>{{ s.medicament.designation }}</td>
              <td>{{ s.medicament.uniteVente?.libelle || '' }}</td>
              <td class="nombre"><strong>{{ formaterNombre(s.quantiteTheorique) }}</strong></td>
            </tr>
          </tbody>
        </table>
        <Pagination v-model:page="pageStock.page.value" v-model:taille="pageStock.taille.value" :total="fiche.stock.length" />
        <p v-if="fiche.stock.length === 0" class="tableau-vide">Aucun médicament livré à ce centre.</p>
      </div>

      <!-- Livraisons -->
      <div v-else-if="vue === 'livraisons'" class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr><th>N° livraison</th><th>Date</th><th>Commande</th><th class="nombre">Lignes</th><th class="nombre">Montant</th><th>Statut</th><th class="actions">Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in pageLivraisons.lignesPage.value" :key="l.id">
              <td class="code">{{ l.numero }}</td>
              <td>{{ formaterDate(l.dateLivraison) }}</td>
              <td>{{ l.commande?.numero || 'Directe' }}</td>
              <td class="nombre">{{ l._count?.lignes ?? 0 }}</td>
              <td class="nombre">{{ formaterMontant(l.montantTotal) }}</td>
              <td><span class="badge" :class="STATUTS_LIVRAISON[l.statut]?.badge">{{ STATUTS_LIVRAISON[l.statut]?.libelle }}</span></td>
              <td class="actions">
                <button v-if="l.statut !== 'ANNULEE'" v-si-imprimer class="bouton-lien" @click="imprimer(l)">Bon PDF</button>
              </td>
            </tr>
          </tbody>
        </table>
        <Pagination v-model:page="pageLivraisons.page.value" v-model:taille="pageLivraisons.taille.value" :total="fiche.livraisons.length" />
        <p v-if="fiche.livraisons.length === 0" class="tableau-vide">Aucune livraison pour ce centre.</p>
      </div>

      <!-- Mouvements -->
      <div v-else class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Médicament</th><th class="nombre">Quantité</th><th class="nombre">Avant</th><th class="nombre">Après</th><th>Motif</th><th>Par</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in pageMouvements.lignesPage.value" :key="m.id">
              <td>{{ formaterDate(m.dateMouvement) }}</td>
              <td><span class="badge" :class="m.quantite >= 0 ? 'badge-vert' : 'badge-orange'">{{ TYPES_MOUVEMENT_CENTRE[m.type] || m.type }}</span></td>
              <td>{{ m.medicament.code }} — {{ m.medicament.designation }}</td>
              <td class="nombre" :class="m.quantite >= 0 ? 'entree' : 'sortie'">{{ m.quantite > 0 ? '+' : '' }}{{ formaterNombre(m.quantite) }}</td>
              <td class="nombre">{{ formaterNombre(m.stockAvant) }}</td>
              <td class="nombre"><strong>{{ formaterNombre(m.stockApres) }}</strong></td>
              <td>{{ m.motif || '' }}</td>
              <td>{{ `${m.utilisateur?.prenoms || ''} ${m.utilisateur?.nom || ''}`.trim() }}</td>
            </tr>
          </tbody>
        </table>
        <Pagination v-model:page="pageMouvements.page.value" v-model:taille="pageMouvements.taille.value" :total="fiche.mouvements.length" />
        <p v-if="fiche.mouvements.length === 0" class="tableau-vide">Aucun mouvement.</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Pagination from '@/components/Pagination.vue'
import { utiliserPagination } from '@/utils/pagination'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { ficheCentre, trouverLivraison } from '@/api/livraisons'
import { bonDeLivraisonPdf, stockCentrePdf, STATUTS_LIVRAISON } from './livraisonsCommun'

/** Libellés des mouvements du stock d'un centre */
const TYPES_MOUVEMENT_CENTRE = {
  LIVRAISON: 'Livraison reçue',
  CONSOMMATION: 'Consommation',
  ECART_SUPERVISION: 'Écart de supervision',
  REGULARISATION: 'Régularisation',
}

const store = useStore()
const centres = computed(() => store.state.referentiel.centres)
const centreId = ref(null)
const fiche = ref(null)
const chargement = ref(false)
const vue = ref('stock')

const stock = computed(() => fiche.value?.stock || [])
const livraisons = computed(() => fiche.value?.livraisons || [])
const mouvements = computed(() => fiche.value?.mouvements || [])
const pageStock = utiliserPagination(stock, [centreId])
const pageLivraisons = utiliserPagination(livraisons, [centreId])
const pageMouvements = utiliserPagination(mouvements, [centreId])

const livraisonsValidees = computed(() => livraisons.value.filter((l) => l.statut === 'VALIDEE'))
const montantLivre = computed(() => livraisonsValidees.value.reduce((t, l) => t + Number(l.montantTotal), 0))
const derniereLivraison = computed(() => livraisonsValidees.value[0] || null) // liste triée par date décroissante

async function charger() {
  fiche.value = null
  if (!centreId.value) return
  chargement.value = true
  try {
    fiche.value = await ficheCentre(centreId.value)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(centreId, charger)

async function imprimer(livraison) {
  try {
    bonDeLivraisonPdf(await trouverLivraison(livraison.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
})
</script>

<style scoped>
.choix-centre { min-width: 320px; }
.resume { display: grid; grid-template-columns: 2fr repeat(4, 1fr); gap: 0.75rem; margin: 0.5rem 0 1rem; }
.carte { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.85rem 1rem; border-radius: 12px; background: var(--primary-light); }
.carte span { font-size: 1.25rem; font-weight: 800; color: var(--primary-dark); }
.carte small { color: var(--muted); font-size: 0.8rem; }
.carte.identite { background: #fff; border: 1px solid var(--border); }
.carte.identite strong { font-size: 1.05rem; color: var(--primary-dark); }
.sous-onglets { display: flex; gap: 0.4rem; margin-bottom: 0.75rem; }
.sous-onglets button { padding: 0.45rem 0.9rem; border-radius: 999px; background: #f2f4f5; color: var(--texte-sur-fond); font-weight: 600; font-size: 0.85rem; }
.sous-onglets button.actif { background: var(--primary); color: #fff; }
.entree { color: var(--primary-dark); font-weight: 700; }
.sortie { color: var(--danger); font-weight: 700; }
@media (max-width: 1000px) { .resume { grid-template-columns: 1fr 1fr; } }
</style>
