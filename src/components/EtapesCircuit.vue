<!--
  =============================================================================
  BARRE D'ÉTAPES D'UN CIRCUIT (assistant « pas à pas »)
  =============================================================================
  Affichée en haut d'une fenêtre (commande, livraison, réception, rapport) pour
  montrer où en est le document dans son circuit :

      ① Commande ──── ② Accord ──── ③ Préparation ──── ④ Livraison ──── ⑤ Bon
          ✔               ✔              ● en cours

  - étapes AVANT « courante » : terminées (coche verte) ;
  - étape « courante »        : en cours (pastille verte pleine) ;
  - étapes APRÈS              : à venir (grises).
  Si « courante » vaut le nombre d'étapes (ou plus) : tout est terminé.

  Utilisation :
      <EtapesCircuit
        :etapes="['Commande', 'Accord', 'Préparation', 'Livraison', 'Bon de livraison']"
        :courante="2"
        aide="Vérifiez les quantités à préparer puis enregistrez la préparation."
      />

  Propriétés :
    - etapes   : libellés des étapes, dans l'ordre ;
    - courante : numéro de l'étape en cours (0 = la première) ;
    - aide     : (facultatif) phrase « Prochaine action » affichée dessous.
  =============================================================================
-->
<template>
  <div class="circuit-etapes">
    <ol class="etapes">
      <li
        v-for="(libelle, index) in etapes"
        :key="libelle"
        class="etape"
        :class="{ faite: index < courante, encours: index === courante }"
        :aria-current="index === courante ? 'step' : null"
      >
        <span class="pastille">
          <template v-if="index < courante">✔</template>
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="libelle">{{ libelle }}</span>
      </li>
    </ol>
    <p v-if="aide" class="aide">
      <strong>{{ courante >= etapes.length ? 'Terminé' : 'Prochaine action' }} :</strong> {{ aide }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  etapes: { type: Array, required: true },
  courante: { type: Number, default: 0 },
  aide: { type: String, default: '' },
})
</script>

<style scoped>
.circuit-etapes {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem 0.7rem;
  border-radius: 10px;
  background: var(--primary-light);
}
.etapes {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}
.etape {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}
/* Trait qui relie une étape à la suivante */
.etape + .etape::before {
  content: '';
  position: absolute;
  top: 14px;
  right: 50%;
  width: 100%;
  height: 3px;
  background: #d5dbd8;
  z-index: 0;
}
.etape.faite::before,
.etape.encours::before { background: var(--primary); }

.pastille {
  position: relative;
  z-index: 1;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid #d5dbd8;
  background: #fff;
  font-size: 0.8rem;
  font-weight: 800;
}
.etape.faite .pastille { border-color: var(--primary); background: var(--primary); color: #fff; }
.etape.encours .pastille {
  border-color: var(--primary);
  color: var(--primary-dark);
  box-shadow: 0 0 0 4px rgba(0, 163, 108, 0.2);
}
.etape.faite .libelle { color: var(--primary-dark); }
.etape.encours .libelle { color: var(--texte-sur-fond); font-weight: 800; }

.aide {
  margin: 0.7rem 0 0;
  font-size: 0.85rem;
  color: var(--primary-dark);
  text-align: center;
}
</style>
