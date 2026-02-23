// ═══════════════════════════════════════════════════════════════
// SHEET METAL OPS — Opérations tôlerie avancées
// Flange, Hem, Tab/Slot, Corner Relief, Smart Dimensions
// ═══════════════════════════════════════════════════════════════

import { PieceConfig, Pli, Trou, Encoche, uid, MATIERES, getKFactor, bendAllowance } from './tolerie';

// ═══ TYPES ARÊTES ═══

export type EdgeSide = 'haut' | 'bas' | 'gauche' | 'droite';

export interface EdgeSelection {
  side: EdgeSide;
  startPct: number;  // 0-1, portion de départ sur l'arête
  endPct: number;    // 0-1, portion de fin
}

// ═══ FLANGE TOOL ═══
// Ajouter un rebord (aile) sur une arête de la pièce

export interface FlangeConfig {
  edge: EdgeSide;
  length: number;      // Longueur du rebord (mm)
  angle: number;       // Angle de pliage (°) — 90 par défaut
  inward: boolean;     // true = vers l'intérieur, false = vers l'extérieur
  offset: number;      // Décalage depuis le bord (mm) — pour flange partiel
  gapStart: number;    // Retrait début (mm)
  gapEnd: number;      // Retrait fin (mm)
  miterAngle: number;  // Onglet aux coins (°) — 0 = pas d'onglet
}

export function defaultFlangeConfig(edge: EdgeSide): FlangeConfig {
  return {
    edge, length: 30, angle: 90, inward: false,
    offset: 0, gapStart: 0, gapEnd: 0, miterAngle: 0,
  };
}

export function applyFlange(piece: PieceConfig, config: FlangeConfig): PieceConfig {
  const ri = Math.max(piece.epaisseur, 1);
  const pos = calculateFlangePosition(piece, config);

  const pli: Pli = {
    id: uid(),
    position: pos,
    angle: config.angle,
    rayonInterne: ri,
    direction: config.inward
      ? (['haut', 'gauche'].includes(config.edge) ? 'bas' : 'haut')
      : (['haut', 'gauche'].includes(config.edge) ? 'haut' : 'bas'),
  };

  // Ajuster la largeur si flange sur les côtés
  let newLargeur = piece.largeur;
  let newHauteur = piece.hauteur;
  if (config.edge === 'gauche' || config.edge === 'droite') {
    newLargeur += config.length;
  }

  return {
    ...piece,
    plis: [...piece.plis, pli],
    largeur: newLargeur,
    hauteur: newHauteur,
    formeBase: 'custom',
  };
}

function calculateFlangePosition(piece: PieceConfig, config: FlangeConfig): number {
  switch (config.edge) {
    case 'gauche': return config.length + config.offset;
    case 'droite': return piece.largeur - config.length - config.offset;
    case 'haut': return piece.largeur / 2; // Position X du pli
    case 'bas': return piece.largeur / 2;
    default: return piece.largeur / 2;
  }
}

/** Prévisualisation du flange (coordonnées SVG pour la preview) */
export function flangePreview(piece: PieceConfig, config: FlangeConfig): { x: number; y: number; w: number; h: number; angle: number } {
  const { edge, length, angle } = config;
  const rad = (angle * Math.PI) / 180;
  switch (edge) {
    case 'haut': return { x: 0, y: -length * Math.sin(rad), w: piece.largeur, h: length, angle };
    case 'bas': return { x: 0, y: piece.hauteur, w: piece.largeur, h: length, angle };
    case 'gauche': return { x: -length * Math.sin(rad), y: 0, w: length, h: piece.hauteur, angle };
    case 'droite': return { x: piece.largeur, y: 0, w: length, h: piece.hauteur, angle };
  }
}

// ═══ HEM TOOL ═══
// Ourlet (pli 180°) pour renforcer un bord

export type HemType = 'closed' | 'open' | 'teardrop' | 'rolled';

export interface HemConfig {
  edge: EdgeSide;
  type: HemType;
  depth: number;       // Profondeur de l'ourlet (mm)
  gap: number;         // Entrefer pour open hem (mm)
}

export function defaultHemConfig(edge: EdgeSide): HemConfig {
  return { edge, type: 'closed', depth: 8, gap: 0 };
}

