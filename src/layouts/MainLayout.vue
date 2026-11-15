<!--
  =============================================================================
  MISE EN PAGE PRINCIPALE (sans menu latéral, pleine largeur)
  =============================================================================
  Cadre commun à toutes les pages après connexion :
    - barre du haut :
        * à gauche  : logo (clic = retour à l'accueil) ;
        * au centre : fil d'Ariane "Accueil › Nom du module" ;
        * à droite  : bouton Accueil, « Mon mot de passe », utilisateur connecté,
                      déconnexion ;
    - en dessous : la page en cours, sur toute la largeur (<router-view />).

  Navigation : on choisit un module depuis les tuiles de l'accueil, et on
  revient à l'accueil par le logo, le fil d'Ariane ou le bouton "Accueil".
  =============================================================================
-->
<template>
  <div class="layout">
    <!-- ======================= BARRE DU HAUT ======================= -->
    <header class="barre-haut">
      <!-- Logo : ramène à l'accueil -->
      <router-link to="/" class="logo" title="Retour à l'accueil">
        <div class="logo-croix">+</div>
        <div>
          <div class="logo-titre">Stock <span>District</span></div>
          <div class="logo-sous-titre">District sanitaire</div>
        </div>
      </router-link>

      <!-- Fil d'Ariane : affiché seulement quand on est dans un module -->
      <nav v-if="!surAccueil" class="fil-ariane">
        <router-link to="/">Accueil</router-link>
        <span class="separateur">›</span>
        <span class="page-courante">{{ titrePage }}</span>
      </nav>

      <div class="droite">
        <!-- Bouton Accueil : affiché seulement quand on est dans un module -->
        <router-link v-if="!surAccueil" to="/" class="bouton-accueil">
          <Icone nom="accueil" :taille="18" />
          <span>Accueil</span>
        </router-link>

        <!-- Utilisateur connecté -->
        <div class="utilisateur">
          <!-- Photo de l'utilisateur connecté (fiche personnel), sinon ses initiales -->
          <Avatar :photo="utilisateur?.photo" :nom="utilisateur?.nom" :prenoms="utilisateur?.prenoms" :taille="38" />
          <div class="utilisateur-infos">
            <div class="utilisateur-nom">{{ utilisateur?.prenoms }} {{ utilisateur?.nom }}</div>
            <div class="utilisateur-role">{{ utilisateur?.roleLibelle || utilisateur?.role }}</div>
          </div>
        </div>

        <!-- Changer son propre mot de passe (tous les profils) -->
        <button class="bouton-mdp" title="Changer mon mot de passe" @click="fenetreMotDePasse = true">
          <Icone nom="cle" :taille="18" />
          <span>Mon mot de passe</span>
        </button>

        <button class="bouton-deconnexion" title="Se déconnecter" @click="seDeconnecter">
          <Icone nom="deconnexion" :taille="18" />
        </button>
      </div>
    </header>

    <!-- ======================= PAGE EN COURS ======================= -->
    <main class="contenu">
      <router-view />
    </main>

    <!-- Fenêtre « Mon mot de passe » -->
    <MonMotDePasse v-if="fenetreMotDePasse" @fermer="fenetreMotDePasse = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import Icone from '@/components/Icone.vue'
import Avatar from '@/components/Avatar.vue'
import MonMotDePasse from '@/components/MonMotDePasse.vue'

const store = useStore()
const router = useRouter()
const route = useRoute()

// Utilisateur connecté (lu dans le store Vuex)
const utilisateur = computed(() => store.state.auth.user)

// Titre de la page en cours (défini dans les routes : meta.titre)
const titrePage = computed(() => route.meta.titre || '')

// Fenêtre « Mon mot de passe » ouverte ou non
const fenetreMotDePasse = ref(false)

// Vrai si on est sur la page d'accueil
const surAccueil = computed(() => route.name === 'dashboard')

/** Déconnexion puis retour à l'écran de connexion. */
function seDeconnecter() {
  store.dispatch('auth/logout')
  router.push({ name: 'login' })
}

// À l'ouverture : on relit l'utilisateur et ses DROITS auprès du serveur
// (un changement de droits fait par l'administrateur s'applique sans reconnexion)
onMounted(() => store.dispatch('auth/rafraichir').catch(() => {}))
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f3f5f7;
}

/* ---------------------------------------------------------------------------
   BARRE DU HAUT (blanche, collée en haut lors du défilement)
   --------------------------------------------------------------------------- */
.barre-haut {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.7rem 2rem;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
}
/* Fin liseré dégradé vert sous la barre */
.barre-haut::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--text);
  text-decoration: none;
  flex-shrink: 0;
}
.logo-croix {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-size: 1.6rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 10px rgba(0, 163, 108, 0.35);
}
.logo-titre { font-size: 1.15rem; font-weight: 800; color: var(--primary-dark); }
.logo-titre span { color: var(--accent-dark); }
.logo-sous-titre { font-size: 0.72rem; color: var(--muted); }

/* Fil d'Ariane */
.fil-ariane {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 1.5rem;
  border-left: 1px solid var(--border);
  font-size: 0.95rem;
}
.fil-ariane a { color: var(--muted); text-decoration: none; }
.fil-ariane a:hover { color: var(--primary); }
.separateur { color: var(--border); font-size: 1.2rem; }
.page-courante { font-weight: 700; color: var(--text); }

/* Partie droite : poussée tout à droite */
.droite {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bouton-accueil {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
}
.bouton-accueil:hover { background: var(--primary); color: #fff; }

.utilisateur { display: flex; align-items: center; gap: 0.65rem; }
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.utilisateur-nom { font-weight: 600; font-size: 0.9rem; }
.utilisateur-role { font-size: 0.78rem; color: var(--primary); font-weight: 600; }

.bouton-mdp {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  background: #f3f5f7;
  color: var(--texte-sur-fond);
  font-size: 0.85rem;
}
.bouton-mdp:hover { background: var(--primary-light); color: var(--primary-dark); }

.bouton-deconnexion {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 8px;
  background: #fdecec;
  color: var(--danger);
}
.bouton-deconnexion:hover { background: var(--danger); color: #fff; }

/* ---------------------------------------------------------------------------
   CONTENU : toute la largeur de l'écran
   --------------------------------------------------------------------------- */
.contenu {
  flex: 1;
  padding: 1.75rem 2rem;
}

/* ---------------------------------------------------------------------------
   Petits écrans : on masque les textes secondaires
   --------------------------------------------------------------------------- */
@media (max-width: 900px) {
  .barre-haut { padding: 0.6rem 1rem; gap: 0.75rem; }
  .logo-sous-titre,
  .utilisateur-infos,
  .bouton-accueil span,
  .bouton-mdp span,
  .fil-ariane { display: none; }
  .contenu { padding: 1.25rem 1rem; }
}
</style>
