<!--
  =============================================================================
  ONGLET « COMMANDES DES CENTRES »
  =============================================================================
  Demandes de médicaments des centres de santé (cahier des charges §3.4).
  - Saisie : centre, date, médicaments et quantités DEMANDÉES. La colonne
    « Disponible au dépôt » montre le stock utilisable (lots non périmés,
    préparations en cours déduites) : vérification des disponibilités.
  - Validation : quantité ACCORDÉE par ligne (proposée : le minimum entre la
    demande et le disponible).
  - Ensuite : « Préparer la livraison » (onglet Bons de livraison, pré-rempli
    avec le reste à livrer). Avancement de la livraison visible dans la liste.
  Brouillon (modifiable) -> Validée -> Partiellement livrée -> Livrée ; Annulée.

  Événement : @preparer(commande) -> la page ouvre l'onglet Bons de livraison
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (n°, centre)…" />
      <div class="filtre">
        <ListeDeroulante v-model="filtres.centreId" :options="centres" champ-libelle="nom" placeholder="Tous les centres" />
      </div>
      <div class="filtre">
        <ListeDeroulante v-model="filtres.statut" :options="optionsStatuts(STATUTS_COMMANDE_CENTRE)" placeholder="Tous les statuts" />
      </div>
      <div class="periode">
        <input v-model="filtres.du" type="date" title="Du" />
        <span>au</span>
        <input v-model="filtres.au" type="date" title="Au" />
      </div>
      <span class="espace"></span>
      <ImportExportTableau titre="Commandes des centres" :sous-titre="sousTitrePdf" nom-fichier="commandes_centres" :colonnes-pdf="COLONNES_PDF" :lignes="lignesTriees" />
      <button v-si-modif @click="ouvrir()">+ Nouvelle commande</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="numero">N° commande</ColonneTri>
            <ColonneTri v-model="tri" cle="date">Date</ColonneTri>
            <ColonneTri v-model="tri" cle="centre">Centre</ColonneTri>
            <ColonneTri v-model="tri" cle="lignes" class="nombre">Lignes</ColonneTri>
            <ColonneTri v-model="tri" cle="demande" class="nombre">Demandé</ColonneTri>
            <ColonneTri v-model="tri" cle="accorde" class="nombre">Accordé</ColonneTri>
            <ColonneTri v-model="tri" cle="livre">Livraison</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in lignesPage" :key="c.id">
            <td class="code">{{ c.numero }}</td>
            <td>{{ formaterDate(c.dateCommande) }}</td>
            <td><strong>{{ c.centre.nom }}</strong></td>
            <td class="nombre">{{ c.nombreLignes }}</td>
            <td class="nombre">{{ formaterNombre(c.quantiteDemandee) }}</td>
            <td class="nombre">{{ c.statut === 'BROUILLON' ? '—' : formaterNombre(c.quantiteAccordee) }}</td>
            <td>
              <div v-if="c.statut !== 'BROUILLON' && c.statut !== 'ANNULEE'" class="avancement" :title="`${c.quantiteLivree} / ${c.quantiteAccordee} livré(s)`">
                <div class="avancement-barre"><div :style="{ width: pourcentage(c) + '%' }"></div></div>
                <small>{{ pourcentage(c) }} %</small>
              </div>
              <span v-else class="detail">—</span>
            </td>
            <td><span class="badge" :class="STATUTS_COMMANDE_CENTRE[c.statut]?.badge">{{ STATUTS_COMMANDE_CENTRE[c.statut]?.libelle }}</span></td>
            <td class="actions">
              <button class="bouton-lien" @click="ouvrir(c)">{{ c.statut === 'BROUILLON' ? 'Ouvrir' : 'Voir' }}</button>
              <button v-if="aLivrer(c)" v-si-modif class="bouton-lien" @click="preparer(c)">Préparer la livraison</button>
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
    <FenetreModale v-if="formulaire" :titre="formulaire.id ? `Commande ${formulaire.numero}` : 'Nouvelle commande d\'un centre'" tres-large @fermer="formulaire = null">
      <div v-if="formulaire.id" class="bandeau-statut">
        <span class="badge" :class="STATUTS_COMMANDE_CENTRE[formulaire.statut]?.badge">{{ STATUTS_COMMANDE_CENTRE[formulaire.statut]?.libelle }}</span>
        <small v-if="formulaire.statut === 'BROUILLON'">
          Brouillon : modifiable. « Valider » fixe les quantités ACCORDÉES (colonne « Accordé »).
        </small>
      </div>

      <form id="form-commande-centre" class="grille-formulaire" @submit.prevent="enregistrer(false)">
        <div>
          <label class="obligatoire">Centre de santé</label>
          <ListeDeroulante v-model="formulaire.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" :desactive="lectureSeule" />
        </div>
        <div>
          <label class="obligatoire">Date de la commande</label>
          <input v-model="formulaire.dateCommande" type="date" required :disabled="lectureSeule" />
        </div>

        <div class="pleine-largeur">
          <h4 class="section">Médicaments demandés</h4>
          <table class="tableau lignes">
            <thead>
              <tr>
                <th>Médicament</th>
                <th class="nombre">Demandé</th>
                <th class="nombre">Disponible au dépôt</th>
                <th v-if="formulaire.id" class="nombre">Accordé</th>
                <th v-if="formulaire.id && formulaire.statut !== 'BROUILLON'" class="nombre">Livré</th>
                <th v-if="!lectureSeule"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ligne, index) in formulaire.lignes" :key="index" :class="{ insuffisant: disponible(ligne) < (ligne.quantiteDemandee || 0) }">
                <td class="col-medicament">
                  <ListeDeroulante
                    v-if="!lectureSeule"
                    v-model="ligne.medicamentId"
                    :options="optionsParLigne[index]"
                    :champ-libelle="(m) => `${m.code} — ${m.designation} (dispo : ${formaterNombre(dispoTous[m.id] ?? 0)})`"
                    placeholder="Choisir…"
                  />
                  <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                  <small v-if="uniteDe(ligne.medicamentId)" class="detail">par {{ uniteDe(ligne.medicamentId) }}</small>
                </td>
                <td class="nombre">
                  <input v-model.number="ligne.quantiteDemandee" type="number" min="1" step="1" required :disabled="lectureSeule" :class="{ 'saisie-erreur': depasse(ligne) }" />
                  <small v-if="depasse(ligne)" class="message-erreur">Dépasse le disponible ({{ formaterNombre(disponible(ligne)) }})</small>
                </td>
                <td class="nombre">
                  <strong :class="disponible(ligne) < (ligne.quantiteDemandee || 0) ? 'manque' : 'suffisant'">{{ ligne.medicamentId ? formaterNombre(disponible(ligne)) : '—' }}</strong>
                </td>
                <td v-if="formulaire.id" class="nombre">
                  <input v-if="formulaire.statut === 'BROUILLON'" v-model.number="ligne.quantiteAccordee" type="number" min="0" :max="ligne.quantiteDemandee" step="1" />
                  <strong v-else>{{ formaterNombre(ligne.quantiteAccordee) }}</strong>
                </td>
                <td v-if="formulaire.id && formulaire.statut !== 'BROUILLON'" class="nombre">{{ formaterNombre(ligne.quantiteLivree) }}</td>
                <td v-if="!lectureSeule" class="actions">
                  <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
          <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="formulaire.lignes.push(nouvelleLigne())">+ Ajouter un médicament</button>
          <p v-if="!lectureSeule && lignesEnDepassement.length" class="bandeau-erreur">
            {{ lignesEnDepassement.length }} ligne(s) demandent plus que le disponible au dépôt : réduisez la quantité pour pouvoir enregistrer.
          </p>
        </div>

        <div class="pleine-largeur">
          <label>Observations</label>
          <textarea v-model.trim="formulaire.observations" rows="2" maxlength="2000" :disabled="lectureSeule"></textarea>
        </div>

        <div v-if="formulaire.livraisons?.length" class="pleine-largeur">
          <h4 class="section">Livraisons</h4>
          <ul class="liste-liee">
            <li v-for="l in formulaire.livraisons" :key="l.id">
              <span class="code">{{ l.numero }}</span> du {{ formaterDate(l.dateLivraison) }} — {{ formaterMontant(l.montantTotal) }}
              <span class="badge" :class="STATUTS_LIVRAISON[l.statut]?.badge">{{ STATUTS_LIVRAISON[l.statut]?.libelle }}</span>
            </li>
          </ul>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button v-if="formulaire.id" type="button" class="bouton-secondaire" @click="docPieces = formulaire">Pièces jointes</button>
        <template v-if="!formulaire.id || formulaire.statut === 'BROUILLON'">
          <button v-if="formulaire.id" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler la commande</button>
          <button v-si-modif type="submit" form="form-commande-centre" class="bouton-secondaire" :disabled="enregistrement">Enregistrer le brouillon</button>
          <button v-if="formulaire.id" v-si-modif type="button" :disabled="enregistrement" @click="valider">Valider (quantités accordées)</button>
          <button v-else v-si-modif type="button" :disabled="enregistrement" @click="enregistrer(true)">Enregistrer et accorder</button>
        </template>
        <template v-else-if="aLivrer(formulaire)">
          <button v-if="formulaire.statut === 'VALIDEE'" v-si-modif type="button" class="bouton-danger" :disabled="enregistrement" @click="annuler">Annuler la commande</button>
          <button v-si-modif type="button" @click="preparer(formulaire)">Préparer la livraison</button>
        </template>
      </template>
    </FenetreModale>

    <PiecesJointes v-if="docPieces" module="livraisons" type="CommandeCentre" :id="docPieces.id" :titre="`Pièces de la commande ${docPieces.numero}`" @fermer="docPieces = null" />
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
import { dateDuJour, formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import {
  annulerCommandeCentre,
  creerCommandeCentre,
  listerCommandesCentre,
  medicamentsDisponibles,
  modifierCommandeCentre,
  trouverCommandeCentre,
  validerCommandeCentre,
} from '@/api/livraisons'
import { optionsStatuts, STATUTS_COMMANDE_CENTRE, STATUTS_LIVRAISON } from './livraisonsCommun'

const emit = defineEmits(['preparer'])
const store = useStore()

const commandes = ref([])
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
const filtres = reactive({ centreId: null, statut: null, du: '', au: '' })
const formulaire = ref(null)
const dispo = ref({}) // { [medicamentId]: quantité disponible au dépôt }
const docPieces = ref(null)

const centres = computed(() => store.state.referentiel.centres)
const centresActifs = computed(() => centres.value.filter((c) => c.actif || c.id === formulaire.value?.centreId))
const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

// Médicaments proposés dans la liste : seulement ceux DISPONIBLES au dépôt
// (quantité > 0 sur des lots non périmés, préparations en cours déduites)
const dispoTous = ref({}) // { [medicamentId]: quantité disponible }
async function chargerMedicamentsDisponibles() {
  try {
    dispoTous.value = await medicamentsDisponibles()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}
/**
 * Options de chaque ligne : médicaments disponibles non encore choisis sur une autre
 * ligne (+ celui déjà choisi sur la ligne, affiché même s'il n'est plus disponible).
 * Calculé une seule fois (computed) : recalculé seulement quand les lignes changent.
 */
const medicamentsDispo = computed(() => medicamentsActifs.value.filter((m) => (dispoTous.value[m.id] ?? 0) > 0))
const optionsParLigne = computed(() => {
  const lignes = formulaire.value?.lignes || []
  return lignes.map((ligne) => {
    const dejaChoisis = new Set(lignes.filter((l) => l !== ligne).map((l) => l.medicamentId))
    const options = medicamentsDispo.value.filter((m) => !dejaChoisis.has(m.id))
    // Médicament déjà choisi mais plus disponible (brouillon ancien) : on le garde dans la liste
    if (ligne.medicamentId && !options.some((m) => m.id === ligne.medicamentId)) {
      const choisi = medicaments.value.find((m) => m.id === ligne.medicamentId)
      if (choisi) options.unshift(choisi)
    }
    return options
  })
})
const lectureSeule = computed(() => !!formulaire.value?.id && formulaire.value.statut !== 'BROUILLON')

const commandesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  if (!texte) return commandes.value
  return commandes.value.filter((c) => [c.numero, c.centre.nom].some((v) => (v || '').toLowerCase().includes(texte)))
})

