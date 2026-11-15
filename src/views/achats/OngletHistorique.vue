<!--
  =============================================================================
  ONGLET « HISTORIQUE DES ACHATS »
  =============================================================================
  Toutes les lignes des réceptions VALIDÉES (ce qui est réellement entré en
  stock), avec filtres par FOURNISSEUR, MÉDICAMENT et PÉRIODE
  (cahier des charges §3.2). Totaux (quantités, montant), tri, pagination
  et PDF.
  ➜ Les lignes sont REGROUPÉES PAR RÉCEPTION : une ligne par bon de réception ;
    un clic sur la ligne DÉROULE le détail des médicaments reçus.
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <div class="filtre">
        <ListeDeroulante v-model="filtres.fournisseurId" :options="fournisseurs" champ-libelle="raisonSociale" placeholder="Tous les fournisseurs" />
      </div>
      <div class="filtre large">
        <ListeDeroulante
          v-model="filtres.medicamentId"
          :options="medicaments"
          :champ-libelle="(m) => `${m.code} — ${m.designation}`"
          placeholder="Tous les médicaments"
        />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <button class="bouton-secondaire" type="button" @click="toutDeplier(!toutOuvert)">
        {{ toutOuvert ? 'Tout replier' : 'Tout déplier' }}
      </button>
      <ImportExportTableau
        titre="Historique des achats"
        :sous-titre="sousTitrePdf"
        nom-fichier="historique_achats"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
    </div>

    <!-- Totaux de la sélection -->
    <div class="totaux">
      <div class="total-case">
        <span>Réceptions</span><strong>{{ nombreReceptions }}</strong>
      </div>
      <div class="total-case">
        <span>Lignes d'achat</span><strong>{{ lignes.length }}</strong>
      </div>
      <div class="total-case principal">
        <span>Montant total des achats</span><strong>{{ formaterMontant(montantTotal) }}</strong>
      </div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau tableau-groupe">
        <thead>
          <tr>
            <th class="col-fleche"></th>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="reception">Réception</ColonneTri>
            <ColonneTri v-model="tri" cle="fournisseur">Fournisseur</ColonneTri>
            <ColonneTri v-model="tri" cle="commande">Commande</ColonneTri>
            <ColonneTri v-model="tri" cle="facture">Facture fourn.</ColonneTri>
            <ColonneTri v-model="tri" cle="lignes" class="nombre">Médicaments</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in lignesPage" :key="g.id">
            <!-- Ligne de la RÉCEPTION : un clic déroule / replie le détail -->
            <tr class="ligne-reception" :class="{ ouverte: ouverts.has(g.id) }" @click="basculer(g.id)">
              <td class="col-fleche"><span class="fleche">{{ ouverts.has(g.id) ? '▾' : '▸' }}</span></td>
              <td>{{ formaterDate(g.reception.dateReception) }}</td>
              <td class="code">{{ g.reception.numero }}</td>
              <td><strong>{{ g.reception.fournisseur.raisonSociale }}</strong></td>
              <td><span v-if="g.reception.commande" class="code">{{ g.reception.commande.numero }}</span><span v-else class="detail">Directe</span></td>
              <td>{{ g.reception.numFactureFourn || '—' }}</td>
              <td class="nombre"><span class="badge badge-vert">{{ g.lignes.length }}</span></td>
              <td class="nombre"><strong>{{ formaterMontant(g.montant) }}</strong></td>
            </tr>

            <!-- DÉTAIL des médicaments reçus (déroulé) -->
            <tr v-if="ouverts.has(g.id)" class="ligne-detail">
              <td></td>
              <td colspan="7">
                <table class="tableau sous-tableau">
                  <thead>
                    <tr>
                      <th>Médicament</th>
                      <th>Lot</th>
                      <th>Péremption</th>
                      <th class="nombre">Quantité</th>
                      <th class="nombre">Prix unitaire</th>
                      <th class="nombre">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="l in g.lignes" :key="l.id">
                      <td>
                        <strong>{{ l.medicament.designation }}</strong>
                        <span class="detail"> · {{ l.medicament.code }}</span>
                      </td>
                      <td>{{ l.numeroLot || '—' }}</td>
                      <td>{{ l.datePeremption ? formaterDate(l.datePeremption) : '—' }}</td>
                      <td class="nombre">
                        {{ formaterNombre(l.quantite) }}
                        <span v-if="l.medicament.uniteVente" class="detail"> {{ l.medicament.uniteVente.libelle.toLowerCase() }}</span>
                      </td>
                      <td class="nombre">{{ formaterMontant(l.prixUnitaire) }}</td>
                      <td class="nombre"><strong>{{ formaterMontant(l.montant) }}</strong></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="5" class="nombre">Total de la réception</td>
                      <td class="nombre"><strong>{{ formaterMontant(g.montant) }}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="groupes.length" />
      <p v-if="!chargement && lignes.length === 0" class="tableau-vide">Aucun achat pour ces critères.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { historiqueAchats } from '@/api/achats'

const store = useStore()

