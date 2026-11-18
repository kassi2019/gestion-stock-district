<!--
  =============================================================================
  ONGLET « INVENTAIRE INITIAL » (spec nov. 2026, §2) — ADMINISTRATEUR SEULEMENT
  =============================================================================
  Écran utilisé UNE SEULE FOIS, à la mise en service :
    - à gauche, le district et chaque centre de santé, avec ce qui est déjà saisi ;
    - à droite, le stock de départ de l'entité choisie, produit par produit
      (le district est suivi par lot : n° de lot + péremption).
  Si rien n'a encore été saisi, la liste est PRÉ-REMPLIE avec le stock actuel.

  ENREGISTRER = la liste devient le stock de l'entité (les écarts sont passés
  en mouvements tracés « Inventaire initial » ; un produit retiré revient à 0).
  Ce stock sera le stock initial (SI) du premier rapport centre.
  VERROUILLÉ dès que le premier rapport centre est validé.

  Événement : @modifie -> la page Stock recharge l'état du stock
  =============================================================================
-->
<template>
  <div class="inventaire-initial">
    <!-- Bandeau : verrouillé ou non -->
    <div v-if="etat?.verrouille" class="bandeau verrouille">
      <strong>Inventaire initial verrouillé.</strong>
      Un premier rapport centre a été validé : le stock de départ ne peut plus être modifié (consultation seulement).
    </div>
    <div v-else class="bandeau">
      <strong>À faire une seule fois, à la mise en service.</strong>
      Saisissez le stock de départ du district puis de chaque centre. Enregistrer remplace le stock actuel de l'entité par ces quantités.
    </div>

    <div class="disposition">
      <!-- ===== Entités (district + centres) ===== -->
      <aside class="entites">
        <h4 class="section">Entités</h4>
        <button
          v-for="e in etat?.entites || []"
          :key="cleEntite(e.centreId)"
          type="button"
          class="entite"
          :class="{ actif: entite === cleEntite(e.centreId) }"
          @click="choisir(e.centreId)"
        >
          <span class="nom">{{ e.nom }}</span>
          <span v-if="e.nbLignes > 0" class="badge badge-vert">{{ e.nbLignes }} ligne(s)</span>
          <span v-else class="badge badge-gris">À saisir</span>
        </button>
      </aside>

      <!-- ===== Lignes de l'entité choisie ===== -->
      <section class="saisie">
        <p v-if="!formulaire" class="tableau-vide">{{ chargement ? 'Chargement…' : 'Choisissez le district ou un centre.' }}</p>
        <template v-else>
          <div class="entete-saisie">
            <h3>{{ nomEntite }}</h3>
            <small v-if="formulaire.source === 'STOCK_ACTUEL'" class="detail">
              Pas encore saisi : la liste est pré-remplie avec le stock actuel. Vérifiez puis enregistrez.
            </small>
            <small v-else class="detail">Inventaire enregistré au {{ formaterDate(formulaire.dateInventaire) }}.</small>
          </div>

          <div class="barre-outils">
            <div>
              <label class="obligatoire">Date de mise en service</label>
              <ChampDate v-model="formulaire.dateInventaire" :max="dateDuJour()" :desactive="lectureSeule" />
            </div>
            <input v-model="recherche" class="recherche" type="search" placeholder="Filtrer les lignes…" />
            <span class="espace"></span>
            <ImportExportTableau
              :titre="`Inventaire initial — ${nomEntite}`"
              :sous-titre="`Au ${formaterDate(formulaire.dateInventaire)}`"
              :nom-fichier="`inventaire_initial_${estDistrict ? 'district' : 'centre_' + entite}`"
              :colonnes-pdf="colonnesExport"
              :lignes="lignesExport"
            />
            <button v-if="!lectureSeule" type="button" class="bouton-secondaire" @click="ajouterTous">
              + Tous les médicaments actifs
            </button>
          </div>

          <div class="tableau-conteneur">
            <table class="tableau lignes">
              <thead>
                <tr>
                  <th>Médicament</th>
                  <template v-if="estDistrict">
                    <th>N° de lot</th>
                    <th>Péremption</th>
                  </template>
                  <th class="nombre">Quantité</th>
                  <th v-if="!lectureSeule"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ligne in lignesAffichees" :key="ligne.cle">
                  <td class="col-medicament">
                    <ListeDeroulante
                      v-if="!lectureSeule"
                      v-model="ligne.medicamentId"
                      :options="medicamentsActifs"
                      :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                      placeholder="Choisir…"
                    />
                    <span v-else>{{ libelleMedicament(ligne.medicamentId) }}</span>
                    <small v-if="estDistrict && suiviLot(ligne.medicamentId)" class="detail lot-requis">lot et péremption obligatoires</small>
                  </td>
                  <template v-if="estDistrict">
                    <td><input v-model.trim="ligne.numeroLot" maxlength="50" class="champ-lot" :disabled="lectureSeule" /></td>
                    <td><ChampDate v-model="ligne.datePeremption" :desactive="lectureSeule" /></td>
                  </template>
                  <td class="nombre"><input v-model.number="ligne.quantite" type="number" min="0" step="1" :disabled="lectureSeule" /></td>
                  <td v-if="!lectureSeule" class="actions">
                    <button v-if="estDistrict" type="button" class="bouton-lien" title="Même médicament, autre lot" @click="ajouterLot(ligne)">+ lot</button>
                    <button type="button" class="bouton-lien danger" title="Retirer la ligne" @click="retirer(ligne)">✕</button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td :colspan="estDistrict ? 3 : 1">
                    <button v-if="!lectureSeule" type="button" class="bouton-lien" @click="ajouterLigne">+ Ajouter un médicament</button>
                  </td>
                  <td class="nombre total">{{ formaterNombre(totalQuantites) }}</td>
                  <td v-if="!lectureSeule"></td>
                </tr>
              </tfoot>
            </table>
            <p v-if="formulaire.lignes.length === 0" class="tableau-vide">Aucun produit en stock pour cette entité.</p>
          </div>

          <div v-if="!lectureSeule" class="pied">
            <button type="button" class="bouton-secondaire" :disabled="enregistrement" @click="choisir(entiteCentreId)">Annuler les changements</button>
            <button v-si-modif type="button" :disabled="enregistrement" @click="enregistrer">Enregistrer le stock de départ</button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
