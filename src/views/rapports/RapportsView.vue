<!--
  =============================================================================
  MODULE 09 — TABLEAU DE BORD ET ÉTATS (cahier des charges §3.8)
  =============================================================================
  À gauche : le tableau de bord puis la liste des états, par thème.
  En haut : UNE seule ligne de filtres, qui s'applique à tout ce qui est
  affiché (période avec raccourcis, centre, fournisseur, médicament ; seuls
  les filtres utiles à l'état choisi sont proposés).
  À droite : le tableau de bord (TableauDeBord.vue) ou l'état (EtatTableau.vue),
  exportable en PDF et Excel. Les états sont décrits dans etatsConfig.js.
  Droits : module « rapports » (Voir / Imprimer).
  =============================================================================
-->
<template>
  <div class="page-module">
    <EnteteModule icone="graphique" titre="Tableau de bord et états" description="Indicateurs, statistiques et états imprimables du district (PDF et Excel)." />

    <div class="disposition">
      <!-- ========== Liste des états ========== -->
      <aside class="menu-etats">
        <button class="entree" :class="{ actif: selection === 'tableau-de-bord' }" @click="selection = 'tableau-de-bord'">
          <Icone nom="graphique" :taille="16" /> Tableau de bord
        </button>
        <div v-for="groupe in groupes" :key="groupe.titre" class="groupe">
          <span class="titre-groupe">{{ groupe.titre }}</span>
          <button v-for="e in groupe.etats" :key="e.code" class="entree" :class="{ actif: selection === e.code }" @click="selection = e.code">{{ e.titre }}</button>
        </div>
      </aside>

      <section class="contenu">
        <!-- ========== Filtres (une ligne, au-dessus de tout) ========== -->
        <div class="filtres">
          <template v-if="utilise('periode')">
            <div class="raccourcis">
              <button v-for="p in PERIODES" :key="p.code" :class="{ actif: periode === p.code }" @click="choisirPeriode(p.code)">{{ p.libelle }}</button>
            </div>
            <div class="dates">
              <ChampDate v-model="filtres.du" title="Du" @change="periode = 'perso'" />
              <span>au</span>
              <ChampDate v-model="filtres.au" title="Au" @change="periode = 'perso'" />
            </div>
          </template>
          <div v-if="utilise('centre')" class="filtre">
            <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
          </div>
          <div v-if="utilise('fournisseur')" class="filtre">
            <ListeDeroulante v-model="filtres.fournisseurId" :options="fournisseurs" champ-libelle="raisonSociale" placeholder="Tous les fournisseurs" />
          </div>
          <div v-if="utilise('medicament')" class="filtre large">
            <ListeDeroulante v-model="filtres.medicamentId" :options="medicaments" :champ-libelle="(m) => `${m.code} — ${m.designation}`" placeholder="Tous les médicaments" />
          </div>
          <span v-if="!filtresEtat.length" class="sans-filtre">Situation à ce jour (pas de filtre de période).</span>
        </div>

        <div class="bloc">
          <TableauDeBord v-if="selection === 'tableau-de-bord'" :filtres="filtres" @ouvrir="(code) => (selection = code)" />
          <EtatTableau v-else-if="etatChoisi" :etat="etatChoisi" :filtres="filtres" :sous-titre="sousTitre" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { formaterDate } from '@/utils/format'
import TableauDeBord from './TableauDeBord.vue'
import EtatTableau from './EtatTableau.vue'
import { ETATS } from './etatsConfig'

const store = useStore()
const route = useRoute()
const router = useRouter()

// ---------------------------------------------------------------------------
// ÉTAT AFFICHÉ (aussi dans l'adresse : /rapports?etat=consommations)
// ---------------------------------------------------------------------------
const selection = ref(ETATS.some((e) => e.code === route.query.etat) ? route.query.etat : 'tableau-de-bord')
watch(selection, (code) => router.replace({ query: { etat: code } }))
const etatChoisi = computed(() => ETATS.find((e) => e.code === selection.value))
const groupes = computed(() => {
  const liste = []
  for (const e of ETATS) {
    let g = liste.find((x) => x.titre === e.groupe)
    if (!g) liste.push((g = { titre: e.groupe, etats: [] }))
    g.etats.push(e)
  }
  return liste
})

/** Filtres proposés : ceux de l'état choisi (tableau de bord : période + centre). */
const filtresEtat = computed(() => (selection.value === 'tableau-de-bord' ? ['periode', 'centre'] : etatChoisi.value?.filtres || []))
const utilise = (f) => filtresEtat.value.includes(f)

// ---------------------------------------------------------------------------
// FILTRES ET RACCOURCIS DE PÉRIODE
// ---------------------------------------------------------------------------
const PERIODES = [
  { code: 'mois', libelle: 'Ce mois' },
  { code: 'mois-precedent', libelle: 'Mois dernier' },
  { code: 'trimestre', libelle: '3 derniers mois' },
  { code: 'annee', libelle: 'Cette année' },
  { code: '12mois', libelle: '12 derniers mois' },
]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function bornes(code) {
  const j = new Date()
  const debutMois = (decalage) => new Date(j.getFullYear(), j.getMonth() + decalage, 1)
  switch (code) {
    case 'mois':
      return [debutMois(0), j]
    case 'mois-precedent':
      return [debutMois(-1), new Date(j.getFullYear(), j.getMonth(), 0)]
    case 'trimestre':
      return [debutMois(-2), j]
    case 'annee':
      return [new Date(j.getFullYear(), 0, 1), j]
    default:
      return [debutMois(-11), j]
  }
}
const periode = ref('12mois')
const filtres = reactive({ du: '', au: '', centreId: null, fournisseurId: null, medicamentId: null })
function choisirPeriode(code) {
  periode.value = code
  const [du, au] = bornes(code)
  filtres.du = iso(du)
  filtres.au = iso(au)
}
choisirPeriode('12mois')

const centres = computed(() => store.state.referentiel.centres)
const fournisseurs = computed(() => store.state.referentiel.fournisseurs)
const medicaments = computed(() => store.state.referentiel.medicaments)

/** Sous-titre des exports : les filtres appliqués, en clair. */
const sousTitre = computed(() => {
  const parties = []
  if (utilise('periode')) parties.push(`Du ${formaterDate(filtres.du)} au ${formaterDate(filtres.au)}`)
  else parties.push(`Situation au ${formaterDate(iso(new Date()))}`)
  if (utilise('centre')) parties.push(centres.value.find((c) => c.id === filtres.centreId)?.nom || 'Tous les centres')
  if (utilise('fournisseur') && filtres.fournisseurId) parties.push(fournisseurs.value.find((f) => f.id === filtres.fournisseurId)?.raisonSociale)
  if (utilise('medicament') && filtres.medicamentId) parties.push(medicaments.value.find((m) => m.id === filtres.medicamentId)?.designation)
  return parties.filter(Boolean).join(' — ')
})

onMounted(() => {
  for (const liste of ['centres', 'fournisseurs', 'medicaments']) store.dispatch('referentiel/charger', { liste }).catch(() => {})
})
</script>

<style scoped>
.page-module { display: flex; flex-direction: column; gap: 1.25rem; }
.disposition { display: grid; grid-template-columns: 250px 1fr; gap: 1.25rem; align-items: start; }
.menu-etats {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05);
}
.groupe { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.6rem; }
.titre-groupe { padding: 0 0.6rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
.entree { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.6rem; border-radius: 8px; background: transparent; color: var(--texte-sur-fond); font-size: 0.86rem; text-align: left; }
.entree:hover { background: var(--primary-light); }
.entree.actif { background: var(--primary); color: #fff; font-weight: 600; }
.contenu { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.filtres { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.raccourcis { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.raccourcis button { padding: 0.35rem 0.7rem; border-radius: 999px; background: #fff; color: var(--texte-sur-fond); font-size: 0.8rem; font-weight: 600; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
.raccourcis button.actif { background: var(--primary); color: #fff; }
.dates { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.dates input { width: 150px; }
.filtre { min-width: 200px; }
.filtre.large { min-width: 280px; }
.sans-filtre { font-size: 0.85rem; color: var(--muted); }
@media (max-width: 1000px) { .disposition { grid-template-columns: 1fr; } .menu-etats { position: static; } }
</style>
