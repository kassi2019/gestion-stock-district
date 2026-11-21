<!--
  =============================================================================
  FORMULAIRE DE PAIEMENT (réutilisable, SANS fenêtre autour)
  =============================================================================
  Utilisé à trois endroits :
    - Paiements & comptes > « + Nouveau paiement » et « Imputer l'avance » ;
    - l'assistant de facturation (étape ② Paiement, juste après la facture) ;
    - le détail d'une facture (« Enregistrer un paiement »).

  Contenu : centre, date, mode, référence, montant, puis RÉPARTITION du montant
  sur les factures non soldées du centre. Le reste non réparti devient une AVANCE.
  UN SEUL montant à saisir, au choix :
    - on tape le MONTANT REÇU      -> il est réparti tout seul (facture visée
      d'abord, puis les plus anciennes) ;
    - on tape les MONTANTS RÉGLÉS  -> le montant reçu = leur total.
  Paiement partiel (« un peu un peu ») : la colonne « Reste après paiement »
  montre ce qui restera dû sur chaque facture.

  Le bouton d'envoi est dans le pied de la fenêtre du PARENT :
      <button type="submit" :form="idFormulaire" :disabled="refFormulaire?.enregistrement">

  Propriétés :
    - idFormulaire : id du <form> (pour le bouton du parent) ;
    - centreId     : centre pré-choisi ;
    - factureCible : facture à régler (surlignée, montant proposé = son reste) ;
    - centreFixe   : le centre n'est pas modifiable (on vient d'une facture) ;
    - avance       : paiement dont on IMPUTE l'avance (au lieu d'un nouveau).
  Événements :
    - @enregistre(paiement) : paiement créé (ou avance imputée) ;
    - @impossible           : avance à imputer mais aucune facture non soldée.
  =============================================================================
