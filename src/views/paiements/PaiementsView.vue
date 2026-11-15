<!--
  =============================================================================
  MODULE 07b — PAIEMENTS ET COMPTES DES CENTRES (page avec onglets)
  =============================================================================
  Cahier des charges §3.6 :
    - PAIEMENTS ET AVANCES : encaissements totaux ou partiels (date, mode,
      référence), avances et leur imputation, reçus PDF  -> OngletPaiements.vue
    - COMPTES DES CENTRES : facturé, payé, solde restant dû, retards,
      relevé de compte PDF                                -> OngletComptes.vue
  Adresse /paiements?centre=ID&facture=ID : ouvre directement un nouveau
  paiement pour cette facture (bouton « Enregistrer un paiement » de Facturation).
  Droits : module « paiements » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-module">
    <EnteteModule
      icone="portefeuille"
      titre="Paiements et comptes des centres"
      description="Encaissements, avances, reçus et relevés de compte des centres de santé."
    />

    <nav class="onglets">
      <button
        v-for="onglet in ONGLETS"
        :key="onglet.code"
        class="onglet"
        :class="{ actif: ongletActif === onglet.code }"
        @click="ongletActif = onglet.code"
      >
        <Icone :nom="onglet.icone" :taille="18" />
        {{ onglet.titre }}
      </button>
    </nav>

    <section class="bloc">
      <OngletPaiements v-if="ongletActif === 'paiements'" :preparation="preparation" />
      <OngletComptes v-else-if="ongletActif === 'comptes'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletPaiements from './OngletPaiements.vue'
import OngletComptes from './OngletComptes.vue'

const ONGLETS = [
  { code: 'paiements', titre: 'Paiements et avances', icone: 'portefeuille' },
  { code: 'comptes', titre: 'Comptes des centres', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)

// Paiement d'une facture précise : /paiements?centre=12&facture=34
const preparation = ref(null)
if (route.query.centre) {
  preparation.value = { centreId: Number(route.query.centre), factureId: route.query.facture ? Number(route.query.facture) : null }
  ongletActif.value = 'paiements'
}
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }), { immediate: true })
</script>

<style scoped>
.page-module { display: flex; flex-direction: column; gap: 1.25rem; }
.onglets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.onglet {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1rem; border-radius: 999px;
  background: #fff; color: var(--texte-sur-fond); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05);
}
.onglet:hover { background: var(--primary-light); }
.onglet.actif { background: var(--primary); color: #fff; box-shadow: 0 6px 16px rgba(0, 163, 108, 0.35); }
</style>
