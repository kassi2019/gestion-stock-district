<!--
  =============================================================================
  ONGLET « SUPERVISIONS »
  =============================================================================
  Contrôles physiques dans les centres (cahier des charges §3.7).
  1. CONSTAT (brouillon) : centre, date, agents présents ; « Charger les
     médicaments du centre » affiche le STOCK THÉORIQUE À LA DATE du contrôle ;
     on saisit le stock PHYSIQUE (lot facultatif, commentaire) ; écarts et
     valeurs calculés. « Fiche de comptage (PDF) » : à emporter, sans le
     théorique (comptage à l'aveugle).
  2. SOUMISSION puis VALIDATION par une personne habilitée (renvoi possible).
     La validation ne crée ni mouvement de stock ni dette.
  3. DÉCISION (motif obligatoire) : aucune suite / régularisation du stock /
     facturation des manquants (facture visible dans Facturation).
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre, agent)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="options(STATUTS_SUPERVISION)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Supervisions des centres" :sous-titre="sousTitrePdf" nom-fichier="supervisions" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="ouvrir()">+ Nouvelle supervision</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N°</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <th>Agents</th>
            <ColonneTri v-model="tri" cle="ecarts" class="nombre">Écarts</ColonneTri>
            <ColonneTri v-model="tri" cle="manquants" class="nombre">Manquants</ColonneTri>
            <ColonneTri v-model="tri" cle="excedents" class="nombre">Excédents</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th>Décision</th>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in lignesPage" :key="s.id">
            <td class="code">{{ s.numero }}</td>
            <td>{{ formaterDate(s.dateSupervision) }}</td>
            <td><strong>{{ s.centre.nom }}</strong></td>
            <td class="agents">{{ s.agents.map((a) => a.nom).join(', ') }}</td>
            <td class="nombre">{{ s.nombreEcarts }} / {{ s.nombreLignes }}</td>
            <td class="nombre"><span :class="{ manque: s.valeurManquants > 0 }">{{ formaterMontant(s.valeurManquants) }}</span></td>
            <td class="nombre">{{ formaterMontant(s.valeurExcedents) }}</td>
            <td><span class="badge" :class="STATUTS_SUPERVISION[s.statut]?.badge">{{ STATUTS_SUPERVISION[s.statut]?.libelle }}</span></td>
            <td>
              <span v-if="s.decision">{{ DECISIONS[s.decision]?.libelle }}</span>
              <small v-if="s.facture" class="detail">{{ s.facture.numero }}</small>
              <span v-if="!s.decision" class="detail">—</span>
            </td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(s)">{{ s.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-si-imprimer class="bouton-lien" title="Rapport (PDF)" @click="imprimer(s)">PDF</button>
              <button class="bouton-lien" @click="docPieces = s">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="supervisionsAffichees.length" />
      <p v-if="!chargement && supervisionsAffichees.length === 0" class="tableau-vide">Aucune supervision.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== CONSTAT / CONSULTATION ===================== -->
    <FenetreModale v-if="formulaire" :titre="titreFormulaire" tres-large @fermer="formulaire = null">
      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_SUPERVISION[formulaire.statut]?.badge">{{ STATUTS_SUPERVISION[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'BROUILLON'">Constat modifiable. « Soumettre » le transmet pour validation.</small>
        <small v-else-if="formulaire.statut === 'SOUMISE'">À valider par une personne habilitée (aucun effet sur le stock ni sur les comptes).</small>
        <small v-else-if="formulaire.statut === 'VALIDEE'">
          Validée le {{ formaterDate(formulaire.dateValidation) }} par {{ nomPersonne(formulaire.validateur) }}. Décision à prendre sur les écarts.
        </small>
      </div>
      <div v-if="formulaire.statut === 'BROUILLON' && formulaire.motifRenvoi" class="encart encart-alerte">
        <strong>Renvoyée pour correction :</strong> {{ formulaire.motifRenvoi }}
      </div>
      <div v-if="formulaire.statut === 'CLOTUREE'" class="encart encart-decision">
        <strong>Décision : {{ DECISIONS[formulaire.decision]?.libelle }}</strong>
        <span v-if="formulaire.decideur"> — par {{ nomPersonne(formulaire.decideur) }} le {{ formaterDate(formulaire.dateDecision) }}</span>
        <div class="motif">{{ formulaire.motifDecision }}</div>
        <div v-if="formulaire.facture">
          Facture <strong>{{ formulaire.facture.numero }}</strong> — {{ formaterMontant(formulaire.facture.montantTotal) }}
          <router-link :to="{ path: '/facturation', query: { onglet: 'factures' } }" class="lien">Voir dans Facturation →</router-link>
        </div>
      </div>

      <form id="form-supervision" class="grille-formulaire" @submit.prevent="enregistrer(false)">
        <div>
          <label class="obligatoire">Centre de santé</label>
          <ListeDeroulante v-model="formulaire.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" :desactive="lectureSeule" @update:model-value="changerCentre" />
        </div>
        <div>
          <label class="obligatoire">Date du contrôle</label>
          <input v-model="formulaire.dateSupervision" type="date" :max="dateDuJour()" required :disabled="lectureSeule" @change="chargerPreparation" />
        </div>

        <!-- Agents présents -->
        <div class="pleine-largeur">
          <h4 class="section">Agents présents</h4>
          <p v-if="!lectureSeule" class="aide-agents">
            Choisissez dans le personnel du district (et du centre choisi). Pour une personne qui n'y figure pas : « Autre personne (saisie libre) ».
          </p>
          <div v-for="(agent, i) in formulaire.agents" :key="i" class="ligne-agent" :class="{ libre: !lectureSeule && agent.choix === AUTRE }">
            <!-- Lecture seule : simple texte -->
            <input v-if="lectureSeule" :value="agent.nom" disabled />
            <ListeDeroulante
              v-else
              v-model="agent.choix"
              :options="optionsAgents"
              placeholder="— Choisir l'agent —"
              @update:model-value="choisirAgent(agent)"
            />
            <!-- Personne hors liste : nom saisi à la main -->
            <input v-if="!lectureSeule && agent.choix === AUTRE" v-model.trim="agent.nom" maxlength="150" placeholder="Nom et prénoms" />
            <input v-model.trim="agent.fonction" maxlength="100" placeholder="Fonction (ex. superviseur district, major du centre)" :disabled="lectureSeule" />
            <button v-if="!lectureSeule && formulaire.agents.length > 1" type="button" class="bouton-lien danger" @click="formulaire.agents.splice(i, 1)">✕</button>
          </div>
          <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="formulaire.agents.push(nouvelAgent())">+ Ajouter un agent</button>
        </div>

        <!-- Médicaments contrôlés -->
        <div class="pleine-largeur">
          <div class="entete-section">
            <h4 class="section">Stock théorique et stock physique</h4>
            <template v-if="!lectureSeule && formulaire.centreId">
              <button type="button" class="bouton-lien" @click="chargerMedicamentsDuCentre">+ Charger les médicaments du centre ({{ preparation.medicaments.length }})</button>
              <button v-si-imprimer type="button" class="bouton-lien" :disabled="!preparation.medicaments.length" @click="imprimerFicheComptage">Fiche de comptage (PDF)</button>
            </template>
          </div>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Lot (facultatif)</th>
                <th class="nombre">Théorique au {{ formaterDate(formulaire.dateSupervision) }}</th>
                <th class="nombre">Physique</th>
                <th class="nombre">Écart</th>
                <th class="nombre">Valeur</th>
                <th>Commentaire</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(l, index) in formulaire.lignes" :key="index" :class="classeLigne(l)">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="l.medicamentId"
                    :options="optionsParLigne[index]"
                    :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                    placeholder="Choisir…"
                    @update:model-value="l.lotId = null"
                  />
                  <span v-else>{{ libelleMedicament(l) }}</span>
                </td>
                <td class="col-lot">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="l.lotId"
                    :options="lotsDe(l.medicamentId)"
                    :champ-libelle="(lot) => `${lot.numeroLot}${lot.datePeremption ? ' — ' + formaterDate(lot.datePeremption) : ''}`"
                    placeholder="—"
                  />
                  <span v-else>{{ l.lot?.numeroLot || '—' }}</span>
                </td>
                <td class="nombre">{{ l.medicamentId ? formaterNombre(theorique(l)) : '—' }}</td>
                <td class="nombre">
                  <input v-if="!lectureSeule" v-model.number="l.stockPhysique" type="number" min="0" step="1" placeholder="?" />
                  <strong v-else>{{ formaterNombre(l.stockPhysique) }}</strong>
                </td>
                <td class="nombre" :class="classeEcart(ecart(l))">{{ ecart(l) === null ? '—' : texteEcart(ecart(l)) }}</td>
                <td class="nombre">{{ valeur(l) === null ? '—' : formaterMontant(valeur(l)) }}</td>
                <td>
                  <input v-if="!lectureSeule" v-model.trim="l.commentaire" maxlength="255" placeholder="ex. périmés retirés" />
                  <span v-else class="detail">{{ l.commentaire || '' }}</span>
                </td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien danger" title="Retirer" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="formulaire.lignes.length">
              <tr>
                <td colspan="5" class="nombre">Manquants <strong class="manque">{{ formaterMontant(totaux.manquants) }}</strong> · Excédents <strong>{{ formaterMontant(totaux.excedents) }}</strong> · <strong>VALEUR NETTE</strong></td>
                <td class="nombre"><strong>{{ formaterMontant(totaux.net) }}</strong></td>
                <td :colspan="lectureSeule ? 1 : 2"></td>
              </tr>
            </tfoot>
          </table>
          <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="formulaire.lignes.push(nouvelleLigne())">+ Ajouter un médicament</button>
          <p class="aide">
            Valorisation selon la règle du district (Paramètres généraux : {{ regleValorisation }}). Valeurs définitives calculées à l'enregistrement.
          </p>
        </div>

        <div class="pleine-largeur">
          <label>Observations générales</label>
          <textarea v-model.trim="formulaire.observations" rows="3" maxlength="4000" :disabled="lectureSeule" placeholder="Conditions de stockage, tenue des registres, recommandations…"></textarea>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <template v-if="formulaire.id">
          <button type="button" class="bouton-secondaire" @click="docPieces = formulaire">Pièces jointes</button>
          <button v-si-imprimer type="button" class="bouton-secondaire" @click="rapportSupervisionPdf(formulaire)">Rapport (PDF)</button>
        </template>
        <template v-if="!formulaire.id || formulaire.statut === 'BROUILLON'">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="supprimer">Supprimer</button>
          <button v-si-modif type="submit" form="form-supervision" class="bouton-secondaire" :disabled="enregistrement">Enregistrer le brouillon</button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Enregistrer et soumettre</button>
        </template>
        <template v-else-if="formulaire.statut === 'SOUMISE'">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="renvoyer">Renvoyer en brouillon</button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="valider">Valider le constat</button>
        </template>
        <button v-else-if="formulaire.statut === 'VALIDEE'" v-si-modif type="button" @click="ouvrirDecision">Prendre la décision</button>
      </template>
    </FenetreModale>

    <!-- ===================== DÉCISION ===================== -->
    <FenetreModale v-if="decision" :titre="`Décision sur les écarts — ${formulaire.numero}`" @fermer="decision = null">
      <p class="intro">
        Manquants : <strong class="manque">{{ formaterMontant(formulaire.valeurManquants) }}</strong> ·
        Excédents : <strong>{{ formaterMontant(formulaire.valeurExcedents) }}</strong> ·
        {{ formulaire.nombreEcarts }} médicament(s) en écart.
      </p>
      <form id="form-decision" @submit.prevent="enregistrerDecision">
        <label v-for="(d, code) in DECISIONS" :key="code" class="choix-decision" :class="{ actif: decision.decision === code }">
          <input v-model="decision.decision" type="radio" :value="code" />
          <span>
            <strong>{{ d.libelle }}</strong>
            <small>{{ d.aide }}</small>
          </span>
        </label>
        <div v-if="decision.decision === 'FACTURATION'" class="champ">
          <label class="obligatoire">Date de la facture</label>
          <input v-model="decision.dateFacture" type="date" :max="dateDuJour()" required />
          <small class="aide">Montant facturé : {{ formaterMontant(formulaire.valeurManquants) }} (manquants seulement ; les excédents ne sont pas déduits).</small>
        </div>
        <div class="champ">
          <label class="obligatoire">Motif de la décision</label>
          <textarea v-model.trim="decision.motif" rows="3" maxlength="2000" required placeholder="ex. manquants non justifiés selon la procédure du district"></textarea>
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="decision = null">Annuler</button>
        <button type="submit" form="form-decision" :disabled="enregistrement || !decision.decision">Enregistrer la décision</button>
      </template>
    </FenetreModale>

    <PiecesJointes v-if="docPieces" module="supervisions" type="Supervision" :id="docPieces.id" :titre="`Pièces de la supervision ${docPieces.numero}`" @fermer="docPieces = null" />
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
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { listerParametres } from '@/api/parametrage'
import {
  creerSupervision,
  deciderSupervision,
  listerSupervisions,
  modifierSupervision,
  preparationSupervision,
  agentsPossibles,
  renvoyerSupervision,
  soumettreSupervision,
  supprimerSupervision,
  trouverSupervision,
  validerSupervision,
} from '@/api/supervisions'
import { DECISIONS, ficheComptagePdf, options, rapportSupervisionPdf, STATUTS_SUPERVISION, texteEcart } from './supervisionsCommun'

