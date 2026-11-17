<!--
  =============================================================================
  FENÊTRE « FACTURE MANUELLE » (spec nov. 2026, §4)
  =============================================================================
  Facture complémentaire en cours de mois (urgence, rupture) :
  centre, date, et pour chaque produit la quantité livrée.
    - le PRIX DE VENTE est repris des paramètres (non modifiable) ;
    - le STOCK DISPONIBLE au district (lots non périmés) est affiché à côté :
      on ne peut pas facturer plus que ce stock (le serveur refuse aussi) ;
    - SEUIL MAXIMUM DU CENTRE : le centre ne doit pas avoir plus de
      2 x CMM (dernier rapport validé) ; on affiche ce qu'on peut encore lui
      donner et on bloque au-delà (le serveur refuse aussi) ;
    - VALIDER = la facture est créée et le stock du district diminue
      immédiatement (lots dont la péremption est la plus proche d'abord).
  Une facture validée ne se modifie pas (correction = annulation tracée).

  Événements : @fermer ; @creee(facture) -> l'onglet ouvre la facture créée
  =============================================================================
-->
<template>
  <FenetreModale titre="Nouvelle facture manuelle (sortie de stock)" tres-large @fermer="emit('fermer')">
    <p class="aide">
      Pour une urgence ou une rupture en cours de mois. Le prix de vente vient de Paramétrage &gt; Prix ;
      la quantité ne peut pas dépasser le stock disponible au district, ni le stock maximum du centre
      (2 × sa consommation mensuelle moyenne, moins ce qu'il a déjà).
    </p>

    <form id="form-facture-manuelle" class="grille-formulaire" @submit.prevent="valider">
      <div>
        <label class="obligatoire">Centre de santé</label>
        <ListeDeroulante v-model="formulaire.centreId" :options="centresActifs" champ-libelle="nom" placeholder="— Choisir le centre —" @update:model-value="actualiser" />
      </div>
      <div>
        <label class="obligatoire">Date de la facture</label>
        <input v-model="formulaire.dateEmission" type="date" :max="dateDuJour()" required @change="actualiser" />
      </div>

      <div class="pleine-largeur">
        <h4 class="section">Produits livrés</h4>
        <table class="tableau lignes">
          <thead>
            <tr>
              <th>Produit</th>
              <th class="nombre">Stock district</th>
              <th class="nombre" title="Stock maximum du centre = 2 × CMM (dernier rapport validé), moins son stock actuel">Max. centre</th>
              <th class="nombre">Quantité</th>
              <th class="nombre">Prix de vente</th>
              <th class="nombre">Montant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ligne, index) in formulaire.lignes" :key="ligne.cle">
              <td class="col-medicament">
                <ListeDeroulante
                  v-model="ligne.medicamentId"
                  :options="medicamentsActifs"
                  :champ-libelle="(m) => `${m.code} — ${m.designation} (stock : ${m.stockActuel})`"
                  placeholder="Choisir…"
                  @update:model-value="actualiser"
                />
              </td>
              <td class="nombre">
                <span v-if="info(ligne)" :class="{ rouge: depasse(ligne) }">{{ formaterNombre(info(ligne).stock) }}</span>
                <span v-else class="detail">—</span>
                <!-- Lots périmés : présents au dépôt mais NON servables -->
                <small v-if="info(ligne)?.perime > 0" class="perime bloc" title="Lots périmés : à sortir du stock">
                  + {{ formaterNombre(info(ligne).perime) }} périmé(s), non servable(s)
                </small>
              </td>
              <!-- Seuil maximum du centre : ce qu'on peut encore lui donner -->
              <td class="nombre">
                <template v-if="seuil(ligne)">
                  <span :class="{ rouge: depasseSeuil(ligne) }">{{ formaterNombre(seuil(ligne).maxDonnable) }}</span>
                  <small class="detail bloc" :title="`CMM ${seuil(ligne).cmm} × ${seuil(ligne).n}`">
                    a {{ formaterNombre(seuil(ligne).stockCentre) }} / max {{ formaterNombre(seuil(ligne).stockMax) }}
                  </small>
                </template>
                <span v-else-if="info(ligne) && formulaire.centreId" class="detail" title="Produit sans historique dans le dernier rapport validé">libre</span>
                <span v-else class="detail">—</span>
              </td>
              <td class="nombre">
                <input v-model.number="ligne.quantite" type="number" min="1" step="1" :class="{ 'champ-erreur': depasse(ligne) || depasseSeuil(ligne) }" />
                <small v-if="depasse(ligne)" class="rouge bloc">Stock insuffisant</small>
                <small v-else-if="depasseSeuil(ligne)" class="rouge bloc">Dépasse le max. du centre</small>
              </td>
              <td class="nombre">
                <span v-if="prixDe(ligne) !== null">{{ formaterMontant(prixDe(ligne)) }}</span>
                <span v-else-if="ligne.medicamentId && formulaire.centreId" class="rouge petit" title="Définissez le prix dans Paramétrage > Prix">Prix non défini</span>
                <span v-else class="detail">—</span>
              </td>
              <td class="nombre"><strong>{{ formaterMontant((Number(ligne.quantite) || 0) * (prixDe(ligne) || 0)) }}</strong></td>
              <td class="actions">
                <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="formulaire.lignes.splice(index, 1)">✕</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5"><button type="button" class="bouton-lien" @click="ajouterLigne">+ Ajouter un produit</button></td>
              <td class="nombre total">{{ formaterMontant(total) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </form>

    <template #pied>
      <button class="bouton-secondaire" type="button" @click="emit('fermer')">Annuler</button>
      <button v-si-modif type="submit" form="form-facture-manuelle" :disabled="enregistrement">Valider la facture (sortie de stock)</button>
    </template>
  </FenetreModale>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import FenetreModale from '@/components/FenetreModale.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterMontant, formaterNombre } from '@/utils/format'
import { creerFactureManuelle, infosSortie } from '@/api/facturation'

const emit = defineEmits(['fermer', 'creee'])
const store = useStore()

let compteur = 0
const nouvelleLigne = () => ({ cle: ++compteur, medicamentId: null, quantite: 1 })
const formulaire = reactive({ centreId: null, dateEmission: dateDuJour(), lignes: [nouvelleLigne()] })
const infos = ref({}) // { medicamentId: { stock, prixVente } }
const enregistrement = ref(false)

const centresActifs = computed(() => store.state.referentiel.centres.filter((c) => c.actif))
// Seulement les médicaments actifs AVEC du stock au dépôt (on ne peut pas servir un produit à 0)
const medicamentsActifs = computed(() => store.state.referentiel.medicaments.filter((m) => m.actif && m.stockActuel > 0))

function info(ligne) {
  return ligne.medicamentId ? infos.value[ligne.medicamentId] : null
}
function prixDe(ligne) {
  const i = info(ligne)
  return i && i.prixVente !== null && i.prixVente !== undefined ? Number(i.prixVente) : null
}
/** Quantité demandée (toutes les lignes du même produit) supérieure au stock du district ? */
function depasse(ligne) {
  const i = info(ligne)
  if (!i) return false
  const demande = formulaire.lignes.filter((l) => l.medicamentId === ligne.medicamentId).reduce((t, l) => t + (Number(l.quantite) || 0), 0)
  return demande > i.stock
}
/** Seuil maximum du centre pour ce produit (null = pas de limite). */
function seuil(ligne) {
  return info(ligne)?.seuil ?? null
}
/** Quantité demandée (toutes les lignes du produit) supérieure à ce qu'on peut encore donner au centre ? */
function depasseSeuil(ligne) {
  const s = seuil(ligne)
  if (!s) return false
  const demande = formulaire.lignes.filter((l) => l.medicamentId === ligne.medicamentId).reduce((t, l) => t + (Number(l.quantite) || 0), 0)
  return demande > s.maxDonnable
}
const total = computed(() => formulaire.lignes.reduce((t, l) => t + (Number(l.quantite) || 0) * (prixDe(l) || 0), 0))

function ajouterLigne() {
  formulaire.lignes.push(nouvelleLigne())
}

/** Stock du district et prix de vente des produits choisis (centre + date). */
async function actualiser() {
  const ids = [...new Set(formulaire.lignes.map((l) => l.medicamentId).filter(Boolean))]
  try {
    infos.value = await infosSortie({ medicamentIds: ids, centreId: formulaire.centreId, date: formulaire.dateEmission })
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
}

async function valider() {
  if (!formulaire.centreId) return store.dispatch('notifications/erreur', 'Choisissez le centre de santé.')
  const lignes = formulaire.lignes.filter((l) => l.medicamentId)
  if (lignes.length === 0) return store.dispatch('notifications/erreur', 'Ajoutez au moins un produit.')
  if (lignes.some((l) => !(Number(l.quantite) >= 1))) return store.dispatch('notifications/erreur', 'Chaque quantité doit être au moins 1.')
  const ids = lignes.map((l) => l.medicamentId)
  if (new Set(ids).size !== ids.length) return store.dispatch('notifications/erreur', 'Un même produit apparaît plusieurs fois : regroupez les quantités.')
  if (lignes.some(depasse)) return store.dispatch('notifications/erreur', 'Une quantité dépasse le stock disponible au district.')
  const auDela = lignes.find(depasseSeuil)
  if (auDela) {
    const s = seuil(auDela)
    return store.dispatch('notifications/erreur', `Le centre a déjà ${s.stockCentre} en stock pour un maximum de ${s.stockMax} : on peut lui donner au plus ${s.maxDonnable}.`)
  }
  if (lignes.some((l) => prixDe(l) === null)) return store.dispatch('notifications/erreur', 'Un produit n\'a pas de prix de vente : définissez-le dans Paramétrage > Prix.')

  const centre = centresActifs.value.find((c) => c.id === formulaire.centreId)
  const confirme = await confirmer({
    titre: 'Valider la facture ?',
    texte: `Les ${lignes.length} produit(s) SORTENT du stock du district vers « ${centre?.nom} » (${formaterMontant(total.value)}). Une facture validée ne se modifie plus.`,
    boutonConfirmer: 'Oui, valider',
  })
  if (!confirme) return

  enregistrement.value = true
  try {
    const facture = await creerFactureManuelle({
      centreId: formulaire.centreId,
      dateEmission: formulaire.dateEmission,
      lignes: lignes.map((l) => ({ medicamentId: l.medicamentId, quantite: Number(l.quantite) })),
    })
    store.dispatch('notifications/succes', `Facture ${facture.numero} validée : stock du district mis à jour.`)
    emit('creee', facture)
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

onMounted(() => {
  store.dispatch('referentiel/charger', { liste: 'centres' }).catch(() => {})
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
})
</script>

<style scoped>
.aide { margin: 0 0 1rem; font-size: 0.85rem; color: var(--muted); }
.section {
  margin: 0.25rem 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.lignes td { padding: 0.45rem 0.4rem; }
.lignes .col-medicament { min-width: 280px; }
.lignes input[type='number'] { width: 90px; text-align: right; }
.lignes .total { font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
.detail { font-size: 0.78rem; color: var(--muted); }
.rouge { color: var(--danger); font-weight: 600; }
.petit { font-size: 0.8rem; }
.bloc { display: block; font-size: 0.75rem; }
.perime { color: var(--danger); font-style: italic; }
.champ-erreur { border-color: var(--danger); }
</style>
