<!--
  =============================================================================
  FENÊTRE « RAPPORT CENTRE DE SANTÉ » (spec nov. 2026, §5)
  =============================================================================
  Présenté comme la fiche papier « RAPPORT COMMANDE MENSUEL RECOUVRABLES ».
  En-tête : région, district, établissement, service, code client, mois,
  niveaux de stock (Paramétrage > Paramètres généraux).
  À l'ouverture, tous les produits qui ont du stock au centre sont listés :
  on saisit comme un inventaire. Une ligne par produit :
    Stock initial (stock disponible du mois précédent / inventaire)   calculé
    Quantité reçue (factures du mois)                                 calculé
    Transferts (+ reçus, - cédés : section en bas)                    calculé
    Quantité utilisée                                                 SAISI
    Stock disponible = quantité restante comptée au centre            SAISI
                       (vide = stock théorique SI + R + T - utilisé)
    Perte / ajust. = SI + R + T - utilisé - restant                   calculé
    Jours de rupture (corrigent la consommation du mois)              SAISI
    CMM (consommations ajustées, 3 derniers mois)                     calculé
    Mois de stock disponible = stock disponible / CMM                 calculé
    Quantité à commander = max(0, N x CMM - stock disponible)         calculé
    Quantité accordée : celle de la FACTURE GÉNÉRÉE (lecture seule)
    Montant à verser = quantité utilisée x prix de vente              calculé
  Les calculs sont refaits EN DIRECT à l'écran, puis par le serveur.

  VALIDER : rapport verrouillé, stock du centre mis à jour, le stock
  disponible devient le stock initial du mois suivant. PAS de facture ici :
  elle se fait ensuite dans Facturation > « + Facture générée » (centre +
  mois), où le gestionnaire valide ou réduit les quantités à commander.
  ROUVRIR (administrateur, motif) : la facture générée est annulée.

  Propriété : rapportId. Événements : @fermer, @modifie (liste à recharger)
  =============================================================================
