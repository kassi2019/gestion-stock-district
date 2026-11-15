<!--
  =============================================================================
  ONGLET « ÉTAT DU STOCK »
  =============================================================================
  Stock disponible par MÉDICAMENT (une ligne), et par LOT (clic sur la ligne
  pour dérouler : n° de lot, péremption, quantité). Valorisation au prix
  d'achat et au prix de vente actuels, état (rupture / sous le seuil /
  normal). Bouton « Fiche » : fiche de stock du médicament (et PDF).
  Filtres : recherche, famille, état, inactifs. Totaux, tri, pagination, PDF.

  Propriétés : etat (stock de tous les médicaments), delaiAlerte (jours)
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (code, désignation, lot)…" />
      <div class="filtre">
        <ListeDeroulante v-model="familleFiltre" :options="familles" placeholder="Toutes les familles" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="etatFiltre" :options="OPTIONS_ETAT" placeholder="Tous les états" />
      </div>
      <label class="case-a-cocher"><input v-model="afficherInactifs" type="checkbox" /> Inactifs</label>
      <label class="case-a-cocher"><input v-model="enStockSeulement" type="checkbox" /> En stock seulement</label>
      <span class="espace"></span>
      <button class="bouton-secondaire" type="button" @click="toutDeplier(!toutOuvert)">{{ toutOuvert ? 'Tout replier' : 'Tout déplier' }}</button>
      <ImportExportTableau
        titre="État du stock du dépôt"
        :sous-titre="sousTitrePdf"
        nom-fichier="etat_stock"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
    </div>

    <!-- Totaux de la sélection -->
    <div class="totaux">
      <div class="total-case"><span>Médicaments</span><strong>{{ medicamentsAffiches.length }}</strong></div>
      <div class="total-case rouge"><span>En rupture</span><strong>{{ compte('RUPTURE') }}</strong></div>
      <div class="total-case orange"><span>Sous le seuil</span><strong>{{ compte('SOUS_SEUIL') }}</strong></div>
      <div class="total-case principal"><span>Valeur au prix d'achat</span><strong>{{ formaterMontant(valeurAchat) }}</strong></div>
      <div class="total-case"><span>Valeur indicative au prix de vente</span><strong>{{ formaterMontant(valeurVente) }}</strong></div>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <th class="col-fleche"></th>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="designation">Désignation</ColonneTri>
            <ColonneTri v-model="tri" cle="famille">Famille</ColonneTri>
            <ColonneTri v-model="tri" cle="stock" class="nombre">Stock</ColonneTri>
            <ColonneTri v-model="tri" cle="seuil" class="nombre">Seuil</ColonneTri>
            <ColonneTri v-model="tri" cle="lots" class="nombre">Lots</ColonneTri>
            <ColonneTri v-model="tri" cle="valeurAchat" class="nombre">Valeur (achat)</ColonneTri>
            <ColonneTri v-model="tri" cle="etat">État</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="m in lignesPage" :key="m.id">
            <tr class="ligne-med" :class="{ ouverte: ouverts.has(m.id), 'ligne-inactive': !m.actif }" @click="basculer(m.id)">
              <td class="col-fleche"><span v-if="m.lots.length" class="fleche">{{ ouverts.has(m.id) ? '▾' : '▸' }}</span></td>
              <td class="code">{{ m.code }}</td>
              <td>
                <strong>{{ m.designation }}</strong>
                <div class="detail">{{ [m.forme?.libelle, m.dosage].filter(Boolean).join(' · ') }}</div>
              </td>
              <td>{{ m.famille?.libelle || '—' }}</td>
              <td class="nombre">
                <strong class="quantite" :class="etatMedicament(m).code.toLowerCase()">{{ formaterNombre(m.stock) }}</strong>
                <div v-if="m.uniteVente" class="detail">{{ m.uniteVente.libelle.toLowerCase() }}</div>
              </td>
              <!-- Seuil d'alerte : modifiable directement (crayon ; Entrée = enregistrer, Échap = annuler) -->
              <td class="nombre col-seuil" @click.stop>
                <template v-if="seuilEnCours?.id === m.id">
                  <input
                    v-model.number="seuilEnCours.valeur"
                    v-focus
                    type="number"
                    min="0"
                    step="1"
                    class="saisie-seuil"
                    @keyup.enter="enregistrerSeuil"
                    @keyup.esc="seuilEnCours = null"
                  />
                  <button class="bouton-lien" title="Enregistrer" @click="enregistrerSeuil">✓</button>
                  <button class="bouton-lien" title="Annuler" @click="seuilEnCours = null">✕</button>
                </template>
                <template v-else>
                  {{ m.seuilAlerte ? formaterNombre(m.seuilAlerte) : '—' }}
                  <button v-si-modif class="bouton-lien crayon" title="Modifier le seuil d'alerte" @click="seuilEnCours = { id: m.id, valeur: m.seuilAlerte || 0 }">✎</button>
                </template>
              </td>
              <td class="nombre">
                {{ m.lots.filter((l) => l.lotId).length || '—' }}
                <span v-if="alerteLots(m)" class="point-alerte" :title="alerteLots(m)">●</span>
              </td>
              <td class="nombre">{{ m.valeurAchat !== null ? formaterMontant(m.valeurAchat) : '—' }}</td>
              <td><span class="badge" :class="etatMedicament(m).badge">{{ etatMedicament(m).libelle }}</span></td>
              <td class="actions" @click.stop>
                <button class="bouton-lien" @click="ficheDe = m">Fiche</button>
              </td>
            </tr>
            <!-- Détail par lot -->
            <tr v-if="ouverts.has(m.id)" class="ligne-detail">
              <td></td>
              <td colspan="9">
                <table class="tableau sous-tableau">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Péremption</th>
                      <th>Délai</th>
                      <th class="nombre">Quantité</th>
                      <th class="nombre">Valeur (achat)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="l in m.lots" :key="l.stockId">
                      <td>{{ l.numeroLot || 'Sans lot' }}</td>
                      <td>{{ l.datePeremption ? formaterDate(l.datePeremption) : '—' }}</td>
                      <td>
                        <span v-if="etatPeremption(l.datePeremption, delaiAlerte)" class="badge" :class="etatPeremption(l.datePeremption, delaiAlerte).badge">
                          {{ etatPeremption(l.datePeremption, delaiAlerte).libelle }}
                        </span>
                        <span v-else class="detail">—</span>
                      </td>
                      <td class="nombre"><strong>{{ formaterNombre(l.quantite) }}</strong></td>
                      <td class="nombre">{{ m.prixAchat !== null ? formaterMontant(l.quantite * m.prixAchat) : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="medicamentsAffiches.length" />
      <p v-if="medicamentsAffiches.length === 0" class="tableau-vide">Aucun médicament pour ces critères.</p>
    </div>

    <FicheStock v-if="ficheDe" :medicament-id="ficheDe.id" @fermer="ficheDe = null" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { modifierSeuil } from '@/api/stock'
import FicheStock from './FicheStock.vue'
import { etatMedicament, etatPeremption } from './stockCommun'

const props = defineProps({
  etat: { type: Array, required: true },
  delaiAlerte: { type: Number, default: 90 },
})
const emit = defineEmits(['modifie'])
const store = useStore()

// ---------------------------------------------------------------------------
// SEUIL D'ALERTE (stock minimum au dépôt) : modification directe dans le tableau
// ---------------------------------------------------------------------------
const seuilEnCours = ref(null) // { id, valeur } du médicament en cours de modification
/** Place le curseur dans la case du seuil dès qu'elle apparaît. */
const vFocus = { mounted: (el) => el.select() }

async function enregistrerSeuil() {
  const { id, valeur } = seuilEnCours.value
  const seuil = Number(valeur)
  if (!Number.isInteger(seuil) || seuil < 0) return store.dispatch('notifications/erreur', "Le seuil doit être un nombre entier positif (0 = pas d'alerte).")
  try {
    const med = await modifierSeuil(id, seuil)
    seuilEnCours.value = null
    store.dispatch('notifications/succes', `Seuil d'alerte de « ${med.designation} » : ${formaterNombre(med.seuilAlerte)}.`)
    emit('modifie') // recharge l'état (statut « sous le seuil », alertes)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

const OPTIONS_ETAT = [
  { id: 'RUPTURE', libelle: 'En rupture' },
  { id: 'SOUS_SEUIL', libelle: 'Sous le seuil' },
  { id: 'NORMAL', libelle: 'Normal' },
]

const recherche = ref('')
const familleFiltre = ref(null)
const etatFiltre = ref(null)
const afficherInactifs = ref(false)
const enStockSeulement = ref(false)
const ficheDe = ref(null)

const familles = computed(() => store.state.referentiel.familles)

const medicamentsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return props.etat.filter((m) => {
    if (!afficherInactifs.value && !m.actif) return false
    if (enStockSeulement.value && m.stock <= 0) return false
    if (familleFiltre.value && m.familleId !== familleFiltre.value) return false
    if (etatFiltre.value && etatMedicament(m).code !== etatFiltre.value) return false
    if (!texte) return true
    return [m.code, m.designation, ...m.lots.map((l) => l.numeroLot)].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

function compte(code) {
  return medicamentsAffiches.value.filter((m) => etatMedicament(m).code === code).length
}
const valeurAchat = computed(() => medicamentsAffiches.value.reduce((t, m) => t + (m.valeurAchat ?? 0), 0))
const valeurVente = computed(() => medicamentsAffiches.value.reduce((t, m) => t + (m.valeurVente ?? 0), 0))

/** Texte d'alerte si un lot est périmé ou proche de la péremption. */
function alerteLots(m) {
  const etats = m.lots.map((l) => etatPeremption(l.datePeremption, props.delaiAlerte)).filter(Boolean)
  if (etats.some((e) => e.code === 'PERIME')) return 'Un lot est périmé'
  if (etats.some((e) => e.code === 'PROCHE')) return 'Un lot expire bientôt'
  return ''
}

// Lignes déroulées
const ouverts = ref(new Set())
function basculer(id) {
  const copie = new Set(ouverts.value)
  copie.has(id) ? copie.delete(id) : copie.add(id)
  ouverts.value = copie
}
const toutOuvert = computed(() => medicamentsAffiches.value.some((m) => m.lots.length) && medicamentsAffiches.value.every((m) => !m.lots.length || ouverts.value.has(m.id)))
function toutDeplier(ouvrir) {
  ouverts.value = ouvrir ? new Set(medicamentsAffiches.value.map((m) => m.id)) : new Set()
}

const VALEURS_TRI = {
  code: (m) => m.code,
  designation: (m) => m.designation,
  famille: (m) => m.famille?.libelle,
  stock: (m) => m.stock,
  seuil: (m) => m.seuilAlerte,
  lots: (m) => m.lots.length,
  valeurAchat: (m) => m.valeurAchat,
  etat: (m) => ({ RUPTURE: 0, SOUS_SEUIL: 1, NORMAL: 2 })[etatMedicament(m).code],
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(
  medicamentsAffiches,
  [recherche, familleFiltre, etatFiltre, afficherInactifs, enStockSeulement],
  VALEURS_TRI,
)

const sousTitrePdf = computed(() => {
  const f = familles.value.find((x) => x.id === familleFiltre.value)
  return [
    f ? `Famille : ${f.libelle}` : 'Toutes les familles',
    etatFiltre.value ? OPTIONS_ETAT.find((e) => e.id === etatFiltre.value).libelle : 'tous les états',
    `au ${new Date().toLocaleDateString('fr-FR')}`,
  ].join(' — ')
})

const COLONNES_PDF = [
  { titre: 'Code', valeur: (m) => m.code },
  { titre: 'Désignation', valeur: (m) => m.designation },
  { titre: 'Famille', valeur: (m) => m.famille?.libelle },
  { titre: 'Lots (péremption)', valeur: (m) => m.lots.filter((l) => l.numeroLot).map((l) => `${l.numeroLot} (${l.datePeremption ? formaterDate(l.datePeremption) : '?'}) : ${l.quantite}`).join(' ; ') },
  { titre: 'Stock', valeur: (m) => formaterNombre(m.stock), droite: true, somme: (m) => m.stock },
  { titre: 'Seuil', valeur: (m) => formaterNombre(m.seuilAlerte), droite: true },
  { titre: 'Valeur achat', valeur: (m) => (m.valeurAchat !== null ? formaterMontant(m.valeurAchat) : ''), droite: true, somme: (m) => m.valeurAchat, formatTotal: formaterMontant },
  { titre: 'Valeur vente', valeur: (m) => (m.valeurVente !== null ? formaterMontant(m.valeurVente) : ''), droite: true, somme: (m) => m.valeurVente, formatTotal: formaterMontant },
  { titre: 'État', valeur: (m) => etatMedicament(m).libelle },
]

onMounted(() => store.dispatch('referentiel/charger', { liste: 'familles' }).catch(() => {}))
</script>

<style scoped>
.col-seuil { white-space: nowrap; }
.col-seuil .crayon { margin-left: 0.25rem; opacity: 0.45; }
.col-seuil:hover .crayon { opacity: 1; }
.saisie-seuil { width: 80px; padding: 0.2rem 0.4rem; text-align: right; }
.detail { font-size: 0.75rem; color: var(--muted); }
.totaux { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
.total-case { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.7rem 0.9rem; border-radius: 12px; background: var(--fond-pale); font-size: 0.78rem; color: var(--muted); }
.total-case strong { font-size: 1.2rem; color: var(--texte-sur-fond); }
.total-case.rouge strong { color: var(--danger); }
.total-case.orange strong { color: #b35c00; }
.total-case.principal { background: linear-gradient(120deg, var(--primary), var(--primary-dark)); color: rgba(255, 255, 255, 0.85); }
.total-case.principal strong { color: #fff; }
@media (max-width: 1000px) { .totaux { grid-template-columns: repeat(2, 1fr); } }

.col-fleche { width: 26px; padding-right: 0 !important; }
.fleche { color: var(--primary); }
.ligne-med { cursor: pointer; }
.ligne-med:hover td { background: var(--primary-light); }
.ligne-med.ouverte td { background: #f0faf5; border-bottom-color: transparent; }
.ligne-detail > td { padding-top: 0 !important; background: #f0faf5; }
.sous-tableau { margin: 0.2rem 0 0.6rem; background: #fff; border-radius: 10px; overflow: hidden; }
.sous-tableau th { background: #e3f5ec; font-size: 0.72rem; }
.sous-tableau td, .sous-tableau th { padding: 0.45rem 0.65rem; }

.quantite.rupture { color: var(--danger); }
.quantite.sous_seuil { color: #b35c00; }
.point-alerte { color: #e67e22; margin-left: 0.25rem; }
</style>
