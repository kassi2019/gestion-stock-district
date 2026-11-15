<!--
  =============================================================================
  FENÊTRE « MON MOT DE PASSE » (ouverte à tous les profils)
  =============================================================================
  Permet à l'utilisateur connecté de changer son propre mot de passe.
  Ouverte depuis le bouton « Mon mot de passe » de la barre du haut
  (src/layouts/MainLayout.vue).

  Comme toutes les fenêtres : elle reste ouverte après l'enregistrement
  (champs vidés), c'est l'utilisateur qui la ferme.
  =============================================================================
-->
<template>
  <FenetreModale titre="Changer mon mot de passe" @fermer="emit('fermer')">
    <form id="form-mon-mdp" class="formulaire-mdp" @submit.prevent="enregistrer">
      <div>
        <label class="obligatoire">Mot de passe actuel</label>
        <ChampMotDePasse v-model="champs.ancien" autocomplete="current-password" obligatoire />
      </div>
      <div>
        <label class="obligatoire">Nouveau mot de passe</label>
        <ChampMotDePasse v-model="champs.nouveau" obligatoire placeholder="8 caractères, lettres et chiffres" />
      </div>
      <div>
        <label class="obligatoire">Confirmation du nouveau mot de passe</label>
        <ChampMotDePasse v-model="champs.confirmation" obligatoire />
      </div>
      <p class="aide">Au moins 8 caractères, dont au moins une lettre et un chiffre.</p>
    </form>

    <template #pied>
      <button class="bouton-secondaire" @click="emit('fermer')">Fermer</button>
      <button type="submit" form="form-mon-mdp" :disabled="enregistrement">
        {{ enregistrement ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </template>
  </FenetreModale>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ChampMotDePasse from '@/components/ChampMotDePasse.vue'
import { changerMonMotDePasse, verifierMotDePasse } from '@/api/utilisateurs'

const emit = defineEmits(['fermer'])
const store = useStore()

const champs = reactive({ ancien: '', nouveau: '', confirmation: '' })
const enregistrement = ref(false)

async function enregistrer() {
  const erreurMdp = verifierMotDePasse(champs.nouveau, champs.confirmation)
  if (erreurMdp) {
    store.dispatch('notifications/erreur', erreurMdp)
    return
  }
  enregistrement.value = true
  try {
    await changerMonMotDePasse(champs.ancien, champs.nouveau)
    store.dispatch('notifications/succes', 'Votre mot de passe a été modifié.')
    // Champs vidés (la fenêtre reste ouverte)
    champs.ancien = ''
    champs.nouveau = ''
    champs.confirmation = ''
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}
</script>

<style scoped>
.formulaire-mdp { display: flex; flex-direction: column; gap: 0.9rem; }
.aide { margin: 0; font-size: 0.8rem; color: var(--muted); }
</style>
