<!--
  =============================================================================
  CHAMP DATE « JJ/MM/AAAA » AVEC SÉLECTEUR RAPIDE (année → mois → jour)
  =============================================================================
  Utilisé pour TOUTES les dates de l'application, à la place du calendrier
  du navigateur (même présentation que l'application de gestion clinique) :
    - on peut TAPER la date : 18112026 devient 18/11/2026 (les « / » se
      mettent tout seuls ; année sur 2 chiffres complétée en 20xx) ;
    - ou cliquer sur l'icône calendrier : un panneau s'ouvre avec
        ANNÉE : décennies (2020–29...) puis les 10 années de la décennie,
        MOIS  : Janv. à Déc.,
        JOUR  : grille du mois (semaine du lundi au dimanche),
        et les boutons « Aujourd'hui », « Effacer », « Fermer ».
      Choisir une année ou un mois change l'affichage (et la date si elle
      est déjà remplie) ; choisir un JOUR enregistre la date et ferme.

  Utilisation :
      <ChampDate v-model="formulaire.dateReception" obligatoire />
      <ChampDate v-model="filtres.du" title="Du" />
      <ChampDate v-model="ligne.datePeremption" :obligatoire="suiviLot" :desactive="lectureSeule" />
      <ChampDate v-model="formulaire.datePaiement" :max="dateDuJour()" @change="actualiser" />

  Options :
      obligatoire   la date doit être remplie (formulaire)
      desactive     champ grisé (lecture seule)
      min / max     date la plus ancienne / la plus récente acceptée (AAAA-MM-JJ) ;
                    les jours hors limites sont grisés dans le panneau
      @change       appelé quand la date change (date complète, ou champ vidé)

  - La valeur (v-model) est au même format qu'un <input type="date"> :
    « AAAA-MM-JJ », ou '' si le champ est vide.
  - Date incomplète, impossible (31/02) ou hors min / max : bordure rouge,
    le navigateur refuse l'envoi du formulaire avec un message, et la
    valeur renvoyée est ''.
  - Le panneau est affiché par-dessus tout (Teleport dans <body>) pour ne pas
    être coupé par une fenêtre modale ou un tableau qui défile.
  =============================================================================
-->
<template>
  <div ref="racine" class="champ-date" :class="{ invalide: messageErreur, desactive }">
    <input
      ref="champ"
      :value="texte"
      type="text"
      inputmode="numeric"
      maxlength="10"
      placeholder="jj/mm/aaaa"
      autocomplete="off"
      :required="obligatoire"
      :disabled="desactive"
      @input="saisie"
      @blur="finSaisie"
      @keydown.down.prevent="ouvrir"
      @keydown.esc="fermer"
    />
    <button
      v-if="!desactive"
      type="button"
      class="bouton-calendrier"
      title="Choisir dans le calendrier"
      tabindex="-1"
      @click="ouvert ? fermer() : ouvrir()"
    >
      <!-- Icône calendrier -->
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="8" cy="14" r="1.1" fill="currentColor" /><circle cx="12" cy="14" r="1.1" fill="currentColor" />
        <circle cx="16" cy="14" r="1.1" fill="currentColor" /><circle cx="8" cy="17.5" r="1.1" fill="currentColor" />
        <circle cx="12" cy="17.5" r="1.1" fill="currentColor" />
      </svg>
    </button>

    <!-- ===================== PANNEAU DE SÉLECTION ===================== -->
    <Teleport to="body">
      <div v-if="ouvert" ref="panneau" class="panneau-date" :style="position" @mousedown.prevent>
        <!-- ANNÉE -->
        <div class="titre-section">Année</div>
        <div class="grille decennies">
          <button
            v-for="d in decennies"
            :key="d"
            type="button"
            :class="{ choisi: d === decennieAffichee }"
            @click="decennieAffichee = d"
          >{{ d }}–{{ String(d + 9).slice(-2) }}</button>
        </div>
        <div class="grille annees">
          <button
            v-for="a in anneesDecennie"
            :key="a"
            type="button"
            :class="{ choisi: a === anneeAffichee, horsLimite: anneeHorsLimite(a) }"
            :disabled="anneeHorsLimite(a)"
            @click="choisirAnnee(a)"
          >{{ a }}</button>
        </div>

        <!-- MOIS -->
        <div class="titre-section">Mois</div>
        <div class="grille mois">
          <button
            v-for="(nom, index) in MOIS_COURTS"
            :key="nom"
            type="button"
            :class="{ choisi: index === moisAffiche }"
            :disabled="moisHorsLimite(index)"
            @click="choisirMois(index)"
          >{{ nom }}</button>
        </div>

        <!-- JOUR -->
        <div class="titre-section">Jour <small>{{ MOIS_LONGS[moisAffiche] }} {{ anneeAffichee }}</small></div>
        <div class="grille jours">
          <span v-for="j in JOURS_SEMAINE" :key="j.cle" class="entete-jour">{{ j.lettre }}</span>
          <span v-for="n in decalagePremierJour" :key="'vide' + n"></span>
          <button
            v-for="j in joursDuMois"
            :key="j"
            type="button"
            :class="{ choisi: dateIso(anneeAffichee, moisAffiche, j) === modelValue, aujourdhui: dateIso(anneeAffichee, moisAffiche, j) === aujourdhui }"
            :disabled="horsLimite(dateIso(anneeAffichee, moisAffiche, j))"
            @click="choisirJour(j)"
          >{{ j }}</button>
        </div>

        <!-- Boutons du bas -->
        <div class="pied">
          <button type="button" class="lien" :disabled="horsLimite(aujourdhui)" @click="choisirAujourdhui">Aujourd'hui</button>
          <button type="button" class="lien" @click="effacer">Effacer</button>
          <button type="button" class="lien gris" @click="fermer">Fermer</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formaterDate } from '@/utils/format'

