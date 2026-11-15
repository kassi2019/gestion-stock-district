<!--
  =============================================================================
  MODULE 01 — PARAMÉTRAGE (page principale avec onglets)
  =============================================================================
  Chaque onglet est un composant séparé, dans ce même dossier :
    - OngletCentres.vue       centres de santé (avec type et coordonnées GPS)
    - OngletCartographie.vue  carte des centres de santé (coordonnées GPS saisies)
    - OngletTypesCentre.vue   types de centres (CSU, CSR, Dispensaire...)
    - OngletFournisseurs.vue  fournisseurs
    - OngletFamilles.vue      familles de médicaments
    - OngletFormes.vue        formes de médicaments (comprimé, sirop...)
    - OngletUnitesVente.vue   unités de vente (boîte, plaque, flacon...)
    - OngletFonctions.vue     fonctions du personnel (pharmacien, caissière...)
    - OngletMedicaments.vue   catalogue des médicaments
    - OngletPrix.vue          prix d'achat / de vente (avec historique)
    - OngletParametres.vue    paramètres généraux

  Chaque onglet affiche le NOMBRE d'éléments de sa liste (voir NOMBRES) :
  les listes sont chargées à l'ouverture de la page, puis le compteur se met
  à jour tout seul après un ajout, un import ou une désactivation.

  ➜ Pour ajouter un onglet : créer le composant, puis l'ajouter dans la
    liste ONGLETS ci-dessous (et, si besoin, son compteur dans NOMBRES).
  =============================================================================
-->
<template>
  <div class="page-parametrage">
    <!-- En-tête de la page -->
    <EnteteModule
      icone="reglages"
      titre="Paramétrage"
      description="Données de référence utilisées par tous les modules de l'application."
    />

    <!-- Onglets -->
    <nav class="onglets">
      <button
        v-for="onglet in ONGLETS"
        :key="onglet.code"
        class="onglet"
        :class="{ actif: ongletActif === onglet.code }"
        @click="ongletActif = onglet.code"
      >
        <Icone :nom="onglet.icone" :taille="18" />
        {{ onglet.titre }}
        <!-- Nombre d'éléments (pas de compteur pour « Paramètres généraux ») -->
        <span v-if="nombres[onglet.code] !== undefined" class="nombre-onglet" :title="titresNombres[onglet.code]">
          {{ nombres[onglet.code] }}
        </span>
      </button>
    </nav>

    <!-- Contenu de l'onglet sélectionné -->
    <section class="bloc">
       <OngletTypesCentre v-if="ongletActif === 'types-centre'" />
      <OngletCentres v-else-if="ongletActif === 'centres'" />
      <OngletCartographie v-else-if="ongletActif === 'cartographie'" />
      <OngletFournisseurs v-else-if="ongletActif === 'fournisseurs'" />
      <OngletFamilles v-else-if="ongletActif === 'familles'" />
      <OngletFormes v-else-if="ongletActif === 'formes'" />
      <OngletUnitesVente v-else-if="ongletActif === 'unites-vente'" />
      <OngletFonctions v-else-if="ongletActif === 'fonctions'" />
      <OngletMedicaments v-else-if="ongletActif === 'medicaments'" @voir-prix="ouvrirPrix" />
      <OngletPrix v-else-if="ongletActif === 'prix'" :medicament-initial="medicamentPourPrix" />
      <OngletParametres v-else-if="ongletActif === 'parametres'" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import Icone from '@/components/Icone.vue'
import EnteteModule from '@/components/EnteteModule.vue'
import OngletCentres from './OngletCentres.vue'
import OngletCartographie from './OngletCartographie.vue'
import OngletTypesCentre from './OngletTypesCentre.vue'
import OngletFournisseurs from './OngletFournisseurs.vue'
import OngletFamilles from './OngletFamilles.vue'
import OngletFormes from './OngletFormes.vue'
import OngletUnitesVente from './OngletUnitesVente.vue'
import OngletFonctions from './OngletFonctions.vue'
import OngletMedicaments from './OngletMedicaments.vue'
import OngletPrix from './OngletPrix.vue'
import OngletParametres from './OngletParametres.vue'

