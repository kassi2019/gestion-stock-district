<!--
  =============================================================================
  MODULE 06 — RAPPORTS MENSUELS DE CONSOMMATION (page avec onglets)
  =============================================================================
  Circuit (cahier des charges §3.5) :
    1. SAISIE du rapport transmis par le centre (quantités déclarées, valorisées
       au prix de vente applicable)                       -> OngletRapports.vue
    2. VÉRIFICATION SUR PLACE par l'agent du district (quantités constatées ;
       la quantité vérifiée est retenue)                   -> OngletRapports.vue
    3. VALIDATION = déduction du stock théorique du centre, puis facturation
    4. SUIVI des déclarations (qui a déclaré, qui manque)  -> OngletSuivi.vue
  Droits : module « consommations » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-consommations">
    <EnteteModule
      icone="presse-papier"
      titre="Rapports mensuels de consommation"
      description="Saisie des consommations déclarées par les centres, vérification sur place et validation."
    />

    <!-- Circuit (rappel visuel) -->
    <div class="circuit">
      <div class="etape"><span>1</span> Saisie du rapport du centre</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>2</span> Vérification sur place (agent du district)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>3</span> Validation = déduction du stock du centre</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>4</span> Facturation</div>
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
      <OngletRapports v-if="ongletActif === 'rapports'" :a-ouvrir="aOuvrir" />
      <OngletSuivi v-else-if="ongletActif === 'suivi'" @ouvrir="ouvrirRapport" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletRapports from './OngletRapports.vue'
import OngletSuivi from './OngletSuivi.vue'

const ONGLETS = [
  { code: 'rapports', titre: 'Rapports mensuels', icone: 'presse-papier' },
  { code: 'suivi', titre: 'Suivi des déclarations', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Rapport à ouvrir depuis le tableau de suivi ({ id } ou { centreId, annee, mois })
const aOuvrir = ref(null)
function ouvrirRapport(rapport) {
  aOuvrir.value = { ...rapport } // nouvel objet : relance même pour le même rapport
  ongletActif.value = 'rapports'
}
watch(ongletActif, (code) => {
  if (code !== 'rapports') aOuvrir.value = null
})
</script>

<style scoped>
.page-consommations { display: flex; flex-direction: column; gap: 1.25rem; }
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
