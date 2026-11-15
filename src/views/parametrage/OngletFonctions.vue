<!--
  =============================================================================
  ONGLET « FONCTIONS DU PERSONNEL »
  =============================================================================
  Liste des fonctions du personnel (Pharmacien, Caissière, Agent de saisie...).
  Ces fonctions apparaissent dans la fiche du personnel (module Utilisateurs).
  Une fonction peut être supprimée seulement si aucune personne ne l'occupe
  (le bouton "Supprimer" est alors grisé).
  ➜ Même fonctionnement que l'onglet Formes (OngletFormes.vue).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher une fonction…" />
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Fonctions du personnel"
        nom-fichier="fonctions_personnel"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle fonction</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="libelle">Libellé</ColonneTri>
            <ColonneTri v-model="tri" cle="personnel" class="nombre">Personnel</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fonction in lignesPage" :key="fonction.id">
            <td class="code">{{ fonction.code }}</td>
            <td><strong>{{ fonction.libelle }}</strong></td>
            <td class="nombre">
              <span class="badge badge-vert">{{ fonction._count?.personnel ?? 0 }}</span>
            </td>
            <td class="actions">
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(fonction)">Modifier</button>
              <button v-si-modif
                class="bouton-lien danger"
                :disabled="fonction._count?.personnel > 0"
                :title="fonction._count?.personnel > 0 ? 'Fonction occupée par du personnel' : ''"
                @click="supprimer(fonction)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="fonctionsAffichees.length" />
      <p v-if="!chargement && fonctionsAffichees.length === 0" class="tableau-vide">
        Aucune fonction. Cliquez sur « Nouvelle fonction » pour en ajouter une.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier la fonction' : 'Nouvelle fonction'"
      @fermer="formulaire = null"
    >
      <form id="form-fonction" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. FRM-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. PHARMACIEN)" />
        </div>
        <div>
          <label class="obligatoire">Libellé</label>
          <input v-model.trim="formulaire.libelle" required maxlength="100" placeholder="ex. Pharmacien" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-fonction" :disabled="enregistrement">
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

const fonctions = computed(() => store.state.referentiel.fonctions)

const fonctionsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return fonctions.value
  return fonctions.value.filter((f) => [f.code, f.libelle].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    await store.dispatch('referentiel/charger', { liste: 'fonctions' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(fonction = null) {
  formulaire.value = fonction ? { ...fonction } : { code: '', libelle: '' }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const { id, code, libelle } = formulaire.value
    await store.dispatch('referentiel/enregistrer', { liste: 'fonctions', element: { id, code, libelle } })
    store.dispatch('notifications/succes', id ? 'Fonction modifiée.' : 'Fonction créée.')
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

async function supprimer(fonction) {
  const confirme = await confirmer({
    titre: 'Supprimer cette fonction ?',
    texte: `« ${fonction.libelle} » sera supprimée définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/supprimer', { liste: 'fonctions', element: fonction })
    store.dispatch('notifications/succes', 'Fonction supprimée.')
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
  { titre: 'Personnel', valeur: (f) => f._count?.personnel ?? 0, droite: true, somme: (f) => f._count?.personnel ?? 0 },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  { cle: 'code', titre: 'Code', exemple: 'PHARMACIEN', aide: 'Facultatif : code unique de la fonction. vide = code automatique' },
  { cle: 'libelle', titre: 'Libellé', obligatoire: true, exemple: 'Pharmacien' },
]

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  const existant = trouverParCode(fonctions.value, valeurs.code)
  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    libelle: enTexte(valeurs.libelle),
  })
  await store.dispatch('referentiel/enregistrer', { liste: 'fonctions', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (f) => f.code,
  libelle: (f) => f.libelle,
  personnel: (f) => f._count?.personnel ?? 0,
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(fonctionsAffichees, [recherche], VALEURS_TRI)

onMounted(charger)
</script>