import ChampDate from '@/components/ChampDate.vue'
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import ImportExportTableau from '@/components/ImportExportTableau.vue'
import { confirmer } from '@/utils/alertes'
import { dateDuJour, formaterDate, formaterNombre } from '@/utils/format'
import { enregistrerInventaireInitial, etatInventaireInitial, lireInventaireInitial } from '@/api/stock'

const emit = defineEmits(['modifie'])
const store = useStore()

const etat = ref(null) // { verrouille, entites }
const entite = ref(null) // 'district' ou id du centre (texte)
const formulaire = ref(null) // { source, dateInventaire, lignes }
const chargement = ref(false)
const enregistrement = ref(false)
const recherche = ref('')
let compteur = 0 // clé unique des lignes (affichage)

const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))

/** 'district' pour le district (centreId null), sinon l'id du centre. */
function cleEntite(centreId) {
  return centreId === null ? 'district' : String(centreId)
}
const estDistrict = computed(() => entite.value === 'district')
const entiteCentreId = computed(() => (estDistrict.value ? null : Number(entite.value)))
const nomEntite = computed(() => etat.value?.entites.find((e) => cleEntite(e.centreId) === entite.value)?.nom || '')
const lectureSeule = computed(() => !!etat.value?.verrouille)

function medicament(id) {
  return medicaments.value.find((m) => m.id === id)
}
function libelleMedicament(id) {
  const m = medicament(id)
  return m ? `${m.code} — ${m.designation}` : '—'
}
function suiviLot(id) {
  return !!medicament(id)?.suiviLot
}

function nouvelleLigne(medicamentId = null, quantite = 0, numeroLot = '', datePeremption = '') {
  return { cle: ++compteur, medicamentId, quantite, numeroLot, datePeremption }
}

/** Lignes filtrées par la recherche (sur le libellé du médicament ou le lot). */
// ---------------------------------------------------------------------------
// EXPORT PDF / EXCEL : lignes affichées ayant un médicament
// ---------------------------------------------------------------------------
const lignesExport = computed(() => lignesAffichees.value.filter((l) => l.medicamentId))
const colonnesExport = computed(() => [
  { titre: 'Médicament', valeur: (l) => libelleMedicament(l.medicamentId) },
  ...(estDistrict.value
    ? [
        { titre: 'N° de lot', valeur: (l) => l.numeroLot || '' },
        { titre: 'Péremption', valeur: (l) => (l.datePeremption ? formaterDate(l.datePeremption) : '') },
      ]
    : []),
  { titre: 'Quantité', valeur: (l) => formaterNombre(Number(l.quantite) || 0), droite: true, somme: (l) => Number(l.quantite) || 0 },
])

const lignesAffichees = computed(() => {
  const texte = recherche.value.toLowerCase()
  const lignes = formulaire.value?.lignes || []
  if (!texte) return lignes
  return lignes.filter((l) => `${libelleMedicament(l.medicamentId)} ${l.numeroLot || ''}`.toLowerCase().includes(texte))
})

const totalQuantites = computed(() => (formulaire.value?.lignes || []).reduce((t, l) => t + (Number(l.quantite) || 0), 0))

// ---------------------------------------------------------------------------
// CHARGEMENT
// ---------------------------------------------------------------------------

async function chargerEtat() {
  etat.value = await etatInventaireInitial()
}

/** Ouvre une entité (district ou centre) : lignes saisies, sinon stock actuel. */
async function choisir(centreId) {
  entite.value = cleEntite(centreId)
  formulaire.value = null
  recherche.value = ''
  chargement.value = true
  try {
    const d = await lireInventaireInitial(entite.value)
    formulaire.value = {
      source: d.source,
      dateInventaire: d.dateInventaire ? d.dateInventaire.substring(0, 10) : dateDuJour(),
      lignes: d.lignes.map((l) =>
        nouvelleLigne(l.medicamentId, l.quantite, l.numeroLot || '', l.datePeremption ? l.datePeremption.substring(0, 10) : ''),
      ),
    }
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    chargement.value = false
  }
}

