<!--
  =============================================================================
  MODULE 07a — FACTURATION (page avec onglets)
  =============================================================================
  Cahier des charges §3.6 :
    - À FACTURER : rapports de consommation validés -> génération des factures
                                                      -> OngletAFacturer.vue
    - FACTURES   : numérotation, archivage, PDF, montant payé et solde,
                   échéances, annulation tracée      -> OngletFactures.vue
  Paiements, avances et comptes des centres : module « Paiements & comptes ».
  Droits : module « facturation » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-module">
    <EnteteModule
      icone="facture"
      titre="Facturation"
      description="Factures mensuelles des centres, générées à partir des rapports de consommation validés."
    />

    <div class="circuit">
      <div class="etape"><span>1</span> Rapport de consommation validé</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>2</span> Génération de la facture</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>3</span> Paiements (module Paiements & comptes)</div>
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
        <span v-if="onglet.code === 'a-facturer' && nombreAFacturer" class="compteur">{{ nombreAFacturer }}</span>
      </button>
    </nav>

    <section class="bloc">
      <OngletFactures v-if="ongletActif === 'factures'" :a-ouvrir="factureAOuvrir" />
      <OngletAFacturer v-else-if="ongletActif === 'a-facturer'" @generees="apresGeneration" />
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletFactures from './OngletFactures.vue'
import OngletAFacturer from './OngletAFacturer.vue'
import { rapportsAFacturer } from '@/api/facturation'

const ONGLETS = [
  { code: 'factures', titre: 'Factures', icone: 'facture' },
  { code: 'a-facturer', titre: 'À facturer', icone: 'presse-papier' },
]

const route = useRoute()
const router = useRouter()
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Nombre de rapports à facturer (pastille sur l'onglet)
const nombreAFacturer = ref(0)
async function compter() {
  try {
    nombreAFacturer.value = (await rapportsAFacturer()).length
  } catch {
    nombreAFacturer.value = 0
  }
}
onMounted(compter)

// Après génération : onglet Factures, première facture ouverte
const factureAOuvrir = ref(null)
function apresGeneration(ids) {
  compter()
  factureAOuvrir.value = ids.length === 1 ? ids[0] : null
  ongletActif.value = 'factures'
}
watch(ongletActif, (code) => {
  if (code !== 'factures') factureAOuvrir.value = null
})
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
.compteur { min-width: 20px; padding: 0 0.4rem; border-radius: 999px; background: var(--danger); color: #fff; font-size: 0.72rem; line-height: 20px; text-align: center; }
</style>
