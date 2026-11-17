<!--
  =============================================================================
  ONGLET « RAPPORTS MENSUELS »
  =============================================================================
  Rapports de consommation des centres (cahier des charges §3.5) :
  - SAISIE (brouillon) : centre, mois, médicaments et quantités DÉCLARÉES.
    Valeur de chaque ligne au prix de vente applicable, total du mois.
    Aide : « Ajouter les médicaments du centre » (ceux de son stock théorique).
  - SOUMISSION, puis au besoin RENVOI en brouillon (motif) pour correction.
  - VÉRIFICATION SUR PLACE (facultative) : l'agent du district se rend au
    centre, contrôle les quantités déclarées et saisit la quantité constatée.
    C'est la quantité VÉRIFIÉE qui est retenue (montant et stock).
    « Fiche de vérification » : PDF à emporter, à remplir sur place.
  - VALIDATION : quantités retenues déduites du stock théorique du centre.
  Brouillon -> Soumis -> Validé -> Facturé (par le module Facturation).
  ENCHAÎNEMENT (assistant) : barre d'étapes en haut de la fenêtre (saisie,
  vérification facultative, validation, facturation) ; rapport validé :
  bouton « Aller à la facturation » (si le profil a accès à ce module).
  Propriété : aOuvrir (rapport à ouvrir, choisi dans le tableau de suivi)
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre petit">
        <ListeDeroulante v-model="filtres.mois" :options="OPTIONS_MOIS" placeholder="Tous les mois" />
      </div>
      <input v-model.number="filtres.annee" class="annee" type="number" min="2000" max="2100" title="Année" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts()" placeholder="Tous les statuts" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Rapports mensuels de consommation" :sous-titre="sousTitrePdf" nom-fichier="rapports_consommation" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <!-- Plus de création ici : les nouveaux rapports se font dans « Rapports centre » (spec nov. 2026) -->
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° rapport</ColonneTri>
            <ColonneTri v-model="tri" cle="periode">Période</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="lignes" class="nombre">Lignes</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="verifie">Vérification</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in lignesPage" :key="r.id">
            <td class="code">{{ r.numero }}</td>
            <td>{{ libellePeriode(r.annee, r.mois) }}</td>
            <td><strong>{{ r.centre.nom }}</strong></td>
            <td class="nombre">{{ r._count?.lignes ?? 0 }}</td>
            <td class="nombre">{{ formaterMontant(r.montantTotal) }}</td>
            <td>
              <span v-if="r.verifie" class="badge" :class="r.lignesAvecEcart ? 'badge-orange' : 'badge-vert'">
                {{ r.lignesAvecEcart ? `Vérifié — ${r.lignesAvecEcart} écart(s)` : 'Vérifié — conforme' }}
              </span>
              <span v-else class="detail">Non vérifié</span>
            </td>
            <td><span class="badge" :class="STATUTS_RAPPORT[r.statut]?.badge">{{ STATUTS_RAPPORT[r.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(r)">{{ r.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-si-imprimer class="bouton-lien" title="Rapport (PDF)" @click="imprimer(r)">PDF</button>
              <button class="bouton-lien" @click="docPieces = r">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="rapportsAffiches.length" />
      <p v-if="!chargement && rapportsAffiches.length === 0" class="tableau-vide">Aucun rapport.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== SAISIE / CONSULTATION ===================== -->
    <FenetreModale v-if="formulaire" :titre="titreFormulaire" tres-large @fermer="formulaire = null">
      <!-- Où en est le rapport dans le circuit (assistant pas à pas) -->
      <EtapesCircuit :etapes="ETAPES_RAPPORT" :courante="etape.numero" :aide="etape.aide" />

      <!-- Rapport validé : la suite se fait dans le module Facturation -->
      <div v-if="formulaire.statut === 'VALIDE'" class="encart-suite">
        <div><strong>Rapport validé.</strong> Le stock théorique du centre est à jour ; le rapport attend sa facture.</div>
        <div v-if="peutVoirFacturation" class="encart-suite-boutons">
          <button type="button" @click="allerFacturation">Aller à la facturation</button>
        </div>
      </div>

      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_RAPPORT[formulaire.statut]?.badge">{{ STATUTS_RAPPORT[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'BROUILLON'">Brouillon : modifiable. « Soumettre » le transmet pour vérification et validation.</small>
        <small v-else-if="formulaire.statut === 'SOUMIS'">Soumis : vérification sur place possible, puis validation (déduction du stock théorique du centre).</small>
        <small v-else>Validé le {{ formaterDate(formulaire.dateValidation) }} par {{ nomPersonne(formulaire.validateur) }}.</small>
      </div>

      <!-- Rapport renvoyé pour correction -->
      <div v-if="formulaire.statut === 'BROUILLON' && formulaire.motifRenvoi" class="encart encart-alerte">
        <strong>Rapport renvoyé pour correction :</strong> {{ formulaire.motifRenvoi }}
      </div>

      <!-- Résultat de la vérification sur place -->
      <div v-if="formulaire.dateVerification" class="encart encart-verif">
        <strong>Vérification sur place du {{ formaterDate(formulaire.dateVerification) }}</strong>
        par {{ nomPersonne(formulaire.verificateur) }}
        <span v-if="formulaire.agentsVerification"> — agents présents : {{ formulaire.agentsVerification }}</span>
        <div v-if="formulaire.observationsVerification" class="detail">Constats : {{ formulaire.observationsVerification }}</div>
        <div class="detail">Les quantités vérifiées remplacent les quantités déclarées pour le montant et le stock.</div>
      </div>

      <form id="form-rapport" class="grille-formulaire trois" @submit.prevent="enregistrer(false)">
        <div>
          <label class="obligatoire">Centre de santé</label>
          <ListeDeroulante v-model="formulaire.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" :desactive="lectureSeule" @update:model-value="chargerStockCentre" />
        </div>
        <div>
          <label class="obligatoire">Mois</label>
          <ListeDeroulante v-model="formulaire.mois" :options="OPTIONS_MOIS" :effacable="false" :desactive="lectureSeule" />
        </div>
        <div>
          <label class="obligatoire">Année</label>
          <input v-model.number="formulaire.annee" type="number" min="2000" max="2100" required :disabled="lectureSeule" />
        </div>

        <div class="pleine-largeur">
          <div class="entete-section">
            <h4 class="section">Médicaments consommés</h4>
            <button v-if="!lectureSeule && formulaire.centreId" type="button" class="bouton-lien" @click="ajouterMedicamentsDuCentre">
              + Ajouter les médicaments du centre ({{ stockCentre.filter((s) => s.quantiteTheorique > 0).length }})
            </button>
          </div>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th class="nombre">Stock théorique</th>
                <th class="nombre">Déclaré</th>
                <template v-if="formulaire.dateVerification">
                  <th class="nombre">Vérifié</th>
                  <th class="nombre">Écart</th>
                </template>
                <th class="nombre">Prix unitaire</th>
                <th class="nombre">Montant</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.lignes" :key="index" :class="{ 'au-dela': depasseStock(ligne) }">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="ligne.medicamentId"
                    :options="optionsParLigne[index]"
                    :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                    placeholder="Choisir…"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                  <small v-if="ligne.commentaire" class="detail commentaire">« {{ ligne.commentaire }} »</small>
                </td>
                <td class="nombre">{{ ligne.medicamentId ? formaterNombre(stockTheorique(ligne)) : '—' }}</td>
                <td class="nombre">
                  <input v-if="!lectureSeule" v-model.number="ligne.quantite" type="number" min="0" step="1" required />
                  <strong v-else>{{ formaterNombre(ligne.quantite) }}</strong>
                  <small v-if="depasseStock(ligne)" class="message-attention">Au-delà du stock théorique</small>
                </td>
                <template v-if="formulaire.dateVerification">
                  <td class="nombre">{{ ligne.quantiteVerifiee === null || ligne.quantiteVerifiee === undefined ? '—' : formaterNombre(ligne.quantiteVerifiee) }}</td>
                  <td class="nombre" :class="classeEcart(ligne)">{{ texteEcart(ligne) }}</td>
                </template>
                <td class="nombre">{{ ligne.medicamentId ? formaterMontant(prixDe(ligne)) : '—' }}</td>
                <td class="nombre">{{ ligne.medicamentId ? formaterMontant(montantLigne(ligne)) : '—' }}</td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td :colspan="formulaire.dateVerification ? 6 : 4" class="nombre"><strong>MONTANT TOTAL DU MOIS</strong></td>
                <td class="nombre"><strong>{{ formaterMontant(montantTotal) }}</strong></td>
                <td v-if="!lectureSeule"></td>
              </tr>
            </tfoot>
          </table>
          <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="formulaire.lignes.push(nouvelleLigne())">+ Ajouter un médicament</button>
          <p v-if="!lectureSeule" class="aide">
            Prix de vente applicable au centre pour le mois déclaré (consommables à 0). Le prix définitif est calculé à l'enregistrement.
          </p>
        </div>

        <div class="pleine-largeur">
          <label>Observations</label>
          <textarea v-model.trim="formulaire.observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <template v-if="formulaire.id">
          <button type="button" class="bouton-secondaire" @click="docPieces = formulaire">Pièces jointes</button>
          <button v-si-imprimer type="button" class="bouton-secondaire" @click="rapportPdf(formulaire)">Rapport (PDF)</button>
        </template>
        <!-- Brouillon -->
        <template v-if="!formulaire.id || formulaire.statut === 'BROUILLON'">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="supprimer">Supprimer</button>
          <button v-si-modif type="submit" form="form-rapport" class="bouton-secondaire" :disabled="enregistrement">Enregistrer le brouillon</button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Enregistrer et soumettre</button>
        </template>
        <!-- Soumis -->
        <template v-else-if="formulaire.statut === 'SOUMIS'">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="renvoyer">Renvoyer en brouillon</button>
          <button v-si-imprimer type="button" class="bouton-secondaire" @click="ficheVerificationPdf(formulaire)">Fiche de vérification (PDF)</button>
          <button v-si-modif type="button" class="bouton-secondaire" @click="ouvrirVerification">Vérification sur place</button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="valider">Valider le rapport</button>
        </template>
      </template>
    </FenetreModale>

    <!-- ===================== VÉRIFICATION SUR PLACE ===================== -->
    <FenetreModale v-if="verification" :titre="`Vérification sur place — ${formulaire.numero}`" tres-large @fermer="verification = null">
      <p class="intro">
        L'agent du district contrôle dans le centre <strong>{{ formulaire.centre.nom }}</strong> les quantités déclarées pour
        <strong>{{ libellePeriode(formulaire.annee, formulaire.mois) }}</strong> (registres, fiches de stock, ordonnances).
        Saisissez la quantité <strong>constatée</strong> ; laissez vide une ligne non contrôlée (la déclaration est alors retenue).
      </p>
      <form id="form-verification" class="grille-formulaire" @submit.prevent="enregistrerVerification">
        <div>
          <label class="obligatoire">Date de la visite</label>
          <input v-model="verification.dateVerification" type="date" :max="dateDuJour()" required />
        </div>
        <div>
          <label>Agents présents</label>
          <input v-model.trim="verification.agents" maxlength="500" placeholder="ex. Awa KONÉ (district), Dr YAO (centre)" />
        </div>
        <div class="pleine-largeur">
          <div class="entete-section">
            <h4 class="section">Quantités constatées</h4>
            <button type="button" class="bouton-lien" @click="verification.lignes.forEach((l) => (l.quantiteVerifiee = l.quantite))">Tout conforme (constaté = déclaré)</button>
          </div>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th class="nombre">Stock théorique</th>
                <th class="nombre">Déclaré</th>
                <th class="nombre">Constaté</th>
                <th class="nombre">Écart</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in verification.lignes" :key="l.ligneId">
                <td>{{ l.libelle }}</td>
                <td class="nombre">{{ formaterNombre(l.stockTheorique) }}</td>
                <td class="nombre">{{ formaterNombre(l.quantite) }}</td>
                <td class="nombre"><input v-model.number="l.quantiteVerifiee" type="number" min="0" step="1" placeholder="—" /></td>
                <td class="nombre" :class="classeEcart(l)">{{ texteEcart(l) }}</td>
                <td><input v-model.trim="l.commentaire" maxlength="255" placeholder="ex. 3 boîtes non justifiées" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pleine-largeur">
          <label>Constats / observations</label>
          <textarea v-model.trim="verification.observations" rows="2" maxlength="2000"></textarea>
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="verification = null">Annuler</button>
        <button type="submit" form="form-verification" :disabled="enregistrement">Enregistrer la vérification</button>
      </template>
    </FenetreModale>

    <PiecesJointes v-if="docPieces" module="consommations" type="RapportConsommation" :id="docPieces.id" :titre="`Pièces du rapport ${docPieces.numero}`" @fermer="docPieces = null" />
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
import { useRouter } from 'vue-router'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import {
  creerRapport,
  listerRapports,
  modifierRapport,
  renvoyerRapport,
  soumettreRapport,
  stockDuCentre,
  supprimerRapport,
  trouverRapport,
  validerRapport,
  verifierRapport,
} from '@/api/consommations'
import {
  ETAPE_RAPPORT,
  ETAPES_RAPPORT,
  ficheVerificationPdf,
  libellePeriode,
  OPTIONS_MOIS,
  optionsStatuts,
  quantiteRetenue,
  rapportPdf,
  STATUTS_RAPPORT,
} from './consommationsCommun'

const props = defineProps({
  /** Rapport à ouvrir (ou { centreId, annee, mois } pour en créer un) depuis le tableau de suivi */
  aOuvrir: { type: Object, default: null },
})
const emit = defineEmits(['modifie'])
const store = useStore()

const rapports = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, annee: new Date().getFullYear(), mois: null, statut: null })
const formulaire = ref(null)
const verification = ref(null)
const stockCentre = ref([]) // stock théorique du centre choisi
const docPieces = ref(null)

const centres = computed(() => store.state.referentiel.centres)
const centresActifs = computed(() => centres.value.filter((c) => c.actif || c.id === formulaire.value?.centreId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

/** Étape du circuit où se trouve le rapport ouvert (barre d'étapes en haut de la fenêtre). */
const etape = computed(() => {
  const f = formulaire.value
  if (!f?.id || f.statut === 'BROUILLON') {
    return { numero: ETAPE_RAPPORT.SAISIE, aide: 'Saisissez les quantités déclarées par le centre, puis « Enregistrer et soumettre ».' }
  }
  if (f.statut === 'SOUMIS' && !f.dateVerification) {
    return { numero: ETAPE_RAPPORT.VERIFICATION, aide: 'Faites la « Vérification sur place » (facultative), ou validez directement le rapport.' }
  }
  if (f.statut === 'SOUMIS') return { numero: ETAPE_RAPPORT.VALIDATION, aide: 'Vérification faite : cliquez sur « Valider le rapport ».' }
  if (f.statut === 'VALIDE') return { numero: ETAPE_RAPPORT.FACTURATION, aide: 'Le rapport sera facturé dans le module Facturation (onglet « À facturer »).' }
  return { numero: ETAPE_RAPPORT.TERMINE, aide: 'Rapport facturé.' }
})

// Lien vers la facturation (seulement si le profil a accès au module Facturation)
const router = useRouter()
const peutVoirFacturation = computed(() => store.getters['auth/peutVoir']('facturation'))
function allerFacturation() {
  formulaire.value = null
  router.push({ path: '/facturation', query: { onglet: 'a-facturer' } })
}

const titreFormulaire = computed(() => {
  const f = formulaire.value
  return f.id ? `Rapport ${f.numero} — ${f.centre?.nom || ''} — ${libellePeriode(f.annee, f.mois)}` : 'Nouveau rapport mensuel de consommation'
})

const rapportsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return rapports.value
  return rapports.value.filter((r) => [r.numero, r.centre.nom].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    rapports.value = await listerRapports(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// OUVERTURE
// ---------------------------------------------------------------------------
function nouvelleLigne(medicamentId = null) {
  return { medicamentId, quantite: medicamentId ? null : 0, quantiteVerifiee: null, commentaire: '' }
}

/** Mois précédent (période proposée par défaut : le rapport arrive après la fin du mois). */
function moisPrecedent() {
  const d = new Date()
  return d.getMonth() === 0 ? { annee: d.getFullYear() - 1, mois: 12 } : { annee: d.getFullYear(), mois: d.getMonth() }
}

/** Ouvre un rapport existant ({ id }), ou un nouveau (éventuellement pré-rempli { centreId, annee, mois }). */
async function ouvrir(rapport = null) {
  if (!rapport?.id) {
    formulaire.value = {
      centreId: rapport?.centreId ?? null,
      ...(rapport?.annee ? { annee: rapport.annee, mois: rapport.mois } : moisPrecedent()),
      observations: '',
      lignes: [],
    }
    await chargerStockCentre()
    return
  }
  try {
    const r = await trouverRapport(rapport.id)
    formulaire.value = {
      ...r,
      observations: r.observations || '',
      lignes: r.lignes.map((l) => ({ ...l, commentaire: l.commentaire || '' })),
    }
    await chargerStockCentre()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}
watch(
  () => props.aOuvrir,
  (r) => r && ouvrir(r),
  { immediate: true },
)

async function chargerStockCentre() {
  const id = formulaire.value?.centreId
  stockCentre.value = []
  if (!id) return
  try {
    stockCentre.value = await stockDuCentre(id)
  } catch {
    // pas bloquant
  }
}

/** Ajoute une ligne pour chaque médicament en stock au centre (non encore présent). */
function ajouterMedicamentsDuCentre() {
  const presents = new Set(formulaire.value.lignes.map((l) => l.medicamentId))
  const aAjouter = stockCentre.value.filter((s) => s.quantiteTheorique > 0 && s.medicament.actif && !presents.has(s.medicamentId))
  // On retire d'abord les lignes vides
  formulaire.value.lignes = formulaire.value.lignes.filter((l) => l.medicamentId)
  aAjouter.forEach((s) => formulaire.value.lignes.push(nouvelleLigne(s.medicamentId)))
  if (aAjouter.length === 0) store.dispatch('notifications/succes', 'Tous les médicaments en stock au centre sont déjà dans le rapport.')
}

// ---------------------------------------------------------------------------
// CALCULS D'AFFICHAGE
// ---------------------------------------------------------------------------
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))
/** Options de chaque ligne : médicaments actifs non encore choisis sur une autre ligne. */
const optionsParLigne = computed(() => {
  const lignes = formulaire.value?.lignes || []
  return lignes.map((ligne) => {
    const dejaChoisis = new Set(lignes.filter((l) => l !== ligne).map((l) => l.medicamentId))
    return medicamentsActifs.value.filter((m) => m.id === ligne.medicamentId || !dejaChoisis.has(m.id))
  })
})

function libelleMedicament(id) {
  const m = medicaments.value.find((x) => x.id === id)
  if (m) return `${m.code} — ${m.designation}`
  const l = formulaire.value?.lignes.find((x) => x.medicamentId === id)
  return l?.medicament ? `${l.medicament.code} — ${l.medicament.designation}` : '—'
}
function stockTheorique(ligne) {
  if (ligne.stockTheorique !== undefined && lectureSeule.value) return ligne.stockTheorique
  return stockCentre.value.find((s) => s.medicamentId === ligne.medicamentId)?.quantiteTheorique ?? 0
}
/** Avertissement (non bloquant) : déclaré au-delà du stock théorique du centre. */
function depasseStock(ligne) {
  return formulaire.value.statut !== 'VALIDE' && formulaire.value.statut !== 'FACTURE' && !!ligne.medicamentId && (Number(ligne.quantite) || 0) > stockTheorique(ligne)
}
/** Prix : celui enregistré (figé) sinon, en saisie, le prix de vente actuel (consommable = 0). */
function prixDe(ligne) {
  if (ligne.prixUnitaire !== undefined && ligne.medicamentId === ligne.medicament?.id) return Number(ligne.prixUnitaire)
  const m = medicaments.value.find((x) => x.id === ligne.medicamentId)
  if (!m || m.consommable) return 0
  return Number(m.prixVenteActuel ?? 0)
}
function montantLigne(ligne) {
  return (Number(quantiteRetenue(ligne)) || 0) * prixDe(ligne)
}
const montantTotal = computed(() => (formulaire.value?.lignes || []).filter((l) => l.medicamentId).reduce((t, l) => t + montantLigne(l), 0))

function ecart(l) {
  const v = l.quantiteVerifiee
  return v === null || v === undefined || v === '' ? null : Number(v) - l.quantite
}
function texteEcart(l) {
  const e = ecart(l)
  if (e === null) return '—'
  return e > 0 ? `+${e}` : String(e)
}
function classeEcart(l) {
  const e = ecart(l)
  return e === null || e === 0 ? '' : e < 0 ? 'ecart-negatif' : 'ecart-positif'
}

// ---------------------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------------------
async function enregistrer(soumettre) {
  const f = formulaire.value
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament.')
  if (lignes.some((l) => l.quantite === null || l.quantite === '' || Number(l.quantite) < 0)) {
    return store.dispatch('notifications/erreur', 'Indiquez la quantité déclarée de chaque médicament (0 si rien consommé).')
  }
  if (soumettre) {
    const confirme = await confirmer({
      titre: 'Soumettre le rapport ?',
      texte: `${lignes.length} médicament(s), montant estimé ${formaterMontant(montantTotal.value)}. Le rapport ne sera plus modifiable (sauf renvoi en brouillon).`,
      boutonConfirmer: 'Oui, soumettre',
    })
    if (!confirme) return
  }
  const donnees = {
    centreId: f.centreId,
    annee: Number(f.annee),
    mois: Number(f.mois),
    observations: f.observations || undefined,
    lignes: lignes.map((l) => ({ medicamentId: l.medicamentId, quantite: Number(l.quantite) })),
  }
  enregistrement.value = true
  try {
    let rapport = f.id ? await modifierRapport(f.id, donnees) : await creerRapport(donnees)
    if (soumettre) rapport = await soumettreRapport(rapport.id)
    store.dispatch('notifications/succes', soumettre ? `Rapport ${rapport.numero} soumis.` : `Rapport ${rapport.numero} enregistré (brouillon).`)
    await ouvrir(rapport)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function supprimer() {
  const f = formulaire.value
  const confirme = await confirmer({ titre: `Supprimer le brouillon ${f.numero} ?`, texte: 'Le rapport saisi sera définitivement supprimé.', boutonConfirmer: 'Oui, supprimer', danger: true })
  if (!confirme) return
  await action(() => supprimerRapport(f.id), 'Brouillon supprimé.', true)
}

async function renvoyer() {
  const motif = await demanderTexte({
    titre: `Renvoyer ${formulaire.value.numero} en brouillon ?`,
    texte: 'Le rapport redevient modifiable pour être corrigé.',
    libelle: 'Motif du renvoi',
    boutonConfirmer: 'Renvoyer',
  })
  if (motif === null) return
  await action(() => renvoyerRapport(formulaire.value.id, motif), 'Rapport renvoyé en brouillon.')
}

async function valider() {
  const f = formulaire.value
  const avertissements = []
  if (!f.dateVerification) avertissements.push("Ce rapport n'a pas été vérifié sur place.")
  const auDela = f.lignes.filter((l) => quantiteRetenue(l) > l.stockTheorique).length
  if (auDela) avertissements.push(`${auDela} ligne(s) dépassent le stock théorique du centre (il deviendra négatif).`)
  const confirme = await confirmer({
    titre: `Valider le rapport ${f.numero} ?`,
    texte: `${avertissements.join(' ')} Montant : ${formaterMontant(f.montantTotal)}. Les quantités retenues seront déduites du stock théorique du centre. Opération définitive.`.trim(),
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return
  await action(() => validerRapport(f.id), 'Rapport validé : stock théorique du centre mis à jour.')
}

/** Exécute une action du circuit puis rafraîchit le rapport et la liste. */
async function action(appel, message, fermer = false) {
  enregistrement.value = true
  try {
    const rapport = await appel()
    store.dispatch('notifications/succes', message)
    if (fermer) formulaire.value = null
    else await ouvrir(rapport)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// --- Vérification sur place ---
function ouvrirVerification() {
  const f = formulaire.value
  verification.value = {
    dateVerification: f.dateVerification ? f.dateVerification.substring(0, 10) : dateDuJour(),
    agents: f.agentsVerification || nomUtilisateurConnecte(),
    observations: f.observationsVerification || '',
    lignes: f.lignes.map((l) => ({
      ligneId: l.id,
      libelle: `${l.medicament.code} — ${l.medicament.designation}`,
      stockTheorique: l.stockTheorique,
      quantite: l.quantite,
      quantiteVerifiee: l.quantiteVerifiee ?? '',
      commentaire: l.commentaire || '',
    })),
  }
}

async function enregistrerVerification() {
  const v = verification.value
  const nonVerifiees = v.lignes.filter((l) => l.quantiteVerifiee === '' || l.quantiteVerifiee === null).length
  if (nonVerifiees === v.lignes.length) return store.dispatch('notifications/erreur', 'Saisissez au moins une quantité constatée.')
  enregistrement.value = true
  try {
    const rapport = await verifierRapport(formulaire.value.id, {
      dateVerification: v.dateVerification,
      agents: v.agents || undefined,
      observations: v.observations || undefined,
      lignes: v.lignes.map((l) => ({
        ligneId: l.ligneId,
        quantiteVerifiee: l.quantiteVerifiee === '' || l.quantiteVerifiee === null ? null : Number(l.quantiteVerifiee),
        commentaire: l.commentaire || undefined,
      })),
    })
    const ecarts = rapport.lignes.filter((l) => l.quantiteVerifiee !== null && l.quantiteVerifiee !== l.quantite).length
    store.dispatch('notifications/succes', ecarts ? `Vérification enregistrée : ${ecarts} écart(s) constaté(s).` : 'Vérification enregistrée : déclaration conforme.')
    verification.value = null
    await ouvrir(rapport)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function imprimer(r) {
  try {
    rapportPdf(await trouverRapport(r.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (r) => r.numero,
  periode: (r) => r.annee * 100 + r.mois,
  centre: (r) => r.centre.nom,
  lignes: (r) => r._count?.lignes,
  montant: (r) => Number(r.montantTotal),
  verifie: (r) => (r.verifie ? 1 + r.lignesAvecEcart : 0),
  statut: (r) => STATUTS_RAPPORT[r.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(rapportsAffiches, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    filtres.mois ? libellePeriode(filtres.annee, filtres.mois) : `Année ${filtres.annee || 'toutes'}`,
    filtres.statut ? STATUTS_RAPPORT[filtres.statut].libelle : 'tous les statuts',
  ].join(' — ')
})
const COLONNES_PDF = [
  { titre: 'N° rapport', valeur: (r) => r.numero },
  { titre: 'Période', valeur: (r) => libellePeriode(r.annee, r.mois) },
  { titre: 'Centre', valeur: (r) => r.centre.nom },
  { titre: 'Vérification', valeur: (r) => (r.verifie ? (r.lignesAvecEcart ? `${r.lignesAvecEcart} écart(s)` : 'Conforme') : 'Non vérifié') },
  { titre: 'Statut', valeur: (r) => STATUTS_RAPPORT[r.statut]?.libelle },
  { titre: 'Montant', valeur: (r) => formaterMontant(r.montantTotal), droite: true, somme: (r) => Number(r.montantTotal), formatTotal: formaterMontant },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.filtre.petit { min-width: 150px; }
.annee { width: 90px; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.encart { margin-bottom: 1rem; padding: 0.65rem 0.9rem; border-radius: 8px; font-size: 0.88rem; }
.encart-alerte { background: #fff4e5; color: #8a5a00; }
.encart-verif { background: var(--primary-light); color: var(--primary-dark); }
.encart-verif .detail { color: var(--primary-dark); opacity: 0.85; }
.grille-formulaire.trois { grid-template-columns: 2fr 1fr 1fr; }
.entete-section { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.section { flex: 1; margin: 0.25rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .col-medicament { min-width: 300px; }
.lignes input[type='number'] { width: 100px; text-align: right; }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.commentaire { font-style: italic; }
tr.au-dela td { background: #fffaf0; }
.message-attention { display: block; margin-top: 0.2rem; font-size: 0.72rem; color: #b35c00; white-space: nowrap; }
.ecart-negatif { color: var(--danger); font-weight: 700; }
.ecart-positif { color: #b35c00; font-weight: 700; }
.aide { margin: 0.4rem 0 0; font-size: 0.8rem; color: var(--muted); }
.intro { margin: 0 0 1rem; font-size: 0.9rem; color: var(--texte-sur-fond); }
textarea { width: 100%; resize: vertical; }
</style>