export function applyHem(piece: PieceConfig, config: HemConfig): PieceConfig {
  const ri = config.type === 'open' ? config.gap : piece.epaisseur * 0.5;
  const pos = config.edge === 'gauche' ? config.depth
    : config.edge === 'droite' ? piece.largeur - config.depth
    : piece.largeur / 2;

  const pli: Pli = {
    id: uid(),
    position: pos,
    angle: config.type === 'rolled' ? 360 : 180,
    rayonInterne: ri,
    direction: (['haut', 'gauche'].includes(config.edge)) ? 'haut' : 'bas',
  };

  return {
    ...piece,
    plis: [...piece.plis, pli],
    formeBase: 'custom',
  };
}

/** Calcul de la longueur développée additionnelle pour l'ourlet */
export function hemDevelopedLength(config: HemConfig, epaisseur: number): number {
  const ri = config.type === 'open' ? config.gap : epaisseur * 0.5;
  return config.depth + Math.PI * (ri + epaisseur / 2);
}

export const HEM_TYPES: { id: HemType; nom: string; icon: string; desc: string }[] = [
  { id: 'closed', nom: 'Fermé', icon: '↩️', desc: 'Pli 180° serré — renforcement maximal' },
  { id: 'open', nom: 'Ouvert', icon: '↪️', desc: 'Pli 180° avec entrefer — plus facile à plier' },
  { id: 'teardrop', nom: 'Goutte', icon: '💧', desc: 'Forme en goutte — esthétique + rigidité' },
  { id: 'rolled', nom: 'Roulé', icon: '🔄', desc: 'Roulage complet 360° — sécurité bords' },
];

// ═══ CORNER RELIEF ═══
// Dégagement aux intersections de plis pour éviter déchirure

export type CornerReliefType = 'round' | 'square' | 'vnotch' | 'obround' | 'none';

export interface CornerReliefConfig {
  type: CornerReliefType;
  size: number;        // Taille du dégagement (mm)
  autoSize: boolean;   // true = taille auto basée sur épaisseur
}

export function defaultCornerReliefConfig(epaisseur: number): CornerReliefConfig {
  return { type: 'round', size: epaisseur * 1.5, autoSize: true };
}

/** Générer les encoches de dégagement pour tous les plis */
export function generateCornerReliefs(piece: PieceConfig, config: CornerReliefConfig): Encoche[] {
  if (config.type === 'none') return [];
  const size = config.autoSize ? piece.epaisseur * 1.5 : config.size;
  const reliefs: Encoche[] = [];

  piece.plis.forEach(pli => {
    // Dégagement haut
    reliefs.push({
      id: uid(),
      x: pli.position - size / 2,
      y: 0,
      largeur: size,
      hauteur: size,
      cote: 'haut',
    });
    // Dégagement bas
    reliefs.push({
      id: uid(),
      x: pli.position - size / 2,
      y: piece.hauteur - size,
      largeur: size,
      hauteur: size,
      cote: 'bas',
    });
  });

  // Entre 2 plis proches: dégagement intermédiaire
  const sorted = [...piece.plis].sort((a, b) => a.position - b.position);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position;
    if (gap < size * 3) {
      reliefs.push({
        id: uid(),
        x: sorted[i].position + gap / 2 - size / 2,
        y: 0,
        largeur: size,
        hauteur: piece.hauteur,
        cote: 'haut',
      });
    }
  }

  return reliefs;
}

export const CORNER_RELIEF_TYPES: { id: CornerReliefType; nom: string; icon: string; desc: string }[] = [
  { id: 'round', nom: 'Circulaire', icon: '⭕', desc: 'Trou rond — standard, moins de concentration de contrainte' },
  { id: 'square', nom: 'Carré', icon: '⬜', desc: 'Découpe carrée — simple mais stress au coin' },
  { id: 'vnotch', nom: 'Encoche V', icon: '🔻', desc: 'Encoche en V — bon compromis' },
  { id: 'obround', nom: 'Oblong', icon: '⬭', desc: 'Forme oblongue — pour plis rapprochés' },
  { id: 'none', nom: 'Aucun', icon: '❌', desc: 'Pas de dégagement (déconseillé)' },
];

// ═══ TAB & SLOT ═══
// Languettes et fentes pour assemblage tôle-tôle

export interface TabSlotConfig {
  edge: EdgeSide;
  tabCount: number;      // Nombre de languettes
  tabWidth: number;      // Largeur languette (mm)
  tabHeight: number;     // Hauteur languette (= épaisseur tôle réceptrice)
  slotClearance: number; // Jeu dans la fente (mm) — 0.1-0.3 typique
  centered: boolean;     // Languettes centrées sur l'arête
  tabStyle: 'rectangular' | 'rounded' | 'dovetail';
}

export function defaultTabSlotConfig(edge: EdgeSide, epaisseur: number): TabSlotConfig {
  return {
    edge, tabCount: 3, tabWidth: 15,
    tabHeight: epaisseur, slotClearance: 0.15,
    centered: true, tabStyle: 'rectangular',
  };
}

