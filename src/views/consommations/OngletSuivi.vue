<!--
  =============================================================================
  ONGLET « SUIVI DES RAPPORTS » (rapports centre — spec nov. 2026)
  =============================================================================
  Tableau d'une année : une ligne par centre actif, une colonne par mois.
  Chaque case montre le rapport du mois (statut, montant, vérifié ou non) ou
  « manquant » si le centre n'a rien déclaré pour un mois écoulé.
  Clic sur une case : ouvre le rapport, ou en crée un pour ce centre et ce mois.
  Événement : @ouvrir({ id } | { centreId, annee, mois })
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <button class="bouton-secondaire" title="Année précédente" @click="annee--">◀</button>
      <strong class="annee">{{ annee }}</strong>
      <button class="bouton-secondaire" title="Année suivante" :disabled="annee >= anneeCourante" @click="annee++">▶</button>
      <span class="espace"></span>
      <div class="legende">
        <span class="case-legende manquant"></span> Manquant
        <span class="case-legende brouillon"></span> Brouillon
        <span class="case-legende valide"></span> Validé
      </div>
    </div>

    <div class="resume">
      <div class="carte"><span>{{ resume.attendus }}</span><small>rapports attendus (mois écoulés)</small></div>
      <div class="carte"><span>{{ resume.recus }}</span><small>rapports reçus</small></div>
      <div class="carte alerte"><span>{{ resume.manquants }}</span><small>rapports manquants</small></div>
      <div class="carte"><span>{{ formaterMontant(resume.montantValide) }}</span><small>consommation validée</small></div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau grille">
        <thead>
          <tr>
            <th>Centre</th>
            <th v-for="(m, i) in MOIS" :key="m" class="mois">{{ m.substring(0, 3) }}.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ligne in suivi" :key="ligne.centre.id">
            <td><strong>{{ ligne.centre.nom }}</strong></td>
            <td v-for="(m, i) in MOIS" :key="m" class="cellule">
              <button
                v-if="ligne.mois[i + 1]"
                class="case"
                :class="classeCase(ligne.mois[i + 1].statut)"
                :title="`${ligne.mois[i + 1].numero} — ${STATUTS_RAPPORT[ligne.mois[i + 1].statut]?.libelle} — ${formaterMontant(ligne.mois[i + 1].montantTotal)}`"
                @click="emit('ouvrir', { id: ligne.mois[i + 1].id })"
              >
                <span>{{ montantCourt(ligne.mois[i + 1].montantTotal) }}</span>
                <small v-if="ligne.mois[i + 1].verifie">✔</small>
              </button>
              <button
                v-else-if="!estFutur(i + 1)"
                class="case manquant"
                :title="`Aucun rapport pour ${libellePeriode(annee, i + 1)} : cliquer pour le saisir`"
                @click="saisir(ligne.centre.id, i + 1)"
              >
                +
              </button>
              <span v-else class="case futur"></span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!chargement && suivi.length === 0" class="tableau-vide">Aucun centre de santé actif.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { suiviRapportsCentre } from '@/api/consommations'
import { formaterMontant } from '@/utils/format'
import { libellePeriode, MOIS, STATUTS_RAPPORT } from './consommationsCommun'

const emit = defineEmits(['ouvrir'])
const store = useStore()
const anneeCourante = new Date().getFullYear()
const annee = ref(anneeCourante)
const suivi = ref([])
const chargement = ref(false)

/** Mois pas encore commencé : aucun rapport attendu. */
function estFutur(mois) {
  const d = new Date()
  return annee.value * 12 + mois > d.getFullYear() * 12 + d.getMonth() + 1
}
/** Mois terminé (rapport attendu) : avant le mois en cours. */
function estEcoule(mois) {
  const d = new Date()
  return annee.value * 12 + mois < d.getFullYear() * 12 + d.getMonth() + 1
}

function classeCase(statut) {
  return { BROUILLON: 'brouillon', SOUMIS: 'soumis', VALIDE: 'valide', FACTURE: 'valide' }[statut] || ''
}
/** 125 000 -> « 125k » (pour tenir dans la case). */
function montantCourt(valeur) {
  const n = Number(valeur) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

const resume = computed(() => {
  let attendus = 0, recus = 0, manquants = 0, verifies = 0, montantValide = 0
  for (const ligne of suivi.value) {
    for (let m = 1; m <= 12; m++) {
      const r = ligne.mois[m]
      if (estEcoule(m)) attendus++
      if (r) {
        recus++
        if (r.verifie) verifies++
        if (r.statut === 'VALIDE' || r.statut === 'FACTURE') montantValide += Number(r.montantTotal)
      } else if (estEcoule(m)) {
        manquants++
      }
    }
  }
  return { attendus, recus, manquants, verifies, montantValide }
})

function saisir(centreId, mois) {
  emit('ouvrir', { centreId, annee: annee.value, mois })
}

async function charger() {
  chargement.value = true
  try {
    suivi.value = await suiviRapportsCentre(annee.value)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(annee, charger)
onMounted(charger)
defineExpose({ charger })
</script>

<style scoped>
.annee { font-size: 1.15rem; color: var(--primary-dark); min-width: 50px; text-align: center; }
.legende { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--muted); flex-wrap: wrap; }
.case-legende { display: inline-block; width: 14px; height: 14px; border-radius: 4px; margin-left: 0.5rem; }
.resume { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin: 0.5rem 0 1rem; }
.carte { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.85rem 1rem; border-radius: 12px; background: var(--primary-light); }
.carte span { font-size: 1.25rem; font-weight: 800; color: var(--primary-dark); }
.carte small { color: var(--muted); font-size: 0.8rem; }
.carte.alerte { background: #fdecec; }
.carte.alerte span { color: var(--danger); }
.grille th.mois { text-align: center; width: 62px; }
.grille td.cellule { padding: 0.3rem; text-align: center; }
.case {
  width: 56px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0;
}
.case small { font-size: 0.7rem; }
.manquant, .case-legende.manquant { background: #fdecec; color: var(--danger); border: 1px dashed #f3b4b4; }
.brouillon, .case-legende.brouillon { background: #eef0f2; color: #4b5563; }
.soumis, .case-legende.soumis { background: #e3eefc; color: #1d4f91; }
.valide, .case-legende.valide { background: var(--primary); color: #fff; }
.futur { background: transparent; }
.case:not(.futur):hover { filter: brightness(0.95); transform: translateY(-1px); }
@media (max-width: 1000px) { .resume { grid-template-columns: 1fr 1fr; } }
</style>