const emit = defineEmits(['modifie'])
const store = useStore()

const supervisions = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const decision = ref(null)
const docPieces = ref(null)
const preparation = ref({ medicaments: [], lots: [] }) // théorique à la date + lots livrés
const personnel = ref([]) // agents possibles : personnel du district + du centre choisi
const regleValorisation = ref('prix de vente')

const centres = computed(() => store.state.referentiel.centres)
const centresActifs = computed(() => centres.value.filter((c) => c.actif || c.id === formulaire.value?.centreId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')
const titreFormulaire = computed(() => {
  const f = formulaire.value
  return f.id ? `Supervision ${f.numero} — ${f.centre?.nom || ''}` : 'Nouvelle supervision (constat)'
})

const supervisionsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return supervisions.value
  return supervisions.value.filter((s) => [s.numero, s.centre.nom, ...s.agents.map((a) => a.nom)].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    supervisions.value = await listerSupervisions(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// OUVERTURE ET PRÉPARATION
// ---------------------------------------------------------------------------
function nouvelleLigne(medicamentId = null) {
  return { medicamentId, lotId: null, stockPhysique: null, commentaire: '' }
}

// ---------------------------------------------------------------------------
// AGENTS PRÉSENTS : liste déroulante du personnel (+ « Autre » en saisie libre)
// On enregistre toujours le NOM et la FONCTION en texte (et le compte
// utilisateur s'il existe) : un départ du personnel ne change pas l'historique.
// ---------------------------------------------------------------------------
const AUTRE = 'AUTRE'
const optionsAgents = computed(() => [
  ...personnel.value.map((p) => ({ id: p.id, libelle: `${p.nom}${p.fonction ? ' — ' + p.fonction : ''} (${p.lieu})` })),
  { id: AUTRE, libelle: 'Autre personne (saisie libre)' },
])
function nouvelAgent() {
  return { choix: null, nom: '', fonction: '', utilisateurId: null }
}
/** Agent choisi dans la liste : on recopie son nom, sa fonction et son compte. */
function choisirAgent(agent) {
  const p = personnel.value.find((x) => x.id === agent.choix)
  if (p) Object.assign(agent, { nom: p.nom, fonction: p.fonction, utilisateurId: p.utilisateurId })
  else Object.assign(agent, { nom: '', fonction: '', utilisateurId: null }) // « Autre » ou liste vidée
}
/** Retrouve dans la liste un agent déjà enregistré (par compte, sinon par nom) ; sinon « Autre ». */
function rattacherAgent(agent) {
  const nom = (agent.nom || '').toLowerCase()
  const p = personnel.value.find((x) => (agent.utilisateurId && x.utilisateurId === agent.utilisateurId) || x.nom.toLowerCase() === nom)
  agent.choix = p ? p.id : agent.nom ? AUTRE : null
}
/** Charge le personnel (district + centre) puis rattache les agents déjà saisis. */
async function chargerAgents() {
  try {
    personnel.value = await agentsPossibles(formulaire.value?.centreId)
  } catch (erreur) {
    personnel.value = []
    store.dispatch('notifications/erreurApi', erreur)
  }
  formulaire.value?.agents.forEach(rattacherAgent)
}
/** Changement de centre : préparation (stock théorique) et personnel du centre. */
function changerCentre() {
  chargerPreparation()
  chargerAgents()
}

async function ouvrir(s = null) {
  preparation.value = { medicaments: [], lots: [] }
  if (!s) {
    formulaire.value = {
      centreId: null,
      dateSupervision: dateDuJour(),
      observations: '',
      // Par défaut : l'utilisateur connecté (retrouvé dans le personnel s'il y figure)
      agents: [{ ...nouvelAgent(), nom: nomUtilisateurConnecte(), fonction: 'Superviseur du district', utilisateurId: store.state.auth.user?.id ?? null }],
      lignes: [],
    }
    await chargerAgents()
    // Retrouvé dans le personnel : on reprend sa vraie fonction
    formulaire.value.agents.forEach((a) => {
      if (a.choix !== AUTRE && a.choix !== null) choisirAgent(a)
    })
    return
  }
  try {
    const d = await trouverSupervision(s.id)
    formulaire.value = {
      ...d,
      dateSupervision: d.dateSupervision.substring(0, 10),
      observations: d.observations || '',
      agents: d.agents.map((a) => ({ choix: null, nom: a.nom, fonction: a.fonction || '', utilisateurId: a.utilisateurId })),
      lignes: d.lignes.map((l) => ({ ...l, commentaire: l.commentaire || '' })),
    }
    if (d.statut === 'BROUILLON') await Promise.all([chargerPreparation(), chargerAgents()])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Stock théorique du centre à la date du contrôle + lots livrés au centre. */
async function chargerPreparation() {
  const f = formulaire.value
  preparation.value = { medicaments: [], lots: [] }
  if (!f?.centreId || !f.dateSupervision) return
  try {
    preparation.value = await preparationSupervision(f.centreId, f.dateSupervision)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

function chargerMedicamentsDuCentre() {
  const presents = new Set(formulaire.value.lignes.map((l) => l.medicamentId))
  formulaire.value.lignes = formulaire.value.lignes.filter((l) => l.medicamentId)
  const aAjouter = preparation.value.medicaments.filter((m) => m.medicament.actif && !presents.has(m.medicamentId))
  aAjouter.forEach((m) => formulaire.value.lignes.push(nouvelleLigne(m.medicamentId)))
  if (aAjouter.length === 0) store.dispatch('notifications/succes', 'Tous les médicaments suivis au centre sont déjà dans la liste.')
}

function imprimerFicheComptage() {
  const f = formulaire.value
  const centre = centres.value.find((c) => c.id === f.centreId)
  // Médicaments de la liste (ou, à défaut, tous ceux suivis au centre)
  const choisis = f.lignes.filter((l) => l.medicamentId).map((l) => l.medicamentId)
  const liste = choisis.length ? preparation.value.medicaments.filter((m) => choisis.includes(m.medicamentId)) : preparation.value.medicaments
  ficheComptagePdf(centre, f.dateSupervision, liste)
}

// ---------------------------------------------------------------------------
// CALCULS D'AFFICHAGE
// ---------------------------------------------------------------------------
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))
const optionsParLigne = computed(() => {
  const lignes = formulaire.value?.lignes || []
  return lignes.map((ligne) => {
    const dejaChoisis = new Set(lignes.filter((l) => l !== ligne).map((l) => l.medicamentId))
    return medicamentsActifs.value.filter((m) => m.id === ligne.medicamentId || !dejaChoisis.has(m.id))
  })
})
function lotsDe(medicamentId) {
  return preparation.value.lots.filter((l) => l.medicamentId === medicamentId)
}
function libelleMedicament(l) {
  return l.medicament ? `${l.medicament.code} — ${l.medicament.designation}` : '—'
}
/** Théorique : valeur enregistrée (consultation) ou calculée à la date (saisie). */
function theorique(l) {
  if (lectureSeule.value) return l.stockTheorique
  return preparation.value.medicaments.find((m) => m.medicamentId === l.medicamentId)?.stockTheorique ?? 0
}
function ecart(l) {
  if (l.stockPhysique === null || l.stockPhysique === '' || l.stockPhysique === undefined) return null
  return Number(l.stockPhysique) - theorique(l)
}
/** Valeur : prix connu (après enregistrement) × écart. */
function valeur(l) {
  const e = ecart(l)
  if (e === null || l.prixUnitaire === null || l.prixUnitaire === undefined || l.medicamentId !== l.medicament?.id) return null
  return e * Number(l.prixUnitaire)
}
const totaux = computed(() => {
  const lignes = formulaire.value?.lignes || []
  const vals = lignes.map((l) => ({ e: ecart(l), v: valeur(l) })).filter((x) => x.v !== null)
  const manquants = -vals.filter((x) => x.e < 0).reduce((t, x) => t + x.v, 0)
  const excedents = vals.filter((x) => x.e > 0).reduce((t, x) => t + x.v, 0)
  return { manquants, excedents, net: excedents - manquants }
})
function classeEcart(e) {
  return e === null || e === 0 ? '' : e < 0 ? 'ecart-negatif' : 'ecart-positif'
}
function classeLigne(l) {
  const e = ecart(l)
  return { 'ligne-manque': e !== null && e < 0, 'ligne-excedent': e !== null && e > 0 }
}

// ---------------------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------------------
async function enregistrer(soumettre) {
  const f = formulaire.value
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  const agents = f.agents.filter((a) => a.nom)
  if (agents.length === 0) return store.dispatch('notifications/erreur', 'Indiquez au moins un agent présent.')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament contrôlé.')
  if (lignes.some((l) => l.stockPhysique === null || l.stockPhysique === '' || Number(l.stockPhysique) < 0)) {
    return store.dispatch('notifications/erreur', 'Saisissez le stock physique de chaque médicament (0 si absent).')
  }
  if (soumettre) {
    const confirme = await confirmer({
      titre: 'Soumettre le constat ?',
      texte: `${lignes.length} médicament(s) contrôlé(s). Le constat ne sera plus modifiable (sauf renvoi) et devra être validé.`,
      boutonConfirmer: 'Oui, soumettre',
    })
    if (!confirme) return
  }
  const donnees = {
    centreId: f.centreId,
    dateSupervision: f.dateSupervision,
    observations: f.observations || undefined,
    agents: agents.map((a) => ({ nom: a.nom, fonction: a.fonction || undefined, ...(a.utilisateurId ? { utilisateurId: a.utilisateurId } : {}) })),
    lignes: lignes.map((l) => ({
      medicamentId: l.medicamentId,
      ...(l.lotId ? { lotId: l.lotId } : {}),
      stockPhysique: Number(l.stockPhysique),
      commentaire: l.commentaire || undefined,
    })),
  }
  enregistrement.value = true
  try {
    let s = f.id ? await modifierSupervision(f.id, donnees) : await creerSupervision(donnees)
    if (soumettre) s = await soumettreSupervision(s.id)
    store.dispatch('notifications/succes', soumettre ? `Supervision ${s.numero} soumise.` : `Supervision ${s.numero} enregistrée : ${s.nombreEcarts} écart(s).`)
    await ouvrir(s)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function action(appel, message, fermer = false) {
  enregistrement.value = true
  try {
    const s = await appel()
    store.dispatch('notifications/succes', message)
    if (fermer) formulaire.value = null
    else await ouvrir(s)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function supprimer() {
  const confirme = await confirmer({ titre: `Supprimer ${formulaire.value.numero} ?`, texte: 'Le constat en brouillon sera supprimé.', boutonConfirmer: 'Oui, supprimer', danger: true })
  if (confirme) await action(() => supprimerSupervision(formulaire.value.id), 'Supervision supprimée.', true)
}

async function renvoyer() {
  const motif = await demanderTexte({ titre: `Renvoyer ${formulaire.value.numero} en brouillon ?`, libelle: 'Motif du renvoi', boutonConfirmer: 'Renvoyer' })
  if (motif !== null) await action(() => renvoyerSupervision(formulaire.value.id, motif), 'Supervision renvoyée en brouillon.')
}

async function valider() {
  const f = formulaire.value
  const confirme = await confirmer({
    titre: `Valider le constat ${f.numero} ?`,
    texte: `${f.nombreEcarts} écart(s) — manquants ${formaterMontant(f.valeurManquants)}, excédents ${formaterMontant(f.valeurExcedents)}. La validation confirme le constat ; la décision (régularisation, facturation…) sera prise ensuite.`,
    boutonConfirmer: 'Oui, valider',
  })
  if (confirme) await action(() => validerSupervision(f.id), 'Constat validé : décision à prendre.')
}

function ouvrirDecision() {
  const f = formulaire.value
  decision.value = {
    decision: f.nombreEcarts === 0 ? 'AUCUNE' : f.valeurManquants > 0 ? 'FACTURATION' : 'REGULARISATION_STOCK',
    motif: f.nombreEcarts === 0 ? 'Aucun écart constaté.' : '',
    dateFacture: dateDuJour(),
  }
}

async function enregistrerDecision() {
  const d = decision.value
  if (!d.motif) return store.dispatch('notifications/erreur', 'Indiquez le motif de la décision.')
  const confirme = await confirmer({
    titre: `${DECISIONS[d.decision].libelle} ?`,
    texte: `${DECISIONS[d.decision].aide} Cette décision clôture la supervision.`,
    boutonConfirmer: 'Oui, confirmer',
  })
  if (!confirme) return
  decision.value = null
  await action(
    () => deciderSupervision(formulaire.value.id, { decision: d.decision, motif: d.motif, ...(d.decision === 'FACTURATION' ? { dateFacture: d.dateFacture } : {}) }),
    d.decision === 'FACTURATION' ? 'Décision enregistrée : facture des manquants créée.' : 'Décision enregistrée : supervision clôturée.',
  )
}

async function imprimer(s) {
  try {
    rapportSupervisionPdf(await trouverSupervision(s.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (s) => s.numero,
  date: (s) => s.dateSupervision,
  centre: (s) => s.centre.nom,
  ecarts: (s) => s.nombreEcarts,
  manquants: (s) => s.valeurManquants,
  excedents: (s) => s.valeurExcedents,
  statut: (s) => STATUTS_SUPERVISION[s.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(supervisionsAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [c ? `Centre : ${c.nom}` : 'Tous les centres', filtres.statut ? STATUTS_SUPERVISION[filtres.statut].libelle : 'tous les statuts'].join(' — ')
})
const COLONNES_PDF = [
  { titre: 'N°', valeur: (s) => s.numero },
  { titre: 'Date', valeur: (s) => formaterDate(s.dateSupervision) },
  { titre: 'Centre', valeur: (s) => s.centre.nom },
  { titre: 'Écarts', valeur: (s) => `${s.nombreEcarts} / ${s.nombreLignes}`, droite: true },
  { titre: 'Statut', valeur: (s) => STATUTS_SUPERVISION[s.statut]?.libelle },
  { titre: 'Décision', valeur: (s) => (s.decision ? DECISIONS[s.decision]?.libelle : '') },
  { titre: 'Manquants', valeur: (s) => formaterMontant(s.valeurManquants), droite: true, somme: (s) => s.valeurManquants, formatTotal: formaterMontant },
  { titre: 'Excédents', valeur: (s) => formaterMontant(s.valeurExcedents), droite: true, somme: (s) => s.valeurExcedents, formatTotal: formaterMontant },
]

// La page peut ouvrir une supervision (clic dans l'historique des écarts)
defineExpose({ ouvrir })

onMounted(async () => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
  try {
    const parametres = await listerParametres()
    regleValorisation.value = parametres.find((p) => p.cle === 'VALORISATION_ECARTS')?.valeur === 'PRIX_ACHAT' ? "prix d'achat" : 'prix de vente'
  } catch {
    // pas bloquant
  }
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.agents { max-width: 220px; font-size: 0.85rem; }
.manque { color: var(--danger); }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.encart { margin-bottom: 1rem; padding: 0.65rem 0.9rem; border-radius: 8px; font-size: 0.88rem; }
.encart-alerte { background: #fff4e5; color: #8a5a00; }
.encart-decision { background: var(--primary-light); color: var(--primary-dark); }
.encart-decision .motif { margin: 0.25rem 0; white-space: pre-line; }
.lien { margin-left: 0.5rem; font-weight: 600; }
.entete-section { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.section { flex: 1; margin: 0.25rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.ligne-agent { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.4rem; align-items: center; }
.ligne-agent.libre { grid-template-columns: 1fr 1fr 1fr auto; }
.aide-agents { margin: 0 0 0.5rem; font-size: 0.8rem; color: var(--muted); }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .col-medicament { min-width: 260px; }
.lignes .col-lot { min-width: 150px; }
.lignes input[type='number'] { width: 90px; text-align: right; }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; font-size: 0.88rem; }
tr.ligne-manque td { background: #fff5f5; }
tr.ligne-excedent td { background: #fffaf0; }
.ecart-negatif { color: var(--danger); font-weight: 700; }
.ecart-positif { color: #b35c00; font-weight: 700; }
.aide { margin: 0.4rem 0 0; font-size: 0.8rem; color: var(--muted); }
.intro { margin: 0 0 1rem; }
.choix-decision { display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 0.5rem; padding: 0.65rem 0.85rem; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; }
.choix-decision.actif { border-color: var(--primary); background: var(--primary-light); }
.choix-decision span { display: flex; flex-direction: column; gap: 0.15rem; }
.choix-decision small { color: var(--muted); }
.champ { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.75rem; }
textarea { width: 100%; resize: vertical; }
</style>
