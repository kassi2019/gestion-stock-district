<!--
  =============================================================================
  ONGLET « COMPTES DES CENTRES »
  =============================================================================
  Situation financière de chaque centre (cahier des charges §3.6) :
  total facturé, total payé, SOLDE RESTANT DÛ, avances disponibles, factures
  en retard. Clic sur un centre : RELEVÉ DE COMPTE d'une période (factures au
  débit, paiements au crédit, solde progressif), imprimable en PDF.
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher un centre…" />
      <label class="case-a-cocher"><input v-model="avecSoldeSeulement" type="checkbox" /> Centres avec un solde dû</label>
      <span class="espace"></span>
      <ImportExportTableau titre="Situation financière des centres" :sous-titre="`Au ${formaterDate(dateDuJour())}`" nom-fichier="situation_centres" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
    </div>

    <div class="totaux">
      <div class="total-case"><span>Total facturé</span><strong>{{ formaterMontant(totaux.facture) }}</strong></div>
      <div class="total-case"><span>Total payé</span><strong>{{ formaterMontant(totaux.paye) }}</strong></div>
      <div class="total-case rouge"><span>Solde restant dû</span><strong>{{ formaterMontant(totaux.solde) }}</strong></div>
      <div class="total-case orange"><span>Dont en retard</span><strong>{{ formaterMontant(totaux.retard) }}</strong></div>
      <div class="total-case"><span>Avances disponibles</span><strong>{{ formaterMontant(totaux.avances) }}</strong></div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="facture" class="nombre">Facturé</ColonneTri>
            <ColonneTri v-model="tri" cle="paye" class="nombre">Payé</ColonneTri>
            <ColonneTri v-model="tri" cle="solde" class="nombre">Solde dû</ColonneTri>
            <ColonneTri v-model="tri" cle="retard" class="nombre">En retard</ColonneTri>
            <ColonneTri v-model="tri" cle="avances" class="nombre">Avances</ColonneTri>
            <ColonneTri v-model="tri" cle="dernier">Dernier paiement</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in lignesPage" :key="s.centre.id">
            <td>
              <strong>{{ s.centre.nom }}</strong>
              <small v-if="s.facturesNonSoldees" class="detail">{{ s.facturesNonSoldees }} facture(s) non soldée(s)</small>
            </td>
            <td class="nombre">{{ formaterMontant(s.totalFacture) }}</td>
            <td class="nombre">{{ formaterMontant(s.totalPaye) }}</td>
            <td class="nombre"><strong :class="{ rouge: s.soldeDu > 0 }">{{ formaterMontant(s.soldeDu) }}</strong></td>
            <td class="nombre"><span v-if="s.facturesEnRetard" class="retard">{{ formaterMontant(s.montantEnRetard) }}</span><span v-else>—</span></td>
            <td class="nombre"><span v-if="s.avances > 0" class="avance">{{ formaterMontant(s.avances) }}</span><span v-else>—</span></td>
            <td>{{ s.dernierPaiement ? formaterDate(s.dernierPaiement) : '—' }}</td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrirReleve(s.centre)">Relevé de compte</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="situationsAffichees.length" />
      <p v-if="!chargement && situationsAffichees.length === 0" class="tableau-vide">Aucun centre.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== RELEVÉ DE COMPTE ===================== -->
    <FenetreModale v-if="releve" :titre="`Relevé de compte — ${releve.centre.nom}`" tres-large @fermer="releve = null">
      <div class="barre-outils">
        <div class="periode">
          <span>Du</span>
          <ChampDate v-model="periode.du" @change="chargerReleve" />
          <span>au</span>
          <ChampDate v-model="periode.au" :max="dateDuJour()" @change="chargerReleve" />
        </div>
        <span class="espace"></span>
        <ImportExportTableau
          :titre="`Relevé de compte — ${releve.centre.nom}`"
          :sous-titre="`Du ${formaterDate(periode.du)} au ${formaterDate(periode.au)}`"
          :nom-fichier="`releve_${releve.centre.code || releve.centre.id}`"
          :colonnes-pdf="COLONNES_RELEVE"
          :lignes="lignesReleve"
        />
        <button v-si-imprimer class="bouton-secondaire" @click="relevePdf(releve)">Relevé (PDF)</button>
      </div>

      <div v-if="releve.situation" class="totaux">
        <div class="total-case"><span>Facturé (total)</span><strong>{{ formaterMontant(releve.situation.totalFacture) }}</strong></div>
        <div class="total-case"><span>Payé (total)</span><strong>{{ formaterMontant(releve.situation.totalPaye) }}</strong></div>
        <div class="total-case rouge"><span>Solde restant dû</span><strong>{{ formaterMontant(releve.situation.soldeDu) }}</strong></div>
        <div class="total-case orange"><span>En retard</span><strong>{{ formaterMontant(releve.situation.montantEnRetard) }}</strong></div>
        <div class="total-case"><span>Avances disponibles</span><strong>{{ formaterMontant(releve.situation.avances) }}</strong></div>
      </div>

      <table class="tableau lignes">
        <thead>
          <tr><th>Date</th><th>N° pièce</th><th>Libellé</th><th class="nombre">Débit</th><th class="nombre">Crédit</th><th class="nombre">Solde</th></tr>
        </thead>
        <tbody>
          <tr class="solde-initial">
            <td colspan="5"><em>Solde au début de la période</em></td>
            <td class="nombre"><strong>{{ formaterMontant(releve.soldeInitial) }}</strong></td>
          </tr>
          <tr v-for="(l, i) in releve.lignes" :key="i">
            <td>{{ formaterDate(l.date) }}</td>
            <td class="code">{{ l.numero }}</td>
            <td>{{ l.libelle }}</td>
            <td class="nombre">{{ l.debit ? formaterMontant(l.debit) : '' }}</td>
            <td class="nombre credit">{{ l.credit ? formaterMontant(l.credit) : '' }}</td>
            <td class="nombre"><strong :class="{ rouge: l.solde > 0 }">{{ formaterMontant(l.solde) }}</strong></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="nombre"><strong>TOTAUX DE LA PÉRIODE</strong></td>
            <td class="nombre"><strong>{{ formaterMontant(releve.totalDebit) }}</strong></td>
            <td class="nombre"><strong>{{ formaterMontant(releve.totalCredit) }}</strong></td>
            <td class="nombre"><strong :class="{ rouge: releve.soldeFinal > 0 }">{{ formaterMontant(releve.soldeFinal) }}</strong></td>
          </tr>
        </tfoot>
      </table>
      <p v-if="releve.lignes.length === 0" class="tableau-vide">Aucune opération sur la période.</p>
      <p class="aide">Débit : factures émises. Crédit : paiements et avances reçus. Solde positif : montant dû par le centre ; négatif : avance en sa faveur.</p>

      <template #pied>
        <button class="bouton-secondaire" @click="releve = null">Fermer</button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import { releveCompte, situationCentres } from '@/api/facturation'
