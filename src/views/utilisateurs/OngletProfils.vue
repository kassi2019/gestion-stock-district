<!--
  =============================================================================
  ONGLET « PROFILS & DROITS »
  =============================================================================
  Un profil (rôle) = un code, un libellé, une description et des DROITS :
  pour chaque module de l'application, trois cases indépendantes :
    - Voir     : ouvrir le module, consulter, rechercher ;
    - Imprimer : télécharger / imprimer les PDF ;
    - Modifier : créer, modifier, importer, valider, désactiver.
  Cocher Imprimer ou Modifier coche aussi Voir ; décocher Voir décoche tout.
  Les comptes utilisateurs reçoivent les droits de leur profil
  (changement appliqué immédiatement, sans reconnexion).

  Règles :
    - le profil Administrateur a toujours TOUS les droits (non modifiables) ;
    - un profil ne peut être supprimé que si aucun compte ne l'utilise ;
    - seul un ADMINISTRATEUR peut créer / modifier / supprimer un profil
      (sinon un profil pourrait se donner lui-même plus de droits).

  Propriétés : profils (avec permissions et _count.utilisateurs)
  Événement  : @modifie -> la page recharge les listes
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher un profil…" />
      <span class="espace"></span>
      <ImportExportTableau
        titre="Profils et droits d'accès"
        nom-fichier="profils_droits"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-if="estAdmin" @click="ouvrirFormulaire()">+ Nouveau profil</button>
    </div>

    <p v-if="!estAdmin" class="info-lecture">
      Seul un administrateur peut créer ou modifier les profils et leurs droits.
    </p>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="libelle">Profil</ColonneTri>
            <th>Modules accessibles</th>
            <ColonneTri v-model="tri" cle="comptes" class="nombre">Comptes</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="profil in lignesPage" :key="profil.id">
            <td class="code">{{ profil.code }}</td>
            <td>
              <strong>{{ profil.libelle }}</strong>
              <div v-if="profil.description" class="detail">{{ profil.description }}</div>
            </td>
            <td>
              <span v-if="profil.code === 'ADMIN'" class="badge badge-rouge">Tous les modules (voir, imprimer, modifier)</span>
              <template v-else>
                <span
                  v-for="module in modulesDuProfil(profil)"
                  :key="module.code"
                  class="puce-module"
                  :class="droitsDe(profil, module.code).includes('MODIFIER') ? 'modif' : 'lecture'"
                  :title="droitsDe(profil, module.code).map((d) => LIBELLES_DROITS[d]).join(', ')"
                >
                  {{ module.titre }}
                  <small>{{ droitsDe(profil, module.code).map((d) => ICONES_DROITS[d]).join(' ') }}</small>
                </span>
                <span v-if="modulesDuProfil(profil).length === 0" class="detail">Aucun module</span>
              </template>
            </td>
            <td class="nombre">
              <span class="badge badge-vert">{{ profil._count?.utilisateurs ?? 0 }}</span>
            </td>
            <td class="actions">
              <template v-if="estAdmin">
                <button class="bouton-lien" @click="ouvrirFormulaire(profil)">
                  {{ profil.code === 'ADMIN' ? 'Modifier le libellé' : 'Modifier les droits' }}
                </button>
                <button
                  v-if="profil.code !== 'ADMIN'"
                  class="bouton-lien danger"
                  :disabled="profil._count?.utilisateurs > 0"
                  :title="profil._count?.utilisateurs > 0 ? 'Profil utilisé par des comptes' : ''"
                  @click="supprimer(profil)"
                >
                  Supprimer
                </button>
              </template>
              <button v-else class="bouton-lien" @click="ouvrirFormulaire(profil)">Voir les droits</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="profilsAffiches.length" />
    </div>

    <!-- ===================== FORMULAIRE DU PROFIL ET DE SES DROITS ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? `Profil « ${formulaire.libelle || formulaire.code} »` : 'Nouveau profil'"
      large
      @fermer="formulaire = null"
    >
      <form id="form-profil" class="grille-formulaire" @submit.prevent="enregistrer">
        <h4 class="section pleine-largeur">Profil</h4>
        <div>
          <label class="obligatoire">Code</label>
          <input
            v-model.trim="formulaire.code"
            required
            maxlength="50"
            pattern="[A-Z0-9_]+"
            title="MAJUSCULES, chiffres et _ (ex. PHARMACIEN)"
            placeholder="ex. PHARMACIEN"
            :disabled="formulaire.code === 'ADMIN' && !!formulaire.id || lectureSeule"
            @input="formulaire.code = formulaire.code.toUpperCase()"
          />
        </div>
        <div>
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Pharmacien" :disabled="lectureSeule" />
        </div>
        <div class="pleine-largeur">
          <label>Description</label>
          <input v-model.trim="formulaire.description" maxlength="255" placeholder="ex. Gestion du stock et des livraisons" :disabled="lectureSeule" />
        </div>

        <!-- ---------- Droits par module ---------- -->
        <h4 class="section pleine-largeur">Droits par module</h4>
        <p v-if="formulaire.code === 'ADMIN'" class="pleine-largeur info-lecture">
          L'administrateur a toujours tous les droits (voir, imprimer, modifier) sur tous les modules. Ses droits ne sont pas modifiables.
        </p>
        <div v-else class="pleine-largeur">
          <!-- Raccourcis -->
          <div v-if="!lectureSeule" class="raccourcis">
            <span>Pour tous les modules :</span>
            <button type="button" class="bouton-lien" @click="toutMettre([])">Aucun droit</button>
            <button type="button" class="bouton-lien" @click="toutMettre(['VOIR'])">Voir</button>
            <button type="button" class="bouton-lien" @click="toutMettre(['VOIR', 'IMPRIMER'])">Voir + imprimer</button>
            <button type="button" class="bouton-lien" @click="toutMettre(['VOIR', 'IMPRIMER', 'MODIFIER'])">Tous les droits</button>
          </div>

          <table class="tableau grille-droits">
            <thead>
              <tr>
                <th>Module</th>
                <th class="centre">Voir<br /><small>ouvrir, consulter</small></th>
                <th class="centre">Imprimer<br /><small>PDF</small></th>
                <th class="centre">Modifier<br /><small>créer, modifier, valider</small></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="groupe in GROUPES" :key="groupe.titre">
                <tr class="ligne-groupe"><td colspan="4">{{ groupe.titre }}</td></tr>
                <tr v-for="module in groupe.modules" :key="module.code">
                  <td>
                    <strong>{{ module.titre }}</strong>
                    <div class="detail">{{ module.description }}</div>
                  </td>
                  <td v-for="droit in DROITS" :key="droit" class="centre">
                    <input
                      type="checkbox"
                      :checked="formulaire.droits[module.code].includes(droit)"
                      :disabled="lectureSeule"
                      :title="LIBELLES_DROITS[droit]"
                      @change="changerDroit(module.code, droit, $event.target.checked)"
                    />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button v-if="!lectureSeule" type="submit" form="form-profil" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { GROUPES, MODULES } from '@/config/modules'
