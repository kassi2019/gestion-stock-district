<!--
  =============================================================================
  FICHE DE STOCK D'UN MÉDICAMENT (fenêtre)
  =============================================================================
  Sur une période (du / au, facultatifs) : stock au début, chaque mouvement
  (date, type, pièce, lot, motif, entrée / sortie, SOLDE après le mouvement,
  auteur), totaux des entrées et sorties, stock en fin. Édition en PDF.

  Utilisation :  <FicheStock v-if="ficheDe" :medicament-id="ficheDe.id" @fermer="ficheDe = null" />
  =============================================================================
-->
<template>
  <FenetreModale :titre="fiche ? `Fiche de stock — ${fiche.medicament.designation}` : 'Fiche de stock'" tres-large @fermer="emit('fermer')">
    <div class="barre-outils">
      <div class="periode">
        <span>Période du</span>
        <input v-model="du" type="date" />
        <span>au</span>
        <input v-model="au" type="date" />
      </div>
      <span class="espace"></span>
      <button v-if="fiche" v-si-imprimer class="bouton-secondaire" @click="ficheStockPdf(fiche, du, au)">Fiche de stock PDF</button>
    </div>

    <p v-if="chargement" class="tableau-vide">Chargement…</p>
    <template v-else-if="fiche">
      <div class="resume">
        <div><span>Stock au début</span><strong>{{ formaterNombre(fiche.stockInitial) }}</strong></div>
        <div class="entree"><span>Entrées</span><strong>+{{ formaterNombre(fiche.entrees) }}</strong></div>
        <div class="sortie"><span>Sorties</span><strong>−{{ formaterNombre(fiche.sorties) }}</strong></div>
        <div class="fin"><span>Stock en fin</span><strong>{{ formaterNombre(fiche.stockFinal) }}</strong></div>
      </div>

      <div class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mouvement</th>
              <th>Pièce</th>
              <th>Lot</th>
              <th>Motif</th>
              <th class="nombre">Entrée</th>
              <th class="nombre">Sortie</th>
              <th class="nombre">Solde</th>
              <th>Par</th>
            </tr>
          </thead>
          <tbody>
            <tr class="ligne-debut">
              <td colspan="7">Stock au début de la période</td>
              <td class="nombre"><strong>{{ formaterNombre(fiche.stockInitial) }}</strong></td>
              <td></td>
            </tr>
            <tr v-for="mv in fiche.mouvements" :key="mv.id">
              <td>{{ formaterDateHeure(mv.dateMouvement) }}</td>
              <td><span class="badge" :class="TYPES_MOUVEMENT[mv.type]?.badge">{{ TYPES_MOUVEMENT[mv.type]?.libelle || mv.type }}</span></td>
              <td class="code">{{ mv.pieceRef || '—' }}</td>
              <td>{{ mv.lot?.numeroLot || '—' }}</td>
              <td class="motif">{{ mv.motif || '—' }}</td>
              <td class="nombre entree">{{ TYPES_MOUVEMENT[mv.type]?.sens > 0 ? formaterNombre(mv.quantite) : '' }}</td>
              <td class="nombre sortie">{{ TYPES_MOUVEMENT[mv.type]?.sens < 0 ? formaterNombre(mv.quantite) : '' }}</td>
              <td class="nombre"><strong>{{ formaterNombre(mv.stockApres) }}</strong></td>
              <td class="detail">{{ mv.utilisateur?.prenoms }} {{ mv.utilisateur?.nom }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="fiche.mouvements.length === 0" class="tableau-vide">Aucun mouvement sur cette période.</p>
      </div>
    </template>

    <template #pied>
      <button class="bouton-secondaire" @click="emit('fermer')">Fermer</button>
    </template>
  </FenetreModale>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import { formaterNombre } from '@/utils/format'
import { ficheStock } from '@/api/stock'
import { ficheStockPdf, TYPES_MOUVEMENT } from './stockCommun'

const props = defineProps({
  medicamentId: { type: Number, required: true },
})
const emit = defineEmits(['fermer'])
const store = useStore()

const fiche = ref(null)
const chargement = ref(false)
const du = ref('')
const au = ref('')

/** Date et heure (ex. « 15/11/2026 14:37 »). */
function formaterDateHeure(valeur) {
  const d = new Date(valeur)
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

async function charger() {
  chargement.value = true
  try {
    fiche.value = await ficheStock(props.medicamentId, du.value, au.value)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch([du, au], charger)
onMounted(charger)
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.resume { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
.resume div { display: flex; flex-direction: column; padding: 0.65rem 0.9rem; border-radius: 10px; background: var(--fond-pale); font-size: 0.8rem; color: var(--muted); }
.resume strong { font-size: 1.25rem; color: var(--texte-sur-fond); }
.resume .entree strong { color: var(--primary-dark); }
.resume .sortie strong { color: var(--danger); }
.resume .fin { background: var(--primary-light); }
.ligne-debut td { background: #f7faf8; font-style: italic; color: var(--muted); }
td.entree { color: var(--primary-dark); font-weight: 700; }
td.sortie { color: var(--danger); font-weight: 700; }
.motif { max-width: 260px; font-size: 0.85rem; }
.detail { font-size: 0.8rem; color: var(--muted); }
</style>