import { relevePdf } from '@/views/facturation/financesCommun'

const store = useStore()
const situations = ref([])
const chargement = ref(false)
const recherche = ref('')
const avecSoldeSeulement = ref(false)
const releve = ref(null)
const centreReleve = ref(null)
// Période du relevé : par défaut depuis le 1er janvier de l'année
const periode = reactive({ du: `${new Date().getFullYear()}-01-01`, au: dateDuJour() })

const situationsAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  return situations.value.filter((s) => (!avecSoldeSeulement.value || s.soldeDu > 0) && (!texte || s.centre.nom.toLowerCase().includes(texte)))
})
const totaux = computed(() => {
  const l = situationsAffichees.value
  const somme = (cle) => l.reduce((t, s) => t + s[cle], 0)
  return { facture: somme('totalFacture'), paye: somme('totalPaye'), solde: somme('soldeDu'), retard: somme('montantEnRetard'), avances: somme('avances') }
})

async function charger() {
  chargement.value = true
  try {
    situations.value = await situationCentres()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

async function ouvrirReleve(centre) {
  centreReleve.value = centre
  await chargerReleve()
}
async function chargerReleve() {
  try {
    releve.value = await releveCompte(centreReleve.value.id, periode.du, periode.au)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

const VALEURS_TRI = {
  centre: (s) => s.centre.nom,
  facture: (s) => s.totalFacture,
  paye: (s) => s.totalPaye,
  solde: (s) => s.soldeDu,
  retard: (s) => s.montantEnRetard,
  avances: (s) => s.avances,
  dernier: (s) => s.dernierPaiement,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(situationsAffichees, [recherche, avecSoldeSeulement], VALEURS_TRI)

// Export PDF / Excel du relevé : solde de début, opérations, puis totaux
const lignesReleve = computed(() => {
  const r = releve.value
  if (!r) return []
  return [
    { libelle: 'Solde au début de la période', solde: r.soldeInitial, special: true },
    ...r.lignes,
    { libelle: 'TOTAUX DE LA PÉRIODE', debit: r.totalDebit, credit: r.totalCredit, solde: r.soldeFinal, special: true },
  ]
})
const COLONNES_RELEVE = [
  { titre: 'Date', valeur: (l) => (l.special ? '' : formaterDate(l.date)) },
  { titre: 'N° pièce', valeur: (l) => l.numero || '' },
  { titre: 'Libellé', valeur: (l) => l.libelle },
  { titre: 'Débit', valeur: (l) => (l.debit ? formaterMontant(l.debit) : ''), droite: true },
  { titre: 'Crédit', valeur: (l) => (l.credit ? formaterMontant(l.credit) : ''), droite: true },
  { titre: 'Solde', valeur: (l) => formaterMontant(l.solde), droite: true },
]

const COLONNES_PDF = [
  { titre: 'Centre', valeur: (s) => s.centre.nom },
  { titre: 'Facturé', valeur: (s) => formaterMontant(s.totalFacture), droite: true, somme: (s) => s.totalFacture, formatTotal: formaterMontant },
  { titre: 'Payé', valeur: (s) => formaterMontant(s.totalPaye), droite: true, somme: (s) => s.totalPaye, formatTotal: formaterMontant },
  { titre: 'Solde dû', valeur: (s) => formaterMontant(s.soldeDu), droite: true, somme: (s) => s.soldeDu, formatTotal: formaterMontant },
  { titre: 'En retard', valeur: (s) => formaterMontant(s.montantEnRetard), droite: true, somme: (s) => s.montantEnRetard, formatTotal: formaterMontant },
  { titre: 'Avances', valeur: (s) => formaterMontant(s.avances), droite: true, somme: (s) => s.avances, formatTotal: formaterMontant },
]

onMounted(charger)
defineExpose({ charger })
</script>

<style scoped>
.case-a-cocher { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; white-space: nowrap; }
.periode { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.totaux { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin: 0.5rem 0 1rem; }
.total-case { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1rem; border-radius: 12px; background: var(--primary-light); }
.total-case span { font-size: 0.8rem; color: var(--muted); }
.total-case strong { font-size: 1.05rem; color: var(--primary-dark); }
.total-case.rouge { background: #fdecec; }
.total-case.rouge strong { color: var(--danger); }
.total-case.orange { background: #fff4e5; }
.total-case.orange strong { color: #b35c00; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.rouge { color: var(--danger); }
.retard { color: var(--danger); font-weight: 600; }
.avance { color: #b35c00; font-weight: 600; }
.credit { color: var(--primary-dark); }
.solde-initial td { background: #f7faf8; }
.lignes tfoot td { border-top: 2px solid var(--border); padding-top: 0.6rem; }
.aide { margin-top: 0.75rem; font-size: 0.8rem; color: var(--muted); }
@media (max-width: 1000px) { .totaux { grid-template-columns: 1fr 1fr; } }
</style>
