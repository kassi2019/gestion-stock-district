<!--
  =============================================================================
  MODULE 03 — APPROVISIONNEMENTS ET ACHATS DU DISTRICT (page avec onglets)
  =============================================================================
  Circuit d'achat (cahier des charges §3.2 et §4, étapes 1-2) :
    1. COMMANDE au fournisseur (bon de commande)        -> OngletCommandes.vue
    2. RÉCEPTION des médicaments, totale ou partielle, avec lots et
       péremptions ; sa VALIDATION fait entrer le stock -> OngletReceptions.vue
    3. HISTORIQUE des achats par fournisseur, médicament, période
                                                         -> OngletHistorique.vue
  Pièces justificatives (facture, bon de livraison...) sur les commandes et
  les réceptions. Droits : module « achats » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-achats">
    <EnteteModule
      icone="panier"
      titre="Approvisionnements et achats"
      description="Commandes aux fournisseurs, réceptions au dépôt et historique des achats du district."
    />

    <!-- Circuit en 3 étapes (rappel visuel) -->
    <div class="circuit">
      <div class="etape"><span>1</span> Commande au fournisseur</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>2</span> Réception (lots, péremptions)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>3</span> Validation = entrée en stock</div>
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
      <OngletCommandes v-if="ongletActif === 'commandes'" @receptionner="receptionner" />
      <OngletReceptions
        v-else-if="ongletActif === 'receptions'"
        :commande-a-receptionner="commandeAReceptionner"
      />
      <OngletHistorique v-else-if="ongletActif === 'historique'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletCommandes from './OngletCommandes.vue'
import OngletReceptions from './OngletReceptions.vue'
import OngletHistorique from './OngletHistorique.vue'

const ONGLETS = [
  { code: 'commandes', titre: 'Commandes fournisseurs', icone: 'facture' },
  { code: 'receptions', titre: 'Réceptions', icone: 'carton' },
  { code: 'historique', titre: 'Historique des achats', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()

// Onglet affiché, aussi écrit dans l'adresse (ex. /achats?onglet=receptions)
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Commande à réceptionner (bouton « Réceptionner » de l'onglet Commandes)
const commandeAReceptionner = ref(null)
function receptionner(commande) {
  commandeAReceptionner.value = { ...commande } // nouvel objet : relance même pour la même commande
  ongletActif.value = 'receptions'
}
watch(ongletActif, (code) => {
  if (code !== 'receptions') commandeAReceptionner.value = null
})
</script>

<style scoped>
.page-achats { display: flex; flex-direction: column; gap: 1.25rem; }

.circuit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
}
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
.onglet.actif {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(0, 163, 108, 0.35);
}
</style>
