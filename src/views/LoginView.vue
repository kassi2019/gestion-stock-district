<!--
  =============================================================================
  ÉCRAN DE CONNEXION
  =============================================================================
  Mise en page plein écran en deux blocs :
    - À GAUCHE : bloc visuel vert (comme le bandeau de l'accueil), illustration ;
    - À DROITE : formulaire de connexion dans une carte blanche avec ombre.
  Couleurs : vert (principale) + vert clair (secondaire) sur blanc, variables dans src/style.css.
  Sur petit écran (téléphone, tablette), le bloc de gauche est masqué.

  Fonctionnement :
    - succès : redirection vers la page demandée (ou le tableau de bord) ;
    - échec  : affichage du message d'erreur renvoyé par le backend.

  ➜ Pour remplacer l'illustration par une vraie photo : mettre l'image dans
    src/assets/ et changer l'import "illustration" ci-dessous.
  =============================================================================
-->
<template>
  <div class="page-connexion">
    <!-- ===================== BLOC GAUCHE : IMAGE ===================== -->
    <section class="bloc-image">
      <!-- Bande dégradée vert -> vert clair en haut -->
      <div class="bande-couleurs"></div>

      <div class="contenu-image">
        <img :src="illustration" alt="Dépôt de médicaments" class="illustration" />

        <h2>Gestion des stocks et de la facturation</h2>
        <p>
          Suivi des achats, du dépôt, des livraisons aux centres de santé,
          des consommations mensuelles et des paiements.
        </p>

        <!-- Points forts de l'application -->
        <ul class="points-forts">
          <li>Stock du dépôt et des centres en temps réel</li>
          <li>Facturation basée sur les consommations validées</li>
          <li>Traçabilité complète des opérations</li>
        </ul>
      </div>

      <p class="pied-image">District sanitaire — Côte d'Ivoire</p>
    </section>

    <!-- ===================== BLOC DROIT : FORMULAIRE ===================== -->
    <section class="bloc-formulaire">
      <form class="formulaire" @submit.prevent="seConnecter">
        <!-- Logo (croix médicale) + nom de l'application -->
        <div class="logo">
          <div class="logo-croix">+</div>
          <div>
            <div class="logo-titre">Stock <span>District</span></div>
            <div class="logo-sous-titre">District sanitaire</div>
          </div>
        </div>

        <h1>Connexion</h1>
        <p class="sous-titre">Saisissez vos identifiants pour accéder à l'application.</p>

        <!-- Champ identifiant -->
        <div class="champ">
          <!-- L'identifiant de connexion est le MATRICULE de la personne -->
          <label for="login">Identifiant (matricule)</label>
          <input
            id="login"
            v-model.trim="formulaire.login"
            autocomplete="username"
            placeholder="Votre matricule (ex. PER-0002)"
            required
          />
        </div>

        <!-- Champ mot de passe, avec bouton afficher / masquer -->
        <div class="champ">
          <label for="mdp">Mot de passe</label>
          <div class="champ-mdp">
            <input
              id="mdp"
              v-model="formulaire.motDePasse"
              :type="afficherMotDePasse ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Votre mot de passe"
              required
            />
            <button
              type="button"
              class="bouton-oeil"
              @click="afficherMotDePasse = !afficherMotDePasse"
            >
              {{ afficherMotDePasse ? 'Masquer' : 'Afficher' }}
            </button>
          </div>
        </div>

        <!-- Message d'erreur (affiché seulement s'il y en a un) -->
        <p v-if="messageErreur" class="message-erreur">{{ messageErreur }}</p>
        <!-- Retour après une déconnexion automatique (inactivité) -->
        <p v-else-if="route.query.raison === 'inactivite'" class="message-info">
          Vous avez été déconnecté automatiquement après une période d'inactivité. Reconnectez-vous pour continuer.
        </p>

        <button type="submit" class="bouton-connexion" :disabled="enCours">
          {{ enCours ? 'Connexion en cours…' : 'Se connecter' }}
        </button>

        <p class="aide">
          Mot de passe oublié ? Contactez l'administrateur de l'application.
        </p>
      </form>

      <p class="copyright">© {{ anneeEnCours }} — District sanitaire</p>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import illustration from '@/assets/illustration-login.svg'

const store = useStore()
const router = useRouter()
const route = useRoute()

// Données du formulaire (liées aux champs par v-model)
const formulaire = reactive({ login: '', motDePasse: '' })

// true pendant l'appel au backend (désactive le bouton)
const enCours = ref(false)

// Message d'erreur à afficher
const messageErreur = ref('')

// Afficher le mot de passe en clair ou non
const afficherMotDePasse = ref(false)

// Année affichée en bas de page
const anneeEnCours = new Date().getFullYear()

/** Appelée quand on valide le formulaire. */
async function seConnecter() {
  enCours.value = true
  messageErreur.value = ''

  try {
    await store.dispatch('auth/login', { ...formulaire })
    // Retour à la page demandée avant la connexion, sinon l'accueil
    router.push(route.query.redirect || '/')
  } catch (erreur) {
    // Message envoyé par le backend, ou message par défaut
    // (ex. backend arrêté ou réseau coupé)
    messageErreur.value = erreur.response?.data?.message || 'Connexion impossible. Vérifiez le réseau.'
  } finally {
    enCours.value = false
  }
}
</script>

<style scoped>
/* ---------------------------------------------------------------------------
   Page entière : deux colonnes qui occupent tout l'écran
   --------------------------------------------------------------------------- */
.page-connexion {
  display: grid;
  grid-template-columns: 1.1fr 1fr; /* bloc image un peu plus large */
  min-height: 100vh;
  background: #fff;
}

