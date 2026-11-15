/**
 * =============================================================================
 * OUTILS COMMUNS — FACTURATION, PAIEMENTS ET COMPTES DES CENTRES (module 07)
 * =============================================================================
 *   - STATUTS des factures, MODES de paiement ;
 *   - FACTURE en PDF ;
 *   - REÇU DE PAIEMENT en PDF ;
 *   - RELEVÉ DE COMPTE d'un centre en PDF.
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

export const STATUTS_FACTURE = {
  EMISE: { libelle: 'Émise (à payer)', badge: 'badge-bleu' },
  PARTIELLEMENT_PAYEE: { libelle: 'Partiellement payée', badge: 'badge-orange' },
  PAYEE: { libelle: 'Payée', badge: 'badge-vert' },
  ANNULEE: { libelle: 'Annulée', badge: 'badge-rouge' },
}

export const MODES_PAIEMENT = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile money',
}

export function options(objet) {
  return Object.entries(objet).map(([id, v]) => ({ id, libelle: typeof v === 'string' ? v : v.libelle }))
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « novembre 2026 » à partir d'un rapport { annee, mois } */
export function periodeRapport(r) {
  return r ? `${MOIS[r.mois - 1]} ${r.annee}` : ''
}

function encadreCentre(c) {
  return {
    titre: 'Centre de santé',
    lignes: [
      ['Centre', c.nom],
      ['Code', c.code],
      ['Type', c.type?.libelle],
      ['Localité', c.localite],
      ['Responsable', c.responsable],
      ['Téléphone', c.telephone],
    ],
  }
}