import { creerProfil, modifierProfil, supprimerProfil } from '@/api/utilisateurs'

const props = defineProps({
  profils: { type: Array, required: true },
})
const emit = defineEmits(['modifie'])

const store = useStore()

/** Les trois droits (colonnes de la grille), avec leur libellé et leur icône. */
const DROITS = ['VOIR', 'IMPRIMER', 'MODIFIER']
const LIBELLES_DROITS = { VOIR: 'Voir', IMPRIMER: 'Imprimer', MODIFIER: 'Modifier' }
const ICONES_DROITS = { VOIR: '👁', IMPRIMER: '🖨', MODIFIER: '✎' }

/** Droits d'un profil sur un module (liste ; accepte l'ancien format). */
function droitsDe(profil, module) {
  const valeur = profil.permissions?.[module]
  if (Array.isArray(valeur)) return valeur
  if (valeur === 'LECTURE') return ['VOIR', 'IMPRIMER']
  if (valeur === 'MODIFICATION') return [...DROITS]
  return []
}

/** Seul un administrateur gère les profils. */
const estAdmin = computed(() => store.state.auth.user?.role === 'ADMIN')
/** Formulaire en consultation seulement (non-administrateur). */
const lectureSeule = computed(() => !estAdmin.value)

const recherche = ref('')
const enregistrement = ref(false)
const formulaire = ref(null)

const profilsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return props.profils
  return props.profils.filter((p) =>
    [p.code, p.libelle, p.description].some((v) => (v || '').toLowerCase().includes(texte)),
  )
})