/** Générer les encoches (fentes) pour recevoir les languettes de l'autre pièce */
export function generateSlots(piece: PieceConfig, config: TabSlotConfig): Encoche[] {
  const slots: Encoche[] = [];
  const edgeLength = (config.edge === 'haut' || config.edge === 'bas') ? piece.largeur : piece.hauteur;
  const spacing = edgeLength / (config.tabCount + 1);

  for (let i = 0; i < config.tabCount; i++) {
    const center = spacing * (i + 1);
    const slotW = config.tabWidth + config.slotClearance * 2;
    const slotH = config.tabHeight + config.slotClearance * 2;

    if (config.edge === 'haut' || config.edge === 'bas') {
      slots.push({
        id: uid(),
        x: center - slotW / 2,
        y: config.edge === 'haut' ? 0 : piece.hauteur - slotH,
        largeur: slotW,
        hauteur: slotH,
        cote: config.edge,
      });
    } else {
      slots.push({
        id: uid(),
        x: config.edge === 'gauche' ? 0 : piece.largeur - slotH,
        y: center - slotW / 2,
        largeur: slotH,
        hauteur: slotW,
        cote: config.edge,
      });
    }
  }
  return slots;
}

/** Générer les languettes qui dépassent du bord */
export function generateTabs(piece: PieceConfig, config: TabSlotConfig): { encoches: Encoche[]; largeur: number; hauteur: number } {
  // Les tabs sont créés en découpant le bord SAUF les languettes
  const encoches: Encoche[] = [];
  const edgeLength = (config.edge === 'haut' || config.edge === 'bas') ? piece.largeur : piece.hauteur;
  const spacing = edgeLength / (config.tabCount + 1);

  // Découper entre les tabs
  for (let i = 0; i <= config.tabCount; i++) {
    const start = i === 0 ? 0 : spacing * i + config.tabWidth / 2;
    const end = i === config.tabCount ? edgeLength : spacing * (i + 1) - config.tabWidth / 2;
    if (end - start < 1) continue;

    if (config.edge === 'haut' || config.edge === 'bas') {
      encoches.push({
        id: uid(), x: start,
        y: config.edge === 'haut' ? -config.tabHeight : piece.hauteur,
        largeur: end - start, hauteur: config.tabHeight, cote: config.edge,
      });
    }
  }

  return { encoches, largeur: piece.largeur, hauteur: piece.hauteur + config.tabHeight };
}

// ═══ SMART DIMENSIONS (Cotation intelligente) ═══

export interface SmartDimension {
  id: string;
  type: 'horizontal' | 'vertical' | 'distance' | 'angle' | 'radius' | 'chain';
  // Source (quoi est coté)
  source: {
    type: 'edge' | 'hole_center' | 'hole_edge' | 'bend' | 'point';
    id1: string;
    id2?: string;
  };
  value: number;
  expression?: string;     // Expression paramétrique
  tolerance?: { plus: number; minus: number }; // Tolérancement
  displayOffset: number;   // Décalage d'affichage
  // GD&T (Geometric Dimensioning & Tolerancing)
  gdt?: {
    symbol: 'position' | 'flatness' | 'perpendicularity' | 'parallelism' | 'concentricity';
    value: number;
    datum?: string;
  };
}

export interface DimensionScheme {
  dimensions: SmartDimension[];
  style: 'baseline' | 'chain' | 'ordinate'; // Mode de cotation
  showAll: boolean;
}