/* ---------------------------------------------------------------------------
   BLOC GAUCHE : image sur le même vert que le bandeau de l'accueil
   --------------------------------------------------------------------------- */
.bloc-image {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3rem;
  /* Même vert que le bandeau de la page d'accueil */
  color: #fff;
  background:
    radial-gradient(circle at 90% -10%, rgba(255, 255, 255, 0.18) 0, transparent 45%),
    linear-gradient(120deg, var(--primary) 0%, var(--primary-dark) 100%);
  overflow: hidden;
}

/* Cercle blanc translucide décoratif en haut à droite */
.bloc-image::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -120px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: #fff;
  opacity: 0.1;
}

/* Bande dégradée en haut */
.bande-couleurs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  /* vert menthe -> blanc : visible sur le fond vert */
  background: linear-gradient(90deg, var(--accent), #fff);
}

.contenu-image {
  position: relative; /* au-dessus du cercle décoratif */
  max-width: 480px;
  margin: 0 auto;
}

.illustration {
  display: block;
  width: 100%;
  max-width: 380px;
  margin: 0 auto 2rem;
}

.bloc-image h2 {
  color: #fff;
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  line-height: 1.25;
}

.bloc-image p {
  margin: 0;
  line-height: 1.6;
  opacity: 0.9;
}

/* Liste des points forts avec puce blanche (coche verte) */
.points-forts {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
}
.points-forts li {
  position: relative;
  padding-left: 1.75rem;
  margin-bottom: 0.6rem;
}
.points-forts li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  background: #fff;
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.pied-image {
  position: absolute;
  bottom: 1.5rem;
  left: 3rem;
  font-size: 0.85rem;
  opacity: 0.75;
}

/* ---------------------------------------------------------------------------
   BLOC DROIT : formulaire sur fond blanc
   --------------------------------------------------------------------------- */
.bloc-formulaire {
  position: relative;
  min-width: 0; /* évite tout débordement horizontal */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  /* Fond gris très clair + deux halos (vert en haut, vert clair en bas)
     pour que la carte blanche du formulaire ressorte */
  background:
    radial-gradient(circle at 85% 10%, rgba(0, 163, 108, 0.10) 0, transparent 40%),
    radial-gradient(circle at 15% 90%, rgba(76, 195, 138, 0.10) 0, transparent 40%),
    #f3f5f7;
  /* Ombre intérieure à gauche : effet de profondeur à la jonction des deux blocs */
  box-shadow: inset 12px 0 24px -12px rgba(0, 0, 0, 0.18);
}

/* Le formulaire est une "carte" blanche surélevée (ombre portée) */
.formulaire {
  position: relative;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 2.5rem 2.25rem;
  background: #fff;
  border-radius: 16px;
  /* Deux ombres superposées : une nette et proche, une large et diffuse */
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.06),
    0 18px 40px rgba(0, 0, 0, 0.12);
  overflow: hidden; /* pour que le liseré du haut suive l'arrondi */
}

/* Liseré dégradé vert -> vert clair en haut de la carte */
.formulaire::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
}

/* Logo : croix blanche sur carré dégradé vert -> vert clair */
.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.logo-croix {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  line-height: 1;
}
.logo-titre {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--primary);
}
.logo-titre span { color: var(--accent-dark); }
.logo-sous-titre {
  font-size: 0.8rem;
  color: var(--muted);
}

.formulaire h1 {
  margin: 0;
  font-size: 1.9rem;
  color: var(--text);
}
.sous-titre {
  margin: -0.5rem 0 0.5rem;
  color: var(--muted);
}

/* Champs de saisie */
.champ label {
  font-weight: 600;
  color: var(--text);
}
.champ input {
  padding: 0.75rem 0.9rem;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: #fafafa;
  transition: border-color 0.2s, box-shadow 0.2s;
}
/* Champ actif : bordure verte */
.champ input:focus {
  outline: none;
  border-color: var(--primary);
  background: #fff;
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* Mot de passe + bouton Afficher/Masquer dans le champ */
.champ-mdp { position: relative; }
.champ-mdp input { padding-right: 5.5rem; }
.bouton-oeil {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.35rem 0.6rem;
  background: transparent;
  color: var(--primary);
  font-size: 0.8rem;
}
.bouton-oeil:hover { background: var(--primary-light); }

.message-info {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: #fff4e5;
  color: #8a5a00;
  font-size: 0.85rem;
}
.message-erreur {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-left: 4px solid var(--danger);
  border-radius: 6px;
  background: #fef2f2;
  color: var(--danger);
  font-size: 0.9rem;
}

/* Bouton principal : vert, devient vert foncé au survol */
.bouton-connexion {
  padding: 0.85rem;
  border-radius: 8px;
  font-size: 1rem;
  background: var(--primary);
  transition: background 0.2s, transform 0.1s;
}
.bouton-connexion:hover:not(:disabled) { background: var(--primary-dark); }
.bouton-connexion:active:not(:disabled) { transform: scale(0.99); }

.aide {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
}

.copyright {
  position: absolute;
  bottom: 1.25rem;
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

/* ---------------------------------------------------------------------------
   Petits écrans : on masque le bloc image, le formulaire prend toute la largeur
   --------------------------------------------------------------------------- */
@media (max-width: 900px) {
  .page-connexion { grid-template-columns: 1fr; }
  .bloc-image { display: none; }
  /* Bande de couleurs en haut du formulaire pour garder l'identité visuelle */
  .bloc-formulaire {
    border-top: 6px solid var(--primary);
    box-shadow: none; /* plus de jonction avec le bloc image */
    padding: 2rem 1rem;
  }
  .formulaire { padding: 2rem 1.5rem; }
}
</style>
