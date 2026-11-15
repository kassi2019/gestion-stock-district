<!--
  =============================================================================
  ONGLET « MÉDICAMENTS » (catalogue)
  =============================================================================
  - Liste avec recherche, filtre par famille et option "afficher les inactifs" ;
  - Affiche le prix de vente (par unité de vente : boîte ou plaque), le prix
    d'achat ACTUELS et le STOCK du dépôt de chaque médicament ;
  - Le formulaire contient aussi :
      * l'UNITÉ DE VENTE (Boîte / Plaque) : le prix de vente s'applique à cette unité ;
      * le PRIX DE VENTE : enregistré dans l'historique des prix (onglet Prix)
        à la date du jour ; un nouveau prix n'est créé que s'il a changé ;
  - L'IMPORT Excel remplit en une fois : médicaments + prix de vente + prix
    d'achat (par fournisseur si la colonne « Fournisseur » est remplie)
    (+ familles, formes, unités de vente et fournisseurs manquants) ;
      * CONSOMMABLE (oui / non) : un consommable n'est pas facturé en caisse ;
      * le STOCK : saisi à la création (stock initial du dépôt, avec n° de lot
        si suivi par lot), puis seulement AFFICHÉ (il change ensuite par les
        réceptions, livraisons et inventaires).
  - Bouton "Prix" : ouvre l'onglet Prix sur ce médicament (événement "voir-prix") ;
  - Même logique que l'onglet Centres pour créer / modifier / désactiver.
  =============================================================================
