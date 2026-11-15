<!--
  =============================================================================
  TABLEAU DE BORD (cahier des charges §3.8)
  =============================================================================
  Chiffres clés (stock valorisé, alertes, achats, livraisons, consommations,
  facturé, encaissé, créances, écarts) et graphiques sur la période choisie :
    - consommation validée par mois (1 série, vert) ;
    - facturé et encaissé par mois (2 séries : bleu / orange, légende) ;
    - 10 produits les plus consommés ; 10 centres qui consomment le plus.
  Chaque tuile ouvre l'état détaillé correspondant (@ouvrir(codeEtat)).
  Filtres de la page : période et centre.
  =============================================================================
-->
<template>
  <div :class="{ rechargement: chargement && donnees }">
    <p v-if="chargement && !donnees" class="tableau-vide">Chargement…</p>
    <template v-if="donnees">
      <!-- ========== Chiffres clés ========== -->
      <div class="tuiles">
        <button v-for="t in tuiles" :key="t.libelle" class="tuile" :class="t.ton" @click="emit('ouvrir', t.etat)">
          <span class="tuile-libelle">{{ t.libelle }}</span>
          <strong class="tuile-valeur">{{ t.valeur }}</strong>
          <small class="tuile-detail">{{ t.detail }}</small>
        </button>
      </div>

      <!-- ========== Graphiques ========== -->
      <div class="graphiques">
        <section class="carte">
          <h4>Consommation validée par mois <small>(FCFA)</small></h4>
          <GraphiqueBarres :categories="moisCourts" :series="[{ nom: 'Consommation', couleur: VERT, valeurs: donnees.series.consommation }]" :formater="formaterMontant" />
        </section>
        <section class="carte">
          <h4>Facturé et encaissé par mois <small>(FCFA)</small></h4>
          <GraphiqueBarres
            :categories="moisCourts"
            :series="[
              { nom: 'Facturé', couleur: BLEU, valeurs: donnees.series.facture },
              { nom: 'Encaissé', couleur: ORANGE, valeurs: donnees.series.encaisse },
            ]"
            :formater="formaterMontant"
          />
        </section>
        <section class="carte">
          <h4>Produits les plus consommés <small>(quantité)</small></h4>
          <GraphiqueBarres
            v-if="donnees.topProduits.length"
            horizontal
            :categories="donnees.topProduits.map((p) => p.libelle)"
            :series="[{ nom: 'Quantité consommée', couleur: VERT, valeurs: donnees.topProduits.map((p) => p.quantite) }]"
            :formater="formaterNombre"
          />
          <p v-else class="vide">Aucune consommation validée sur la période.</p>
        </section>
        <section class="carte">
          <h4>Centres qui consomment le plus <small>(FCFA)</small></h4>
          <GraphiqueBarres
            v-if="donnees.topCentres.length"
            horizontal
            :categories="donnees.topCentres.map((c) => c.libelle)"
            :series="[{ nom: 'Consommation', couleur: VERT, valeurs: donnees.topCentres.map((c) => c.montant) }]"
            :formater="formaterMontant"
          />
          <p v-else class="vide">Aucune consommation validée sur la période.</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import GraphiqueBarres from '@/components/GraphiqueBarres.vue'
import { formaterMontant, formaterNombre } from '@/utils/format'
import { chargerEtat } from '@/api/etats'

const props = defineProps({
  filtres: { type: Object, required: true },
})
const emit = defineEmits(['ouvrir'])
const store = useStore()

// Couleurs validées (contraste et daltonisme) — voir GraphiqueBarres.vue
const VERT = '#00a36c'
const BLEU = '#2a78d6'
const ORANGE = '#eb6834'

const donnees = ref(null)
const chargement = ref(false)

async function charger() {
  chargement.value = true
  try {
    donnees.value = await chargerEtat('tableau-de-bord', { du: props.filtres.du, au: props.filtres.au, centreId: props.filtres.centreId })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(() => [props.filtres.du, props.filtres.au, props.filtres.centreId], charger, { immediate: true })

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
/** « 2026-11 » -> « nov. 26 » */
const moisCourts = computed(() => donnees.value.series.mois.map((m) => `${MOIS_COURTS[Number(m.substring(5, 7)) - 1]} ${m.substring(2, 4)}`))

const tuiles = computed(() => {
  const i = donnees.value.indicateurs
  return [
    { libelle: "Valeur du stock (prix d'achat)", valeur: formaterMontant(i.valeurStockAchat), detail: `${formaterMontant(i.valeurStockVente)} au prix de vente · ${i.medicamentsEnStock} médicament(s)`, etat: 'stock' },
    {
      libelle: 'Ruptures et péremptions',
      valeur: `${i.ruptures + i.sousSeuil} produit(s)`,
      detail: `${i.ruptures} rupture(s) · ${i.sousSeuil} sous le seuil · ${i.lotsPerimes} lot(s) périmé(s) · ${i.lotsProches} lot(s) ≤ ${i.delaiPeremption} j`,
      ton: i.ruptures + i.lotsPerimes > 0 ? 'alerte' : '',
      etat: 'alertes',
    },
    { libelle: 'Achats reçus', valeur: formaterMontant(i.achats), detail: 'Réceptions validées sur la période', etat: 'receptions' },
    { libelle: 'Livré aux centres', valeur: formaterMontant(i.livre), detail: 'Livraisons validées sur la période', etat: 'livraisons' },
    { libelle: 'Consommation validée', valeur: formaterMontant(i.consommation), detail: 'Rapports mensuels validés', etat: 'consommations' },
    { libelle: 'Facturé', valeur: formaterMontant(i.facture), detail: 'Factures émises (hors annulées)', etat: 'factures' },
    { libelle: 'Encaissé', valeur: formaterMontant(i.encaisse), detail: 'Paiements et avances reçus', etat: 'encaissements' },
    {
      libelle: 'Créances restantes',
      valeur: formaterMontant(i.creances),
      detail: i.centresEnRetard ? `dont ${formaterMontant(i.creancesEnRetard)} en retard (${i.centresEnRetard} centre(s))` : 'Aucun retard de paiement',
      ton: i.creancesEnRetard > 0 ? 'alerte' : '',
      etat: 'creances',
    },
    { libelle: 'Manquants en supervision', valeur: formaterMontant(i.valeurManquants), detail: 'Écarts négatifs validés sur la période', etat: 'ecarts' },
  ]
})
</script>

<style scoped>
.rechargement { opacity: 0.55; transition: opacity 0.2s; }
.tuiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.tuile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: var(--primary-light);
  text-align: left;
  color: var(--texte-sur-fond);
  transition: transform 0.15s;
}
.tuile:hover { transform: translateY(-2px); }
.tuile-libelle { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
.tuile-valeur { font-size: 1.3rem; color: var(--primary-dark); }
.tuile-detail { font-size: 0.75rem; color: var(--muted); }
/* Tuile d'alerte : fond rosé + valeur rouge (texte, jamais couleur seule) */
.tuile.alerte { background: #fdecec; }
.tuile.alerte .tuile-valeur { color: var(--danger); }
.graphiques { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.carte { padding: 1rem; border: 1px solid var(--border); border-radius: 12px; background: #fff; min-width: 0; }
.carte h4 { margin: 0 0 0.6rem; font-size: 0.95rem; color: var(--texte-sur-fond); }
.carte h4 small { font-weight: 400; color: var(--muted); }
.vide { font-size: 0.85rem; color: var(--muted); }
@media (max-width: 1100px) { .graphiques { grid-template-columns: 1fr; } }
</style>
