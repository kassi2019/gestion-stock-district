<!--
  =============================================================================
  ONGLET « ALERTES » (cahier des charges §3.3)
  =============================================================================
  Trois listes, chacune avec son PDF :
    1. STOCK : médicaments actifs EN RUPTURE (0) ou SOUS LE SEUIL d'alerte
       (seuil défini sur le médicament) ;
    2. LOTS PÉRIMÉS encore en stock : bouton « Sortir tous les lots périmés »
       (motif + n° du PV de destruction ; un mouvement « Sortie — périmés » par
       lot). Ils sont aussi sortis AUTOMATIQUEMENT chaque nuit si le paramètre
       « Sortie automatique des lots périmés » est activé ;
    3. LOTS PROCHES DE LA PÉREMPTION : expirent dans le délai d'alerte
       (Paramétrage > Paramètres généraux > « Alerte de péremption »).

  Propriétés : etat (stock), delaiAlerte (jours)
  =============================================================================
-->
<template>
  <div class="alertes">
    <!-- ===================== 1. RUPTURES ET SOUS LE SEUIL ===================== -->
    <section class="carte-alerte">
      <header>
        <h3><span class="pastille rouge">{{ alertesStock.length }}</span> Ruptures et stocks sous le seuil</h3>
        <ImportExportTableau
          titre="Alertes de stock : ruptures et stocks sous le seuil"
          nom-fichier="alertes_stock"
          :colonnes-pdf="COLONNES_STOCK"
          :lignes="alertesStock"
        />
      </header>
      <table v-if="alertesStock.length" class="tableau">
        <thead>
          <tr>
            <th>Médicament</th>
            <th>Famille</th>
            <th class="nombre">Stock</th>
            <th class="nombre">Seuil</th>
            <th class="nombre">À commander (≥)</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in alertesStock" :key="m.id">
            <td><strong>{{ m.designation }}</strong> <span class="detail">{{ m.code }}</span></td>
            <td>{{ m.famille?.libelle || '—' }}</td>
            <td class="nombre"><strong>{{ formaterNombre(m.stock) }}</strong></td>
            <td class="nombre">{{ m.seuilAlerte ? formaterNombre(m.seuilAlerte) : '—' }}</td>
            <td class="nombre">{{ m.seuilAlerte ? formaterNombre(Math.max(m.seuilAlerte - m.stock, 0)) : '—' }}</td>
            <td><span class="badge" :class="etatMedicament(m).badge">{{ etatMedicament(m).libelle }}</span></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="rien">Aucune rupture ni stock sous le seuil.</p>
    </section>

    <!-- ===================== 2. LOTS PÉRIMÉS ===================== -->
    <section class="carte-alerte">
      <header>
        <h3><span class="pastille rouge">{{ lotsPerimes.length }}</span> Lots périmés encore en stock</h3>
        <div class="actions-entete">
          <button v-if="lotsPerimes.length" v-si-modif type="button" class="bouton-danger" @click="ouvrirSortie">
            🗑️ Sortir tous les lots périmés
          </button>
          <ImportExportTableau titre="Lots périmés en stock" nom-fichier="lots_perimes" :colonnes-pdf="COLONNES_LOTS" :lignes="lotsPerimes" />
        </div>
      </header>
      <table v-if="lotsPerimes.length" class="tableau">
        <thead>
          <tr><th>Médicament</th><th>Lot</th><th>Péremption</th><th>Depuis</th><th class="nombre">Quantité</th><th class="nombre">Valeur (achat)</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in lotsPerimes" :key="l.stockId">
            <td><strong>{{ l.medicament.designation }}</strong> <span class="detail">{{ l.medicament.code }}</span></td>
            <td>{{ l.numeroLot }}</td>
            <td>{{ formaterDate(l.datePeremption) }}</td>
            <td><span class="badge badge-rouge">{{ -l.jours }} jour(s)</span></td>
            <td class="nombre"><strong>{{ formaterNombre(l.quantite) }}</strong></td>
            <td class="nombre">{{ l.valeur !== null ? formaterMontant(l.valeur) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="rien">Aucun lot périmé en stock.</p>
      <p class="conseil">
        <template v-if="sortieAuto">
          🌙 <strong>Sortie automatique activée</strong> : chaque nuit (00 h 30), les lots périmés sont sortis du stock
          (motif « Sortie automatique »). Pensez à retirer aussi les boîtes des étagères.
        </template>
        <template v-else>
          Sortie automatique désactivée : utilisez le bouton « Sortir tous les lots périmés », ou « Retirer » dans
          l'onglet Inventaire.
        </template>
        (Réglage : Paramétrage &gt; Paramètres généraux.)
      </p>
    </section>

    <!-- ===================== 3. LOTS PROCHES DE LA PÉREMPTION ===================== -->
    <section class="carte-alerte">
      <header>
        <h3>
          <span class="pastille orange">{{ lotsProches.length }}</span>
          Lots qui expirent dans les {{ delaiAlerte }} prochains jours
        </h3>
        <ImportExportTableau
          :titre="`Lots proches de la péremption (${delaiAlerte} jours)`"
          nom-fichier="lots_proches_peremption"
          :colonnes-pdf="COLONNES_LOTS"
          :lignes="lotsProches"
        />
      </header>
      <table v-if="lotsProches.length" class="tableau">
        <thead>
          <tr><th>Médicament</th><th>Lot</th><th>Péremption</th><th>Délai</th><th class="nombre">Quantité</th><th class="nombre">Valeur (achat)</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in lotsProches" :key="l.stockId">
            <td><strong>{{ l.medicament.designation }}</strong> <span class="detail">{{ l.medicament.code }}</span></td>
            <td>{{ l.numeroLot }}</td>
            <td>{{ formaterDate(l.datePeremption) }}</td>
            <td><span class="badge badge-orange">{{ l.jours }} jour(s)</span></td>
            <td class="nombre"><strong>{{ formaterNombre(l.quantite) }}</strong></td>
            <td class="nombre">{{ l.valeur !== null ? formaterMontant(l.valeur) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="rien">Aucun lot n'expire dans les {{ delaiAlerte }} prochains jours.</p>
      <p class="conseil">Délai réglable dans Paramétrage &gt; Paramètres généraux &gt; « Alerte de péremption ».</p>
    </section>
    <!-- ===================== SORTIE DE TOUS LES LOTS PÉRIMÉS ===================== -->
    <FenetreModale v-if="sortie" titre="🗑️ Sortir tous les lots périmés" large @fermer="sortie = null">
      <p class="note">
        <strong>{{ lotsPerimes.length }} lot(s)</strong> périmé(s), soit
        <strong>{{ formaterNombre(quantitePerimee) }} unité(s)</strong> ({{ formaterMontant(valeurPerimee) }} au prix d'achat),
        vont sortir du stock : un mouvement « Sortie — périmés » par lot, tracé (motif, pièce, auteur, date).
      </p>
      <ul class="liste-sortie">
        <li v-for="l in lotsPerimes" :key="l.stockId">
          {{ l.medicament.designation }} — lot <strong>{{ l.numeroLot }}</strong> (périmé le {{ formaterDate(l.datePeremption) }}) :
          {{ formaterNombre(l.quantite) }}
        </li>
      </ul>
      <form id="form-sortie-perimes" class="grille-formulaire" @submit.prevent="confirmerSortie">
        <div>
          <label class="obligatoire">Motif</label>
          <input v-model.trim="sortie.motif" required maxlength="150" />
        </div>
        <div>
          <label>N° du PV / bordereau</label>
          <input v-model.trim="sortie.pieceRef" maxlength="50" placeholder="ex. PV-DESTR-2026-01" />
        </div>
      </form>
      <template #pied>
        <button class="bouton-secondaire" @click="sortie = null">✖ Annuler</button>
        <button type="submit" form="form-sortie-perimes" class="bouton-danger" :disabled="enregistrement">
          {{ enregistrement ? 'Sortie…' : `🗑️ Sortir les ${lotsPerimes.length} lot(s)` }}
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { sortirLotsPerimes } from '@/api/stock'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { etatMedicament, joursAvantPeremption } from './stockCommun'

const props = defineProps({
  etat: { type: Array, required: true },
  delaiAlerte: { type: Number, default: 90 },
  /** Sortie automatique des lots périmés activée (paramètre) */
  sortieAuto: { type: Boolean, default: false },
})
const emit = defineEmits(['modifie'])
const store = useStore()

/** Médicaments ACTIFS en rupture ou sous le seuil (ruptures d'abord). */
const alertesStock = computed(() =>
  props.etat
    .filter((m) => m.actif && etatMedicament(m).code !== 'NORMAL')
    .sort((a, b) => a.stock - b.stock || a.designation.localeCompare(b.designation)),
)

/** Tous les lots en stock avec leur délai avant péremption. */
const lots = computed(() =>
  props.etat.flatMap((m) =>
    m.lots
      .filter((l) => l.datePeremption)
      .map((l) => ({
        ...l,
        medicament: m,
        jours: joursAvantPeremption(l.datePeremption),
        valeur: m.prixAchat !== null ? l.quantite * m.prixAchat : null,
      })),
  ),
)
const lotsPerimes = computed(() => lots.value.filter((l) => l.jours < 0).sort((a, b) => a.jours - b.jours))
const lotsProches = computed(() =>
  lots.value.filter((l) => l.jours >= 0 && l.jours <= props.delaiAlerte).sort((a, b) => a.jours - b.jours),
)

// ---------------------------------------------------------------------------
// SORTIE DE TOUS LES LOTS PÉRIMÉS
// ---------------------------------------------------------------------------
const sortie = ref(null)
const enregistrement = ref(false)
const quantitePerimee = computed(() => lotsPerimes.value.reduce((t, l) => t + l.quantite, 0))
const valeurPerimee = computed(() => lotsPerimes.value.reduce((t, l) => t + (l.valeur ?? 0), 0))

function ouvrirSortie() {
  sortie.value = { motif: 'Destruction des lots périmés', pieceRef: '' }
}

async function confirmerSortie() {
  enregistrement.value = true
  try {
    const resultat = await sortirLotsPerimes({ motif: sortie.value.motif, pieceRef: sortie.value.pieceRef || undefined })
    store.dispatch('notifications/succes', `${resultat.lots} lot(s) périmé(s) sorti(s) du stock (${resultat.quantite} unité(s)).`)
    sortie.value = null
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

const COLONNES_STOCK = [
  { titre: 'Code', valeur: (m) => m.code },
  { titre: 'Médicament', valeur: (m) => m.designation },
  { titre: 'Famille', valeur: (m) => m.famille?.libelle },
  { titre: 'Stock', valeur: (m) => formaterNombre(m.stock), droite: true },
  { titre: 'Seuil', valeur: (m) => formaterNombre(m.seuilAlerte), droite: true },
  { titre: 'À commander', valeur: (m) => formaterNombre(Math.max((m.seuilAlerte || 0) - m.stock, 0)), droite: true },
  { titre: 'État', valeur: (m) => etatMedicament(m).libelle },
]
const COLONNES_LOTS = [
  { titre: 'Code', valeur: (l) => l.medicament.code },
  { titre: 'Médicament', valeur: (l) => l.medicament.designation },
  { titre: 'Lot', valeur: (l) => l.numeroLot },
  { titre: 'Péremption', valeur: (l) => formaterDate(l.datePeremption) },
  { titre: 'Jours', valeur: (l) => l.jours, droite: true },
  { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, somme: (l) => l.quantite },
  { titre: 'Valeur achat', valeur: (l) => (l.valeur !== null ? formaterMontant(l.valeur) : ''), droite: true, somme: (l) => l.valeur, formatTotal: formaterMontant },
]
</script>

<style scoped>
.alertes { display: flex; flex-direction: column; gap: 1.25rem; }
.carte-alerte { padding: 1rem 1.25rem; border: 1px solid var(--border); border-radius: 14px; }
.carte-alerte header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
.carte-alerte h3 { display: flex; align-items: center; gap: 0.6rem; margin: 0; font-size: 1rem; color: var(--texte-sur-fond); }
.pastille { min-width: 30px; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.85rem; text-align: center; }
.pastille.rouge { background: #fdecec; color: var(--danger); }
.pastille.orange { background: #fff1e0; color: #b35c00; }
.detail { font-size: 0.75rem; color: var(--muted); }
.rien { margin: 0; padding: 0.6rem 0; color: var(--primary-dark); font-size: 0.9rem; }
.conseil { margin: 0.6rem 0 0; font-size: 0.8rem; color: var(--muted); }
.actions-entete { display: flex; align-items: center; gap: 0.5rem; }
.note { margin: 0 0 0.75rem; font-size: 0.88rem; color: var(--muted); line-height: 1.5; }
.liste-sortie { max-height: 200px; overflow-y: auto; margin: 0 0 1rem; padding: 0.6rem 1rem 0.6rem 2rem; border-radius: 10px; background: #fdf6f6; font-size: 0.85rem; }
</style>
