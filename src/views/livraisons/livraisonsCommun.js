/**
 * =============================================================================
 * OUTILS COMMUNS AU MODULE 05 — COMMANDES ET LIVRAISONS AUX CENTRES
 * =============================================================================
 *   - STATUTS des commandes des centres et des bons de livraison ;
 *   - BON DE LIVRAISON en PDF (centre, produits, lots, quantités, prix, date) ;
 *   - ÉTAT DU STOCK THÉORIQUE D'UN CENTRE en PDF.
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

export const STATUTS_COMMANDE_CENTRE = {
  BROUILLON: { libelle: 'Brouillon', badge: 'badge-gris' },
  VALIDEE: { libelle: 'Validée (à livrer)', badge: 'badge-bleu' },
  PARTIELLEMENT_LIVREE: { libelle: 'Partiellement livrée', badge: 'badge-orange' },
  LIVREE: { libelle: 'Livrée', badge: 'badge-vert' },
  ANNULEE: { libelle: 'Annulée', badge: 'badge-rouge' },
}

export const STATUTS_LIVRAISON = {
  BROUILLON: { libelle: 'En préparation', badge: 'badge-orange' },
  VALIDEE: { libelle: 'Livrée', badge: 'badge-vert' },
  ANNULEE: { libelle: 'Annulée', badge: 'badge-rouge' },
}

/**
 * Étapes du circuit « commande d'un centre -> livraison », affichées en haut
 * des fenêtres Commande et Livraison (composant EtapesCircuit).
 * Les numéros ci-dessous (ETAPE_LIVRAISON.xxx) servent à dire quelle étape est en cours.
 */
export const ETAPES_LIVRAISON = ['Commande', 'Accord', 'Préparation', 'Livraison', 'Bon de livraison']
export const ETAPE_LIVRAISON = { COMMANDE: 0, ACCORD: 1, PREPARATION: 2, LIVRAISON: 3, BON: 4, TERMINE: 5 }

export function optionsStatuts(statuts) {
  return Object.entries(statuts).map(([id, s]) => ({ id, libelle: s.libelle }))
}

/** BON DE LIVRAISON (PDF) à partir d'une livraison complète (lignes par lot). */
export function bonDeLivraisonPdf(livraison) {
  const c = livraison.centre
  const livree = livraison.statut === 'VALIDEE'
  const quantite = (l) => (livree ? l.quantiteLivree : l.quantitePreparee)
  return exporterDocumentPdf({
    titre: 'BON DE LIVRAISON',
    numero: livraison.numero,
    statut: STATUTS_LIVRAISON[livraison.statut]?.libelle,
    encadres: [
      {
        titre: 'Centre de santé',
        lignes: [
          ['Centre', c.nom],
          ['Code', c.code],
          ['Type', c.type?.libelle],
          ['Localité', c.localite],
          ['Responsable', c.responsable],
          ['Téléphone', c.telephone],
        ],
      },
      {
        titre: 'Livraison',
        lignes: [
          ['Date', formaterDate(livraison.dateLivraison)],
          ['Commande', livraison.commande?.numero || 'Livraison directe'],
          ['Préparée par', nomPersonne(livraison.utilisateur)],
          ['Validée par', nomPersonne(livraison.validateur)],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => livraison.lignes.indexOf(l) + 1, largeur: 8 },
      { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` },
      { titre: 'Lot', valeur: (l) => l.lot?.numeroLot || '—', largeur: 22 },
      { titre: 'Péremption', valeur: (l) => (l.lot?.datePeremption ? formaterDate(l.lot.datePeremption) : '—'), largeur: 23 },
      { titre: livree ? 'Qté livrée' : 'Qté préparée', valeur: (l) => formaterNombre(quantite(l)), droite: true, largeur: 22 },
      { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 27 },
      { titre: 'Montant', valeur: (l) => formaterMontant(quantite(l) * Number(l.prixUnitaire)), droite: true, largeur: 29 },
    ],
    lignes: livraison.lignes,
    total: { libelle: 'MONTANT TOTAL', valeur: formaterMontant(livraison.montantTotal) },
    observations: livraison.observations,
    signatures: [
      { libelle: 'Le gestionnaire du dépôt', nom: nomPersonne(livraison.validateur) || nomPersonne(livraison.utilisateur) },
      'Le livreur',
      { libelle: 'Le responsable du centre (reçu conforme)', nom: c.responsable || '' },
    ],
    nomFichier: `bon_livraison_${livraison.numero}`,
  })
}

/** ÉTAT DU STOCK THÉORIQUE D'UN CENTRE (PDF). */
export function stockCentrePdf(fiche) {
  const c = fiche.centre
  return exporterDocumentPdf({
    titre: 'STOCK THÉORIQUE DU CENTRE',
    numero: c.code,
    statut: `au ${new Date().toLocaleDateString('fr-FR')}`,
    encadres: [
      { titre: 'Centre de santé', lignes: [['Centre', c.nom], ['Type', c.type?.libelle], ['Localité', c.localite], ['Responsable', c.responsable]] },
      {
        titre: 'Résumé',
        lignes: [
          ['Médicaments', fiche.stock.length],
          ['Livraisons', fiche.livraisons.filter((l) => l.statut === 'VALIDEE').length],
        ],
      },
    ],
    colonnes: [
      { titre: 'Code', valeur: (s) => s.medicament.code, largeur: 28 },
      { titre: 'Médicament', valeur: (s) => s.medicament.designation },
      { titre: 'Unité', valeur: (s) => s.medicament.uniteVente?.libelle || '', largeur: 25 },
      { titre: 'Stock théorique', valeur: (s) => formaterNombre(s.quantiteTheorique), droite: true, largeur: 32 },
    ],
    lignes: fiche.stock,
    signatures: [
      { libelle: 'Le gestionnaire du dépôt', nom: nomUtilisateurConnecte() },
      { libelle: 'Le responsable du centre', nom: c.responsable || '' },
    ],
    nomFichier: `stock_centre_${c.code}`,
  })
}