const props = defineProps({
  /** Date au format AAAA-MM-JJ, ou '' */
  modelValue: { type: String, default: '' },
  obligatoire: { type: Boolean, default: false },
  desactive: { type: Boolean, default: false },
  /** Date la plus ancienne acceptée (AAAA-MM-JJ) */
  min: { type: String, default: '' },
  /** Date la plus récente acceptée (AAAA-MM-JJ), ex. dateDuJour() */
  max: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((lettre, i) => ({ lettre, cle: i }))

const racine = ref(null)
const champ = ref(null)
const panneau = ref(null)

/** Texte affiché dans le champ (JJ/MM/AAAA) */
const texte = ref('')
const messageErreur = ref('')

// ---------------------------------------------------------------------------
// OUTILS DE DATE
// ---------------------------------------------------------------------------

/** « AAAA-MM-JJ » à partir de l'année, du mois (0 à 11) et du jour. */
function dateIso(annee, mois, jour) {
  return `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/** Date du jour au format AAAA-MM-JJ. */
const aujourdhui = (() => {
  const d = new Date()
  return dateIso(d.getFullYear(), d.getMonth(), d.getDate())
})()

/**
 * Vrai si la date (AAAA-MM-JJ) est en dehors de min / max.
 * ⚠ Toujours renvoyer true/false (avec !!) : un texte vide '' passé à
 * :disabled DÉSACTIVE le bouton pour Vue (tout le calendrier était grisé).
 */
function horsLimite(iso) {
  return !!((props.min && iso < props.min) || (props.max && iso > props.max))
}

/** « 18/11/2026 » -> « 2026-11-18 » si la date existe vraiment, sinon ''. */
function texteVersIso(valeur) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valeur || '')
  if (!m) return ''
  const [jour, mois, annee] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(annee, mois - 1, jour)
  // new Date(2028, 1, 31) donne le 2 mars : on vérifie que la date n'a pas « glissé »
  if (d.getFullYear() !== annee || d.getMonth() !== mois - 1 || d.getDate() !== jour) return ''
  return dateIso(annee, mois - 1, jour)
}

/** « 2026-11-18 » -> « 18/11/2026 ». */
function isoVersTexte(iso) {
  return iso ? `${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}` : ''
}

// ---------------------------------------------------------------------------
// SAISIE AU CLAVIER
// ---------------------------------------------------------------------------

/** Valeur reçue du parent (ouverture d'un formulaire, bouton « période »...) -> texte affiché. */
watch(
  () => props.modelValue,
  (valeur) => {
    const iso = valeur && /^\d{4}-\d{2}-\d{2}/.test(valeur) ? valeur.substring(0, 10) : ''
    // Pas de changement si le texte correspond déjà (évite d'effacer une saisie en cours)
    if (iso === texteVersIso(texte.value)) return
    if (iso || !messageErreur.value) {
      texte.value = isoVersTexte(iso)
      verifier()
    }
  },
  { immediate: true },
)

// min / max peuvent changer : on revérifie
watch(() => [props.min, props.max], () => verifier())

/** Après chaque frappe : chiffres seulement, « / » ajoutés automatiquement. */
function saisie(evenement) {
  const chiffres = evenement.target.value.replace(/\D/g, '').slice(0, 8)
  let formate = chiffres.slice(0, 2)
  if (chiffres.length > 2) formate += '/' + chiffres.slice(2, 4)
  if (chiffres.length > 4) formate += '/' + chiffres.slice(4)
  texte.value = formate
  evenement.target.value = formate // une lettre tapée disparaît tout de suite
  publier()
}

/** En quittant le champ : année sur 2 chiffres complétée (18/11/26 -> 18/11/2026). */
function finSaisie() {
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(texte.value)) {
    texte.value = texte.value.slice(0, 6) + '20' + texte.value.slice(6)
    publier()
  }
}

/**
 * Contrôle de la date (complète, réelle, entre min et max) : message affiché
 * et signalé au navigateur (refus du formulaire). Renvoie la date valide, ou ''.
 */
function verifier() {
  const iso = texteVersIso(texte.value)
  let message = ''
  if (texte.value && !iso) message = 'Date incomplète ou invalide (jj/mm/aaaa).'
  else if (iso && props.min && iso < props.min) message = `La date doit être au plus tôt le ${formaterDate(props.min)}.`
  else if (iso && props.max && iso > props.max) message = `La date doit être au plus tard le ${formaterDate(props.max)}.`
  messageErreur.value = message
  champ.value?.setCustomValidity(message)
  return message ? '' : iso
}

/** Envoie la valeur au parent (et « change » si elle a changé). */
function publier() {
  const iso = verifier()
  if (iso !== (props.modelValue || '')) {
    emit('update:modelValue', iso)
    emit('change', iso)
  }
}

/** Date choisie dans le panneau : affichée et envoyée au parent. */
function definir(iso) {
  texte.value = isoVersTexte(iso)
  publier()
}

// ---------------------------------------------------------------------------
// PANNEAU (année -> mois -> jour)
// ---------------------------------------------------------------------------
const ouvert = ref(false)
const anneeAffichee = ref(new Date().getFullYear())
const moisAffiche = ref(new Date().getMonth()) // 0 = janvier
const decennieAffichee = ref(Math.floor(anneeAffichee.value / 10) * 10)
const position = ref({})

/** 4 décennies proposées autour de celle affichée (ex. 2010–19 à 2040–49). */
const decennies = computed(() => [-1, 0, 1, 2].map((i) => decennieAffichee.value + i * 10))
const anneesDecennie = computed(() => Array.from({ length: 10 }, (_, i) => decennieAffichee.value + i))
const joursDuMois = computed(() => new Date(anneeAffichee.value, moisAffiche.value + 1, 0).getDate())
/** Cases vides avant le 1er du mois (la semaine commence le lundi). */
const decalagePremierJour = computed(() => (new Date(anneeAffichee.value, moisAffiche.value, 1).getDay() + 6) % 7)

/** Année entièrement hors de min / max (true/false, voir horsLimite). */
function anneeHorsLimite(a) {
  return !!((props.min && `${a}-12-31` < props.min) || (props.max && `${a}-01-01` > props.max))
}
/** Mois (de l'année affichée) entièrement hors de min / max (true/false). */
function moisHorsLimite(m) {
  const dernier = new Date(anneeAffichee.value, m + 1, 0).getDate()
  return !!((props.min && dateIso(anneeAffichee.value, m, dernier) < props.min) || (props.max && dateIso(anneeAffichee.value, m, 1) > props.max))
}

async function ouvrir() {
  if (props.desactive) return
  // Le panneau s'ouvre sur la date saisie, sinon sur aujourd'hui
  const depart = props.modelValue || aujourdhui
  anneeAffichee.value = Number(depart.substring(0, 4))
  moisAffiche.value = Number(depart.substring(5, 7)) - 1
  decennieAffichee.value = Math.floor(anneeAffichee.value / 10) * 10
  ouvert.value = true
  await nextTick()
  placer()
}

function fermer() {
  ouvert.value = false
}

/**
 * Change l'année ou le mois affiché. Si une date est déjà choisie, elle suit
 * (le jour est ramené au dernier jour du mois si besoin : 31 -> 30).
 */
function deplacer(annee, mois) {
  anneeAffichee.value = annee
  moisAffiche.value = mois
  if (props.modelValue) {
    const jour = Math.min(Number(props.modelValue.substring(8, 10)), new Date(annee, mois + 1, 0).getDate())
    const iso = dateIso(annee, mois, jour)
    if (!horsLimite(iso)) definir(iso)
  }
}
function choisirAnnee(a) {
  deplacer(a, moisAffiche.value)
}
function choisirMois(m) {
  deplacer(anneeAffichee.value, m)
}
function choisirJour(j) {
  definir(dateIso(anneeAffichee.value, moisAffiche.value, j))
  fermer()
}
function choisirAujourdhui() {
  definir(aujourdhui)
  fermer()
}
function effacer() {
  definir('')
  fermer()
}

/**
 * Place le panneau sous le champ (ou au-dessus s'il n'y a pas la place),
 * sans dépasser de l'écran.
 */
function placer() {
  if (!ouvert.value || !racine.value || !panneau.value) return
  const champRect = racine.value.getBoundingClientRect()
  const hauteur = panneau.value.offsetHeight
  const largeur = panneau.value.offsetWidth
  let haut = champRect.bottom + 4
  if (haut + hauteur > window.innerHeight - 8) {
    // Pas la place en dessous : au-dessus si possible, sinon calé en bas de l'écran
    haut = champRect.top - hauteur - 4 >= 8 ? champRect.top - hauteur - 4 : Math.max(8, window.innerHeight - hauteur - 8)
  }
  const gauche = Math.max(8, Math.min(champRect.left, window.innerWidth - largeur - 8))
  position.value = { top: `${haut}px`, left: `${gauche}px` }
}

/** Clic en dehors du champ et du panneau : on ferme. */
function clicDehors(evenement) {
  if (!ouvert.value) return
  if (racine.value?.contains(evenement.target) || panneau.value?.contains(evenement.target)) return
  fermer()
}

onMounted(() => {
  verifier()
  document.addEventListener('mousedown', clicDehors)
  window.addEventListener('resize', placer)
  window.addEventListener('scroll', placer, true) // true : aussi le défilement des fenêtres modales
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', clicDehors)
  window.removeEventListener('resize', placer)
  window.removeEventListener('scroll', placer, true)
})
</script>

<style scoped>
/* ---------- Champ ---------- */
.champ-date { position: relative; display: inline-block; width: 100%; min-width: 135px; max-width: 165px; vertical-align: middle; }
.champ-date input { width: 100%; padding-right: 2.1rem; }
.bouton-calendrier {
  position: absolute;
  top: 50%;
  right: 0.3rem;
  transform: translateY(-50%);
  display: flex;
  padding: 0.2rem;
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
}
.bouton-calendrier:hover { color: var(--primary-dark); background: none; }
.invalide input { border-color: #c0392b; }

/* ---------- Panneau ---------- */
.panneau-date {
  position: fixed;
  z-index: 3000; /* au-dessus des fenêtres modales */
  width: 336px;
  padding: 0.75rem 0.8rem 0.6rem;
  background: #fff;
  border: 1.5px solid var(--primary);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 61, 42, 0.18);
  font-size: 0.85rem;
  color: var(--text);
}
.titre-section {
  margin: 0.55rem 0 0.4rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-dark);
}
.titre-section:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.titre-section small { margin-left: 0.4rem; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--muted); }

.grille { display: grid; gap: 0.3rem; }
.decennies { grid-template-columns: repeat(4, 1fr); margin-bottom: 0.3rem; }
.annees { grid-template-columns: repeat(5, 1fr); }
.mois { grid-template-columns: repeat(6, 1fr); }
.jours { grid-template-columns: repeat(7, 1fr); }

.grille button {
  padding: 0.38rem 0;
  background: #f6fbf8;
  border: 1px solid #dbe9e1;
  border-radius: 7px;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}
.grille button:hover:not(:disabled) { background: var(--primary-light); border-color: var(--primary); }
.grille button:disabled { opacity: 0.35; cursor: not-allowed; }
.decennies button { font-size: 0.78rem; }
.decennies button.choisi { background: var(--primary-light); border-color: var(--primary); color: var(--primary-dark); font-weight: 700; }
.annees button.choisi,
.mois button.choisi,
.jours button.choisi,
.grille button.choisi:hover:not(:disabled) { background: var(--primary-dark); border-color: var(--primary-dark); color: #fff; font-weight: 700; }
.decennies button.choisi:hover:not(:disabled) { background: var(--primary-light); color: var(--primary-dark); }
.jours button.aujourdhui:not(.choisi) { border-color: var(--primary); color: var(--primary-dark); font-weight: 700; }
.entete-jour { text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--muted); }

.pied { display: flex; justify-content: flex-end; gap: 0.9rem; margin-top: 0.7rem; }
.pied .lien { padding: 0; background: none; border: none; color: var(--primary-dark); font-weight: 700; font-size: 0.82rem; cursor: pointer; }
.pied .lien:hover:not(:disabled) { text-decoration: underline; background: none; }
.pied .lien:disabled { opacity: 0.4; cursor: not-allowed; }
.pied .lien.gris { color: var(--muted); }
</style>
