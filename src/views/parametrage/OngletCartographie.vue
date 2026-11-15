<!--
  =============================================================================
  ONGLET « CARTOGRAPHIE » : carte des centres de santé
  =============================================================================
  Affiche sur une carte les centres de santé dont les coordonnées GPS sont
  saisies (onglet « Centres de santé »), ainsi que le siège du district
  (Paramètres généraux > Informations du district).

  - À gauche : liste des centres (recherche + filtre par type). Un clic sur un
    centre centre la carte sur lui et ouvre sa fiche.
  - À droite : la carte. Un clic sur un point ouvre la fiche du centre.
  - Les centres SANS coordonnées sont signalés (à compléter dans l'onglet
    « Centres de santé »).

  Carte : librairie Leaflet (https://leafletjs.com), fond OpenStreetMap
  (connexion Internet nécessaire pour afficher le fond de carte).
  =============================================================================
-->
<template>
  <div class="cartographie">
    <!-- ===================== LISTE DES CENTRES ===================== -->
    <aside class="panneau">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher un centre…" />
      <ListeDeroulante v-model="typeFiltre" :options="typesCentre" placeholder="Tous les types" />
      <label class="case-a-cocher">
        <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
      </label>

      <!-- Compteurs -->
      <div class="compteurs">
        <span class="compteur">{{ centresLocalises.length }} sur la carte</span>
        <span v-if="centresSansCoordonnees.length" class="compteur orange">
          {{ centresSansCoordonnees.length }} sans coordonnées
        </span>
      </div>

      <ul class="liste-centres">
        <li
          v-for="centre in centresLocalises"
          :key="centre.id"
          :class="{ choisi: centreChoisi === centre.id }"
          @click="allerAuCentre(centre)"
        >
          <span class="pastille" :style="{ background: couleurType(centre.typeId) }"></span>
          <span class="nom">
            <strong>{{ centre.nom }}</strong>
            <small>{{ [centre.type?.libelle, centre.localite].filter(Boolean).join(' · ') || centre.code }}</small>
          </span>
        </li>
        <li v-if="centresLocalises.length === 0" class="vide">Aucun centre localisé.</li>
      </ul>

      <!-- Centres sans coordonnées -->
      <details v-if="centresSansCoordonnees.length" class="sans-coordonnees">
        <summary>Centres sans coordonnées ({{ centresSansCoordonnees.length }})</summary>
        <ul>
          <li v-for="centre in centresSansCoordonnees" :key="centre.id">{{ centre.nom }}</li>
        </ul>
        <small>À compléter dans l'onglet « Centres de santé » (latitude / longitude).</small>
      </details>
    </aside>

    <!-- ===================== CARTE ===================== -->
    <div class="zone-carte">
      <div ref="elementCarte" class="carte"></div>

      <!-- Légende des types de centres -->
      <div v-if="typesPresents.length || siege" class="legende">
        <div v-if="siege" class="legende-ligne">
          <span class="pastille siege"></span> Siège du district
        </div>
        <div v-for="type in typesPresents" :key="type.id ?? 'aucun'" class="legende-ligne">
          <span class="pastille" :style="{ background: couleurType(type.id) }"></span> {{ type.libelle }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { listerParametres } from '@/api/parametrage'

const store = useStore()

/** Vue de départ : la Côte d'Ivoire entière (si aucun centre n'est localisé). */
const CENTRE_PAR_DEFAUT = [7.54, -5.55]
const ZOOM_PAR_DEFAUT = 7

/** Couleurs des types de centres (attribuées dans l'ordre de la liste des types). */
const COULEURS = ['#00a36c', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777', '#4b5563']

const recherche = ref('')
const typeFiltre = ref(null)
const afficherInactifs = ref(false)
const centreChoisi = ref(null)
const siege = ref(null) // { nom, latitude, longitude, adresse, telephone }

const elementCarte = ref(null)
let carte = null // objet Leaflet (pas réactif : Vue n'a pas à le suivre)
let coucheCentres = null // groupe des points des centres
const marqueurs = new Map() // id du centre -> point sur la carte

const centres = computed(() => store.state.referentiel.centres)
const typesCentre = computed(() => store.state.referentiel.typesCentre)

/** Vrai si latitude ET longitude sont renseignées. */
function aDesCoordonnees(centre) {
  return centre.latitude !== null && centre.latitude !== undefined && centre.latitude !== '' &&
    centre.longitude !== null && centre.longitude !== undefined && centre.longitude !== ''
}

/** Centres après recherche / filtre / inactifs. */
const centresFiltres = computed(() => {
  const texte = recherche.value.toLowerCase()
  return centres.value.filter((c) => {
    if (!afficherInactifs.value && !c.actif) return false
    if (typeFiltre.value && c.typeId !== typeFiltre.value) return false
    if (!texte) return true
    return [c.code, c.nom, c.localite].some((v) => (v || '').toLowerCase().includes(texte))
  })
})
const centresLocalises = computed(() => centresFiltres.value.filter(aDesCoordonnees))
const centresSansCoordonnees = computed(() => centresFiltres.value.filter((c) => !aDesCoordonnees(c)))

/** Couleur d'un type de centre (gris si pas de type). */
function couleurType(typeId) {
  const index = typesCentre.value.findIndex((t) => t.id === typeId)
  return index === -1 ? '#6b7280' : COULEURS[index % COULEURS.length]
}

/** Types présents sur la carte (pour la légende). */
const typesPresents = computed(() => {
  const ids = [...new Set(centresLocalises.value.map((c) => c.typeId ?? null))]
  return ids.map((id) => typesCentre.value.find((t) => t.id === id) || { id: null, libelle: 'Sans type' })
})

/** Protège un texte avant de l'insérer dans la fiche HTML d'un point. */
function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** Contenu de la fiche (bulle) d'un centre. */
function ficheCentre(c) {
  const lignes = [
    ['Type', c.type?.libelle],
    ['Localité', c.localite],
    ['Adresse', c.adresse],
    ['Responsable', c.responsable],
    ['Téléphone', c.telephone],
    ['E-mail', c.email],
  ]
    .filter(([, valeur]) => valeur)
    .map(([titre, valeur]) => `<tr><th>${titre}</th><td>${echapper(valeur)}</td></tr>`)
    .join('')
  return `
    <div class="fiche-carte">
      <div class="fiche-titre">${echapper(c.nom)}</div>
      <div class="fiche-code">${echapper(c.code)}${c.actif ? '' : ' · <em>inactif</em>'}</div>
      <table>${lignes}</table>
      <div class="fiche-gps">📍 ${Number(c.latitude).toFixed(5)}, ${Number(c.longitude).toFixed(5)}</div>
    </div>`
}

/** (Re)dessine les points des centres et recadre la carte sur eux. */
function dessinerCentres() {
  if (!carte) return
  coucheCentres.clearLayers()
  marqueurs.clear()

  for (const c of centresLocalises.value) {
    const point = L.circleMarker([Number(c.latitude), Number(c.longitude)], {
      radius: 9,
      color: '#ffffff',
      weight: 2,
      fillColor: couleurType(c.typeId),
      fillOpacity: c.actif ? 0.95 : 0.4,
    })
      .bindPopup(ficheCentre(c))
      .bindTooltip(echapper(c.nom), { direction: 'top', offset: [0, -8] })
    point.on('click', () => (centreChoisi.value = c.id))
    coucheCentres.addLayer(point)
    marqueurs.set(c.id, point)
  }
  recadrer()
}

/** Cadre la carte pour voir tous les points (centres + siège). */
function recadrer() {
  const points = centresLocalises.value.map((c) => [Number(c.latitude), Number(c.longitude)])
  if (siege.value) points.push([siege.value.latitude, siege.value.longitude])
  if (points.length === 0) carte.setView(CENTRE_PAR_DEFAUT, ZOOM_PAR_DEFAUT)
  else if (points.length === 1) carte.setView(points[0], 14)
  else carte.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
}

/** Clic dans la liste : la carte va sur le centre et ouvre sa fiche. */
function allerAuCentre(centre) {
  centreChoisi.value = centre.id
  const point = marqueurs.get(centre.id)
  if (!point) return
  carte.flyTo(point.getLatLng(), Math.max(carte.getZoom(), 14), { duration: 0.6 })
  point.openPopup()
}

/** Point du siège du district (Paramètres généraux), s'il a des coordonnées. */
async function chargerSiege() {
  try {
    const parametres = await listerParametres()
    const valeur = (cle) => (parametres.find((p) => p.cle === cle)?.valeur || '').trim()
    const latitude = Number(valeur('DISTRICT_LATITUDE'))
    const longitude = Number(valeur('DISTRICT_LONGITUDE'))
    if (!valeur('DISTRICT_LATITUDE') || !valeur('DISTRICT_LONGITUDE') || Number.isNaN(latitude) || Number.isNaN(longitude)) return
    siege.value = {
      nom: valeur('NOM_DISTRICT') || 'Siège du district',
      latitude,
      longitude,
      adresse: [valeur('DISTRICT_ADRESSE'), valeur('DISTRICT_LOCALITE')].filter(Boolean).join(', '),
      telephone: valeur('DISTRICT_TELEPHONE'),
    }
    // Siège : carré orange, plus gros, toujours visible au-dessus des centres
    L.marker([latitude, longitude], {
      icon: L.divIcon({ className: 'icone-siege', html: '<span>D</span>', iconSize: [26, 26] }),
      zIndexOffset: 1000,
    })
      .bindPopup(`
        <div class="fiche-carte">
          <div class="fiche-titre">${echapper(siege.value.nom)}</div>
          <div class="fiche-code">Siège du district</div>
          <table>
            ${siege.value.adresse ? `<tr><th>Adresse</th><td>${echapper(siege.value.adresse)}</td></tr>` : ''}
            ${siege.value.telephone ? `<tr><th>Téléphone</th><td>${echapper(siege.value.telephone)}</td></tr>` : ''}
          </table>
        </div>`)
      .bindTooltip('Siège du district', { direction: 'top', offset: [0, -12] })
      .addTo(carte)
  } catch {
    // Pas bloquant : la carte s'affiche sans le siège
  }
}

onMounted(async () => {
  // 1. Création de la carte avec le fond OpenStreetMap
  carte = L.map(elementCarte.value, { zoomControl: true }).setView(CENTRE_PAR_DEFAUT, ZOOM_PAR_DEFAUT)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; contributeurs OpenStreetMap',
  }).addTo(carte)
  L.control.scale({ imperial: false }).addTo(carte)
  coucheCentres = L.layerGroup().addTo(carte)

  // 2. Données : centres, types, siège du district
  try {
    await Promise.all([
      store.dispatch('referentiel/charger', { liste: 'centres' }),
      store.dispatch('referentiel/charger', { liste: 'typesCentre' }),
    ])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
  await chargerSiege()
  dessinerCentres()

  // La carte est dans un onglet : on lui fait recalculer sa taille une fois affichée
  await nextTick()
  carte.invalidateSize()
})

// Recherche / filtres modifiés : on redessine les points
watch(centresLocalises, dessinerCentres)

onBeforeUnmount(() => {
  if (carte) carte.remove()
  carte = null
})
</script>

<style scoped>
.cartographie {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  min-height: 600px;
}
@media (max-width: 900px) {
  .cartographie { grid-template-columns: 1fr; }
}

/* ---------- Panneau de gauche ---------- */
.panneau { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.compteurs { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.compteur {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.78rem;
  font-weight: 700;
}
.compteur.orange { background: #fff1e0; color: #b35c00; }

.liste-centres {
  flex: 1;
  max-height: 430px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.liste-centres li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.liste-centres li:last-child { border-bottom: none; }
.liste-centres li:hover { background: #fafcfb; }
.liste-centres li.choisi { background: var(--primary-light); }
.liste-centres li.vide { color: var(--muted); cursor: default; justify-content: center; }
.nom { display: flex; flex-direction: column; min-width: 0; }
.nom strong { font-size: 0.88rem; }
.nom small { font-size: 0.75rem; color: var(--muted); }

.pastille {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.pastille.siege { border-radius: 3px; background: #ea580c; }

.sans-coordonnees {
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: #fff6e5;
  color: #7a4a00;
  font-size: 0.82rem;
}
.sans-coordonnees summary { cursor: pointer; font-weight: 700; }
.sans-coordonnees ul { margin: 0.4rem 0; padding-left: 1.1rem; }
.sans-coordonnees small { color: #9a6a20; }

/* ---------- Carte ---------- */
.zone-carte { position: relative; min-height: 600px; }
.carte {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  border: 1px solid var(--border);
  overflow: hidden;
  z-index: 0; /* la carte reste sous les fenêtres et listes déroulantes de l'application */
}
.legende {
  position: absolute;
  right: 12px;
  bottom: 28px;
  z-index: 500;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  font-size: 0.78rem;
}
.legende-ligne { display: flex; align-items: center; gap: 0.45rem; margin: 0.15rem 0; }
</style>

<!-- Styles NON « scoped » : les bulles et icônes sont créées par Leaflet, hors du composant -->
<style>
.fiche-carte { min-width: 210px; font-family: inherit; }
.fiche-carte .fiche-titre { font-size: 0.95rem; font-weight: 800; color: #007a50; }
.fiche-carte .fiche-code { margin-bottom: 0.4rem; font-family: Consolas, monospace; font-size: 0.75rem; color: #6b7280; }
.fiche-carte table { border-collapse: collapse; font-size: 0.8rem; }
.fiche-carte th { padding: 0.12rem 0.6rem 0.12rem 0; text-align: left; color: #6b7280; font-weight: 600; white-space: nowrap; }
.fiche-carte td { padding: 0.12rem 0; }
.fiche-carte .fiche-gps { margin-top: 0.4rem; font-size: 0.72rem; color: #6b7280; }
.icone-siege span {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 2px solid #fff;
  background: #ea580c;
  color: #fff;
  font-weight: 800;
  font-size: 0.8rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
</style>
