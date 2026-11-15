<!--
  =============================================================================
  ONGLET « COMPTES UTILISATEURS »
  =============================================================================
  - Liste des comptes (recherche, filtre par profil, inactifs, tri, pagination, PDF) ;
  - « Nouveau compte » : pour un membre du PERSONNEL qui n'a pas encore de
    compte (son nom, sa fonction et ses contacts viennent de sa fiche) ;
  - « Modifier » : profil (l'identité se modifie dans l'onglet Personnel) ;
  - L'IDENTIFIANT DE CONNEXION est le MATRICULE de la personne (grisé) ;
  - « Mot de passe » : réinitialisation ; « Désactiver » / « Réactiver ».
  Règles (vérifiées aussi par le backend) :
    - mot de passe : 8 caractères minimum, au moins une lettre et un chiffre ;
    - on ne peut pas désactiver son propre compte ;
    - il doit toujours rester au moins un administrateur actif ;
    - seul un administrateur peut donner le profil Administrateur.

  Propriétés : comptes, personnel, roles (chargés par UtilisateursView.vue)
  Événement  : @modifie -> la page recharge les listes
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (nom, identifiant, fonction)…" />
      <div class="filtre">
        <ListeDeroulante v-model="profilFiltre" :options="roles" placeholder="Tous les profils" />
      </div>
      <label class="case-a-cocher">
        <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
      </label>
      <span class="espace"></span>
      <!-- Bouton « PDF » (liste des comptes, dans l'ordre du tri) -->
      <ImportExportTableau
        titre="Liste des comptes utilisateurs"
        :sous-titre="afficherInactifs ? 'Comptes actifs et inactifs' : 'Comptes actifs'"
        nom-fichier="comptes_utilisateurs"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouveau compte</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="utilisateur">Utilisateur</ColonneTri>
            <ColonneTri v-model="tri" cle="fonction">Fonction</ColonneTri>
            <ColonneTri v-model="tri" cle="profil">Profil</ColonneTri>
            <th>Contact</th>
            <ColonneTri v-model="tri" cle="connexion">Dernière connexion</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in lignesPage" :key="u.id" :class="{ 'ligne-inactive': !u.actif }">
            <td>
              <div class="personne">
                <Avatar :photo="u.personnel?.photo" :nom="u.nom" :prenoms="u.prenoms" />
                <div>
                  <strong>{{ u.prenoms }} {{ u.nom }}</strong>
                  <span v-if="u.id === moi.id" class="badge badge-vert vous">vous</span>
                  <div class="code">{{ u.login }}</div>
                </div>
              </div>
            </td>
            <td>{{ u.fonction || '—' }}</td>
            <td>
              <span class="badge" :class="u.role.code === 'ADMIN' ? 'badge-rouge' : 'badge-vert'">
                {{ u.role.libelle }}
              </span>
            </td>
            <td class="contact">
              <div v-if="u.telephone">{{ u.telephone }}</div>
              <div v-if="u.email">{{ u.email }}</div>
              <span v-if="!u.telephone && !u.email">—</span>
            </td>
            <td>{{ u.derniereConnexion ? formaterDateHeure(u.derniereConnexion) : 'Jamais' }}</td>
            <td>
              <span class="badge" :class="u.actif ? 'badge-vert' : 'badge-gris'">
                {{ u.actif ? 'Actif' : 'Inactif' }}
              </span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(u)">Modifier</button>
              <button v-si-modif class="bouton-lien" @click="ouvrirReinitialisation(u)">Mot de passe</button>
              <button
                v-si-modif
                class="bouton-lien"
                :class="{ danger: u.actif }"
                :disabled="u.id === moi.id"
                :title="u.id === moi.id ? 'Vous ne pouvez pas désactiver votre propre compte' : ''"
                @click="changerActif(u)"
              >
                {{ u.actif ? 'Désactiver' : 'Réactiver' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="comptesAffiches.length" />
      <p v-if="comptesAffiches.length === 0" class="tableau-vide">Aucun compte.</p>
    </div>

    <!-- ===================== FORMULAIRE CRÉATION / MODIFICATION ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier le compte' : 'Nouveau compte utilisateur'"
      large
      @fermer="formulaire = null"
    >
      <form id="form-compte" class="grille-formulaire" @submit.prevent="enregistrer">
        <!-- ---------- Titulaire du compte ---------- -->
        <h4 class="section pleine-largeur">Titulaire du compte</h4>
        <div v-if="!formulaire.id" class="pleine-largeur">
          <label class="obligatoire">Membre du personnel</label>
          <ListeDeroulante
            v-model="formulaire.personnelId"
            :options="personnelSansCompte"
            :champ-libelle="(p) => `${p.matricule} — ${p.prenoms || ''} ${p.nom}${p.fonction ? ' (' + p.fonction.libelle + ')' : ''}`"
            placeholder="Choisir une personne sans compte…"
          />
          <small class="aide">
            Seul le personnel actif sans compte est proposé. Pour une nouvelle personne, utilisez
            l'onglet « Personnel » (fiche + compte en une fois).
          </small>
        </div>
        <div v-else class="pleine-largeur titulaire">
          <Avatar :photo="formulaire.personnel?.photo" :nom="formulaire.nom" :prenoms="formulaire.prenoms" :taille="48" />
          <div>
            <strong>{{ formulaire.prenoms }} {{ formulaire.nom }}</strong>
            <small>
              {{ [formulaire.personnel?.matricule, formulaire.fonction].filter(Boolean).join(' · ') }}
              — nom, fonction et contacts se modifient dans l'onglet « Personnel ».
            </small>
          </div>
        </div>

        <!-- ---------- Compte ---------- -->
        <h4 class="section pleine-largeur">Compte</h4>
        <div>
          <label>Identifiant de connexion</label>
          <!-- Identifiant = MATRICULE de la personne : grisé, non modifiable -->
          <input :value="identifiantAffiche" disabled />
          <small class="aide">C'est le matricule (il se change dans l'onglet « Personnel »).</small>
        </div>
        <div>
          <label class="obligatoire">Profil</label>
          <ListeDeroulante v-model="formulaire.roleId" :options="rolesProposes" obligatoire :effacable="false" />
          <small v-if="profilChoisi" class="aide">{{ profilChoisi.description }}</small>
        </div>

        <!-- Mot de passe : seulement à la création (ensuite : bouton « Mot de passe ») -->
        <template v-if="!formulaire.id">
          <h4 class="section pleine-largeur">Mot de passe</h4>
          <div>
            <label class="obligatoire">Mot de passe</label>
            <ChampMotDePasse v-model="formulaire.motDePasse" obligatoire placeholder="8 caractères, lettres et chiffres" />
          </div>
          <div>
            <label class="obligatoire">Confirmation</label>
            <ChampMotDePasse v-model="formulaire.confirmation" obligatoire placeholder="Retapez le mot de passe" />
          </div>
          <p class="aide pleine-largeur">
            Au moins 8 caractères, dont au moins une lettre et un chiffre. Communiquez-le à
            l'utilisateur : il pourra le changer lui-même (bouton « Mon mot de passe » en haut de l'écran).
          </p>
        </template>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-compte" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </FenetreModale>

    <!-- ===================== RÉINITIALISATION DU MOT DE PASSE ===================== -->
    <FenetreModale
      v-if="reinitialisation"
      :titre="`Nouveau mot de passe — ${reinitialisation.utilisateur.prenoms || ''} ${reinitialisation.utilisateur.nom}`"
      @fermer="reinitialisation = null"
    >
      <form id="form-reinit" class="grille-formulaire" @submit.prevent="enregistrerReinitialisation">
        <div>
          <label class="obligatoire">Nouveau mot de passe</label>
          <ChampMotDePasse v-model="reinitialisation.motDePasse" obligatoire />
        </div>
        <div>
          <label class="obligatoire">Confirmation</label>
          <ChampMotDePasse v-model="reinitialisation.confirmation" obligatoire />
        </div>
        <p class="aide pleine-largeur">
          L'ancien mot de passe de « {{ reinitialisation.utilisateur.login }} » ne fonctionnera plus.
        </p>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="reinitialisation = null">Fermer</button>
        <button type="submit" form="form-reinit" :disabled="enregistrement">Enregistrer</button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ChampMotDePasse from '@/components/ChampMotDePasse.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import Avatar from '@/components/Avatar.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import {
  creerUtilisateur,
  modifierUtilisateur,
  reinitialiserMotDePasse,
  verifierMotDePasse,
} from '@/api/utilisateurs'

const props = defineProps({
  comptes: { type: Array, required: true },
  personnel: { type: Array, required: true },
  roles: { type: Array, required: true },
})
const emit = defineEmits(['modifie'])

const store = useStore()

// Utilisateur connecté (pour reconnaître "sa" ligne)
const moi = computed(() => store.state.auth.user || {})

const recherche = ref('')
const profilFiltre = ref(null)
const afficherInactifs = ref(false)
const enregistrement = ref(false)

// Fenêtres ouvertes (null = fermée)
const formulaire = ref(null)
const reinitialisation = ref(null)

/** Liste filtrée (recherche + profil + inactifs). */
const comptesAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return props.comptes.filter((u) => {
    if (!afficherInactifs.value && !u.actif) return false
    if (profilFiltre.value && u.roleId !== profilFiltre.value) return false
    if (!texte) return true
    return [u.nom, u.prenoms, u.login, u.fonction].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

/** Personnel actif qui n'a pas encore de compte (pour « Nouveau compte »). */
const personnelSansCompte = computed(() => props.personnel.filter((p) => p.actif && p.comptes.length === 0))

/**
 * Profils proposés : le profil Administrateur n'est proposé qu'à un
 * administrateur (le serveur le refuse de toute façon aux autres).
 */
const rolesProposes = computed(() =>
  props.roles.filter((r) => r.code !== 'ADMIN' || moi.value.role === 'ADMIN' || r.id === formulaire.value?.roleId),
)

/** Profil choisi dans le formulaire (pour afficher sa description). */
const profilChoisi = computed(() => props.roles.find((r) => r.id === formulaire.value?.roleId))

/** Date et heure lisibles (ex. "14/11/2026 à 09:42"). */
function formaterDateHeure(valeur) {
  const d = new Date(valeur)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Ouvre le formulaire : vide pour une création, pré-rempli pour une modification. */
function ouvrirFormulaire(utilisateur = null) {
  formulaire.value = utilisateur
    ? { ...utilisateur }
    : { personnelId: null, roleId: null, motDePasse: '', confirmation: '' }
}

/** Identifiant affiché (grisé) : le login du compte, ou le matricule de la personne choisie. */
const identifiantAffiche = computed(() => {
  const f = formulaire.value
  if (!f) return ''
  if (f.id) return f.login
  return props.personnel.find((p) => p.id === f.personnelId)?.matricule || '— choisir la personne —'
})

async function enregistrer() {
  const f = formulaire.value
  if (!f.id && !f.personnelId) {
    store.dispatch('notifications/erreur', 'Choisissez le membre du personnel.')
    return
  }
  if (!f.roleId) {
    store.dispatch('notifications/erreur', 'Choisissez un profil.')
    return
  }
  // À la création : contrôle du mot de passe avant l'envoi
  if (!f.id) {
    const erreurMdp = verifierMotDePasse(f.motDePasse, f.confirmation)
    if (erreurMdp) {
      store.dispatch('notifications/erreur', erreurMdp)
      return
    }
  }

  enregistrement.value = true
  try {
    if (f.id) {
      await modifierUtilisateur(f.id, { roleId: f.roleId })
    } else {
      // Pas d'identifiant à envoyer : c'est le matricule (choisi par le serveur)
      await creerUtilisateur({ personnelId: f.personnelId, roleId: f.roleId, motDePasse: f.motDePasse })
    }
    store.dispatch('notifications/succes', f.id ? 'Compte modifié.' : 'Compte créé.')
    // La fenêtre reste ouverte et les champs sont vidés pour une nouvelle saisie
    ouvrirFormulaire()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

function ouvrirReinitialisation(utilisateur) {
  reinitialisation.value = { utilisateur, motDePasse: '', confirmation: '' }
}

async function enregistrerReinitialisation() {
  const r = reinitialisation.value
  const erreurMdp = verifierMotDePasse(r.motDePasse, r.confirmation)
  if (erreurMdp) {
    store.dispatch('notifications/erreur', erreurMdp)
    return
  }
  enregistrement.value = true
  try {
    await reinitialiserMotDePasse(r.utilisateur.id, r.motDePasse)
    store.dispatch('notifications/succes', `Mot de passe de « ${r.utilisateur.login} » réinitialisé.`)
    // Fenêtre ouverte, champs vidés
    reinitialisation.value = { utilisateur: r.utilisateur, motDePasse: '', confirmation: '' }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function changerActif(utilisateur) {
  const nom = `${utilisateur.prenoms || ''} ${utilisateur.nom}`.trim()
  const confirme = await confirmer({
    titre: utilisateur.actif ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?',
    texte: utilisateur.actif
      ? `« ${nom} » ne pourra plus se connecter. Son historique est conservé.`
      : `« ${nom} » pourra de nouveau se connecter.`,
    boutonConfirmer: utilisateur.actif ? 'Oui, désactiver' : 'Oui, réactiver',
    danger: utilisateur.actif,
  })
  if (!confirme) return
  try {
    await modifierUtilisateur(utilisateur.id, { actif: !utilisateur.actif })
    store.dispatch('notifications/succes', utilisateur.actif ? 'Compte désactivé.' : 'Compte réactivé.')
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination et PDF
// ---------------------------------------------------------------------------

/** Pour chaque colonne triable, la valeur à comparer. */
const VALEURS_TRI = {
  utilisateur: (u) => `${u.nom} ${u.prenoms || ''}`,
  fonction: (u) => u.fonction,
  profil: (u) => u.role?.libelle,
  connexion: (u) => u.derniereConnexion,
  statut: (u) => (u.actif ? 'Actif' : 'Inactif'),
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(
  comptesAffiches,
  [recherche, profilFiltre, afficherInactifs],
  VALEURS_TRI,
)

/** Colonnes du PDF. */
const COLONNES_PDF = [
  { titre: 'Nom et prénoms', valeur: (u) => `${u.nom} ${u.prenoms || ''}`.trim() },
  { titre: 'Identifiant', valeur: (u) => u.login },
  { titre: 'Fonction', valeur: (u) => u.fonction },
  { titre: 'Profil', valeur: (u) => u.role?.libelle },
  { titre: 'Téléphone', valeur: (u) => u.telephone },
  { titre: 'E-mail', valeur: (u) => u.email },
  { titre: 'Dernière connexion', valeur: (u) => (u.derniereConnexion ? formaterDateHeure(u.derniereConnexion) : 'Jamais') },
  { titre: 'Statut', valeur: (u) => (u.actif ? 'Actif' : 'Inactif') },
]
</script>

<style scoped>
.vous { margin-left: 0.4rem; }
.contact { font-size: 0.85rem; }
.titulaire {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--fond-pale);
}
.titulaire small { display: block; color: var(--muted); font-size: 0.8rem; }
</style>
