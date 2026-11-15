<!--
  =============================================================================
  ONGLET « PERSONNEL »
  =============================================================================
  Fiches du personnel du district et des centres : PHOTO d'identité
  (facultative, affichée aussi pour son compte et en haut de l'écran),
  matricule (obligatoire,
  c'est l'identifiant de connexion), nom et prénoms (obligatoires), fonction
  (liste gérée dans Paramétrage > Fonctions), contacts.
  ➜ Lieu d'affectation : le DISTRICT, affiché en GRISÉ (non modifiable) avec
    ses informations de Paramétrage > Paramètres généraux > « Informations du
    district » (nom, code, région, adresse, responsable, contacts).

  - « Nouvelle personne » : la fiche, et SI ON LE SOUHAITE un compte
    utilisateur en même temps (case « Créer aussi un compte utilisateur » :
    profil, mot de passe). Tout est enregistré en une fois.
    ➜ L'IDENTIFIANT DE CONNEXION est le MATRICULE (champ grisé, non saisi).
  - « Créer un compte » : pour une personne qui n'en a pas encore.
  - « Modifier » : le nom, la fonction et les contacts sont aussi mis à jour
    dans son compte utilisateur.
  - « Désactiver » : la fiche ET son compte (la personne ne peut plus se
    connecter). Une fiche n'est jamais supprimée.

  Propriétés : personnel, roles (chargés par UtilisateursView.vue)
  Événement  : @modifie -> la page recharge les listes
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (matricule, nom, fonction)…" />
      <div class="filtre">
        <ListeDeroulante v-model="compteFiltre" :options="OPTIONS_COMPTE" placeholder="Avec ou sans compte" />
      </div>
      <label class="case-a-cocher">
        <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
      </label>
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Liste du personnel"
        :sous-titre="afficherInactifs ? 'Personnel actif et inactif' : 'Personnel actif'"
        nom-fichier="personnel"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="emit('modifie')"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle personne</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="matricule">Matricule</ColonneTri>
            <ColonneTri v-model="tri" cle="nom">Nom et prénoms</ColonneTri>
            <ColonneTri v-model="tri" cle="fonction">Fonction</ColonneTri>
            <ColonneTri v-model="tri" cle="affectation">Affectation</ColonneTri>
            <th>Contact</th>
            <ColonneTri v-model="tri" cle="compte">Compte utilisateur</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in lignesPage" :key="p.id" :class="{ 'ligne-inactive': !p.actif }">
            <td class="code">{{ p.matricule }}</td>
            <td>
              <div class="personne">
                <Avatar :photo="p.photo" :nom="p.nom" :prenoms="p.prenoms" />
                <strong>{{ p.prenoms }} {{ p.nom }}</strong>
              </div>
            </td>
            <td>{{ p.fonction?.libelle || '—' }}</td>
            <td>{{ p.centre?.nom || nomDistrict }}</td>
            <td class="contact">
              <div v-if="p.telephone">{{ p.telephone }}</div>
              <div v-if="p.email">{{ p.email }}</div>
              <span v-if="!p.telephone && !p.email">—</span>
            </td>
            <td>
              <template v-if="p.comptes.length">
                <span class="code">{{ p.comptes[0].login }}</span>
                <span class="badge" :class="p.comptes[0].role.code === 'ADMIN' ? 'badge-rouge' : 'badge-vert'">
                  {{ p.comptes[0].role.libelle }}
                </span>
                <span v-if="!p.comptes[0].actif" class="badge badge-gris">inactif</span>
              </template>
              <span v-else class="sans-compte">Aucun compte</span>
            </td>
            <td>
              <span class="badge" :class="p.actif ? 'badge-vert' : 'badge-gris'">
                {{ p.actif ? 'Actif' : 'Inactif' }}
              </span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(p)">Modifier</button>
              <button v-if="!p.comptes.length && p.actif" v-si-modif class="bouton-lien" @click="ouvrirFormulaire(p, true)">
                Créer un compte
              </button>
              <button
                v-si-modif
                class="bouton-lien"
                :class="{ danger: p.actif }"
                :disabled="p.comptes[0]?.id === moi.id"
                :title="p.comptes[0]?.id === moi.id ? 'Vous ne pouvez pas désactiver votre propre fiche' : ''"
                @click="changerActif(p)"
              >
                {{ p.actif ? 'Désactiver' : 'Réactiver' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="personnelAffiche.length" />
      <p v-if="personnelAffiche.length === 0" class="tableau-vide">
        Aucun membre du personnel. Cliquez sur « Nouvelle personne » pour en ajouter un.
      </p>
    </div>

    <!-- ===================== FORMULAIRE PERSONNEL (+ COMPTE) ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier la fiche du personnel' : 'Nouvelle personne'"
      large
      @fermer="formulaire = null"
    >
      <form id="form-personnel" class="grille-formulaire" @submit.prevent="enregistrer">
        <!-- ---------- Photo d'identité ---------- -->
        <div class="pleine-largeur bloc-photo">
          <Avatar :photo="formulaire.photo" :nom="formulaire.nom" :prenoms="formulaire.prenoms" :taille="96" />
          <div>
            <strong>Photo d'identité</strong>
            <small class="aide">Facultative. JPEG ou PNG ; elle est recadrée en carré et réduite automatiquement.</small>
            <div class="boutons-photo">
              <label class="bouton-photo">
                <input type="file" accept="image/*" hidden @change="choisirPhoto" />
                {{ formulaire.photo ? 'Changer la photo' : 'Charger une photo' }}
              </label>
              <button v-if="formulaire.photo" type="button" class="bouton-lien danger" @click="formulaire.photo = null">
                Retirer
              </button>
            </div>
          </div>
        </div>

        <!-- ---------- Identité ---------- -->
        <h4 class="section pleine-largeur">Identité</h4>
        <div>
          <label class="obligatoire">Matricule</label>
          <input
            v-model.trim="formulaire.matricule"
            required
            maxlength="30"
            pattern="[a-zA-Z0-9._\-]+"
            title="Le matricule sert d'identifiant de connexion : lettres, chiffres, points, tirets ou soulignés (pas d'espace ni d'accent)"
            placeholder="ex. MAT-1024"
          />
        </div>
        <div>
          <label>Fonction</label>
          <ListeDeroulante v-model="formulaire.fonctionId" :options="fonctions" placeholder="— Choisir une fonction —" />
          <small v-if="fonctions.length === 0" class="aide">
            Aucune fonction : ajoutez-en dans Paramétrage > Fonctions.
          </small>
        </div>
        <div>
          <label class="obligatoire">Nom</label>
          <input v-model.trim="formulaire.nom" required maxlength="100" placeholder="ex. BAMBA" />
        </div>
        <div>
          <label class="obligatoire">Prénoms</label>
          <input v-model.trim="formulaire.prenoms" required maxlength="150" placeholder="ex. Awa Marie" />
        </div>

        <!-- ---------- Affectation ---------- -->
        <h4 class="section pleine-largeur">Affectation</h4>
        <div class="pleine-largeur">
          <label>Lieu d'affectation</label>
          <!-- Grisé : le personnel est affecté au district (Informations du district) -->
          <input :value="nomDistrict" disabled />
        </div>

        <!-- Informations du district (Paramétrage > Paramètres généraux), en lecture seule.
             Affichées seulement si elles sont renseignées. -->
        <div v-if="lignesDistrict.length" class="pleine-largeur carte-affectation">
          <dl>
            <template v-for="[titre, valeur] in lignesDistrict" :key="titre">
              <dt>{{ titre }}</dt>
              <dd>{{ valeur }}</dd>
            </template>
          </dl>
        </div>

        <!-- ---------- Contact ---------- -->
        <h4 class="section pleine-largeur">Contact</h4>
        <div>
          <label>Téléphone</label>
          <input v-model.trim="formulaire.telephone" maxlength="30" />
        </div>
        <div>
          <label>E-mail</label>
          <input v-model.trim="formulaire.email" type="email" maxlength="150" />
        </div>

        <!-- ---------- Compte utilisateur ---------- -->
        <h4 class="section pleine-largeur">Compte utilisateur</h4>
        <!-- La personne a déjà un compte -->
        <div v-if="formulaire.compteExistant" class="pleine-largeur compte-existant">
          <span>
            Compte <strong class="code">{{ formulaire.compteExistant.login }}</strong>
            — profil {{ formulaire.compteExistant.role.libelle }}
          </span>
          <small>
            Profil et mot de passe se gèrent dans l'onglet « Comptes utilisateurs ».
            Si vous changez le matricule, l'identifiant de connexion change aussi.
          </small>
        </div>
        <!-- Pas de compte : on peut en créer un en même temps -->
        <template v-else>
          <div class="pleine-largeur">
            <label class="case-a-cocher case-compte">
              <input v-model="formulaire.creerCompte" type="checkbox" />
              Créer aussi un compte utilisateur (pour se connecter à l'application)
            </label>
          </div>
          <template v-if="formulaire.creerCompte">
            <div>
              <label>Identifiant de connexion</label>
              <!-- Identifiant = MATRICULE : grisé, non modifiable -->
              <input :value="formulaire.matricule || '— saisir le matricule —'" disabled />
              <small class="aide">C'est le matricule de la personne.</small>
            </div>
            <div>
              <label class="obligatoire">Profil</label>
              <ListeDeroulante v-model="formulaire.roleId" :options="rolesProposes" obligatoire :effacable="false" />
              <small v-if="profilChoisi" class="aide">{{ profilChoisi.description }}</small>
            </div>
            <div>
              <label class="obligatoire">Mot de passe</label>
              <ChampMotDePasse v-model="formulaire.motDePasse" obligatoire placeholder="8 caractères, lettres et chiffres" />
            </div>
            <div>
              <label class="obligatoire">Confirmation</label>
              <ChampMotDePasse v-model="formulaire.confirmation" obligatoire placeholder="Retapez le mot de passe" />
            </div>
            <p class="aide pleine-largeur">
              Au moins 8 caractères, dont au moins une lettre et un chiffre. La personne pourra le changer
              elle-même (bouton « Mon mot de passe »).
            </p>
          </template>
        </template>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-personnel" :disabled="enregistrement">
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
import ChampMotDePasse from '@/components/ChampMotDePasse.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import Avatar from '@/components/Avatar.vue'
import { preparerPhoto } from '@/utils/photo'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { enTexte, sansChampsVides, trouverParCode } from '@/utils/importFichier'
import { listerParametres } from '@/api/parametrage'
import {
  creerComptePersonnel,
  creerPersonnel,
  modifierPersonnel,
  verifierMotDePasse,
} from '@/api/utilisateurs'

const props = defineProps({
  personnel: { type: Array, required: true },
  roles: { type: Array, required: true },
})
const emit = defineEmits(['modifie'])

const store = useStore()
const moi = computed(() => store.state.auth.user || {})

/** Filtre « avec / sans compte ». */
const OPTIONS_COMPTE = [
  { id: 'AVEC', libelle: 'Avec un compte' },
  { id: 'SANS', libelle: 'Sans compte' },
]

const recherche = ref('')
const compteFiltre = ref(null)
const afficherInactifs = ref(false)
const enregistrement = ref(false)
const formulaire = ref(null)

// ---------------------------------------------------------------------------
// INFORMATIONS DU DISTRICT (Paramétrage > Paramètres généraux)
// ---------------------------------------------------------------------------
const district = ref({}) // { NOM_DISTRICT: '...', DISTRICT_CODE: '...', ... }

/** Nom du district (« District sanitaire » s'il n'est pas renseigné). */
const nomDistrict = computed(() => district.value.NOM_DISTRICT || 'District sanitaire')

/** Informations du district affichées sous « Lieu d'affectation » (seulement celles remplies). */
const lignesDistrict = computed(() => {
  const d = district.value
  return [
    ['Code', d.DISTRICT_CODE],
    ['Région sanitaire', d.DISTRICT_REGION],
    ['Adresse', [d.DISTRICT_ADRESSE, d.DISTRICT_LOCALITE].filter(Boolean).join(', ')],
    ['Responsable', d.DISTRICT_RESPONSABLE],
    ['Téléphone', d.DISTRICT_TELEPHONE],
    ['E-mail', d.DISTRICT_EMAIL],
  ].filter(([, valeur]) => valeur)
})

/** Lit les informations du district (paramètres généraux). */
async function chargerDistrict() {
  try {
    const parametres = await listerParametres()
    district.value = Object.fromEntries(parametres.map((p) => [p.cle, (p.valeur || '').trim()]))
  } catch {
    // Pas bloquant : « District sanitaire » est affiché par défaut
  }
}

// Fonctions (Paramétrage > Fonctions)
const fonctions = computed(() => store.state.referentiel.fonctions)


/** Liste filtrée (recherche + compte + inactifs). */
const personnelAffiche = computed(() => {
  const texte = recherche.value.toLowerCase()
  return props.personnel.filter((p) => {
    if (!afficherInactifs.value && !p.actif) return false
    if (compteFiltre.value === 'AVEC' && p.comptes.length === 0) return false
    if (compteFiltre.value === 'SANS' && p.comptes.length > 0) return false
    if (!texte) return true
    return [p.matricule, p.nom, p.prenoms, p.fonction?.libelle].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

/** Profil Administrateur proposé seulement à un administrateur. */
const rolesProposes = computed(() => props.roles.filter((r) => r.code !== 'ADMIN' || moi.value.role === 'ADMIN'))
const profilChoisi = computed(() => props.roles.find((r) => r.id === formulaire.value?.roleId))

/**
 * Ouvre le formulaire.
 * @param personne    fiche à modifier (null = nouvelle personne)
 * @param avecCompte  true = case « Créer aussi un compte » déjà cochée
 */
function ouvrirFormulaire(personne = null, avecCompte = false) {
  const base = personne
    ? {
        id: personne.id,
        matricule: personne.matricule,
        nom: personne.nom,
        prenoms: personne.prenoms || '',
        fonctionId: personne.fonctionId,
        telephone: personne.telephone || '',
        email: personne.email || '',
        photo: personne.photo || null,
        compteExistant: personne.comptes[0] || null,
      }
    : { matricule: '', nom: '', prenoms: '', fonctionId: null, telephone: '', email: '', photo: null, compteExistant: null }
  formulaire.value = { ...base, creerCompte: avecCompte, roleId: null, motDePasse: '', confirmation: '' }
}

/** Photo choisie : recadrée en carré, réduite (256 px), puis affichée dans le formulaire. */
async function choisirPhoto(evenement) {
  const fichier = evenement.target.files[0]
  evenement.target.value = '' // permet de re-choisir le même fichier
  if (!fichier) return
  try {
    formulaire.value.photo = await preparerPhoto(fichier)
  } catch (erreur) {
    store.dispatch('notifications/erreur', erreur.message)
  }
}

/** Remplace les textes vides par null (le backend efface alors la valeur). */
function videEnNull(valeur) {
  return valeur === '' ? null : valeur
}

async function enregistrer() {
  const f = formulaire.value

  // Contrôles du compte avant l'envoi
  if (f.creerCompte) {
    if (!f.roleId) {
      store.dispatch('notifications/erreur', 'Choisissez le profil du compte.')
      return
    }
    const erreurMdp = verifierMotDePasse(f.motDePasse, f.confirmation)
    if (erreurMdp) {
      store.dispatch('notifications/erreur', erreurMdp)
      return
    }
  }
  // Pas d'identifiant à envoyer : c'est le matricule (choisi par le serveur)
  const compte = f.creerCompte ? { roleId: f.roleId, motDePasse: f.motDePasse } : undefined

  enregistrement.value = true
  try {
    const fiche = {
      matricule: f.matricule,
      nom: f.nom,
      prenoms: f.prenoms,
      fonctionId: f.fonctionId,
      telephone: f.telephone,
      email: f.email,
      photo: f.photo, // null = pas de photo (ou photo retirée)
    }
    if (f.id) {
      // Modification (les champs vidés sont effacés), puis compte éventuel
      await modifierPersonnel(f.id, Object.fromEntries(Object.entries(fiche).map(([k, v]) => [k, videEnNull(v)])))
      if (compte) await creerComptePersonnel(f.id, compte)
    } else {
      // Création : fiche + compte en une seule fois (les champs vides ne sont pas envoyés)
      await creerPersonnel({ ...sansChampsVides(fiche), ...(compte ? { compte } : {}) })
    }
    store.dispatch(
      'notifications/succes',
      compte ? 'Fiche et compte utilisateur enregistrés.' : f.id ? 'Fiche modifiée.' : 'Personne ajoutée.',
    )
    // La fenêtre reste ouverte et les champs sont vidés pour une nouvelle saisie
    ouvrirFormulaire()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function changerActif(personne) {
  const nom = `${personne.prenoms || ''} ${personne.nom}`.trim()
  const aUnCompte = personne.comptes.length > 0
  const confirme = await confirmer({
    titre: personne.actif ? 'Désactiver cette personne ?' : 'Réactiver cette personne ?',
    texte: personne.actif
      ? `« ${nom} » n'apparaîtra plus dans les listes.${aUnCompte ? ' Son compte utilisateur est aussi désactivé : elle ne pourra plus se connecter.' : ''}`
      : `« ${nom} » sera de nouveau active.${aUnCompte ? ' Son compte utilisateur est aussi réactivé.' : ''}`,
    boutonConfirmer: personne.actif ? 'Oui, désactiver' : 'Oui, réactiver',
    danger: personne.actif,
  })
  if (!confirme) return
  try {
    await modifierPersonnel(personne.id, { actif: !personne.actif })
    store.dispatch('notifications/succes', personne.actif ? 'Personne désactivée.' : 'Personne réactivée.')
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination, PDF et import
// ---------------------------------------------------------------------------

const VALEURS_TRI = {
  matricule: (p) => p.matricule,
  nom: (p) => `${p.nom} ${p.prenoms || ''}`,
  fonction: (p) => p.fonction?.libelle,
  affectation: (p) => p.centre?.nom || nomDistrict.value,
  compte: (p) => p.comptes[0]?.login,
  statut: (p) => (p.actif ? 'Actif' : 'Inactif'),
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(
  personnelAffiche,
  [recherche, compteFiltre, afficherInactifs],
  VALEURS_TRI,
)

const COLONNES_PDF = [
  { titre: 'Matricule', valeur: (p) => p.matricule },
  { titre: 'Nom et prénoms', valeur: (p) => `${p.nom} ${p.prenoms || ''}`.trim() },
  { titre: 'Fonction', valeur: (p) => p.fonction?.libelle },
  { titre: 'Affectation', valeur: (p) => p.centre?.nom || nomDistrict.value },
  { titre: 'Téléphone', valeur: (p) => p.telephone },
  { titre: 'E-mail', valeur: (p) => p.email },
  { titre: 'Compte', valeur: (p) => (p.comptes[0] ? `${p.comptes[0].login} (${p.comptes[0].role.libelle})` : 'Aucun') },
  { titre: 'Statut', valeur: (p) => (p.actif ? 'Actif' : 'Inactif') },
]

/** Colonnes du fichier d'import (les comptes se créent ensuite dans l'application). */
const COLONNES_IMPORT = [
  { cle: 'matricule', titre: 'Matricule', obligatoire: true, exemple: 'MAT-1024', aide: "Unique, sans espace (sert d'identifiant de connexion). S'il existe déjà, la fiche est mise à jour" },
  { cle: 'nom', titre: 'Nom', obligatoire: true, exemple: 'BAMBA' },
  { cle: 'prenoms', titre: 'Prénoms', obligatoire: true, exemple: 'Awa Marie' },
  { cle: 'fonction', titre: 'Fonction', exemple: 'Pharmacien', aide: "Code ou libellé d'une fonction (créée automatiquement si elle n'existe pas)" },
  { cle: 'telephone', titre: 'Téléphone', exemple: '0102030405' },
  { cle: 'email', titre: 'E-mail', exemple: 'a.bamba@sante.ci' },
]

/** Enregistre UNE ligne : mise à jour si le matricule existe, sinon création. */
async function importerLigne(valeurs) {
  // Fonction : retrouvée par code ou libellé, créée si elle n'existe pas
  let fonctionId = null
  const fonctionTexte = enTexte(valeurs.fonction)
  if (fonctionTexte) {
    const trouvee =
      trouverParCode(fonctions.value, fonctionTexte) ||
      fonctions.value.find((f) => f.libelle.toLowerCase() === fonctionTexte.toLowerCase())
    if (trouvee) fonctionId = trouvee.id
    else {
      const creee = await store.dispatch('referentiel/enregistrer', { liste: 'fonctions', element: { libelle: fonctionTexte } })
      await store.dispatch('referentiel/charger', { liste: 'fonctions' })
      fonctionId = creee.id
    }
  }

  const matricule = enTexte(valeurs.matricule)
  const existant = props.personnel.find((p) => p.matricule.toLowerCase() === matricule.toLowerCase())
  const fiche = sansChampsVides({
    matricule,
    nom: enTexte(valeurs.nom),
    prenoms: enTexte(valeurs.prenoms),
    fonctionId,
    telephone: enTexte(valeurs.telephone),
    email: enTexte(valeurs.email),
  })
  if (existant) await modifierPersonnel(existant.id, fiche)
  else await creerPersonnel(fiche)
  return existant ? 'modifie' : 'cree'
}

// Fonctions (liste déroulante) et informations du district (lieu d'affectation)
onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'fonctions' }).catch(() => {})
  chargerDistrict()
})
</script>

<style scoped>
.contact { font-size: 0.85rem; }
.sans-compte { font-size: 0.82rem; color: var(--muted); font-style: italic; }
td .code + .badge { margin-left: 0.4rem; }
.case-compte { font-weight: 600; }

/* Photo d'identité dans le formulaire */
.bloc-photo { display: flex; align-items: center; gap: 1.1rem; }
.bloc-photo strong { color: var(--texte-sur-fond); }
.boutons-photo { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.45rem; }
.bouton-photo {
  display: inline-block;
  margin: 0;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1.5px solid var(--primary);
  background: #fff;
  color: var(--primary-dark);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.bouton-photo:hover { background: var(--primary-light); }
.compte-existant {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--primary-light);
  color: var(--primary-dark);
}
.compte-existant small { color: var(--muted); }

/* Fiche du lieu d'affectation (district ou centre) */
.carte-affectation {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border-left: 4px solid var(--primary);
  background: var(--fond-pale);
}
.carte-affectation strong { color: var(--primary-dark); }
.type-affectation {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.72rem;
  font-weight: 700;
}
.carte-affectation dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.15rem 0.9rem;
  margin: 0.5rem 0 0;
  font-size: 0.83rem;
}
.carte-affectation dt { color: var(--muted); }
.carte-affectation dd { margin: 0; }
</style>
