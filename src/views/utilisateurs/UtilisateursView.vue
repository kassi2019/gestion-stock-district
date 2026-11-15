<!--
  =============================================================================
  MODULE 02 — UTILISATEURS (page principale avec onglets)
  =============================================================================
  Trois onglets (un composant chacun, dans ce même dossier) :
    - OngletPersonnel.vue  fiches du personnel (matricule, fonction, affectation,
                           contacts) ; création du COMPTE en même temps (facultatif) ;
    - OngletComptes.vue    comptes utilisateurs : identifiant, profil, mot de
                           passe, activation ;
    - OngletProfils.vue    profils (rôles) et leurs DROITS par module :
                           aucun accès / lecture / modification.

  Les listes (personnel, comptes, profils) sont chargées ICI une seule fois et
  passées aux onglets ; après une modification, l'onglet émet « modifie » et
  la page recharge tout (les compteurs des onglets restent justes).

  Accès : droit « Lecture » sur le module Utilisateurs pour voir ; droit
  « Modification » pour créer / modifier (boutons cachés sinon).
  =============================================================================
-->
<template>
  <div class="page-utilisateurs">
    <EnteteModule
      icone="utilisateurs"
      titre="Utilisateurs"
      description="Personnel, comptes, profils et droits d'accès aux modules."
    />

    <!-- Onglets (avec le nombre d'éléments) -->
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
        <span class="nombre-onglet">{{ nombres[onglet.code] }}</span>
      </button>
    </nav>

    <section class="bloc">
      <p v-if="chargement && !charge" class="tableau-vide">Chargement…</p>
      <template v-else>
        <OngletPersonnel v-if="ongletActif === 'personnel'" :personnel="personnel" :roles="roles" @modifie="charger" />
        <OngletComptes
          v-else-if="ongletActif === 'comptes'"
          :comptes="comptes"
          :personnel="personnel"
          :roles="roles"
          @modifie="charger"
        />
        <OngletProfils v-else-if="ongletActif === 'profils'" :profils="profils" @modifie="charger" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import EnteteModule from '@/components/EnteteModule.vue'
import Icone from '@/components/Icone.vue'
import OngletPersonnel from './OngletPersonnel.vue'
import OngletComptes from './OngletComptes.vue'
import OngletProfils from './OngletProfils.vue'
import { listerPersonnel, listerProfils, listerUtilisateurs } from '@/api/utilisateurs'

/** Onglets (dans l'ordre d'affichage). */
const ONGLETS = [
  { code: 'personnel', titre: 'Personnel', icone: 'utilisateurs' },
  { code: 'comptes', titre: 'Comptes utilisateurs', icone: 'cle' },
  { code: 'profils', titre: 'Profils & droits', icone: 'bouclier' },
]

const store = useStore()
const route = useRoute()
const router = useRouter()

// Onglet affiché, aussi écrit dans l'adresse (ex. /utilisateurs?onglet=profils)
const ongletActif = ref(ONGLETS.some((o) => o.code === route.query.onglet) ? route.query.onglet : ONGLETS[0].code)
watch(ongletActif, (code) => router.replace({ query: { onglet: code } }))

const personnel = ref([])
const comptes = ref([])
const profils = ref([])
const chargement = ref(false)
const charge = ref(false) // vrai après le 1er chargement (pas de « Chargement… » ensuite)

/** Liste simple des profils pour les listes déroulantes. */
const roles = computed(() => profils.value.map(({ id, code, libelle, description }) => ({ id, code, libelle, description })))

/** Nombre affiché sur chaque onglet. */
const nombres = computed(() => ({
  personnel: personnel.value.length,
  comptes: comptes.value.length,
  profils: profils.value.length,
}))

/** Charge (ou recharge) le personnel, les comptes et les profils. */
async function charger() {
  chargement.value = true
  try {
    ;[personnel.value, comptes.value, profils.value] = await Promise.all([
      listerPersonnel(),
      listerUtilisateurs(),
      listerProfils(),
    ])
    charge.value = true
    // Mes propres droits ont pu changer (profil modifié) : on les relit
    store.dispatch('auth/rafraichir').catch(() => {})
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

onMounted(charger)
</script>

<style scoped>
.page-utilisateurs { display: flex; flex-direction: column; gap: 1.25rem; }

/* Onglets en "pilules" (même présentation que le Paramétrage) */
.onglets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
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

<!-- Styles communs aux onglets du module (non « scoped » mais limités à la page) -->
<style>
.page-utilisateurs .personne { display: flex; align-items: center; gap: 0.7rem; }
.page-utilisateurs .avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
}
.page-utilisateurs .section {
  margin: 0.5rem 0 -0.25rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.page-utilisateurs .section:first-child { margin-top: 0; }
.page-utilisateurs .aide { margin: 0.2rem 0 0; display: block; font-size: 0.8rem; color: var(--muted); }
</style>
