<!--
  =============================================================================
  ASSISTANT « FACTURE → PAIEMENT → TERMINÉ » (une seule fenêtre)
  =============================================================================
  Fenêtre commune aux factures GÉNÉRÉE et MANUELLE. On enchaîne les étapes
  avec « Suivant » au lieu d'ouvrir une nouvelle fenêtre à chaque fois :

      ① Facture  ──►  ② Paiement  ──►  ③ Terminé

  ① Facture  : contenu fourni par le parent (slot par défaut + slot « pied »).
               Quand le parent a créé la facture, il la passe dans « facture »
               et l'assistant passe tout seul à l'étape ②.
  ② Paiement : formulaire de paiement pré-rempli (centre, facture, montant =
               reste à payer). « Payer plus tard » passe à ③ sans paiement.
               Étape sautée si l'utilisateur n'a pas le droit « paiements ».
  ③ Terminé  : récapitulatif + impression de la facture et du reçu.

  Propriétés : titre ; facture (null tant qu'elle n'est pas créée)
  Événements : @fermer        -> fermée AVANT la création de la facture ;
               @termine(fact) -> fermée APRÈS (la liste doit être rechargée).
  =============================================================================
-->
<template>
  <FenetreModale :titre="titreFenetre" tres-large @fermer="fermer">
    <EtapesCircuit :etapes="['Facture', 'Paiement', 'Terminé']" :courante="etape === 2 ? 3 : etape" :aide="aide" />

    <!-- ① FACTURE : contenu du parent -->
    <slot v-if="etape === 0" />

    <!-- ② PAIEMENT -->
    <template v-else-if="etape === 1 && factureComplete">
      <div class="encart">
        Facture <strong>{{ factureComplete.numero }}</strong> — {{ factureComplete.centre.nom }} —
        montant <strong>{{ formaterMontant(factureComplete.montantTotal) }}</strong>,
        reste à payer <strong>{{ formaterMontant(factureComplete.solde) }}</strong>.
        <span v-if="factureComplete.avancesDisponibles > 0">
          Le centre a <strong>{{ formaterMontant(factureComplete.avancesDisponibles) }}</strong> d'avances disponibles.
        </span>
      </div>
      <!-- « key » : le formulaire repart de zéro après l'utilisation des avances -->
      <FormulairePaiement
        ref="formPaiement"
        :key="cleFormulaire"
        id-formulaire="form-paiement-facture"
        :centre-id="factureComplete.centreId"
        :facture-cible="factureComplete.id"
        centre-fixe
        @enregistre="apresPaiement"
      />
    </template>

    <!-- ③ TERMINÉ : récapitulatif -->
    <template v-else-if="etape === 2 && factureComplete">
      <div class="fiche">
        <div><span>Facture</span><strong>{{ factureComplete.numero }}</strong></div>
        <div><span>Centre</span><strong>{{ factureComplete.centre.nom }}</strong></div>
        <div><span>Montant</span><strong>{{ formaterMontant(factureComplete.montantTotal) }}</strong></div>
        <div><span>Payé</span><strong>{{ formaterMontant(factureComplete.montantPaye) }}</strong></div>
        <div><span>Reste à payer</span><strong :class="{ rouge: factureComplete.solde > 0 }">{{ formaterMontant(factureComplete.solde) }}</strong></div>
        <div v-if="paiement"><span>Reçu</span><strong>{{ paiement.numero }} ({{ formaterMontant(paiement.montant) }})</strong></div>
      </div>
      <p class="aide">
        Le stock du district a été mis à jour.
        <template v-if="factureComplete.solde > 0">Le reste pourra être payé plus tard (Facturation &gt; détail de la facture, ou Paiements &amp; comptes).</template>
      </p>
    </template>

    <p v-else-if="etape > 0" class="aide">Chargement…</p>

    <template #pied>
      <!-- ① boutons du parent -->
      <slot v-if="etape === 0" name="pied" />

      <!-- ② -->
      <template v-else-if="etape === 1">
        <button type="button" class="bouton-secondaire" :disabled="occupe" @click="etape = 2">Payer plus tard</button>
        <button
          v-if="factureComplete?.avancesDisponibles > 0"
          type="button"
          class="bouton-secondaire"
          :disabled="occupe"
          @click="utiliserAvances"
        >
          Utiliser les avances ({{ formaterMontant(Math.min(factureComplete.avancesDisponibles, factureComplete.solde)) }})
        </button>
        <button type="submit" form="form-paiement-facture" :disabled="occupe || !factureComplete">Enregistrer le paiement →</button>
      </template>

      <!-- ③ -->
      <template v-else>
        <button v-si-imprimer type="button" class="bouton-secondaire" :disabled="!factureComplete" @click="facturePdf(factureComplete)">Imprimer la facture</button>
        <button v-if="paiement" v-si-imprimer type="button" class="bouton-secondaire" @click="recuPdf(paiement)">Imprimer le reçu</button>
        <button type="button" @click="fermer">Fermer</button>
      </template>
    </template>
  </FenetreModale>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import EtapesCircuit from '@/components/EtapesCircuit.vue'
