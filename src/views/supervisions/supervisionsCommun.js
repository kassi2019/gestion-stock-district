/**
 * =============================================================================
 * OUTILS COMMUNS AU MODULE 08 — SUPERVISIONS ET INVENTAIRES DANS LES CENTRES
 * =============================================================================
 *   - STATUTS des supervisions, DÉCISIONS possibles ;
 *   - FICHE DE COMPTAGE en PDF (à emporter au centre ; SANS le stock théorique,
 *     pour un comptage « à l'aveugle », non influencé) ;
 *   - RAPPORT DE SUPERVISION en PDF (théorique, physique, écarts valorisés,
 *     agents, validation, décision).
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

export const STATUTS_SUPERVISION = {
  BROUILLON: { libelle: 'Constat en cours', badge: 'badge-gris' },
  SOUMISE: { libelle: 'Soumise (à valider)', badge: 'badge-bleu' },
  VALIDEE: { libelle: 'Validée (décision à prendre)', badge: 'badge-orange' },
  CLOTUREE: { libelle: 'Clôturée', badge: 'badge-vert' },
}

export const DECISIONS = {
  AUCUNE: { libelle: 'Aucune suite', aide: "Écart non retenu (ex. erreur de comptage) : le stock théorique du centre n'est pas modifié." },
  REGULARISATION_STOCK: { libelle: 'Régularisation du stock', aide: 'Le stock théorique du centre est aligné sur le stock physique, sans facturation.' },
  FACTURATION: { libelle: 'Facturation des manquants', aide: 'Stock aligné + FACTURE des produits manquants (montant complémentaire à payer par le centre).' },
}

export function options(objet) {
  return Object.entries(objet).map(([id, v]) => ({ id, libelle: v.libelle }))
}

/** « +3 » / « −5 » / « 0 » */
export function texteEcart(e) {
  return e > 0 ? `+${e}` : e < 0 ? `−${Math.abs(e)}` : '0'
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
    ],
  }
}

/** FICHE DE COMPTAGE (PDF) : à remplir sur place. Pas de stock théorique imprimé (comptage à l'aveugle). */
export function ficheComptagePdf(centre, date, medicaments) {
  return exporterDocumentPdf({
    titre: 'FICHE DE COMPTAGE — SUPERVISION',
    numero: centre.code,
    statut: formaterDate(date),
    encadres: [
      encadreCentre(centre),
      {
        titre: 'Contrôle',
        lignes: [
          ['Date', formaterDate(date)],
          ['Heure de début', '……… h ………'],
          ['Heure de fin', '……… h ………'],
          ['Agents présents', '……………………………'],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (m) => medicaments.indexOf(m) + 1, largeur: 9 },
      { titre: 'Médicament', valeur: (m) => `${m.medicament.code} — ${m.medicament.designation}` },
      { titre: 'Unité', valeur: (m) => m.medicament.uniteVente?.libelle || '', largeur: 20 },
      { titre: 'N° de lot', valeur: () => '', largeur: 28 },
      { titre: 'Quantité comptée', valeur: () => '', largeur: 28 },
      { titre: 'Observation', valeur: () => '', largeur: 36 },
    ],
    lignes: medicaments,
    observations: "Compter les quantités physiquement présentes, sans se référer au stock théorique. Les écarts seront calculés à la saisie dans l'application.",
    signatures: ["L'agent du district (superviseur)", { libelle: 'Le responsable du centre', nom: centre.responsable || '' }],
    nomFichier: `fiche_comptage_${centre.code}_${date}`,
  })
}

/** RAPPORT DE SUPERVISION (PDF). */
export function rapportSupervisionPdf(s) {
  const decision = s.decision ? DECISIONS[s.decision]?.libelle : ''
  return exporterDocumentPdf({
    titre: 'RAPPORT DE SUPERVISION',
    numero: s.numero,
    statut: STATUTS_SUPERVISION[s.statut]?.libelle,
    encadres: [
      encadreCentre(s.centre),
      {
        titre: 'Contrôle',
        lignes: [
          ['Date', formaterDate(s.dateSupervision)],
          ['Agents', s.agents.map((a) => a.nom + (a.fonction ? ` (${a.fonction})` : '')).join(', ')],
          ['Manquants', formaterMontant(s.valeurManquants)],
          ['Excédents', formaterMontant(s.valeurExcedents)],
          ['Validé par', s.validateur ? `${nomPersonne(s.validateur)} le ${formaterDate(s.dateValidation)}` : 'Non validé'],
          ['Décision', decision ? `${decision}${s.facture ? ` — facture ${s.facture.numero}` : ''}` : 'En attente'],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => s.lignes.indexOf(l) + 1, largeur: 8 },
      { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}${l.lot ? ` (lot ${l.lot.numeroLot})` : ''}` },
      { titre: 'Théorique', valeur: (l) => formaterNombre(l.stockTheorique), droite: true, largeur: 19 },
      { titre: 'Physique', valeur: (l) => formaterNombre(l.stockPhysique), droite: true, largeur: 18 },
      { titre: 'Écart', valeur: (l) => texteEcart(l.ecart), droite: true, largeur: 14 },
      { titre: 'Prix', valeur: (l) => (l.prixUnitaire === null ? '—' : formaterMontant(l.prixUnitaire)), droite: true, largeur: 24 },
      { titre: "Valeur de l'écart", valeur: (l) => (l.valeurEcart === null ? '—' : formaterMontant(l.valeurEcart)), droite: true, largeur: 28 },
    ],
    lignes: s.lignes,
    total: { libelle: 'VALEUR NETTE DES ÉCARTS', valeur: formaterMontant(s.valeurEcartTotal) },
    observations: [
      s.observations,
      ...s.lignes.filter((l) => l.commentaire).map((l) => `${l.medicament.designation} : ${l.commentaire}`),
      s.motifDecision ? `Décision (${decision}) : ${s.motifDecision}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    signatures: [
      { libelle: 'Le superviseur', nom: nomPersonne(s.utilisateur) },
      { libelle: 'Le responsable du centre', nom: s.centre.responsable || '' },
      { libelle: 'Validé par', nom: nomPersonne(s.validateur) },
    ],
    nomFichier: `rapport_supervision_${s.numero}`,
  })
}