/** Générer automatiquement les cotations fonctionnelles d'une pièce */
export function autoSmartDimensions(piece: PieceConfig): SmartDimension[] {
  const dims: SmartDimension[] = [];

  // 1. Cotes d'encombrement
  dims.push({
    id: uid(), type: 'horizontal',
    source: { type: 'edge', id1: 'left', id2: 'right' },
    value: piece.largeur, displayOffset: -15,
  });
  dims.push({
    id: uid(), type: 'vertical',
    source: { type: 'edge', id1: 'top', id2: 'bottom' },
    value: piece.hauteur, displayOffset: -15,
  });

  // 2. Positions de plis
  piece.plis.forEach((pli, i) => {
    dims.push({
      id: uid(), type: 'horizontal',
      source: { type: 'bend', id1: pli.id },
      value: pli.position, displayOffset: -8 - i * 5,
    });
  });

  // 3. Entraxes de trous
  const sortedByX = [...piece.trous].sort((a, b) => a.x - b.x);
  // Cote du 1er trou depuis le bord gauche
  if (sortedByX.length > 0) {
    dims.push({
      id: uid(), type: 'horizontal',
      source: { type: 'hole_center', id1: sortedByX[0].id },
      value: sortedByX[0].x, displayOffset: 15,
    });
  }
  // Entraxes entre trous consécutifs
  for (let i = 0; i < sortedByX.length - 1; i++) {
    const dx = sortedByX[i + 1].x - sortedByX[i].x;
    if (dx > 0.5) {
      dims.push({
        id: uid(), type: 'horizontal',
        source: { type: 'hole_center', id1: sortedByX[i].id, id2: sortedByX[i + 1].id },
        value: dx, displayOffset: 10 + i * 5,
      });
    }
  }

  // 4. Diamètres de trous (dédupliqués par taille)
  const uniqueDiameters = [...new Set(piece.trous.map(t => `${t.type}-${t.diametre}`))];
  uniqueDiameters.forEach(key => {
    const trou = piece.trous.find(t => `${t.type}-${t.diametre}` === key);
    if (trou) {
      dims.push({
        id: uid(), type: 'radius',
        source: { type: 'hole_edge', id1: trou.id },
        value: trou.diametre, displayOffset: 0,
      });
    }
  });

  // 5. Distances bord-trou (vérification de matage)
  piece.trous.forEach(trou => {
    const distLeft = trou.x - trou.diametre / 2;
    const distRight = piece.largeur - trou.x - trou.diametre / 2;
    const distTop = trou.y - trou.diametre / 2;
    const distBottom = piece.hauteur - trou.y - trou.diametre / 2;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist < piece.epaisseur * 2) {
      dims.push({
        id: uid(), type: 'distance',
        source: { type: 'hole_edge', id1: trou.id, id2: 'nearest_edge' },
        value: minDist, displayOffset: 0,
        tolerance: { plus: 0.5, minus: 0 }, // Tolérance serrée pour matage
      });
    }
  });

  return dims;
}

/** Calculer la chaîne de cotes et vérifier la cohérence */
export function validateDimensionChain(dims: SmartDimension[], piece: PieceConfig): { valid: boolean; error?: string; residual?: number } {
  // Chaîne horizontale : somme des cotes partielles vs cote totale
  const hDims = dims.filter(d => d.type === 'horizontal' && d.source.type === 'bend');
  if (hDims.length < 2) return { valid: true };

  const positions = hDims.map(d => d.value).sort((a, b) => a - b);
  const lastPos = positions[positions.length - 1];
  const firstPos = positions[0];

  // Vérifier que la dernière position ne dépasse pas la largeur
  if (lastPos > piece.largeur) {
    return { valid: false, error: `Position de pli ${lastPos}mm dépasse la largeur ${piece.largeur}mm`, residual: lastPos - piece.largeur };
  }

  return { valid: true };
}

// ═══ GD&T SYMBOLS ═══

export const GDT_SYMBOLS: { id: string; symbol: string; nom: string; desc: string }[] = [
  { id: 'position', symbol: '⊕', nom: 'Position', desc: 'Tolérance de position' },
  { id: 'flatness', symbol: '⏥', nom: 'Planéité', desc: 'Écart de planéité max' },
  { id: 'perpendicularity', symbol: '⊥', nom: 'Perpendicularité', desc: 'Écart angulaire / référence' },
  { id: 'parallelism', symbol: '∥', nom: 'Parallélisme', desc: 'Écart parallèle / référence' },
  { id: 'concentricity', symbol: '◎', nom: 'Concentricité', desc: 'Écart de centrage' },
  { id: 'symmetry', symbol: '⌯', nom: 'Symétrie', desc: 'Écart de symétrie' },
  { id: 'runout', symbol: '↗', nom: 'Battement', desc: 'Battement simple' },
  { id: 'profile_line', symbol: '⌒', nom: 'Profil ligne', desc: 'Profil d\'une ligne' },
  { id: 'profile_surface', symbol: '⌓', nom: 'Profil surface', desc: 'Profil d\'une surface' },
];

// ═══ FOLD/UNFOLD SPLIT VIEW ═══

export interface FoldState {
  progress: number;    // 0 = fully unfolded, 1 = fully folded
  animating: boolean;
  speed: number;       // Animation speed (0.5-3x)
  syncedSelection: string | null; // ID de l'élément sélectionné synchronisé entre les 2 vues
  highlightedBend: string | null; // Pli surligné dans les 2 vues
  splitRatio: number;  // Ratio du split (0.3-0.7)
  showBendLines: boolean; // Afficher lignes de pliage en 3D
}

