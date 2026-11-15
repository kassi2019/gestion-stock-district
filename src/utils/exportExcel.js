/**
 * =============================================================================
 * EXPORT EXCEL (.xlsx) D'UN TABLEAU — librairie ExcelJS
 * =============================================================================
 * Même description de colonnes que l'export PDF (utils/exportPdf.js), plus
 * une option pour garder les NOMBRES en vrais nombres dans Excel (calculables) :
 *
 *     exporterExcel({
 *       titre: 'Consommations', sousTitre: 'Novembre 2026 — Tous les centres',
 *       colonnes: [
 *         { titre: 'Centre', valeur: (l) => l.centre.nom },
 *         { titre: 'Montant', valeur: (l) => formaterMontant(l.montant),
 *           nombre: (l) => l.montant, somme: (l) => l.montant },  // « nombre » : cellule numérique
 *       ],
 *       lignes, nomFichier: 'consommations',
 *     })
 *
 * Contenu : nom du district, titre, sous-titre, date d'édition, en-tête vert,
 * lignes, ligne TOTAL (colonnes ayant « somme »), filtres automatiques.
 * =============================================================================
 */
import { infosDistrict } from '@/utils/exportPdf'

async function chargerExcelJS() {
  const module = await import('exceljs')
  return module.default || module
}

export async function exporterExcel({ titre, sousTitre = '', colonnes, lignes, nomFichier }) {
  const [ExcelJS, district] = await Promise.all([chargerExcelJS(), infosDistrict()])
  const classeur = new ExcelJS.Workbook()
  classeur.creator = district.nom
  const feuille = classeur.addWorksheet(titre.substring(0, 31).replace(/[\\/?*[\]:]/g, '-'))

  // ---------- En-tête du document ----------
  feuille.addRow([district.nom]).font = { bold: true, size: 13, color: { argb: 'FF007A50' } }
  feuille.addRow([titre]).font = { bold: true, size: 12 }
  if (sousTitre) feuille.addRow([sousTitre]).font = { italic: true, color: { argb: 'FF6B7280' } }
  feuille.addRow([`Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`]).font = {
    size: 9,
    color: { argb: 'FF6B7280' },
  }
  feuille.addRow([])

  // ---------- Ligne des titres de colonnes ----------
  const entete = feuille.addRow(colonnes.map((c) => c.titre))
  const ligneEntete = entete.number
  entete.eachCell((cellule) => {
    cellule.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A36C' } }
    cellule.alignment = { vertical: 'middle', wrapText: true }
  })

  // ---------- Lignes ----------
  for (const ligne of lignes) {
    // « nombre » : cellule numérique, sauf « excelTexte » (dates, mois : texte lisible)
    const numerique = (c) => c.nombre && !c.excelTexte
    const ligneExcel = feuille.addRow(colonnes.map((c) => (numerique(c) ? c.nombre(ligne) ?? null : c.valeur(ligne) ?? '')))
    colonnes.forEach((c, i) => {
      if (numerique(c)) ligneExcel.getCell(i + 1).numFmt = '# ##0'
      if (c.droite) ligneExcel.getCell(i + 1).alignment = { horizontal: 'right' }
    })
  }

  // ---------- Ligne TOTAL ----------
  if (colonnes.some((c) => c.somme) && lignes.length) {
    const total = feuille.addRow(
      colonnes.map((c, i) => {
        if (c.somme) return lignes.reduce((t, l) => t + (Number(c.somme(l)) || 0), 0)
        return i === 0 ? 'TOTAL' : ''
      }),
    )
    total.eachCell((cellule, numero) => {
      cellule.font = { bold: true }
      cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F6EF' } }
      if (colonnes[numero - 1]?.somme) cellule.numFmt = '# ##0'
    })
  }

  // ---------- Largeurs, filtres, volet figé ----------
  colonnes.forEach((c, i) => {
    const longueurs = [c.titre.length, ...lignes.slice(0, 200).map((l) => String(c.valeur(l) ?? '').length)]
    feuille.getColumn(i + 1).width = Math.min(Math.max(...longueurs) + 3, 50)
  })
  feuille.autoFilter = { from: { row: ligneEntete, column: 1 }, to: { row: ligneEntete, column: colonnes.length } }
  feuille.views = [{ state: 'frozen', ySplit: ligneEntete }]

  // ---------- Téléchargement ----------
  const contenu = await classeur.xlsx.writeBuffer()
  const blob = new Blob([contenu], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(blob)
  lien.download = `${nomFichier}.xlsx`
  lien.click()
  URL.revokeObjectURL(lien.href)
}
