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
 *   1. Paramétrage  2. Utilisateurs  3. Réception  4. Stock du dépôt
 *   5. Rapports centre  6. Facturation  7. Paiements  8. Stock des centres
 *   9. Supervisions  10. États & rapports
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
        titre: 'Réception fournisseurs',
        description: 'Livraisons reçues des fournisseurs, lots, péremptions et historique',
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
    titre: 'Centres de santé & finances',
    modules: [
      {
        code: 'consommations',
        titre: 'Rapports centre de santé',
        description: 'Consommation mensuelle, stock restant et quantité à livrer',
        icone: 'presse-papier',
        couleur: 'principale',
        vue: () => import('@/views/consommations/ConsommationsView.vue'),
      },
      {
        code: 'facturation',
        titre: 'Facturation',
        description: 'Sorties du district vers les centres (rapports et factures manuelles)',
        icone: 'facture',
        couleur: 'secondaire',
        vue: () => import('@/views/facturation/FacturationView.vue'),
      },
      {
        code: 'paiements',
        titre: 'Paiements & comptes',
        description: 'Encaissements, avances, reçus et relevés de compte',
        icone: 'portefeuille',
        couleur: 'principale',
        vue: () => import('@/views/paiements/PaiementsView.vue'),
      },
    ],
  },
  {
    titre: 'Contrôle & pilotage',
    modules: [
      // Stock des centres : alimenté par les factures et les rapports validés,
      // contrôlé par les supervisions -> placé juste avant Supervisions
      {
        code: 'livraisons',
        titre: 'Stock des centres',
        description: 'Stock théorique des centres et anciens bons de livraison',
        icone: 'camion',
        couleur: 'secondaire',
        vue: () => import('@/views/livraisons/LivraisonsView.vue'),
      },
      {
        code: 'supervisions',
        titre: 'Supervisions',
        description: 'Contrôles physiques dans les centres et traitement des écarts',
        icone: 'loupe',
        couleur: 'principale',
        vue: () => import('@/views/supervisions/SupervisionsView.vue'),
      },
      {
        code: 'rapports',
        titre: 'États & rapports',
        description: 'Tableaux de bord, statistiques et exports PDF / Excel',
        icone: 'graphique',
        couleur: 'secondaire',
        vue: () => import('@/views/rapports/RapportsView.vue'),
      },
    ],
  },
]

/** Tous les modules dans une seule liste (pratique pour les routes). */
export const MODULES = GROUPES.flatMap((groupe) => groupe.modules)
