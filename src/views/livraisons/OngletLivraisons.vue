<!--
  =============================================================================
  ONGLET « BONS DE LIVRAISON »
  =============================================================================
  Préparation et livraison des médicaments aux centres (cahier des charges §3.4).
  1. PRÉPARATION (brouillon) : à partir d'une commande validée (reste à livrer
     pré-rempli) ou livraison directe à un centre. On saisit médicament +
     quantité ; à l'enregistrement, le système CHOISIT LES LOTS (péremption la
     plus proche d'abord, jamais de lot périmé) et FIGE LE PRIX de vente.
  2. VALIDATION : on saisit la quantité réellement livrée par lot (≤ préparée).
     -> sortie du stock du dépôt, entrée dans le stock théorique du centre,
        commande mise à jour (partiellement livrée / livrée).
  3. BON DE LIVRAISON en PDF (centre, produits, lots, quantités, prix, date).
  ENCHAÎNEMENT (assistant, livraison d'une commande) : barre d'étapes en haut ;
  après validation, encart « Imprimer le bon » + « Préparer le reliquat » s'il
  reste à livrer. Une préparation déjà en cours pour la commande est ROUVERTE
  (pas de doublon). Livraison directe : inchangée (pas de barre d'étapes).

  Propriété : commandeAPreparer (commande choisie dans l'onglet Commandes)
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre, commande)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_LIVRAISON)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Bons de livraison" :sous-titre="sousTitrePdf" nom-fichier="livraisons" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="ouvrir()">+ Livraison directe</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° livraison</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="commande">Commande</ColonneTri>
            <ColonneTri v-model="tri" cle="lignes" class="nombre">Lignes</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lignesPage" :key="l.id">
            <td class="code">{{ l.numero }}</td>
            <td>{{ formaterDate(l.dateLivraison) }}</td>
            <td><strong>{{ l.centre.nom }}</strong></td>
            <td>{{ l.commande?.numero || 'Directe' }}</td>
            <td class="nombre">{{ l._count?.lignes ?? 0 }}</td>
            <td class="nombre">{{ formaterMontant(l.montantTotal) }}</td>
            <td><span class="badge" :class="STATUTS_LIVRAISON[l.statut]?.badge">{{ STATUTS_LIVRAISON[l.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(l)">{{ l.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-if="l.statut !== 'ANNULEE'" v-si-imprimer class="bouton-lien" title="Bon de livraison (PDF)" @click="imprimer(l)">Bon PDF</button>
              <button class="bouton-lien" @click="docPieces = l">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="livraisonsAffichees.length" />
      <p v-if="!chargement && livraisonsAffichees.length === 0" class="tableau-vide">Aucune livraison.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== PRÉPARATION / CONSULTATION ===================== -->
    <FenetreModale v-if="formulaire" :titre="titreFormulaire" tres-large @fermer="formulaire = null">
      <!-- Où en est la livraison dans le circuit (seulement pour une livraison de commande) -->
      <EtapesCircuit v-if="formulaire.commandeId && formulaire.statut !== 'ANNULEE'" :etapes="ETAPES_LIVRAISON" :courante="etape.numero" :aide="etape.aide" />

      <!-- Dernière étape : livraison validée -> bon de livraison, et reliquat éventuel -->
      <div v-if="formulaire.commandeId && formulaire.statut === 'VALIDEE'" class="encart-suite">
        <div>
          <strong>Livraison validée.</strong>
          <span v-if="formulaire.resteCommande > 0">
            Il reste <strong>{{ formaterNombre(formulaire.resteCommande) }}</strong> unité(s) à livrer sur la commande {{ formulaire.commandeNumero }}.
          </span>
          <span v-else>La commande {{ formulaire.commandeNumero }} est entièrement livrée.</span>
        </div>
        <div class="encart-suite-boutons">
          <button v-si-imprimer type="button" @click="imprimer(formulaire)">Imprimer le bon de livraison</button>
          <button v-if="formulaire.resteCommande > 0" v-si-modif type="button" class="bouton-secondaire" @click="preparerCommande({ id: formulaire.commandeId })">
            Préparer le reliquat
          </button>
        </div>
      </div>

      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_LIVRAISON[formulaire.statut]?.badge">{{ STATUTS_LIVRAISON[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'BROUILLON'">
          Préparation enregistrée : les lots sont réservés. Saisissez les quantités réellement livrées puis « Valider la livraison ».
        </small>
      </div>

      <form id="form-livraison" class="grille-formulaire" @submit.prevent="enregistrer">
        <div>
          <label class="obligatoire">Centre de santé</label>
          <ListeDeroulante v-model="formulaire.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" :desactive="!!formulaire.commandeId || !!formulaire.id" />
        </div>
        <div>
          <label class="obligatoire">Date de livraison</label>
          <input v-model="formulaire.dateLivraison" type="date" required :disabled="lectureSeule" />
        </div>
        <div v-if="formulaire.commandeNumero" class="pleine-largeur info-commande">
          Livraison de la commande <strong>{{ formulaire.commandeNumero }}</strong> : quantités pré-remplies avec le reste à livrer (accordé − déjà livré).
        </div>

        <!-- 1. Quantités à préparer, par médicament -->
        <div v-if="!lectureSeule" class="pleine-largeur">
          <h4 class="section">1. Médicaments à préparer</h4>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th v-if="formulaire.commandeId" class="nombre">Reste à livrer</th>
                <th class="nombre">Quantité à préparer</th>
                <th class="nombre">Disponible au dépôt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.demandes" :key="index" :class="{ insuffisant: ligne.medicamentId && disponible(ligne) < (ligne.quantite || 0) }">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!formulaire.commandeId"
                    v-model="ligne.medicamentId"
                    :options="optionsParLigne[index]"
                    :champ-libelle="(m) => `${m.code} — ${m.designation} (dispo : ${formaterNombre(dispoTous[m.id] ?? 0)})`"
                    placeholder="Choisir…"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                </td>
                <td v-if="formulaire.commandeId" class="nombre">{{ formaterNombre(ligne.reste) }}</td>
                <td class="nombre"><input v-model.number="ligne.quantite" type="number" min="0" :max="formulaire.commandeId ? ligne.reste : undefined" step="1" /></td>
                <td class="nombre">
                  <strong :class="disponible(ligne) < (ligne.quantite || 0) ? 'manque' : 'suffisant'">{{ ligne.medicamentId ? formaterNombre(disponible(ligne)) : '—' }}</strong>
                </td>
                <td class="actions">
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.demandes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
          <button v-if="!formulaire.commandeId" type="button" class="bouton-lien" @click="formulaire.demandes.push({ medicamentId: null, quantite: 1 })">+ Ajouter un médicament</button>
          <p class="aide">Les lots sont choisis automatiquement à l'enregistrement (péremption la plus proche d'abord, lots périmés exclus).</p>
        </div>

        <!-- 2. Lots préparés (après enregistrement) -->
        <div v-if="formulaire.id" class="pleine-largeur">
          <h4 class="section">{{ lectureSeule ? 'Détail de la livraison (par lot)' : '2. Lots préparés et quantités livrées' }}</h4>
          <p v-if="demandesModifiees" class="alerte-modif">Quantités à préparer modifiées : cliquez sur « Enregistrer la préparation » pour recalculer les lots.</p>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Lot</th>
                <th>Péremption</th>
                <th class="nombre">Préparé</th>
                <th class="nombre">Livré</th>
                <th class="nombre">Prix unitaire</th>
                <th class="nombre">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in formulaire.lignes" :key="l.id">
                <td>{{ l.medicament.code }} — {{ l.medicament.designation }}</td>
                <td class="code">{{ l.lot?.numeroLot || '—' }}</td>
                <td>{{ l.lot?.datePeremption ? formaterDate(l.lot.datePeremption) : '—' }}</td>
                <td class="nombre">{{ formaterNombre(l.quantitePreparee) }}</td>
                <td class="nombre">
                  <input v-if="formulaire.statut === 'BROUILLON'" v-model.number="l.saisieLivree" type="number" min="0" :max="l.quantitePreparee" step="1" />
                  <strong v-else>{{ formaterNombre(l.quantiteLivree) }}</strong>
                </td>
                <td class="nombre">{{ formaterMontant(l.prixUnitaire) }}</td>
                <td class="nombre">{{ formaterMontant(quantiteLigne(l) * Number(l.prixUnitaire)) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6" class="nombre"><strong>MONTANT TOTAL</strong></td>
                <td class="nombre"><strong>{{ formaterMontant(montantTotal) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="pleine-largeur">
          <label>Observations</label>
          <textarea v-model.trim="formulaire.observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button v-if="formulaire.id" type="button" class="bouton-secondaire" @click="docPieces = formulaire">Pièces jointes</button>
        <button v-if="formulaire.id && formulaire.statut !== 'ANNULEE'" v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer(formulaire)">Bon de livraison (PDF)</button>
        <template v-if="!lectureSeule">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler la livraison</button>
          <button v-si-modif type="submit" form="form-livraison" :class="formulaire.id ? 'bouton-secondaire' : ''" :disabled="enregistrement">Enregistrer la préparation</button>
          <button v-if="formulaire.id" v-si-modif type="button" :disabled="enregistrement" @click="valider">Valider la livraison</button>
        </template>
      </template>
    </FenetreModale>

    <PiecesJointes v-if="docPieces" module="livraisons" type="Livraison" :id="docPieces.id" :titre="`Pièces de la livraison ${docPieces.numero}`" @fermer="docPieces = null" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import PiecesJointes from '@/components/PiecesJointes.vue'
import EtapesCircuit from '@/components/EtapesCircuit.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import {
  annulerLivraison,
  creerLivraison,
  disponibilites,
  listerLivraisons,
  medicamentsDisponibles,
  modifierLivraison,
  trouverCommandeCentre,
  trouverLivraison,
  validerLivraison,
} from '@/api/livraisons'
import { bonDeLivraisonPdf, ETAPE_LIVRAISON, ETAPES_LIVRAISON, optionsStatuts, STATUTS_LIVRAISON } from './livraisonsCommun'

const props = defineProps({
  /** Commande à livrer (bouton « Préparer la livraison » de l'onglet Commandes) */
  commandeAPreparer: { type: Object, default: null },
})
const store = useStore()

const livraisons = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const dispo = ref({}) // { [medicamentId]: quantité disponible au dépôt }
const docPieces = ref(null)
// Copie des quantités enregistrées : sert à détecter une modification non enregistrée
const demandesEnregistrees = ref('')

const centres = computed(() => store.state.referentiel.centres)
const centresActifs = computed(() => centres.value.filter((c) => c.actif || c.id === formulaire.value?.centreId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

// Livraison directe : la liste ne propose que les médicaments DISPONIBLES au dépôt
// (quantité > 0 sur des lots non périmés, préparations en cours déduites)
const dispoTous = ref({})
async function chargerMedicamentsDisponibles() {
  try {
    dispoTous.value = await medicamentsDisponibles()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}
// Options de chaque ligne (computed : recalculé seulement quand les lignes changent)
const medicamentsDispo = computed(() => medicamentsActifs.value.filter((m) => (dispoTous.value[m.id] ?? 0) > 0))
const optionsParLigne = computed(() => {
  const demandes = formulaire.value?.demandes || []
  return demandes.map((ligne) => {
    const dejaChoisis = new Set(demandes.filter((d) => d !== ligne).map((d) => d.medicamentId))
    const options = medicamentsDispo.value.filter((m) => !dejaChoisis.has(m.id))
    if (ligne.medicamentId && !options.some((m) => m.id === ligne.medicamentId)) {
      const choisi = medicaments.value.find((m) => m.id === ligne.medicamentId)
      if (choisi) options.unshift(choisi)
    }
    return options
  })
})
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

/** Étape du circuit où se trouve la livraison ouverte (barre d'étapes en haut de la fenêtre). */
const etape = computed(() => {
  const f = formulaire.value
  if (!f?.id) return { numero: ETAPE_LIVRAISON.PREPARATION, aide: 'Ajustez les quantités à préparer puis « Enregistrer la préparation » : les lots seront choisis automatiquement.' }
  if (f.statut === 'BROUILLON') return { numero: ETAPE_LIVRAISON.LIVRAISON, aide: 'Saisissez la quantité réellement livrée par lot puis « Valider la livraison ».' }
  return {
    numero: ETAPE_LIVRAISON.BON,
    aide: f.resteCommande > 0 ? 'Imprimez le bon de livraison, puis préparez le reliquat.' : 'Imprimez le bon de livraison : la commande est terminée.',
  }
})

const titreFormulaire = computed(() => {
  const f = formulaire.value
  if (f.id) return `Livraison ${f.numero}`
  return f.commandeNumero ? `Préparer la livraison de la commande ${f.commandeNumero}` : 'Nouvelle livraison directe'
})

const livraisonsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return livraisons.value
  return livraisons.value.filter((l) => [l.numero, l.centre.nom, l.commande?.numero].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    livraisons.value = await listerLivraisons(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// OUVERTURE DU FORMULAIRE
// ---------------------------------------------------------------------------

/** Ouvre une livraison existante (ou une nouvelle livraison directe si aucune). */
async function ouvrir(livraison = null) {
  chargerMedicamentsDisponibles()
  if (!livraison) {
    formulaire.value = { centreId: null, commandeId: null, dateLivraison: dateDuJour(), observations: '', demandes: [{ medicamentId: null, quantite: 1 }] }
    dispo.value = {}
    demandesEnregistrees.value = ''
    return
  }
  try {
    const l = await trouverLivraison(livraison.id)
    // Quantités préparées regroupées par médicament (une ligne par lot côté serveur)
    const parMedicament = new Map()
    for (const ligne of l.lignes) parMedicament.set(ligne.medicamentId, (parMedicament.get(ligne.medicamentId) || 0) + ligne.quantitePreparee)
    let restes = new Map()
    if (l.commandeId && l.statut !== 'ANNULEE') {
      // Reste à livrer de la commande, par médicament
      // (brouillon : pour la colonne « Reste à livrer » ; validée : pour proposer le reliquat)
      const c = await trouverCommandeCentre(l.commandeId)
      restes = new Map(c.lignes.map((x) => [x.medicamentId, Math.max(0, (x.quantiteAccordee || 0) - (x.quantiteLivree || 0))]))
    }
    // Total restant à livrer sur la commande (0 = commande terminée)
    const resteCommande = [...restes.values()].reduce((t, q) => t + q, 0)
    formulaire.value = {
      ...l,
      dateLivraison: l.dateLivraison.substring(0, 10),
      observations: l.observations || '',
      commandeNumero: l.commande?.numero || '',
      resteCommande,
      lignes: l.lignes.map((x) => ({ ...x, saisieLivree: x.quantitePreparee })),
      demandes: [...parMedicament].map(([medicamentId, quantite]) => ({ medicamentId, quantite, reste: restes.get(medicamentId) ?? quantite })),
    }
    demandesEnregistrees.value = JSON.stringify(formulaire.value.demandes.map((d) => [d.medicamentId, d.quantite]))
    if (l.statut === 'BROUILLON') await chargerDisponibilites()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/**
 * Nouvelle préparation à partir d'une commande validée (reste à livrer).
 * Si une préparation de cette commande est DÉJÀ en cours (brouillon), on la
 * rouvre au lieu d'en créer une seconde.
 */
async function preparerCommande(commande) {
  try {
    const c = await trouverCommandeCentre(commande.id)
    const enCours = (c.livraisons || []).find((l) => l.statut === 'BROUILLON')
    if (enCours) {
      store.dispatch('notifications/info', `Une préparation est déjà en cours pour la commande ${c.numero} (${enCours.numero}) : elle est rouverte.`)
      return ouvrir(enCours)
    }
    const demandes = c.lignes
      .map((l) => ({ medicamentId: l.medicamentId, reste: Math.max(0, (l.quantiteAccordee || 0) - (l.quantiteLivree || 0)) }))
      .filter((d) => d.reste > 0)
      .map((d) => ({ ...d, quantite: d.reste }))
    if (demandes.length === 0) return store.dispatch('notifications/erreur', `La commande ${c.numero} n'a plus rien à livrer.`)
    formulaire.value = {
      centreId: c.centreId,
      commandeId: c.id,
      commandeNumero: c.numero,
      dateLivraison: dateDuJour(),
      observations: '',
      demandes,
    }
    demandesEnregistrees.value = ''
    await chargerDisponibilites()
    // Quantité proposée limitée au disponible au dépôt
    for (const d of formulaire.value.demandes) d.quantite = Math.min(d.reste, disponible(d))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}
watch(
  () => props.commandeAPreparer,
  (commande) => commande && preparerCommande(commande),
  { immediate: true },
)

// ---------------------------------------------------------------------------
// OUTILS DU FORMULAIRE
// ---------------------------------------------------------------------------
async function chargerDisponibilites() {
  const ids = [...new Set(formulaire.value.demandes.map((d) => d.medicamentId).filter(Boolean))]
  try {
    dispo.value = await disponibilites(ids)
  } catch {
    // pas bloquant
  }
}
/** Disponible au dépôt pour cette ligne (+ ce que la préparation en cours réserve déjà). */
function disponible(ligne) {
  const reserveIci = (formulaire.value.lignes || []).filter((l) => l.medicamentId === ligne.medicamentId).reduce((t, l) => t + l.quantitePreparee, 0)
  // Valeur chargée pour la livraison ouverte, sinon celle de l'ouverture du formulaire
  // (pas d'appel au serveur à chaque changement de médicament : pas de clignotement)
  const base = dispo.value[ligne.medicamentId] ?? dispoTous.value[ligne.medicamentId] ?? 0
  return Math.max(0, base + reserveIci)
}
function libelleMedicament(id) {
  const m = medicaments.value.find((x) => x.id === id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function quantiteLigne(l) {
  return formulaire.value.statut === 'BROUILLON' ? Number(l.saisieLivree) || 0 : l.quantiteLivree
}
const montantTotal = computed(() => (formulaire.value?.lignes || []).reduce((t, l) => t + quantiteLigne(l) * Number(l.prixUnitaire), 0))
const demandesModifiees = computed(
  () => !!formulaire.value?.id && JSON.stringify(formulaire.value.demandes.map((d) => [d.medicamentId, d.quantite])) !== demandesEnregistrees.value,
)

// ---------------------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------------------

/** Enregistre la préparation : le serveur choisit les lots et fige les prix. */
async function enregistrer() {
  const f = formulaire.value
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  const lignes = f.demandes.filter((d) => d.medicamentId && Number(d.quantite) > 0).map((d) => ({ medicamentId: d.medicamentId, quantite: Number(d.quantite) }))
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Indiquez au moins une quantité à préparer.')
  const donnees = {
    dateLivraison: f.dateLivraison,
    observations: f.observations || undefined,
    lignes,
  }
  enregistrement.value = true
  try {
    const livraison = f.id
      ? await modifierLivraison(f.id, donnees)
      : await creerLivraison({ ...donnees, ...(f.commandeId ? { commandeId: f.commandeId } : { centreId: f.centreId }) })
    store.dispatch('notifications/succes', `Livraison ${livraison.numero} préparée : vérifiez les lots puis validez.`)
    await ouvrir(livraison)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Validation : sortie du dépôt + entrée dans le stock du centre. */
async function valider() {
  const f = formulaire.value
  if (demandesModifiees.value) return store.dispatch('notifications/erreur', 'Enregistrez d\'abord la préparation modifiée.')
  const trop = f.lignes.find((l) => (Number(l.saisieLivree) || 0) > l.quantitePreparee)
  if (trop) return store.dispatch('notifications/erreur', `« ${trop.medicament.designation} » : la quantité livrée dépasse la quantité préparée.`)
  const confirme = await confirmer({
    titre: `Valider la livraison ${f.numero} ?`,
    texte: `Montant : ${formaterMontant(montantTotal.value)}. Les quantités livrées sortent du stock du dépôt et entrent dans le stock du centre. Cette opération est définitive.`,
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const livraison = await validerLivraison(
      f.id,
      f.lignes.map((l) => ({ ligneId: l.id, quantiteLivree: Number(l.saisieLivree) || 0 })),
    )
    store.dispatch('notifications/succes', `Livraison ${livraison.numero} validée : stocks mis à jour.`)
    await ouvrir(livraison)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function annuler() {
  const f = formulaire.value
  const confirme = await confirmer({ titre: `Annuler la livraison ${f.numero} ?`, texte: 'Les lots réservés sont libérés. Aucun stock n\'est modifié.', boutonConfirmer: 'Oui, annuler', danger: true })
  if (!confirme) return
  enregistrement.value = true
  try {
    await ouvrir(await annulerLivraison(f.id))
    store.dispatch('notifications/succes', 'Livraison annulée.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Bon de livraison PDF (recharge la livraison complète). */
async function imprimer(livraison) {
  try {
    bonDeLivraisonPdf(await trouverLivraison(livraison.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (l) => l.numero,
  date: (l) => l.dateLivraison,
  centre: (l) => l.centre.nom,
  commande: (l) => l.commande?.numero,
  lignes: (l) => l._count?.lignes,
  montant: (l) => Number(l.montantTotal),
  statut: (l) => STATUTS_LIVRAISON[l.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(livraisonsAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [c ? `Centre : ${c.nom}` : 'Tous les centres', filtres.statut ? STATUTS_LIVRAISON[filtres.statut].libelle : 'tous les statuts'].join(' — ')
})
const COLONNES_PDF = [
  { titre: 'N° livraison', valeur: (l) => l.numero },
  { titre: 'Date', valeur: (l) => formaterDate(l.dateLivraison) },
  { titre: 'Centre', valeur: (l) => l.centre.nom },
  { titre: 'Commande', valeur: (l) => l.commande?.numero || 'Directe' },
  { titre: 'Montant', valeur: (l) => formaterMontant(l.montantTotal), droite: true, somme: (l) => (l.statut === 'ANNULEE' ? 0 : Number(l.montantTotal)), formatTotal: formaterMontant },
  { titre: 'Statut', valeur: (l) => STATUTS_LIVRAISON[l.statut]?.libelle },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.section { margin: 0.25rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.info-commande { padding: 0.6rem 0.85rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.88rem; }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .col-medicament { min-width: 320px; }
.lignes input[type='number'] { width: 100px; text-align: right; }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.manque { color: var(--danger); }
.suffisant { color: var(--primary-dark); }
tr.insuffisant td { background: #fffaf0; }
.aide { margin: 0.4rem 0 0; font-size: 0.8rem; color: var(--muted); }
.alerte-modif { margin: 0 0 0.5rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: #fff7e6; color: #8a5a00; font-size: 0.85rem; }
textarea { width: 100%; resize: vertical; }
</style>
