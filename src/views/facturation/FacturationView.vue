<!--
  =============================================================================
  MODULE 07a — FACTURATION (page avec onglets)
  =============================================================================
  Spec nov. 2026 : une facture = une SORTIE de stock du district vers un
  centre (générée par le rapport centre, ou manuelle en cours de mois).
    - À FACTURER : ANCIEN circuit seulement (rapports de consommation validés
                   avant la refonte, pas encore facturés) -> OngletAFacturer.vue
                   Onglet AFFICHÉ SEULEMENT s'il en reste (pour ne pas le
                   confondre avec le bouton « + Facture générée »).
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
      description="Sorties du district vers les centres de santé : factures issues des rapports et factures manuelles."
    />

    <div class="circuit">
      <div class="etape"><span>1</span> Rapport centre validé ou facture manuelle</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape forte"><span>2</span> Facture = sortie du stock du district</div>
      <Icone nom="fleche" :taille="18" />
      <div class="etape"><span>3</span> Paiements (module Paiements & comptes)</div>
    </div>

    <!-- Onglets : affichés seulement s'il en existe plus d'un -->
    <nav v-if="ongletsVisibles.length > 1" class="onglets">
      <button
        v-for="onglet in ongletsVisibles"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletFactures from './OngletFactures.vue'
import OngletAFacturer from './OngletAFacturer.vue'
import { rapportsAFacturer } from '@/api/facturation'

const ONGLETS = [
  { code: 'factures', titre: 'Factures', icone: 'facture' },
  { code: 'a-facturer', titre: 'Anciens rapports à facturer', icone: 'presse-papier' },
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
  // Plus rien à facturer alors qu'on est sur cet onglet : retour aux factures
  if (nombreAFacturer.value === 0 && ongletActif.value === 'a-facturer') ongletActif.value = 'factures'
}
onMounted(compter)

// L'onglet des anciens rapports n'apparaît que s'il en reste à facturer
const ongletsVisibles = computed(() => ONGLETS.filter((o) => o.code !== 'a-facturer' || nombreAFacturer.value > 0))

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
