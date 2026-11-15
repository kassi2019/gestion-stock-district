<!--
  =============================================================================
  ONGLET « FORMES DE MÉDICAMENTS »
  =============================================================================
  Liste des formes possibles d'un médicament (Comprimé, Sirop, Injectable...).
  Ces formes apparaissent dans la liste déroulante du formulaire des médicaments.
  Une forme peut être supprimée seulement si aucun médicament ne l'utilise
  (le bouton "Supprimer" est alors grisé).
  ➜ Même fonctionnement que l'onglet Familles (OngletFamilles.vue).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher une forme…" />
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Formes de médicaments"
        nom-fichier="formes_medicaments"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle forme</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="libelle">Libellé</ColonneTri>
            <ColonneTri v-model="tri" cle="medicaments" class="nombre">Médicaments</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="forme in lignesPage" :key="forme.id">
            <td class="code">{{ forme.code }}</td>
            <td><strong>{{ forme.libelle }}</strong></td>
            <td class="nombre">
              <span class="badge badge-vert">{{ forme._count?.medicaments ?? 0 }}</span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(forme)">Modifier</button>
              <button v-si-modif
                class="bouton-lien danger"
                :disabled="forme._count?.medicaments > 0"
                :title="forme._count?.medicaments > 0 ? 'Forme utilisée par des médicaments' : ''"
                @click="supprimer(forme)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="formesAffichees.length" />
      <p v-if="!chargement && formesAffichees.length === 0" class="tableau-vide">
        Aucune forme. Cliquez sur « Nouvelle forme » pour en ajouter une.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier la forme' : 'Nouvelle forme de médicament'"
      @fermer="formulaire = null"
    >
      <form id="form-forme" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. FRM-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. COMPRIME)" />
        </div>
        <div>
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Comprimé" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-forme" :disabled="enregistrement">
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

const formes = computed(() => store.state.referentiel.formes)

const formesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return formes.value
  return formes.value.filter((f) => [f.code, f.libelle].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    await store.dispatch('referentiel/charger', { liste: 'formes' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(forme = null) {
  formulaire.value = forme ? { ...forme } : { code: '', libelle: '' }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const { id, code, libelle } = formulaire.value
    await store.dispatch('referentiel/enregistrer', { liste: 'formes', element: { id, code, libelle } })
    store.dispatch('notifications/succes', id ? 'Forme modifiée.' : 'Forme créée.')
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

async function supprimer(forme) {
  const confirme = await confirmer({
    titre: 'Supprimer cette forme ?',
    texte: `« ${forme.libelle} » sera supprimée définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/supprimer', { liste: 'formes', element: forme })
    store.dispatch('notifications/succes', 'Forme supprimée.')
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
  { titre: 'Médicaments', valeur: (f) => f._count?.medicaments ?? 0, droite: true, somme: (f) => f._count?.medicaments ?? 0 },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  { cle: 'code', titre: 'Code', exemple: 'COMPRIME', aide: 'Facultatif : code unique de la forme. vide = code automatique' },
  { cle: 'libelle', titre: 'Libellé', obligatoire: true, exemple: 'Comprimé' },
]

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  const existant = trouverParCode(formes.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    libelle: enTexte(valeurs.libelle),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'formes', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (f) => f.code,
  libelle: (f) => f.libelle,
  medicaments: (f) => f._count?.medicaments ?? 0,
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(formesAffichees, [recherche], VALEURS_TRI)

onMounted(charger)
</script>
