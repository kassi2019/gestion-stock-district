<!--
  Petit tableau d'HISTORIQUE DES PRIX, utilisé deux fois dans OngletPrix.vue
  (prix de vente et prix d'achat).

  Propriétés :
    - lignes  : liste des prix (renvoyée par l'API) ;
    - colonne : titre de la 2e colonne ("Centre" ou "Fournisseur") ;
    - libelle : fonction qui donne le texte de la 2e colonne pour une ligne ;
    - titre-export / sous-titre-export / nom-fichier : pour les boutons PDF / Excel.
  Événement :
    - @corriger(ligne) : clic sur « Corriger » (seulement sur un prix EN COURS).
-->
<template>
  <div class="tableau-conteneur">
    <div class="titre-avec-export">
      <h4>Historique</h4>
      <ImportExportTableau
        v-if="lignes.length"
        :titre="titreExport"
        :sous-titre="sousTitreExport"
        :nom-fichier="nomFichier"
        :colonnes-pdf="COLONNES_EXPORT"
        :lignes="lignesTriees"
      />
    </div>
    <p v-if="lignes.length === 0" class="tableau-vide">Aucun prix enregistré.</p>

    <table v-else class="tableau">
      <thead>
        <tr>
          <ColonneTri v-model="tri" cle="prix" class="nombre">Prix</ColonneTri>
          <ColonneTri v-model="tri" cle="colonne">{{ colonne }}</ColonneTri>
          <ColonneTri v-model="tri" cle="du">Du</ColonneTri>
          <ColonneTri v-model="tri" cle="au">Au</ColonneTri>
          <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
          <th class="actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ligne in lignesPage" :key="ligne.id">
          <td class="nombre"><strong>{{ formaterMontant(ligne.prix) }}</strong></td>
          <td>{{ libelle(ligne) }}</td>
          <td>{{ formaterDate(ligne.dateEffet) }}</td>
          <!-- Pas de date de fin = prix toujours en cours -->
          <td>{{ ligne.dateFin ? formaterDate(ligne.dateFin) : '—' }}</td>
          <td>
            <span class="badge" :class="ligne.dateFin ? 'badge-gris' : 'badge-vert'">
              {{ ligne.dateFin ? 'Clôturé' : 'En cours' }}
            </span>
          </td>
          <td class="actions">
            <!-- Seul le prix EN COURS peut être corrigé (erreur de saisie) -->
            <button v-si-modif v-if="!ligne.dateFin" class="bouton-lien" title="Corriger une erreur de saisie" @click="emit('corriger', ligne)">
              Corriger
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <Pagination v-model:page="page" v-model:taille="taille" :total="lignes.length" />
  </div>
</template>

<script setup>
import { toRef } from 'vue'
import { formaterDate, formaterMontant } from '@/utils/format'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { utiliserTableau } from '@/utils/pagination'

const emit = defineEmits(['corriger'])

const props = defineProps({
  lignes: { type: Array, required: true },
  colonne: { type: String, required: true },
  libelle: { type: Function, required: true },
  titreExport: { type: String, default: 'Historique des prix' },
  sousTitreExport: { type: String, default: '' },
  nomFichier: { type: String, default: 'historique_prix' },
})

// Export PDF / Excel : toutes les lignes, dans l'ordre du tri choisi
const COLONNES_EXPORT = [
  { titre: 'Prix', valeur: (p) => formaterMontant(p.prix), droite: true },
  { titre: props.colonne, valeur: (p) => props.libelle(p) },
  { titre: 'Du', valeur: (p) => formaterDate(p.dateEffet) },
  { titre: 'Au', valeur: (p) => (p.dateFin ? formaterDate(p.dateFin) : '—') },
  { titre: 'Statut', valeur: (p) => (p.dateFin ? 'Clôturé' : 'En cours') },
]

// Pagination de l'historique (retour à la page 1 quand on change de médicament)
const lignes = toRef(props, 'lignes')
// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  prix: (p) => p.prix,
  colonne: (p) => props.libelle(p),
  du: (p) => p.dateEffet,
  au: (p) => p.dateFin,
  statut: (p) => (p.dateFin ? 'Clôturé' : 'En cours'),
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(lignes, [lignes], VALEURS_TRI)
</script>

<style scoped>
h4 { margin: 0.5rem 0; font-size: 0.9rem; color: var(--texte-sur-fond); }
</style>
