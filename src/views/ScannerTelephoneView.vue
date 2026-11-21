<!--
  =============================================================================
  ÉCRAN « SCANNER » (téléphone / tablette, utilisable aussi sur ordinateur)
  =============================================================================
  Adresse /scanner (pas de bouton dans la barre du haut : retiré à la demande).
  - « LE POSTE ATTEND UN CODE » : sur un PC, un formulaire (médicament,
    réception, facture manuelle) a cliqué « 📱 Téléphone » ; « Scanner » envoie
    les codes lus directement dans ce formulaire (à la suite pour une réception
    ou une facture).
  - « Scanner des boîtes » : pour VÉRIFIER une boîte :
      * code CONNU   -> le médicament s'affiche (stock du district, prix de vente) ;
      * code INCONNU -> la caméra se ferme et propose de RATTACHER le code à un
        médicament existant, ou de CRÉER un médicament avec ce code
        (Paramétrage > Médicaments).
  - « Médicaments sans code-barres » (droit MODIFIER sur le Paramétrage) : on
    choisit le médicament, puis on scanne sa boîte -> le code lui est rattaché.
  Droits : VOIR sur Paramétrage, Réception ou Facturation (sinon le bouton
  « Scanner » n'apparaît pas). Rattacher un code : MODIFIER sur l'un des trois.
  =============================================================================
-->
<template>
  <div class="page-scanner">
    <EnteteModule
      icone="code-barre"
      titre="Scanner les boîtes"
      description="Envoyez les codes au poste qui les attend, retrouvez un médicament ou rattachez son code-barres."
    />

    <!-- ===== Demandes des postes (PC) : le code scanné part dans leur formulaire ===== -->
    <section v-if="demandes.length" class="carte demandes">
      <h4 class="section">📱 Le poste attend un code</h4>
      <div v-for="d in demandes" :key="d.id" class="demande">
        <div>
          <strong>{{ d.libelle }}</strong>
          <small>
            Ouvert sur le poste par {{ d.auteur }}<template v-if="d.continu"> · scannez les boîtes à la suite</template><template v-if="d.recus"> · {{ d.recus }} code(s) déjà envoyé(s)</template>
          </small>
        </div>
        <button @click="ouvrirCameraPour(d)">📷 Scanner</button>
      </div>
      <p v-if="envoiPoste" class="envoye">✓ Code <strong class="code">{{ envoiPoste.code }}</strong> envoyé au poste ({{ envoiPoste.libelle }}).</p>
    </section>
    <p v-else class="aucune-demande">
      Aucun poste n'attend de code. Sur le PC, cliquez « 📱 Téléphone » dans la fiche du médicament,
      la réception ou la facture manuelle : la demande apparaît ici.
    </p>

    <section class="carte zone-scan">
      <button class="bouton-scanner" @click="ouvrirCamera()">📷 Scanner des boîtes</button>
      <ChampCodeBarre placeholder="… ou saisir le code-barres" @code="traiter" />

      <!-- ===== Résultat du dernier code ===== -->
      <div v-if="resultat" class="resultat" :class="resultat.medicament ? 'connu' : 'inconnu'">
        <template v-if="resultat.medicament">
          <div class="resultat-titre">✓ <span class="code">{{ resultat.code }}</span></div>
          <strong class="nom">{{ resultat.medicament.designation }}</strong>
          <div class="details">
            <span class="code">{{ resultat.medicament.code }}</span>
            <span v-if="resultat.medicament.forme">{{ resultat.medicament.forme.libelle }}</span>
            <span v-if="!resultat.medicament.actif" class="badge badge-gris">Inactif</span>
            <span v-if="resultat.medicament.stockActuel !== undefined">
              Stock district : <strong>{{ formaterNombre(resultat.medicament.stockActuel) }}</strong>
            </span>
            <span v-if="resultat.medicament.prixVenteActuel !== undefined && resultat.medicament.prixVenteActuel !== null">
              Prix de vente : <strong>{{ formaterMontant(resultat.medicament.prixVenteActuel) }}</strong>
            </span>
          </div>
        </template>

        <template v-else>
          <div class="resultat-titre">✗ Code <span class="code">{{ resultat.code }}</span> inconnu</div>
          <template v-if="peutRattacher">
            <label>Rattacher ce code à un médicament existant</label>
            <div class="rattacher">
              <ListeDeroulante
                v-model="choix"
                :options="medicamentsActifs"
                :champ-libelle="(m) => `${m.code} — ${m.designation}`"
                placeholder="Tapez le nom du médicament…"
              />
              <button :disabled="!choix || envoi" @click="rattacher(choix, resultat.code)">Rattacher</button>
            </div>
            <router-link
              v-if="peutCreer"
              class="lien-creer"
              :to="{ path: '/parametrage', query: { onglet: 'medicaments', codeBarre: resultat.code } }"
            >
              + Créer un nouveau médicament avec ce code
            </router-link>
          </template>
          <p v-else class="aide">Demandez à un responsable de rattacher ce code au médicament.</p>
        </template>
      </div>

      <!-- ===== Codes scannés pendant cette séance ===== -->
      <div v-if="historique.length" class="historique">
        <h4 class="section">Codes scannés</h4>
        <ul>
          <li v-for="h in historique" :key="h.quand">
            <span class="code">{{ h.code }}</span>
            <span :class="h.medicament ? 'ok' : 'ko'">{{ h.medicament ? h.medicament.designation : 'inconnu' }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ===== Médicaments sans code-barres (pour équiper le stock) ===== -->
    <section v-if="peutCreer" class="carte">
      <div class="barre-outils">
        <h4 class="section titre-liste">Médicaments sans code-barres ({{ sansCode.length }})</h4>
        <span class="espace"></span>
        <input v-model="recherche" class="recherche" type="search" placeholder="Rechercher…" />
      </div>
      <ul class="sans-code">
        <li v-for="m in sansCodeAffiches.slice(0, 50)" :key="m.id">
          <div>
            <strong>{{ m.designation }}</strong>
            <div class="code detail">{{ m.code }}</div>
          </div>
          <button class="bouton-secondaire" @click="ouvrirCamera(m)">📷 Scanner sa boîte</button>
        </li>
      </ul>
      <p v-if="!sansCode.length" class="tableau-vide">✓ Tous les médicaments actifs ont un code-barres.</p>
      <p v-else-if="sansCodeAffiches.length > 50" class="aide">50 premiers affichés : utilisez la recherche.</p>
    </section>

    <ScannerCamera
      v-if="camera"
      :continu="!cible && (!demande || demande.continu)"
      :titre="demande ? `Pour le poste : ${demande.libelle}` : cible ? `Boîte de ${cible.designation}` : 'Scanner des boîtes'"
      @lu="lu"
      @fermer="fermerCamera"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import http from '@/api/http'
import EnteteModule from '@/components/EnteteModule.vue'
import ChampCodeBarre from '@/components/ChampCodeBarre.vue'
import ScannerCamera, { prechargerLecteur } from '@/components/ScannerCamera.vue'
import ListeDeroulante from '@/components/ListeDeroulante.vue'
import { bip, codeValide } from '@/utils/codeBarre'
import { formaterMontant, formaterNombre } from '@/utils/format'

const store = useStore()
const peutModifier = (module) => store.getters['auth/peutModifier'](module)
// Rattacher un code : même règle que le serveur (Paramétrage, Réception ou Facturation)
const peutRattacher = computed(() => ['parametrage', 'achats', 'facturation'].some(peutModifier))
// Créer un médicament / équiper le catalogue : Paramétrage
const peutCreer = computed(() => peutModifier('parametrage'))

const medicaments = computed(() => store.state.referentiel.medicaments)
const medicamentsActifs = computed(() => medicaments.value.filter((m) => m.actif))
const sansCode = computed(() => medicamentsActifs.value.filter((m) => !m.codesBarres?.length))
const recherche = ref('')
const sansCodeAffiches = computed(() => {
  const t = recherche.value.toLowerCase()
  return sansCode.value.filter((m) => !t || [m.code, m.designation].some((v) => (v || '').toLowerCase().includes(t)))
})

const resultat = ref(null) // { code, medicament | null }
const historique = ref([])
const choix = ref(null)
const camera = ref(false)
const cible = ref(null) // médicament choisi avant de scanner sa boîte
const envoi = ref(false)

/** Catalogue des médicaments (avec leurs codes-barres). */
const charger = () => store.dispatch('referentiel/charger', { liste: 'medicaments' }).catch((e) => store.dispatch('notifications/erreurApi', e))
onMounted(charger)

function ouvrirCamera(medicament = null) {
  cible.value = medicament
  demande.value = null
  camera.value = true
}
function fermerCamera() {
  camera.value = false
  cible.value = null
  demande.value = null
}

// ---------------------------------------------------------------------------
// DEMANDES DES POSTES : un PC attend les codes de son formulaire
// ---------------------------------------------------------------------------
const demandes = ref([])
const demande = ref(null) // demande pour laquelle la caméra est ouverte
const envoiPoste = ref(null)
let minuterieDemandes = null

async function chargerDemandes() {
  try {
    demandes.value = (await http.get('/scan-distant')).data
  } catch {
    demandes.value = []
  }
}
onMounted(() => {
  // Lecteur de secours (iPhone) préparé dès l'ouverture : la caméra démarre plus vite
  if (!('BarcodeDetector' in window)) prechargerLecteur().catch(() => {})
  chargerDemandes()
  // Liste des demandes relue toutes les 2 s (seulement quand l'écran est visible)
  minuterieDemandes = setInterval(() => {
    if (document.visibilityState === 'visible') chargerDemandes()
  }, 2000)
})
onBeforeUnmount(() => clearInterval(minuterieDemandes))

function ouvrirCameraPour(d) {
  cible.value = null
  demande.value = d
  camera.value = true
}

async function envoyerAuPoste(d, code) {
  try {
    await http.post(`/scan-distant/${d.id}/codes`, { code })
    bip()
    envoiPoste.value = { code, libelle: d.libelle }
    chargerDemandes()
  } catch (erreur) {
    bip(true)
    store.dispatch('notifications/erreurApi', erreur)
    chargerDemandes()
  }
}

/** Code lu par la caméra : envoyé au poste, rattaché au médicament choisi, ou recherché. */
async function lu(code) {
  if (demande.value) {
    const d = demande.value
    // Réception / facture : la caméra reste ouverte pour les boîtes suivantes
    if (!d.continu) fermerCamera()
    if (!codeValide(code)) {
      bip(true)
      return store.dispatch('notifications/erreur', `Code-barres invalide : ${code}`)
    }
    await envoyerAuPoste(d, code)
    return
  }
  if (cible.value) {
    const m = cible.value
    fermerCamera()
    await rattacher(m.id, code)
    return
  }
  const connu = await traiter(code)
  // Code inconnu : on ferme la caméra pour pouvoir le rattacher
  if (!connu) camera.value = false
}

/** Cherche le médicament d'un code (liste chargée, sinon serveur). Renvoie true s'il est connu. */
async function traiter(code) {
  if (!codeValide(code)) {
    bip(true)
    store.dispatch('notifications/erreur', `Code-barres invalide : ${code}`)
    return false
  }
  let medicament = medicaments.value.find((m) => m.codesBarres?.some((c) => c.code === code)) ?? null
  if (!medicament) {
    try {
      medicament = (await http.get(`/medicaments/code-barre/${encodeURIComponent(code)}`)).data.medicament
    } catch {
      medicament = null
    }
  }
  if (!medicament) bip(true)
  choix.value = null
  resultat.value = { code, medicament }
  historique.value.unshift({ code, medicament, quand: Date.now() })
  historique.value = historique.value.slice(0, 20)
  return !!medicament
}

async function rattacher(medicamentId, code) {
  if (!codeValide(code)) {
    bip(true)
    return store.dispatch('notifications/erreur', `Code-barres invalide : ${code}`)
  }
  envoi.value = true
  try {
    await http.post(`/medicaments/${medicamentId}/codes-barres`, { code })
    await charger()
    const medicament = medicaments.value.find((m) => m.id === medicamentId)
    bip()
    store.dispatch('notifications/succes', `Code ${code} rattaché à « ${medicament?.designation} ».`)
    resultat.value = { code, medicament }
    historique.value.unshift({ code, medicament, quand: Date.now() })
  } catch (erreur) {
    bip(true)
    store.dispatch('notifications/erreurApi', erreur)
  } finally {
    envoi.value = false
  }
}
</script>

<style scoped>
.page-scanner { display: flex; flex-direction: column; gap: 1.25rem; max-width: 900px; margin: 0 auto; }
.carte { padding: 1rem 1.25rem; border-radius: 14px; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
.section {
  margin: 0 0 0.6rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.aucune-demande { margin: 0; font-size: 0.88rem; color: var(--muted); }
.zone-scan { display: flex; flex-direction: column; gap: 0.9rem; }
.bouton-scanner { padding: 1rem; font-size: 1.1rem; border-radius: 14px; }
.resultat {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  border-left: 5px solid;
}
.resultat.connu { border-color: #16a34a; background: #f0fdf4; }
.resultat.inconnu { border-color: var(--danger); background: #fef2f2; }
.resultat-titre { font-weight: 700; }
.resultat .nom { font-size: 1.15rem; color: var(--texte-sur-fond); }
.details { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; font-size: 0.9rem; color: var(--muted); }
.rattacher { display: flex; gap: 0.5rem; align-items: center; }
.rattacher > :first-child { flex: 1; min-width: 0; }
.lien-creer { font-weight: 600; color: var(--primary-dark); }
.historique ul, .sans-code { list-style: none; margin: 0; padding: 0; }
.historique li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
.historique .ok { color: #15803d; }
.historique .ko { color: var(--danger); }
.titre-liste { margin: 0; border: none; }
.sans-code li { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
.detail { font-size: 0.78rem; color: var(--muted); }
.aide { margin: 0; font-size: 0.85rem; color: var(--muted); }
.demandes { border: 2px solid var(--primary); }
.demande {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.demande small { display: block; color: var(--muted); }
.envoye { margin: 0.6rem 0 0; color: #15803d; }
@media (max-width: 520px) {
  .rattacher { flex-direction: column; align-items: stretch; }
}
</style>
