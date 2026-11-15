<!--
  =============================================================================
  PIÈCES JUSTIFICATIVES D'UN DOCUMENT (fenêtre)
  =============================================================================
  Liste des fichiers joints à une commande ou une réception (facture
  fournisseur, bon de livraison, bon de réception signé...), avec :
    - « Ouvrir » (dans un nouvel onglet) ;
    - « Ajouter » : choix du type de pièce + fichier PDF / JPEG / PNG (10 Mo max) ;
    - « Supprimer ».
  Les boutons Ajouter / Supprimer suivent le droit « Modifier » du module.

  Utilisation :
      <PiecesJointes v-if="docPieces" module="achats" type="Reception" :id="docPieces.id"
                     :titre="`Pièces de la réception ${docPieces.numero}`" @fermer="docPieces = null" />
  =============================================================================
-->
<template>
  <FenetreModale :titre="titre" large @fermer="emit('fermer')">
    <!-- Ajout d'une pièce -->
    <div v-si-modif class="ajout">
      <div class="champ-type">
        <label>Type de pièce</label>
        <ListeDeroulante v-model="libelle" :options="TYPES_PIECES" :effacable="false" />
      </div>
      <label class="bouton-fichier" :class="{ inactif: envoi }">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden :disabled="envoi" @change="ajouter" />
        <Icone nom="televerser" :taille="17" />
        {{ envoi ? 'Envoi…' : 'Joindre un fichier' }}
      </label>
      <small class="aide">PDF, JPEG ou PNG — 10 Mo maximum.</small>
    </div>

    <!-- Liste -->
    <p v-if="chargement" class="tableau-vide">Chargement…</p>
    <p v-else-if="pieces.length === 0" class="tableau-vide">Aucune pièce jointe.</p>
    <ul v-else class="liste-pieces">
      <li v-for="piece in pieces" :key="piece.id">
        <span class="icone-fichier" :class="piece.mimeType === 'application/pdf' ? 'pdf' : 'image'">
          {{ piece.mimeType === 'application/pdf' ? 'PDF' : 'IMG' }}
        </span>
        <div class="infos">
          <strong>{{ piece.libelle || piece.nomFichier }}</strong>
          <small>
            {{ piece.nomFichier }} · {{ taille(piece.taille) }} · ajouté le {{ formaterDate(piece.createdAt) }}
            par {{ piece.utilisateur?.prenoms }} {{ piece.utilisateur?.nom }}
          </small>
        </div>
        <button class="bouton-lien" @click="ouvrir(piece)">Ouvrir</button>
        <button v-si-modif class="bouton-lien danger" @click="supprimer(piece)">Supprimer</button>
      </li>
    </ul>

    <template #pied>
      <button class="bouton-secondaire" @click="emit('fermer')">Fermer</button>
    </template>
  </FenetreModale>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Icone from '@/components/Icone.vue'
import { confirmer } from '@/utils/alertes'
import { formaterDate } from '@/utils/format'
import { ajouterPiece, listerPieces, ouvrirPiece, supprimerPiece } from '@/api/pieces'

const props = defineProps({
  /** Module : 'achats', 'stock' ou 'livraisons' (routes et droits du module) */
  module: { type: String, default: 'achats' },
  /** Type de document : 'CommandeFournisseur', 'Reception', 'MouvementStock', 'CommandeCentre' ou 'Livraison' */
  type: { type: String, required: true },
  id: { type: Number, required: true },
  titre: { type: String, default: 'Pièces justificatives' },
})
const emit = defineEmits(['fermer', 'modifie'])

const store = useStore()

/** Types de pièces proposés (cahier des charges §3.2). */
const TYPES_PIECES = {
  stock: ['Procès-verbal', 'Bordereau de transfert', 'Fiche de comptage', 'Constat de péremption', 'Autre'],
  livraisons: ['Bon de livraison signé', 'Demande du centre', 'Bordereau de transport', 'Autre'],
  achats: ['Facture fournisseur', 'Bon de livraison', 'Bon de réception signé', 'Bon de commande signé', 'Autre'],
}[props.module] || ['Autre']

const pieces = ref([])
const chargement = ref(false)
const envoi = ref(false)
const libelle = ref(TYPES_PIECES[props.type === 'CommandeFournisseur' ? 3 : props.type === 'CommandeCentre' ? 1 : 0])

async function charger() {
  chargement.value = true
  try {
    pieces.value = await listerPieces(props.module, props.type, props.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

async function ajouter(evenement) {
  const fichier = evenement.target.files[0]
  evenement.target.value = ''
  if (!fichier) return
  if (fichier.size > 10 * 1024 * 1024) {
    store.dispatch('notifications/erreur', 'Fichier trop lourd (10 Mo maximum).')
    return
  }
  envoi.value = true
  try {
    await ajouterPiece(props.module, props.type, props.id, fichier, libelle.value)
    store.dispatch('notifications/succes', 'Pièce jointe ajoutée.')
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    envoi.value = false
  }
}

async function ouvrir(piece) {
  try {
    await ouvrirPiece(props.module, piece.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function supprimer(piece) {
  const confirme = await confirmer({
    titre: 'Supprimer cette pièce jointe ?',
    texte: `« ${piece.libelle || piece.nomFichier} » sera supprimée définitivement.`,
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await supprimerPiece(props.module, piece.id)
    store.dispatch('notifications/succes', 'Pièce jointe supprimée.')
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Taille lisible (ex. 245 Ko, 1,2 Mo). */
function taille(octets) {
  if (!octets) return ''
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

onMounted(charger)
</script>

<style scoped>
.ajout {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: var(--fond-pale);
}
.champ-type { width: 240px; }
.bouton-fichier {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.bouton-fichier:hover { background: var(--primary-dark); }
.bouton-fichier.inactif { opacity: 0.6; cursor: wait; }
.aide { font-size: 0.8rem; color: var(--muted); }

.liste-pieces { margin: 0; padding: 0; list-style: none; }
.liste-pieces li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 0.25rem;
  border-bottom: 1px solid var(--border);
}
.icone-fichier {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 800;
}
.icone-fichier.pdf { background: #fdecec; color: var(--danger); }
.icone-fichier.image { background: #e8f1fd; color: #1d4f91; }
.infos { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.infos small { font-size: 0.78rem; color: var(--muted); }
</style>
