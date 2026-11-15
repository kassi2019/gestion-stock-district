<!--
  =============================================================================
  ONGLET « À FACTURER »
  =============================================================================
  Rapports de consommation VALIDÉS pas encore facturés. On coche un ou
  plusieurs rapports (ou « tout cocher ») et on génère UNE FACTURE PAR RAPPORT,
  à la date d'émission choisie (échéance = émission + délai de paiement,
  réglable dans Paramétrage > Paramètres généraux).
  Seules les lignes payantes sont facturées (consommables à 0 exclus) ; c'est
  la quantité vérifiée sur place qui est retenue si elle existe.
  Événement : @generees(ids) -> la page affiche l'onglet Factures
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <div class="filtre">
        <ListeDeroulante v-model="centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <span class="espace"></span>
      <label class="date-emission">
        Date d'émission
        <input v-model="dateEmission" type="date" :max="dateDuJour()" />
      </label>
      <button v-si-modif :disabled="selection.size === 0 || enregistrement" @click="generer">
        Générer {{ selection.size || '' }} facture(s){{ selection.size ? ` — ${formaterMontant(montantSelection)}` : '' }}
      </button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <th class="col-case"><input type="checkbox" :checked="toutCoche" :indeterminate.prop="selection.size > 0 && !toutCoche" title="Tout cocher" @change="toutCocher" /></th>
            <th>N° rapport</th>
            <th>Période</th>
            <th>Centre</th>
            <th class="nombre">Lignes</th>
            <th>Validé le</th>
            <th class="nombre">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rapportsAffiches" :key="r.id" :class="{ coche: selection.has(r.id) }" @click="basculer(r.id)">
            <td class="col-case" @click.stop><input type="checkbox" :checked="selection.has(r.id)" @change="basculer(r.id)" /></td>
            <td class="code">{{ r.numero }}</td>
            <td>{{ periodeRapport(r) }}</td>
            <td><strong>{{ r.centre.nom }}</strong></td>
            <td class="nombre">{{ r._count?.lignes ?? 0 }}</td>
            <td>{{ r.dateValidation ? formaterDate(r.dateValidation) : '—' }}</td>
            <td class="nombre">{{ formaterMontant(r.montantTotal) }}</td>
          </tr>
        </tbody>
        <tfoot v-if="rapportsAffiches.length">
          <tr>
            <td colspan="6" class="nombre"><strong>TOTAL À FACTURER</strong></td>
            <td class="nombre"><strong>{{ formaterMontant(rapportsAffiches.reduce((t, r) => t + Number(r.montantTotal), 0)) }}</strong></td>
          </tr>
        </tfoot>
      </table>
      <p v-if="!chargement && rapportsAffiches.length === 0" class="tableau-vide">
        ✔ Aucun rapport en attente de facturation. (Les rapports apparaissent ici une fois validés dans « Consommations mensuelles ».)
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import { genererFactures, rapportsAFacturer } from '@/api/facturation'
import { periodeRapport } from './financesCommun'

const emit = defineEmits(['generees'])
const store = useStore()

const rapports = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const centreId = ref(null)
const dateEmission = ref(dateDuJour())
const selection = ref(new Set())

const centres = computed(() => store.state.referentiel.centres)
const rapportsAffiches = computed(() => rapports.value.filter((r) => !centreId.value || r.centreId === centreId.value))
const toutCoche = computed(() => rapportsAffiches.value.length > 0 && rapportsAffiches.value.every((r) => selection.value.has(r.id)))
const montantSelection = computed(() => rapports.value.filter((r) => selection.value.has(r.id)).reduce((t, r) => t + Number(r.montantTotal), 0))

function basculer(id) {
  const s = new Set(selection.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selection.value = s
}
function toutCocher() {
  selection.value = toutCoche.value ? new Set() : new Set(rapportsAffiches.value.map((r) => r.id))
}

async function charger() {
  chargement.value = true
  try {
    rapports.value = await rapportsAFacturer()
    selection.value = new Set([...selection.value].filter((id) => rapports.value.some((r) => r.id === id)))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

async function generer() {
  const n = selection.value.size
  const confirme = await confirmer({
    titre: `Générer ${n} facture(s) ?`,
    texte: `Une facture par rapport, émise le ${formaterDate(dateEmission.value)}, pour un total de ${formaterMontant(montantSelection.value)}. Les rapports passeront au statut « Facturé ».`,
    boutonConfirmer: 'Oui, générer',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const creees = await genererFactures([...selection.value], dateEmission.value)
    store.dispatch('notifications/succes', `${creees.length} facture(s) générée(s) : ${creees.map((f) => f.numero).join(', ')}.`)
    selection.value = new Set()
    await charger()
    emit('generees', creees.map((f) => f.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.date-emission { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--muted); }
.date-emission input { width: 150px; }
.col-case { width: 36px; text-align: center; }
tbody tr { cursor: pointer; }
tr.coche td { background: var(--primary-light); }
tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
</style>