import FormulairePaiement from '@/views/paiements/FormulairePaiement.vue'
import { confirmer } from '@/utils/alertes'
import { formaterMontant } from '@/utils/format'
import { imputerAvancesSurFacture, trouverFacture } from '@/api/facturation'
import { facturePdf, recuPdf } from './financesCommun'

const props = defineProps({
  titre: { type: String, required: true },
  /** Facture créée par le parent (null tant qu'on est à l'étape ①) */
  facture: { type: Object, default: null },
})
const emit = defineEmits(['fermer', 'termine'])
const store = useStore()

const etape = ref(0) // 0 = facture, 1 = paiement, 2 = terminé
const factureComplete = ref(null) // facture rechargée (solde, avances du centre…)
const paiement = ref(null) // reçu enregistré à l'étape ②
const formPaiement = ref(null)
const cleFormulaire = ref(0)
const avancesEnCours = ref(false)

const peutPayer = computed(() => store.getters['auth/peutModifier']('paiements'))
const occupe = computed(() => avancesEnCours.value || !!formPaiement.value?.enregistrement)

const titreFenetre = computed(() => {
  if (etape.value === 0) return props.titre
  const numero = factureComplete.value?.numero || props.facture?.numero || ''
  return etape.value === 1 ? `Paiement de la facture ${numero}` : `Facture ${numero} — terminé`
})

const aide = computed(() => {
  if (etape.value === 0) return 'Vérifiez les quantités puis validez la facture (sortie du stock du district).'
  if (etape.value === 1) return 'Saisissez le paiement du centre, ou « Payer plus tard ».'
  return paiement.value ? 'Facture validée et paiement enregistré.' : 'Facture validée ; paiement à faire plus tard.'
})

/** Recharge la facture (solde, avances disponibles du centre). */
async function rechargerFacture() {
  factureComplete.value = await trouverFacture(props.facture.id)
}

// Le parent vient de créer la facture : on passe à l'étape ② (ou ③ si pas de paiement possible)
watch(
  () => props.facture,
  async (f) => {
    if (!f) return
    etape.value = 1
    try {
      await rechargerFacture()
    } catch (erreur) {
      store.dispatch('notifications/erreurApi', erreur)
      factureComplete.value = f
    }
    if (!peutPayer.value || !(factureComplete.value.solde > 0)) etape.value = 2
  },
)

/** Paiement enregistré : récapitulatif. */
async function apresPaiement(p) {
  paiement.value = p
  try {
    await rechargerFacture()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
  etape.value = 2
}

/** Impute les avances disponibles du centre sur cette facture. */
async function utiliserAvances() {
  const f = factureComplete.value
  const montant = Math.min(f.avancesDisponibles, f.solde)
  const confirme = await confirmer({
    titre: 'Utiliser les avances du centre ?',
    texte: `${formaterMontant(montant)} d'avances seront imputés sur la facture ${f.numero} (les plus anciennes d'abord).`,
    boutonConfirmer: 'Oui, imputer',
  })
  if (!confirme) return
  avancesEnCours.value = true
  try {
    const r = await imputerAvancesSurFacture(f.id)
    store.dispatch('notifications/succes', `${formaterMontant(r.montantImpute)} imputés sur la facture.`)
    await rechargerFacture()
    if (factureComplete.value.solde > 0) cleFormulaire.value++ // nouveau reste à payer dans le formulaire
    else etape.value = 2
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    avancesEnCours.value = false
  }
}

/** × ou « Fermer » : si la facture existe, la liste doit être rechargée. */
function fermer() {
  if (props.facture) emit('termine', factureComplete.value || props.facture)
  else emit('fermer')
}
</script>

<style scoped>
.encart { margin-bottom: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.88rem; }
.fiche { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem 1rem; margin-bottom: 1rem; padding: 0.85rem 1rem; border-radius: 10px; background: #f7faf8; }
.fiche div { display: flex; flex-direction: column; gap: 0.1rem; }
.fiche span { font-size: 0.75rem; color: var(--muted); }
.rouge { color: var(--danger); }
.aide { font-size: 0.85rem; color: var(--muted); }
</style>