-->
<template>
  <div>
    <div class="barre-outils">
      <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher (code, désignation)…" />
      <div class="filtre">
        <ListeDeroulante v-model="familleFiltre" :options="familles" placeholder="Toutes les familles" />
      </div>
      <label class="case-a-cocher">
        <input v-model="afficherInactifs" type="checkbox" /> Afficher les inactifs
      </label>
      <span class="espace"></span>
      <!-- Boutons « Importer » (fichier Excel/CSV) et « PDF » -->
      <ImportExportTableau
        titre="Catalogue des médicaments"
        :sous-titre="sousTitrePdf"
        nom-fichier="medicaments"
        :colonnes-pdf="COLONNES_PDF"
        :lignes="lignesTriees"
        :colonnes-import="COLONNES_IMPORT"
        :importer-ligne="importerLigne"
        @importe="charger"
      />
      <button v-si-modif @click="ouvrirFormulaire()">+ Nouveau médicament</button>
    </div>

    <div class="tableau-conteneur">
      <table class="tableau">
        <thead>
          <tr>
            <ColonneTri v-model="tri" cle="code">Code</ColonneTri>
            <ColonneTri v-model="tri" cle="designation">Désignation</ColonneTri>
            <ColonneTri v-model="tri" cle="forme">Forme / dosage</ColonneTri>
            <ColonneTri v-model="tri" cle="unite">Unité</ColonneTri>
            <ColonneTri v-model="tri" cle="famille">Famille</ColonneTri>
            <ColonneTri v-model="tri" cle="seuil" class="nombre">Seuil</ColonneTri>
            <ColonneTri v-model="tri" cle="prixVente" class="nombre">Prix de vente</ColonneTri>
            <ColonneTri v-model="tri" cle="prixAchat" class="nombre">Prix d'achat</ColonneTri>
            <ColonneTri v-model="tri" cle="stock" class="nombre">Stock</ColonneTri>
            <ColonneTri v-model="tri" cle="statut">Statut</ColonneTri>
            <th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="med in lignesPage" :key="med.id" :class="{ 'ligne-inactive': !med.actif }">
            <td class="code">{{ med.code }}</td>
            <td>
              <strong>{{ med.designation }}</strong>
              <span v-if="med.consommable" class="badge badge-orange">Consommable</span>
              <div v-if="med.conditionnement" class="detail">{{ med.conditionnement }}</div>
            </td>
            <td>{{ [med.forme?.libelle, med.dosage].filter(Boolean).join(' · ') || '—' }}</td>
            <td>{{ med.unite }}</td>
            <td>{{ med.famille?.libelle || '—' }}</td>
            <td class="nombre">{{ formaterNombre(med.seuilAlerte) }}</td>
            <td class="nombre">
              <span v-if="med.prixVenteActuel !== null">
                {{ formaterMontant(med.prixVenteActuel) }}
                <div class="detail">par {{ libelleUniteVente(med.uniteVenteId).toLowerCase() }}</div>
              </span>
              <span v-else class="badge badge-rouge">Non défini</span>
            </td>
            <td class="nombre">{{ formaterMontant(med.prixAchatActuel) }}</td>
            <td class="nombre">
              <!-- Stock en rouge s'il est sous le seuil d'alerte -->
              <strong :class="{ 'stock-bas': med.stockActuel <= med.seuilAlerte }">{{ formaterNombre(med.stockActuel ?? 0) }}</strong>
            </td>
            <td>
              <span class="badge" :class="med.actif ? 'badge-vert' : 'badge-gris'">
                {{ med.actif ? 'Actif' : 'Inactif' }}
              </span>
            </td>
            <td class="actions">
              <button class="bouton-lien" @click="emit('voir-prix', med)">Prix</button>
              <button v-si-modif class="bouton-lien" @click="ouvrirFormulaire(med)">Modifier</button>
              <button v-si-modif class="bouton-lien" :class="{ danger: med.actif }" @click="changerActif(med)">
                {{ med.actif ? 'Désactiver' : 'Réactiver' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination (la recherche et les filtres s'appliquent à TOUTES les lignes) -->
      <Pagination v-model:page="page" v-model:taille="taille" :total="medicamentsAffiches.length" />
      <p v-if="!chargement && medicamentsAffiches.length === 0" class="tableau-vide">
        Aucun médicament. Cliquez sur « Nouveau médicament » pour en ajouter un.
      </p>
      <p v-if="chargement" class="tableau-vide">Chargement…</p>
    </div>

    <!-- Formulaire en fenêtre LARGE, sur 3 colonnes (2 puis 1 sur petit écran) -->
    <FenetreModale
      v-if="formulaire"
      :titre="formulaire.id ? 'Modifier le médicament' : 'Nouveau médicament'"
      large
      @fermer="formulaire = null"
    >
      <form id="form-medicament" class="grille-formulaire trois-colonnes" @submit.prevent="enregistrer">
        <!-- ---------- Identification ---------- -->
        <h4 class="section pleine-largeur">Identification</h4>
        <div>
          <label>Code <small class="facultatif">(facultatif)</small></label>
          <!-- Code facultatif : laissé vide, il est généré automatiquement (ex. MED-0001) -->
          <input v-model.trim="formulaire.code" maxlength="30" placeholder="Vide = automatique (ex. PARA500)" />
        </div>
        <div>
          <label>Famille</label>
          <ListeDeroulante v-model="formulaire.familleId" :options="familles" placeholder="— Aucune —" />
        </div>
        <div>
          <label>Forme</label>
          <ListeDeroulante v-model="formulaire.formeId" :options="formes" placeholder="— Choisir —" />
          <small v-if="formes.length === 0" class="aide">
            Aucune forme : ajoutez-en dans l'onglet « Formes de médicaments ».
          </small>
        </div>
        <div class="double">
          <label class="obligatoire">Désignation</label>
          <input v-model.trim="formulaire.designation" required maxlength="200" placeholder="ex. Paracétamol 500 mg" />
        </div>
        <div>
          <label>Dosage</label>
          <input v-model.trim="formulaire.dosage" maxlength="50" placeholder="ex. 500 mg" />
        </div>

        <!-- ---------- Vente ---------- -->
        <h4 class="section pleine-largeur">Vente</h4>
        <div>
          <label class="obligatoire">Unité de vente</label>
          <ListeDeroulante v-model="formulaire.uniteVenteId" :options="unitesVente" placeholder="Boîte" />
          <small class="aide">Le prix de vente s'applique à cette unité.</small>
        </div>
        <div>
          <label>Prix de vente (FCFA)</label>
          <input v-model="formulaire.prixVente" type="number" min="0" step="1" placeholder="ex. 500" />
          <small class="aide">
            Prix par {{ libelleUniteVente(formulaire.uniteVenteId).toLowerCase() }}.
            <template v-if="formulaire.id">S'il change, un nouveau prix est créé à la date du jour (historique dans l'onglet Prix).</template>
          </small>
        </div>
        <div>
          <label>Consommable</label>
          <ListeDeroulante v-model="formulaire.consommable" :options="OUI_NON" :effacable="false" />
          <small class="aide">
            Un consommable (coton, alcool…) n'est pas facturé en caisse pharmacie (montant = 0).
          </small>
        </div>

        <!-- ---------- Stock ---------- -->
        <h4 class="section pleine-largeur">Stock</h4>
        <div>
          <label>Seuil d'alerte ({{ libelleUniteVente(formulaire.uniteVenteId).toLowerCase() || 'unités' }})</label>
          <input v-model="formulaire.seuilAlerte" type="number" min="0" step="1" placeholder="0" />
          <small class="aide">Stock minimum au dépôt : en dessous, le médicament est signalé « sous le seuil ». 0 = pas d'alerte.</small>
        </div>
        <!-- Création : stock initial du dépôt -->
        <template v-if="!formulaire.id">
          <div>
            <label>Stock initial ({{ formulaire.unite || 'unités' }})</label>
            <input v-model="formulaire.stockInitial" type="number" min="0" step="1" placeholder="0" />
          </div>
          <!-- N° de lot et péremption : seulement si suivi par lot et stock > 0 -->
          <template v-if="formulaire.suiviLot && Number(formulaire.stockInitial) > 0">
            <div>
              <label class="obligatoire">N° de lot</label>
              <input v-model.trim="formulaire.numeroLot" required maxlength="50" placeholder="ex. LOT2026-01" />
            </div>
            <div>
              <label>Date de péremption</label>
              <input v-model="formulaire.datePeremption" type="date" />
            </div>
          </template>
        </template>
        <!-- Modification : stock seulement affiché -->
        <div v-else class="pleine-largeur stock-actuel">
          <span>Stock actuel au dépôt</span>
          <strong>{{ formaterNombre(formulaire.stockActuel ?? 0) }} {{ formulaire.unite }}</strong>
          <small class="aide">Le stock se modifie par les réceptions, livraisons et inventaires.</small>
        </div>
      </form>

      <template #pied>
        <button class="bouton-secondaire" @click="formulaire = null">Fermer</button>
        <button type="submit" form="form-medicament" :disabled="enregistrement">
          {{ enregistrement ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </template>
    </FenetreModale>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import Pagination from '@/components/Pagination.vue'
import ColonneTri from '@/components/ColonneTri.vue'
import { utiliserTableau } from '@/utils/pagination'
import { confirmer } from '@/utils/alertes'
import { enDateImport, enNombreImport, enOuiNon, enTexte, sansChampsVides, trouverParCode } from '@/utils/importFichier'
import { formaterMontant, formaterNombre } from '@/utils/format'

const store = useStore()
const emit = defineEmits(['voir-prix'])

/** Libellé de l'unité de vente choisie (ex. « Flacon »), « Boîte » par défaut. */
function libelleUniteVente(uniteVenteId) {
  return unitesVente.value.find((u) => u.id === uniteVenteId)?.libelle || 'Boîte'
}

/** Choix Oui / Non (consommable). Valeurs en texte, converties en vrai/faux à l'enregistrement. */
const OUI_NON = [
  { id: 'NON', libelle: 'Non' },
  { id: 'OUI', libelle: 'Oui' },
]

const recherche = ref('')
const familleFiltre = ref(null)
const afficherInactifs = ref(false)
const chargement = ref(false)
const enregistrement = ref(false)
const formulaire = ref(null)

const medicaments = computed(() => store.state.referentiel.medicaments)
const familles = computed(() => store.state.referentiel.familles)
// Formes (gérées dans l'onglet « Formes de médicaments »)
const formes = computed(() => store.state.referentiel.formes)
// Unités de vente (gérées dans l'onglet « Unités de vente »)
const unitesVente = computed(() => store.state.referentiel.unitesVente)

/** Liste filtrée (recherche + famille + inactifs). */
const medicamentsAffiches = computed(() => {
  const texte = recherche.value.toLowerCase()
  return medicaments.value.filter((m) => {
    if (!afficherInactifs.value && !m.actif) return false
    if (familleFiltre.value && m.familleId !== familleFiltre.value) return false
    if (!texte) return true
    return [m.code, m.designation].some((v) => (v || '').toLowerCase().includes(texte))
  })
})

/** Charge les médicaments ET les familles (pour la liste déroulante). */
async function charger() {
  chargement.value = true
  try {
    await Promise.all([
      store.dispatch('referentiel/charger', { liste: 'medicaments' }),
      store.dispatch('referentiel/charger', { liste: 'familles' }),
      store.dispatch('referentiel/charger', { liste: 'formes' }),
      store.dispatch('referentiel/charger', { liste: 'unitesVente' }),
      store.dispatch('referentiel/charger', { liste: 'fournisseurs' }),
    ])
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

function ouvrirFormulaire(medicament = null) {
  formulaire.value = medicament
    ? {
        ...medicament,
        // Prix de vente en cours (modifiable : un nouveau prix sera créé s'il change)
        prixVente: medicament.prixVenteActuel ?? '',
        consommable: medicament.consommable ? 'OUI' : 'NON',
      }
    : {
        code: '',
        designation: '',
        formeId: null,
        dosage: '',
        unite: '',
        conditionnement: '',
        familleId: null,
        seuilAlerte: 0,
        suiviLot: true,
        // Boîte par défaut (si elle existe dans les unités de vente)
        uniteVenteId: unitesVente.value.find((u) => u.code === 'BOITE')?.id ?? null,
        prixVente: '',
        consommable: 'NON',
        stockInitial: '',
        numeroLot: '',
        datePeremption: '',
      }
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const f = formulaire.value
    await store.dispatch('referentiel/enregistrer', {
      liste: 'medicaments',
      element: {
        id: f.id,
        code: f.code,
        designation: f.designation,
        formeId: f.formeId,
        dosage: f.dosage,
        familleId: f.familleId,
        // Unité de dispensation, conditionnement et suivi par lot ne sont plus dans le
        // formulaire : valeurs par défaut à la création, conservées en modification.
        seuilAlerte: Math.max(0, Math.round(Number(f.seuilAlerte) || 0)),
        uniteVenteId: f.uniteVenteId,
        consommable: f.consommable === 'OUI',
        // Prix vide = pas de prix (ou prix inchangé en modification)
        prixVente: f.prixVente === '' || f.prixVente === null ? '' : Number(f.prixVente),
        // Stock initial, lot et péremption : seulement à la CRÉATION
        ...(f.id
          ? {}
          : {
              stockInitial: Number(f.stockInitial) || '',
              numeroLot: f.numeroLot,
              datePeremption: f.datePeremption,
            }),
      },
    })
    store.dispatch('notifications/succes', f.id ? 'Médicament modifié.' : 'Médicament créé.')
    // La fenêtre RESTE OUVERTE (c'est l'utilisateur qui la ferme : × ou Fermer)
    // et les champs sont VIDÉS, prêts pour une nouvelle saisie.
    ouvrirFormulaire()
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

async function changerActif(medicament) {
  const confirme = await confirmer({
    titre: medicament.actif ? 'Désactiver ce médicament ?' : 'Réactiver ce médicament ?',
    texte: medicament.actif
      ? `« ${medicament.designation} » ne pourra plus être commandé ni livré. Son historique est conservé.`
      : `« ${medicament.designation} » sera de nouveau disponible.`,
    boutonConfirmer: medicament.actif ? 'Oui, désactiver' : 'Oui, réactiver',
    danger: medicament.actif,
  })
  if (!confirme) return
  try {
    await store.dispatch('referentiel/changerActif', {
      liste: 'medicaments',
      element: medicament,
      actif: !medicament.actif,
    })
    store.dispatch('notifications/succes', medicament.actif ? 'Médicament désactivé.' : 'Médicament réactivé.')
    await charger()
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

// ---------------------------------------------------------------------------
// EXPORT PDF ET IMPORT DE FICHIER
// ---------------------------------------------------------------------------

/** Ligne sous le titre du PDF : rappelle les filtres appliqués. */
const sousTitrePdf = computed(() => {
  const famille = familles.value.find((f) => f.id === familleFiltre.value)
  return [
    famille ? `Famille : ${famille.libelle}` : 'Toutes les familles',
    afficherInactifs.value ? 'médicaments actifs et inactifs' : 'médicaments actifs',
  ].join(' — ')
})

/** Colonnes du PDF. */
const COLONNES_PDF = [
  { titre: 'Code', valeur: (m) => m.code },
  { titre: 'Désignation', valeur: (m) => m.designation },
  { titre: 'Forme / dosage', valeur: (m) => [m.forme?.libelle, m.dosage].filter(Boolean).join(' · ') },
  { titre: 'Unité', valeur: (m) => m.unite },
  { titre: 'Famille', valeur: (m) => m.famille?.libelle },
  { titre: 'Seuil', valeur: (m) => formaterNombre(m.seuilAlerte), droite: true },
  { titre: 'Unité de vente', valeur: (m) => libelleUniteVente(m.uniteVenteId) },
  {
    titre: 'Prix de vente',
    valeur: (m) => (m.prixVenteActuel !== null ? formaterMontant(m.prixVenteActuel) : 'Non défini'),
    droite: true,
    somme: (m) => m.prixVenteActuel,
    formatTotal: formaterMontant,
  },
  { titre: "Prix d'achat", valeur: (m) => formaterMontant(m.prixAchatActuel), droite: true, somme: (m) => m.prixAchatActuel, formatTotal: formaterMontant },
  { titre: 'Stock', valeur: (m) => formaterNombre(m.stockActuel ?? 0), droite: true, somme: (m) => m.stockActuel ?? 0 },
  { titre: 'Consommable', valeur: (m) => (m.consommable ? 'Oui' : 'Non') },
  { titre: 'Statut', valeur: (m) => (m.actif ? 'Actif' : 'Inactif') },
]

/** Colonnes attendues dans le fichier importé (et dans le modèle Excel). */
const COLONNES_IMPORT = [
  // --- Identification (dans le même ordre que le formulaire) ---
  { cle: 'code', titre: 'Code', exemple: 'PARA500', aide: 'Facultatif : code unique du médicament. Vide = code automatique' },
  { cle: 'famille', titre: 'Famille', exemple: 'ANTALGIQ', aide: "Code ou libellé de la famille (créée automatiquement si elle n'existe pas)" },
  { cle: 'forme', titre: 'Forme', exemple: 'Comprimé', aide: "Code ou libellé de la forme (créée automatiquement si elle n'existe pas)" },
  { cle: 'designation', titre: 'Désignation', obligatoire: true, exemple: 'Paracétamol 500 mg' },
  { cle: 'dosage', titre: 'Dosage', exemple: '500 mg' },
  // --- Vente ---
  { cle: 'uniteVente', titre: 'Unité de vente', exemple: 'Boîte', aide: "Code ou libellé de l'unité (créée automatiquement si elle n'existe pas). Boîte si vide. Le prix de vente s'applique à cette unité" },
  { cle: 'prixVente', titre: 'Prix de vente', exemple: 500, aide: "En FCFA, par unité de vente. S'il change, un nouveau prix est créé à la date du jour" },
  { cle: 'prixAchat', titre: "Prix d'achat", exemple: 350, aide: "En FCFA, par unité de vente, payé au fournisseur. S'il change, un nouveau prix est créé à la date du jour" },
  { cle: 'fournisseur', titre: 'Fournisseur', exemple: 'NPSP', aide: "Code ou raison sociale du fournisseur du prix d'achat (créé automatiquement s'il n'existe pas). Vide = prix d'achat pour tous les fournisseurs" },
  { cle: 'consommable', titre: 'Consommable', exemple: 'Non', aide: "Oui ou Non (coton, alcool… : pas facturé en caisse pharmacie). Non si vide" },
  // --- Stock ---
  { cle: 'seuilAlerte', titre: "Seuil d'alerte", exemple: 50, aide: "Stock minimum au dépôt (par unité de vente) : en dessous, alerte « sous le seuil ». Vide = inchangé (0 pour un nouveau médicament)" },
  // --- Stock initial (seulement pour un NOUVEAU médicament) ---
  { cle: 'stockInitial', titre: 'Stock initial', exemple: 200, aide: 'Seulement pour un nouveau médicament (ignoré si le code existe déjà)' },
  { cle: 'numeroLot', titre: 'N° de lot', exemple: 'LOT2026-01', aide: 'Obligatoire si un stock initial est indiqué' },
  { cle: 'datePeremption', titre: 'Date de péremption', exemple: '31/12/2027', aide: 'Date de péremption du lot (JJ/MM/AAAA)' },
]

/**
 * Retrouve un élément d'une liste de référence (famille, forme, unité de vente,
 * fournisseur) par son code ou son nom. S'il n'existe pas, il est CRÉÉ
 * automatiquement, pour ne pas bloquer l'import.
 * @param champNom champ qui contient le nom : 'libelle' (par défaut) ou
 *                 'raisonSociale' (fournisseurs)
 */
/** Texte en minuscules sans accents, pour comparer (« Boîte » = « boite »). */
function sansAccents(texte) {
  return String(texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

async function trouverOuCreer(liste, texte, champNom = 'libelle') {
  const elements = store.state.referentiel[liste]
  const trouve =
    trouverParCode(elements, texte) || elements.find((e) => sansAccents(e[champNom]) === sansAccents(texte))
  if (trouve) return trouve.id
  // Texte en MAJUSCULES sans espace (ex. « ANTALGIQ ») : c'est un code, on le garde comme code
  // (le libellé pourra être corrigé dans l'onglet correspondant). Sinon : code automatique.
  const ressembleAUnCode = /^[A-Z0-9_-]{1,30}$/.test(texte)
  const element = ressembleAUnCode ? { code: texte, [champNom]: texte } : { [champNom]: texte }
  const cree = await store.dispatch('referentiel/enregistrer', { liste, element })
  // On recharge la liste : les lignes suivantes du fichier retrouveront l'élément créé
  await store.dispatch('referentiel/charger', { liste })
  return cree.id
}

/** Enregistre UNE ligne : mise à jour si le code existe, sinon création. */
async function importerLigne(valeurs) {
  // Lecture des valeurs AVANT de créer quoi que ce soit (une valeur invalide arrête la ligne)
  const prixVente = enNombreImport(valeurs.prixVente, 'Prix de vente')
  const prixAchat = enNombreImport(valeurs.prixAchat, "Prix d'achat")
  const seuil = enNombreImport(valeurs.seuilAlerte, "Seuil d'alerte")
  if (seuil !== null && seuil < 0) throw new Error("Seuil d'alerte : la valeur ne peut pas être négative.")

  // Famille, forme et unité de vente : retrouvées par code ou libellé, créées si elles n'existent pas
  const familleTexte = enTexte(valeurs.famille)
  const familleId = familleTexte ? await trouverOuCreer('familles', familleTexte) : null
  const formeTexte = enTexte(valeurs.forme)
  const formeId = formeTexte ? await trouverOuCreer('formes', formeTexte) : null
  const uniteTexte = enTexte(valeurs.uniteVente)
  const uniteVenteId = uniteTexte ? await trouverOuCreer('unitesVente', uniteTexte) : null
  // Fournisseur du prix d'achat (vide = prix d'achat pour tous les fournisseurs)
  const fournisseurTexte = enTexte(valeurs.fournisseur)
  const fournisseurId = fournisseurTexte ? await trouverOuCreer('fournisseurs', fournisseurTexte, 'raisonSociale') : null

  const existant = trouverParCode(medicaments.value, valeurs.code)

  const element = sansChampsVides({
    id: existant?.id,
    code: enTexte(valeurs.code),
    designation: enTexte(valeurs.designation),
    formeId,
    dosage: enTexte(valeurs.dosage),
    familleId,
    uniteVenteId,
    // Les prix vont dans les tables des prix (historique) : le backend s'en charge
    prixVente,
    prixAchat,
    fournisseurId,
    consommable: enOuiNon(valeurs.consommable),
    seuilAlerte: seuil === null ? null : Math.round(seuil),
  })

  // Stock initial, n° de lot et péremption : seulement pour un NOUVEAU médicament
  // (ensuite le stock change par les réceptions, livraisons et inventaires)
  if (!existant) {
    const stock = enNombreImport(valeurs.stockInitial, 'Stock initial')
    if (stock !== null && stock > 0) {
      element.stockInitial = Math.round(stock)
      if (enTexte(valeurs.numeroLot)) element.numeroLot = enTexte(valeurs.numeroLot)
      const peremption = enDateImport(valeurs.datePeremption, 'Date de péremption')
      if (peremption) element.datePeremption = peremption
    }
  }

  await store.dispatch('referentiel/enregistrer', { liste: 'medicaments', element })
  return existant ? 'modifie' : 'cree'
}

// « Data table » : tri en cliquant sur les en-têtes + pagination.
// VALEURS_TRI : pour chaque colonne triable, la valeur à comparer.
const VALEURS_TRI = {
  code: (m) => m.code,
  designation: (m) => m.designation,
  forme: (m) => m.forme?.libelle,
  unite: (m) => m.unite,
  famille: (m) => m.famille?.libelle,
  seuil: (m) => m.seuilAlerte,
  prixVente: (m) => m.prixVenteActuel,
  prixAchat: (m) => m.prixAchatActuel,
  stock: (m) => m.stockActuel ?? 0,
  statut: (m) => (m.actif ? 'Actif' : 'Inactif'),
}
// Retour à la page 1 quand la recherche, un filtre ou le tri change
const { tri, lignesTriees, page, taille, lignesPage } = utiliserTableau(medicamentsAffiches, [recherche, familleFiltre, afficherInactifs], VALEURS_TRI)

onMounted(charger)
</script>

<style scoped>
.detail { font-size: 0.78rem; color: var(--muted); }
/* Formulaire sur 3 colonnes (fenêtre large) ; « double » = champ sur 2 colonnes */
.grille-formulaire.trois-colonnes { grid-template-columns: repeat(3, 1fr); }
.grille-formulaire.trois-colonnes .double { grid-column: span 2; }
@media (max-width: 900px) {
  .grille-formulaire.trois-colonnes { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .grille-formulaire.trois-colonnes { grid-template-columns: 1fr; }
  .grille-formulaire.trois-colonnes .double { grid-column: auto; }
}
/* Titres de section dans le formulaire (Vente, Stock) */
.section {
  margin: 0.5rem 0 -0.25rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.aide { display: block; margin-top: 0.25rem; font-size: 0.78rem; color: var(--muted); }
/* Étiquette « Consommable » dans la liste */
.badge-orange { margin-left: 0.4rem; background: #fff1e0; color: #b35c00; }
/* Stock sous le seuil d'alerte */
.stock-bas { color: var(--danger); }
/* Encadré du stock actuel (modification) */
.stock-actuel {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--fond-pale);
}
.stock-actuel strong { font-size: 1.15rem; color: var(--primary-dark); }
.stock-actuel .aide { flex-basis: 100%; margin: 0; }
</style>
