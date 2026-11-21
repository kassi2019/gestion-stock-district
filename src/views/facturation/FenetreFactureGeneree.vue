<!--
  =============================================================================
  FENÊTRE « FACTURE GÉNÉRÉE » (à partir du rapport centre validé)
  =============================================================================
  Fin de mois : le centre est servi selon son rapport.
    1. On choisit le CENTRE et la PÉRIODE (mois du rapport, par défaut le mois
       précédent) puis « Calculer ».
    2. L'application reprend le rapport VALIDÉ de ce mois (sinon message :
       pas de rapport / pas validé / déjà facturé) et propose, ligne par
       ligne, la quantité à commander (QaC) limitée au stock du district.
    3. Le gestionnaire VALIDE ou RÉDUIT chaque quantité (0 = non servi ;
       jamais plus que QaC : pour donner plus, faire une facture manuelle).
    4. Valider = facture créée, stock du district diminué (lots dont la
       péremption est la plus proche d'abord) ; impression à l'étape « Terminé ».
  Une seule facture générée par rapport (sauf si elle est annulée).

  Après validation, la MÊME fenêtre passe au paiement puis au récapitulatif
  (AssistantFacture.vue : ① Facture -> ② Paiement -> ③ Terminé).

  Événements : @fermer (rien créé) ; @creee(facture) -> fenêtre fermée après création
  =============================================================================
-->
<template>
  <AssistantFacture titre="Nouvelle facture générée (à partir du rapport du centre)" :facture="factureCreee" @fermer="emit('fermer')" @termine="(f) => emit('creee', f)">
    <p class="aide">
      Le rapport du mois doit être validé. Les quantités proposées viennent du rapport (quantité à commander,
      limitée au stock du district) : vous pouvez les valider ou les réduire.
    </p>

    <!-- 1. Centre et période -->
    <div class="choix">
      <div>
        <label class="obligatoire">Centre de santé</label>
        <ListeDeroulante v-model="choix.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" @update:model-value="proposition = null" />
      </div>
      <div>
        <label class="obligatoire">Mois du rapport</label>
        <ListeDeroulante v-model="choix.mois" :options="optionsMois" :effacable="false" @update:model-value="proposition = null" />
      </div>
      <div>
        <label class="obligatoire">Année</label>
        <input v-model.number="choix.annee" type="number" min="2020" max="2100" @change="proposition = null" />
      </div>
      <div class="bouton-calcul">
        <button type="button" :disabled="chargement" @click="calculer">{{ chargement ? 'Calcul…' : 'Calculer les quantités' }}</button>
      </div>
    </div>

    <!-- 2. Proposition ligne par ligne -->
    <template v-if="proposition">
      <div class="encart">
        Rapport <strong>{{ proposition.rapport.numero }}</strong> — {{ proposition.rapport.centre.nom }} —
        {{ libellePeriode(proposition.rapport.annee, proposition.rapport.mois) }}.
        Facture datée du <strong>{{ formaterDate(proposition.dateEmission) }}</strong>.
      </div>
      <div v-if="proposition.lignes.length" class="barre-export">
        <ImportExportTableau
          :titre="`Proposition de facture — ${proposition.rapport.centre.nom}`"
          :sous-titre="`Rapport ${proposition.rapport.numero} — ${libellePeriode(proposition.rapport.annee, proposition.rapport.mois)}`"
          :nom-fichier="`proposition_facture_${proposition.rapport.numero}`"
          :colonnes-pdf="COLONNES_EXPORT"
          :lignes="proposition.lignes"
        />
      </div>
      <table v-if="proposition.lignes.length" class="tableau lignes">
        <thead>
          <tr>
            <th>Code</th>
            <th>Produit</th>
            <th>Unité</th>
            <th class="nombre" title="Stock disponible au centre (rapport)">Stock centre</th>
            <th class="nombre" title="Consommation mensuelle moyenne (rapport)">CMM</th>
            <th class="nombre" title="Quantité à commander calculée par le rapport">À commander</th>
            <th class="nombre" title="Stock disponible au district (lots non périmés)">Stock district</th>
            <th class="nombre saisi">Quantité accordée</th>
            <th class="nombre">Prix de vente</th>
            <th class="nombre">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in proposition.lignes" :key="l.medicamentId">
            <td class="code">{{ l.medicament?.code }}</td>
            <td>{{ l.medicament?.designation }}</td>
            <td>{{ l.medicament?.uniteVente?.libelle || l.medicament?.unite }}</td>
            <td class="nombre">{{ formaterNombre(l.stockDisponibleCentre) }}</td>
            <td class="nombre">{{ formaterNombre(l.cmm) }}</td>
            <td class="nombre">{{ formaterNombre(l.quantiteACommander) }}</td>
            <td class="nombre">
              <span :class="{ rouge: l.stockDistrict < l.quantiteACommander }">{{ formaterNombre(l.stockDistrict) }}</span>
              <!-- Lots périmés : présents au dépôt mais NON servables -->
              <small v-if="l.stockPerime > 0" class="perime" title="Lots périmés : à sortir du stock">
                + {{ formaterNombre(l.stockPerime) }} périmé(s)
              </small>
            </td>
            <td class="nombre saisi">
              <input
                v-model.number="l.quantite"
                type="number"
                min="0"
                :max="Math.min(l.quantiteACommander, l.stockDistrict)"
                step="1"
                :class="{ 'champ-erreur': erreurLigne(l), reduite: !erreurLigne(l) && l.quantite < l.quantiteProposee }"
              />
            </td>
            <td class="nombre">
              <span v-if="l.prixVente !== null">{{ formaterMontant(l.prixVente) }}</span>
              <span v-else class="rouge petit" title="Définissez le prix dans Paramétrage > Prix">Prix non défini</span>
            </td>
            <td class="nombre"><strong>{{ formaterMontant((Number(l.quantite) || 0) * (l.prixVente || 0)) }}</strong></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="7" class="nombre"><strong>TOTAL</strong></td>
            <td class="nombre total">{{ formaterNombre(totalQuantite) }}</td>
            <td></td>
            <td class="nombre total">{{ formaterMontant(totalMontant) }}</td>
          </tr>
        </tfoot>
      </table>
      <p v-else class="tableau-vide">Aucune quantité à commander dans ce rapport : rien à facturer.</p>
      <p class="aide">
        Quantité accordée : réduisez-la si besoin (0 = produit non servi). Elle ne peut pas dépasser la quantité à commander
        ni le stock du district ; pour donner plus, faites une facture manuelle.
      </p>
    </template>

    <template #pied>
      <button class="bouton-secondaire" type="button" @click="emit('fermer')">Annuler</button>
      <button v-si-modif type="button" :disabled="!proposition || !proposition.lignes.length || enregistrement" @click="valider">
        Valider la facture et continuer →
      </button>
    </template>
  </AssistantFacture>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import AssistantFacture from './AssistantFacture.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { confirmer } from '@/utils/alertes'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { creerFactureGeneree, propositionFactureGeneree } from '@/api/facturation'
import { libellePeriode, MOIS } from '@/views/consommations/consommationsCommun'

const emit = defineEmits(['fermer', 'creee'])
const store = useStore()

// Période par défaut : le mois précédent (rapport qu'on sert en début de mois)
const aujourdhui = new Date()
const precedent = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1)
const choix = reactive({ centreId: null, annee: precedent.getFullYear(), mois: precedent.getMonth() + 1 })
const optionsMois = MOIS.map((libelle, i) => ({ id: i + 1, libelle }))

