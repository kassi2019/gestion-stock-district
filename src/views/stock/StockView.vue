<!--
  =============================================================================
  MODULE 04 — GESTION DU DÉPÔT ET DES STOCKS (page avec onglets)
  =============================================================================
  Cahier des charges §3.3 :
    - OngletEtat.vue        stock disponible par médicament et par lot,
                            valorisation, FICHE DE STOCK (PDF) ;
    - OngletAlertes.vue     ruptures, stocks sous le seuil, lots périmés et
                            proches de la péremption ;
    - OngletMouvements.vue  historique des mouvements + NOUVEAU MOUVEMENT
                            (ajustement, périmés, transfert) avec motif ;
    - OngletInventaires.vue inventaire PAR LOT (comme la pharmacie Clinique) :
                            comptage, corrections de lot, retraits, ajout et
                            rattachement de lot, fiche d'inventaire.

  L'état du stock et le délai d'alerte de péremption (Paramètres généraux)
  sont chargés ICI une seule fois et partagés ; ils sont rechargés après un
  mouvement ou un inventaire (événement « modifie »).
  Droits : module « stock » (Voir / Imprimer / Modifier).
  =============================================================================
-->
<template>
  <div class="page-stock">
    <EnteteModule
      icone="carton"
      titre="Stock du dépôt"
      description="Stock disponible par médicament et par lot, mouvements, alertes et inventaires."
    />

    <nav class="onglets">
      <button
        v-for="onglet in ONGLETS"
        :key="onglet.code"
        class="onglet"
        :class="{ actif: ongletActif === onglet.code, alerte: onglet.code === 'alertes' && nombreAlertes > 0 }"
        @click="ongletActif = onglet.code"
      >
        <Icone :nom="onglet.icone" :taille="18" />
        {{ onglet.titre }}
        <span v-if="onglet.code === 'alertes'" class="nombre-onglet">{{ nombreAlertes }}</span>
      </button>
    </nav>

    <section class="bloc">
      <p v-if="chargement && !charge" class="tableau-vide">Chargement…</p>
      <template v-else>
        <OngletEtat v-if="ongletActif === 'etat'" :etat="etat" :delai-alerte="delaiAlerte" @modifie="charger" />
        <OngletAlertes
          v-else-if="ongletActif === 'alertes'"
          :etat="etat"
          :delai-alerte="delaiAlerte"
          :sortie-auto="sortieAuto"
          @modifie="charger"
        />
        <OngletMouvements v-else-if="ongletActif === 'mouvements'" :etat="etat" @modifie="charger" />
        <OngletInventaires v-else-if="ongletActif === 'inventaires'" :etat="etat" :delai-alerte="delaiAlerte" @modifie="charger" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletEtat from './OngletEtat.vue'
import OngletAlertes from './OngletAlertes.vue'
import OngletMouvements from './OngletMouvements.vue'
import OngletInventaires from './OngletInventaires.vue'
import { etatStock } from '@/api/stock'
import { listerParametres } from '@/api/parametrage'
import { etatMedicament, etatPeremption } from './stockCommun'

const ONGLETS = [
  { code: 'etat', titre: 'État du stock', icone: 'carton' },
  { code: 'alertes', titre: 'Alertes', icone: 'alerte' },
  { code: 'mouvements', titre: 'Mouvements', icone: 'graphique' },
  { code: 'inventaires', titre: 'Inventaire', icone: 'presse-papier' },
]

const store = useStore()
const route = useRoute()
const router = useRouter()

const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

const etat = ref([])
/** Délai d'alerte de péremption, en jours (paramètre ALERTE_PEREMPTION_JOURS, 90 par défaut). */
const delaiAlerte = ref(90)
/** Sortie automatique des lots périmés chaque nuit (paramètre SORTIE_AUTO_PERIMES). */
const sortieAuto = ref(false)
const chargement = ref(false)
const charge = ref(false)

/** Nombre d'alertes (médicaments actifs en rupture / sous le seuil + lots périmés / proches). */
const nombreAlertes = computed(() => {
  const actifs = etat.value.filter((m) => m.actif)
  const stock = actifs.filter((m) => etatMedicament(m).code !== 'NORMAL').length
  const lots = etat.value.flatMap((m) => m.lots).filter((l) => {
    const p = etatPeremption(l.datePeremption, delaiAlerte.value)
    return p && p.code !== 'NORMAL'
  }).length
  return stock + lots
})

async function charger() {
  chargement.value = true
  try {
    const [donnees, parametres] = await Promise.all([etatStock(), listerParametres().catch(() => [])])
    etat.value = donnees
    const delai = Number(parametres.find((p) => p.cle === 'ALERTE_PEREMPTION_JOURS')?.valeur)
    if (delai > 0) delaiAlerte.value = delai
    sortieAuto.value = parametres.find((p) => p.cle === 'SORTIE_AUTO_PERIMES')?.valeur === 'true'
    charge.value = true
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

onMounted(charger)
</script>

<style scoped>
.page-stock { display: flex; flex-direction: column; gap: 1.25rem; }
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
.nombre-onglet {
  min-width: 22px;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
}
.onglet.alerte .nombre-onglet { background: #fdecec; color: var(--danger); }
.onglet.actif .nombre-onglet { background: rgba(255, 255, 255, 0.25); color: #fff; }
</style>
