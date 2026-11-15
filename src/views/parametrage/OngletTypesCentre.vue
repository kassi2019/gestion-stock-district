<!--
  =============================================================================
  ONGLET « TYPES DE CENTRES »
  =============================================================================
  Liste des types possibles pour un centre de santé (CSU, CSR, Dispensaire...).
  Ces types apparaissent dans la liste déroulante du formulaire des centres.
  Un type peut être supprimé seulement si aucun centre ne l'utilise
  (le bouton "Supprimer" est alors grisé).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher un type…" />
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Types de centres"
        nom-fichier="types_centres"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouveau type</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="libelle">Libellé</ColonneTri>
            <ColonneTri v-model="tri" cle="description">Description</ColonneTri>
            <ColonneTri v-model="tri" cle="centres" class="nombre">Centres</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="type in lignesPage" :key="type.id">
            <td class="code">{{ type.code }}</td>
            <td><strong>{{ type.libelle }}</strong></td>
            <td>{{ type.description || '—' }}</td>
            <td class="nombre">
              <span class="badge badge-vert">{{ type._count?.centres ?? 0 }}</span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(type)">Modifier</button>
              <button v-si-modif
                class="bouton-lien danger"
                :disabled="type._count?.centres > 0"
                :title="type._count?.centres > 0 ? 'Type utilisé par des centres' : ''"
                @click="supprimer(type)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="typesAffiches.length" />
      <p v-if="!chargement && typesAffiches.length === 0" class="tableau-vide">
        Aucun type de centre. Cliquez sur « Nouveau type » pour en ajouter un.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier le type de centre' : 'Nouveau type de centre'"
      @fermer="formulaire = null"
    >
      <form id="form-type-centre" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. MED-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. CSU)" />
        </div>
        <div>
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Centre de santé urbain" />
        </div>
        <div class="pleine-largeur">
          <label>Description</label>
          <input v-model.trim="formulaire.description" maxlength="255" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-type-centre" :disabled="enregistrement">
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
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { enTexte, sansChampsVides, trouverParCode } from '@/utils/importFichier'

const store = useStore()

const recherche = ref('')
const chargement = ref(false)
const enregistrement = ref(false)
const formulaire = ref(null)

const types = computed(() => store.state.referentiel.typesCentre)

const typesAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return types.value
  return types.value.filter((t) =>
    [t.code, t.libelle, t.description].some((v) => (v || '').toLowerCase().includes(texte)),
  )
})

async function charger() {
  chargement.value = true
  try {
    await store.dispatch('referentiel/charger', { liste: 'typesCentre' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(type = null) {
  formulaire.value = type ? { ...type } : { code: '', libelle: '', description: '' }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const { id, code, libelle, description } = formulaire.value
    await store.dispatch('referentiel/enregistrer', {
      liste: 'typesCentre',
      element: { id, code, libelle, description },
    })
    store.dispatch('notifications/succes', id ? 'Type de centre modifié.' : 'Type de centre créé.')
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

async function supprimer(type) {
  const confirme = await confirmer({
    titre: 'Supprimer ce type de centre ?',
    texte: `« ${type.libelle} » sera supprimé définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/supprimer', { liste: 'typesCentre', element: type })
    store.dispatch('notifications/succes', 'Type de centre supprimé.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// EXPORT PDF ET IMPORT DE FICHIER
// ---------------------------------------------------------------------------

/** Colonnes du PDF. */
const COLONNES_PDF = [
  { titre: 'Code', valeur: (t) => t.code },
  { titre: 'Libellé', valeur: (t) => t.libelle },
  { titre: 'Description', valeur: (t) => t.description },
  { titre: 'Centres', valeur: (t) => t._count?.centres ?? 0, droite: true, somme: (t) => t._count?.centres ?? 0 },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  { cle: 'code', titre: 'Code', exemple: 'CSU', aide: 'Facultatif : code unique du type. vide = code automatique' },
  { cle: 'libelle', titre: 'Libellé', obligatoire: true, exemple: 'Centre de santé urbain' },
  { cle: 'description', titre: 'Description', exemple: '', aide: 'Facultatif' },
]

/**
 * Enregistre UNE ligne du fichier : mise à jour si le code existe déjà,
 * création sinon. Renvoie 'modifie' ou 'cree'.
 */
async function importerLigne(valeurs) {
  const existant = trouverParCode(types.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    libelle: enTexte(valeurs.libelle),
    description: enTexte(valeurs.description),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'typesCentre', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (t) => t.code,
  libelle: (t) => t.libelle,
  description: (t) => t.description,
  centres: (t) => t._count?.centres ?? 0,
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(typesAffiches, [recherche], VALEURS_TRI)

onMounted(charger)
</script>