export function defaultFoldState(): FoldState {
  return {
    progress: 1, animating: false, speed: 1,
    syncedSelection: null, highlightedBend: null,
    splitRatio: 0.5, showBendLines: true,
  };
}

/** Calculer la position 3D d'un point de la tôle à un état de pliage donné */
export function foldPoint(
  x: number, y: number, z: number,
  plis: Pli[], epaisseur: number, matiere: string,
  foldProgress: number
): { x: number; y: number; z: number } {
  let px = x, py = y, pz = z;

  // Trier les plis par position
  const sorted = [...plis].sort((a, b) => a.position - b.position);

  for (const pli of sorted) {
    if (px <= pli.position) continue; // Le point est avant ce pli

    const angle = (pli.angle * foldProgress * Math.PI) / 180;
    const ri = pli.rayonInterne;
    const dir = pli.direction === 'haut' ? 1 : -1;

    // Distance depuis la ligne de pliage
    const dist = px - pli.position;

    // Rotation autour de la ligne de pliage
    const cosA = Math.cos(angle * dir);
    const sinA = Math.sin(angle * dir);

    // Point pivoté
    const newX = pli.position + dist * cosA;
    const newZ = pz + dist * sinA;

    px = newX;
    pz = newZ;
  }

  return { x: px, y: py, z: pz };
}

/** Générer le mesh 3D à un état de pliage intermédiaire */
export function generateFoldMesh(piece: PieceConfig, foldProgress: number): {
  vertices: { x: number; y: number; z: number }[];
  faces: number[][];
  bendLines: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }[];
} {
  const W = piece.largeur, H = piece.hauteur, E = piece.epaisseur;
  const vertices: { x: number; y: number; z: number }[] = [];
  const faces: number[][] = [];
  const bendLines: any[] = [];

  // Subdiviser la tôle en segments entre les plis
  const sorted = [...piece.plis].sort((a, b) => a.position - b.position);
  const segments: { start: number; end: number }[] = [];
  let prev = 0;
  sorted.forEach(p => { segments.push({ start: prev, end: p.position }); prev = p.position; });
  segments.push({ start: prev, end: W });

  // Pour chaque segment, générer 4 sommets (face supérieure)
  segments.forEach((seg, i) => {
    const topLeft = foldPoint(seg.start, 0, 0, piece.plis, E, piece.matiere, foldProgress);
    const topRight = foldPoint(seg.end, 0, 0, piece.plis, E, piece.matiere, foldProgress);
    const botLeft = foldPoint(seg.start, H, 0, piece.plis, E, piece.matiere, foldProgress);
    const botRight = foldPoint(seg.end, H, 0, piece.plis, E, piece.matiere, foldProgress);

    const base = vertices.length;
    vertices.push(topLeft, topRight, botRight, botLeft);
    faces.push([base, base + 1, base + 2, base + 3]);
  });

  // Lignes de pliage
  sorted.forEach(pli => {
    const top = foldPoint(pli.position, 0, 0, piece.plis, E, piece.matiere, foldProgress);
    const bot = foldPoint(pli.position, H, 0, piece.plis, E, piece.matiere, foldProgress);
    bendLines.push({ start: top, end: bot });
  });

  return { vertices, faces, bendLines };
}

// ═══ PLIAGE FORCE CALCULATION ═══

/** Force de pliage nécessaire (en tonnes) */
export function bendingForce(
  longueur: number, epaisseur: number, matiere: string,
  ouvertureV: number, angle: number
): number {
  // Formule: F = (C × L × S² × Rm) / V
  // C = coefficient (1.33 pour pli en V libre)
  // L = longueur de pli (mm) → m
  // S = épaisseur (mm)
  // Rm = résistance traction (MPa)
  // V = ouverture matrice (mm)
  const Rm: Record<string, number> = {
    acier: 400, inox304: 520, inox316: 500,
    aluminium: 220, galvanise: 380,
  };
  const rm = Rm[matiere] || 400;
  const C = 1.33;
  const force = (C * (longueur / 1000) * epaisseur * epaisseur * rm) / ouvertureV;
  return Math.round(force * 10) / 10; // tonnes
}

/** Ouverture de Vé recommandée */
export function recommendedVOpening(epaisseur: number): number {
  if (epaisseur <= 1) return 6;
  if (epaisseur <= 2) return 12;
  if (epaisseur <= 3) return 24;
  if (epaisseur <= 4) return 32;
  if (epaisseur <= 5) return 40;
  if (epaisseur <= 6) return 50;
  return epaisseur * 8;
}