/** Modules auxquels le profil a au moins un droit (dans l'ordre de l'application). */
function modulesDuProfil(profil) {
  return MODULES.filter((m) => droitsDe(profil, m.code).length > 0)
}

function ouvrirFormulaire(profil = null) {
  // Droits : une liste par module ([] = aucun droit)
  const droits = Object.fromEntries(MODULES.map((m) => [m.code, profil ? [...droitsDe(profil, m.code)] : []]))
  formulaire.value = profil
    ? { id: profil.id, code: profil.code, libelle: profil.libelle, description: profil.description || '', droits }
    : { code: '', libelle: '', description: '', droits }
}

/** Raccourci : mêmes droits pour tous les modules. */
function toutMettre(droits) {
  for (const module of MODULES) formulaire.value.droits[module.code] = [...droits]
}

/**
 * Coche / décoche un droit d'un module, en gardant la cohérence :
 *   - cocher Imprimer ou Modifier coche aussi Voir ;
 *   - décocher Voir décoche tout (on ne peut rien faire sans voir).
 */
function changerDroit(module, droit, coche) {
  let liste = new Set(formulaire.value.droits[module])
  if (coche) {
    liste.add(droit)
    liste.add('VOIR')
  } else if (droit === 'VOIR') {
    liste = new Set()
  } else {
    liste.delete(droit)
  }
  formulaire.value.droits[module] = DROITS.filter((d) => liste.has(d))
}

async function enregistrer() {
  const f = formulaire.value
  // On n'envoie que les modules qui ont au moins un droit
  const permissions = Object.fromEntries(Object.entries(f.droits).filter(([, droits]) => droits.length > 0))
  const donnees = { code: f.code, libelle: f.libelle, description: f.description || null, permissions }

  enregistrement.value = true
  try {
    if (f.id) await modifierProfil(f.id, donnees)
    else await creerProfil({ ...donnees, description: f.description || undefined })
    store.dispatch('notifications/succes', f.id ? 'Profil et droits enregistrés.' : 'Profil créé.')
    // La fenêtre reste ouverte (fermée par × ou « Fermer ») ; une création vide le formulaire
    if (!f.id) ouvrirFormulaire()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function supprimer(profil) {
  const confirme = await confirmer({
    titre: 'Supprimer ce profil ?',
    texte: `« ${profil.libelle} » sera supprimé définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await supprimerProfil(profil.id)
    store.dispatch('notifications/succes', 'Profil supprimé.')
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination et PDF
// ---------------------------------------------------------------------------

const VALEURS_TRI = {
  code: (p) => p.code,
  libelle: (p) => p.libelle,
  comptes: (p) => p._count?.utilisateurs ?? 0,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(profilsAffiches, [recherche], VALEURS_TRI)

/** PDF : un profil par ligne, ses modules en lecture et en modification. */
const COLONNES_PDF = [
  { titre: 'Code', valeur: (p) => p.code },
  { titre: 'Profil', valeur: (p) => p.libelle },
  ...DROITS.map((droit) => ({
    titre: LIBELLES_DROITS[droit],
    valeur: (p) =>
      p.code === 'ADMIN' ? 'Tous les modules' : MODULES.filter((m) => droitsDe(p, m.code).includes(droit)).map((m) => m.titre).join(', '),
  })),
  { titre: 'Comptes', valeur: (p) => p._count?.utilisateurs ?? 0, droite: true, somme: (p) => p._count?.utilisateurs ?? 0 },
]
</script>

<style scoped>
.detail { font-size: 0.78rem; color: var(--muted); }
.info-lecture {
  margin: 0 0 1rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  background: #fff6e5;
  color: #7a4a00;
  font-size: 0.85rem;
}

/* Puces des modules dans la liste */
.puce-module {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.15rem 0.3rem 0.15rem 0;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.puce-module.modif { background: var(--primary-light); color: var(--primary-dark); }
.puce-module.lecture { background: #e8f1fd; color: #1d4f91; }

/* Grille des droits */
.raccourcis { display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--muted); }
.grille-droits th small { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--muted); }
.grille-droits .centre { text-align: center; width: 130px; }
.grille-droits input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer; }
.ligne-groupe td {
  padding: 0.45rem 0.75rem;
  background: #f7faf8;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--primary);
}
</style>