const aLivrer = (c) => c.statut === 'VALIDEE' || c.statut === 'PARTIELLEMENT_LIVREE'
function pourcentage(c) {
  return c.quantiteAccordee ? Math.min(100, Math.round((c.quantiteLivree / c.quantiteAccordee) * 100)) : 0
}

async function charger() {
  chargement.value = true
  try {
    commandes.value = await listerCommandesCentre(filtres)
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
function nouvelleLigne() {
  return { medicamentId: null, quantiteDemandee: 1 }
}

async function ouvrir(commande = null) {
  chargerMedicamentsDisponibles()
  if (!commande) {
    formulaire.value = { centreId: null, dateCommande: dateDuJour(), observations: '', lignes: [nouvelleLigne()] }
    dispo.value = {}
    return
  }
  try {
    const c = await trouverCommandeCentre(commande.id)
    formulaire.value = {
      ...c,
      dateCommande: c.dateCommande.substring(0, 10),
      observations: c.observations || '',
      lignes: c.lignes.map((l) => ({
        ligneId: l.id,
        medicamentId: l.medicamentId,
        quantiteDemandee: l.quantiteDemandee,
        // Brouillon : accordé proposé = minimum entre demandé et disponible
        quantiteAccordee: l.quantiteAccordee ?? Math.max(0, Math.min(l.quantiteDemandee, l.disponible)),
        quantiteLivree: l.quantiteLivree,
      })),
    }
    dispo.value = Object.fromEntries(c.lignes.map((l) => [l.medicamentId, l.disponible]))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

/**
 * Disponible au dépôt pour une ligne : valeur de la commande ouverte si connue,
 * sinon celle chargée à l'ouverture du formulaire (aucun appel au serveur
 * quand on change de médicament : pas de clignotement).
 */
function disponible(ligne) {
  return Math.max(0, dispo.value[ligne.medicamentId] ?? dispoTous.value[ligne.medicamentId] ?? 0)
}
/** Vrai si la quantité demandée dépasse le disponible au dépôt (enregistrement refusé). */
function depasse(ligne) {
  return !lectureSeule.value && !!ligne.medicamentId && (Number(ligne.quantiteDemandee) || 0) > disponible(ligne)
}
const lignesEnDepassement = computed(() => (formulaire.value?.lignes || []).filter(depasse))

function libelleMedicament(id) {
  const m = medicaments.value.find((x) => x.id === id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function uniteDe(id) {
  return medicaments.value.find((x) => x.id === id)?.uniteVente?.libelle?.toLowerCase() || ''
}

function donnees() {
  const f = formulaire.value
  return {
    centreId: f.centreId,
    dateCommande: f.dateCommande,
    observations: f.observations || undefined,
    lignes: f.lignes.filter((l) => l.medicamentId).map((l) => ({ medicamentId: l.medicamentId, quantiteDemandee: Number(l.quantiteDemandee) })),
  }
}

/** Enregistre le brouillon ; « accorder » = rouvre la commande pour saisir les quantités accordées. */
async function enregistrer(accorder) {
  const f = formulaire.value
  if (!f.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  const d = donnees()
  if (d.lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un médicament.')
  if (lignesEnDepassement.value.length) {
    const detail = lignesEnDepassement.value
      .map((l) => `${libelleMedicament(l.medicamentId)} : ${l.quantiteDemandee} demandé(s), ${disponible(l)} disponible(s)`)
      .join(' ; ')
    return store.dispatch('notifications/erreur', `Quantité demandée supérieure au disponible au dépôt — ${detail}.`)
  }
  enregistrement.value = true
  try {
    const commande = f.id ? await modifierCommandeCentre(f.id, d) : await creerCommandeCentre(d)
    store.dispatch(
      'notifications/succes',
      accorder ? `Commande ${commande.numero} enregistrée : vérifiez les quantités accordées puis validez.` : `Commande ${commande.numero} enregistrée (brouillon).`,
    )
    await ouvrir(commande)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

/** Validation : enregistre d'abord les modifications, puis fixe les quantités accordées. */
async function valider() {
  const f = formulaire.value
  if (lignesEnDepassement.value.length) {
    return store.dispatch('notifications/erreur', 'Une ou plusieurs quantités demandées dépassent le disponible au dépôt : corrigez-les avant de valider.')
  }
  const insuffisants = f.lignes.filter((l) => (l.quantiteAccordee || 0) > disponible(l))
  const confirme = await confirmer({
    titre: `Valider la commande ${f.numero} ?`,
    texte: insuffisants.length
      ? `Attention : ${insuffisants.length} ligne(s) accordée(s) au-delà du disponible au dépôt (elles ne pourront être livrées qu'après réception). Les quantités accordées ne seront plus modifiables.`
      : 'Les quantités accordées ne seront plus modifiables. La commande pourra ensuite être livrée.',
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return
  enregistrement.value = true
  try {
    await modifierCommandeCentre(f.id, donnees())
    const recharge = await trouverCommandeCentre(f.id)
    // Lignes rechargées (identifiants recréés) : accordé repris par médicament
    const accords = recharge.lignes.map((l) => ({
      ligneId: l.id,
      quantiteAccordee: Number(f.lignes.find((x) => x.medicamentId === l.medicamentId)?.quantiteAccordee ?? l.quantiteDemandee) || 0,
    }))
    const commande = await validerCommandeCentre(f.id, accords)
    store.dispatch('notifications/succes', `Commande ${commande.numero} validée.`)
    await ouvrir(commande)
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function annuler() {
  const f = formulaire.value
  const confirme = await confirmer({ titre: `Annuler la commande ${f.numero} ?`, texte: 'Elle restera dans l\'historique avec le statut « Annulée ».', boutonConfirmer: 'Oui, annuler', danger: true })
  if (!confirme) return
  enregistrement.value = true
  try {
    await ouvrir(await annulerCommandeCentre(f.id))
    store.dispatch('notifications/succes', 'Commande annulée.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

function preparer(commande) {
  formulaire.value = null
  emit('preparer', commande)
}

// ---------------------------------------------------------------------------
// « DATA TABLE »
// ---------------------------------------------------------------------------
const VALEURS_TRI = {
  numero: (c) => c.numero,
  date: (c) => c.dateCommande,
  centre: (c) => c.centre.nom,
  lignes: (c) => c.nombreLignes,
  demande: (c) => c.quantiteDemandee,
  accorde: (c) => c.quantiteAccordee,
  livre: (c) => pourcentage(c),
  statut: (c) => STATUTS_COMMANDE_CENTRE[c.statut]?.libelle,
}
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(commandesAffichees, [recherche], VALEURS_TRI)

const sousTitrePdf = computed(() => {
  const c = centres.value.find((x) => x.id === filtres.centreId)
  return [c ? `Centre : ${c.nom}` : 'Tous les centres', filtres.statut ? STATUTS_COMMANDE_CENTRE[filtres.statut].libelle : 'tous les statuts'].join(' — ')
})
const COLONNES_PDF = [
  { titre: 'N° commande', valeur: (c) => c.numero },
  { titre: 'Date', valeur: (c) => formaterDate(c.dateCommande) },
  { titre: 'Centre', valeur: (c) => c.centre.nom },
  { titre: 'Demandé', valeur: (c) => formaterNombre(c.quantiteDemandee), droite: true, somme: (c) => c.quantiteDemandee },
  { titre: 'Accordé', valeur: (c) => formaterNombre(c.quantiteAccordee), droite: true, somme: (c) => c.quantiteAccordee },
  { titre: 'Livré', valeur: (c) => formaterNombre(c.quantiteLivree), droite: true, somme: (c) => c.quantiteLivree },
  { titre: 'Statut', valeur: (c) => STATUTS_COMMANDE_CENTRE[c.statut]?.libelle },
]

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  charger()
})
</script>

<style scoped>
.periode { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--muted); }
.periode input { width: 150px; }
.detail { display: block; font-size: 0.75rem; color: var(--muted); }
.avancement { display: flex; align-items: center; gap: 0.4rem; min-width: 110px; }
.avancement-barre { flex: 1; height: 8px; border-radius: 999px; background: #eef0f2; overflow: hidden; }
.avancement-barre div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--primary)); }
.avancement small { font-size: 0.75rem; color: var(--muted); width: 36px; text-align: right; }
.bandeau-statut { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.bandeau-statut small { color: var(--muted); }
.section { margin: 0.25rem 0 0.5rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
.lignes td { padding: 0.45rem 0.5rem; }
.lignes .col-medicament { min-width: 320px; }
.lignes input[type='number'] { width: 100px; text-align: right; }
.manque { color: var(--danger); }
.suffisant { color: var(--primary-dark); }
tr.insuffisant td { background: #fff4f4; }
.saisie-erreur { border-color: var(--danger) !important; }
.message-erreur { display: block; margin-top: 0.2rem; font-size: 0.72rem; color: var(--danger); white-space: nowrap; }
.bandeau-erreur { margin: 0.5rem 0 0; padding: 0.5rem 0.75rem; border-radius: 8px; background: #fdecec; color: var(--danger); font-size: 0.85rem; font-weight: 600; }
textarea { width: 100%; resize: vertical; }
.liste-liee { margin: 0; padding-left: 1.1rem; font-size: 0.88rem; }
.liste-liee .badge { margin-left: 0.4rem; }
</style>
