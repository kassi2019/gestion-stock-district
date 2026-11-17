/**
 * =============================================================================
 * DÉFINITION DES ÉTATS (module 09, cahier des charges §3.8)
 * =============================================================================
 * Chaque état est décrit ici ; l'écran (EtatTableau.vue) est le même pour tous.
 *
 *   {
 *     code, titre, description, groupe,
 *     source   : route du serveur (src/api/etats.js),
 *     filtres  : ['periode', 'centre', 'fournisseur', 'medicament'],
 *     vues     : [  // « Détail », « Par centre », « Par médicament »...
 *       { code, libelle, lignes: (donnees) => [...], colonnes: [...] },
 *     ],
 *   }
 *
 * Colonnes (comme l'export PDF) :
 *   { titre, valeur: (l) => texte affiché, droite?, somme?: (l) => nombre (TOTAL),
 *     formatTotal?, nombre?: (l) => nombre (tri + cellule numérique Excel) }
 *
 * ➜ Pour AJOUTER un état : ajouter un objet dans ETATS (et, si besoin, une
 *   route dans stock-district-backend/src/etats).
 * =============================================================================
 */
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'
import { TYPES_MOUVEMENT } from '@/views/stock/stockCommun'
import { MODES_PAIEMENT, STATUTS_FACTURE } from '@/views/facturation/financesCommun'
import { DECISIONS } from '@/views/supervisions/supervisionsCommun'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « 2026-11 » -> « novembre 2026 » */
export function libelleMois(cle) {
  const [a, m] = cle.split('-').map(Number)
  return `${MOIS[m - 1]} ${a}`
}

// ---------------------------------------------------------------------------
// OUTILS DE COLONNES ET DE REGROUPEMENT
// ---------------------------------------------------------------------------
const texte = (titre, f) => ({ titre, valeur: f })
const date = (titre, f) => ({ titre, valeur: (l) => (f(l) ? formaterDate(f(l)) : ''), nombre: (l) => (f(l) ? new Date(f(l)).getTime() : null), excelTexte: true })
const quantite = (titre, f, total = true) => ({ titre, valeur: (l) => formaterNombre(f(l)), nombre: f, droite: true, ...(total ? { somme: f, formatTotal: formaterNombre } : {}) })
const montant = (titre, f, total = true) => ({
  titre,
  valeur: (l) => (f(l) === null || f(l) === undefined ? '—' : formaterMontant(f(l))),
  nombre: f,
  droite: true,
  ...(total ? { somme: (l) => f(l) ?? 0, formatTotal: formaterMontant } : {}),
})
const medicament = { titre: 'Médicament', valeur: (l) => `${l.medicament.code} — ${l.medicament.designation}` }

/**
 * Regroupe des lignes : une ligne par clé, avec le nombre de lignes et les
 * totaux demandés. Résultat trié par la première somme (décroissant).
 *   grouper(lignes, (l) => l.centre.nom, { quantite: (l) => l.quantite, montant: (l) => l.montant })
 */
export function grouper(lignes, cle, sommes) {
  const groupes = new Map()
  for (const l of lignes) {
    const k = cle(l)
    if (!groupes.has(k)) groupes.set(k, { libelle: k, nombre: 0, ...Object.fromEntries(Object.keys(sommes).map((s) => [s, 0])) })
    const g = groupes.get(k)
    g.nombre++
    for (const [s, f] of Object.entries(sommes)) g[s] += Number(f(l)) || 0
  }
  const premiere = Object.keys(sommes)[0]
  return [...groupes.values()].sort((a, b) => (premiere ? b[premiere] - a[premiere] : 0))
}
const libelle = (titre) => ({ titre, valeur: (l) => l.libelle })
const nombreLignes = (titre = 'Lignes') => ({ titre, valeur: (l) => formaterNombre(l.nombre), nombre: (l) => l.nombre, droite: true, somme: (l) => l.nombre, formatTotal: formaterNombre })

