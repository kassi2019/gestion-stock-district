<!--
  =============================================================================
  ONGLET « RÉCEPTIONS »
  =============================================================================
  Enregistrement des médicaments réellement livrés par les fournisseurs.
  - À partir d'une COMMANDE (bouton « Réceptionner » ou choix de la commande) :
    les lignes sont pré-remplies avec les quantités RESTANT à recevoir
    (réception totale ou partielle) ;
  - ou réception DIRECTE (sans commande) : fournisseur + médicaments.
  - Pour chaque ligne : quantité reçue, prix unitaire, n° de lot et date de
    péremption (obligatoires pour un médicament « suivi par lot »). Un même
    médicament reçu en plusieurs lots : bouton « + lot ».
  - Brouillon (modifiable) -> VALIDÉE : c'est la VALIDATION qui fait entrer
    les médicaments dans le STOCK du dépôt (irréversible).
  - Bon de réception (PDF) et pièces justificatives (facture, bon de livraison).

  Propriété : commandeAReceptionner (commande choisie dans l'onglet Commandes)
  Événement : @modifie -> la page met à jour les compteurs
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, fournisseur, facture)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.fournisseurId" :options="fournisseurs" champ-libelle="raisonSociale" placeholder="Tous les fournisseurs" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_RECEPTION)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau
        titre="Réceptions fournisseurs"
        :sous-titre="sousTitrePdf"
        nom-fichier="receptions"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle réception</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° réception</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="fournisseur">Fournisseur</ColonneTri>
            <ColonneTri v-model="tri" cle="commande">Commande</ColonneTri>
            <ColonneTri v-model="tri" cle="facture">Facture fourn.</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in lignesPage" :key="r.id">
            <td class="code">{{ r.numero }}</td>
            <td>{{ formaterDate(r.dateReception) }}</td>
            <td><strong>{{ r.fournisseur.raisonSociale }}</strong></td>
            <td><span v-if="r.commande" class="code">{{ r.commande.numero }}</span><span v-else class="detail">Directe</span></td>
            <td>{{ r.numFactureFourn || '—' }}</td>
            <td class="nombre">{{ formaterMontant(r.montantTotal) }}</td>
            <td><span class="badge" :class="STATUTS_RECEPTION[r.statut]?.badge">{{ STATUTS_RECEPTION[r.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrirFormulaire(r)">{{ r.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-si-imprimer class="bouton-lien" title="Bon de réception (PDF)" @click="imprimer(r)">Bon PDF</button>
              <button class="bouton-lien" @click="docPieces = r">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="receptionsAffichees.length" />
      <p v-if="!chargement && receptionsAffichees.length === 0" class="tableau-vide">Aucune réception.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== FORMULAIRE / CONSULTATION ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? `Réception ${formulaire.numero}` : 'Nouvelle réception'"
      tres-large
      @fermer="formulaire = null"
    >
      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_RECEPTION[formulaire.statut]?.badge">{{ STATUTS_RECEPTION[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'VALIDEE'">
          Validée le {{ formaterDate(formulaire.dateValidation) }} : les médicaments sont entrés en stock.
        </small>
        <small v-else-if="formulaire.statut === 'BROUILLON'">Brouillon : le stock ne bouge qu'à la validation.</small>
      </div>

      <form id="form-reception" class="grille-formulaire trois-colonnes" @submit.prevent="enregistrer(false)">
        <div>
          <label>Commande d'origine</label>
          <!-- Consultation : simple texte (la commande peut être entièrement reçue) -->
          <input v-if="lectureSeule" :value="formulaire.commande?.numero || 'Réception directe'" disabled />
          <ListeDeroulante
            v-else
            v-model="formulaire.commandeId"
            :options="commandesEnAttente"
            :champ-libelle="(c) => `${c.numero} — ${c.fournisseur.raisonSociale}`"
            placeholder="Réception directe (sans commande)"
            :desactive="lectureSeule"
            @update:model-value="choisirCommande"
          />
        </div>
        <div>
          <label class="obligatoire">Fournisseur</label>
          <ListeDeroulante
            v-model="formulaire.fournisseurId"
            :options="fournisseursActifs"
            champ-libelle="raisonSociale"
            placeholder="— Choisir le fournisseur —"
            :desactive="lectureSeule || !!formulaire.commandeId"
          />
        </div>
        <div>
          <label class="obligatoire">Date de réception</label>
          <input v-model="formulaire.dateReception" type="date" required :disabled="lectureSeule" />
        </div>
        <div>
          <label>N° facture fournisseur</label>
          <input v-model.trim="formulaire.numFactureFourn" maxlength="50" :disabled="lectureSeule" />
        </div>
        <div>
          <label>N° bon de livraison</label>
          <input v-model.trim="formulaire.numBonLivraison" maxlength="50" :disabled="lectureSeule" />
        </div>
        <div></div>

        <!-- ---------- Lignes ---------- -->
        <div class="pleine-largeur">
          <h4 class="section">Médicaments reçus</h4>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th v-if="formulaire.commandeId" class="nombre">Reste</th>
                <th class="nombre">Qté reçue</th>
                <th class="nombre">Prix unitaire</th>
                <th>N° de lot</th>
                <th>Péremption</th>
                <th class="nombre">Montant</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.lignes" :key="index">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule && !formulaire.commandeId"
                    v-model="ligne.medicamentId"
                    :options="medicamentsActifs"
                    :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                    placeholder="Choisir…"
                    @update:model-value="(id) => choisirMedicament(ligne, id)"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                  <small class="detail">
                    <template v-if="uniteDe(ligne.medicamentId)">par {{ uniteDe(ligne.medicamentId) }}</template>
                    <span v-if="suiviLot(ligne.medicamentId)" class="lot-requis"> · lot et péremption obligatoires</span>
                  </small>
                </td>
                <td v-if="formulaire.commandeId" class="nombre detail">{{ ligne.reste ?? '—' }}</td>
                <td class="nombre"><input v-model.number="ligne.quantite" type="number" min="1" step="1" required :disabled="lectureSeule" /></td>
                <td class="nombre"><input v-model.number="ligne.prixUnitaire" type="number" min="0" step="1" required :disabled="lectureSeule" /></td>
                <td><input v-model.trim="ligne.numeroLot" maxlength="50" class="champ-lot" :required="suiviLot(ligne.medicamentId)" :disabled="lectureSeule" /></td>
                <td><input v-model="ligne.datePeremption" type="date" :required="suiviLot(ligne.medicamentId)" :disabled="lectureSeule" /></td>
                <td class="nombre"><strong>{{ formaterMontant((ligne.quantite || 0) * (ligne.prixUnitaire || 0)) }}</strong></td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien" title="Même médicament, autre lot" @click="ajouterLot(index)">+ lot</button>
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td :colspan="formulaire.commandeId ? 6 : 5">
                  <button v-if="!lectureSeule && !formulaire.commandeId" type="button" class="bouton-lien" @click="ajouterLigne">
                    + Ajouter un médicament
                  </button>
                </td>
                <td class="nombre total">{{ formaterMontant(totalFormulaire) }}</td>
                <td v-if="!lectureSeule"></td>
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
        <button v-if="formulaire.id && formulaire.statut !== 'ANNULEE'" v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer(formulaire)">
          Bon de réception PDF
        </button>
        <template v-if="!lectureSeule">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">
            Annuler la réception
          </button>
          <button v-si-modif type="submit" form="form-reception" class="bouton-secondaire" :disabled="enregistrement">
            Enregistrer le brouillon
          </button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Valider (entrée en stock)</button>
        </template>
      </template>
    </FenetreModale>

    <!-- Pièces jointes -->
    <PiecesJointes
      v-if="docPieces"
      type="Reception"
      :id="docPieces.id"
      :titre="`Pièces de la réception ${docPieces.numero}`"
      @fermer="docPieces = null"
    />
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
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import {
  annulerReception,
  creerReception,
  listerCommandes,
  listerReceptions,
  modifierReception,
  trouverCommande,
  trouverReception,
  validerReception,
} from '@/api/achats'
import { bonDeReceptionPdf, optionsStatuts, STATUTS_RECEPTION } from './achatsCommun'

const props = defineProps({
  /** Commande à réceptionner (bouton « Réceptionner » de l'onglet Commandes) */
  commandeAReceptionner: { type: Object, default: null },
})
const emit = defineEmits(['modifie'])
const store = useStore()

const receptions = ref([])
const commandesEnAttente = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ fournisseurId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const docPieces = ref(null)

// Listes du Paramétrage
const fournisseurs = computed(() => store.state.referentiel.fournisseurs)
const fournisseursActifs = computed(() => fournisseurs.value.filter((f) => f.actif || f.id === formulaire.value?.fournisseurId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

/** Réception non modifiable (validée ou annulée). */
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

const receptionsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return receptions.value
  return receptions.value.filter((r) =>
    [r.numero, r.fournisseur.raisonSociale, r.numFactureFourn, r.commande?.numero].some((v) => (v || '').toLowerCase().includes(texte)),
  )
})

async function charger() {
  chargement.value = true
  try {
    ;[receptions.value, commandesEnAttente.value] = await Promise.all([
      listerReceptions(filtres),
      // Commandes qu'on peut réceptionner : validées ou partiellement reçues
      Promise.all([listerCommandes({ statut: 'VALIDEE' }), listerCommandes({ statut: 'PARTIELLEMENT_RECUE' })]).then(([a, b]) => [...a, ...b]),
    ])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// FORMULAIRE
// ---------------------------------------------------------------------------

function videFormulaire() {
  return {
    commandeId: null,
    fournisseurId: null,
    dateReception: dateDuJour(),
    numFactureFourn: '',
    numBonLivraison: '',
    observations: '',
    lignes: [nouvelleLigne()],
  }
}
function nouvelleLigne(medicamentId = null, quantite = 1, prixUnitaire = 0) {
  return { medicamentId, quantite, prixUnitaire, numeroLot: '', datePeremption: '' }
}

/** Ouvre une réception existante (détail) ou une nouvelle réception. */
async function ouvrirFormulaire(reception = null) {
  if (!reception) {
    formulaire.value = videFormulaire()
    return
  }
  try {
    const r = await trouverReception(reception.id)
    formulaire.value = {
      ...r,
      dateReception: r.dateReception.substring(0, 10),
      numFactureFourn: r.numFactureFourn || '',
      numBonLivraison: r.numBonLivraison || '',
      observations: r.observations || '',
      lignes: r.lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: l.quantite,
        prixUnitaire: Number(l.prixUnitaire),
        numeroLot: l.numeroLot || '',
        datePeremption: l.datePeremption ? l.datePeremption.substring(0, 10) : '',
      })),
    }
    // Brouillon lié à une commande : on affiche les restes à recevoir
    if (r.statut === 'BROUILLON' && r.commandeId) await completerRestes(r.commandeId)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Nouvelle réception à partir d'une commande : lignes = restes à recevoir. */
async function nouvelleDepuisCommande(commande) {
  formulaire.value = videFormulaire()
  formulaire.value.commandeId = commande.id
  await choisirCommande(commande.id)
}

/** Commande choisie : fournisseur + lignes pré-remplies avec les restes. */
async function choisirCommande(commandeId) {
  const f = formulaire.value
  if (!commandeId) {
    f.lignes = [nouvelleLigne()]
    return
  }
  try {
    const c = await trouverCommande(commandeId)
    f.fournisseurId = c.fournisseurId
    f.lignes = c.lignes
      .filter((l) => l.quantite - l.quantiteRecue > 0)
      .map((l) => ({ ...nouvelleLigne(l.medicamentId, l.quantite - l.quantiteRecue, Number(l.prixUnitaire)), reste: l.quantite - l.quantiteRecue }))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Affiche le reste à recevoir de chaque ligne d'un brouillon lié à une commande. */
async function completerRestes(commandeId) {
  const c = await trouverCommande(commandeId)
  for (const ligne of formulaire.value.lignes) {
    const lc = c.lignes.find((l) => l.medicamentId === ligne.medicamentId)
    ligne.reste = lc ? lc.quantite - lc.quantiteRecue : null
  }
}

function ajouterLigne() {
  formulaire.value.lignes.push(nouvelleLigne())
}

/** Même médicament reçu dans un autre lot : nouvelle ligne juste en dessous. */
function ajouterLot(index) {
  const l = formulaire.value.lignes[index]
  formulaire.value.lignes.splice(index + 1, 0, { ...nouvelleLigne(l.medicamentId, 1, l.prixUnitaire), reste: l.reste })
}

/** Médicament choisi (réception directe) : prix prérempli avec son prix d'achat actuel. */
function choisirMedicament(ligne, medicamentId) {
  const med = medicaments.value.find((m) => m.id === medicamentId)
  if (med && med.prixAchatActuel !== null && !ligne.prixUnitaire) ligne.prixUnitaire = Number(med.prixAchatActuel)
}

function medicament(id) {
  return medicaments.value.find((m) => m.id === id)
}
function libelleMedicament(id) {
  const m = medicament(id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function uniteDe(id) {
  return medicament(id)?.uniteVente?.libelle?.toLowerCase() || ''
}
function suiviLot(id) {
  return !!medicament(id)?.suiviLot
}

const totalFormulaire = computed(() =>
  (formulaire.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0),
)

/**
 * Enregistre la réception (brouillon) ; avec « valider », la valide ensuite :
 * les médicaments entrent alors dans le STOCK du dépôt.
 */
async function enregistrer(valider) {
  const f = formulaire.value
  if (!f.commandeId && !f.fournisseurId) return store.dispatch('notifications/erreur', 'Choisissez le fournisseur (ou la commande).')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament reçu.')
  if (lignes.some((l) => !(l.quantite >= 1))) return store.dispatch('notifications/erreur', 'Chaque quantité reçue doit être au moins 1.')

  if (valider) {
    const sansLot = lignes.find((l) => suiviLot(l.medicamentId) && (!l.numeroLot || !l.datePeremption))
    if (sansLot) {
      return store.dispatch('notifications/erreur', `${libelleMedicament(sansLot.medicamentId)} : n° de lot et péremption obligatoires.`)
    }
    const confirme = await confirmer({
      titre: 'Valider la réception ?',
      texte: `Les ${lignes.length} ligne(s) reçue(s) vont ENTRER EN STOCK au dépôt. Une réception validée ne peut plus être modifiée (correction par régularisation).`,
      boutonConfirmer: 'Oui, valider et mettre en stock',
    })
    if (!confirme) return
  }

  enregistrement.value = true
  try {
    const donnees = {
      commandeId: f.commandeId || undefined,
      fournisseurId: f.fournisseurId || undefined,
      dateReception: f.dateReception,
      numFactureFourn: f.numFactureFourn || undefined,
      numBonLivraison: f.numBonLivraison || undefined,
      observations: f.observations || undefined,
      lignes: lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire) || 0,
        numeroLot: l.numeroLot || undefined,
        datePeremption: l.datePeremption || undefined,
      })),
    }
    let reception = f.id ? await modifierReception(f.id, donnees) : await creerReception(donnees)
    if (valider) reception = await validerReception(reception.id)
    store.dispatch(
      'notifications/succes',
      valider ? `Réception ${reception.numero} validée : stock mis à jour.` : `Réception ${reception.numero} enregistrée (brouillon).`,
    )
    await ouvrirFormulaire(reception)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function annuler() {
  const f = formulaire.value
  const confirme = await confirmer({
    titre: `Annuler la réception ${f.numero} ?`,
    texte: 'Elle restera dans l\'historique avec le statut « Annulée » (le stock n\'a pas bougé).',
    boutonConfirmer: 'Oui, annuler',
    danger: true,
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const reception = await annulerReception(f.id)
    store.dispatch('notifications/succes', `Réception ${reception.numero} annulée.`)
    await ouvrirFormulaire(reception)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function imprimer(reception) {
  try {
    await bonDeReceptionPdf(await trouverReception(reception.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination, PDF de la liste
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (r) => r.numero,
  date: (r) => r.dateReception,
  fournisseur: (r) => r.fournisseur.raisonSociale,
  commande: (r) => r.commande?.numero,
  facture: (r) => r.numFactureFourn,
  montant: (r) => Number(r.montantTotal),
  statut: (r) => STATUTS_RECEPTION[r.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(receptionsAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const f = fournisseurs.value.find((x) => x.id === filtres.fournisseurId)
  return [
    f ? `Fournisseur : ${f.raisonSociale}` : 'Tous les fournisseurs',
    filtres.statut ? STATUTS_RECEPTION[filtres.statut].libelle : 'tous les statuts',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ].filter(Boolean).join(' — ')
})

const COLONNES_PDF = [
  { titre: 'N° réception', valeur: (r) => r.numero },
  { titre: 'Date', valeur: (r) => formaterDate(r.dateReception) },
  { titre: 'Fournisseur', valeur: (r) => r.fournisseur.raisonSociale },
  { titre: 'Commande', valeur: (r) => r.commande?.numero || 'Directe' },
  { titre: 'Facture', valeur: (r) => r.numFactureFourn },
  { titre: 'Montant', valeur: (r) => formaterMontant(r.montantTotal), droite: true, somme: (r) => r.montantTotal, formatTotal: formaterMontant },
  { titre: 'Statut', valeur: (r) => STATUTS_RECEPTION[r.statut]?.libelle },
]

// Commande à réceptionner reçue de l'onglet Commandes
watch(
  () => props.commandeAReceptionner,
  (commande) => {
    if (commande) nouvelleDepuisCommande(commande)
  },
  { immediate: true },
)

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'fournisseurs' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.detail { font-size: 0.78rem; color: var(--muted); }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.section {
  margin: 0.25rem 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.grille-formulaire.trois-colonnes { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 900px) {
  .grille-formulaire.trois-colonnes { grid-template-columns: 1fr 1fr; }
}
.lignes td { padding: 0.45rem 0.4rem; }
.lignes .col-medicament { min-width: 240px; }
.lignes .col-medicament .detail { display: block; }
.lignes input[type='number'] { width: 90px; text-align: right; }
.lignes input[type='date'] { width: 140px; }
.champ-lot { width: 120px; }
.lot-requis { color: #b35c00; font-weight: 600; }
.lignes .total { font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
textarea { width: 100%; resize: vertical; }
</style>