-->
<template>
  <FenetreModale :titre="titre" plein-ecran @fermer="emit('fermer')">
    <p v-if="!rapport" class="tableau-vide">Chargement…</p>
    <template v-else>
      <!-- Statut et blocages -->
      <div class="bandeau-statut">
        <span class="badge" :class="STATUTS_RAPPORT_CENTRE[rapport.statut]?.badge">{{ STATUTS_RAPPORT_CENTRE[rapport.statut]?.libelle }}</span>
        <small v-if="rapport.statut === 'VALIDE'">
          Validé le {{ formaterDate(rapport.dateValidation) }} par {{ nomPersonne(rapport.validateur) }} : non modifiable.
        </small>
        <small v-else>Brouillon : SI, R, T et les calculs se mettent à jour à chaque ouverture.</small>
      </div>
      <div v-if="rapport.statut === 'BROUILLON' && !rapport.peutValider" class="encart encart-info">
        <strong>Validation pas encore possible :</strong> {{ rapport.raisonBlocage }}
      </div>
      <div v-if="rapport.motifReouverture" class="encart encart-alerte">
        Rouvert le {{ formaterDate(rapport.dateReouverture) }} par {{ nomPersonne(rapport.reouvreur) }} — motif : {{ rapport.motifReouverture }}
      </div>
      <div v-if="rapport.facture" class="encart encart-ok">
        Facture générée : <strong>{{ rapport.facture.numero }}</strong> du {{ formaterDate(rapport.facture.dateEmission) }}
        ({{ formaterMontant(rapport.facture.montantTotal) }}) — à retrouver dans Facturation.
      </div>

      <!-- En-tête de la fiche (comme la fiche papier) -->
      <div class="entete-fiche">
        <div>
          <p><span>Région sanitaire :</span> <strong>{{ rapport.parametres.region || '—' }}</strong></p>
          <p><span>District sanitaire :</span> <strong>{{ rapport.parametres.district || '—' }}</strong></p>
          <p><span>Établissement sanitaire :</span> <strong>{{ rapport.centre.nom }}</strong></p>
          <p><span>Nom du service :</span> <strong>PHARMACIE</strong></p>
          <p><span>Code client :</span> <strong>{{ rapport.centre.code }}</strong></p>
        </div>
        <div>
          <p><span>Date :</span> <strong>{{ formaterDate(rapport.dateValidation || new Date()) }}</strong></p>
          <p><span>Mois de :</span> <strong>{{ libellePeriode(rapport.annee, rapport.mois).toUpperCase() }}</strong></p>
          <p><span>Rapport n° :</span> <strong>{{ rapport.numero }}</strong></p>
        </div>
        <div>
          <p><span>Niveau de stock maximum :</span> <strong>{{ formaterNombre(rapport.parametres.n) }} mois</strong></p>
          <p><span>Niveau de stock minimum :</span> <strong>{{ formaterNombre(rapport.parametres.moisStockMin) }} mois</strong></p>
          <p><span>Point de commande urgente :</span> <strong>{{ formaterNombre(rapport.parametres.moisCommandeUrgente) }} mois</strong></p>
          <p><span>Délai de réapprovisionnement :</span> <strong>{{ formaterNombre(rapport.parametres.delaiReappro) }} mois</strong></p>
        </div>
      </div>

      <!-- Grille du rapport -->
      <div class="barre-outils">
        <input v-model="recherche" class="recherche" type="search" placeholder="Filtrer les produits…" />
        <span class="espace"></span>
        <small class="detail">CMM sur {{ rapport.parametres.moisCmm }} mois · colonnes en vert : à saisir</small>
      </div>
      <div class="tableau-conteneur">
        <table class="tableau grille">
          <thead>
            <tr>
              <th>Code produit</th>
              <th>Désignation produit</th>
              <th>Unité</th>
              <th class="nombre" title="Stock disponible du mois précédent (ou inventaire initial)">Stock initial</th>
              <th class="nombre" title="Factures (sorties du district) du mois">Quantité reçue</th>
              <th v-if="avecTransferts" class="nombre" title="Transferts : + reçus d'un autre centre, - cédés">Transferts</th>
              <th class="nombre saisi" title="Quantité utilisée (consommée) dans le mois">Quantité utilisée</th>
              <th class="nombre saisi" title="Quantité restante comptée au centre (vide = stock théorique)">Stock disponible</th>
              <th class="nombre" title="Stock initial + reçu + transferts - utilisé - stock disponible (négatif = surplus)">Perte / Ajust.</th>
              <th class="nombre saisi" title="Nombre de jours de rupture dans le mois">Jours de rupture</th>
              <th class="nombre" title="Consommation mensuelle moyenne (corrigée des jours de rupture)">Consommation mensuelle</th>
              <th class="nombre" title="Stock disponible / CMM">Mois de stock dispo.</th>
              <th class="nombre" title="N x CMM - stock disponible (minimum 0)">Quantité à commander</th>
              <th class="nombre" title="Quantité servie par la facture générée (Facturation)">Quantité accordée</th>
              <th class="nombre" title="Quantité utilisée x prix de vente">Montant à verser</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lignesAffichees" :key="l.medicamentId">
              <td class="code">{{ l.medicament?.code }}</td>
              <td class="col-produit">{{ l.medicament?.designation || '—' }}</td>
              <td>{{ uniteDe(l) }}</td>
              <td class="nombre">{{ formaterNombre(l.stockInitial) }}</td>
              <td class="nombre">{{ formaterNombre(l.recu) }}</td>
              <td v-if="avecTransferts" class="nombre">{{ l.transferts > 0 ? '+' : '' }}{{ l.transferts }}</td>
              <td class="nombre saisi"><input v-model.number="l.consomme" type="number" min="0" step="1" :disabled="lectureSeule" /></td>
              <td class="nombre saisi">
                <input
                  v-model="l.stockRestant"
                  type="number"
                  min="0"
                  step="1"
                  :placeholder="String(calcul(l).theorique)"
                  :title="`Stock théorique : ${calcul(l).theorique}`"
                  :disabled="lectureSeule"
                  :class="{ 'champ-erreur': calcul(l).sdu < 0 }"
                />
              </td>
              <td class="nombre" :class="{ rouge: calcul(l).pertes > 0, bleu: calcul(l).pertes < 0 }">{{ calcul(l).pertes }}</td>
              <td class="nombre saisi"><input v-model.number="l.joursRupture" type="number" min="0" max="30" step="1" class="petit" :disabled="lectureSeule" /></td>
              <td class="nombre">{{ formaterNombre(calcul(l).cmm) }}</td>
              <td class="nombre">{{ calcul(l).moisStock === null ? '—' : formaterNombre(calcul(l).moisStock) }}</td>
              <td class="nombre">{{ calcul(l).qac }}</td>
              <td class="nombre">{{ l.quantiteAccordee === null || l.quantiteAccordee === undefined ? '—' : formaterNombre(l.quantiteAccordee) }}</td>
              <td class="nombre" :class="{ rouge: calcul(l).sansPrix }" :title="calcul(l).sansPrix ? 'Pas de prix de vente défini' : ''">
                {{ calcul(l).sansPrix ? 'sans prix' : formaterMontant(calcul(l).montant) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td :colspan="avecTransferts ? 13 : 12">
                <div v-if="!lectureSeule" class="ajout-produit">
                  <ListeDeroulante v-model="produitAAjouter" :options="produitsAjoutables" :champ-libelle="(m) => `${m.code} — ${m.designation}`" placeholder="+ Ajouter un produit…" />
                  <button type="button" class="bouton-secondaire" :disabled="!produitAAjouter || enregistrement" @click="ajouterProduit">Ajouter</button>
                </div>
              </td>
              <td class="nombre total" title="Total des quantités accordées">{{ rapport.facture ? formaterNombre(totalAccorde) : '' }}</td>
              <td class="nombre total" title="Total à verser par le centre">{{ formaterMontant(totalAVerser) }}</td>
            </tr>
          </tfoot>
        </table>
        <p v-if="rapport.lignes.length === 0" class="tableau-vide">Aucun produit en stock au centre : ajoutez les produits consommés.</p>
      </div>
      <p class="aide">
        Stock disponible : saisissez la quantité RESTANTE comptée au centre (laissé vide, le stock théorique est retenu).
        Perte / Ajust. en rouge = manquant, en bleu = surplus.
        Quantité accordée : remplie par la facture générée (Facturation &gt; « + Facture générée »), une fois le rapport validé.
      </p>
      <div class="total-verser">
        Montant à verser par le centre (quantités utilisées) : <strong>{{ formaterMontant(totalAVerser) }}</strong>
      </div>

      <!-- Transferts du mois -->
      <h4 class="section">Transferts entre centres ({{ libellePeriode(rapport.annee, rapport.mois) }})</h4>
      <table v-if="rapport.transferts.length" class="tableau lignes">
        <thead><tr><th>Sens</th><th>Centre</th><th>Produit</th><th class="nombre">Quantité</th><th>Motif</th><th v-if="!lectureSeule"></th></tr></thead>
        <tbody>
          <tr v-for="t in rapport.transferts" :key="t.id">
            <td>
              <span class="badge" :class="t.centreSource.id === rapport.centreId ? 'badge-orange' : 'badge-vert'">
                {{ t.centreSource.id === rapport.centreId ? 'Cédé' : 'Reçu' }}
              </span>
            </td>
            <td>{{ t.centreSource.id === rapport.centreId ? t.centreDestination.nom : t.centreSource.nom }}</td>
            <td>{{ t.medicament.designation }}</td>
            <td class="nombre">{{ t.quantite }}</td>
            <td>{{ t.motif || '' }}</td>
            <td v-if="!lectureSeule" class="actions">
              <button v-si-modif type="button" class="bouton-lien danger" @click="retirerTransfert(t)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="aide">Aucun transfert ce mois-ci.</p>
      <div v-if="!lectureSeule" v-si-modif class="ajout-transfert">
        <ListeDeroulante v-model="transfert.centreDestinationId" :options="autresCentres" champ-libelle="nom" placeholder="Céder à (centre)…" />
        <ListeDeroulante v-model="transfert.medicamentId" :options="medicamentsActifs" :champ-libelle="(m) => `${m.code} — ${m.designation}`" placeholder="Produit…" />
        <input v-model.number="transfert.quantite" type="number" min="1" step="1" placeholder="Qté" class="champ-qte" />
        <input v-model.trim="transfert.motif" maxlength="255" placeholder="Motif (facultatif)" />
        <button type="button" class="bouton-secondaire" :disabled="enregistrement" @click="ajouterUnTransfert">+ Céder</button>
      </div>

      <div class="observations">
        <label>Observations</label>
        <textarea v-model.trim="observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
      </div>
    </template>

    <template #pied>
      <button class="bouton-secondaire" type="button" @click="emit('fermer')">Fermer</button>
      <template v-if="rapport">
        <button v-si-imprimer type="button" class="bouton-secondaire" @click="imprimer">Rapport PDF</button>
        <button v-if="rapport.facture" v-si-imprimer type="button" class="bouton-secondaire" @click="imprimerFacture">
          Facture {{ rapport.facture.numero }} (PDF)
        </button>
        <template v-if="!lectureSeule">
          <button v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="supprimer">Supprimer le brouillon</button>
          <button v-si-modif type="button" class="bouton-secondaire" :disabled="enregistrement" @click="enregistrer(false)">Enregistrer</button>
          <button v-si-modif type="button" :disabled="enregistrement || !rapport.peutValider" :title="rapport.raisonBlocage || ''" @click="valider">
            Valider le rapport
          </button>
        </template>
        <button v-if="rapport.statut === 'VALIDE' && estAdmin" type="button" class="bouton-danger" :disabled="enregistrement" @click="rouvrir">
          Rouvrir (administrateur)
        </button>
      </template>
    </template>
  </FenetreModale>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { confirmer, demanderTexte } from '@/utils/alertes'
import { nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import {
  ajouterTransfert,
  enregistrerRapportCentre,
  rouvrirRapportCentre,
  supprimerRapportCentre,
  supprimerTransfert,
  trouverRapportCentre,
  validerRapportCentre,
} from '@/api/consommations'
import { trouverFacture } from '@/api/facturation'
import { facturePdf } from '@/views/facturation/financesCommun'
import { libellePeriode, rapportCentrePdf, STATUTS_RAPPORT_CENTRE } from './consommationsCommun'

const props = defineProps({ rapportId: { type: Number, required: true } })
const emit = defineEmits(['fermer', 'modifie'])
const store = useStore()

const rapport = ref(null)
const observations = ref('')
const recherche = ref('')
const enregistrement = ref(false)
const produitAAjouter = ref(null)
const transfert = reactive({ centreDestinationId: null, medicamentId: null, quantite: null, motif: '' })

const estAdmin = computed(() => store.getters['auth/role'] === 'ADMIN')
const lectureSeule = computed(() => rapport.value?.statut !== 'BROUILLON')
const titre = computed(() =>
  rapport.value ? `Rapport ${rapport.value.numero} — ${rapport.value.centre.nom} — ${libellePeriode(rapport.value.annee, rapport.value.mois)}` : 'Rapport centre',
)
const medicamentsActifs = computed(() => store.state.referentiel.medicaments.filter((m) => m.actif))
const autresCentres = computed(() => store.state.referentiel.centres.filter((c) => c.actif && c.id !== rapport.value?.centreId))
const produitsAjoutables = computed(() => {
  const presents = new Set((rapport.value?.lignes || []).map((l) => l.medicamentId))
  return medicamentsActifs.value.filter((m) => !presents.has(m.id))
})

const lignesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  const lignes = rapport.value?.lignes || []
  if (!texte) return lignes
  return lignes.filter((l) => `${l.medicament?.code} ${l.medicament?.designation}`.toLowerCase().includes(texte))
})

// ---------------------------------------------------------------------------
// CALCULS EN DIRECT (mêmes formules que le serveur)
// ---------------------------------------------------------------------------

const arrondi = (v) => Math.round(v * 100) / 100

/** true si la quantité restante a été saisie (sinon : stock théorique retenu). */
const restantSaisi = (l) => l.stockRestant !== null && l.stockRestant !== undefined && l.stockRestant !== ''

/** Consommation corrigée des jours de rupture : C x 30 / (30 - jours). */
function consommationAjustee(c, jours) {
  if (!jours || jours <= 0 || jours >= 30) return c
  return arrondi((c * 30) / (30 - jours))
}

/** Unité affichée : unité de vente (Boîte, Plaque...) sinon unité de dispensation. */
const uniteDe = (l) => l.medicament?.uniteVente?.libelle || l.medicament?.unite || ''

/**
 * Toutes les colonnes calculées d'une ligne, à partir des saisies :
 * stock théorique, stock disponible, perte/ajustement, CMM, mois de stock,
 * quantité à commander, montant à verser.
 */
function calcul(l) {
  const c = Number(l.consomme) || 0
  const theorique = l.stockInitial + l.recu + l.transferts - c
  const sdu = restantSaisi(l) ? Number(l.stockRestant) : theorique
  const pertes = theorique - sdu
  const historique = l.historique || []
  const conso = consommationAjustee(c, Number(l.joursRupture) || 0)
  const cmm = arrondi((conso + historique.reduce((s, x) => s + x, 0)) / (1 + historique.length))
  const moisStock = cmm > 0 ? arrondi(sdu / cmm) : null
  const qac = Math.max(0, Math.ceil(rapport.value.parametres.n * cmm - sdu))
  const sansPrix = c > 0 && (l.prixUnitaire === null || l.prixUnitaire === undefined)
  const montant = arrondi(c * (Number(l.prixUnitaire) || 0))
  return { theorique, sdu, pertes, cmm, moisStock, qac, montant, sansPrix }
}
const totalAccorde = computed(() => (rapport.value?.lignes || []).reduce((t, l) => t + (l.quantiteAccordee || 0), 0))
const totalAVerser = computed(() => arrondi((rapport.value?.lignes || []).reduce((t, l) => t + calcul(l).montant, 0)))
/** Colonne « Transferts » affichée seulement s'il y en a ce mois-ci. */
const avecTransferts = computed(() => (rapport.value?.lignes || []).some((l) => l.transferts !== 0))

/** Ajoute un produit, puis enregistre : le serveur renvoie son prix et le stock du district. */
async function ajouterProduit() {
  const m = medicamentsActifs.value.find((x) => x.id === produitAAjouter.value)
  if (!m) return
  rapport.value.lignes.push({
    medicamentId: m.id,
    medicament: { code: m.code, designation: m.designation, unite: m.unite, uniteVente: m.uniteVente },
    stockInitial: 0,
    recu: 0,
    transferts: 0,
    consomme: 0,
    stockRestant: null,
    joursRupture: 0,
    historique: [],
    prixUnitaire: null,
  })
  produitAAjouter.value = null
  await enregistrer(true)
}

// ---------------------------------------------------------------------------
// CHARGEMENT / ENREGISTREMENT
// ---------------------------------------------------------------------------

async function charger() {
  try {
    rapport.value = await trouverRapportCentre(props.rapportId)
    observations.value = rapport.value.observations || ''
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Données envoyées au serveur (saisies seulement : tout le reste est recalculé). */
function donnees() {
  return {
    observations: observations.value,
    lignes: rapport.value.lignes.map((l) => ({
      medicamentId: l.medicamentId,
      consomme: Number(l.consomme) || 0,
      stockRestant: restantSaisi(l) ? Number(l.stockRestant) : null,
      joursRupture: Number(l.joursRupture) || 0,
    })),
  }
}

/** Contrôle des saisies : entiers positifs ; jours de rupture entre 0 et 30. */
function saisiesValides() {
  const entierPositif = (v) => Number.isInteger(Number(v)) && Number(v) >= 0
  for (const l of rapport.value.lignes) {
    const nom = l.medicament?.designation
    if (!entierPositif(l.consomme || 0)) return erreurSaisie(`${nom} : la quantité utilisée doit être un nombre entier positif.`)
    if (restantSaisi(l) && !entierPositif(l.stockRestant)) return erreurSaisie(`${nom} : le stock disponible doit être un nombre entier positif.`)
    if (!entierPositif(l.joursRupture || 0) || Number(l.joursRupture) > 30) return erreurSaisie(`${nom} : les jours de rupture vont de 0 à 30.`)
  }
  return true
}
function erreurSaisie(message) {
  store.dispatch('notifications/erreur', message)
  return false
}

/** Enregistre le brouillon (silencieux = sans message, avant une autre action). */
async function enregistrer(silencieux) {
  if (!saisiesValides()) return false
  enregistrement.value = true
  try {
    rapport.value = await enregistrerRapportCentre(rapport.value.id, donnees())
    if (!silencieux) store.dispatch('notifications/succes', 'Rapport enregistré (brouillon).')
    emit('modifie')
    return true
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
    return false
  } finally {
    enregistrement.value = false
  }
}

async function valider() {
  if (!saisiesValides()) return
  const negatif = rapport.value.lignes.find((l) => calcul(l).sdu < 0)
  if (negatif) {
    return store.dispatch('notifications/erreur', `${negatif.medicament?.designation} : le stock disponible serait négatif : saisissez la quantité restante.`)
  }
  const nbNonComptes = rapport.value.lignes.filter((l) => !restantSaisi(l)).length
  const confirme = await confirmer({
    titre: `Valider le rapport de ${libellePeriode(rapport.value.annee, rapport.value.mois)} ?`,
    texte:
      `Le rapport sera verrouillé et le stock du centre mis à jour. Montant à verser : ${formaterMontant(totalAVerser.value)}. ` +
      (nbNonComptes > 0 ? `Attention : ${nbNonComptes} produit(s) sans stock disponible saisi (le stock théorique sera retenu). ` : '') +
      'Pour servir le centre, faites ensuite la facture dans Facturation > « + Facture générée ».',
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    rapport.value = await validerRapportCentre(rapport.value.id, donnees())
    store.dispatch('notifications/succes', 'Rapport validé. Facture à faire dans Facturation > « + Facture générée ».')
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function rouvrir() {
  const motif = await demanderTexte({
    titre: `Rouvrir le rapport ${rapport.value.numero} ?`,
    texte: 'Le rapport repasse en brouillon, le stock du centre est rétabli et la facture générée est ANNULÉE (le stock revient au district).',
    libelle: 'Motif de la réouverture',
    boutonConfirmer: 'Rouvrir',
  })
  if (motif === null) return
  enregistrement.value = true
  try {
    rapport.value = await rouvrirRapportCentre(rapport.value.id, motif)
    store.dispatch('notifications/succes', 'Rapport rouvert.')
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function supprimer() {
  const confirme = await confirmer({
    titre: `Supprimer le brouillon ${rapport.value.numero} ?`,
    texte: 'Les saisies de ce rapport seront perdues (les transferts du mois sont conservés).',
    boutonConfirmer: 'Oui, supprimer',
    danger: true,
  })
  if (!confirme) return
  try {
    await supprimerRapportCentre(rapport.value.id)
    store.dispatch('notifications/succes', 'Brouillon supprimé.')
    emit('modifie')
    emit('fermer')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// TRANSFERTS (les saisies sont enregistrées avant, pour ne pas les perdre)
// ---------------------------------------------------------------------------

async function ajouterUnTransfert() {
  if (!transfert.centreDestinationId || !transfert.medicamentId || !(transfert.quantite >= 1)) {
    return store.dispatch('notifications/erreur', 'Choisissez le centre, le produit et une quantité (au moins 1).')
  }
  if (!(await enregistrer(true))) return
  try {
    await ajouterTransfert(rapport.value.id, { ...transfert, quantite: Number(transfert.quantite), motif: transfert.motif || undefined })
    Object.assign(transfert, { centreDestinationId: null, medicamentId: null, quantite: null, motif: '' })
    store.dispatch('notifications/succes', 'Transfert enregistré.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function retirerTransfert(t) {
  const confirme = await confirmer({ titre: 'Supprimer ce transfert ?', texte: `${t.quantite} ${t.medicament.designation}`, boutonConfirmer: 'Oui, supprimer', danger: true })
  if (!confirme) return
  if (!(await enregistrer(true))) return
  try {
    await supprimerTransfert(t.id)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/** Facture générée par le rapport : à imprimer pour servir le centre au magasin. */
async function imprimerFacture() {
  try {
    await facturePdf(await trouverFacture(rapport.value.facture.id))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function imprimer() {
  try {
    await rapportCentrePdf(rapport.value, (l) => calcul(l))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
.bandeau-statut small { color: var(--muted); }
.encart { margin-bottom: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.88rem; }
.encart-info { background: #e3eefc; color: #1d4f91; }
.encart-alerte { background: #fff4e5; color: #8a4b00; }
.encart-ok { background: var(--primary-light); color: var(--primary-dark); }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.aide { font-size: 0.8rem; color: var(--muted); margin: 0.4rem 0 0.8rem; }
.grille th, .grille td { padding: 0.4rem 0.35rem; }
.grille .col-produit { min-width: 200px; }
.grille th { font-size: 0.72rem; line-height: 1.15; vertical-align: bottom; }
.grille td.saisi input.petit { width: 52px; }
.bleu { color: #1d4f91; }
.entete-fiche { display: grid; grid-template-columns: 1.3fr 1fr 1.2fr; gap: 0.4rem 1.5rem; margin-bottom: 0.9rem; padding: 0.7rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: #fafcfb; font-size: 0.85rem; }
.entete-fiche p { margin: 0.15rem 0; }
.entete-fiche span { color: var(--muted); }
.total-verser { margin: 0.2rem 0 0.8rem; padding: 0.55rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.92rem; }
.grille th.saisi { background: var(--primary-light); }
.grille td.saisi input { width: 70px; text-align: right; }
.grille input.champ-erreur { border-color: var(--danger); }
.grille .total { font-weight: 800; color: var(--primary-dark); }
.grille tfoot td { border-bottom: none; }
.rouge { color: var(--danger); }
.ajout-produit { display: flex; gap: 0.5rem; align-items: center; max-width: 520px; }
.ajout-produit > :first-child { flex: 1; }
.section { margin: 1rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.ajout-transfert { display: grid; grid-template-columns: 1.2fr 1.6fr 80px 1.2fr auto; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
.champ-qte { text-align: right; }
.observations { margin-top: 1rem; }
.observations textarea { width: 100%; resize: vertical; }
@media (max-width: 1000px) { .ajout-transfert { grid-template-columns: 1fr 1fr; } }
</style>
