/**
 * =============================================================================
 * LISTE DES MODULES DE L'APPLICATION
 * =============================================================================
 * C'est LE fichier à modifier pour ajouter, renommer ou masquer un module.
 * Il est utilisé automatiquement par :
 *   - les tuiles de l'accueil    (src/views/DashboardView.vue)
 *   - les routes / pages         (src/router/index.js)
 *
 * Chaque module contient :
 *   - code        : identifiant unique (sert aussi d'adresse : /achats, /stock...)
 *   - titre       : nom affiché
 *   - description : phrase courte affichée sur la tuile de l'accueil
 *   - icone       : nom d'une icône définie dans src/components/Icone.vue
 *   - couleur     : 'principale' (vert santé) ou 'secondaire' (vert menthe)
 *   - vue         : (facultatif) écran à afficher. Si absent, une page
 *                   "module en cours de développement" est affichée.
 *
 * ACCÈS : qui voit quel module n'est PLUS écrit ici. Les droits sont donnés
 * à chaque profil dans l'application (Utilisateurs > Profils & droits) :
 * aucun accès / lecture / modification. L'ADMIN voit toujours tout.
 * ➜ Un nouveau module doit aussi être ajouté dans MODULES_APPLICATION du
 *   backend (src/common/constants.ts).
 * =============================================================================
 */

/**
 * Groupes de modules, dans l'ORDRE D'AFFICHAGE des tuiles de l'accueil.
 * L'ordre suit le circuit de travail du district :
 *   1. Paramétrage  2. Utilisateurs  3. Achats  4. Stock  5. Livraisons
 *   6. Consommations  7. Facturation  8. Paiements  9. Supervisions  10. États
 * ➜ Pour changer l'ordre des tuiles, il suffit de déplacer les blocs ci-dessous.
 */
export const GROUPES = [
  {
    titre: 'Administration',
    modules: [
      {
        code: 'parametrage',
        titre: 'Paramétrage',
        description: 'Centres, fournisseurs, médicaments, prix et seuils',
        icone: 'reglages',
        couleur: 'principale',
        // Écran du module (si absent : page « en cours de développement »)
        vue: () => import('@/views/parametrage/ParametrageView.vue'),
      },
      {
        code: 'utilisateurs',
        titre: 'Utilisateurs',
        description: 'Comptes, profils et droits d\'accès',
        icone: 'utilisateurs',
        couleur: 'secondaire',
        vue: () => import('@/views/utilisateurs/UtilisateursView.vue'),
      },
    ],
  },
  {
    titre: 'Approvisionnement',
    modules: [
      {
        code: 'achats',
        titre: 'Achats & réceptions',
        description: 'Commandes fournisseurs, réceptions, lots et péremptions',
        icone: 'panier',
        couleur: 'principale',
        vue: () => import('@/views/achats/AchatsView.vue'),
      },
      {
        code: 'stock',
        titre: 'Stock du dépôt',
        description: 'Stock disponible, mouvements, ajustements et inventaires',
        icone: 'carton',
        couleur: 'secondaire',
        vue: () => import('@/views/stock/StockView.vue'),
      },
    ],
  },
  {
    titre: 'Centres de santé',
    modules: [
      {
        code: 'livraisons',
        titre: 'Commandes & livraisons',
        description: 'Commandes des centres, préparation et bons de livraison',
        icone: 'camion',
        couleur: 'principale',
        vue: () => import('@/views/livraisons/LivraisonsView.vue'),
      },
      {
        code: 'consommations',
        titre: 'Consommations mensuelles',
        description: 'Saisie et validation des rapports de consommation',
        icone: 'presse-papier',
        couleur: 'secondaire',
        vue: () => import('@/views/consommations/ConsommationsView.vue'),
      },
    ],
  },
  {
    titre: 'Finances',
    modules: [
      {
        code: 'facturation',
        titre: 'Facturation',
        description: 'Factures mensuelles générées à partir des consommations',
        icone: 'facture',
        couleur: 'principale',
      },
      {
        code: 'paiements',
        titre: 'Paiements & comptes',
        description: 'Encaissements, avances, reçus et relevés de compte',
        icone: 'portefeuille',
        couleur: 'secondaire',
      },
    ],
  },
  {
    titre: 'Contrôle & pilotage',
    modules: [
      {
        code: 'supervisions',
        titre: 'Supervisions',
        description: 'Contrôles physiques dans les centres et traitement des écarts',
        icone: 'loupe',
        couleur: 'principale',
      },
      {
        code: 'rapports',
        titre: 'États & rapports',
        description: 'Tableaux de bord, statistiques et exports PDF / Excel',
        icone: 'graphique',
        couleur: 'secondaire',
      },
    ],
  },
]

/** Tous les modules dans une seule liste (pratique pour les routes). */
export const MODULES = GROUPES.flatMap((groupe) => groupe.modules)
