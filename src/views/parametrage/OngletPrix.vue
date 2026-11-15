<!--
  =============================================================================
  ONGLET « PRIX » (prix de vente et prix d'achat, avec historique)
  =============================================================================
  DEUX VUES :

  A. VUE D'ENSEMBLE (affichée en premier) : tous les médicaments avec leur
     prix de vente, prix d'achat et marge actuels. Filtres : recherche,
     famille, état des prix (manquants / complets), inactifs. Pagination + PDF.
     Bouton « Historique / modifier » sur chaque ligne -> vue B.

  B. DÉTAIL D'UN MÉDICAMENT (bouton « ← Retour à la liste » pour revenir) :
  1. On choisit un médicament ;
  2. Deux colonnes :
       - PRIX DE VENTE (appliqué aux centres) : prix actuel + historique
         + formulaire "nouveau prix" ;
       - PRIX D'ACHAT (payé au fournisseur) : idem.

  Règle (cahier des charges §5) : un prix n'est jamais modifié. Pour changer
  un tarif, on enregistre un NOUVEAU prix avec une date d'effet ; l'ancien
  prix est clôturé automatiquement la veille. Les anciennes factures gardent
  donc leur prix.
  =============================================================================
-->
<template>
  <div>
    <!-- ===================== A. VUE D'ENSEMBLE ===================== -->
    <template v-if="!medicamentId">
      <div class="barre-outils">
        <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (code, désignation)…" />
        <div class="filtre">
          <ListeDeroulante v-model="familleFiltre" :options="familles" placeholder="Toutes les familles" />
        </div>
        <div class="filtre">
          <ListeDeroulante v-model="etatPrixFiltre" :options="ETATS_PRIX" placeholder="Tous les prix" />
        </div>
        <label class="case-a-cocher">
          <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
        </label>
        <span class="espace"></span>
        <!-- Bouton « PDF » (pas d'import ici : utiliser l'import de l'onglet Médicaments) -->
        <ImportExportTableau
          titre="Prix des médicaments"
          :sous-titre="sousTitrePdf"
          nom-fichier="prix_medicaments"
          :colonnes-pdf="COLONNES_PDF_LISTE"
          :lignes="lignesTriees"
        />
      </div>

      <!-- Petits compteurs (sur les lignes filtrées) -->
      <div class="compteurs">
        <span class="compteur">{{ medicamentsAffiches.length }} médicament(s)</span>
        <span class="compteur rouge" :class="{ zero: compteurs.sansVente === 0 }">
          {{ compteurs.sansVente }} sans prix de vente
        </span>
        <span class="compteur orange" :class="{ zero: compteurs.sansAchat === 0 }">
          {{ compteurs.sansAchat }} sans prix d'achat
        </span>
      </div>

      <div class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr>
              <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
              <ColonneTri v-model="tri" cle="designation">Désignation</ColonneTri>
              <ColonneTri v-model="tri" cle="famille">Famille</ColonneTri>
              <ColonneTri v-model="tri" cle="uniteVente">Unité de vente</ColonneTri>
              <ColonneTri v-model="tri" cle="prixVente" class="nombre">Prix de vente</ColonneTri>
              <ColonneTri v-model="tri" cle="prixAchat" class="nombre">Prix d'achat</ColonneTri>
              <ColonneTri v-model="tri" cle="marge" class="nombre">Marge</ColonneTri>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="med in lignesPage" :key="med.id" :class="{ 'ligne-inactive': !med.actif }">
              <td class="code">{{ med.code }}</td>
              <td>
                <strong>{{ med.designation }}</strong>
                <div v-if="med.forme || med.dosage" class="detail">
                  {{ [med.forme?.libelle, med.dosage].filter(Boolean).join(' · ') }}
                </div>
              </td>
              <td>{{ med.famille?.libelle || '—' }}</td>
              <td>{{ med.uniteVente?.libelle || '—' }}</td>
              <td class="nombre">
                <span v-if="med.prixVenteActuel !== null">{{ formaterMontant(med.prixVenteActuel) }}</span>
                <span v-else class="badge badge-rouge">Non défini</span>
              </td>
              <td class="nombre">
                <span v-if="med.prixAchatActuel !== null">{{ formaterMontant(med.prixAchatActuel) }}</span>
                <span v-else class="badge badge-orange">Non défini</span>
              </td>
              <td class="nombre">
                <template v-if="marge(med) !== null">
                  <strong :class="{ 'marge-negative': marge(med) < 0 }">{{ formaterMontant(marge(med)) }}</strong>
                  <div v-if="tauxMarge(med) !== null" class="detail">{{ tauxMarge(med) }} %</div>
                </template>
                <span v-else>—</span>
              </td>
              <td class="actions">
                <button class="bouton-lien" @click="ouvrirDetail(med)">Historique / modifier</button>
              </td>
            </tr>
          </tbody>
        </table>
        <Pagination v-model:page="page" v-model:taille="taille" :total="medicamentsAffiches.length" />
        <p v-if="!chargement && medicamentsAffiches.length === 0" class="tableau-vide">
          Aucun médicament ne correspond aux filtres.
        </p>
        <p v-if="chargement" class="tableau-vide">Chargement…</p>
      </div>
    </template>

    <!-- ===================== B. DÉTAIL D'UN MÉDICAMENT ===================== -->
    <template v-else>
    <!-- Retour à la liste + choix du médicament -->
    <div class="barre-outils">
      <button class="bouton-secondaire retour" @click="retourListe">← Retour à la liste</button>
      <div class="choix-medicament">
        <label>Médicament</label>
        <ListeDeroulante
          v-model="medicamentId"
          :options="medicamentsActifs"
          :champ-libelle="(m) => `${m.code} — ${m.designation}`"
          placeholder="Tapez le code ou le nom du médicament…"
        />
      </div>
    </div>

    <div class="colonnes-prix">
      <!-- =================== PRIX DE VENTE =================== -->
      <section class="carte-prix">
        <header class="entete-carte">
          <div>
            <h3>Prix de vente</h3>
            <p>Prix appliqué aux centres de santé (facturation des consommations)</p>
          </div>
          <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » de l'historique -->
          <ImportExportTableau
            titre="Historique des prix de vente"
            :sous-titre="libelleMedicament"
            :nom-fichier="`prix_vente_${medicamentChoisi?.code || ''}`"
            :colonnes-pdf="COLONNES_PDF_VENTE"
            :lignes="historiqueVente"
            :colonnes-import="colonnesImportVente"
            :importer-ligne="importerPrixVente"
            @importe="chargerHistorique"
          />
        </header>

        <div class="prix-actuel">
          <span>Prix général en cours</span>
          <strong>{{ prixVenteActuel !== null ? formaterMontant(prixVenteActuel) : 'Non défini' }}</strong>
        </div>

        <!-- Nouveau prix de vente -->
        <form v-si-modif class="nouveau-prix" @submit.prevent="enregistrerPrixVente">
          <div>
            <label class="obligatoire">Nouveau prix (FCFA)</label>
            <input v-model.number="nouveauPrixVente.prix" type="number" min="0" step="1" required />
          </div>
          <div>
            <label class="obligatoire">À partir du</label>
            <input v-model="nouveauPrixVente.dateEffet" type="date" required />
          </div>
          <!-- Centre : seulement si les prix par centre sont activés -->
          <div v-if="prixParCentreActive">
            <label>Centre (vide = tous)</label>
            <ListeDeroulante
              v-model="nouveauPrixVente.centreId"
              :options="centresActifs"
              champ-libelle="nom"
              placeholder="Tous les centres"
            />
          </div>
          <button type="submit" :disabled="enregistrement">Enregistrer</button>
        </form>

        <TableauHistoriquePrix
          :lignes="historiqueVente"
          colonne="Centre"
          :libelle="(p) => p.centre?.nom || 'Tous les centres'"
          @corriger="(ligne) => ouvrirCorrection('vente', ligne)"
        />
      </section>

      <!-- =================== PRIX D'ACHAT =================== -->
      <section class="carte-prix">
        <header class="entete-carte">
          <div>
            <h3>Prix d'achat</h3>
            <p>Prix payé par le district au fournisseur (valorisation du stock)</p>
          </div>
          <ImportExportTableau
            titre="Historique des prix d'achat"
            :sous-titre="libelleMedicament"
            :nom-fichier="`prix_achat_${medicamentChoisi?.code || ''}`"
            :colonnes-pdf="COLONNES_PDF_ACHAT"
            :lignes="historiqueAchat"
            :colonnes-import="colonnesImportAchat"
            :importer-ligne="importerPrixAchat"
            @importe="chargerHistorique"
          />
        </header>

        <div class="prix-actuel secondaire">
          <span>Dernier prix en cours</span>
          <strong>{{ prixAchatActuel !== null ? formaterMontant(prixAchatActuel) : 'Non défini' }}</strong>
        </div>

        <form v-si-modif class="nouveau-prix" @submit.prevent="enregistrerPrixAchat">
          <div>
            <label class="obligatoire">Nouveau prix (FCFA)</label>
            <input v-model.number="nouveauPrixAchat.prix" type="number" min="0" step="1" required />
          </div>
          <div>
            <label class="obligatoire">À partir du</label>
            <input v-model="nouveauPrixAchat.dateEffet" type="date" required />
          </div>
          <div>
            <label>Fournisseur (facultatif)</label>
            <ListeDeroulante
              v-model="nouveauPrixAchat.fournisseurId"
              :options="fournisseursActifs"
              champ-libelle="raisonSociale"
              placeholder="Tous fournisseurs"
            />
          </div>
          <button type="submit" :disabled="enregistrement">Enregistrer</button>
        </form>

        <TableauHistoriquePrix
          :lignes="historiqueAchat"
          colonne="Fournisseur"
          :libelle="(p) => p.fournisseur?.raisonSociale || 'Tous fournisseurs'"
          @corriger="(ligne) => ouvrirCorrection('achat', ligne)"
        />
      </section>
    </div>
    </template>

    <!-- ===================== FENÊTRE : CORRIGER UN PRIX ===================== -->
    <FenetreModale
      v-if="correction"
      :titre="correction.type === 'vente' ? 'Corriger le prix de vente' : 'Corriger le prix d\'achat'"
      @fermer="correction = null"
    >
      <p class="explication">
        À utiliser pour une <strong>erreur de saisie</strong> : le montant du prix en cours est remplacé,
        sans créer de nouvelle ligne dans l'historique. L'ancien montant et le motif sont conservés
        dans le journal. Pour un <strong>changement de tarif</strong>, utilisez plutôt « Nouveau prix ».
      </p>
      <div class="prix-a-corriger">
        <span>{{ libelleMedicament }}<br /><small>{{ correction.libelle }} — depuis le {{ formaterDate(correction.ligne.dateEffet) }}</small></span>
        <strong><small>Montant actuel</small>{{ formaterMontant(correction.ligne.prix) }}</strong>
      </div>
      <form id="form-correction" class="grille-formulaire" @submit.prevent="enregistrerCorrection">
        <div>
          <label class="obligatoire">Montant correct (FCFA)</label>
          <input v-model="correction.prix" type="number" min="0" step="1" required />
        </div>
        <div>
          <label class="obligatoire">Motif</label>
          <input v-model.trim="correction.motif" required maxlength="255" placeholder="ex. erreur de saisie (500 au lieu de 50)" />
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="correction = null">Fermer</button>
        <button type="submit" form="form-correction" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Corriger le prix' }}
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import {
  corrigerPrixAchat,
  corrigerPrixVente,
  creerPrixAchat,
  creerPrixVente,
  historiquePrixAchat,
  historiquePrixVente,
  listerParametres,
} from '@/api/parametrage'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import TableauHistoriquePrix from './TableauHistoriquePrix.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import FenetreModale from '@/components/FenetreModale.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { enDateImport, enNombreImport, enTexte, trouverParCode } from '@/utils/importFichier'

const props = defineProps({
  /** Médicament à afficher à l'ouverture (venant de l'onglet Médicaments) */
  medicamentInitial: { type: Number, default: null },
})

const store = useStore()

const medicamentId = ref(props.medicamentInitial)
const historiqueVente = ref([])
const historiqueAchat = ref([])
const prixParCentreActive = ref(false)
const enregistrement = ref(false)

// Formulaires "nouveau prix" (date du jour par défaut)
const nouveauPrixVente = ref({ prix: null, dateEffet: dateDuJour(), centreId: null })
const nouveauPrixAchat = ref({ prix: null, dateEffet: dateDuJour(), fournisseurId: null })

// Listes déroulantes (données du store)
const medicamentsActifs = computed(() => store.state.referentiel.medicaments.filter((m) => m.actif))

// ---------------------------------------------------------------------------
// A. VUE D'ENSEMBLE : tous les médicaments avec leurs prix actuels
// ---------------------------------------------------------------------------
const recherche = ref('')
const familleFiltre = ref(null)
const etatPrixFiltre = ref(null)
const afficherInactifs = ref(false)
const chargement = ref(false)

const familles = computed(() => store.state.referentiel.familles)

/** Choix du filtre « état des prix ». */
const ETATS_PRIX = [
  { id: 'SANS_VENTE', libelle: 'Sans prix de vente' },
  { id: 'SANS_ACHAT', libelle: "Sans prix d'achat" },
  { id: 'INCOMPLETS', libelle: 'Prix incomplets (vente ou achat)' },
  { id: 'COMPLETS', libelle: 'Prix complets' },
]

/** Liste filtrée (recherche + famille + état des prix + inactifs). */
const medicamentsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return store.state.referentiel.medicaments.filter((m) => {
    if (!afficherInactifs.value && !m.actif) return false
    if (familleFiltre.value && m.familleId !== familleFiltre.value) return false
    const aVente = m.prixVenteActuel !== null
    const aAchat = m.prixAchatActuel !== null
    if (etatPrixFiltre.value === 'SANS_VENTE' && aVente) return false
    if (etatPrixFiltre.value === 'SANS_ACHAT' && aAchat) return false
    if (etatPrixFiltre.value === 'INCOMPLETS' && aVente && aAchat) return false
    if (etatPrixFiltre.value === 'COMPLETS' && !(aVente && aAchat)) return false
    if (!texte) return true
    return [m.code, m.designation].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

/** Compteurs affichés au-dessus du tableau. */
const compteurs = computed(() => ({
  sansVente: medicamentsAffiches.value.filter((m) => m.prixVenteActuel === null).length,
  sansAchat: medicamentsAffiches.value.filter((m) => m.prixAchatActuel === null).length,
}))

/** Marge = prix de vente - prix d'achat (null s'il manque un des deux). */
function marge(med) {
  if (med.prixVenteActuel === null || med.prixAchatActuel === null) return null
  return Number(med.prixVenteActuel) - Number(med.prixAchatActuel)
}
/** Taux de marge en % du prix d'achat (ex. 500 / 350 -> 42,9 %). */
function tauxMarge(med) {
  const m = marge(med)
  if (m === null || Number(med.prixAchatActuel) === 0) return null
  return ((m / Number(med.prixAchatActuel)) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (m) => m.code,
  designation: (m) => m.designation,
  famille: (m) => m.famille?.libelle,
  uniteVente: (m) => m.uniteVente?.libelle,
  prixVente: (m) => m.prixVenteActuel,
  prixAchat: (m) => m.prixAchatActuel,
  marge: (m) => marge(m),
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(medicamentsAffiches, [recherche, familleFiltre, etatPrixFiltre, afficherInactifs], VALEURS_TRI)

/** Ligne sous le titre du PDF : rappelle les filtres appliqués. */
const sousTitrePdf = computed(() => {
  const famille = familles.value.find((f) => f.id === familleFiltre.value)
  const etat = ETATS_PRIX.find((e) => e.id === etatPrixFiltre.value)
  return [
    famille ? `Famille : ${famille.libelle}` : 'Toutes les familles',
    etat ? etat.libelle : 'tous les prix',
    afficherInactifs.value ? 'actifs et inactifs' : 'médicaments actifs',
  ].join(' — ')
})

/** Colonnes du PDF de la vue d'ensemble. */
const COLONNES_PDF_LISTE = [
  { titre: 'Code', valeur: (m) => m.code },
  { titre: 'Désignation', valeur: (m) => m.designation },
  { titre: 'Famille', valeur: (m) => m.famille?.libelle },
  { titre: 'Unité de vente', valeur: (m) => m.uniteVente?.libelle },
  { titre: 'Prix de vente', valeur: (m) => (m.prixVenteActuel !== null ? formaterMontant(m.prixVenteActuel) : 'Non défini'), droite: true, somme: (m) => m.prixVenteActuel, formatTotal: formaterMontant },
  { titre: "Prix d'achat", valeur: (m) => (m.prixAchatActuel !== null ? formaterMontant(m.prixAchatActuel) : 'Non défini'), droite: true, somme: (m) => m.prixAchatActuel, formatTotal: formaterMontant },
  { titre: 'Marge', valeur: (m) => (marge(m) !== null ? formaterMontant(marge(m)) : ''), droite: true, somme: (m) => marge(m), formatTotal: formaterMontant },
]

/** Recharge les médicaments (avec leurs prix actuels) et les familles. */
async function chargerListe() {
  chargement.value = true
  try {
    await Promise.all([
      store.dispatch('referentiel/charger', { liste: 'medicaments' }),
      store.dispatch('referentiel/charger', { liste: 'familles' }),
    ])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

/** Ouvre le détail (historiques) d'un médicament. */
function ouvrirDetail(med) {
  medicamentId.value = med.id
}

/** Revient à la vue d'ensemble, avec les prix à jour. */
function retourListe() {
  medicamentId.value = null
  chargerListe()
}
const centresActifs = computed(() => store.state.referentiel.centres.filter((c) => c.actif))
const fournisseursActifs = computed(() => store.state.referentiel.fournisseurs.filter((f) => f.actif))

/** Prix en cours = ligne sans date de fin (prix général pour la vente). */
const prixVenteActuel = computed(() => {
  const ligne = historiqueVente.value.find((p) => p.dateFin === null && p.centreId === null)
  return ligne ? ligne.prix : null
})
const prixAchatActuel = computed(() => {
  const ligne = historiqueAchat.value.find((p) => p.dateFin === null)
  return ligne ? ligne.prix : null
})

/** Charge l'historique des prix du médicament choisi. */
async function chargerHistorique() {
  if (!medicamentId.value) return
  try {
    const [vente, achat] = await Promise.all([
      historiquePrixVente(medicamentId.value),
      historiquePrixAchat(medicamentId.value),
    ])
    historiqueVente.value = vente
    historiqueAchat.value = achat
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function enregistrerPrixVente() {
  enregistrement.value = true
  try {
    await creerPrixVente({ medicamentId: medicamentId.value, ...sansVide(nouveauPrixVente.value) })
    store.dispatch('notifications/succes', 'Nouveau prix de vente enregistré.')
    nouveauPrixVente.value = { prix: null, dateEffet: dateDuJour(), centreId: null }
    await chargerHistorique()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function enregistrerPrixAchat() {
  enregistrement.value = true
  try {
    await creerPrixAchat({ medicamentId: medicamentId.value, ...sansVide(nouveauPrixAchat.value) })
    store.dispatch('notifications/succes', "Nouveau prix d'achat enregistré.")
    nouveauPrixAchat.value = { prix: null, dateEffet: dateDuJour(), fournisseurId: null }
    await chargerHistorique()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Retire les champs vides (centre / fournisseur non choisis). */
function sansVide(objet) {
  return Object.fromEntries(Object.entries(objet).filter(([, v]) => v !== null && v !== ''))
}

// ---------------------------------------------------------------------------
// EXPORT PDF ET IMPORT DE FICHIER
// ---------------------------------------------------------------------------

/** Médicament choisi et son libellé (sous-titre du PDF). */
const medicamentChoisi = computed(() => store.state.referentiel.medicaments.find((m) => m.id === medicamentId.value))
const libelleMedicament = computed(() =>
  medicamentChoisi.value ? `${medicamentChoisi.value.code} — ${medicamentChoisi.value.designation}` : '',
)

/** Colonnes communes aux deux PDF (la 2e colonne change : centre ou fournisseur). */
function colonnesPdf(titreColonne, libelle) {
  return [
    { titre: 'Prix', valeur: (p) => formaterMontant(p.prix), droite: true },
    { titre: titreColonne, valeur: libelle },
    { titre: 'Du', valeur: (p) => formaterDate(p.dateEffet) },
    { titre: 'Au', valeur: (p) => (p.dateFin ? formaterDate(p.dateFin) : '') },
    { titre: 'Statut', valeur: (p) => (p.dateFin ? 'Clôturé' : 'En cours') },
  ]
}
const COLONNES_PDF_VENTE = colonnesPdf('Centre', (p) => p.centre?.nom || 'Tous les centres')
const COLONNES_PDF_ACHAT = colonnesPdf('Fournisseur', (p) => p.fournisseur?.raisonSociale || 'Tous fournisseurs')

/**
 * Colonnes du fichier d'import des prix. Le fichier peut contenir des prix
 * pour PLUSIEURS médicaments (colonne « Code médicament »).
 * L'exemple reprend le médicament actuellement choisi.
 */
function colonnesImportPrix() {
  return [
    {
      cle: 'medicament', titre: 'Code médicament', obligatoire: true,
      exemple: medicamentChoisi.value?.code || 'PARA500', aide: 'Code d\'un médicament existant',
    },
    { cle: 'prix', titre: 'Prix', obligatoire: true, exemple: 25, aide: 'Montant en FCFA' },
    { cle: 'dateEffet', titre: 'Date d\'effet', obligatoire: true, exemple: formaterDate(dateDuJour()), aide: 'Date de début (JJ/MM/AAAA)' },
  ]
}
const colonnesImportVente = computed(() => [
  ...colonnesImportPrix(),
  // Colonne « centre » seulement si les prix par centre sont activés
  ...(prixParCentreActive.value
    ? [{ cle: 'centre', titre: 'Code centre', exemple: '', aide: 'Facultatif : vide = prix pour tous les centres' }]
    : []),
])
const colonnesImportAchat = computed(() => [
  ...colonnesImportPrix(),
  { cle: 'fournisseur', titre: 'Code fournisseur', exemple: '', aide: 'Facultatif : vide = tous fournisseurs' },
])

/** Vérifie et convertit les colonnes communes (médicament, prix, date). */
function lirePrix(valeurs) {
  const medicament = trouverParCode(store.state.referentiel.medicaments, valeurs.medicament)
  if (!medicament) throw new Error(`médicament « ${enTexte(valeurs.medicament)} » inconnu`)
  const prix = enNombreImport(valeurs.prix, 'Prix')
  if (prix === null || prix < 0) throw new Error('prix manquant ou négatif')
  return { medicamentId: medicament.id, prix, dateEffet: enDateImport(valeurs.dateEffet, "Date d'effet") }
}

/** Enregistre UNE ligne de prix de vente (toujours une création). */
async function importerPrixVente(valeurs) {
  const donnees = lirePrix(valeurs)
  if (enTexte(valeurs.centre)) {
    const centre = trouverParCode(store.state.referentiel.centres, valeurs.centre)
    if (!centre) throw new Error(`centre « ${enTexte(valeurs.centre)} » inconnu`)
    donnees.centreId = centre.id
  }
  await creerPrixVente(donnees)
  return 'cree'
}

/** Enregistre UNE ligne de prix d'achat (toujours une création). */
async function importerPrixAchat(valeurs) {
  const donnees = lirePrix(valeurs)
  if (enTexte(valeurs.fournisseur)) {
    const fournisseur = trouverParCode(store.state.referentiel.fournisseurs, valeurs.fournisseur)
    if (!fournisseur) throw new Error(`fournisseur « ${enTexte(valeurs.fournisseur)} » inconnu`)
    donnees.fournisseurId = fournisseur.id
  }
  await creerPrixAchat(donnees)
  return 'cree'
}

// ---------------------------------------------------------------------------
// CORRECTION D'UN PRIX EN COURS (erreur de saisie)
// ---------------------------------------------------------------------------

// Fenêtre de correction ouverte (null = fermée) : { type, ligne, libelle, prix, motif }
const correction = ref(null)

/** Ouvre la fenêtre de correction pour un prix en cours. */
function ouvrirCorrection(type, ligne) {
  const libelle =
    type === 'vente'
      ? ligne.centre?.nom || 'Tous les centres'
      : ligne.fournisseur?.raisonSociale || 'Tous fournisseurs'
  correction.value = { type, ligne, libelle, prix: Number(ligne.prix), motif: '' }
}

async function enregistrerCorrection() {
  const c = correction.value
  enregistrement.value = true
  try {
    const corrigerPrix = c.type === 'vente' ? corrigerPrixVente : corrigerPrixAchat
    const misAJour = await corrigerPrix(c.ligne.id, { prix: Number(c.prix), motif: c.motif })
    store.dispatch('notifications/succes', 'Prix corrigé.')
    // La fenêtre RESTE OUVERTE (fermée par × ou « Fermer ») : elle affiche le
    // nouveau montant, et le motif est vidé.
    correction.value = { ...c, ligne: { ...c.ligne, prix: misAJour.prix }, motif: '' }
    await chargerHistorique()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

// Quand on change de médicament : on recharge son historique
watch(medicamentId, chargerHistorique)

onMounted(async () => {
  try {
    // Listes déroulantes + paramètre "prix par centre"
    chargement.value = true
    const [, , , , parametres] = await Promise.all([
      store.dispatch('referentiel/charger', { liste: 'medicaments' }),
      store.dispatch('referentiel/charger', { liste: 'familles' }),
      store.dispatch('referentiel/charger', { liste: 'centres' }),
      store.dispatch('referentiel/charger', { liste: 'fournisseurs' }),
      listerParametres(),
    ])
    prixParCentreActive.value = parametres.find((p) => p.cle === 'PRIX_VENTE_PAR_CENTRE')?.valeur === 'true'
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
  await chargerHistorique()
})

</script>

<style scoped>
.choix-medicament { flex: 1; max-width: 520px; }
.retour { align-self: flex-end; }

/* ---------- Fenêtre de correction ---------- */
.explication { margin: 0 0 1rem; font-size: 0.88rem; color: var(--muted); line-height: 1.5; }
.prix-a-corriger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #fff6e5;
  color: #7a4a00;
}
.prix-a-corriger small { color: #9a6a20; }
.prix-a-corriger strong { font-size: 1.25rem; text-align: right; }
.prix-a-corriger strong small { display: block; font-size: 0.72rem; font-weight: 600; }

/* ---------- Vue d'ensemble ---------- */
.detail { font-size: 0.78rem; color: var(--muted); }
.badge-orange { background: #fff1e0; color: #b35c00; }
.marge-negative { color: var(--danger); }
.compteurs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: -0.25rem 0 0.9rem; }
.compteur {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.8rem;
  font-weight: 700;
}
.compteur.rouge { background: #fdecec; color: var(--danger); }
.compteur.orange { background: #fff1e0; color: #b35c00; }
.compteur.zero { background: #eef0f2; color: var(--muted); }

.colonnes-prix {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
@media (max-width: 1100px) {
  .colonnes-prix { grid-template-columns: 1fr; }
}

.carte-prix {
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 14px;
}
.carte-prix header h3 { margin: 0; color: var(--primary-dark); }
.carte-prix header p { margin: 0.2rem 0 1rem; font-size: 0.85rem; color: var(--muted); }
/* Titre à gauche, boutons Importer / PDF à droite */
.entete-carte { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; }

/* Encadré du prix en cours */
.prix-actuel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--primary), var(--primary-dark));
  color: #fff;
}
.prix-actuel.secondaire { background: linear-gradient(120deg, var(--accent), var(--accent-dark)); }
.prix-actuel strong { font-size: 1.4rem; }

/* Formulaire "nouveau prix" sur une ligne */
.nouveau-prix {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  align-items: end;
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 12px;
  background: var(--fond-pale);
}

</style>