const proposition = ref(null)
const factureCreee = ref(null) // facture validée : l'assistant passe au paiement

/** Export PDF / Excel de la proposition (quantités accordées telles que saisies). */
const COLONNES_EXPORT = [
  { titre: 'Code', valeur: (l) => l.medicament?.code || '' },
  { titre: 'Produit', valeur: (l) => l.medicament?.designation || '' },
  { titre: 'Unité', valeur: (l) => l.medicament?.uniteVente?.libelle || l.medicament?.unite || '' },
  { titre: 'Stock centre', valeur: (l) => formaterNombre(l.stockDisponibleCentre), droite: true },
  { titre: 'CMM', valeur: (l) => formaterNombre(l.cmm), droite: true },
  { titre: 'À commander', valeur: (l) => formaterNombre(l.quantiteACommander), droite: true },
  { titre: 'Stock district', valeur: (l) => formaterNombre(l.stockDistrict), droite: true },
  { titre: 'Quantité accordée', valeur: (l) => formaterNombre(Number(l.quantite) || 0), droite: true, somme: (l) => Number(l.quantite) || 0 },
  { titre: 'Prix de vente', valeur: (l) => (l.prixVente === null ? 'Prix non défini' : formaterMontant(l.prixVente)), droite: true },
  { titre: 'Montant', valeur: (l) => formaterMontant((Number(l.quantite) || 0) * (l.prixVente || 0)), droite: true,
    somme: (l) => (Number(l.quantite) || 0) * (l.prixVente || 0), formatTotal: formaterMontant },
]
const chargement = ref(false)
const enregistrement = ref(false)