// ---------------------------------------------------------------------------
// LIGNES
// ---------------------------------------------------------------------------

function ajouterLigne() {
  formulaire.value.lignes.push(nouvelleLigne())
}

/** Ajoute (quantité 0) chaque médicament actif qui n'est pas encore dans la liste. */
function ajouterTous() {
  const presents = new Set(formulaire.value.lignes.map((l) => l.medicamentId))
  const manquants = medicamentsActifs.value.filter((m) => !presents.has(m.id))
  for (const m of manquants) formulaire.value.lignes.push(nouvelleLigne(m.id))
  store.dispatch('notifications/info', `${manquants.length} médicament(s) ajouté(s) avec la quantité 0.`)
}

/** District : même médicament dans un autre lot (ligne juste en dessous). */
function ajouterLot(ligne) {
  const index = formulaire.value.lignes.indexOf(ligne)
  formulaire.value.lignes.splice(index + 1, 0, nouvelleLigne(ligne.medicamentId))
}

function retirer(ligne) {
  formulaire.value.lignes.splice(formulaire.value.lignes.indexOf(ligne), 1)
}

// ---------------------------------------------------------------------------
// ENREGISTREMENT
// ---------------------------------------------------------------------------

async function enregistrer() {
  const f = formulaire.value
  if (!f.dateInventaire) return store.dispatch('notifications/erreur', 'Indiquez la date de mise en service.')
  const lignes = f.lignes.filter((l) => l.medicamentId)
  if (lignes.some((l) => !(Number(l.quantite) >= 0) || !Number.isInteger(Number(l.quantite)))) {
    return store.dispatch('notifications/erreur', 'Chaque quantité doit être un nombre entier positif ou nul.')
  }
  if (estDistrict.value) {
    const sansLot = lignes.find((l) => suiviLot(l.medicamentId) && Number(l.quantite) > 0 && (!l.numeroLot || !l.datePeremption))
    if (sansLot) return store.dispatch('notifications/erreur', `${libelleMedicament(sansLot.medicamentId)} : n° de lot et péremption obligatoires.`)
  }

  const confirme = await confirmer({
    titre: `Enregistrer le stock de départ — ${nomEntite.value} ?`,
    texte:
      `Le stock actuel de « ${nomEntite.value} » sera REMPLACÉ par ces ${lignes.length} ligne(s). ` +
      'Les écarts sont enregistrés comme mouvements « Inventaire initial » ; un produit absent de la liste revient à 0.',
    boutonConfirmer: 'Oui, enregistrer',
  })
  if (!confirme) return

  enregistrement.value = true
  try {
    await enregistrerInventaireInitial(entite.value, {
      dateInventaire: f.dateInventaire,
      lignes: lignes.map((l) => ({
        medicamentId: l.medicamentId,
        quantite: Number(l.quantite),
        numeroLot: estDistrict.value ? l.numeroLot || undefined : undefined,
        datePeremption: estDistrict.value ? l.datePeremption || undefined : undefined,
      })),
    })
    store.dispatch('notifications/succes', `Stock de départ enregistré : ${nomEntite.value}.`)
    await chargerEtat()
    await choisir(entiteCentreId.value)
    emit('modifie')
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    enregistrement.value = false
  }
}

onMounted(async () => {
  store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch(() => {})
  try {
    await chargerEtat()
    await choisir(null) // le district en premier
  } catch (erreur) {
    store.dispatch('notifications/erreurApi', erreur)
  }
})
</script>

<style scoped>
.inventaire-initial { display: flex; flex-direction: column; gap: 1rem; }
.bandeau {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.88rem;
}
.bandeau.verrouille { background: #fdecec; color: var(--danger); }
.disposition { display: grid; grid-template-columns: 260px 1fr; gap: 1.25rem; align-items: start; }
@media (max-width: 900px) {
  .disposition { grid-template-columns: 1fr; }
}
.section {
  margin: 0 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.entites { display: flex; flex-direction: column; gap: 0.35rem; }
.entite {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: #fff;
  color: var(--texte-sur-fond);
  text-align: left;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.entite:hover { background: var(--primary-light); }
.entite.actif { background: var(--primary); color: #fff; }
.entite .nom { flex: 1; font-size: 0.88rem; }
.entete-saisie { display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.75rem; }
.entete-saisie h3 { margin: 0; }
.detail { font-size: 0.78rem; color: var(--muted); }
.lot-requis { display: block; color: #b35c00; font-weight: 600; }
.lignes td { padding: 0.45rem 0.4rem; }
.lignes .col-medicament { min-width: 260px; }
.lignes input[type='number'] { width: 100px; text-align: right; }
.champ-lot { width: 120px; }
.lignes .total { font-weight: 800; color: var(--primary-dark); }
.lignes tfoot td { border-bottom: none; }
.pied { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
