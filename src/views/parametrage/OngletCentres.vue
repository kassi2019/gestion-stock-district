<!--
  =============================================================================
  ONGLET « CENTRES DE SANTÉ »
  =============================================================================
  - Liste des centres avec recherche et option "afficher les inactifs" ;
  - Bouton "Nouveau centre" et "Modifier" : ouvrent un formulaire (fenêtre) ;
  - "Désactiver" / "Réactiver" : un centre n'est jamais supprimé.

  Le formulaire contient :
    - le TYPE de centre (liste gérée dans l'onglet « Types de centres ») ;
    - les COORDONNÉES GPS (latitude / longitude en degrés décimaux),
      avec un lien pour vérifier l'emplacement sur une carte.

  ➜ Ce fichier sert de MODÈLE aux onglets Fournisseurs et Médicaments,
    qui fonctionnent de la même façon.
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input
        v-model="recherche"
        class="recherche"
        type="search"
        placeholder="Rechercher (code, nom, localité)…"
      />
      <div class="filtre">
        <ListeDeroulante v-model="typeFiltre" :options="typesCentre" placeholder="Tous les types" />
      </div>
      <label class="case-a-cocher">
        <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
      </label>
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Liste des centres de santé"
        :sous-titre="sousTitrePdf"
        nom-fichier="centres_sante"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouveau centre</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="nom">Nom</ColonneTri>
            <ColonneTri v-model="tri" cle="type">Type</ColonneTri>
            <ColonneTri v-model="tri" cle="localite">Localité</ColonneTri>
            <ColonneTri v-model="tri" cle="gps">Coordonnées GPS</ColonneTri>
            <ColonneTri v-model="tri" cle="responsable">Responsable</ColonneTri>
            <ColonneTri v-model="tri" cle="telephone">Téléphone</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="centre in lignesPage" :key="centre.id" :class="{ 'ligne-inactive': !centre.actif }">
            <td class="code">{{ centre.code }}</td>
            <td><strong>{{ centre.nom }}</strong></td>
            <td>{{ centre.type?.libelle || '—' }}</td>
            <td>{{ centre.localite || '—' }}</td>
            <td>
              <!-- Lien vers la carte si les coordonnées sont renseignées -->
              <a
                v-if="aDesCoordonnees(centre)"
                :href="lienCarte(centre.latitude, centre.longitude)"
                target="_blank"
                rel="noopener"
                class="lien-carte"
                title="Voir sur la carte"
              >
                📍 {{ Number(centre.latitude).toFixed(4) }}, {{ Number(centre.longitude).toFixed(4) }}
              </a>
              <span v-else>—</span>
            </td>
            <td>{{ centre.responsable || '—' }}</td>
            <td>{{ centre.telephone || '—' }}</td>
            <td>
              <span class="badge" :class="centre.actif ? 'badge-vert' : 'badge-gris'">
                {{ centre.actif ? 'Actif' : 'Inactif' }}
              </span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(centre)">Modifier</button>
              <button v-si-modif
                class="bouton-lien"
                :class="{ danger: centre.actif }"
                @click="changerActif(centre)"
              >
                {{ centre.actif ? 'Désactiver' : 'Réactiver' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="centresAffiches.length" />
      <p v-if="!chargement && centresAffiches.length === 0" class="tableau-vide">
        Aucun centre de santé. Cliquez sur « Nouveau centre » pour en ajouter un.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- Formulaire de création / modification -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier le centre' : 'Nouveau centre de santé'"
      large
      @fermer="formulaire = null"
    >
      <form id="form-centre" class="grille-formulaire" @submit.prevent="enregistrer">
        <!-- ---------- Identification ---------- -->
        <h4 class="section pleine-largeur">Identification</h4>
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. MED-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. CSU-ABO)" />
        </div>
        <div>
          <label>Type de centre</label>
          <ListeDeroulante
            v-model="formulaire.typeId"
            :options="typesCentre"
            :champ-libelle="(t) => `${t.libelle} (${t.code})`"
            placeholder="— Choisir un type —"
          />
          <small v-if="typesCentre.length === 0" class="aide">
            Aucun type : ajoutez-en dans l'onglet « Types de centres ».
          </small>
        </div>
        <div class="pleine-largeur">
          <label class="obligatoire">Nom</label>
          <input v-model.trim="formulaire.nom" required maxlength="150" placeholder="ex. CSU Abobo Avocatier" />
        </div>

        <!-- ---------- Localisation ---------- -->
        <h4 class="section pleine-largeur">Localisation</h4>
        <div>
          <label>Localité</label>
          <input v-model.trim="formulaire.localite" maxlength="100" placeholder="ex. Abobo" />
        </div>
        <div>
          <label>Adresse</label>
          <input v-model.trim="formulaire.adresse" maxlength="255" />
        </div>
        <div>
          <label>Latitude (GPS)</label>
          <input
            v-model="formulaire.latitude"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            placeholder="ex. 5.416700"
          />
        </div>
        <div>
          <label>Longitude (GPS)</label>
          <input
            v-model="formulaire.longitude"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            placeholder="ex. -4.016700"
          />
        </div>
        <p class="aide pleine-largeur">
          Coordonnées en degrés décimaux (en Côte d'Ivoire : latitude entre 4 et 11, longitude négative
          entre -9 et -2).
          <a
            v-if="aDesCoordonnees(formulaire)"
            :href="lienCarte(formulaire.latitude, formulaire.longitude)"
            target="_blank"
            rel="noopener"
          >
            📍 Vérifier l'emplacement sur la carte
          </a>
        </p>

        <!-- ---------- Contact ---------- -->
        <h4 class="section pleine-largeur">Contact</h4>
        <div>
          <label>Responsable</label>
          <input v-model.trim="formulaire.responsable" maxlength="150" />
        </div>
        <div>
          <label>Téléphone</label>
          <input v-model.trim="formulaire.telephone" maxlength="30" />
        </div>
        <div class="pleine-largeur">
          <label>E-mail</label>
          <input v-model.trim="formulaire.email" type="email" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-centre" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { enNombreImport, enTexte, sansChampsVides, trouverParCode } from '@/utils/importFichier'

const store = useStore()

const recherche = ref('')
const typeFiltre = ref(null)
const afficherInactifs = ref(false)
const chargement = ref(false)
const enregistrement = ref(false)

// Formulaire ouvert (null = fermé). Contient une COPIE du centre modifié.
const formulaire = ref(null)

// Listes (dans le store Vuex)
const centres = computed(() => store.state.referentiel.centres)
const typesCentre = computed(() => store.state.referentiel.typesCentre)

/** Liste filtrée selon la recherche, le type et l'option "inactifs". */
const centresAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return centres.value.filter((c) => {
    if (!afficherInactifs.value && !c.actif) return false
    if (typeFiltre.value && c.typeId !== typeFiltre.value) return false
    if (!texte) return true
    return [c.code, c.nom, c.localite].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

/** Vrai si latitude ET longitude sont renseignées. */
function aDesCoordonnees(centre) {
  return centre.latitude !== null && centre.latitude !== '' && centre.latitude !== undefined &&
    centre.longitude !== null && centre.longitude !== '' && centre.longitude !== undefined
}

/** Lien vers OpenStreetMap centré sur les coordonnées. */
function lienCarte(latitude, longitude) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
}

/** Charge (ou recharge) les centres et les types de centres depuis l'API. */
async function charger() {
  chargement.value = true
  try {
    await Promise.all([
      store.dispatch('referentiel/charger', { liste: 'centres' }),
      store.dispatch('referentiel/charger', { liste: 'typesCentre' }),
    ])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

/** Ouvre le formulaire : vide pour une création, pré-rempli pour une modification. */
function ouvrirFormulaire(centre = null) {
  formulaire.value = centre
    ? { ...centre } // copie : on ne modifie pas la liste tant qu'on n'a pas enregistré
    : {
        code: '',
        nom: '',
        typeId: null,
        localite: '',
        adresse: '',
        latitude: '',
        longitude: '',
        responsable: '',
        telephone: '',
        email: '',
      }
}

/** Convertit un champ numérique en nombre (ou vide s'il n'est pas rempli). */
function enNombre(valeur) {
  return valeur === '' || valeur === null || valeur === undefined ? null : Number(valeur)
}

/** Enregistre le formulaire (création ou modification). */
async function enregistrer() {
  const f = formulaire.value

  // Les coordonnées vont par deux : latitude ET longitude, ou aucune
  const latitude = enNombre(f.latitude)
  const longitude = enNombre(f.longitude)
  if ((latitude === null) !== (longitude === null)) {
    store.dispatch('notifications/erreur', 'Renseignez la latitude ET la longitude (ou aucune des deux).')
    return
  }

  enregistrement.value = true
  try {
    // On n'envoie que les champs du formulaire (pas "actif", qui a son propre bouton)
    await store.dispatch('referentiel/enregistrer', {
      liste: 'centres',
      element: {
        id: f.id,
        code: f.code,
        nom: f.nom,
        typeId: f.typeId,
        localite: f.localite,
        adresse: f.adresse,
        latitude,
        longitude,
        responsable: f.responsable,
        telephone: f.telephone,
        email: f.email,
      },
    })
    store.dispatch('notifications/succes', f.id ? 'Centre modifié.' : 'Centre créé.')
    // La fenêtre RESTE OUVERTE (c'est l'utilisateur qui la ferme : × ou Fermer)
    // et les champs sont VIDÉS, prêts pour une nouvelle saisie.
    ouvrirFormulaire()
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Désactive ou réactive un centre (après confirmation). */
async function changerActif(centre) {
  const confirme = await confirmer({
    titre: centre.actif ? 'Désactiver ce centre ?' : 'Réactiver ce centre ?',
    texte: centre.actif
      ? `« ${centre.nom} » n'apparaîtra plus dans les listes de saisie. Son historique est conservé.`
      : `« ${centre.nom} » sera de nouveau disponible dans les listes de saisie.`,
    boutonConfirmer: centre.actif ? 'Oui, désactiver' : 'Oui, réactiver',
    danger: centre.actif,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/changerActif', { liste: 'centres', element: centre, actif: !centre.actif })
    store.dispatch('notifications/succes', centre.actif ? 'Centre désactivé.' : 'Centre réactivé.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// EXPORT PDF ET IMPORT DE FICHIER
// ---------------------------------------------------------------------------

/** Ligne sous le titre du PDF : rappelle les filtres appliqués. */
const sousTitrePdf = computed(() => {
  const type = typesCentre.value.find((t) => t.id === typeFiltre.value)
  return [
    type ? `Type : ${type.libelle}` : 'Tous les types',
    afficherInactifs.value ? 'centres actifs et inactifs' : 'centres actifs',
  ].join(' — ')
})

/** Colonnes du PDF. */
const COLONNES_PDF = [
  { titre: 'Code', valeur: (c) => c.code },
  { titre: 'Nom', valeur: (c) => c.nom },
  { titre: 'Type', valeur: (c) => c.type?.libelle },
  { titre: 'Localité', valeur: (c) => c.localite },
  {
    titre: 'Coordonnées GPS',
    valeur: (c) => (aDesCoordonnees(c) ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : ''),
  },
  { titre: 'Responsable', valeur: (c) => c.responsable },
  { titre: 'Téléphone', valeur: (c) => c.telephone },
  { titre: 'Statut', valeur: (c) => (c.actif ? 'Actif' : 'Inactif') },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  { cle: 'code', titre: 'Code', exemple: 'CSU-ABO', aide: 'Facultatif : code unique du centre. vide = code automatique' },
  { cle: 'nom', titre: 'Nom', obligatoire: true, exemple: 'CSU Abobo Avocatier' },
  { cle: 'type', titre: 'Type', exemple: 'CSU', aide: "Code (ou libellé) d'un type existant dans « Types de centres »" },
  { cle: 'localite', titre: 'Localité', exemple: 'Abobo' },
  { cle: 'adresse', titre: 'Adresse', exemple: '' },
  { cle: 'latitude', titre: 'Latitude', exemple: 5.4167, aide: 'Degrés décimaux (ex. 5.4167)' },
  { cle: 'longitude', titre: 'Longitude', exemple: -4.0167, aide: "Degrés décimaux, négatif en Côte d'Ivoire (ex. -4.0167)" },
  { cle: 'responsable', titre: 'Responsable', exemple: 'Dr Kouassi' },
  { cle: 'telephone', titre: 'Téléphone', exemple: '0102030405' },
  { cle: 'email', titre: 'E-mail', exemple: 'csu.abobo@sante.ci' },
]

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  // Type de centre : retrouvé par son code ou son libellé
  let typeId = null
  const typeTexte = enTexte(valeurs.type)
  if (typeTexte) {
    const type =
      trouverParCode(typesCentre.value, typeTexte) ||
      typesCentre.value.find((t) => t.libelle.toLowerCase() === typeTexte.toLowerCase())
    if (!type) throw new Error(`type « ${typeTexte} » inconnu (à créer d'abord dans « Types de centres »)`)
    typeId = type.id
  }

  const latitude = enNombreImport(valeurs.latitude, 'Latitude')
  const longitude = enNombreImport(valeurs.longitude, 'Longitude')
  if ((latitude === null) !== (longitude === null)) {
    throw new Error('renseignez la latitude ET la longitude (ou aucune des deux)')
  }

  const existant = trouverParCode(centres.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    nom: enTexte(valeurs.nom),
    typeId,
    localite: enTexte(valeurs.localite),
    adresse: enTexte(valeurs.adresse),
    latitude,
    longitude,
    responsable: enTexte(valeurs.responsable),
    telephone: enTexte(valeurs.telephone),
    email: enTexte(valeurs.email),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'centres', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (c) => c.code,
  nom: (c) => c.nom,
  type: (c) => c.type?.libelle,
  localite: (c) => c.localite,
  gps: (c) => (aDesCoordonnees(c) ? Number(c.latitude) : null),
  responsable: (c) => c.responsable,
  telephone: (c) => c.telephone,
  statut: (c) => (c.actif ? 'Actif' : 'Inactif'),
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(centresAffiches, [recherche, typeFiltre, afficherInactifs], VALEURS_TRI)

// Chargement à l'ouverture de l'onglet
onMounted(charger)
</script>

<style scoped>
/* Titres de section dans le formulaire */
.section {
  margin: 0.5rem 0 -0.25rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.section:first-child { margin-top: 0; }
.aide { margin: 0; font-size: 0.8rem; color: var(--muted); }
.aide a { margin-left: 0.4rem; color: var(--primary); font-weight: 600; }
.lien-carte { color: var(--primary); text-decoration: none; font-size: 0.85rem; white-space: nowrap; }
.lien-carte:hover { text-decoration: underline; }
</style>
