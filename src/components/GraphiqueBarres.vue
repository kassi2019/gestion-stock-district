<!--
  =============================================================================
  GRAPHIQUE EN BARRES (SVG, sans librairie)
  =============================================================================
  - Colonnes verticales (ex. montants par mois) ou barres horizontales
    (ex. classement des produits) : prop « horizontal ».
  - Une ou plusieurs séries (même unité, UN SEUL axe). Légende affichée dès
    2 séries ; avec 1 série, le titre du bloc suffit.
  - Barres fines (24 px max), bout arrondi (4 px) côté valeur, carré côté
    axe ; 2 px d'espace entre barres voisines ; quadrillage discret.
  - Survol / focus clavier : info-bulle (valeur en gras, puis libellé).
  - « Voir le tableau » : les mêmes valeurs en tableau (accessibilité).
  Couleurs validées (contraste, daltonisme) : vert #00a36c (1 série),
  bleu #2a78d6 / orange #eb6834 (2 séries).

  Utilisation :
    <GraphiqueBarres :categories="['janv.', 'févr.']"
      :series="[{ nom: 'Facturé', couleur: '#2a78d6', valeurs: [1000, 2000] }]"
      :formater="formaterMontant" />
  =============================================================================
-->
<template>
  <div class="graphique">
    <!-- Légende (2 séries ou plus) -->
    <div v-if="series.length > 1" class="legende">
      <span v-for="s in series" :key="s.nom"><i :style="{ background: s.couleur }"></i>{{ s.nom }}</span>
    </div>

    <div v-if="!vueTableau" ref="zone" class="zone" @pointerleave="survol = null">
      <svg :viewBox="`0 0 ${L} ${H}`" :width="L" :height="H" role="img" :aria-label="titreAccessible">
        <!-- Quadrillage et graduations -->
        <g v-for="t in graduations" :key="t">
          <template v-if="!horizontal">
            <line :x1="M.g" :x2="L - M.d" :y1="echelle(t)" :y2="echelle(t)" class="grille" />
            <text :x="M.g - 6" :y="echelle(t) + 4" class="graduation" text-anchor="end">{{ court(t) }}</text>
          </template>
          <template v-else>
            <line :y1="M.h" :y2="H - M.b" :x1="echelle(t)" :x2="echelle(t)" class="grille" />
            <text :y="H - M.b + 14" :x="echelle(t)" class="graduation" text-anchor="middle">{{ court(t) }}</text>
          </template>
        </g>

        <!-- Barres -->
        <g v-for="(cat, i) in categories" :key="cat">
          <path
            v-for="(s, j) in series"
            :key="s.nom"
            :d="cheminBarre(i, j, s.valeurs[i])"
            :fill="s.couleur"
            class="barre"
            :class="{ active: survol && survol.i === i && survol.j === j }"
            tabindex="0"
            :aria-label="`${cat} — ${s.nom} : ${formater(s.valeurs[i])}`"
            @pointerenter="survoler(i, j, $event)"
            @pointermove="survoler(i, j, $event)"
            @focus="survoler(i, j, $event)"
            @blur="survol = null"
          />
          <!-- Libellé de catégorie -->
          <text v-if="!horizontal" :x="centreBande(i)" :y="H - M.b + 16" class="categorie" text-anchor="middle">{{ cat }}</text>
          <text v-else :x="M.g - 8" :y="centreBande(i) + 4" class="categorie" text-anchor="end">{{ tronquer(cat, 30) }}</text>
          <!-- Valeur au bout (barres horizontales, une série) -->
          <text
            v-if="horizontal && series.length === 1 && series[0].valeurs[i] > 0"
            :x="echelle(series[0].valeurs[i]) + 6"
            :y="centreBande(i) + 4"
            class="valeur"
          >{{ formater(series[0].valeurs[i]) }}</text>
        </g>
        <!-- Ligne de base -->
        <line v-if="!horizontal" :x1="M.g" :x2="L - M.d" :y1="echelle(0)" :y2="echelle(0)" class="base" />
        <line v-else :y1="M.h" :y2="H - M.b" :x1="echelle(0)" :x2="echelle(0)" class="base" />
      </svg>

      <!-- Info-bulle : valeur d'abord, libellé ensuite -->
      <div v-if="survol" class="info-bulle" :style="{ left: survol.x + 'px', top: survol.y + 'px' }">
        <strong>{{ formater(series[survol.j].valeurs[survol.i]) }}</strong>
        <span><i :style="{ background: series[survol.j].couleur }"></i>{{ series.length > 1 ? series[survol.j].nom + ' — ' : '' }}{{ categories[survol.i] }}</span>
      </div>
    </div>

    <!-- Vue tableau (mêmes valeurs) -->
    <table v-else class="tableau tableau-graphique">
      <thead>
        <tr><th></th><th v-for="s in series" :key="s.nom" class="nombre">{{ s.nom }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(cat, i) in categories" :key="cat">
          <td>{{ cat }}</td>
          <td v-for="s in series" :key="s.nom" class="nombre">{{ formater(s.valeurs[i]) }}</td>
        </tr>
      </tbody>
    </table>

    <button type="button" class="bouton-lien bascule" @click="vueTableau = !vueTableau">{{ vueTableau ? 'Voir le graphique' : 'Voir le tableau' }}</button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  categories: { type: Array, required: true },
  /** [{ nom, couleur, valeurs: [nombres, un par catégorie] }] */
  series: { type: Array, required: true },
  formater: { type: Function, default: (v) => String(v) },
  horizontal: { type: Boolean, default: false },
  hauteur: { type: Number, default: 260 },
})

