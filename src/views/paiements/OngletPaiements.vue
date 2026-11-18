<!--
  =============================================================================
  ONGLET « PAIEMENTS ET AVANCES »
  =============================================================================
  Encaissements des centres (cahier des charges §3.6) :
  - NOUVEAU PAIEMENT : centre, date, mode, référence, montant. Le montant est
    RÉPARTI sur les factures non soldées du centre (« Répartir
    automatiquement » : les plus anciennes d'abord, modifiable ligne par
    ligne). Le reste non réparti devient une AVANCE.
  - AVANCE : paiement sans facture ; « Imputer » la répartit plus tard.
  - REÇU en PDF ; ANNULATION tracée (motif) : factures recalculées.
  Propriété : preparation ({ centreId, factureId }) venant d'une facture
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n° reçu, centre, référence)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.mode" :options="options(MODES_PAIEMENT)" placeholder="Tous les modes" />
      </div>
      <div class="periode">
        <ChampDate v-model="filtres.du" title="Du" />
        <span>au</span>
        <ChampDate v-model="filtres.au" title="Au" />
      </div>
      <label class="case-a-cocher"><input v-model="filtres.avecAvance" type="checkbox" /> Avances disponibles</label>
      <span class="espace"></span>
      <ImportExportTableau titre="Paiements et avances" :sous-titre="sousTitrePdf" nom-fichier="paiements" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="nouveau()">+ Nouveau paiement</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° reçu</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="mode">Mode</ColonneTri>
            <th>Factures réglées</th>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="avance" class="nombre">Avance restante</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in lignesPage" :key="p.id" :class="{ 'ligne-inactive': p.annule }">
            <td class="code">{{ p.numero }}</td>
            <td>{{ formaterDate(p.datePaiement) }}</td>
            <td><strong>{{ p.centre.nom }}</strong></td>
            <td>
              {{ MODES_PAIEMENT[p.mode] || p.mode }}
              <small v-if="p.reference" class="detail">{{ p.reference }}</small>
            </td>
            <td>
              <span v-if="p.annule" class="badge badge-rouge">Annulé</span>
              <span v-else-if="p.imputations.length">{{ p.imputations.map((i) => i.facture.numero).join(', ') }}</span>
              <span v-else class="badge badge-orange">Avance</span>
            </td>
            <td class="nombre">{{ formaterMontant(p.montant) }}</td>
            <td class="nombre"><strong v-if="Number(p.montantNonImpute) > 0" class="avance">{{ formaterMontant(p.montantNonImpute) }}</strong><span v-else>—</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(p)">Voir</button>
              <button v-si-imprimer class="bouton-lien" title="Reçu (PDF)" @click="imprimer(p)">Reçu</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="paiementsAffiches.length" />
      <p v-if="!chargement && paiementsAffiches.length === 0" class="tableau-vide">Aucun paiement.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== NOUVEAU PAIEMENT / IMPUTATION ===================== -->
    <FenetreModale v-if="formulaire" :titre="formulaire.paiementId ? `Imputer l'avance du reçu ${formulaire.numero}` : 'Nouveau paiement'" tres-large @fermer="formulaire = null">
      <form id="form-paiement" class="grille-formulaire" @submit.prevent="enregistrer">
        <template v-if="!formulaire.paiementId">
          <div>
            <label class="obligatoire">Centre de santé</label>
            <ListeDeroulante v-model="formulaire.centreId" :options="centres" champ-libelle="nom" placeholder="— Choisir le centre —" @update:model-value="chargerFactures" />
          </div>
          <div>
            <label class="obligatoire">Date du paiement</label>
            <ChampDate v-model="formulaire.datePaiement" :max="dateDuJour()" obligatoire />
          </div>
          <div>
            <label class="obligatoire">Mode de paiement</label>
            <ListeDeroulante v-model="formulaire.mode" :options="options(MODES_PAIEMENT)" :effacable="false" />
          </div>
          <div>
            <label>Référence</label>
            <input v-model.trim="formulaire.reference" maxlength="100" placeholder="N° de chèque, de virement, de transaction…" />
          </div>
          <div>
            <label class="obligatoire">Montant reçu (FCFA)</label>
            <input v-model.number="formulaire.montant" type="number" min="1" step="1" required class="montant" />
          </div>
          <div>
            <label>Observations</label>
            <input v-model.trim="formulaire.observations" maxlength="255" />
          </div>
        </template>
        <div v-else class="pleine-largeur encart">
          Avance disponible : <strong>{{ formaterMontant(formulaire.montant) }}</strong> — centre <strong>{{ formulaire.centreNom }}</strong>.
        </div>

        <div class="pleine-largeur">
          <div class="entete-section">
            <h4 class="section">Répartition sur les factures non soldées</h4>
            <button v-if="formulaire.factures.length" type="button" class="bouton-lien" @click="repartir">Répartir automatiquement (plus anciennes d'abord)</button>
            <ImportExportTableau
              v-if="formulaire.factures.length"
              titre="Factures non soldées"
              :sous-titre="formulaire.centreNom || ''"
              nom-fichier="factures_non_soldees"
              :colonnes-pdf="COLONNES_REPARTITION"
              :lignes="formulaire.factures"
            />
          </div>
          <table v-if="formulaire.factures.length" class="tableau lignes">
            <thead>
              <tr><th>Facture</th><th>Objet</th><th>Échéance</th><th class="nombre">Montant</th><th class="nombre">Reste à payer</th><th class="nombre">Montant réglé</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in formulaire.factures" :key="f.id" :class="{ cible: f.id === formulaire.factureCible }">
                <td class="code">{{ f.numero }}</td>
                <td>{{ objetFacture(f) }}</td>
                <td :class="{ retard: f.enRetard }">{{ f.dateEcheance ? formaterDate(f.dateEcheance) : '—' }}</td>
                <td class="nombre">{{ formaterMontant(f.montantTotal) }}</td>
                <td class="nombre">{{ formaterMontant(f.solde) }}</td>
                <td class="nombre"><input v-model.number="f.impute" type="number" min="0" :max="f.solde" step="1" placeholder="0" /></td>
              </tr>
            </tbody>
          </table>
          <p v-else-if="formulaire.centreId" class="aide">Ce centre n'a aucune facture non soldée : le montant sera enregistré comme <strong>avance</strong>.</p>
          <p v-else class="aide">Choisissez le centre pour afficher ses factures non soldées.</p>

          <div v-if="formulaire.centreId" class="recap">
            <span>Montant {{ formulaire.paiementId ? 'disponible' : 'reçu' }} : <strong>{{ formaterMontant(formulaire.montant || 0) }}</strong></span>
            <span>Réparti : <strong>{{ formaterMontant(totalReparti) }}</strong></span>
            <span :class="{ erreur: resteAvance < 0 }">
              {{ resteAvance < 0 ? 'Dépassement' : 'Reste en avance' }} : <strong>{{ formaterMontant(Math.abs(resteAvance)) }}</strong>
            </span>
          </div>
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Annuler</button>
        <button type="submit" form="form-paiement" :disabled="enregistrement">{{ formulaire.paiementId ? "Imputer l'avance" : 'Enregistrer le paiement' }}</button>
      </template>
    </FenetreModale>

    <!-- ===================== DÉTAIL D'UN PAIEMENT ===================== -->
    <FenetreModale v-if="detail" :titre="`Reçu ${detail.numero} — ${detail.centre.nom}`" large @fermer="detail = null">
      <div v-if="detail.annule" class="encart encart-alerte">
        <strong>Paiement annulé</strong> le {{ formaterDate(detail.dateAnnulation) }}
        <span v-if="detail.annulateur"> par {{ nomPersonne(detail.annulateur) }}</span> — motif : {{ detail.motifAnnulation }}
      </div>
      <div class="fiche">
        <div><span>Date</span><strong>{{ formaterDate(detail.datePaiement) }}</strong></div>
        <div><span>Mode</span><strong>{{ MODES_PAIEMENT[detail.mode] }}</strong></div>
        <div><span>Référence</span><strong>{{ detail.reference || '—' }}</strong></div>
        <div><span>Enregistré par</span><strong>{{ nomPersonne(detail.utilisateur) }}</strong></div>
        <div><span>Montant reçu</span><strong>{{ formaterMontant(detail.montant) }}</strong></div>
        <div><span>Avance restante</span><strong class="avance">{{ formaterMontant(detail.montantNonImpute) }}</strong></div>
      </div>
      <div class="titre-avec-export">
        <h4 class="section">Factures réglées</h4>
        <ImportExportTableau
          v-if="detail.imputations.length"
          :titre="`Factures réglées par le reçu ${detail.numero}`"
          :sous-titre="detail.centre.nom"
          :nom-fichier="`recu_${detail.numero}_factures`"
          :colonnes-pdf="COLONNES_FACTURES_REGLEES"
          :lignes="detail.imputations"
        />
      </div>
      <table v-if="detail.imputations.length" class="tableau lignes">
        <thead><tr><th>Facture</th><th>Date</th><th class="nombre">Montant facture</th><th class="nombre">Montant réglé</th></tr></thead>
        <tbody>
          <tr v-for="i in detail.imputations" :key="i.id">
            <td class="code">{{ i.facture.numero }}</td>
            <td>{{ formaterDate(i.facture.dateEmission) }}</td>
            <td class="nombre">{{ formaterMontant(i.facture.montantTotal) }}</td>
            <td class="nombre">{{ formaterMontant(i.montant) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="aide">{{ detail.annule ? 'Imputations retirées à l\'annulation.' : 'Aucune facture réglée : avance.' }}</p>
      <p v-if="detail.observations" class="aide">Observations : {{ detail.observations }}</p>
      <template #pied>
        <button class="bouton-secondaire" @click="detail = null">Fermer</button>
        <button v-si-imprimer type="button" class="bouton-secondaire" @click="recuPdf(detail)">Reçu (PDF)</button>
        <template v-if="!detail.annule">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler le paiement</button>
          <button v-if="Number(detail.montantNonImpute) > 0" v-si-modif type="button" @click="imputer">Imputer l'avance</button>
        </template>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne } from '@/utils/documentPdf'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import { annulerPaiement, creerPaiement, facturesNonSoldees, imputerPaiement, listerPaiements, trouverPaiement } from '@/api/facturation'
import { MODES_PAIEMENT, objetFacture, options, recuPdf } from '@/views/facturation/financesCommun'

const props = defineProps({
  /** { centreId, factureId } : paiement d'une facture précise (depuis Facturation) */
  preparation: { type: Object, default: null },
})
const emit = defineEmits(['modifie'])
const store = useStore()

const paiements = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, mode: null, du: '', au: '', avecAvance: false })
const formulaire = ref(null)
const detail = ref(null)

