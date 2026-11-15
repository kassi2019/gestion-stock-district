<!--
  =============================================================================
  PAGE D'ACCUEIL : « GRANDES TUILES »
  =============================================================================
  Page d'accueil très visuelle, façon "lanceur d'applications".
  Elle occupe toute la largeur de l'écran (pas de menu latéral) :
    1. Bandeau vert : salutation + 4 chiffres clés en pastilles blanches ;
    2. Grille de GRANDES tuiles en dégradé vert : TOUS les modules sont
       affichés ; ceux non attribués au profil sont GRISÉS (cadenas, non
       cliquables). Badge = tâches en attente ;
    3. ALERTES DE STOCK RÉELLES (pour les profils qui voient le module Stock) :
       bandeau rouge « lots périmés à retirer » + bande des alertes (périmés,
       péremption proche, ruptures / sous le seuil). Clic -> Stock > Alertes.

  Les tuiles sont générées depuis src/config/modules.js ; le droit « Voir »
  du profil connecté décide si la tuile est active ou grisée.

  Chiffres clés et badges : RÉELS, calculés par le serveur (GET /api/accueil/resume),
  seulement pour les modules que l'utilisateur a le droit de voir.
  =============================================================================
-->
<template>
  <div class="lanceur">
    <!-- ======================= 1. BANDEAU ======================= -->
    <section class="bandeau">
      <div class="bandeau-texte">
        <p class="bandeau-date">{{ dateDuJour }}</p>
        <h2>{{ salutation }}, {{ utilisateur?.prenoms || utilisateur?.nom }}</h2>
        <p>Choisissez un module pour commencer.</p>
      </div>

      <!-- Chiffres clés en pastilles -->
      <div class="chiffres">
        <router-link v-for="indicateur in indicateurs" :key="indicateur.libelle" :to="indicateur.lien" class="chiffre" :title="indicateur.detail">
          <div class="chiffre-valeur" :class="indicateur.couleur">
            {{ indicateur.valeur }} <small>{{ indicateur.unite }}</small>
          </div>
          <div class="chiffre-libelle">{{ indicateur.libelle }}</div>
          <div v-if="indicateur.detail" class="chiffre-detail">{{ indicateur.detail }}</div>
        </router-link>
      </div>
    </section>

    <!-- ======================= 2. GRANDES TUILES ======================= -->
    <section class="grille">
      <!-- Module attribué : lien ; sinon simple bloc grisé (non cliquable) -->
      <component
        :is="module.autorise ? 'router-link' : 'div'"
        v-for="(module, index) in modulesAffiches"
        :key="module.code"
        v-bind="module.autorise ? { to: '/' + module.code } : { title: 'Module non attribué à votre profil' }"
        class="grande-tuile"
        :class="module.autorise ? 'nuance-' + (index % 4) : 'grisee'"
      >
        <!-- Grande icône en filigrane (décor) -->
        <Icone :nom="module.icone" :taille="120" class="filigrane" />

        <div class="tuile-haut">
          <div class="tuile-icone-numero">
            <span class="tuile-icone"><Icone :nom="module.icone" :taille="26" /></span>
            <!-- Numéro d'ordre : 01, 02, 03... (ordre de src/config/modules.js) -->
            <span class="tuile-numero">{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <!-- Module non attribué : cadenas -->
          <span v-if="!module.autorise" class="tuile-verrou"><Icone nom="cadenas" :taille="14" /> Non attribué</span>
          <!-- Badge : éléments en attente dans ce module (calculés par le serveur) -->
          <span v-else-if="enAttente[module.code]" class="tuile-attente" :title="enAttente[module.code].libelle">
            {{ enAttente[module.code].libelle }}
          </span>
        </div>

        <div class="tuile-bas">
          <div class="tuile-titre">{{ module.titre }}</div>
          <div class="tuile-description">{{ module.description }}</div>
        </div>
      </component>
    </section>

    <!-- ======================= 3. ALERTES DE STOCK (réelles) ======================= -->
    <template v-if="resume">
      <!-- Bandeau rouge : lots périmés à retirer -->
      <router-link v-if="resume.lotsPerimes > 0" to="/stock?onglet=alertes" class="bandeau-perimes">
        <Icone nom="alerte" :taille="22" />
        <span>
          <strong>{{ resume.lotsPerimes }} lot(s) périmé(s) à retirer du stock</strong>
          ({{ resume.quantitePerimee }} unité(s)) — cliquez pour les sortir du stock.
        </span>
        <Icone nom="fleche" :taille="18" />
      </router-link>

      <section class="alertes">
        <router-link to="/stock?onglet=alertes" class="alertes-titre">
          <Icone nom="alerte" :taille="18" /> Alertes stock
          <span class="compteurs-alertes">
            <span v-if="resume.ruptures" class="c-rouge">{{ resume.ruptures }} rupture(s)</span>
            <span v-if="resume.sousSeuil" class="c-orange">{{ resume.sousSeuil }} sous le seuil</span>
            <span v-if="resume.lotsProches" class="c-orange">{{ resume.lotsProches }} lot(s) ≤ {{ resume.delai }} j</span>
          </span>
        </router-link>
        <div class="alertes-liste">
          <router-link v-for="(alerte, i) in alertesStock" :key="i" to="/stock?onglet=alertes" class="alerte" :class="alerte.couleur">
            <strong>{{ alerte.produit }}</strong>
            <span>{{ alerte.detail }}</span>
          </router-link>
          <span v-if="alertesStock.length === 0" class="aucune-alerte">✔ Aucune alerte de stock.</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import Icone from '@/components/Icone.vue'
import { MODULES } from '@/config/modules'
import { resumeAlertes } from '@/api/stock'
import { resumeAccueil } from '@/api/accueil'
import { formaterDate, formaterNombre } from '@/utils/format'

const store = useStore()
const utilisateur = computed(() => store.state.auth.user)

const salutation = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
const dateDuJour = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Tous les modules, avec « autorise » = le profil connecté a le droit de les voir
// (les autres sont affichés grisés)
const modulesAffiches = computed(() =>
  MODULES.map((module) => ({ ...module, autorise: store.getters['auth/peutVoir'](module.code) })),
)

// ---------------------------------------------------------------------------
// CHIFFRES CLÉS ET BADGES DES TUILES (réels, calculés par le serveur)
// ---------------------------------------------------------------------------
const accueil = ref({ indicateurs: {}, enAttente: {} })
const enAttente = computed(() => accueil.value.enAttente || {})

/** Pastilles du bandeau : seulement celles renvoyées (modules visibles par l'utilisateur). */
const indicateurs = computed(() => {
  const i = accueil.value.indicateurs || {}
  const liste = []
  if (i.stock) {
    liste.push({
      libelle: 'Valeur du stock dépôt',
      valeur: formaterNombre(Math.round(i.stock.valeurAchat)),
      unite: 'FCFA',
      detail: `Au prix d'achat · ${formaterNombre(Math.round(i.stock.valeurVente))} FCFA au prix de vente`,
      couleur: '',
      lien: '/stock',
    })
  }
  if (i.alertes) {
    const a = i.alertes
    liste.push({
      libelle: 'Alertes stock',
      valeur: formaterNombre(a.total),
      unite: a.total > 1 ? 'alertes' : 'alerte',
      detail: [
        a.ruptures && `${a.ruptures} rupture(s)`,
        a.sousSeuil && `${a.sousSeuil} sous le seuil`,
        a.lotsPerimes && `${a.lotsPerimes} lot(s) périmé(s)`,
        a.lotsProches && `${a.lotsProches} lot(s) ≤ ${a.delai} j`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Aucune alerte',
      couleur: a.total > 0 ? 'rouge' : '',
      lien: '/stock?onglet=alertes',
    })
  }
  if (i.creances) {
    const c = i.creances
    liste.push({
      libelle: 'Créances en cours',
      valeur: formaterNombre(Math.round(c.montant)),
      unite: 'FCFA',
      detail: c.factures ? `${c.factures} facture(s) non soldée(s) · ${c.centres} centre(s)` : 'Aucune facture impayée',
      couleur: c.montant > 0 ? 'rouge' : '',
      lien: '/paiements',
    })
  }
  if (i.rapports) {
    const r = i.rapports
    liste.push({
      libelle: 'Rapports à valider',
      valeur: formaterNombre(r.aValider),
      unite: r.aValider > 1 ? 'rapports' : 'rapport',
      detail: r.aValider ? `${formaterNombre(Math.round(r.montant))} FCFA de consommation` : r.brouillons ? `${r.brouillons} brouillon(s) en cours` : 'Rien en attente',
      couleur: '',
      lien: '/consommations',
    })
  }
  return liste
})

// ---------------------------------------------------------------------------
// ALERTES DE STOCK RÉELLES (seulement si le profil voit le module Stock)
// ---------------------------------------------------------------------------
const resume = ref(null)

/** Cartes de la bande d'alertes : périmés (rouge), ruptures / sous le seuil, péremption proche. */
const alertesStock = computed(() => {
  if (!resume.value) return []
  const r = resume.value
  return [
    ...r.exemplesPerimes.map((l) => ({
      produit: l.designation,
      detail: `Lot ${l.numeroLot} · PÉRIMÉ depuis le ${formaterDate(l.datePeremption)} · ${l.quantite} en stock`,
      couleur: 'rouge',
    })),
    ...r.exemplesRuptures.map((m) => ({
      produit: m.designation,
      detail: m.stock <= 0 ? 'Rupture de stock' : `Stock : ${m.stock} / seuil : ${m.seuilAlerte}`,
      couleur: m.stock <= 0 ? 'rouge' : 'secondaire',
    })),
    ...r.exemplesProches.map((l) => ({
      produit: l.designation,
      detail: `Lot ${l.numeroLot} · expire le ${formaterDate(l.datePeremption)} · ${l.quantite} en stock`,
      couleur: 'secondaire',
    })),
  ]
})

onMounted(async () => {
  try {
    accueil.value = await resumeAccueil()
  } catch {
    // Pas bloquant : l'accueil s'affiche sans les chiffres
  }
  if (!store.getters['auth/peutVoir']('stock')) return
  try {
    resume.value = await resumeAlertes()
  } catch {
    // Pas bloquant : l'accueil s'affiche sans les alertes
  }
})
</script>

<style scoped>
.lanceur { display: flex; flex-direction: column; gap: 1.75rem; }

/* ---------------------------------------------------------------------------
   1. BANDEAU VERT
   --------------------------------------------------------------------------- */
.bandeau {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 2rem;
  border-radius: 18px;
  color: #fff;
  background:
    radial-gradient(circle at 90% -20%, rgba(255, 255, 255, 0.18) 0, transparent 45%),
    linear-gradient(120deg, var(--primary) 0%, var(--primary-dark) 100%);
  box-shadow: 0 12px 32px rgba(0, 122, 80, 0.3);
}
.bandeau h2 { margin: 0.2rem 0; font-size: 1.7rem; }
.bandeau p { margin: 0; opacity: 0.9; }
.bandeau-date { font-size: 0.85rem; text-transform: capitalize; opacity: 0.8 !important; }

.chiffres { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.chiffre {
  display: block;
  text-decoration: none;
  transition: transform 0.15s;
  min-width: 150px;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}
.chiffre-valeur { font-size: 1.2rem; font-weight: 800; color: var(--primary-dark); }
.chiffre-valeur.rouge { color: var(--danger); }
.chiffre-valeur small { font-size: 0.7rem; font-weight: 600; color: var(--muted); }
.chiffre-libelle { font-size: 0.75rem; color: var(--muted); }
.chiffre:hover { transform: translateY(-2px); }
/* Détail (ex. « 3 ruptures · 2 lots ≤ 90 j ») */
.chiffre-detail { margin-top: 0.15rem; max-width: 210px; font-size: 0.68rem; color: var(--muted); opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---------------------------------------------------------------------------
   2. GRANDES TUILES (4 nuances de vert en alternance)
   --------------------------------------------------------------------------- */
/*
 * Grille : 5 tuiles par ligne, CENTRÉES.
 * (avec 10 modules : 5 en haut, 5 en bas ; avec moins de modules, par exemple
 *  3 pour le comptable, les tuiles restent centrées au milieu de l'écran)
 * La largeur d'une tuile = (largeur totale - 4 espaces) / 5.
 */
.grille {
  --espace: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--espace);
}
.grande-tuile {
  width: calc((100% - 4 * var(--espace)) / 5);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 190px;
  padding: 1.4rem;
  border-radius: 18px;
  color: #fff;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s, box-shadow 0.2s;
}
.grande-tuile:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.18);
}

/* Nuances de vert (une tuile sur quatre change de nuance) */
.nuance-0 { background: linear-gradient(135deg, #00a36c, #007a50); }
.nuance-1 { background: linear-gradient(135deg, #4cc38a, #2a9464); }
.nuance-2 { background: linear-gradient(135deg, #1f8f6a, #0f5e44); }
.nuance-3 { background: linear-gradient(135deg, #37b07a, #1d7f55); }

/* Module NON attribué au profil : gris, sans effet au survol, non cliquable */
.grande-tuile.grisee {
  background: linear-gradient(135deg, #c9cfd4, #a7afb6);
  color: #f4f6f7;
  box-shadow: none;
  cursor: not-allowed;
  filter: saturate(0.2);
  opacity: 0.75;
}
.grande-tuile.grisee:hover { transform: none; box-shadow: none; }
.grande-tuile.grisee:hover .filigrane { transform: none; }
.tuile-verrou {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Grande icône en filigrane, en bas à droite */
.filigrane {
  position: absolute;
  right: -18px;
  bottom: -18px;
  opacity: 0.14;
  transition: transform 0.3s;
}
.grande-tuile:hover .filigrane { transform: rotate(-8deg) scale(1.08); }

.tuile-haut { display: flex; justify-content: space-between; align-items: flex-start; }
.tuile-icone-numero { display: flex; align-items: center; gap: 0.6rem; }
/* Numéro d'ordre (01, 02...) à côté de l'icône */
.tuile-numero {
  font-size: 1.5rem;
  font-weight: 800;
  opacity: 0.55;
  letter-spacing: 0.02em;
}
.tuile-icone {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(2px);
}
.tuile-attente {
  max-width: 62%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: #fff;
  color: var(--danger);
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.tuile-bas { position: relative; }
.tuile-titre { font-size: 1.15rem; font-weight: 800; margin-bottom: 0.25rem; }
.tuile-description { font-size: 0.82rem; opacity: 0.9; line-height: 1.4; }

/* ---------------------------------------------------------------------------
   3. BANDE D'ALERTES
   --------------------------------------------------------------------------- */
.alertes {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  background: #fff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 8px 24px rgba(0, 0, 0, 0.06);
}
.alertes-titre {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
  color: var(--danger);
}
.alertes-liste { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 2px; }
.alerte {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.85rem;
  border-radius: 10px;
  border-left: 4px solid var(--accent);
  background: var(--accent-light);
  font-size: 0.8rem;
}
.alerte.rouge { border-left-color: var(--danger); background: #fdecec; }
a.alerte { color: inherit; text-decoration: none; }
a.alerte:hover { filter: brightness(0.97); }
a.alertes-titre { text-decoration: none; }
.compteurs-alertes { display: inline-flex; gap: 0.35rem; margin-left: 0.4rem; }
.compteurs-alertes span { padding: 0.05rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.c-rouge { background: #fdecec; color: var(--danger); }
.c-orange { background: #fff1e0; color: #b35c00; }
.aucune-alerte { align-self: center; font-size: 0.85rem; color: var(--primary-dark); }

/* Bandeau rouge « lots périmés à retirer » */
.bandeau-perimes {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1.25rem;
  border-radius: 14px;
  background: linear-gradient(120deg, #dc2626, #b91c1c);
  color: #fff;
  text-decoration: none;
  box-shadow: 0 8px 20px rgba(185, 28, 28, 0.3);
}
.bandeau-perimes span { flex: 1; }
.bandeau-perimes:hover { filter: brightness(1.05); }
.alerte span { color: var(--muted); }

/* ---------------------------------------------------------------------------
   Écrans plus petits : moins de tuiles par ligne (toujours centrées)
   --------------------------------------------------------------------------- */
@media (max-width: 1200px) {
  .grande-tuile { width: calc((100% - 2 * var(--espace)) / 3); }
}
@media (max-width: 800px) {
  .grande-tuile { width: calc((100% - var(--espace)) / 2); }
}
@media (max-width: 520px) {
  .grande-tuile { width: 100%; }
}
</style>
