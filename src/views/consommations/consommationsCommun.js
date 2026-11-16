/**
 * =============================================================================
 * OUTILS COMMUNS AU MODULE 06 — RAPPORTS MENSUELS DE CONSOMMATION
 * =============================================================================
 *   - STATUTS des rapports, MOIS, libellé d'une période ;
 *   - quantité RETENUE d'une ligne (vérifiée sur place, sinon déclarée) ;
 *   - RAPPORT DE CONSOMMATION en PDF ;
 *   - FICHE DE VÉRIFICATION en PDF (à emporter au centre, colonne « constaté » vide).
 * =============================================================================
 */
import { exporterDocumentPdf, nomPersonne } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

export const STATUTS_RAPPORT = {
  BROUILLON: { libelle: 'Brouillon', badge: 'badge-gris' },
  SOUMIS: { libelle: 'Soumis (à valider)', badge: 'badge-bleu' },
  VALIDE: { libelle: 'Validé', badge: 'badge-vert' },
  FACTURE: { libelle: 'Facturé', badge: 'badge-orange' },
}

/**
 * Étapes du circuit d'un rapport mensuel, affichées en haut de la fenêtre
 * du rapport (composant EtapesCircuit). La vérification sur place est facultative.
 * Les numéros ci-dessous (ETAPE_RAPPORT.xxx) servent à dire quelle étape est en cours.
 */
export const ETAPES_RAPPORT = ['Saisie et soumission', 'Vérification sur place (facultative)', 'Validation', 'Facturation']
export const ETAPE_RAPPORT = { SAISIE: 0, VERIFICATION: 1, VALIDATION: 2, FACTURATION: 3, TERMINE: 4 }

export const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
export const OPTIONS_MOIS = MOIS.map((libelle, i) => ({ id: i + 1, libelle }))

/** « Novembre 2026 » */
export function libellePeriode(annee, mois) {
  return `${MOIS[mois - 1]} ${annee}`
}

export function optionsStatuts() {
  return Object.entries(STATUTS_RAPPORT).map(([id, s]) => ({ id, libelle: s.libelle }))
}

/** Quantité RETENUE : vérifiée sur place si saisie, sinon déclarée. */
export function quantiteRetenue(ligne) {
  return ligne.quantiteVerifiee ?? ligne.quantite
}

function designation(m) {
  return `${m.code} — ${m.designation}`
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

/** RAPPORT MENSUEL DE CONSOMMATION (PDF). */
export function rapportPdf(rapport) {
  const verifie = !!rapport.dateVerification
  const colonnes = [
    { titre: 'N°', valeur: (l) => rapport.lignes.indexOf(l) + 1, largeur: 8 },
    { titre: 'Médicament', valeur: (l) => designation(l.medicament) },
    { titre: 'Déclaré', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 17 },
  ]
  if (verifie) {
    colonnes.push(
      { titre: 'Vérifié', valeur: (l) => (l.quantiteVerifiee === null ? '—' : formaterNombre(l.quantiteVerifiee)), droite: true, largeur: 17 },
      {
        titre: 'Écart',
        valeur: (l) => {
          if (l.quantiteVerifiee === null) return ''
          const e = l.quantiteVerifiee - l.quantite
          return e > 0 ? `+${e}` : String(e)
        },
        droite: true,
        largeur: 14,
      },
    )
  }
  colonnes.push(
    { titre: 'Prix unitaire', valeur: (l) => formaterMontant(l.prixUnitaire), droite: true, largeur: 26 },
    { titre: 'Montant', valeur: (l) => formaterMontant(quantiteRetenue(l) * Number(l.prixUnitaire)), droite: true, largeur: 29 },
  )
  return exporterDocumentPdf({
    titre: 'RAPPORT MENSUEL DE CONSOMMATION',
    numero: rapport.numero,
    statut: STATUTS_RAPPORT[rapport.statut]?.libelle,
    encadres: [
      encadreCentre(rapport.centre),
      {
        titre: 'Rapport',
        lignes: [
          ['Période', libellePeriode(rapport.annee, rapport.mois)],
          ['Saisi par', nomPersonne(rapport.utilisateur)],
          ['Vérifié le', verifie ? formaterDate(rapport.dateVerification) : 'Non vérifié'],
          ['Vérifié par', nomPersonne(rapport.verificateur)],
          ['Validé par', nomPersonne(rapport.validateur)],
        ],
      },
    ],
    colonnes,
    lignes: rapport.lignes,
    total: { libelle: 'MONTANT TOTAL DE LA CONSOMMATION', valeur: formaterMontant(rapport.montantTotal) },
    observations: [
      rapport.observations,
      verifie && rapport.agentsVerification ? `Vérification sur place — agents présents : ${rapport.agentsVerification}` : '',
      verifie && rapport.observationsVerification ? `Constats : ${rapport.observationsVerification}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    signatures: [
      { libelle: 'Le responsable du centre', nom: rapport.centre.responsable || '' },
      { libelle: "L'agent de saisie", nom: nomPersonne(rapport.utilisateur) },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `rapport_consommation_${rapport.numero}`,
  })
}

/**
 * FICHE DE VÉRIFICATION (PDF) : à emporter au centre. Quantités déclarées
 * et stock théorique imprimés ; colonnes « Constaté » et « Observation » vides,
 * à remplir sur place, puis à saisir dans l'application.
 */
export function ficheVerificationPdf(rapport) {
  return exporterDocumentPdf({
    titre: 'FICHE DE VÉRIFICATION DES CONSOMMATIONS',
    numero: rapport.numero,
    statut: libellePeriode(rapport.annee, rapport.mois),
    encadres: [
      encadreCentre(rapport.centre),
      {
        titre: 'Vérification sur place',
        lignes: [
          ['Rapport', rapport.numero],
          ['Période', libellePeriode(rapport.annee, rapport.mois)],
          ['Date de visite', '……… / ……… / …………'],
          ['Agents présents', '……………………………………'],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => rapport.lignes.indexOf(l) + 1, largeur: 8 },
      { titre: 'Médicament', valeur: (l) => designation(l.medicament) },
      { titre: 'Stock théorique', valeur: (l) => formaterNombre(l.stockTheorique), droite: true, largeur: 24 },
      { titre: 'Déclaré', valeur: (l) => formaterNombre(l.quantite), droite: true, largeur: 17 },
      { titre: 'Constaté', valeur: () => '', largeur: 22 },
      { titre: 'Observation', valeur: () => '', largeur: 40 },
    ],
    lignes: rapport.lignes,
    signatures: [
      { libelle: 'Le responsable du centre', nom: rapport.centre.responsable || '' },
      "L'agent vérificateur du district",
    ],
    nomFichier: `fiche_verification_${rapport.numero}`,
  })
}
