<!--
  =============================================================================
  ONGLET « FAMILLES DE MÉDICAMENTS »
  =============================================================================
  Une famille regroupe des médicaments (ex. Antipaludiques, Antibiotiques).
  Une famille peut être supprimée seulement si aucun médicament ne l'utilise
  (le bouton "Supprimer" est alors grisé).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher une famille…" />
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Familles de médicaments"
        nom-fichier="familles_medicaments"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle famille</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="libelle">Libellé</ColonneTri>
            <ColonneTri v-model="tri" cle="categorie">Catégorie</ColonneTri>
            <ColonneTri v-model="tri" cle="medicaments" class="nombre">Médicaments</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="famille in lignesPage" :key="famille.id">
            <td class="code">{{ famille.code }}</td>
            <td><strong>{{ famille.libelle }}</strong></td>
            <td>{{ famille.categorie || '—' }}</td>
            <td class="nombre">
              <span class="badge badge-vert">{{ famille._count?.medicaments ?? 0 }}</span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(famille)">Modifier</button>
              <button v-si-modif
                class="bouton-lien danger"
                :disabled="famille._count?.medicaments > 0"
                :title="famille._count?.medicaments > 0 ? 'Famille utilisée par des médicaments' : ''"
                @click="supprimer(famille)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="famillesAffichees.length" />
      <p v-if="!chargement && famillesAffichees.length === 0" class="tableau-vide">
        Aucune famille. Cliquez sur « Nouvelle famille » pour en ajouter une.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier la famille' : 'Nouvelle famille de médicaments'"
      @fermer="formulaire = null"
    >
      <form id="form-famille" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. MED-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. ANTIPALU)" />
        </div>
        <div>
          <label>Catégorie</label>
          <input v-model.trim="formulaire.categorie" maxlength="100" placeholder="ex. Anti-infectieux" />
        </div>
        <div class="pleine-largeur">
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Antipaludiques" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-famille" :disabled="enregistrement">
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

const familles = computed(() => store.state.referentiel.familles)

const famillesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return familles.value
  return familles.value.filter((f) =>
    [f.code, f.libelle, f.categorie].some((v) => (v || '').toLowerCase().includes(texte)),
  )
})

async function charger() {
  chargement.value = true
  try {
    await store.dispatch('referentiel/charger', { liste: 'familles' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(famille = null) {
  formulaire.value = famille ? { ...famille } : { code: '', libelle: '', categorie: '' }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const { id, code, libelle, categorie } = formulaire.value
    await store.dispatch('referentiel/enregistrer', {
      liste: 'familles',
      element: { id, code, libelle, categorie },
    })
    store.dispatch('notifications/succes', id ? 'Famille modifiée.' : 'Famille créée.')
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

async function supprimer(famille) {
  const confirme = await confirmer({
    titre: 'Supprimer cette famille ?',
    texte: `« ${famille.libelle} » sera supprimée définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/supprimer', { liste: 'familles', element: famille })
    store.dispatch('notifications/succes', 'Famille supprimée.')
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
  { titre: 'Code', valeur: (f) => f.code },
  { titre: 'Libellé', valeur: (f) => f.libelle },
  { titre: 'Catégorie', valeur: (f) => f.categorie },
  { titre: 'Médicaments', valeur: (f) => f._count?.medicaments ?? 0, droite: true, somme: (f) => f._count?.medicaments ?? 0 },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  { cle: 'code', titre: 'Code', exemple: 'ANTIPALU', aide: 'Facultatif : code unique de la famille. vide = code automatique' },
  { cle: 'libelle', titre: 'Libellé', obligatoire: true, exemple: 'Antipaludiques' },
  { cle: 'categorie', titre: 'Catégorie', exemple: 'Anti-infectieux', aide: 'Facultatif' },
]

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  const existant = trouverParCode(familles.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    libelle: enTexte(valeurs.libelle),
    categorie: enTexte(valeurs.categorie),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'familles', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (f) => f.code,
  libelle: (f) => f.libelle,
  categorie: (f) => f.categorie,
  medicaments: (f) => f._count?.medicaments ?? 0,
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(famillesAffichees, [recherche], VALEURS_TRI)

onMounted(charger)
</script>
