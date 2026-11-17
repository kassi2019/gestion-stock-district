<!--
  =============================================================================
  MODULE 03 — RÉCEPTION FOURNISSEURS (page avec onglets) — spec nov. 2026, §3
  =============================================================================
  Le district commande dans l'application nationale : ici, on enregistre
  seulement ce qui est REÇU des fournisseurs.
    1. RÉCEPTION des médicaments (lots, péremptions, prix d'achat repris des
       paramètres) ; sa VALIDATION fait entrer le stock -> OngletReceptions.vue
    2. HISTORIQUE des achats par fournisseur, médicament, période
                                                         -> OngletHistorique.vue
  Droits : module « achats » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-achats">
    <EnteteModule
      icone="panier"
      titre="Réception fournisseurs"
      description="Livraisons reçues des fournisseurs du district et historique des achats."
    />

    <!-- Circuit (rappel visuel) -->
    <div class="circuit">
      <div class="etape"><span>1</span> Réception (lots, péremptions)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>2</span> Validation = entrée en stock</div>
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
      <OngletReceptions v-if="ongletActif === 'receptions'" />
      <OngletHistorique v-else-if="ongletActif === 'historique'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletReceptions from './OngletReceptions.vue'
import OngletHistorique from './OngletHistorique.vue'

const ONGLETS = [
  { code: 'receptions', titre: 'Réceptions', icone: 'carton' },
  { code: 'historique', titre: 'Historique des achats', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()

// Onglet affiché, aussi écrit dans l'adresse (ex. /achats?onglet=receptions)
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

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