/** Liste des onglets (dans l'ordre d'affichage). */
const ONGLETS = [
  { code: 'types-centre', titre: 'Types de centres', icone: 'presse-papier' },
  { code: 'centres', titre: 'Centres de santé', icone: 'accueil' },
  { code: 'cartographie', titre: 'Cartographie', icone: 'carte' },
  { code: 'fournisseurs', titre: 'Fournisseurs', icone: 'camion' },
  { code: 'familles', titre: 'Familles de médicaments', icone: 'presse-papier' },
  { code: 'formes', titre: 'Formes de médicaments', icone: 'gelule' },
  { code: 'unites-vente', titre: 'Unités de vente', icone: 'carton' },
  { code: 'medicaments', titre: 'Médicaments', icone: 'carton' },
  { code: 'prix', titre: 'Prix', icone: 'portefeuille' },
  { code: 'fonctions', titre: 'Fonctions', icone: 'utilisateurs' },
  { code: 'parametres', titre: 'Paramètres généraux', icone: 'reglages' },
]

const route = useRoute()
const router = useRouter()
const store = useStore()

// ---------------------------------------------------------------------------
// NOMBRE D'ÉLÉMENTS AFFICHÉ SUR CHAQUE ONGLET
// ---------------------------------------------------------------------------

/** Vrai si le centre a une latitude ET une longitude. */
function estLocalise(c) {
  return c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined
}

/** Nombre par onglet (calculé depuis les listes du store : mis à jour automatiquement). */
const nombres = computed(() => {
  const r = store.state.referentiel
  return {
    'types-centre': r.typesCentre.length,
    centres: r.centres.length,
    cartographie: r.centres.filter(estLocalise).length, // centres placés sur la carte
    fournisseurs: r.fournisseurs.length,
    familles: r.familles.length,
    formes: r.formes.length,
    'unites-vente': r.unitesVente.length,
    fonctions: r.fonctions.length,
    medicaments: r.medicaments.length,
    prix: r.medicaments.filter((m) => m.prixVenteActuel !== null).length, // médicaments qui ont un prix
  }
})

/** Explication au survol du compteur. */
const titresNombres = {
  'types-centre': 'Nombre de types de centres',
  centres: 'Nombre de centres de santé (actifs et inactifs)',
  cartographie: 'Centres placés sur la carte (avec coordonnées GPS)',
  fournisseurs: 'Nombre de fournisseurs (actifs et inactifs)',
  familles: 'Nombre de familles',
  formes: 'Nombre de formes',
  'unites-vente': "Nombre d'unités de vente",
  fonctions: 'Nombre de fonctions du personnel',
  medicaments: 'Nombre de médicaments (actifs et inactifs)',
  prix: 'Médicaments qui ont un prix de vente',
}

/** Charge toutes les listes une fois, pour afficher les compteurs dès l'ouverture. */
onMounted(async () => {
  const listes = ['typesCentre', 'centres', 'fournisseurs', 'familles', 'formes', 'unitesVente', 'fonctions', 'medicaments']
  try {
    await Promise.all(listes.map((liste) => store.dispatch('referentiel/charger', { liste })))
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
})

// Onglet affiché (par défaut : le premier de la liste ONGLETS). Il est aussi écrit dans l'adresse (ex. /parametrage?onglet=prix)
// pour pouvoir y revenir directement ou partager le lien.
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

// Médicament à afficher dans l'onglet Prix (quand on clique "Prix" depuis la liste)
// (peut aussi venir de l'adresse : /parametrage?onglet=prix&medicament=12)
const medicamentPourPrix = ref(route.query.medicament ? Number(route.query.medicament) : null)

/** Ouvre l'onglet Prix directement sur un médicament. */
function ouvrirPrix(medicament) {
  medicamentPourPrix.value = medicament.id
  ongletActif.value = 'prix'
}
</script>

<style scoped>
.page-parametrage { display: flex; flex-direction: column; gap: 1.25rem; }

/* Onglets en "pilules" */
.onglets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.onglet {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  background: #fff;
  color: var(--texte-sur-fond);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.05);
}
.onglet:hover { background: var(--primary-light); }
.onglet.actif {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(0, 163, 108, 0.35);
}

/* Compteur dans l'onglet */
.nombre-onglet {
  min-width: 22px;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
}
.onglet.actif .nombre-onglet { background: rgba(255, 255, 255, 0.25); color: #fff; }
</style>
