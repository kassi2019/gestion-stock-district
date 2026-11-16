<!--
  =============================================================================
  ONGLET « COMMANDES FOURNISSEURS »
  =============================================================================
  - Liste des commandes : recherche, filtres (fournisseur, statut, période),
    tri, pagination, PDF de la liste ;
  - « Nouvelle commande » : fournisseur, date, lignes (médicament, quantité,
    prix unitaire — prérempli avec le prix d'achat du Paramétrage) ;
  - Cycle : Brouillon (modifiable) -> Validée -> Partiellement reçue -> Reçue
    (ou Annulée tant que rien n'est reçu) ;
  - Actions : Bon de commande (PDF), Pièces jointes, Réceptionner (ouvre une
    réception pré-remplie avec les quantités restant à recevoir).

  ENCHAÎNEMENT (assistant) : barre d'étapes en haut de la fenêtre ; après
  « Enregistrer et valider », question « Réceptionner maintenant ? »
  (Oui = ouvre la réception ; Plus tard = la commande reste affichée).

  Événement : @receptionner(commande) -> la page ouvre l'onglet Réceptions
  =============================================================================
-->
<template>
  <div>
    <!-- Barre d'outils -->
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, fournisseur)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.fournisseurId" :options="fournisseurs" champ-libelle="raisonSociale" placeholder="Tous les fournisseurs" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_COMMANDE)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau
        titre="Commandes fournisseurs"
        :sous-titre="sousTitrePdf"
        nom-fichier="commandes_fournisseurs"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouvelle commande</button>
    </div>

    <!-- Tableau -->
    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° commande</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="fournisseur">Fournisseur</ColonneTri>
            <ColonneTri v-model="tri" cle="lignes" class="nombre">Lignes</ColonneTri>
            <ColonneTri v-model="tri" cle="montant" class="nombre">Montant</ColonneTri>
            <ColonneTri v-model="tri" cle="reception">Réception</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in lignesPage" :key="c.id">
            <td class="code">{{ c.numero }}</td>
            <td>{{ formaterDate(c.dateCommande) }}</td>
            <td><strong>{{ c.fournisseur.raisonSociale }}</strong></td>
            <td class="nombre">{{ c.nombreLignes }}</td>
            <td class="nombre">{{ formaterMontant(c.montantTotal) }}</td>
            <td>
              <!-- Avancement de la réception (en quantités) -->
              <div class="avancement" :title="`${c.quantiteRecue} / ${c.quantiteCommandee} reçu(s)`">
                <div class="avancement-barre"><div :style="{ width: pourcentage(c) + '%' }"></div></div>
                <small>{{ pourcentage(c) }} %</small>
              </div>
            </td>
            <td><span class="badge" :class="STATUTS_COMMANDE[c.statut]?.badge">{{ STATUTS_COMMANDE[c.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrirFormulaire(c)">{{ c.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button
                v-if="c.statut === 'VALIDEE' || c.statut === 'PARTIELLEMENT_RECUE'"
                v-si-modif
                class="bouton-lien"
                @click="receptionner(c)"
              >
                Réceptionner
              </button>
              <button v-si-imprimer class="bouton-lien" title="Bon de commande (PDF)" @click="imprimer(c)">Bon PDF</button>
              <button class="bouton-lien" @click="docPieces = c">Pièces</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:taille="taille" :total="commandesAffichees.length" />
      <p v-if="!chargement && commandesAffichees.length === 0" class="tableau-vide">Aucune commande.</p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- ===================== FORMULAIRE / CONSULTATION ===================== -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? `Commande ${formulaire.numero}` : 'Nouvelle commande fournisseur'"
      tres-large
      @fermer="formulaire = null"
    >
      <!-- Où en est la commande dans le circuit (assistant pas à pas) -->
      <EtapesCircuit v-if="formulaire.statut !== 'ANNULEE'" :etapes="ETAPES_ACHAT" :courante="etape.numero" :aide="etape.aide" />

      <!-- Statut (commande existante) -->
      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_COMMANDE[formulaire.statut]?.badge">{{ STATUTS_COMMANDE[formulaire.statut]?.libelle }}</span>
        <small v-if="lectureSeule">Commande {{ STATUTS_COMMANDE[formulaire.statut]?.libelle.toLowerCase() }} : elle n'est plus modifiable.</small>
        <small v-else>Brouillon : modifiable jusqu'à sa validation.</small>
      </div>

      <form id="form-commande" class="grille-formulaire" @submit.prevent="enregistrer(false)">
        <div>
          <label class="obligatoire">Fournisseur</label>
          <ListeDeroulante
            v-model="formulaire.fournisseurId"
            :options="fournisseursActifs"
            champ-libelle="raisonSociale"
            placeholder="— Choisir le fournisseur —"
            :desactive="lectureSeule"
          />
        </div>
        <div>
          <label class="obligatoire">Date de la commande</label>
          <input v-model="formulaire.dateCommande" type="date" required :disabled="lectureSeule" />
        </div>

        <!-- ---------- Lignes ---------- -->
        <div class="pleine-largeur">
          <h4 class="section">Médicaments commandés</h4>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th class="nombre">Quantité</th>
                <th class="nombre">Prix unitaire</th>
                <th class="nombre">Montant</th>
                <th v-if="formulaire.id && lectureSeule" class="nombre">Reçu</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.lignes" :key="index">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="ligne.medicamentId"
                    :options="medicamentsActifs"
                    :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                    placeholder="Choisir…"
                    @update:model-value="(id) => choisirMedicament(ligne, id)"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                  <small v-if="uniteDe(ligne.medicamentId)" class="detail">par {{ uniteDe(ligne.medicamentId) }}</small>
                </td>
                <td class="nombre"><input v-model.number="ligne.quantite" type="number" min="1" step="1" required :disabled="lectureSeule" /></td>
                <td class="nombre"><input v-model.number="ligne.prixUnitaire" type="number" min="0" step="1" required :disabled="lectureSeule" /></td>
                <td class="nombre"><strong>{{ formaterMontant((ligne.quantite || 0) * (ligne.prixUnitaire || 0)) }}</strong></td>
                <td v-if="formulaire.id && lectureSeule" class="nombre">
                  <span :class="{ 'complet': ligne.quantiteRecue >= ligne.quantite }">{{ ligne.quantiteRecue }} / {{ ligne.quantite }}</span>
                </td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">
                  <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="ajouterLigne">+ Ajouter un médicament</button>
                </td>
                <td class="nombre total">{{ formaterMontant(totalFormulaire) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="pleine-largeur">
          <label>Observations</label>
          <textarea v-model.trim="formulaire.observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
        </div>

        <!-- Réceptions liées (commande existante) -->
        <div v-if="formulaire.receptions?.length" class="pleine-largeur">
          <h4 class="section">Réceptions</h4>
          <ul class="receptions-liees">
            <li v-for="r in formulaire.receptions" :key="r.id">
              <span class="code">{{ r.numero }}</span> du {{ formaterDate(r.dateReception) }} —
              {{ formaterMontant(r.montantTotal) }}
              <span class="badge" :class="STATUTS_RECEPTION[r.statut]?.badge">{{ STATUTS_RECEPTION[r.statut]?.libelle }}</span>
            </li>
          </ul>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <template v-if="formulaire.id && formulaire.statut !== 'ANNULEE'">
          <button v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer(formulaire)">Bon de commande PDF</button>
        </template>
        <template v-if="!lectureSeule">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">
            Annuler la commande
          </button>
          <button v-si-modif type="submit" form="form-commande" class="bouton-secondaire" :disabled="enregistrement">
            Enregistrer le brouillon
          </button>
          <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Enregistrer et valider</button>
        </template>
        <template v-else-if="formulaire.statut === 'VALIDEE'">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler la commande</button>
          <button v-si-modif type="button" @click="receptionner(formulaire)">Réceptionner</button>
        </template>
        <button v-else-if="formulaire.statut === 'PARTIELLEMENT_RECUE'" v-si-modif type="button" @click="receptionner(formulaire)">
          Réceptionner la suite
        </button>
      </template>
    </FenetreModale>

    <!-- Pièces jointes -->
    <PiecesJointes
      v-if="docPieces"
      type="CommandeFournisseur"
      :id="docPieces.id"
      :titre="`Pièces de la commande ${docPieces.numero}`"
      @fermer="docPieces = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import PiecesJointes from '@/components/PiecesJointes.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterMontant } from '@/utils/format'
import { annulerCommande, creerCommande, listerCommandes, modifierCommande, trouverCommande, validerCommande } from '@/api/achats'
import EtapesCircuit from '@/components/EtapesCircuit.vue'
import { bonDeCommandePdf, ETAPE_ACHAT, ETAPES_ACHAT, optionsStatuts, STATUTS_COMMANDE, STATUTS_RECEPTION } from './achatsCommun'

const emit = defineEmits(['receptionner', 'modifie'])
const store = useStore()

const commandes = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ fournisseurId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const docPieces = ref(null)

// Listes du Paramétrage
const fournisseurs = computed(() => store.state.referentiel.fournisseurs)
const fournisseursActifs = computed(() => fournisseurs.value.filter((f) => f.actif || f.id === formulaire.value?.fournisseurId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

/** Commande non modifiable (déjà validée, reçue ou annulée). */
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

/** Étape du circuit où se trouve la commande ouverte (barre d'étapes en haut de la fenêtre). */
const etape = computed(() => {
  const f = formulaire.value
  if (!f?.id || f.statut === 'BROUILLON') {
    return { numero: ETAPE_ACHAT.COMMANDE, aide: 'Choisissez le fournisseur et les médicaments, puis « Enregistrer et valider ».' }
  }
  if (f.statut === 'VALIDEE' || f.statut === 'PARTIELLEMENT_RECUE') {
    return { numero: ETAPE_ACHAT.RECEPTION, aide: 'À l\'arrivée des médicaments, cliquez sur « Réceptionner ».' }
  }
  return { numero: ETAPE_ACHAT.TERMINE, aide: 'Commande entièrement reçue.' }
})

/** Recherche (n°, fournisseur) sur la liste chargée. */
const commandesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return commandes.value
  return commandes.value.filter((c) => [c.numero, c.fournisseur.raisonSociale].some((v) => (v || '').toLowerCase().includes(texte)))
})

/** % de la commande reçu (en quantités). */
function pourcentage(c) {
  return c.quantiteCommandee ? Math.min(100, Math.round((c.quantiteRecue / c.quantiteCommandee) * 100)) : 0
}

/** Charge les commandes (filtres côté serveur : fournisseur, statut, période). */
async function charger() {
  chargement.value = true
  try {
    commandes.value = await listerCommandes(filtres)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}
watch(filtres, charger)

// ---------------------------------------------------------------------------
// FORMULAIRE
// ---------------------------------------------------------------------------

/** Ouvre une commande (détail complet) ou une nouvelle commande vide. */
async function ouvrirFormulaire(commande = null) {
  if (!commande) {
    formulaire.value = { fournisseurId: null, dateCommande: dateDuJour(), observations: '', lignes: [nouvelleLigne()] }
    return
  }
  try {
    const c = await trouverCommande(commande.id)
    formulaire.value = {
      ...c,
      dateCommande: c.dateCommande.substring(0, 10),
      observations: c.observations || '',
      lignes: c.lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: l.quantite,
        prixUnitaire: Number(l.prixUnitaire),
        quantiteRecue: l.quantiteRecue,
      })),
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

function nouvelleLigne() {
  return { medicamentId: null, quantite: 1, prixUnitaire: 0 }
}
function ajouterLigne() {
  formulaire.value.lignes.push(nouvelleLigne())
}

/** Médicament choisi : prix unitaire prérempli avec son prix d'achat actuel. */
function choisirMedicament(ligne, medicamentId) {
  const med = medicaments.value.find((m) => m.id === medicamentId)
  if (med && med.prixAchatActuel !== null && !ligne.prixUnitaire) ligne.prixUnitaire = Number(med.prixAchatActuel)
}

function libelleMedicament(id) {
  const m = medicaments.value.find((x) => x.id === id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function uniteDe(id) {
  return medicaments.value.find((x) => x.id === id)?.uniteVente?.libelle?.toLowerCase() || ''
}

const totalFormulaire = computed(() =>
  (formulaire.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0),
)

/**
 * Enregistre la commande (brouillon) ; avec « valider », la valide ensuite.
 * La fenêtre reste ouverte et affiche la commande enregistrée.
 */
async function enregistrer(valider) {
  const f = formulaire.value
  if (!f.fournisseurId) return store.dispatch('notifications/erreur', 'Choisissez le fournisseur.')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament.')
  if (lignes.some((l) => !(l.quantite >= 1))) return store.dispatch('notifications/erreur', 'Chaque quantité doit être au moins 1.')

  if (valider) {
    const confirme = await confirmer({
      titre: 'Valider la commande ?',
      texte: 'Une fois validée, la commande ne pourra plus être modifiée (elle pourra être réceptionnée ou annulée).',
      boutonConfirmer: 'Oui, valider',
    })
    if (!confirme) return
  }

  enregistrement.value = true
  try {
    const donnees = {
      fournisseurId: f.fournisseurId,
      dateCommande: f.dateCommande,
      observations: f.observations || undefined,
      lignes: lignes.map((l) => ({ medicamentId: l.medicamentId, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) || 0 })),
    }
    let commande = f.id ? await modifierCommande(f.id, donnees) : await creerCommande(donnees)
    if (valider) commande = await validerCommande(commande.id)
    store.dispatch('notifications/succes', valider ? `Commande ${commande.numero} validée.` : `Commande ${commande.numero} enregistrée (brouillon).`)
    await ouvrirFormulaire(commande)
    await charger()
    emit('modifie')
    // ENCHAÎNEMENT : les médicaments arrivent souvent plus tard, on demande donc
    // si la réception se fait maintenant (sinon la commande reste affichée)
    if (valider) {
      const maintenant = await confirmer({
        titre: 'Réceptionner maintenant ?',
        texte: `Si les médicaments de la commande ${commande.numero} sont déjà arrivés, passez directement à la réception.`,
        boutonConfirmer: 'Oui, réceptionner',
        boutonAnnuler: 'Plus tard',
      })
      if (maintenant) receptionner(commande)
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function annuler() {
  const f = formulaire.value
  const confirme = await confirmer({
    titre: `Annuler la commande ${f.numero} ?`,
    texte: 'La commande restera dans l\'historique avec le statut « Annulée ».',
    boutonConfirmer: 'Oui, annuler la commande',
    danger: true,
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    const commande = await annulerCommande(f.id)
    store.dispatch('notifications/succes', `Commande ${commande.numero} annulée.`)
    await ouvrirFormulaire(commande)
    await charger()
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Ouvre une réception pré-remplie (onglet Réceptions). */
function receptionner(commande) {
  formulaire.value = null
  emit('receptionner', commande)
}

/** Bon de commande PDF (détail complet rechargé). */
async function imprimer(commande) {
  try {
    await bonDeCommandePdf(await trouverCommande(commande.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// « DATA TABLE » : tri, pagination, PDF de la liste
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (c) => c.numero,
  date: (c) => c.dateCommande,
  fournisseur: (c) => c.fournisseur.raisonSociale,
  lignes: (c) => c.nombreLignes,
  montant: (c) => Number(c.montantTotal),
  reception: (c) => pourcentage(c),
  statut: (c) => STATUTS_COMMANDE[c.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(commandesAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const f = fournisseurs.value.find((x) => x.id === filtres.fournisseurId)
  return [
    f ? `Fournisseur : ${f.raisonSociale}` : 'Tous les fournisseurs',
    filtres.statut ? STATUTS_COMMANDE[filtres.statut].libelle : 'tous les statuts',
    filtres.du || filtres.au ? `du ${filtres.du ? formaterDate(filtres.du) : '…'} au ${filtres.au ? formaterDate(filtres.au) : '…'}` : '',
  ].filter(Boolean).join(' — ')
})

const COLONNES_PDF = [
  { titre: 'N° commande', valeur: (c) => c.numero },
  { titre: 'Date', valeur: (c) => formaterDate(c.dateCommande) },
  { titre: 'Fournisseur', valeur: (c) => c.fournisseur.raisonSociale },
  { titre: 'Lignes', valeur: (c) => c.nombreLignes, droite: true },
  { titre: 'Montant', valeur: (c) => formaterMontant(c.montantTotal), droite: true, somme: (c) => c.montantTotal, formatTotal: formaterMontant },
  { titre: 'Reçu', valeur: (c) => `${pourcentage(c)} %`, droite: true },
  { titre: 'Statut', valeur: (c) => STATUTS_COMMANDE[c.statut]?.libelle },
]

// Ouverture : listes du Paramétrage + commandes
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
.avancement { display: flex; align-items: center; gap: 0.4rem; min-width: 110px; }
.avancement-barre { flex: 1; height: 8px; border-radius: 999px; background: #eef0f2; overflow: hidden; }
.avancement-barre div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--primary)); }
.avancement small { font-size: 0.75rem; color: var(--muted); width: 36px; text-align: right; }

.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.section {
  margin: 0.25rem 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .col-medicament { min-width: 300px; }
.lignes input[type='number'] { width: 110px; text-align: right; }
.lignes .total { font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.complet { color: var(--primary-dark); font-weight: 700; }
textarea { width: 100%; resize: vertical; }
.receptions-liees { margin: 0; padding-left: 1.1rem; font-size: 0.88rem; }
.receptions-liees li { margin: 0.25rem 0; }
.receptions-liees .badge { margin-left: 0.4rem; }
</style>