const lignes = ref([])
const chargement = ref(false)
const filtres = reactive({ fournisseurId: null, medicamentId: null, du: '', au: '' })

const fournisseurs = computed(() => store.state.referentiel.fournisseurs)
const medicaments = computed(() => store.state.referentiel.medicaments)

const montantTotal = computed(() => lignes.value.reduce((t, l) => t + Number(l.montant), 0))
const nombreReceptions = computed(() => new Set(lignes.value.map((l) => l.reception.id)).size)

async function charger() {
  chargement.value = true
  try {
    lignes.value = await historiqueAchats(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// REGROUPEMENT PAR RÉCEPTION (une ligne par bon, détail déroulant)
// ---------------------------------------------------------------------------

/** Groupes : { id, reception, lignes: [...], montant } — dans l'ordre reçu (plus récentes d'abord). */
const groupes = computed(() => {
  const parReception = new Map()
  for (const ligne of lignes.value) {
    const id = ligne.reception.id
    if (!parReception.has(id)) parReception.set(id, { id, reception: ligne.reception, lignes: [], montant: 0 })
    const groupe = parReception.get(id)
    groupe.lignes.push(ligne)
    groupe.montant += Number(ligne.montant)
  }
  return [...parReception.values()]
})

/** Réceptions déroulées (identifiants). */
const ouverts = ref(new Set())
function basculer(id) {
  const copie = new Set(ouverts.value)
  if (copie.has(id)) copie.delete(id)
  else copie.add(id)
  ouverts.value = copie
}
const toutOuvert = computed(() => groupes.value.length > 0 && groupes.value.every((g) => ouverts.value.has(g.id)))
function toutDeplier(ouvrir) {
  ouverts.value = ouvrir ? new Set(groupes.value.map((g) => g.id)) : new Set()
}

/** Tri des réceptions (clic sur les en-têtes). */
const VALEURS_TRI = {
  date: (g) => g.reception.dateReception,
  reception: (g) => g.reception.numero,
  fournisseur: (g) => g.reception.fournisseur.raisonSociale,
  commande: (g) => g.reception.commande?.numero,
  facture: (g) => g.reception.numFactureFourn,
  lignes: (g) => g.lignes.length,
  montant: (g) => g.montant,
}
const { tri, lignesTriees: groupesTries, page, taille, lignesPage } = utiliserTableau(groupes, [], VALEURS_TRI)

/** PDF : toutes les lignes de médicaments, réception par réception (dans l'ordre du tri). */
const lignesTriees = computed(() => groupesTries.value.flatMap((g) => g.lignes))

const sousTitrePdf = computed(() => {
  const f = fournisseurs.value.find((x) => x.id === filtres.fournisseurId)
  const m = medicaments.value.find((x) => x.id === filtres.medicamentId)
  return [
    f ? `Fournisseur : ${f.raisonSociale}` : 'Tous les fournisseurs',
    m ? `Médicament : ${m.designation}` : 'tous les médicaments',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : 'toutes périodes',
  ].join(' — ')
})

const COLONNES_PDF = [
  { titre: 'Date', valeur: (l) => formaterDate(l.reception.dateReception) },
  { titre: 'Réception', valeur: (l) => l.reception.numero },
  { titre: 'Fournisseur', valeur: (l) => l.reception.fournisseur.raisonSociale },
  { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` },
  { titre: 'Lot', valeur: (l) => l.numeroLot },
  { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, somme: (l) => l.quantite },
  { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true },
  { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, somme: (l) => l.montant, formatTotal: formaterMontant },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'fournisseurs' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})

defineExpose({ charger })
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.filtre.large { min-width: 300px; }

/* Lignes de réception cliquables + détail déroulé */
.col-fleche { width: 28px; padding-right: 0 !important; }
.fleche { color: var(--primary); font-size: 0.95rem; }
.ligne-reception { cursor: pointer; }
.ligne-reception:hover td { background: var(--primary-light); }
.ligne-reception.ouverte td { background: #f0faf5; border-bottom-color: transparent; }
.ligne-detail > td { padding-top: 0 !important; background: #f0faf5; }
.sous-tableau { margin: 0.2rem 0 0.6rem; background: #fff; border-radius: 10px; overflow: hidden; }
.sous-tableau th { background: #e3f5ec; font-size: 0.72rem; }
.sous-tableau td, .sous-tableau th { padding: 0.45rem 0.65rem; }
.sous-tableau tfoot td { border-bottom: none; color: var(--primary-dark); font-weight: 600; }
.detail { font-size: 0.75rem; color: var(--muted); }
.totaux { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
.total-case {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: var(--fond-pale);
  font-size: 0.8rem;
  color: var(--muted);
}
.total-case strong { font-size: 1.3rem; color: var(--texte-sur-fond); }
.total-case.principal { background: linear-gradient(120deg, var(--primary), var(--primary-dark)); color: rgba(255, 255, 255, 0.85); }
.total-case.principal strong { color: #fff; }
@media (max-width: 700px) {
  .totaux { grid-template-columns: 1fr; }
}
</style>