-->
<template>
  <form :id="idFormulaire" class="grille-formulaire" @submit.prevent="enregistrer">
    <template v-if="!avance">
      <div v-if="!centreFixe">
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
        <label class="obligatoire">Montant reçu du centre (FCFA)</label>
        <!-- @input (saisie de l'utilisateur seulement) : répartition automatique -->
        <ChampMontant v-model="formulaire.montant" required class="montant" @input="repartir" />
      </div>
      <div>
        <label>Observations</label>
        <input v-model.trim="formulaire.observations" maxlength="255" />
      </div>
    </template>
    <div v-else class="pleine-largeur encart">
      Avance disponible : <strong>{{ formaterMontant(formulaire.montant) }}</strong> — centre <strong>{{ nomCentre }}</strong>.
    </div>

    <div class="pleine-largeur">
      <div class="entete-section">
        <h4 class="section">Répartition sur les factures non soldées</h4>
        <button v-if="formulaire.factures.length" type="button" class="bouton-lien" @click="repartir">Répartir de nouveau</button>
        <ImportExportTableau
          v-if="formulaire.factures.length"
          titre="Factures non soldées"
          :sous-titre="nomCentre"
          nom-fichier="factures_non_soldees"
          :colonnes-pdf="COLONNES_REPARTITION"
          :lignes="formulaire.factures"
        />
      </div>
      <table v-if="formulaire.factures.length" class="tableau lignes">
        <thead>
          <tr><th>Facture</th><th>Objet</th><th>Échéance</th><th class="nombre">Montant</th><th class="nombre">Reste à payer</th><th class="nombre">Montant réglé</th><th class="nombre">Reste après paiement</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in formulaire.factures" :key="f.id" :class="{ cible: f.id === factureCible }">
            <td class="code">{{ f.numero }}</td>
            <td>{{ objetFacture(f) }}</td>
            <td :class="{ retard: f.enRetard }">{{ f.dateEcheance ? formaterDate(f.dateEcheance) : '—' }}</td>
            <td class="nombre">{{ formaterMontant(f.montantTotal) }}</td>
            <td class="nombre">{{ formaterMontant(f.solde) }}</td>
            <!-- @input : le montant reçu suit le total des montants réglés -->
            <td class="nombre"><ChampMontant v-model="f.impute" placeholder="0" class="champ-ligne" @input="ajusterMontantRecu" /></td>
            <td class="nombre" :class="{ erreur: resteApres(f) < 0, solde: resteApres(f) === 0 }">
              {{ resteApres(f) < 0 ? 'Trop payé' : resteApres(f) === 0 ? 'Soldée' : formaterMontant(resteApres(f)) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="formulaire.centreId" class="aide">Ce centre n'a aucune facture non soldée : le montant sera enregistré comme <strong>avance</strong>.</p>
      <p v-else class="aide">Choisissez le centre pour afficher ses factures non soldées.</p>

      <div v-if="formulaire.centreId" class="recap">
        <span>Montant {{ avance ? 'disponible' : 'reçu' }} : <strong>{{ formaterMontant(formulaire.montant || 0) }}</strong></span>
        <span>Réglé sur les factures : <strong>{{ formaterMontant(totalReparti) }}</strong></span>
        <span v-if="resteAvance > 0">Gardé en avance pour le centre : <strong>{{ formaterMontant(resteAvance) }}</strong></span>
        <span v-if="resteAvance < 0" class="erreur">
          Vous réglez {{ formaterMontant(-resteAvance) }} de plus que l'avance disponible : réduisez les montants réglés.
        </span>
      </div>
    </div>
  </form>
</template>

<script setup>
import ChampMontant from '@/components/ChampMontant.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import ChampDate from '@/components/ChampDate.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import { creerPaiement, facturesNonSoldees, imputerPaiement } from '@/api/facturation'
import { MODES_PAIEMENT, objetFacture, options } from '@/views/facturation/financesCommun'

const props = defineProps({
  idFormulaire: { type: String, default: 'form-paiement' },
  centreId: { type: Number, default: null },
  factureCible: { type: Number, default: null },
  centreFixe: { type: Boolean, default: false },
  /** Paiement dont on impute l'avance ({ id, numero, centreId, centre, montantNonImpute }) */
  avance: { type: Object, default: null },
})
const emit = defineEmits(['enregistre', 'impossible'])
const store = useStore()

const enregistrement = ref(false)
const centres = computed(() => store.state.referentiel.centres)

// Valeurs de départ : imputation d'une avance, ou nouveau paiement
const formulaire = reactive({
  centreId: props.avance ? props.avance.centreId : props.centreId,
  datePaiement: dateDuJour(),
  mode: 'ESPECES',
  reference: '',
  montant: props.avance ? Number(props.avance.montantNonImpute) : null,
  observations: '',
  factures: [],
})

const nomCentre = computed(() => props.avance?.centre?.nom || centres.value.find((c) => c.id === formulaire.centreId)?.nom || '')

/** Factures non soldées du centre choisi (montant proposé = reste de la facture cible). */
async function chargerFactures() {
  formulaire.factures = []
  if (!formulaire.centreId) return
  try {
    formulaire.factures = (await facturesNonSoldees(formulaire.centreId)).map((x) => ({ ...x, impute: null }))
    const cible = formulaire.factures.find((x) => x.id === props.factureCible)
    if (cible && !props.avance) {
      formulaire.montant = cible.solde
      cible.impute = cible.solde
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

const totalReparti = computed(() => formulaire.factures.reduce((t, f) => t + (Number(f.impute) || 0), 0))
const resteAvance = computed(() => (Number(formulaire.montant) || 0) - totalReparti.value)

/** Répartit le montant reçu : facture visée d'abord, puis les plus anciennes. */
function repartir() {
  let reste = Number(formulaire.montant) || 0
  const cible = formulaire.factures.filter((f) => f.id === props.factureCible)
  const autres = formulaire.factures.filter((f) => f.id !== props.factureCible)
  for (const f of [...cible, ...autres]) {
    const part = Math.min(reste, f.solde)
    f.impute = part > 0 ? part : null
    reste -= Math.max(part, 0)
  }
}

/**
 * Un montant réglé a été saisi : le montant reçu devient le total des montants
 * réglés s'il était plus petit (plus de « dépassement » à corriger à la main).
 * Avance à imputer : le montant est fixe, on ne le change pas.
 */
function ajusterMontantRecu() {
  if (props.avance) return
  if ((Number(formulaire.montant) || 0) < totalReparti.value) formulaire.montant = totalReparti.value
}

/** Ce qui restera dû sur la facture après ce paiement. */
function resteApres(f) {
  return f.solde - (Number(f.impute) || 0)
}

async function enregistrer() {
  const f = formulaire
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  if (!(Number(f.montant) > 0)) return store.dispatch('notifications/erreur', 'Indiquez le montant.')
  const trop = f.factures.find((x) => (Number(x.impute) || 0) > x.solde)
  if (trop) return store.dispatch('notifications/erreur', `Facture ${trop.numero} : le montant réglé dépasse le reste à payer.`)
  if (resteAvance.value < 0) return store.dispatch('notifications/erreur', 'Le total réparti dépasse le montant.')
  const imputations = f.factures.filter((x) => Number(x.impute) > 0).map((x) => ({ factureId: x.id, montant: Number(x.impute) }))

  if (props.avance) {
    if (imputations.length === 0) return store.dispatch('notifications/erreur', 'Indiquez le montant à imputer sur au moins une facture.')
  } else {
    const reste = resteAvance.value
    const confirme = await confirmer({
      titre: 'Enregistrer le paiement ?',
      texte: `${formaterMontant(f.montant)} reçus : ${formaterMontant(totalReparti.value)} sur ${imputations.length} facture(s)${reste > 0 ? `, ${formaterMontant(reste)} en avance` : ''}.`,
      boutonConfirmer: 'Oui, enregistrer',
    })
    if (!confirme) return
  }

  enregistrement.value = true
  try {
    const paiement = props.avance
      ? await imputerPaiement(props.avance.id, imputations)
      : await creerPaiement({
          centreId: f.centreId,
          datePaiement: f.datePaiement,
          montant: Number(f.montant),
          mode: f.mode,
          reference: f.reference || undefined,
          observations: f.observations || undefined,
          imputations,
        })
    store.dispatch('notifications/succes', props.avance ? 'Avance imputée.' : `Paiement enregistré : reçu ${paiement.numero}.`)
    emit('enregistre', paiement)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// Export PDF / Excel du tableau de répartition
const COLONNES_REPARTITION = [
  { titre: 'Facture', valeur: (f) => f.numero },
  { titre: 'Objet', valeur: (f) => objetFacture(f) },
  { titre: 'Échéance', valeur: (f) => (f.dateEcheance ? formaterDate(f.dateEcheance) : '—') },
  { titre: 'Montant', valeur: (f) => formaterMontant(f.montantTotal), droite: true, somme: (f) => Number(f.montantTotal), formatTotal: formaterMontant },
  { titre: 'Reste à payer', valeur: (f) => formaterMontant(f.solde), droite: true, somme: (f) => Number(f.solde), formatTotal: formaterMontant },
  { titre: 'Montant réglé', valeur: (f) => formaterMontant(Number(f.impute) || 0), droite: true, somme: (f) => Number(f.impute) || 0, formatTotal: formaterMontant },
  { titre: 'Reste après paiement', valeur: (f) => formaterMontant(resteApres(f)), droite: true, somme: (f) => resteApres(f), formatTotal: formaterMontant },
]

onMounted(async () => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  await chargerFactures()
  // Avance à imputer alors qu'il n'y a aucune facture à payer : on prévient le parent
  if (props.avance && formulaire.factures.length === 0) {
    store.dispatch('notifications/erreur', "Ce centre n'a aucune facture non soldée sur laquelle imputer l'avance.")
    emit('impossible')
  }
})

// Le parent lit « enregistrement » pour désactiver son bouton pendant l'envoi
defineExpose({ enregistrement })
</script>

<style scoped>
.montant { font-size: 1.05rem; font-weight: 700; }
.encart { padding: 0.65rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.9rem; }
.entete-section { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.section { flex: 1; margin: 0.75rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .champ-ligne { width: 130px; }
tr.cible td { background: var(--primary-light); }
.retard { color: var(--danger); font-weight: 600; }
.erreur { color: var(--danger); font-weight: 600; }
.solde { color: var(--primary-dark); font-weight: 600; }
.recap { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 8px; background: #f7faf8; font-size: 0.9rem; }
.recap .erreur { color: var(--danger); }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
