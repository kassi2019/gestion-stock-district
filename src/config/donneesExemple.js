/**
 * =============================================================================
 * ⚠ DONNÉES D'EXEMPLE (FICTIVES) POUR LA PAGE D'ACCUEIL
 * =============================================================================
 * Ces chiffres et listes servent uniquement à montrer l'apparence de l'accueil
 * tant que les modules ne sont pas développés.
 *
 * ➜ Ils seront remplacés par un appel à l'API (ex. GET /api/tableau-de-bord).
 *   Quand ce sera fait, ce fichier pourra être supprimé.
 *
 * Valeurs possibles pour "couleur" :
 *   'principale' (vert santé) | 'secondaire' (vert menthe) | 'rouge' (alerte)
 * =============================================================================
 */

/** Chiffres clés affichés en haut de l'accueil. */
export const INDICATEURS = [
  {
    libelle: 'Valeur du stock dépôt',
    valeur: '12 450 000',
    unite: 'FCFA',
    detail: '▲ 4 % par rapport au mois dernier',
    tendance: 'hausse',
    icone: 'carton',
    couleur: 'principale',
  },
  {
    libelle: 'Alertes stock',
    valeur: '7',
    unite: 'produits',
    detail: '3 ruptures · 4 proches péremption',
    tendance: 'baisse',
    icone: 'alerte',
    couleur: 'rouge',
  },
  {
    libelle: 'Créances en cours',
    valeur: '3 125 000',
    unite: 'FCFA',
    detail: '5 centres en retard de paiement',
    tendance: 'baisse',
    icone: 'portefeuille',
    couleur: 'secondaire',
  },
  {
    libelle: 'Rapports à valider',
    valeur: '4',
    unite: 'rapports',
    detail: "Consommations d'octobre 2026",
    tendance: '',
    icone: 'presse-papier',
    couleur: 'principale',
  },
]

/** Nombre d'éléments en attente par module (badge sur les tuiles). */
export const EN_ATTENTE = {
  consommations: 4,
  facturation: 2,
  livraisons: 3,
  supervisions: 1,
}

/** Alertes de stock (rupture, stock bas, péremption proche). */
export const ALERTES = [
  { produit: 'Amoxicilline 500 mg', detail: 'Lot A23-114 · expire dans 30 jours', statut: 'Péremption', couleur: 'secondaire' },
  { produit: 'Paracétamol 500 mg', detail: 'Stock : 120 / seuil : 500', statut: 'Stock bas', couleur: 'secondaire' },
  { produit: 'Artéméther-Luméfantrine', detail: 'Stock : 0', statut: 'Rupture', couleur: 'rouge' },
  { produit: 'SRO sachet', detail: 'Lot S09-22 · expire dans 45 jours', statut: 'Péremption', couleur: 'secondaire' },
]
