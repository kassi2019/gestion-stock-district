/**
 * =============================================================================
 * OUTILS COMMUNS AU MODULE 03 — APPROVISIONNEMENTS ET ACHATS
 * =============================================================================
 *   - STATUTS des commandes et des réceptions (libellé + couleur du badge) ;
 *   - BON DE COMMANDE et BON DE RÉCEPTION en PDF (documents officiels).
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

/** Statuts d'une commande fournisseur. */
export const STATUTS_COMMANDE = {
  BROUILLON: { libelle: 'Brouillon', badge: 'badge-gris' },
  VALIDEE: { libelle: 'Validée', badge: 'badge-bleu' },
  PARTIELLEMENT_RECUE: { libelle: 'Partiellement reçue', badge: 'badge-orange' },
  RECUE: { libelle: 'Reçue', badge: 'badge-vert' },
  ANNULEE: { libelle: 'Annulée', badge: 'badge-rouge' },
}

/** Statuts d'une réception. */
export const STATUTS_RECEPTION = {
  BROUILLON: { libelle: 'Brouillon', badge: 'badge-gris' },
  VALIDEE: { libelle: 'Validée (en stock)', badge: 'badge-vert' },
  ANNULEE: { libelle: 'Annulée', badge: 'badge-rouge' },
}

/** Liste { id, libelle } pour les listes déroulantes de filtre. */
export function optionsStatuts(statuts) {
  return Object.entries(statuts).map(([id, s]) => ({ id, libelle: s.libelle }))
}

/** Nom complet d'une personne (ex. « Awa BAMBA »). */

/** Désignation complète d'un médicament (ex. « PARA500 — Paracétamol 500 mg »). */
function designation(m) {
  return `${m.code} — ${m.designation}`
}

/** BON DE COMMANDE (PDF) à partir d'une commande complète (avec ses lignes). */
export function bonDeCommandePdf(commande) {
  const f = commande.fournisseur
  return exporterDocumentPdf({
    titre: 'BON DE COMMANDE',
    numero: commande.numero,
    statut: STATUTS_COMMANDE[commande.statut]?.libelle,
    encadres: [
      {
        titre: 'Fournisseur',
        lignes: [
          ['Raison sociale', f.raisonSociale],
          ['Code', f.code],
          ['Contact', f.contact],
          ['Téléphone', f.telephone],
          ['E-mail', f.email],
          ['Adresse', f.adresse],
        ],
      },
      {
        titre: 'Commande',
        lignes: [
          ['Date', formaterDate(commande.dateCommande)],
          ['Établie par', nomPersonne(commande.utilisateur)],
          ['Nombre de lignes', commande.lignes.length],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => commande.lignes.indexOf(l) + 1, largeur: 10 },
      { titre: 'Médicament', valeur: (l) => designation(l.medicament) },
      { titre: 'Unité', valeur: (l) => l.medicament.uniteVente?.libelle || '', largeur: 20 },
      { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 22 },
      { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 30 },
      { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, largeur: 32 },
    ],
    lignes: commande.lignes,
    total: { libelle: 'MONTANT TOTAL DE LA COMMANDE', valeur: formaterMontant(commande.montantTotal) },
    observations: commande.observations,
    signatures: [
      { libelle: 'Le gestionnaire du dépôt', nom: nomPersonne(commande.validateur) || nomPersonne(commande.utilisateur) },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `bon_commande_${commande.numero}`,
  })
}

/** BON DE RÉCEPTION (PDF) à partir d'une réception complète (avec ses lignes). */
export function bonDeReceptionPdf(reception) {
  const f = reception.fournisseur
  return exporterDocumentPdf({
    titre: 'BON DE RÉCEPTION',
    numero: reception.numero,
    statut: STATUTS_RECEPTION[reception.statut]?.libelle,
    encadres: [
      {
        titre: 'Fournisseur',
        lignes: [
          ['Raison sociale', f.raisonSociale],
          ['Code', f.code],
          ['Téléphone', f.telephone],
          ['Facture n°', reception.numFactureFourn],
          ['Bon de livraison n°', reception.numBonLivraison],
        ],
      },
      {
        titre: 'Réception',
        lignes: [
          ['Date', formaterDate(reception.dateReception)],
          ['Commande', reception.commande?.numero || 'Réception directe'],
          ['Reçue par', nomPersonne(reception.utilisateur)],
          ['Validée par', nomPersonne(reception.validateur)],
          ['Validée le', reception.dateValidation ? formaterDate(reception.dateValidation) : ''],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => reception.lignes.indexOf(l) + 1, largeur: 9 },
      { titre: 'Médicament', valeur: (l) => designation(l.medicament) },
      { titre: 'Lot', valeur: (l) => l.numeroLot || '—', largeur: 24 },
      { titre: 'Péremption', valeur: (l) => (l.datePeremption ? formaterDate(l.datePeremption) : '—'), largeur: 22 },
      { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 20 },
      { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 27 },
      { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, largeur: 29 },
    ],
    lignes: reception.lignes,
    total: { libelle: 'MONTANT TOTAL REÇU', valeur: formaterMontant(reception.montantTotal) },
    observations: reception.observations,
    signatures: [
      'Le livreur (fournisseur)', // personne qui livre : inconnue du système, nom à écrire à la main
      { libelle: 'Le gestionnaire du dépôt', nom: nomPersonne(reception.validateur) || nomPersonne(reception.utilisateur) },
    ],
    nomFichier: `bon_reception_${reception.numero}`,
  })
}