/** FACTURE (PDF) à partir d'une facture complète. */
export function facturePdf(f) {
  const solde = f.statut === 'ANNULEE' ? 0 : Number(f.montantTotal) - Number(f.montantPaye)
  return exporterDocumentPdf({
    titre: 'FACTURE',
    numero: f.numero,
    statut: STATUTS_FACTURE[f.statut]?.libelle,
    encadres: [
      encadreCentre(f.centre),
      {
        titre: 'Facture',
        lignes: [
          ["Date d'émission", formaterDate(f.dateEmission)],
          ['Échéance', f.dateEcheance ? formaterDate(f.dateEcheance) : ''],
          ['Objet', f.rapport ? `Consommation de ${periodeRapport(f.rapport)}` : 'Facture'],
          ['Rapport', f.rapport?.numero],
          ['Déjà payé', formaterMontant(f.montantPaye)],
          ['Reste à payer', formaterMontant(solde)],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => f.lignes.indexOf(l) + 1, largeur: 9 },
      { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` },
      { titre: 'Unité', valeur: (l) => l.medicament.uniteVente?.libelle || '', largeur: 20 },
      { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 20 },
      { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 28 },
      { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, largeur: 30 },
    ],
    lignes: f.lignes,
    total: { libelle: 'MONTANT TOTAL À PAYER', valeur: formaterMontant(f.montantTotal) },
    observations: f.statut === 'ANNULEE' ? `FACTURE ANNULÉE le ${formaterDate(f.dateAnnulation)} — motif : ${f.motifAnnulation}` : '',
    signatures: [
      { libelle: 'Le comptable / caissier', nom: nomPersonne(f.utilisateur) },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `facture_${f.numero}`,
  })
}

/** REÇU DE PAIEMENT (PDF). */
export function recuPdf(p) {
  const impute = p.imputations.reduce((t, i) => t + Number(i.montant), 0)
  return exporterDocumentPdf({
    titre: p.type === 'AVANCE' ? "REÇU D'AVANCE" : 'REÇU DE PAIEMENT',
    numero: p.numero,
    statut: p.annule ? 'ANNULÉ' : formaterDate(p.datePaiement),
    encadres: [
      encadreCentre(p.centre),
      {
        titre: 'Paiement',
        lignes: [
          ['Date', formaterDate(p.datePaiement)],
          ['Mode', MODES_PAIEMENT[p.mode] || p.mode],
          ['Référence', p.reference],
          ['Montant reçu', formaterMontant(p.montant)],
          ['Réparti sur factures', formaterMontant(impute)],
          ['Avance restante', formaterMontant(p.montantNonImpute)],
        ],
      },
    ],
    colonnes: [
      { titre: 'Facture', valeur: (i) => i.facture.numero, largeur: 40 },
      { titre: 'Date de la facture', valeur: (i) => formaterDate(i.facture.dateEmission), largeur: 35 },
      { titre: 'Montant de la facture', valeur: (i) => formaterMontant(i.facture.montantTotal), droite: true },
      { titre: 'Montant réglé', valeur: (i) => formaterMontant(i.montant), droite: true, largeur: 35 },
    ],
    lignes: p.imputations,
    total: { libelle: 'MONTANT REÇU', valeur: formaterMontant(p.montant) },
    observations: [p.observations, p.annule ? `REÇU ANNULÉ le ${formaterDate(p.dateAnnulation)} — motif : ${p.motifAnnulation}` : '']
      .filter(Boolean)
      .join('\n'),
    signatures: [
      { libelle: 'Le comptable / caissier', nom: nomPersonne(p.utilisateur) },
      { libelle: 'Le payeur (centre de santé)', nom: p.centre.responsable || '' },
    ],
    nomFichier: `recu_${p.numero}`,
  })
}

/** RELEVÉ DE COMPTE d'un centre (PDF). */
export function relevePdf(r) {
  const periode = `${r.du ? `du ${formaterDate(r.du)} ` : 'depuis le début '}au ${formaterDate(r.au)}`
  const s = r.situation
  return exporterDocumentPdf({
    titre: 'RELEVÉ DE COMPTE',
    numero: r.centre.code,
    statut: periode,
    encadres: [
      encadreCentre(r.centre),
      {
        titre: 'Situation à ce jour',
        lignes: [
          ['Total facturé', formaterMontant(s?.totalFacture ?? 0)],
          ['Total payé', formaterMontant(s?.totalPaye ?? 0)],
          ['Solde restant dû', formaterMontant(s?.soldeDu ?? 0)],
          ['Avances disponibles', formaterMontant(s?.avances ?? 0)],
          ['Factures en retard', s?.facturesEnRetard ? `${s.facturesEnRetard} (${formaterMontant(s.montantEnRetard)})` : 'Aucune'],
        ],
      },
    ],
    colonnes: [
      { titre: 'Date', valeur: (l) => (l.soldeInitial ? '' : formaterDate(l.date)), largeur: 21 },
      { titre: 'N° pièce', valeur: (l) => l.numero || '', largeur: 30 },
      { titre: 'Libellé', valeur: (l) => l.libelle },
      { titre: 'Débit', valeur: (l) => (l.debit ? formaterMontant(l.debit) : ''), droite: true, largeur: 27 },
      { titre: 'Crédit', valeur: (l) => (l.credit ? formaterMontant(l.credit) : ''), droite: true, largeur: 27 },
      { titre: 'Solde', valeur: (l) => formaterMontant(l.solde), droite: true, largeur: 28 },
    ],
    lignes: [{ soldeInitial: true, libelle: 'Solde au début de la période', debit: 0, credit: 0, solde: r.soldeInitial }, ...r.lignes],
    total: { libelle: r.soldeFinal >= 0 ? 'SOLDE DÛ PAR LE CENTRE' : 'SOLDE EN FAVEUR DU CENTRE', valeur: formaterMontant(Math.abs(r.soldeFinal)) },
    observations: 'Débit : factures émises. Crédit : paiements et avances reçus. Solde positif : montant restant dû par le centre.',
    signatures: [
      { libelle: 'Le comptable / caissier', nom: nomUtilisateurConnecte() },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `releve_compte_${r.centre.code}`,
  })
}
