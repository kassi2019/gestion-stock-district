/**
 * =============================================================================
 * DOCUMENTS OFFICIELS EN PDF (bon de commande, bon de réception...)
 * =============================================================================
 * Mise en page d'un DOCUMENT (et non d'une simple liste) :
 *   - en-tête : nom et coordonnées du district (Paramètres généraux) ;
 *   - titre et numéro du document (ex. « BON DE COMMANDE N° BCF-2026-00001 ») ;
 *   - deux encadrés d'informations (ex. Fournisseur / Commande) ;
 *   - tableau des lignes, avec le TOTAL en bas ;
 *   - observations, puis zones de SIGNATURE ;
 *   - pied de page : date d'édition et « Page X / Y ».
 *
 * Utilisation :
 *     await exporterDocumentPdf({
 *       titre: 'BON DE COMMANDE',
 *       numero: 'BCF-2026-00001',
 *       statut: 'Validée',                          // facultatif (affiché à droite)
 *       encadres: [
 *         { titre: 'Fournisseur', lignes: [['Raison sociale', 'NPSP'], ['Téléphone', '...']] },
 *         { titre: 'Commande', lignes: [['Date', '15/11/2026'], ['Établie par', '...']] },
 *       ],
 *       colonnes: [{ titre: 'Désignation', valeur: (l) => ..., droite?: true, largeur?: 60 }],
 *       lignes,
 *       total: { libelle: 'MONTANT TOTAL', valeur: '125 000 FCFA' },
 *       observations: '...',
 *       signatures: ['Le gestionnaire du dépôt', 'Le responsable du district'],
 *       nomFichier: 'bon_commande_BCF-2026-00001',
 *     })
 * =============================================================================
 */
import { infosDistrict, nettoyerTexte } from '@/utils/exportPdf'

const VERT = [0, 163, 108]
const VERT_FONCE = [0, 122, 80]
const VERT_PALE = [243, 250, 246]
const TEXTE = [31, 41, 55]
const GRIS = [107, 114, 128]

