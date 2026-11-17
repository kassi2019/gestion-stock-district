<!--
  =============================================================================
  MODULE 05 — STOCK DES CENTRES ET HISTORIQUE DES LIVRAISONS (page avec onglets)
  =============================================================================
  Spec nov. 2026 : plus de commandes des centres ; les sorties vers les centres
  se font par FACTURE (générée par le rapport centre, ou manuelle).
    1. SUIVI par centre : stock théorique, livraisons, mouvements -> OngletCentres.vue
    2. ANCIENS BONS DE LIVRAISON (lecture seule)                  -> OngletLivraisons.vue
  Droits : module « livraisons » (Voir / Imprimer).
  =============================================================================
-->
<template>
  <div class="page-livraisons">
    <EnteteModule
      icone="camion"
      titre="Stock des centres et historique des livraisons"
      description="Stock théorique de chaque centre et anciens bons de livraison (les livraisons se font maintenant par facture)."
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
      <OngletCentres v-if="ongletActif === 'centres'" />
      <OngletLivraisons v-else-if="ongletActif === 'livraisons'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletLivraisons from './OngletLivraisons.vue'
import OngletCentres from './OngletCentres.vue'

const ONGLETS = [
  { code: 'centres', titre: 'Suivi des centres', icone: 'graphique' },
  { code: 'livraisons', titre: 'Anciens bons de livraison', icone: 'camion' },
]

const route = useRoute()
const router = useRouter()

// Onglet affiché, aussi écrit dans l'adresse (ex. /livraisons?onglet=centres)
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

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