const centres = computed(() => store.state.referentiel.centres)

const paiementsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return paiements.value
  return paiements.value.filter((p) => [p.numero, p.centre.nom, p.reference].some((v) => (v || '').toLowerCase().includes(texte)))
})

async function charger() {
  chargement.value = true
  try {
    paiements.value = await listerPaiements({ ...filtres, avecAvance: filtres.avecAvance ? 1 : '' })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// NOUVEAU PAIEMENT
// ---------------------------------------------------------------------------
async function nouveau(centreId = null, factureCible = null) {
  formulaire.value = {
    centreId,
    datePaiement: dateDuJour(),
    mode: 'ESPECES',
    reference: '',
    montant: null,
    observations: '',
    factures: [],
    factureCible,
  }
  if (centreId) await chargerFactures()
}

async function chargerFactures() {
  const f = formulaire.value
  f.factures = []
  if (!f.centreId) return
  try {
    f.factures = (await facturesNonSoldees(f.centreId)).map((x) => ({ ...x, impute: null }))
    // Paiement d'une facture précise : montant proposé = son reste à payer
    const cible = f.factures.find((x) => x.id === f.factureCible)
    if (cible && !f.paiementId) {
      f.montant = cible.solde
      cible.impute = cible.solde
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

const totalReparti = computed(() => (formulaire.value?.factures || []).reduce((t, f) => t + (Number(f.impute) || 0), 0))
const resteAvance = computed(() => (Number(formulaire.value?.montant) || 0) - totalReparti.value)

/** Répartit le montant sur les factures, les plus anciennes d'abord. */
function repartir() {
  let reste = Number(formulaire.value.montant) || 0
  for (const f of formulaire.value.factures) {
    const part = Math.min(reste, f.solde)
    f.impute = part > 0 ? part : null
    reste -= Math.max(part, 0)
  }
}

async function enregistrer() {
  const f = formulaire.value
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  if (!(Number(f.montant) > 0)) return store.dispatch('notifications/erreur', 'Indiquez le montant.')
  const trop = f.factures.find((x) => (Number(x.impute) || 0) > x.solde)
  if (trop) return store.dispatch('notifications/erreur', `Facture ${trop.numero} : le montant réglé dépasse le reste à payer.`)
  if (resteAvance.value < 0) return store.dispatch('notifications/erreur', 'Le total réparti dépasse le montant.')
  const imputations = f.factures.filter((x) => Number(x.impute) > 0).map((x) => ({ factureId: x.id, montant: Number(x.impute) }))

  if (f.paiementId) {
    if (imputations.length === 0) return store.dispatch('notifications/erreur', 'Indiquez le montant à imputer sur au moins une facture.')
  } else {
    const avance = resteAvance.value
    const confirme = await confirmer({
      titre: 'Enregistrer le paiement ?',
      texte: `${formaterMontant(f.montant)} reçus : ${formaterMontant(totalReparti.value)} sur ${imputations.length} facture(s)${avance > 0 ? `, ${formaterMontant(avance)} en avance` : ''}.`,
      boutonConfirmer: 'Oui, enregistrer',
    })
    if (!confirme) return
  }

  enregistrement.value = true
  try {
    const paiement = f.paiementId
      ? await imputerPaiement(f.paiementId, imputations)
      : await creerPaiement({
          centreId: f.centreId,
          datePaiement: f.datePaiement,
          montant: Number(f.montant),
          mode: f.mode,
          reference: f.reference || undefined,
          observations: f.observations || undefined,
          imputations,
        })
    store.dispatch('notifications/succes', f.paiementId ? 'Avance imputée.' : `Paiement enregistré : reçu ${paiement.numero}.`)
    formulaire.value = null
    detail.value = paiement
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------
// DÉTAIL, IMPUTATION D'UNE AVANCE, ANNULATION
// ---------------------------------------------------------------------------
async function ouvrir(p) {
  try {
    detail.value = await trouverPaiement(p.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function imprimer(p) {
  try {
    recuPdf(await trouverPaiement(p.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function imputer() {
  const d = detail.value
  formulaire.value = {
    paiementId: d.id,
    numero: d.numero,
    centreId: d.centreId,
    centreNom: d.centre.nom,
    montant: Number(d.montantNonImpute),
    factures: [],
  }
  detail.value = null
  await chargerFactures()
  if (formulaire.value.factures.length === 0) {
    store.dispatch('notifications/erreur', "Ce centre n'a aucune facture non soldée sur laquelle imputer l'avance.")
    formulaire.value = null
  }
}

async function annuler() {
  const motif = await demanderTexte({
    titre: `Annuler le paiement ${detail.value.numero} ?`,
    texte: 'Le paiement reste dans l\'historique (annulé) ; les factures réglées redeviennent à payer.',
    libelle: "Motif de l'annulation (ex. chèque rejeté)",
    boutonConfirmer: 'Annuler le paiement',
  })
  if (motif === null) return
  enregistrement.value = true
  try {
    detail.value = await annulerPaiement(detail.value.id, motif)
    store.dispatch('notifications/succes', 'Paiement annulé : factures recalculées.')
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// Paiement d'une facture précise (bouton « Enregistrer un paiement » de Facturation)
watch(
  () => props.preparation,
  (p) => p && nouveau(p.centreId, p.factureId),
  { immediate: true },
)

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (p) => p.numero,
  date: (p) => p.datePaiement,
  centre: (p) => p.centre.nom,
  mode: (p) => MODES_PAIEMENT[p.mode],
  montant: (p) => Number(p.montant),
  avance: (p) => Number(p.montantNonImpute),
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(paiementsAffiches, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    filtres.mode ? MODES_PAIEMENT[filtres.mode] : 'tous les modes',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ]
    .filter(Boolean)
    .join(' — ')
})
// Export PDF / Excel des tableaux des fenêtres
const COLONNES_REPARTITION = [
  { titre: 'Facture', valeur: (f) => f.numero },
  { titre: 'Objet', valeur: (f) => objetFacture(f) },
  { titre: 'Échéance', valeur: (f) => (f.dateEcheance ? formaterDate(f.dateEcheance) : '—') },
  { titre: 'Montant', valeur: (f) => formaterMontant(f.montantTotal), droite: true, somme: (f) => Number(f.montantTotal), formatTotal: formaterMontant },
  { titre: 'Reste à payer', valeur: (f) => formaterMontant(f.solde), droite: true, somme: (f) => Number(f.solde), formatTotal: formaterMontant },
  { titre: 'Montant réglé', valeur: (f) => formaterMontant(Number(f.impute) || 0), droite: true, somme: (f) => Number(f.impute) || 0, formatTotal: formaterMontant },
]
const COLONNES_FACTURES_REGLEES = [
  { titre: 'Facture', valeur: (i) => i.facture.numero },
  { titre: 'Date', valeur: (i) => formaterDate(i.facture.dateEmission) },
  { titre: 'Montant facture', valeur: (i) => formaterMontant(i.facture.montantTotal), droite: true },
  { titre: 'Montant réglé', valeur: (i) => formaterMontant(i.montant), droite: true, somme: (i) => Number(i.montant), formatTotal: formaterMontant },
]

const COLONNES_PDF = [
  { titre: 'N° reçu', valeur: (p) => p.numero },
  { titre: 'Date', valeur: (p) => formaterDate(p.datePaiement) },
  { titre: 'Centre', valeur: (p) => p.centre.nom },
  { titre: 'Mode', valeur: (p) => `${MODES_PAIEMENT[p.mode] || p.mode}${p.reference ? ` ${p.reference}` : ''}` },
  { titre: 'Factures', valeur: (p) => (p.annule ? 'ANNULÉ' : p.imputations.map((i) => i.facture.numero).join(', ') || 'Avance') },
  { titre: 'Montant', valeur: (p) => formaterMontant(p.montant), droite: true, somme: (p) => (p.annule ? 0 : Number(p.montant)), formatTotal: formaterMontant },
  { titre: 'Avance restante', valeur: (p) => formaterMontant(p.montantNonImpute), droite: true, somme: (p) => Number(p.montantNonImpute), formatTotal: formaterMontant },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.case-a-cocher { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; white-space: nowrap; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.avance { color: #b35c00; }
.montant { font-size: 1.05rem; font-weight: 700; }
.encart { padding: 0.65rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.9rem; }
.encart-alerte { margin-bottom: 1rem; background: #fdecec; color: #8f1d1d; }
.entete-section { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.section { flex: 1; margin: 0.75rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes input[type='number'] { width: 120px; text-align: right; }
tr.cible td { background: var(--primary-light); }
.retard { color: var(--danger); font-weight: 600; }
.recap { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 8px; background: #f7faf8; font-size: 0.9rem; }
.recap .erreur { color: var(--danger); }
.fiche { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem 1rem; margin-bottom: 1rem; padding: 0.85rem 1rem; border-radius: 10px; background: #f7faf8; }
.fiche div { display: flex; flex-direction: column; gap: 0.1rem; }
.fiche span { font-size: 0.75rem; color: var(--muted); }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