export async function exporterDocumentPdf({
  titre,
  numero,
  statut = '',
  encadres = [],
  colonnes,
  lignes,
  total = null,
  observations = '',
  signatures = [],
  nomFichier,
}) {
  const [{ jsPDF }, { autoTable }, district] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    infosDistrict(),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const marge = 14
  const maintenant = new Date()

  // ---------------------------------------------------------------------------
  // 1. EN-TÊTE : district à gauche, titre du document à droite
  // ---------------------------------------------------------------------------
  doc.setFillColor(...VERT)
  doc.rect(0, 0, largeur, 4, 'F')

  doc.setTextColor(...VERT_FONCE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(nettoyerTexte(district.nom).toUpperCase(), marge, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRIS)
  if (district.contact) doc.text(doc.splitTextToSize(nettoyerTexte(district.contact), 100), marge, 21.5)

  doc.setTextColor(...TEXTE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(nettoyerTexte(titre), largeur - marge, 15, { align: 'right' })
  doc.setFontSize(11)
  doc.setTextColor(...VERT_FONCE)
  doc.text(`N° ${nettoyerTexte(numero)}`, largeur - marge, 22, { align: 'right' })
  if (statut) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRIS)
    doc.text(`Statut : ${nettoyerTexte(statut)}`, largeur - marge, 27, { align: 'right' })
  }

  doc.setDrawColor(...VERT)
  doc.setLineWidth(0.5)
  doc.line(marge, 32, largeur - marge, 32)

  // ---------------------------------------------------------------------------
  // 2. ENCADRÉS D'INFORMATIONS (côte à côte)
  // ---------------------------------------------------------------------------
  let y = 38
  if (encadres.length) {
    const espace = 6
    const largeurEncadre = (largeur - 2 * marge - espace * (encadres.length - 1)) / encadres.length
    let hauteurMax = 0
    encadres.forEach((encadre, index) => {
      const x = marge + index * (largeurEncadre + espace)
      const lignesInfo = encadre.lignes.filter(([, valeur]) => valeur !== null && valeur !== undefined && valeur !== '')
      const hauteurEncadre = 9 + lignesInfo.length * 5.2 + 2
      hauteurMax = Math.max(hauteurMax, hauteurEncadre)

      doc.setFillColor(...VERT_PALE)
      doc.setDrawColor(208, 232, 219)
      doc.roundedRect(x, y, largeurEncadre, hauteurEncadre, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...VERT_FONCE)
      doc.text(nettoyerTexte(encadre.titre).toUpperCase(), x + 4, y + 6)

      doc.setFontSize(8.5)
      lignesInfo.forEach(([libelle, valeur], i) => {
        const yLigne = y + 12 + i * 5.2
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...GRIS)
        doc.text(nettoyerTexte(libelle), x + 4, yLigne)
        doc.setTextColor(...TEXTE)
        doc.setFont('helvetica', 'bold')
        const texte = doc.splitTextToSize(nettoyerTexte(valeur), largeurEncadre - 40)[0]
        doc.text(texte, x + 36, yLigne)
      })
    })
    y += hauteurMax + 6
  }

  // ---------------------------------------------------------------------------
  // 3. TABLEAU DES LIGNES (+ TOTAL)
  // ---------------------------------------------------------------------------
  const stylesColonnes = {}
  colonnes.forEach((c, i) => {
    stylesColonnes[i] = { ...(c.droite ? { halign: 'right' } : {}), ...(c.largeur ? { cellWidth: c.largeur } : {}) }
  })
  // Ligne TOTAL : le libellé s'étend sur toutes les colonnes sauf la dernière
  // (sinon il serait coupé dans la 1re colonne, souvent étroite comme « N° »),
  // aligné à droite juste avant le montant.
  const pied = total
    ? [
        [
          { content: nettoyerTexte(total.libelle), colSpan: colonnes.length - 1, styles: { halign: 'right' } },
          { content: nettoyerTexte(total.valeur), styles: { halign: 'right' } },
        ],
      ]
    : []

  autoTable(doc, {
    startY: y,
    margin: { left: marge, right: marge, bottom: 20 },
    head: [colonnes.map((c) => nettoyerTexte(c.titre))],
    body: lignes.map((ligne) => colonnes.map((c) => nettoyerTexte(c.valeur(ligne)))),
    foot: pied,
    showFoot: 'lastPage',
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 2.4, textColor: TEXTE, lineColor: [229, 231, 235], lineWidth: 0.2 },
    headStyles: { fillColor: VERT, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [227, 245, 236], textColor: VERT_FONCE, fontStyle: 'bold', fontSize: 10 },
    alternateRowStyles: { fillColor: VERT_PALE },
    columnStyles: stylesColonnes,
    didParseCell: (d) => {
      if (d.section !== 'body' && colonnes[d.column.index]?.droite) d.cell.styles.halign = 'right'
    },
    didDrawPage: (d) => {
      doc.setDrawColor(...VERT)
      doc.setLineWidth(0.3)
      doc.line(marge, hauteur - 12, largeur - marge, hauteur - 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRIS)
      doc.text(
        `${nettoyerTexte(titre)} N° ${nettoyerTexte(numero)} — édité le ${maintenant.toLocaleDateString('fr-FR')} à ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        marge,
        hauteur - 7,
      )
      doc.text(`Page ${d.pageNumber} / {total}`, largeur - marge, hauteur - 7, { align: 'right' })
    },
  })
  y = doc.lastAutoTable.finalY + 8

  // ---------------------------------------------------------------------------
  // 4. OBSERVATIONS
  // ---------------------------------------------------------------------------
  if (observations) {
    const texte = doc.splitTextToSize(nettoyerTexte(observations), largeur - 2 * marge)
    if (y + 8 + texte.length * 4.5 > hauteur - 50) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...VERT_FONCE)
    doc.text('Observations', marge, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXTE)
    doc.text(texte, marge, y + 5)
    y += 8 + texte.length * 4.5
  }

  // ---------------------------------------------------------------------------
  // 5. SIGNATURES
  // ---------------------------------------------------------------------------
  if (signatures.length) {
    if (y + 35 > hauteur - 16) {
      doc.addPage()
      y = 20
    }
    const largeurSignature = (largeur - 2 * marge) / signatures.length
    signatures.forEach((libelle, i) => {
      const x = marge + i * largeurSignature
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEXTE)
      doc.text(nettoyerTexte(libelle), x + largeurSignature / 2, y + 4, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRIS)
      doc.text('Nom, date et signature', x + largeurSignature / 2, y + 9, { align: 'center' })
      doc.setDrawColor(200, 200, 200)
      doc.line(x + 8, y + 30, x + largeurSignature - 8, y + 30)
    })
  }

  doc.putTotalPages('{total}')
  doc.save(`${nomFichier}.pdf`)
}
