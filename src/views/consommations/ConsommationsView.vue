<!--
  =============================================================================
  MODULE 06 — RAPPORTS CENTRE DE SANTÉ (page avec onglets) — spec nov. 2026, §5
  =============================================================================
  Le rapport mensuel REMPLACE LA COMMANDE du centre : le district saisit la
  consommation, l'application calcule le stock restant et la quantité à livrer.
    1. RAPPORTS CENTRE : saisie, calculs, validation -> facture-sortie
                                                       -> OngletRapportsCentre.vue
    2. SUIVI des rapports (centres × mois)             -> OngletSuivi.vue
    3. ANCIENS RAPPORTS (ancien circuit : déclaration du centre, vérification
       sur place), consultables jusqu'au nettoyage     -> OngletRapports.vue
  Droits : module « consommations » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-consommations">
    <EnteteModule
      icone="presse-papier"
      titre="Rapports centre de santé"
      description="Consommation mensuelle de chaque centre, stock restant et quantité à livrer."
    />

    <!-- Circuit (rappel visuel) -->
    <div class="circuit">
      <div class="etape"><span>1</span> Saisie de C et P par le district</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>2</span> SDU, CMM et quantité à livrer calculés</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>3</span> Validation = facture-sortie</div>
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
      <OngletRapportsCentre v-if="ongletActif === 'rapports-centre'" :a-ouvrir="aOuvrir" />
      <OngletSuivi v-else-if="ongletActif === 'suivi'" @ouvrir="ouvrirRapport" />
      <OngletRapports v-else-if="ongletActif === 'rapports'" />
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletRapports from './OngletRapports.vue'
import OngletRapportsCentre from './OngletRapportsCentre.vue'
import OngletSuivi from './OngletSuivi.vue'

const ONGLETS = [
  { code: 'rapports-centre', titre: 'Rapports centre', icone: 'presse-papier' },
  { code: 'suivi', titre: 'Suivi des rapports', icone: 'graphique' },
  { code: 'rapports', titre: 'Anciens rapports', icone: 'facture' },
]

const route = useRoute()
const router = useRouter()
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Rapport à ouvrir depuis le tableau de suivi ({ id } ou { centreId, annee, mois })
const aOuvrir = ref(null)
function ouvrirRapport(rapport) {
  aOuvrir.value = { ...rapport } // nouvel objet : relance même pour le même rapport
  ongletActif.value = 'rapports-centre'
}
watch(ongletActif, (code) => {
  if (code !== 'rapports-centre') aOuvrir.value = null
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