const centresActifs = computed(() => store.state.referentiel.centres.filter((c) => c.actif))
const lignesServies = computed(() => (proposition.value?.lignes || []).filter((l) => (Number(l.quantite) || 0) > 0))
const totalQuantite = computed(() => (proposition.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0), 0))
const totalMontant = computed(() => (proposition.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0) * (l.prixVente || 0), 0))

/** Quantité invalide : pas un entier >= 0, ou plus que QaC, ou plus que le stock du district. */
function erreurLigne(l) {
  const q = Number(l.quantite)
  return !Number.isInteger(q) || q < 0 || q > l.quantiteACommander || q > l.stockDistrict
}

/** Calcule la proposition à partir du rapport validé du mois choisi. */
async function calculer() {
  if (!choix.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  chargement.value = true
  proposition.value = null
  try {
    const p = await propositionFactureGeneree(choix)
    p.lignes.forEach((l) => (l.quantite = l.quantiteProposee))
    proposition.value = p
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

async function valider() {
  const lignes = proposition.value.lignes
  const mauvaise = lignes.find(erreurLigne)
  if (mauvaise) {
    return store.dispatch('notifications/erreur', `${mauvaise.medicament?.designation} : quantité entre 0 et ${Math.min(mauvaise.quantiteACommander, mauvaise.stockDistrict)}.`)
  }
  if (lignesServies.value.length === 0) return store.dispatch('notifications/erreur', 'Toutes les quantités sont à 0 : rien à facturer.')
  if (lignesServies.value.some((l) => l.prixVente === null)) {
    return store.dispatch('notifications/erreur', "Un produit n'a pas de prix de vente : définissez-le dans Paramétrage > Prix.")
  }

  const confirme = await confirmer({
    titre: 'Valider la facture ?',
    texte:
      `${lignesServies.value.length} produit(s) (${formaterNombre(totalQuantite.value)} unités, ${formaterMontant(totalMontant.value)}) ` +
      `SORTENT du stock du district vers « ${proposition.value.rapport.centre.nom} ». Une facture validée ne se modifie plus.`,
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return

  enregistrement.value = true
  try {
    const creee = await creerFactureGeneree(proposition.value.rapport.id, lignes.map((l) => ({ medicamentId: l.medicamentId, quantite: Number(l.quantite) || 0 })))
    store.dispatch('notifications/succes', `Facture ${creee.numero} validée : stock du district mis à jour.`)
    // Étape suivante (paiement) dans la même fenêtre ; impression à l'étape « Terminé »
    factureCreee.value = creee
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
})
</script>

<style scoped>
.aide { margin: 0 0 1rem; font-size: 0.85rem; color: var(--muted); }
.choix { display: grid; grid-template-columns: 2fr 1.2fr 0.8fr auto; gap: 0.75rem; align-items: end; margin-bottom: 1rem; }
.encart { margin-bottom: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 8px; background: var(--primary-light); color: var(--primary-dark); font-size: 0.88rem; }
.lignes td { padding: 0.45rem 0.4rem; }
.lignes th.saisi { background: var(--primary-light); }
.lignes input[type='number'] { width: 90px; text-align: right; }
.lignes input.reduite { background: #fff4e5; border-color: #f0b35b; }
.lignes .total { font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
.rouge { color: var(--danger); font-weight: 600; }
.perime { display: block; font-size: 0.75rem; color: var(--danger); font-style: italic; }
.petit { font-size: 0.8rem; }
.champ-erreur { border-color: var(--danger); }
@media (max-width: 900px) { .choix { grid-template-columns: 1fr 1fr; } }
/* Boutons PDF / Excel au-dessus du tableau, à droite */
.barre-export { display: flex; justify-content: flex-end; margin-bottom: 8px; }
</style>