// ---------------------------------------------------------------------------
// LES ÉTATS
// ---------------------------------------------------------------------------
export const ETATS = [
  // ======================= RAPPORT DISTRICT (spec nov. 2026, §6) =======================
  // Une seule route serveur (rapport-district) pour les deux états :
  // { produits: [...une ligne par produit], fournisseurs: [...fournisseur x produit] }
  {
    code: 'rapport-district-quantites',
    groupe: 'Rapport district',
    titre: 'Rapport district — quantités',
    description:
      "Consolidation des rapports centre validés et du stock du district. Sert de rapport de commande à reporter dans l'application nationale.",
    source: 'rapport-district',
    filtres: ['periode', 'centre', 'medicament'],
    vues: [
      {
        code: 'produit',
        libelle: 'Par produit',
        lignes: (d) => d.produits,
        colonnes: [
          medicament,
          quantite('Consommé par les centres', (l) => l.consommeCentres),
          quantite('Restant dans les centres', (l) => l.restantCentres),
          quantite('Restant au district', (l) => l.restantDistrict),
          quantite('Stock global', (l) => l.stockGlobal),
          quantite('Reçu des fournisseurs', (l) => l.recuFournisseurs),
          quantite('CMM district', (l) => l.cmmDistrict),
        ],
      },
    ],
  },
  {
    code: 'rapport-district-valorisation',
    groupe: 'Rapport district',
    titre: 'Rapport district — valorisation',
    description:
      "Consommation valorisée aux prix figés des rapports : marge du district, pertes (au prix d'achat) et montant dû aux fournisseurs (premier entré, premier sorti).",
    source: 'rapport-district',
    filtres: ['periode', 'centre', 'medicament'],
    vues: [
      {
        code: 'synthese',
        libelle: 'Synthèse',
        // Les pertes sont sur une ligne à part : elles réduisent la marge
        lignes: (d) => [
          {
            libelle: 'Consommation des centres',
            achat: d.produits.reduce((t, l) => t + l.valeurAchat, 0),
            vente: d.produits.reduce((t, l) => t + l.valeurVente, 0),
            marge: d.produits.reduce((t, l) => t + l.marge, 0),
          },
          {
            libelle: "Pertes et périmés (au prix d'achat)",
            achat: d.produits.reduce((t, l) => t + l.valeurPertes, 0),
            vente: 0,
            marge: -d.produits.reduce((t, l) => t + l.valeurPertes, 0),
          },
        ],
        colonnes: [libelle('Poste'), montant("Valeur au prix d'achat", (l) => l.achat), montant('Valeur au prix de vente', (l) => l.vente), montant('Marge du district', (l) => l.marge)],
      },
      {
        code: 'produit',
        libelle: 'Par produit',
        lignes: (d) => d.produits.filter((l) => l.consommeCentres || l.pertes),
        colonnes: [
          medicament,
          quantite('Consommé', (l) => l.consommeCentres),
          montant("Valeur au prix d'achat", (l) => l.valeurAchat),
          montant('Valeur au prix de vente', (l) => l.valeurVente),
          montant('Marge', (l) => l.marge),
          quantite('Pertes / ajust.', (l) => l.pertes),
          montant('Valeur des pertes', (l) => l.valeurPertes),
          montant('Marge nette', (l) => l.margeNette),
        ],
      },
      {
        code: 'fournisseur',
        libelle: 'Dû aux fournisseurs',
        lignes: (d) => grouper(d.fournisseurs, (l) => l.fournisseur, { montant: (l) => l.montant, quantite: (l) => l.quantite }),
        colonnes: [libelle('Fournisseur'), nombreLignes('Produits'), quantite('Quantité consommée', (l) => l.quantite), montant('Montant dû', (l) => l.montant)],
      },
      {
        code: 'fournisseur-produit',
        libelle: 'Dû par fournisseur et produit',
        lignes: (d) => d.fournisseurs,
        colonnes: [texte('Fournisseur', (l) => l.fournisseur), medicament, quantite('Quantité consommée', (l) => l.quantite), montant('Montant dû', (l) => l.montant)],
      },
    ],
  },

  // ======================= STOCK ET MOUVEMENTS =======================
  {
    code: 'stock',
    groupe: 'Stock et mouvements',
    titre: 'Stock du dépôt valorisé',
    description: "Stock disponible par médicament, valorisé au prix d'achat et (indicatif) au prix de vente.",
    source: 'stock',
    filtres: ['medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Par médicament',
        lignes: (d) => d,
        colonnes: [
          texte('Code', (l) => l.code),
          texte('Médicament', (l) => l.designation),
          texte('Famille', (l) => l.famille),
          quantite('Stock', (l) => l.stock, false),
          montant("Prix d'achat", (l) => l.prixAchat, false),
          montant("Valeur (prix d'achat)", (l) => l.valeurAchat),
          montant('Valeur (prix de vente)', (l) => l.valeurVente),
          date('Prochaine péremption', (l) => l.prochainePeremption),
        ],
      },
      {
        code: 'famille',
        libelle: 'Par famille',
        lignes: (d) => grouper(d, (l) => l.famille || 'Sans famille', { valeurAchat: (l) => l.valeurAchat, valeurVente: (l) => l.valeurVente, stock: (l) => l.stock }),
        colonnes: [libelle('Famille'), nombreLignes('Médicaments'), quantite('Stock', (l) => l.stock), montant("Valeur (prix d'achat)", (l) => l.valeurAchat), montant('Valeur (prix de vente)', (l) => l.valeurVente)],
      },
    ],
  },
  {
    code: 'receptions',
    groupe: 'Stock et mouvements',
    titre: 'Achats et réceptions',
    description: 'Médicaments reçus des fournisseurs (réceptions validées).',
    source: 'receptions',
    filtres: ['periode', 'fournisseur', 'medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          date('Date', (l) => l.date),
          texte('N° réception', (l) => l.numero),
          texte('Fournisseur', (l) => l.fournisseur.raisonSociale),
          medicament,
          texte('Lot', (l) => l.lot),
          quantite('Quantité', (l) => l.quantite),
          montant('Prix unitaire', (l) => l.prixUnitaire, false),
          montant('Montant', (l) => l.montant),
        ],
      },
      {
        code: 'fournisseur',
        libelle: 'Par fournisseur',
        lignes: (d) => grouper(d, (l) => l.fournisseur.raisonSociale, { montant: (l) => l.montant, quantite: (l) => l.quantite }),
        colonnes: [libelle('Fournisseur'), nombreLignes(), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
      {
        code: 'medicament',
        libelle: 'Par médicament',
        lignes: (d) => grouper(d, (l) => `${l.medicament.code} — ${l.medicament.designation}`, { quantite: (l) => l.quantite, montant: (l) => l.montant }),
        colonnes: [libelle('Médicament'), nombreLignes('Réceptions'), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
    ],
  },
  {
    code: 'livraisons',
    groupe: 'Stock et mouvements',
    titre: 'Livraisons aux centres',
    description: 'Médicaments livrés aux centres de santé (livraisons validées).',
    source: 'livraisons',
    filtres: ['periode', 'centre', 'medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          date('Date', (l) => l.date),
          texte('N° livraison', (l) => l.numero),
          texte('Centre', (l) => l.centre.nom),
          medicament,
          texte('Lot', (l) => l.lot),
          quantite('Quantité', (l) => l.quantite),
          montant('Montant', (l) => l.montant),
        ],
      },
      {
        code: 'centre',
        libelle: 'Par centre',
        lignes: (d) => grouper(d, (l) => l.centre.nom, { montant: (l) => l.montant, quantite: (l) => l.quantite }),
        colonnes: [libelle('Centre'), nombreLignes(), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
      {
        code: 'medicament',
        libelle: 'Par médicament',
        lignes: (d) => grouper(d, (l) => `${l.medicament.code} — ${l.medicament.designation}`, { quantite: (l) => l.quantite, montant: (l) => l.montant }),
        colonnes: [libelle('Médicament'), nombreLignes('Livraisons'), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
    ],
  },
  {
    code: 'mouvements',
    groupe: 'Stock et mouvements',
    titre: 'Mouvements du stock du dépôt',
    description: 'Entrées, sorties, ajustements, inventaires et périmés (5 000 derniers au plus).',
    source: 'mouvements',
    filtres: ['periode', 'medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          date('Date', (l) => l.date),
          texte('Mouvement', (l) => TYPES_MOUVEMENT[l.type]?.libelle || l.type),
          texte('Pièce', (l) => l.pieceRef),
          medicament,
          texte('Lot', (l) => l.lot),
          quantite('Quantité', (l) => l.quantite, false),
          quantite('Stock avant', (l) => l.stockAvant, false),
          quantite('Stock après', (l) => l.stockApres, false),
          texte('Par', (l) => l.utilisateur),
        ],
      },
      {
        code: 'type',
        libelle: 'Par type',
        lignes: (d) => grouper(d, (l) => TYPES_MOUVEMENT[l.type]?.libelle || l.type, { quantite: (l) => l.quantite }),
        colonnes: [libelle('Type de mouvement'), nombreLignes('Mouvements'), quantite('Quantité', (l) => l.quantite)],
      },
    ],
  },

  // ======================= CONSOMMATIONS =======================
  {
    code: 'consommations',
    groupe: 'Consommations',
    titre: 'Consommations des centres',
    description: 'Consommations validées (quantité retenue après vérification) par centre, médicament et période.',
    source: 'consommations',
    filtres: ['periode', 'centre', 'medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          { titre: 'Mois', valeur: (l) => libelleMois(l.periode), nombre: (l) => Number(l.periode.replace('-', '')), excelTexte: true },
          texte('Rapport', (l) => l.rapport),
          texte('Centre', (l) => l.centre.nom),
          medicament,
          quantite('Déclaré', (l) => l.quantiteDeclaree),
          quantite('Retenu', (l) => l.quantite),
          montant('Prix unitaire', (l) => l.prixUnitaire, false),
          montant('Montant', (l) => l.montant),
        ],
      },
      {
        code: 'centre',
        libelle: 'Par centre',
        lignes: (d) => grouper(d, (l) => l.centre.nom, { montant: (l) => l.montant, quantite: (l) => l.quantite }),
        colonnes: [libelle('Centre'), nombreLignes(), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
      {
        code: 'medicament',
        libelle: 'Par médicament',
        lignes: (d) => grouper(d, (l) => `${l.medicament.code} — ${l.medicament.designation}`, { quantite: (l) => l.quantite, montant: (l) => l.montant }),
        colonnes: [libelle('Médicament'), nombreLignes(), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
      {
        code: 'mois',
        libelle: 'Par mois',
        lignes: (d) => grouper(d, (l) => l.periode, { montant: (l) => l.montant, quantite: (l) => l.quantite }).sort((a, b) => b.libelle.localeCompare(a.libelle)),
        colonnes: [{ titre: 'Mois', valeur: (l) => libelleMois(l.libelle) }, nombreLignes(), quantite('Quantité', (l) => l.quantite), montant('Montant', (l) => l.montant)],
      },
    ],
  },
  {
    code: 'produits-consommes',
    groupe: 'Consommations',
    titre: 'Produits les plus consommés',
    description: 'Classement des médicaments par quantité consommée (rapports validés).',
    source: 'produits',
    filtres: ['periode', 'centre'],
    vues: [
      {
        code: 'detail',
        libelle: 'Classement',
        lignes: (d) => d.plusConsommes.map((p, i) => ({ ...p, rang: i + 1 })),
        colonnes: [
          { titre: 'Rang', valeur: (l) => l.rang, nombre: (l) => l.rang, droite: true },
          texte('Code', (l) => l.code),
          texte('Médicament', (l) => l.libelle),
          texte('Unité', (l) => l.unite),
          quantite('Quantité', (l) => l.quantite),
          montant('Montant', (l) => l.montant),
          { titre: 'Centres', valeur: (l) => l.centres, nombre: (l) => l.centres, droite: true },
        ],
      },
    ],
  },

  // ======================= FINANCES =======================
  {
    code: 'factures',
    groupe: 'Finances',
    titre: 'Factures émises',
    description: 'Factures émises sur la période (consommations et écarts de supervision).',
    source: 'factures',
    filtres: ['periode', 'centre'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          texte('N° facture', (l) => l.numero),
          date('Émise le', (l) => l.dateEmission),
          texte('Centre', (l) => l.centre.nom),
          texte('Objet', (l) => l.objet),
          texte('Statut', (l) => STATUTS_FACTURE[l.statut]?.libelle || l.statut),
          montant('Montant', (l) => (l.statut === 'ANNULEE' ? 0 : l.montantTotal)),
          montant('Payé', (l) => (l.statut === 'ANNULEE' ? 0 : l.montantPaye)),
          montant('Reste', (l) => l.solde),
        ],
      },
      {
        code: 'centre',
        libelle: 'Par centre',
        lignes: (d) =>
          grouper(d.filter((l) => l.statut !== 'ANNULEE'), (l) => l.centre.nom, { montant: (l) => l.montantTotal, paye: (l) => l.montantPaye, solde: (l) => l.solde }),
        colonnes: [libelle('Centre'), nombreLignes('Factures'), montant('Facturé', (l) => l.montant), montant('Payé', (l) => l.paye), montant('Reste', (l) => l.solde)],
      },
    ],
  },
  {
    code: 'encaissements',
    groupe: 'Finances',
    titre: 'Règlements encaissés',
    description: 'Paiements et avances reçus des centres (hors paiements annulés).',
    source: 'encaissements',
    filtres: ['periode', 'centre'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          texte('N° reçu', (l) => l.numero),
          date('Date', (l) => l.datePaiement),
          texte('Centre', (l) => l.centre.nom),
          texte('Mode', (l) => `${MODES_PAIEMENT[l.mode] || l.mode}${l.reference ? ` ${l.reference}` : ''}`),
          texte('Factures réglées', (l) => l.factures || 'Avance'),
          montant('Montant', (l) => l.montant),
          montant('Avance restante', (l) => l.avance),
        ],
      },
      {
        code: 'centre',
        libelle: 'Par centre',
        lignes: (d) => grouper(d, (l) => l.centre.nom, { montant: (l) => l.montant, avance: (l) => l.avance }),
        colonnes: [libelle('Centre'), nombreLignes('Paiements'), montant('Encaissé', (l) => l.montant), montant('Avances restantes', (l) => l.avance)],
      },
      {
        code: 'mode',
        libelle: 'Par mode de paiement',
        lignes: (d) => grouper(d, (l) => MODES_PAIEMENT[l.mode] || l.mode, { montant: (l) => l.montant }),
        colonnes: [libelle('Mode'), nombreLignes('Paiements'), montant('Encaissé', (l) => l.montant)],
      },
    ],
  },
  {
    code: 'creances',
    groupe: 'Finances',
    titre: 'Créances et retards de paiement',
    description: "Factures non soldées à ce jour et centres en retard (échéance dépassée).",
    source: 'creances',
    filtres: ['centre'],
    vues: [
      {
        code: 'retards',
        libelle: 'Centres en retard de paiement',
        lignes: (d) =>
          grouper(d.filter((l) => l.joursRetard > 0), (l) => l.centre.nom, { solde: (l) => l.solde }).map((g) => {
            const factures = d.filter((l) => l.centre.nom === g.libelle && l.joursRetard > 0)
            const c = factures[0].centre
            return { ...g, retardMax: Math.max(...factures.map((f) => f.joursRetard)), responsable: c.responsable || '', telephone: c.telephone || '' }
          }),
        colonnes: [
          libelle('Centre'),
          texte('Responsable', (l) => l.responsable),
          texte('Téléphone', (l) => l.telephone),
          nombreLignes('Factures en retard'),
          { titre: 'Retard max. (jours)', valeur: (l) => l.retardMax, nombre: (l) => l.retardMax, droite: true },
          montant('Montant en retard', (l) => l.solde),
        ],
      },
      {
        code: 'detail',
        libelle: 'Toutes les factures non soldées',
        lignes: (d) => d,
        colonnes: [
          texte('N° facture', (l) => l.numero),
          texte('Centre', (l) => l.centre.nom),
          date('Émise le', (l) => l.dateEmission),
          date('Échéance', (l) => l.dateEcheance),
          { titre: 'Retard (jours)', valeur: (l) => (l.joursRetard > 0 ? l.joursRetard : '—'), nombre: (l) => l.joursRetard, droite: true },
          montant('Montant', (l) => l.montantTotal),
          montant('Payé', (l) => l.montantPaye),
          montant('Reste dû', (l) => l.solde),
        ],
      },
      {
        code: 'centre',
        libelle: 'Solde par centre',
        lignes: (d) => grouper(d, (l) => l.centre.nom, { solde: (l) => l.solde, retard: (l) => (l.joursRetard > 0 ? l.solde : 0) }),
        colonnes: [libelle('Centre'), nombreLignes('Factures non soldées'), montant('Reste dû', (l) => l.solde), montant('Dont en retard', (l) => l.retard)],
      },
    ],
  },

  // ======================= ALERTES ET CONTRÔLES =======================
  {
    code: 'alertes',
    groupe: 'Alertes et contrôles',
    titre: 'Ruptures et péremptions',
    description: 'Médicaments en rupture ou sous le seuil ; lots périmés ou proches de la péremption.',
    source: 'produits',
    filtres: [],
    vues: [
      {
        code: 'ruptures',
        libelle: 'Ruptures et sous le seuil',
        lignes: (d) => d.alertesStock,
        colonnes: [
          texte('Code', (l) => l.code),
          texte('Médicament', (l) => l.libelle),
          texte('État', (l) => (l.etat === 'RUPTURE' ? 'Rupture' : 'Sous le seuil')),
          quantite('Stock', (l) => l.stock, false),
          quantite("Seuil d'alerte", (l) => l.seuilAlerte, false),
        ],
      },
      {
        code: 'peremptions',
        libelle: 'Lots périmés ou proches',
        lignes: (d) => d.peremptions,
        colonnes: [
          texte('Code', (l) => l.code),
          texte('Médicament', (l) => l.libelle),
          texte('Lot', (l) => l.numeroLot),
          date('Péremption', (l) => l.datePeremption),
          { titre: 'Jours restants', valeur: (l) => (l.jours < 0 ? `périmé depuis ${-l.jours} j` : `${l.jours} j`), nombre: (l) => l.jours, droite: true },
          quantite('Quantité', (l) => l.quantite),
        ],
      },
    ],
  },
  {
    code: 'ecarts',
    groupe: 'Alertes et contrôles',
    titre: 'Écarts de supervision',
    description: 'Écarts relevés lors des supervisions validées dans les centres.',
    source: 'ecarts',
    filtres: ['periode', 'centre', 'medicament'],
    vues: [
      {
        code: 'detail',
        libelle: 'Détail',
        lignes: (d) => d,
        colonnes: [
          date('Date', (l) => l.date),
          texte('Supervision', (l) => l.numero),
          texte('Centre', (l) => l.centre.nom),
          medicament,
          quantite('Théorique', (l) => l.stockTheorique, false),
          quantite('Physique', (l) => l.stockPhysique, false),
          { titre: 'Écart', valeur: (l) => (l.ecart > 0 ? `+${l.ecart}` : String(l.ecart)), nombre: (l) => l.ecart, droite: true },
          montant('Valeur', (l) => l.valeurEcart),
          texte('Décision', (l) => (l.decision ? DECISIONS[l.decision]?.libelle : 'À décider')),
        ],
      },
      {
        code: 'centre',
        libelle: 'Par centre',
        lignes: (d) =>
          grouper(d, (l) => l.centre.nom, {
            manquants: (l) => (l.ecart < 0 ? -(l.valeurEcart ?? 0) : 0),
            excedents: (l) => (l.ecart > 0 ? l.valeurEcart ?? 0 : 0),
          }),
        colonnes: [libelle('Centre'), nombreLignes('Écarts'), montant('Manquants', (l) => l.manquants), montant('Excédents', (l) => l.excedents)],
      },
      {
        code: 'medicament',
        libelle: 'Par médicament',
        lignes: (d) =>
          grouper(d, (l) => `${l.medicament.code} — ${l.medicament.designation}`, {
            manquants: (l) => (l.ecart < 0 ? -(l.valeurEcart ?? 0) : 0),
            ecart: (l) => l.ecart,
          }),
        colonnes: [libelle('Médicament'), nombreLignes('Écarts'), { titre: 'Écart net (qté)', valeur: (l) => l.ecart, nombre: (l) => l.ecart, droite: true }, montant('Manquants', (l) => l.manquants)],
      },
    ],
  },
]
