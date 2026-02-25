// ═══════════════════════════════════════════════════════════════
// PROGILIFT CODES — Référentiel des codes Progilift
// Mapping ENSEMBLE, CAUSE, PANNES → Libellés français
// Source: codes standards maintenance ascenseur France
// ═══════════════════════════════════════════════════════════════

// ═══ ENSEMBLE (organe / système) ═══

export const ENSEMBLE_LABELS: Record<string, string> = {
  '0':  'Non défini',
  '1':  'Portes palières',
  '2':  'Portes cabine',
  '3':  'Serrures',
  '4':  'Armoire de commande',
  '5':  'Machinerie / Treuil',
  '6':  'Gaine',
  '7':  'Cabine',
  '8':  'Signalisation / Boutons',
  '9':  'Téléalarme / Télésurveillance',
  '10': 'Installation électrique',
  '11': 'Hydraulique',
  '12': 'Câbles / Poulies',
  '13': 'Parachute / Limiteur',
  '14': 'Guides / Coulisseaux',
  '15': 'Contrepoids',
  '16': 'Amortisseurs',
  '17': 'Cuvette',
  '18': 'Variateur / VF',
  '19': 'Éclairage',
  '20': 'Ventilation',
  '21': 'Opérateur de porte',
  '22': 'Sélecteur d\'étage',
  '23': 'Verrouillage',
  '24': 'Alimentation secours',
  '25': 'Interphone',
  '99': 'Divers / Autre',
};

// ═══ CAUSE (origine de la panne) ═══

export const CAUSE_LABELS: Record<string, string> = {
  '0':  'Non défini',
  '1':  'Usure normale',
  '2':  'Vandalisme / Dégradation',
  '3':  'Défaut constructeur',
  '4':  'Mauvaise utilisation',
  '5':  'Environnement (eau, T°)',
  '6':  'Suite intervention',
  '7':  'Obsolescence',
  '8':  'Surtension / Électrique',
  '9':  'Incendie / Sinistre',
  '10': 'Défaut réglage',
  '11': 'Pièce non conforme',
  '12': 'Indéterminé',
  '99': 'Visite d\'entretien',
};

// ═══ PANNES (type de panne spécifique) ═══

export const PANNES_LABELS: Record<string, string> = {
  '0':  'Non défini',
  '1':  'Panne porte palière',
  '2':  'Panne porte cabine',
  '3':  'Panne serrure',
  '4':  'Panne armoire',
  '5':  'Panne machinerie',
  '6':  'Panne gaine',
  '7':  'Panne cabine',
  '8':  'Panne signalisation',
  '9':  'Panne téléalarme',
  '10': 'Panne électrique',
  '11': 'Panne hydraulique',
  '12': 'Personne bloquée',
  '13': 'Bruit anormal',
  '14': 'Vibrations',
  '15': 'Arrêt entre étages',
  '16': 'Non-nivelage',
  '17': 'Porte ne s\'ouvre pas',
  '18': 'Porte ne se ferme pas',
  '19': 'Bouton inopérant',
  '20': 'Éclairage cabine HS',
  '21': 'Indicateur HS',
  '22': 'Fuite hydraulique',
  '23': 'Bruit machinerie',
  '24': 'Patinage câbles',
  '25': 'Défaut variateur',
  '26': 'Défaut sélecteur',
  '27': 'Coupure courant',
  '28': 'Surcharge répétée',
  '29': 'Défaut frein',
  '30': 'Défaut contacteur',
  '99': 'Autre',
};

// ═══ FONCTIONS DE RÉSOLUTION ═══

/** Résoud un code ENSEMBLE en libellé. Si c'est déjà du texte, le retourne tel quel. */
export function getEnsembleLabel(code: string | number | null | undefined): string {
  if (code === null || code === undefined || code === '') return 'Non défini';
  const key = String(code).trim();
  // Si c'est déjà du texte lisible (pas un simple nombre), retourner tel quel
  if (key.length > 3 && !/^\d+$/.test(key)) return key;
  return ENSEMBLE_LABELS[key] || `Ensemble ${key}`;
}

/** Résoud un code CAUSE en libellé. Si c'est déjà du texte, le retourne tel quel. */
export function getCauseLabel(code: string | number | null | undefined): string {
  if (code === null || code === undefined || code === '') return 'Non défini';
  const key = String(code).trim();
  // Si c'est déjà du texte lisible (pas un simple nombre), retourner tel quel
  if (key.length > 3 && !/^\d+$/.test(key)) return key;
  return CAUSE_LABELS[key] || `Cause ${key}`;
}

/** Résoud un code PANNES en libellé. Si c'est déjà du texte, le retourne tel quel. */
export function getPannesLabel(code: string | number | null | undefined): string {
  if (code === null || code === undefined || code === '') return 'Non défini';
  const key = String(code).trim();
  // Si c'est déjà du texte lisible (pas un simple nombre), retourner tel quel
  if (key.length > 3 && !/^\d+$/.test(key)) return key;
  return PANNES_LABELS[key] || `Type ${key}`;
}

