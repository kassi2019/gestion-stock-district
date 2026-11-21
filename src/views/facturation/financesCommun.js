/**
 * =============================================================================
 * OUTILS COMMUNS — FACTURATION, PAIEMENTS ET COMPTES DES CENTRES (module 07)
 * =============================================================================
 *   - STATUTS des factures, MODES de paiement ;
 *   - FACTURE en PDF ;
 *   - REÇU DE PAIEMENT en PDF (2 exemplaires sur une page A4, à découper) ;
 *   - RELEVÉ DE COMPTE d'un centre en PDF.
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { infosDistrict, nettoyerTexte } from '@/utils/exportPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { montantEnLettres } from '@/utils/montantEnLettres'

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

/** Origine d'une facture-sortie (spec nov. 2026). */
export const ORIGINES_FACTURE = {
  RAPPORT: 'Suite au rapport',
  MANUELLE: 'Manuelle (complément)',
}

/**
 * Objet d'une facture :
 *   - facture-sortie : livraison suite au rapport du centre, ou complément manuel ;
 *   - ancien circuit : consommation d'un mois, ou écart de supervision.
 */
export function objetFacture(f) {
  if (f.type === 'SORTIE') {
    return f.origine === 'RAPPORT' && f.rapport ? `Livraison suite au rapport de ${periodeRapport(f.rapport)}` : 'Livraison complémentaire'
  }
  if (f.rapport) return `Consommation de ${periodeRapport(f.rapport)}`
  if (f.supervision) return `Écart de supervision ${f.supervision.numero}`
  return f.type === 'ECART_SUPERVISION' ? 'Écart de supervision' : '—'
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
          ['Objet', objetFacture(f)],
          [f.supervision ? 'Supervision du' : 'Rapport', f.supervision ? formaterDate(f.supervision.dateSupervision) : f.rapport?.numero],
          ['Déjà payé', formaterMontant(f.montantPaye)],
          ['Reste à payer', formaterMontant(solde)],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => f.lignes.indexOf(l) + 1, largeur: 9 },
      { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` },
      { titre: 'Unité', valeur: (l) => l.medicament.uniteVente?.libelle || '', largeur: 20 },
      // Facture-sortie : lot livré
      ...(f.sortieStock ? [{ titre: 'Lot', valeur: (l) => l.lot?.numeroLot || '—', largeur: 24 }] : []),
      { titre: 'Quantité', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 20 },
      { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 28 },
      { titre: 'Montant', valeur: (l) => formaterMontant(l.montant), droite: true, largeur: 30 },
    ],
    lignes: f.lignes,
    total: { libelle: 'MONTANT TOTAL À PAYER', valeur: formaterMontant(f.montantTotal) },
    observations: f.supervision && f.statut !== 'ANNULEE'
      ? `Facture des produits manquants constatés lors de la supervision ${f.supervision.numero} du ${formaterDate(f.supervision.dateSupervision)} (écart validé).`
      : f.statut === 'ANNULEE' ? `FACTURE ANNULÉE le ${formaterDate(f.dateAnnulation)} — motif : ${f.motifAnnulation}` : '',
    signatures: [
      { libelle: 'Le comptable / caissier', nom: nomPersonne(f.utilisateur) },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `facture_${f.numero}`,
  })
}

/** « en espèces », « par chèque n° 1234 »... (phrase du reçu) */
function modeEnPhrase(p) {
  const ref = p.reference ? ` n° ${p.reference}` : ''
  if (p.mode === 'ESPECES') return 'en espèces'
  if (p.mode === 'CHEQUE') return `par chèque${ref}`
  if (p.mode === 'VIREMENT') return `par virement${ref}`
  if (p.mode === 'MOBILE_MONEY') return `par mobile money${ref}`
  return `par ${(MODES_PAIEMENT[p.mode] || p.mode || '').toLowerCase()}${ref}`
}

/**
 * REÇU DE PAIEMENT (PDF) — une page A4 portrait coupée en DEUX exemplaires
 * identiques (demi-page chacun) : « Exemplaire district » en haut,
 * « Exemplaire centre de santé » en bas, séparés par un trait « découper ici ».
 * Les deux parties signent, on coupe, chacun garde sa moitié.
 *
 * Texte : « Je soussigné(e) [gestionnaire], gestionnaire du [district],
 * reconnais avoir reçu de M./Mme [responsable], responsable du centre de santé
 * [centre], la somme de [en lettres] francs CFA ([en chiffres]) [mode], pour
 * l'achat de médicaments. » + factures réglées + SOLDE du compte après ce paiement.
 * L'en-tête (nom, région, localité, contacts) vient de Paramétrage > Paramètres généraux.
 */
export async function recuPdf(p) {
  const [{ jsPDF }, district] = await Promise.all([import('jspdf'), infosDistrict()])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth() // 210
  const demiPage = doc.internal.pageSize.getHeight() / 2 // 148,5
  const marge = 14
  const t = nettoyerTexte // texte sûr pour la police du PDF (espaces insécables...)

  const gestionnaire = nomPersonne(p.utilisateur) || '..........................................'
  const responsable = p.centre.responsable || '..........................................'
  const montant = Number(p.montant)

  // Phrase principale
  const phrase =
    `Je soussigné(e), ${gestionnaire}, gestionnaire du ${district.nom}, reconnais avoir reçu de ` +
    `M./Mme ${responsable}, responsable du centre de santé ${p.centre.nom} (code ${p.centre.code}), ` +
    `la somme de ${montantEnLettres(montant).toUpperCase()} FRANCS CFA (${formaterMontant(montant)}), ` +
    `${modeEnPhrase(p)}, pour l'achat de médicaments.`

  // Affectation du paiement : factures réglées ou avance
  const factures = p.imputations.map((i) => i.facture.numero)
  const affectation = factures.length
    ? `En règlement de : ${factures.length > 1 ? 'factures' : 'facture'} ${factures.join(', ')}` +
      (Number(p.montantNonImpute) > 0 ? ` (dont ${formaterMontant(p.montantNonImpute)} en avance).` : '.')
    : 'Versé à titre d\'avance sur les prochaines factures.'

  // Solde du compte du centre juste après ce paiement (calculé par le serveur)
  const solde = Number(p.soldeApres ?? 0)
  const texteSolde =
    solde > 0
      ? `Solde du compte du centre après ce paiement : ${formaterMontant(solde)} restant à payer.`
      : solde < 0
        ? `Solde du compte du centre après ce paiement : avance de ${formaterMontant(-solde)} en faveur du centre.`
        : 'Solde du compte du centre après ce paiement : 0 FCFA (compte soldé).'

  /** Dessine un exemplaire du reçu à partir de la hauteur y0. */
  function exemplaire(y0, libelleExemplaire) {
    // --- En-tête : district à gauche, titre et numéro à droite
    doc.setFillColor(0, 163, 108)
    doc.rect(0, y0, largeur, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 122, 80)
    doc.text(doc.splitTextToSize(t(district.nom).toUpperCase(), 110), marge, y0 + 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    const infos = [district.region ? `Région sanitaire : ${district.region}` : '', district.contact].filter(Boolean)
    infos.forEach((ligne, i) => doc.text(doc.splitTextToSize(t(ligne), 110)[0], marge, y0 + 16 + i * 4))

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(31, 41, 55)
    doc.text('REÇU DE PAIEMENT', largeur - marge, y0 + 11, { align: 'right' })
    doc.setFontSize(10)
    doc.setTextColor(0, 122, 80)
    doc.text(`N° ${t(p.numero)}`, largeur - marge, y0 + 17, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(libelleExemplaire, largeur - marge, y0 + 22, { align: 'right' })

    doc.setDrawColor(0, 163, 108)
    doc.setLineWidth(0.4)
    doc.line(marge, y0 + 27, largeur - marge, y0 + 27)

    // --- Lieu et date
    doc.setFontSize(9.5)
    doc.setTextColor(31, 41, 55)
    const lieu = district.localite ? `Fait à ${district.localite}, le ` : 'Le '
    doc.text(t(`${lieu}${formaterDate(p.datePaiement)}`), largeur - marge, y0 + 34, { align: 'right' })

    // --- Corps du reçu
    let y = y0 + 42
    doc.setFontSize(10.5)
    const lignesPhrase = doc.splitTextToSize(t(phrase), largeur - 2 * marge)
    doc.text(lignesPhrase, marge, y, { lineHeightFactor: 1.45 })
    y += lignesPhrase.length * 5.4 + 2

    doc.setFontSize(9.5)
    const lignesAffectation = doc.splitTextToSize(t(affectation), largeur - 2 * marge)
    doc.text(lignesAffectation, marge, y)
    y += lignesAffectation.length * 4.5 + 2

    // Encadré : montant reçu + solde du compte
    doc.setFillColor(243, 250, 246)
    doc.setDrawColor(208, 232, 219)
    doc.roundedRect(marge, y, largeur - 2 * marge, 15, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 122, 80)
    doc.text(t(`Montant reçu : ${formaterMontant(montant)}`), marge + 4, y + 6)
    doc.setFontSize(9.5)
    doc.setTextColor(31, 41, 55)
    doc.text(t(texteSolde), marge + 4, y + 11.5)
    y += 19

    // Reçu annulé : mention bien visible
    if (p.annule) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(200, 30, 30)
      doc.text(t(`REÇU ANNULÉ le ${formaterDate(p.dateAnnulation)} — motif : ${p.motifAnnulation || ''}`).slice(0, 110), marge, y + 2)
    }

    // --- Signatures (en bas de la demi-page)
    const ySig = y0 + 108
    const colonne = (largeur - 2 * marge) / 2
    const signatures = [
      { libelle: 'Le gestionnaire du district', nom: nomPersonne(p.utilisateur) },
      { libelle: 'Le responsable du centre de santé', nom: p.centre.responsable || '' },
    ]
    signatures.forEach((s, i) => {
      const centre = marge + i * colonne + colonne / 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(31, 41, 55)
      doc.text(s.libelle, centre, ySig, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(0, 122, 80)
      if (s.nom) doc.text(t(s.nom), centre, ySig + 5, { align: 'center' })
      doc.setFontSize(7.5)
      doc.setTextColor(107, 114, 128)
      doc.text('Signature', centre, ySig + (s.nom ? 9 : 5), { align: 'center' })
      doc.setDrawColor(190, 190, 190)
      doc.setLineWidth(0.2)
      doc.line(centre - 30, ySig + 27, centre + 30, ySig + 27)
    })

    // --- Pied : date d'édition
    const maintenant = new Date()
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Reçu N° ${t(p.numero)} — édité le ${maintenant.toLocaleDateString('fr-FR')} à ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      marge,
      y0 + demiPage - 5,
    )
  }

  exemplaire(0, 'Exemplaire DISTRICT')
  exemplaire(demiPage, 'Exemplaire CENTRE DE SANTÉ')

  // Trait de découpe entre les deux exemplaires
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(4, demiPage, largeur - 4, demiPage)
  doc.setLineDashPattern([], 0)
  doc.setFillColor(255, 255, 255)
  doc.rect(largeur / 2 - 14, demiPage - 2.5, 28, 5, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text('Découper ici', largeur / 2, demiPage + 1, { align: 'center' })

  doc.save(`recu_${p.numero}.pdf`)
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
