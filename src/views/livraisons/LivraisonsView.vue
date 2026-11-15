<!--
  =============================================================================
  MODULE 05 — CENTRES DE SANTÉ : COMMANDES ET LIVRAISONS (page avec onglets)
  =============================================================================
  Circuit de distribution (cahier des charges §3.4) :
    1. COMMANDE du centre, vérification des disponibilités, quantités
       ACCORDÉES                                           -> OngletCommandesCentre.vue
    2. PRÉPARATION (lots choisis automatiquement, prix figés) puis VALIDATION
       de la livraison = sortie du dépôt + entrée au centre -> OngletLivraisons.vue
    3. SUIVI par centre : stock théorique, livraisons, mouvements
                                                            -> OngletCentres.vue
  Droits : module « livraisons » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-livraisons">
    <EnteteModule
      icone="camion"
      titre="Commandes et livraisons aux centres"
      description="Commandes des centres de santé, préparation et bons de livraison, stock théorique de chaque centre."
    />

    <!-- Circuit en 3 étapes (rappel visuel) -->
    <div class="circuit">
      <div class="etape"><span>1</span> Commande du centre (quantités accordées)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>2</span> Préparation (lots, prix)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>3</span> Validation = sortie du dépôt, entrée au centre</div>
    </div>

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
      <OngletCommandesCentre v-if="ongletActif === 'commandes'" @preparer="preparer" />
      <OngletLivraisons v-else-if="ongletActif === 'livraisons'" :commande-a-preparer="commandeAPreparer" />
      <OngletCentres v-else-if="ongletActif === 'centres'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletCommandesCentre from './OngletCommandesCentre.vue'
import OngletLivraisons from './OngletLivraisons.vue'
import OngletCentres from './OngletCentres.vue'

const ONGLETS = [
  { code: 'commandes', titre: 'Commandes des centres', icone: 'facture' },
  { code: 'livraisons', titre: 'Bons de livraison', icone: 'camion' },
  { code: 'centres', titre: 'Suivi des centres', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()

// Onglet affiché, aussi écrit dans l'adresse (ex. /livraisons?onglet=centres)
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Commande à livrer (bouton « Préparer la livraison » de l'onglet Commandes)
const commandeAPreparer = ref(null)
function preparer(commande) {
  commandeAPreparer.value = { ...commande } // nouvel objet : relance même pour la même commande
  ongletActif.value = 'livraisons'
}
watch(ongletActif, (code) => {
  if (code !== 'livraisons') commandeAPreparer.value = null
})
</script>

<style scoped>
.page-livraisons { display: flex; flex-direction: column; gap: 1.25rem; }

.circuit { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; color: var(--muted); }
.etape {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  background: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--texte-sur-fond);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.etape span {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.75rem;
  font-weight: 800;
}
.etape.forte { background: var(--primary); color: #fff; }
.etape.forte span { background: rgba(255, 255, 255, 0.25); color: #fff; }

.onglets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.onglet {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  background: #fff;
  color: var(--texte-sur-fond);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05);
}
.onglet:hover { background: var(--primary-light); }
.onglet.actif { background: var(--primary); color: #fff; box-shadow: 0 6px 16px rgba(0, 163, 108, 0.35); }
</style>
