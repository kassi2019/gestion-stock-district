<!--
  =============================================================================
  ONGLET « UNITÉS DE VENTE »
  =============================================================================
  Liste des unités dans lesquelles un médicament est vendu (Boîte, Plaque,
  Flacon...). Le prix de vente d'un médicament s'applique à son unité de vente.
  Ces unités apparaissent dans la liste déroulante du formulaire des médicaments.
  Une unité peut être supprimée seulement si aucun médicament ne l'utilise
  (le bouton "Supprimer" est alors grisé).
  ➜ Même fonctionnement que l'onglet Formes (OngletFormes.vue).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher une unité…" />
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Unités de vente"
        nom-fichier="unites_vente"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle unité</button>
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
          <tr v-for="unite in lignesPage" :key="unite.id">
            <td class="code">{{ unite.code }}</td>
            <td><strong>{{ unite.libelle }}</strong></td>
            <td class="nombre">
              <span class="badge badge-vert">{{ unite._count?.medicaments ?? 0 }}</span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(unite)">Modifier</button>
              <button v-si-modif
                class="bouton-lien danger"
                :disabled="unite._count?.medicaments > 0"
                :title="unite._count?.medicaments > 0 ? 'Unité utilisée par des médicaments' : ''"
                @click="supprimer(unite)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="unitesAffichees.length" />
      <p v-if="!chargement && unitesAffichees.length === 0" class="tableau-vide">
        Aucune unité de vente. Cliquez sur « Nouvelle unité » pour en ajouter une.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier l\'unité de vente' : 'Nouvelle unité de vente'"
      @fermer="formulaire = null"
    >
      <form id="form-unite-vente" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. UNV-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. FLACON)" />
        </div>
        <div>
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Flacon" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-unite-vente" :disabled="enregistrement">
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

const unites = computed(() => store.state.referentiel.unitesVente)

const unitesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return unites.value
  return unites.value.filter((f) => [f.code, f.libelle].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    await store.dispatch('referentiel/charger', { liste: 'unitesVente' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(unite = null) {
  formulaire.value = unite ? { ...unite } : { code: '', libelle: '' }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const { id, code, libelle } = formulaire.value
    await store.dispatch('referentiel/enregistrer', { liste: 'unitesVente', element: { id, code, libelle } })
    store.dispatch('notifications/succes', id ? 'Unité de vente modifiée.' : 'Unité de vente créée.')
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

async function supprimer(unite) {
  const confirme = await confirmer({
    titre: 'Supprimer cette unité de vente ?',
    texte: `« ${unite.libelle} » sera supprimée définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/supprimer', { liste: 'unitesVente', element: unite })
    store.dispatch('notifications/succes', 'Unité de vente supprimée.')
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
  { cle: 'code', titre: 'Code', exemple: 'FLACON', aide: 'Facultatif : code unique de l\'unité. vide = code automatique' },
  { cle: 'libelle', titre: 'Libellé', obligatoire: true, exemple: 'Flacon' },
]

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  const existant = trouverParCode(unites.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    libelle: enTexte(valeurs.libelle),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'unitesVente', element })
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
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(unitesAffichees, [recherche], VALEURS_TRI)

onMounted(charger)
</script>
