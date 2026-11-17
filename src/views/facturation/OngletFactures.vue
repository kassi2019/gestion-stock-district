<!--
  =============================================================================
  ONGLET « FACTURES »
  =============================================================================
  Factures des centres (cahier des charges §3.6) : numérotation, archivage,
  impression PDF, montant facturé / payé / solde, échéance (en rouge si dépassée).
  SPEC NOV. 2026 : une facture = une SORTIE de stock du district vers un centre
  (plusieurs par mois), de deux sortes :
    - « + Facture générée » : fin de mois, à partir du rapport VALIDÉ du centre
      (quantités calculées, validées ou réduites) -> FenetreFactureGeneree.vue ;
    - « + Facture manuelle » : en cours de mois, produits ajoutés un par un,
      sans rapport -> FenetreFactureManuelle.vue.
  Détail : lignes, paiements imputés, et actions :
    - « Utiliser les avances » : impute les avances disponibles du centre ;
    - « Enregistrer un paiement » : ouvre Paiements avec le centre et la facture ;
    - « Annuler la facture » (motif ; seulement si aucun paiement imputé).
      Facture-sortie : le stock revient au district (refusé si le rapport du
      centre pour ce mois est déjà validé). Ancienne facture : le rapport
      redevient « validé » et peut être refacturé.
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre, rapport)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="options(STATUTS_FACTURE)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Émises du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="au" />
      </div>
      <label class="case-a-cocher"><input v-model="enRetardSeulement" type="checkbox" /> En retard</label>
      <span class="espace"></span>
      <ImportExportTableau titre="Factures" :sous-titre="sousTitrePdf" nom-fichier="factures" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="nouvelleGeneree = true">+ Facture générée</button>
      <button v-si-modif @click="nouvelleManuelle = true">+ Facture manuelle</button>
    </div>

    <div class="totaux">
      <div class="total-case"><span>Facturé</span><strong>{{ formaterMontant(totaux.facture) }}</strong></div>
      <div class="total-case"><span>Payé</span><strong>{{ formaterMontant(totaux.paye) }}</strong></div>
      <div class="total-case rouge"><span>Reste à payer</span><strong>{{ formaterMontant(totaux.solde) }}</strong></div>
      <div class="total-case orange"><span>En retard</span><strong>{{ formaterMontant(totaux.retard) }}</strong></div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° facture</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Émise le</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="objet">Objet</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="paye" class="nombre">Payé</ColonneTri>
            <ColonneTri v-model="tri" cle="solde" class="nombre">Reste</ColonneTri>
            <ColonneTri v-model="tri" cle="echeance">Échéance</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in lignesPage" :key="f.id" :class="{ 'ligne-inactive': f.statut === 'ANNULEE' }">
            <td class="code">{{ f.numero }}</td>
            <td>{{ formaterDate(f.dateEmission) }}</td>
            <td><strong>{{ f.centre.nom }}</strong></td>
            <td>{{ objetFacture(f) }}</td>
            <td class="nombre">{{ formaterMontant(f.montantTotal) }}</td>
            <td class="nombre">{{ formaterMontant(f.montantPaye) }}</td>
            <td class="nombre"><strong :class="{ rouge: f.solde > 0 }">{{ formaterMontant(f.solde) }}</strong></td>
            <td :class="{ retard: f.enRetard }">{{ f.dateEcheance ? formaterDate(f.dateEcheance) : '—' }}<small v-if="f.enRetard"> (en retard)</small></td>
            <td><span class="badge" :class="STATUTS_FACTURE[f.statut]?.badge">{{ STATUTS_FACTURE[f.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(f)">Voir</button>
              <button v-si-imprimer class="bouton-lien" title="Facture (PDF)" @click="imprimer(f)">PDF</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="facturesAffichees.length" />
      <p v-if="!chargement && facturesAffichees.length === 0" class="tableau-vide">Aucune facture.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== DÉTAIL D'UNE FACTURE ===================== -->
    <FenetreModale v-if="detail" :titre="`Facture ${detail.numero} — ${detail.centre.nom}`" tres-large @fermer="detail = null">
      <div class="bandeau-statut">
        <span class="badge" :class="STATUTS_FACTURE[detail.statut]?.badge">{{ STATUTS_FACTURE[detail.statut]?.libelle }}</span>
        <small v-if="detail.enRetard" class="retard">Échéance dépassée ({{ formaterDate(detail.dateEcheance) }})</small>
      </div>
      <div v-if="detail.statut === 'ANNULEE'" class="encart encart-alerte">
        <strong>Facture annulée</strong> le {{ formaterDate(detail.dateAnnulation) }}
        <span v-if="detail.annulateur"> par {{ nomPersonne(detail.annulateur) }}</span> — motif : {{ detail.motifAnnulation }}
      </div>

      <div class="fiche">
        <div><span>Émise le</span><strong>{{ formaterDate(detail.dateEmission) }}</strong></div>
        <div><span>Échéance</span><strong>{{ detail.dateEcheance ? formaterDate(detail.dateEcheance) : '—' }}</strong></div>
        <div><span>Objet</span><strong>{{ objetFacture(detail) }}{{ detail.rapport ? ` (${detail.rapport.numero})` : '' }}</strong></div>
        <div><span>Établie par</span><strong>{{ nomPersonne(detail.utilisateur) }}</strong></div>
        <div v-if="detail.sortieStock"><span>Origine</span><strong>{{ ORIGINES_FACTURE[detail.origine] || '—' }}</strong></div>
        <div><span>Montant</span><strong>{{ formaterMontant(detail.montantTotal) }}</strong></div>
        <div><span>Payé</span><strong>{{ formaterMontant(detail.montantPaye) }}</strong></div>
        <div><span>Reste à payer</span><strong :class="{ rouge: detail.solde > 0 }">{{ formaterMontant(detail.solde) }}</strong></div>
        <div v-if="detail.solde > 0"><span>Avances du centre</span><strong>{{ formaterMontant(detail.avancesDisponibles) }}</strong></div>
      </div>

      <h4 class="section">{{ detail.sortieStock ? 'Produits livrés (sortis du stock du district)' : 'Médicaments facturés' }}</h4>
      <table class="tableau lignes">
        <thead>
          <tr>
            <th>Médicament</th><th>Unité</th>
            <th v-if="detail.sortieStock">Lot</th>
            <th class="nombre">Quantité</th><th class="nombre">Prix unitaire</th><th class="nombre">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in detail.lignes" :key="l.id">
            <td>{{ l.medicament.code }} — {{ l.medicament.designation }}</td>
            <td>{{ l.medicament.uniteVente?.libelle || '' }}</td>
            <td v-if="detail.sortieStock">
              {{ l.lot?.numeroLot || '—' }}<small v-if="l.lot?.datePeremption" class="detail-lot"> (exp. {{ formaterDate(l.lot.datePeremption) }})</small>
            </td>
            <td class="nombre">{{ formaterNombre(l.quantite) }}</td>
            <td class="nombre">{{ formaterMontant(l.prixUnitaire) }}</td>
            <td class="nombre">{{ formaterMontant(l.montant) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td :colspan="detail.sortieStock ? 5 : 4" class="nombre"><strong>MONTANT TOTAL</strong></td><td class="nombre"><strong>{{ formaterMontant(detail.montantTotal) }}</strong></td></tr>
        </tfoot>
      </table>

      <h4 class="section">Paiements reçus</h4>
      <table v-if="detail.imputations.length" class="tableau lignes">
        <thead>
          <tr><th>Reçu</th><th>Date</th><th>Mode</th><th>Référence</th><th class="nombre">Montant réglé</th></tr>
        </thead>
        <tbody>
          <tr v-for="i in detail.imputations" :key="i.id">
            <td class="code">{{ i.paiement.numero }}</td>
            <td>{{ formaterDate(i.paiement.datePaiement) }}</td>
            <td>{{ MODES_PAIEMENT[i.paiement.mode] || i.paiement.mode }}</td>
            <td>{{ i.paiement.reference || '' }}</td>
            <td class="nombre">{{ formaterMontant(i.montant) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="aide">Aucun paiement pour le moment.</p>

      <template #pied>
        <button class="bouton-secondaire" @click="detail = null">Fermer</button>
        <button v-si-imprimer type="button" class="bouton-secondaire" @click="facturePdf(detail)">Facture (PDF)</button>
        <template v-if="detail.statut !== 'ANNULEE'">
          <button v-if="detail.imputations.length === 0" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler la facture</button>
          <template v-if="detail.solde > 0 && peutModifierPaiements">
            <button v-if="detail.avancesDisponibles > 0" type="button" class="bouton-secondaire" :disabled="enregistrement" @click="utiliserAvances">
              Utiliser les avances ({{ formaterMontant(Math.min(detail.avancesDisponibles, detail.solde)) }})
            </button>
            <button type="button" @click="enregistrerPaiement">Enregistrer un paiement</button>
          </template>
        </template>
      </template>
    </FenetreModale>

    <!-- ===================== NOUVELLE FACTURE MANUELLE ===================== -->
    <FenetreFactureManuelle v-if="nouvelleManuelle" @fermer="nouvelleManuelle = false" @creee="apresCreation" />

    <!-- ===================== NOUVELLE FACTURE GÉNÉRÉE (rapport du centre) ===================== -->
    <FenetreFactureGeneree v-if="nouvelleGeneree" @fermer="nouvelleGeneree = false" @creee="apresCreation" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import FenetreFactureManuelle from './FenetreFactureManuelle.vue'
import FenetreFactureGeneree from './FenetreFactureGeneree.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { annulerFacture, imputerAvancesSurFacture, listerFactures, trouverFacture } from '@/api/facturation'
import { facturePdf, MODES_PAIEMENT, objetFacture, options, ORIGINES_FACTURE, STATUTS_FACTURE } from './financesCommun'

const props = defineProps({
  /** Ids des factures à mettre en avant / ouvrir (après génération) */
  aOuvrir: { type: Number, default: null },
})
const store = useStore()
const router = useRouter()

const factures = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const enRetardSeulement = ref(false)
const filtres = reactive({ centreId: null, statut: null, du: '', au: '' })
const detail = ref(null)
const nouvelleManuelle = ref(false)
const nouvelleGeneree = ref(false)

const centres = computed(() => store.state.referentiel.centres)
const peutModifierPaiements = computed(() => store.getters['auth/peutModifier']('paiements'))

const facturesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  return factures.value.filter(
    (f) =>
      (!enRetardSeulement.value || f.enRetard) &&
      (!texte || [f.numero, f.centre.nom, f.rapport?.numero].some((v) => (v || '').toLowerCase().includes(texte))),
  )
})

const totaux = computed(() => {
  const valides = facturesAffichees.value.filter((f) => f.statut !== 'ANNULEE')
  return {
    facture: valides.reduce((t, f) => t + Number(f.montantTotal), 0),
    paye: valides.reduce((t, f) => t + Number(f.montantPaye), 0),
    solde: valides.reduce((t, f) => t + f.solde, 0),
    retard: valides.filter((f) => f.enRetard).reduce((t, f) => t + f.solde, 0),
  }
})

async function charger() {
  chargement.value = true
  try {
    factures.value = await listerFactures(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

async function ouvrir(f) {
  try {
    detail.value = await trouverFacture(f.id)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}
watch(
  () => props.aOuvrir,
  (id) => id && ouvrir({ id }),
  { immediate: true },
)

async function imprimer(f) {
  try {
    facturePdf(await trouverFacture(f.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Facture (manuelle ou générée) créée : liste rechargée et facture ouverte. */
async function apresCreation(facture) {
  nouvelleManuelle.value = false
  nouvelleGeneree.value = false
  await charger()
  detail.value = facture
}

async function annuler() {
  const texte = detail.value.sortieStock
    ? "Elle restera dans l'historique avec le statut « Annulée ». Les produits REVIENNENT dans le stock du district (mêmes lots) et sortent du stock du centre."
    : "Elle restera dans l'historique avec le statut « Annulée ». Le rapport de consommation redeviendra « validé » et pourra être refacturé."
  const motif = await demanderTexte({
    titre: `Annuler la facture ${detail.value.numero} ?`,
    texte,
    libelle: "Motif de l'annulation",
    boutonConfirmer: 'Annuler la facture',
  })
  if (motif === null) return
  enregistrement.value = true
  try {
    detail.value = await annulerFacture(detail.value.id, motif)
    store.dispatch('notifications/succes', 'Facture annulée.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function utiliserAvances() {
  const d = detail.value
  const montant = Math.min(d.avancesDisponibles, d.solde)
  const confirme = await confirmer({
    titre: 'Utiliser les avances du centre ?',
    texte: `${formaterMontant(montant)} d'avances seront imputés sur la facture ${d.numero} (les plus anciennes d'abord).`,
    boutonConfirmer: 'Oui, imputer',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const r = await imputerAvancesSurFacture(d.id)
    store.dispatch('notifications/succes', `${formaterMontant(r.montantImpute)} imputés sur la facture.`)
    detail.value = await trouverFacture(d.id)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Ouvre le module Paiements avec le centre et la facture pré-sélectionnés. */
function enregistrerPaiement() {
  router.push({ path: '/paiements', query: { centre: detail.value.centreId, facture: detail.value.id } })
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (f) => f.numero,
  date: (f) => f.dateEmission,
  centre: (f) => f.centre.nom,
  objet: (f) => objetFacture(f),
  montant: (f) => Number(f.montantTotal),
  paye: (f) => Number(f.montantPaye),
  solde: (f) => f.solde,
  echeance: (f) => f.dateEcheance,
  statut: (f) => STATUTS_FACTURE[f.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(facturesAffichees, [recherche, enRetardSeulement], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [
    c ? `Centre : ${c.nom}` : 'Tous les centres',
    filtres.statut ? STATUTS_FACTURE[filtres.statut].libelle : 'tous les statuts',
    filtres.du || filtres.au ? `émises du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
    enRetardSeulement.value ? 'en retard' : '',
  ]
    .filter(Boolean)
    .join(' — ')
})
const COLONNES_PDF = [
  { titre: 'N° facture', valeur: (f) => f.numero },
  { titre: 'Émise le', valeur: (f) => formaterDate(f.dateEmission) },
  { titre: 'Centre', valeur: (f) => f.centre.nom },
  { titre: 'Objet', valeur: (f) => objetFacture(f) },
  { titre: 'Statut', valeur: (f) => STATUTS_FACTURE[f.statut]?.libelle },
  { titre: 'Montant', valeur: (f) => formaterMontant(f.montantTotal), droite: true, somme: (f) => (f.statut === 'ANNULEE' ? 0 : Number(f.montantTotal)), formatTotal: formaterMontant },
  { titre: 'Payé', valeur: (f) => formaterMontant(f.montantPaye), droite: true, somme: (f) => (f.statut === 'ANNULEE' ? 0 : Number(f.montantPaye)), formatTotal: formaterMontant },
  { titre: 'Reste', valeur: (f) => formaterMontant(f.solde), droite: true, somme: (f) => f.solde, formatTotal: formaterMontant },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
defineExpose({ charger })
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.case-a-cocher { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; white-space: nowrap; }
.totaux { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin: 0.5rem 0 1rem; }
.total-case { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1rem; border-radius: 12px; background: var(--primary-light); }
.total-case span { font-size: 0.8rem; color: var(--muted); }
.total-case strong { font-size: 1.1rem; color: var(--primary-dark); }
.total-case.rouge { background: #fdecec; }
.total-case.rouge strong { color: var(--danger); }
.total-case.orange { background: #fff4e5; }
.total-case.orange strong { color: #b35c00; }
.rouge { color: var(--danger); }
.retard { color: var(--danger); font-weight: 600; }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.encart { margin-bottom: 1rem; padding: 0.65rem 0.9rem; border-radius: 8px; font-size: 0.88rem; }
.encart-alerte { background: #fdecec; color: #8f1d1d; }
.fiche { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem 1rem; margin-bottom: 1rem; padding: 0.85rem 1rem; border-radius: 10px; background: #f7faf8; }
.fiche div { display: flex; flex-direction: column; gap: 0.1rem; }
.fiche span { font-size: 0.75rem; color: var(--muted); }
.section { margin: 0.75rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.aide { font-size: 0.85rem; color: var(--muted); }
.detail-lot { font-size: 0.75rem; color: var(--muted); }
@media (max-width: 1000px) { .totaux, .fiche { grid-template-columns: 1fr 1fr; } }
</style>
