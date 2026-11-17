<!--
  =============================================================================
  ONGLET « PARAMÈTRES GÉNÉRAUX »
  =============================================================================
  Deux parties :

  1. INFORMATIONS DU DISTRICT (fiche comme celle d'un centre de santé) :
     code, nom, région, localité, adresse, coordonnées GPS, responsable,
     téléphone, e-mail. Un seul bouton « Enregistrer » pour toute la fiche.
     ➜ Chaque information est un paramètre (table "parametres") dont la clé
       est listée dans CHAMPS_DISTRICT ci-dessous.
     ➜ Le nom est utilisé sur les documents (ex. en-tête des PDF).

  2. AUTRES RÉGLAGES (expiration de session, alerte de péremption, prix par
     centre, devise...) : une ligne par paramètre avec son bouton.
     Chaque paramètre a un "type" (voir DESCRIPTIONS) qui détermine le champ
     affiché : oui/non, nombre ou texte.

  ➜ Pour un nouveau paramètre : l'ajouter dans prisma/seed.ts (backend) ou
    par une migration, puis éventuellement dans DESCRIPTIONS.
  =============================================================================
-->
<template>
  <div>
    <p v-if="chargement" class="tableau-vide">Chargement…</p>

    <template v-else>
      <!-- ===================== 1. INFORMATIONS DU DISTRICT ===================== -->
      <section class="fiche-district">
        <header class="fiche-entete">
          <span class="fiche-icone"><Icone nom="accueil" :taille="22" /></span>
          <div>
            <h3>Informations du district</h3>
            <p>Utilisées sur les documents imprimés (en-tête et pied des PDF).</p>
          </div>
        </header>

        <form class="grille-formulaire trois-colonnes" @submit.prevent="enregistrerDistrict">
          <!-- ---------- Identification ---------- -->
          <h4 class="section pleine-largeur">Identification</h4>
          <div>
            <label>Code du district</label>
            <input v-model.trim="district.DISTRICT_CODE" maxlength="30" placeholder="ex. DS-ABE" />
          </div>
          <div class="double">
            <label class="obligatoire">Nom du district</label>
            <input v-model.trim="district.NOM_DISTRICT" required maxlength="150" placeholder="ex. District sanitaire d'Abobo-Est" />
          </div>
          <div>
            <label>Région sanitaire</label>
            <input v-model.trim="district.DISTRICT_REGION" maxlength="150" placeholder="ex. Abidjan 1" />
          </div>
          <div class="double">
            <label>Responsable</label>
            <input v-model.trim="district.DISTRICT_RESPONSABLE" maxlength="150" placeholder="ex. Dr Kouassi (directeur départemental)" />
          </div>

          <!-- ---------- Localisation ---------- -->
          <h4 class="section pleine-largeur">Localisation</h4>
          <div>
            <label>Ville / localité</label>
            <input v-model.trim="district.DISTRICT_LOCALITE" maxlength="100" placeholder="ex. Abobo" />
          </div>
          <div class="double">
            <label>Adresse</label>
            <input v-model.trim="district.DISTRICT_ADRESSE" maxlength="255" placeholder="ex. Abobo Avocatier, près de la mairie" />
          </div>
          <div>
            <label>Latitude (GPS)</label>
            <input v-model="district.DISTRICT_LATITUDE" type="number" step="0.000001" min="-90" max="90" placeholder="ex. 5.416700" />
          </div>
          <div>
            <label>Longitude (GPS)</label>
            <input v-model="district.DISTRICT_LONGITUDE" type="number" step="0.000001" min="-180" max="180" placeholder="ex. -4.016700" />
          </div>
          <div class="aide-gps">
            <a v-if="aDesCoordonnees" :href="lienCarte" target="_blank" rel="noopener">
              📍 Vérifier l'emplacement sur la carte
            </a>
            <small v-else class="aide">Degrés décimaux (en Côte d'Ivoire : latitude 4 à 11, longitude -9 à -2).</small>
          </div>

          <!-- ---------- Contact ---------- -->
          <h4 class="section pleine-largeur">Contact</h4>
          <div>
            <label>Téléphone</label>
            <input v-model.trim="district.DISTRICT_TELEPHONE" maxlength="30" placeholder="ex. 27 22 00 00 00" />
          </div>
          <div class="double">
            <label>E-mail</label>
            <input v-model.trim="district.DISTRICT_EMAIL" type="email" maxlength="150" placeholder="ex. ds.abobo-est@sante.gouv.ci" />
          </div>

          <div class="pleine-largeur actions-fiche">
            <span v-if="districtModifie" class="aide">Modifications non enregistrées</span>
            <button v-si-modif type="submit" :disabled="!districtModifie || enregistrementDistrict">
              {{ enregistrementDistrict ? 'Enregistrement…' : 'Enregistrer les informations' }}
            </button>
          </div>
        </form>
      </section>

      <!-- ===================== 2. AUTRES RÉGLAGES ===================== -->
      <h3 class="titre-reglages">Réglages de l'application</h3>
      <div class="liste-parametres">
        <div v-for="parametre in autresParametres" :key="parametre.cle" class="parametre">
          <div class="parametre-texte">
            <strong>{{ infos(parametre).libelle }}</strong>
            <small>{{ parametre.description }}</small>
          </div>

          <!-- Champ adapté au type du paramètre -->
          <div class="parametre-champ">
            <ListeDeroulante
              v-if="infos(parametre).type === 'ouiNon'"
              v-model="valeurs[parametre.cle]"
              :options="OUI_NON"
              :effacable="false"
            />
            <ListeDeroulante
              v-else-if="infos(parametre).type === 'choix'"
              v-model="valeurs[parametre.cle]"
              :options="infos(parametre).options"
              :effacable="false"
            />
            <input
              v-else-if="infos(parametre).type === 'nombre'"
              v-model="valeurs[parametre.cle]"
              type="number"
              min="0"
              step="any"
            />
            <input v-else v-model="valeurs[parametre.cle]" type="text" />
          </div>

          <button v-si-modif
            :disabled="valeurs[parametre.cle] === parametre.valeur || enregistrement === parametre.cle"
            @click="enregistrer(parametre)"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import { listerParametres, modifierParametre } from '@/api/parametrage'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import Icone from '@/components/Icone.vue'

const store = useStore()

/** Clés des paramètres qui forment la fiche « Informations du district ». */
const CHAMPS_DISTRICT = [
  'DISTRICT_CODE',
  'NOM_DISTRICT',
  'DISTRICT_REGION',
  'DISTRICT_RESPONSABLE',
  'DISTRICT_LOCALITE',
  'DISTRICT_ADRESSE',
  'DISTRICT_LATITUDE',
  'DISTRICT_LONGITUDE',
  'DISTRICT_TELEPHONE',
  'DISTRICT_EMAIL',
]

/** Libellé clair et type de champ des autres paramètres. */
const DESCRIPTIONS = {
  DEVISE: { libelle: 'Devise', type: 'texte' },
  SESSION_EXPIRATION_MINUTES: { libelle: 'Déconnexion après inactivité (minutes)', type: 'nombre' },
  ALERTE_PEREMPTION_JOURS: { libelle: 'Alerte de péremption (jours avant)', type: 'nombre' },
  PRIX_VENTE_PAR_CENTRE: { libelle: 'Prix de vente spécifiques par centre', type: 'ouiNon' },
  SORTIE_AUTO_PERIMES: { libelle: 'Sortie automatique des lots périmés (chaque nuit)', type: 'ouiNon' },
  DELAI_PAIEMENT_JOURS: { libelle: 'Délai de paiement des factures (jours après émission)', type: 'nombre' },
  // Rapport centre de santé (fiche « Rapport commande mensuel recouvrables »)
  MOIS_STOCK_MAX: { libelle: 'Rapport centre : niveau de stock maximum (mois)', type: 'nombre' },
  MOIS_STOCK_MIN: { libelle: 'Rapport centre : niveau de stock minimum (mois)', type: 'nombre' },
  MOIS_POINT_COMMANDE_URGENTE: { libelle: 'Rapport centre : point de commande urgente (mois)', type: 'nombre' },
  DELAI_REAPPRO_MOIS: { libelle: 'Rapport centre : délai de réapprovisionnement (mois)', type: 'nombre' },
  MOIS_CMM: { libelle: 'Rapport centre : nombre de mois pour la CMM', type: 'nombre' },
  VALORISATION_ECARTS: {
    libelle: 'Valorisation des écarts de supervision',
    type: 'choix',
    options: [
      { id: 'PRIX_VENTE', libelle: 'Prix de vente (prix facturé au centre)' },
      { id: 'PRIX_ACHAT', libelle: "Prix d'achat du district" },
    ],
  },
}

/** Choix proposés pour les paramètres de type oui/non. */
const OUI_NON = [
  { id: 'true', libelle: 'Oui' },
  { id: 'false', libelle: 'Non' },
]

const parametres = ref([])
// Valeurs en cours de saisie des autres réglages, par clé (ex. valeurs.DEVISE = 'FCFA')
const valeurs = reactive({})
// Fiche du district en cours de saisie, par clé (ex. district.NOM_DISTRICT)
const district = reactive({})
const chargement = ref(false)
// Clé du paramètre en cours d'enregistrement (pour griser son bouton)
const enregistrement = ref(null)
const enregistrementDistrict = ref(false)

/** Paramètres hors fiche du district. */
const autresParametres = computed(() => parametres.value.filter((p) => !CHAMPS_DISTRICT.includes(p.cle)))

/** Valeur enregistrée d'un paramètre ('' s'il n'existe pas). */
function valeurEnregistree(cle) {
  return parametres.value.find((p) => p.cle === cle)?.valeur ?? ''
}

/** Vrai si au moins une information du district a été modifiée. */
const districtModifie = computed(() =>
  CHAMPS_DISTRICT.some((cle) => String(district[cle] ?? '') !== valeurEnregistree(cle)),
)

/** Coordonnées GPS renseignées ? (pour le lien vers la carte) */
const aDesCoordonnees = computed(() => district.DISTRICT_LATITUDE !== '' && district.DISTRICT_LONGITUDE !== '')
const lienCarte = computed(() => {
  const lat = district.DISTRICT_LATITUDE
  const lon = district.DISTRICT_LONGITUDE
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
})

/** Infos d'affichage d'un paramètre (libellé = clé si inconnu). */
function infos(parametre) {
  return DESCRIPTIONS[parametre.cle] || { libelle: parametre.description || parametre.cle, type: 'texte' }
}

async function charger() {
  chargement.value = true
  try {
    parametres.value = await listerParametres()
    for (const p of parametres.value) valeurs[p.cle] = p.valeur
    for (const cle of CHAMPS_DISTRICT) district[cle] = valeurEnregistree(cle)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

/** Enregistre UN réglage (partie 2). */
async function enregistrer(parametre) {
  enregistrement.value = parametre.cle
  try {
    const misAJour = await modifierParametre(parametre.cle, String(valeurs[parametre.cle]))
    parametre.valeur = misAJour.valeur
    store.dispatch('notifications/succes', `Paramètre « ${infos(parametre).libelle} » enregistré.`)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = null
  }
}

/** Enregistre la fiche du district : seulement les informations modifiées. */
async function enregistrerDistrict() {
  // Les coordonnées vont par deux : latitude ET longitude, ou aucune
  if ((district.DISTRICT_LATITUDE === '') !== (district.DISTRICT_LONGITUDE === '')) {
    store.dispatch('notifications/erreur', 'Renseignez la latitude ET la longitude (ou aucune des deux).')
    return
  }

  enregistrementDistrict.value = true
  try {
    for (const cle of CHAMPS_DISTRICT) {
      const nouvelle = String(district[cle] ?? '')
      if (nouvelle === valeurEnregistree(cle)) continue
      const misAJour = await modifierParametre(cle, nouvelle)
      const parametre = parametres.value.find((p) => p.cle === cle)
      if (parametre) parametre.valeur = misAJour.valeur
    }
    store.dispatch('notifications/succes', 'Informations du district enregistrées.')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrementDistrict.value = false
  }
}

onMounted(charger)
</script>

<style scoped>
/* ---------- Fiche du district ---------- */
.fiche-district {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.75rem;
  border: 1px solid var(--border);
  border-top: 4px solid var(--primary);
  border-radius: 14px;
}
.fiche-entete { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.5rem; }
.fiche-entete h3 { margin: 0; color: var(--primary-dark); }
.fiche-entete p { margin: 0.15rem 0 0; font-size: 0.85rem; color: var(--muted); }
.fiche-icone {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--primary-light);
  color: var(--primary-dark);
}

/* Titres de section (Identification, Localisation, Contact) */
.section {
  margin: 0.5rem 0 -0.25rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}

/* Formulaire sur 3 colonnes ; « double » = champ sur 2 colonnes */
.grille-formulaire.trois-colonnes { grid-template-columns: repeat(3, 1fr); }
.grille-formulaire.trois-colonnes .double { grid-column: span 2; }
@media (max-width: 900px) {
  .grille-formulaire.trois-colonnes { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .grille-formulaire.trois-colonnes { grid-template-columns: 1fr; }
  .grille-formulaire.trois-colonnes .double { grid-column: auto; }
}

.aide { font-size: 0.8rem; color: var(--muted); }
.aide-gps { display: flex; align-items: flex-end; padding-bottom: 0.6rem; }
.aide-gps a { color: var(--primary); font-weight: 600; font-size: 0.85rem; text-decoration: none; }
.aide-gps a:hover { text-decoration: underline; }
.actions-fiche { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; }

/* ---------- Autres réglages ---------- */
.titre-reglages { margin: 0 0 0.75rem; font-size: 1rem; color: var(--texte-sur-fond); }
.liste-parametres { display: flex; flex-direction: column; gap: 0.75rem; }
.parametre {
  display: grid;
  grid-template-columns: 1fr 220px auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 12px;
}
.parametre-texte { display: flex; flex-direction: column; gap: 0.15rem; }
.parametre-texte small { color: var(--muted); }
@media (max-width: 700px) {
  .parametre { grid-template-columns: 1fr; }
}
</style>