const vueTableau = ref(false)
const survol = ref(null)
const zone = ref(null)

// Dimensions (unités SVG = pixels)
const L = 640
const H = computed(() => (props.horizontal ? Math.max(120, props.categories.length * 30 + 40) : props.hauteur))
const M = computed(() => (props.horizontal ? { g: 190, d: 90, h: 8, b: 24 } : { g: 56, d: 12, h: 12, b: 28 }))

const maximum = computed(() => Math.max(1, ...props.series.flatMap((s) => s.valeurs)))
/** Graduations « rondes » (1, 2, 5 × 10^n), 4 à 5 au total. */
const graduations = computed(() => {
  const brut = maximum.value / 4
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 5, 10].map((k) => k * puissance).find((p) => p >= brut)
  const liste = []
  for (let t = 0; t <= maximum.value + pas * 0.001; t += pas) liste.push(t)
  if (liste[liste.length - 1] < maximum.value) liste.push(liste[liste.length - 1] + pas)
  return liste
})
const maxAxe = computed(() => graduations.value[graduations.value.length - 1])

/** Valeur -> position (y pour les colonnes, x pour les barres horizontales). */
function echelle(v) {
  if (!props.horizontal) {
    const hauteurUtile = H.value - M.value.h - M.value.b
    return H.value - M.value.b - (v / maxAxe.value) * hauteurUtile
  }
  return M.value.g + (v / maxAxe.value) * (L - M.value.g - M.value.d)
}

const longueurBande = computed(() => (props.horizontal ? H.value - M.value.h - M.value.b : L - M.value.g - M.value.d) / props.categories.length)
function centreBande(i) {
  return (props.horizontal ? M.value.h : M.value.g) + longueurBande.value * (i + 0.5)
}
/** Épaisseur d'une barre : 24 px max, le reste de la bande reste vide. */
const epaisseur = computed(() => Math.max(4, Math.min(24, (longueurBande.value * 0.7 - 2 * (props.series.length - 1)) / props.series.length)))

/** Chemin d'une barre : bout arrondi (4 px) côté valeur, carré côté axe. */
function cheminBarre(i, j, valeur) {
  const n = props.series.length
  const e = epaisseur.value
  const debut = centreBande(i) - (n * e + (n - 1) * 2) / 2 + j * (e + 2)
  const r = Math.min(4, e / 2)
  if (!props.horizontal) {
    const y0 = echelle(0)
    const y1 = echelle(Math.max(0, valeur))
    const h = y0 - y1
    if (h <= 0) return ''
    const rr = Math.min(r, h)
    return `M${debut},${y0} V${y1 + rr} Q${debut},${y1} ${debut + rr},${y1} H${debut + e - rr} Q${debut + e},${y1} ${debut + e},${y1 + rr} V${y0} Z`
  }
  const x0 = echelle(0)
  const x1 = echelle(Math.max(0, valeur))
  const w = x1 - x0
  if (w <= 0) return ''
  const rr = Math.min(r, w)
  return `M${x0},${debut} H${x1 - rr} Q${x1},${debut} ${x1},${debut + rr} V${debut + e - rr} Q${x1},${debut + e} ${x1 - rr},${debut + e} H${x0} Z`
}

function survoler(i, j, evenement) {
  const cadre = zone.value?.getBoundingClientRect()
  const cible = evenement.target.getBoundingClientRect()
  if (!cadre) return
  survol.value = { i, j, x: cible.left - cadre.left + cible.width / 2, y: cible.top - cadre.top - 8 }
}

/** Graduation compacte : 1 500 000 -> « 1,5 M » ; 25 000 -> « 25 k ». */
function court(v) {
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (v >= 1e4) return `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k`
  return v.toLocaleString('fr-FR')
}
function tronquer(texte, n) {
  return texte.length > n ? texte.substring(0, n - 1) + '…' : texte
}
const titreAccessible = computed(() => props.series.map((s) => s.nom).join(', '))
</script>

<style scoped>
.graphique { position: relative; }
.zone { position: relative; overflow-x: auto; }
.zone svg { display: block; max-width: 100%; height: auto; }
.grille { stroke: #eceeec; stroke-width: 1; }
.base { stroke: #c9cfcb; stroke-width: 1; }
.graduation { font-size: 11px; fill: #6b7280; }
.categorie { font-size: 11px; fill: #374151; }
.valeur { font-size: 11px; fill: #1f2937; font-weight: 600; }
.barre { cursor: pointer; transition: opacity 0.15s; outline: none; }
.barre.active, .barre:focus { opacity: 0.8; }
.legende { display: flex; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.8rem; color: #374151; }
.legende i, .info-bulle i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 0.35rem; vertical-align: -1px; }
.info-bulle {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  font-size: 0.78rem;
  white-space: nowrap;
  z-index: 2;
}
.info-bulle strong { font-size: 0.9rem; color: #111827; }
.info-bulle span { color: #4b5563; }
.info-bulle span i { width: 12px; height: 2px; border-radius: 1px; vertical-align: 3px; }
.bascule { margin-top: 0.25rem; font-size: 0.78rem; }
.tableau-graphique { margin-top: 0.25rem; font-size: 0.85rem; }
</style>
