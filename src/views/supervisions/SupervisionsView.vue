<!--
  =============================================================================
  MODULE 08 — SUPERVISIONS ET INVENTAIRES DANS LES CENTRES (page avec onglets)
  =============================================================================
  Cahier des charges §3.7 — le constat d'un écart, sa validation et son
  éventuelle facturation sont DISTINCTS (jamais de dette automatique) :
    1. Constat : stock théorique à la date / stock physique / écarts valorisés
    2. Validation par une personne habilitée
    3. Décision : aucune suite, régularisation du stock ou facturation
                                                   -> OngletSupervisions.vue
    Historique des écarts et des décisions         -> OngletEcarts.vue
  Droits : module « supervisions » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-module">
    <EnteteModule
      icone="loupe"
      titre="Supervisions et inventaires dans les centres"
      description="Contrôles physiques du stock des centres, écarts valorisés, validation et décisions."
    />

    <div class="circuit">
      <div class="etape"><span>1</span> Constat (théorique / physique)</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>2</span> Validation</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>3</span> Décision : aucune suite, régularisation ou facturation</div>
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
      <OngletSupervisions v-if="ongletActif === 'supervisions'" ref="ongletSupervisions" />
      <OngletEcarts v-else-if="ongletActif === 'ecarts'" @ouvrir="ouvrirSupervision" />
    </section>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletSupervisions from './OngletSupervisions.vue'
import OngletEcarts from './OngletEcarts.vue'

const ONGLETS = [
  { code: 'supervisions', titre: 'Supervisions', icone: 'loupe' },
  { code: 'ecarts', titre: 'Historique des écarts', icone: 'graphique' },
]

const route = useRoute()
const router = useRouter()
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Clic sur un n° de supervision dans l'historique : ouvre la supervision
const ongletSupervisions = ref(null)
async function ouvrirSupervision(id) {
  ongletActif.value = 'supervisions'
  await nextTick()
  ongletSupervisions.value?.ouvrir({ id })
}
</script>

<style scoped>
.page-module { display: flex; flex-direction: column; gap: 1.25rem; }
.circuit { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; color: var(--muted); }
.etape {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.4rem 0.85rem; border-radius: 999px;
  background: #fff; font-size: 0.85rem; font-weight: 600; color: var(--texte-sur-fond); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.etape span {
  width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%;
  background: var(--primary-light); color: var(--primary-dark); font-size: 0.75rem; font-weight: 800;
}
.etape.forte { background: var(--primary); color: #fff; }
.etape.forte span { background: rgba(255, 255, 255, 0.25); color: #fff; }
.onglets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.onglet {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1rem; border-radius: 999px;
  background: #fff; color: var(--texte-sur-fond); font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05);
}
.onglet:hover { background: var(--primary-light); }
.onglet.actif { background: var(--primary); color: #fff; box-shadow: 0 6px 16px rgba(0, 163, 108, 0.35); }
</style>