/** 
 * Génère un libellé lisible pour une panne à partir de data_wpanne.
 * Priorité: Libelle texte > PANNES (Type de panne) > ENSEMBLE > motif > fallback
 */
export function getPanneDisplayLabel(data: Record<string, any>, motifFallback?: string): string {
  // 1. Libellé texte existant (meilleur cas — exclure les purs numériques)
  if (data.Libelle && typeof data.Libelle === 'string' && data.Libelle.trim() && !/^\d+$/.test(data.Libelle.trim())) {
    return data.Libelle.trim();
  }

  // 2. PANNES (Type de panne) — champ principal
  if (data.PANNES != null && String(data.PANNES).trim()) {
    const raw = String(data.PANNES).trim();
    const label = getPannesLabel(raw);
    
    // Enrichir avec ENSEMBLE si disponible et label est générique
    if (label.startsWith('Type ') && data.ENSEMBLE != null) {
      const eLabel = getEnsembleLabel(data.ENSEMBLE);
      if (eLabel !== 'Non défini' && !eLabel.startsWith('Ensemble ')) {
        return `${label} — ${eLabel}`;
      }
    }
    return label;
  }

  // 3. ENSEMBLE seul
  if (data.ENSEMBLE != null && String(data.ENSEMBLE).trim()) {
    return getEnsembleLabel(data.ENSEMBLE);
  }

  // 4. Fallback sur motif brut
  if (motifFallback && motifFallback.trim() && motifFallback !== 'vide') {
    return motifFallback.trim();
  }

  return 'Non défini';
}

/**
 * Extrait la clé de regroupement d'un motif de panne.
 * Format motif Progilift: "Catégorie - Sous-catégorie - Détail..."
 * → Regroupe sur les 2 premiers segments: "Catégorie - Sous-catégorie"
 * Exemples:
 *   "Selection - Fin de course haut - Détail" → "Selection - Fin de course haut"
 *   "Porte cabine - Fermeture" → "Porte cabine - Fermeture"
 *   "Panne simple" → "Panne simple"
 */
export function getMotifGroupKey(motif: string | null | undefined): string {
  if (!motif || !motif.trim()) return 'Non défini';
  const clean = motif.trim();

  // Séparateurs possibles: " - ", " – ", " — "
  const parts = clean.split(/\s*[-–—]\s*/);

  if (parts.length >= 2) {
    // Prendre les 2 premiers segments
    return `${parts[0].trim()} - ${parts[1].trim()}`;
  }

  // Pas de séparateur → retourner tel quel
  return clean;
}

/**
 * Génère la clé de regroupement complète pour une panne,
 * en utilisant le motif texte (2 premiers segments) comme clé primaire.
 */
export function getPanneGroupKey(data: Record<string, any>, motifFallback?: string): string {
  // 1. Priorité au motif texte (le plus lisible)
  const motif = data.Libelle || motifFallback;
  if (motif && typeof motif === 'string' && motif.trim() && !/^\d+$/.test(motif.trim())) {
    return getMotifGroupKey(motif);
  }

  // 2. Fallback sur codes PANNES / ENSEMBLE
  return getPanneDisplayLabel(data, motifFallback);
}

/** Couleur par ensemble (pour graphiques) */
export function getEnsembleColor(code: string | number): string {
  const colors: Record<string, string> = {
    '1':  '#DC2626', // Portes palières — rouge
    '2':  '#EA580C', // Portes cabine — orange foncé
    '3':  '#D97706', // Serrures — ambre
    '4':  '#8B5CF6', // Armoire — violet
    '5':  '#3B82F6', // Machinerie — bleu
    '6':  '#64748B', // Gaine — gris
    '7':  '#059669', // Cabine — vert
    '8':  '#0EA5E9', // Signalisation — cyan
    '9':  '#F59E0B', // Téléalarme — jaune
    '10': '#6366F1', // Électrique — indigo
    '11': '#14B8A6', // Hydraulique — teal
    '21': '#E11D48', // Opérateur porte — rose
  };
  return colors[String(code)] || '#94A3B8';
}

/** Icône par ensemble */
export function getEnsembleIcon(code: string | number): string {
  const icons: Record<string, string> = {
    '1':  '🚪', // Portes palières
    '2':  '🚪', // Portes cabine
    '3':  '🔒', // Serrures
    '4':  '🖥️', // Armoire
    '5':  '⚙️', // Machinerie
    '6':  '🏗️', // Gaine
    '7':  '🛗', // Cabine
    '8':  '🔘', // Signalisation
    '9':  '📞', // Téléalarme
    '10': '⚡', // Électrique
    '11': '💧', // Hydraulique
    '12': '🔗', // Câbles
    '13': '🛡️', // Parachute
    '21': '🔧', // Opérateur porte
  };
  return icons[String(code)] || '🔧';
}
