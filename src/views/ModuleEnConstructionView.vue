<!--
  =============================================================================
  PAGE PROVISOIRE "MODULE EN COURS DE DÉVELOPPEMENT"
  =============================================================================
  Affichée pour tout module de src/config/modules.js qui n'a pas encore
  d'écran (propriété "vue" absente). Les informations du module (titre,
  icône, description) sont lues dans la route (meta.module).
  =============================================================================
-->
<template>
  <div class="carte-construction">
    <div class="icone" :class="module?.couleur">
      <Icone :nom="module?.icone || 'outil'" :taille="40" />
    </div>
    <h2>{{ module?.titre }}</h2>
    <p class="description">{{ module?.description }}</p>
    <p class="message">
      <Icone nom="outil" :taille="16" />
      Ce module est en cours de développement et sera disponible prochainement.
    </p>
    <router-link to="/" class="bouton-retour">Retour à l'accueil</router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icone from '@/components/Icone.vue'

const route = useRoute()

// Module correspondant à la page (défini dans src/router/index.js)
const module = computed(() => route.meta.module)
</script>

<style scoped>
.carte-construction {
  max-width: 560px;
  margin: 3rem auto;
  padding: 3rem 2rem;
  text-align: center;
  background: #fff;
  border-radius: 16px;
  border-top: 5px solid var(--primary);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 12px 32px rgba(0, 0, 0, 0.08);
}
.icone {
  width: 84px;
  height: 84px;
  margin: 0 auto 1.25rem;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: var(--primary-light);
  color: var(--primary);
}
.icone.secondaire { background: var(--accent-light); color: var(--accent-dark); }
h2 { margin: 0 0 0.5rem; }
.description { margin: 0 0 1.5rem; color: var(--muted); }
.message {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  background: var(--accent-light);
  color: var(--accent-dark);
  font-size: 0.9rem;
}
.bouton-retour {
  display: inline-block;
  margin-top: 1.75rem;
  padding: 0.7rem 1.4rem;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
.bouton-retour:hover { background: var(--accent); }
</style>
