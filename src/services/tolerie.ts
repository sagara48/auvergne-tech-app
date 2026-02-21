// ═══════════════════════════════════════════════════════════════
// MOTEUR GÉOMÉTRIQUE V2 — Tôlerie / Pliage / Perçage
// + Bibliothèque, validation, symétrie, cotation auto
// ═══════════════════════════════════════════════════════════════

// ═══ TYPES ═══

export type Matiere = 'acier' | 'inox304' | 'inox316' | 'aluminium' | 'galvanise';
export type Finition = 'brut' | 'peinture' | 'zingue' | 'anodise' | 'brosse' | 'poli';
export type FormeBase = 'rectangle' | 'L' | 'U' | 'Z' | 'T' | 'custom';
export type TypeTrou = 'rond' | 'oblong' | 'fraise' | 'taraude';
export type CoteEncoche = 'haut' | 'bas' | 'gauche' | 'droite';

export interface MatiereConfig {
  id: Matiere; nom: string; densite: number; kFactor: number;
  couleur: string; couleurDark: string; epaisseurs: number[];
  rayonIntMin: (ep: number) => number;
}

export interface Pli {
  id: string; position: number; angle: number;
  rayonInterne: number; direction: 'haut' | 'bas';
}

export interface Trou {
  id: string; x: number; y: number; type: TypeTrou;
  diametre: number; longueurOblong?: number;
  angleOblong?: number; profondeur?: number; taraudage?: string;
}

export interface Encoche {
  id: string; x: number; y: number;
  largeur: number; hauteur: number; cote: CoteEncoche;
}

// Feature 18: Chanfreins / rayons de coins
export interface Chanfrein {
  coin: 'hg' | 'hd' | 'bg' | 'bd'; // haut-gauche, haut-droit, bas-gauche, bas-droit
  type: 'chanfrein' | 'rayon';
  valeur: number; // mm (dimension chanfrein ou rayon)
}

// Feature 19: Marquages / gravures
export interface Marquage {
  id: string; x: number; y: number;
  texte: string; taille: number; // hauteur en mm
  type: 'gravure' | 'poincon' | 'etiquette';
  angle?: number;
}

// Feature 22: Annotations canvas
export interface Annotation {
  id: string; x: number; y: number;
  texte: string; couleur?: string;
  fleche?: { x2: number; y2: number };
}

export interface PieceConfig {
  // Identité DB
  id?: string;
  created_at?: string;
  updated_at?: string;
  technicien_id?: string;
  travaux_id?: string; // lien travaux

  // Matière
  matiere: Matiere; epaisseur: number; finition: Finition;
  // Forme
  formeBase: FormeBase; largeur: number; hauteur: number;
  brancheL?: number; profondeurU?: number; decalageZ?: number;
  // Opérations
  plis: Pli[]; trous: Trou[]; encoches: Encoche[];
  chanfreins: Chanfrein[];
  marquages: Marquage[];
  annotations: Annotation[];
  // Meta
  nom: string; reference: string; quantite: number; remarques: string;
}

// ═══ Validation ═══

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  elementId?: string;
  elementType?: 'trou' | 'pli' | 'encoche';
}

// ═══ Cotation auto ═══

export interface AutoCote {
  type: 'horizontal' | 'vertical' | 'distance';
  x1: number; y1: number; x2: number; y2: number;
  value: number; label: string;
  color?: string;
}

// ═══ Template ═══

export interface PieceTemplate {
  id: string; nom: string; categorie: string;
  description: string; icon: string;
  piece: Omit<PieceConfig, 'nom' | 'reference' | 'quantite' | 'remarques'>;
}

// ═══ CONSTANTES ═══

export const MATIERES: MatiereConfig[] = [
  { id: 'acier', nom: 'Acier DC01', densite: 7.85, kFactor: 0.44, couleur: '#6B7280', couleurDark: '#9CA3AF', epaisseurs: [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6], rayonIntMin: (e) => e },
  { id: 'inox304', nom: 'Inox 304', densite: 7.93, kFactor: 0.45, couleur: '#94A3B8', couleurDark: '#CBD5E1', epaisseurs: [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5], rayonIntMin: (e) => e * 1.2 },
  { id: 'inox316', nom: 'Inox 316L', densite: 7.98, kFactor: 0.45, couleur: '#A0AEC0', couleurDark: '#E2E8F0', epaisseurs: [0.5, 0.8, 1, 1.5, 2, 3, 4, 5], rayonIntMin: (e) => e * 1.2 },
  { id: 'aluminium', nom: 'Aluminium 5754', densite: 2.66, kFactor: 0.38, couleur: '#CBD5E1', couleurDark: '#E2E8F0', epaisseurs: [0.5, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6], rayonIntMin: (e) => e * 0.8 },
  { id: 'galvanise', nom: 'Acier Galvanisé DX51D', densite: 7.85, kFactor: 0.44, couleur: '#9CA3AF', couleurDark: '#D1D5DB', epaisseurs: [0.5, 0.75, 1, 1.2, 1.5, 2, 2.5, 3], rayonIntMin: (e) => e },
];

export const FINITIONS: { id: Finition; nom: string }[] = [
  { id: 'brut', nom: 'Brut' }, { id: 'peinture', nom: 'Peinture époxy' },
  { id: 'zingue', nom: 'Zingué blanc' }, { id: 'anodise', nom: 'Anodisé (alu)' },
  { id: 'brosse', nom: 'Brossé (inox)' }, { id: 'poli', nom: 'Poli miroir (inox)' },
];

export const FORMES_BASE: { id: FormeBase; nom: string; icon: string; desc: string }[] = [
  { id: 'rectangle', nom: 'Platine', icon: '▬', desc: 'Tôle plate rectangulaire' },
  { id: 'L', nom: 'Équerre L', icon: '⌐', desc: '1 pli à 90° — cornière' },
  { id: 'U', nom: 'Profil U', icon: '⊔', desc: '2 plis à 90° — canal' },
  { id: 'Z', nom: 'Profil Z', icon: '⊏', desc: '2 plis inversés' },
  { id: 'T', nom: 'Profil T', icon: '⊤', desc: 'Platine + retour central' },
  { id: 'custom', nom: 'Libre', icon: '✎', desc: 'Dessin libre' },
];

// ═══════════════════════════════════════════════════
// BIBLIOTHÈQUE DE PIÈCES TYPES (Feature 1)
// ═══════════════════════════════════════════════════

export const PIECE_TEMPLATES: PieceTemplate[] = [
  {
    id: 'platine-moteur', nom: 'Platine fixation moteur', categorie: 'Fixation',
    description: 'Plaque 200×150 avec 4 trous ∅12 aux coins', icon: '⊞',
    piece: {
      matiere: 'acier', epaisseur: 3, finition: 'zingue', formeBase: 'rectangle',
      largeur: 200, hauteur: 150, plis: [], encoches: [],
      trous: [
        { id: 't1', x: 20, y: 20, type: 'rond', diametre: 12 },
        { id: 't2', x: 180, y: 20, type: 'rond', diametre: 12 },
        { id: 't3', x: 20, y: 130, type: 'rond', diametre: 12 },
        { id: 't4', x: 180, y: 130, type: 'rond', diametre: 12 },
      ],
    },
  },
  {
    id: 'equerre-rail', nom: 'Équerre support rail', categorie: 'Structure',
    description: 'Cornière L 80×60 avec 2 trous oblongs', icon: '⌐',
    piece: {
      matiere: 'acier', epaisseur: 4, finition: 'zingue', formeBase: 'L',
      largeur: 140, hauteur: 60, brancheL: 60, plis: [],
      trous: [
        { id: 't1', x: 40, y: 30, type: 'oblong', diametre: 10, longueurOblong: 20 },
        { id: 't2', x: 110, y: 30, type: 'oblong', diametre: 10, longueurOblong: 20 },
      ],
      encoches: [],
    },
  },
  {
    id: 'tole-protection', nom: 'Tôle de protection gaine', categorie: 'Protection',
    description: 'Profil U 400×250 avec encoches câbles', icon: '⊔',
    piece: {
      matiere: 'galvanise', epaisseur: 1.5, finition: 'brut', formeBase: 'U',
      largeur: 400, hauteur: 250, profondeurU: 60, plis: [],
      trous: [],
      encoches: [
        { id: 'e1', x: 180, y: 0, largeur: 40, hauteur: 15, cote: 'bas' },
      ],
    },
  },
  {
    id: 'plaque-fermeture', nom: 'Plaque fermeture gaine', categorie: 'Fermeture',
    description: 'Platine 300×200 avec 6 trous M8', icon: '▬',
    piece: {
      matiere: 'acier', epaisseur: 2, finition: 'peinture', formeBase: 'rectangle',
      largeur: 300, hauteur: 200, plis: [], encoches: [],
      trous: [
        { id: 't1', x: 25, y: 25, type: 'taraude', diametre: 8, taraudage: 'M8' },
        { id: 't2', x: 150, y: 25, type: 'taraude', diametre: 8, taraudage: 'M8' },
        { id: 't3', x: 275, y: 25, type: 'taraude', diametre: 8, taraudage: 'M8' },
        { id: 't4', x: 25, y: 175, type: 'taraude', diametre: 8, taraudage: 'M8' },
        { id: 't5', x: 150, y: 175, type: 'taraude', diametre: 8, taraudage: 'M8' },
        { id: 't6', x: 275, y: 175, type: 'taraude', diametre: 8, taraudage: 'M8' },
      ],
    },
  },
  {
    id: 'support-serrure', nom: 'Support serrure palière', categorie: 'Fixation',
    description: 'Profil Z 120×80 avec 3 trous', icon: '⊏',
    piece: {
      matiere: 'inox304', epaisseur: 2, finition: 'brosse', formeBase: 'Z',
      largeur: 120, hauteur: 80, decalageZ: 40, plis: [],
      trous: [
        { id: 't1', x: 20, y: 40, type: 'rond', diametre: 8 },
        { id: 't2', x: 60, y: 40, type: 'rond', diametre: 8 },
        { id: 't3', x: 100, y: 40, type: 'rond', diametre: 8 },
      ],
      encoches: [],
    },
  },
  {
    id: 'renfort-porte', nom: 'Renfort de porte cabine', categorie: 'Structure',
    description: 'Platine longue 500×80 avec perçages réguliers', icon: '▬',
    piece: {
      matiere: 'acier', epaisseur: 2.5, finition: 'peinture', formeBase: 'rectangle',
      largeur: 500, hauteur: 80, plis: [], encoches: [],
      trous: [
        { id: 't1', x: 50, y: 40, type: 'rond', diametre: 10 },
        { id: 't2', x: 150, y: 40, type: 'rond', diametre: 10 },
        { id: 't3', x: 250, y: 40, type: 'rond', diametre: 10 },
        { id: 't4', x: 350, y: 40, type: 'rond', diametre: 10 },
        { id: 't5', x: 450, y: 40, type: 'rond', diametre: 10 },
      ],
    },
  },
  {
    id: 'equerre-contrepoids', nom: 'Équerre contrepoids', categorie: 'Structure',
    description: 'Cornière robuste 100×100 épaisseur 5mm', icon: '⌐',
    piece: {
      matiere: 'acier', epaisseur: 5, finition: 'zingue', formeBase: 'L',
      largeur: 200, hauteur: 100, brancheL: 100, plis: [],
      trous: [
        { id: 't1', x: 50, y: 50, type: 'rond', diametre: 14 },
        { id: 't2', x: 150, y: 50, type: 'rond', diametre: 14 },
      ],
      encoches: [],
    },
  },
  {
    id: 'goulotte-cables', nom: 'Goulotte à câbles', categorie: 'Protection',
    description: 'Profil U en alu 300×100 avec couvercle', icon: '⊔',
    piece: {
      matiere: 'aluminium', epaisseur: 1.5, finition: 'anodise', formeBase: 'U',
      largeur: 300, hauteur: 100, profondeurU: 50, plis: [],
      trous: [], encoches: [],
    },
  },
];

// ═══ CALCULS ═══

export function bendAllowance(ri: number, ep: number, angleDeg: number, k: number): number {
  return (angleDeg * Math.PI / 180) * (ri + k * ep);
}

export function getKFactor(mat: Matiere, ri: number, ep: number): number {
  const base = MATIERES.find(m => m.id === mat)?.kFactor || 0.44;
  const ratio = ri / ep;
  if (ratio < 1) return base * 0.9;
  if (ratio > 3) return base * 1.05;
  return base;
}

export function longueurDeveloppee(p: PieceConfig): number {
  const plis = [...p.plis].sort((a, b) => a.position - b.position);
  let total = 0, lastPos = 0;
  plis.forEach(pli => {
    total += pli.position - lastPos;
    total += bendAllowance(pli.rayonInterne, p.epaisseur, pli.angle, getKFactor(p.matiere, pli.rayonInterne, p.epaisseur));
    lastPos = pli.position;
  });
  total += p.largeur - lastPos;
  return Math.round(total * 100) / 100;
}

export function poidsEstime(p: PieceConfig): number {
  const mat = MATIERES.find(m => m.id === p.matiere);
  if (!mat) return 0;
  const dev = longueurDeveloppee(p);
  let surf = (dev * p.hauteur) / 1e6;
  surf -= p.trous.reduce((s, t) => {
    if (t.type === 'oblong') return s + (Math.PI * (t.diametre / 2) ** 2 + t.diametre * (t.longueurOblong || 0)) / 1e6;
    return s + (Math.PI * (t.diametre / 2) ** 2) / 1e6;
  }, 0);
  surf -= p.encoches.reduce((s, e) => s + (e.largeur * e.hauteur) / 1e6, 0);
  return Math.round(Math.max(0, surf) * (p.epaisseur / 1000) * mat.densite * 1000 * 1000) / 1000;
}

// ═══ FORMES AUTO ═══

export function genererPlisFormeBase(forme: FormeBase, w: number, h: number, ep: number,
  params?: { brancheL?: number; profondeurU?: number; decalageZ?: number }): Pli[] {
  const ri = Math.max(ep, 1);
  switch (forme) {
    case 'L': return [{ id: 'pli-1', position: w - (params?.brancheL || h), angle: 90, rayonInterne: ri, direction: 'haut' }];
    case 'U': {
      const d = params?.profondeurU || h;
      return [
        { id: 'pli-1', position: d, angle: 90, rayonInterne: ri, direction: 'haut' },
        { id: 'pli-2', position: w - d, angle: 90, rayonInterne: ri, direction: 'haut' },
      ];
    }
    case 'Z': {
      const d = params?.decalageZ || w / 3;
      return [
        { id: 'pli-1', position: d, angle: 90, rayonInterne: ri, direction: 'haut' },
        { id: 'pli-2', position: w - d, angle: 90, rayonInterne: ri, direction: 'bas' },
      ];
    }
    case 'T': return [
      { id: 'pli-1', position: w * 0.35, angle: 90, rayonInterne: ri, direction: 'bas' },
      { id: 'pli-2', position: w * 0.65, angle: 90, rayonInterne: ri, direction: 'bas' },
    ];
    default: return [];
  }
}

// ═══ CONTOUR SVG ═══

export function genererPathDeveloppe(p: PieceConfig): string {
  const w = p.largeur, h = p.hauteur;
  const enc = p.encoches || [];
  let path = `M 0 0`;
  const byHaut = enc.filter(e => e.cote === 'haut').sort((a, b) => a.x - b.x);
  let cx = 0;
  byHaut.forEach(e => { if (e.x > cx) path += ` L ${e.x} 0`; path += ` L ${e.x} ${-e.hauteur} L ${e.x + e.largeur} ${-e.hauteur} L ${e.x + e.largeur} 0`; cx = e.x + e.largeur; });
  path += ` L ${w} 0`;
  const byDroit = enc.filter(e => e.cote === 'droite').sort((a, b) => a.y - b.y);
  let cy = 0;
  byDroit.forEach(e => { if (e.y > cy) path += ` L ${w} ${e.y}`; path += ` L ${w + e.largeur} ${e.y} L ${w + e.largeur} ${e.y + e.hauteur} L ${w} ${e.y + e.hauteur}`; cy = e.y + e.hauteur; });
  path += ` L ${w} ${h}`;
  const byBas = enc.filter(e => e.cote === 'bas').sort((a, b) => b.x - a.x);
  cx = w;
  byBas.forEach(e => { const ex = e.x + e.largeur; if (ex < cx) path += ` L ${ex} ${h}`; path += ` L ${ex} ${h + e.hauteur} L ${e.x} ${h + e.hauteur} L ${e.x} ${h}`; cx = e.x; });
  path += ` L 0 ${h}`;
  const byGauche = enc.filter(e => e.cote === 'gauche').sort((a, b) => b.y - a.y);
  cy = h;
  byGauche.forEach(e => { const ey = e.y + e.hauteur; if (ey < cy) path += ` L 0 ${ey}`; path += ` L ${-e.largeur} ${ey} L ${-e.largeur} ${e.y} L 0 ${e.y}`; cy = e.y; });
  path += ` Z`;
  return path;
}

// ═══ VUE ISOMÉTRIQUE ═══

export function genererVueIso(p: PieceConfig): { segments: { x1: number; y1: number; x2: number; y2: number }[] } {
  const plis = [...p.plis].sort((a, b) => a.position - b.position);
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const iX = (x: number, y: number, z: number) => x * 0.866 - y * 0.866;
  const iY = (x: number, y: number, z: number) => x * 0.5 + y * 0.5 - z;
  const addSeg = (fx: number, fz: number, tx: number, tz: number) => {
    const h = p.hauteur;
    segs.push({ x1: iX(fx, 0, fz), y1: iY(fx, 0, fz), x2: iX(tx, 0, tz), y2: iY(tx, 0, tz) });
    segs.push({ x1: iX(fx, h, fz), y1: iY(fx, h, fz), x2: iX(tx, h, tz), y2: iY(tx, h, tz) });
    segs.push({ x1: iX(fx, 0, fz), y1: iY(fx, 0, fz), x2: iX(fx, h, fz), y2: iY(fx, h, fz) });
  };
  if (plis.length === 0) {
    addSeg(0, 0, p.largeur, 0);
    segs.push({ x1: iX(p.largeur, 0, 0), y1: iY(p.largeur, 0, 0), x2: iX(p.largeur, p.hauteur, 0), y2: iY(p.largeur, p.hauteur, 0) });
  } else {
    let pX = 0, pZ = 0, dX = 1, dZ = 0, last = 0;
    plis.forEach(pli => {
      const len = pli.position - last;
      const nX = pX + dX * len, nZ = pZ + dZ * len;
      addSeg(pX, pZ, nX, nZ); pX = nX; pZ = nZ; last = pli.position;
      const rad = (pli.angle * Math.PI / 180) * (pli.direction === 'haut' ? -1 : 1);
      const ndX = dX * Math.cos(rad) - dZ * Math.sin(rad);
      const ndZ = dX * Math.sin(rad) + dZ * Math.cos(rad);
      dX = ndX; dZ = ndZ;
    });
    const lLen = p.largeur - last;
    const fX = pX + dX * lLen, fZ = pZ + dZ * lLen;
    addSeg(pX, pZ, fX, fZ);
    segs.push({ x1: iX(fX, 0, fZ), y1: iY(fX, 0, fZ), x2: iX(fX, p.hauteur, fZ), y2: iY(fX, p.hauteur, fZ) });
  }
  return { segments: segs };
}

// ═══════════════════════════════════════════════════
// VÉRIFICATIONS AUTOMATIQUES (Feature 5)
// ═══════════════════════════════════════════════════

export function validerPiece(p: PieceConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ep = p.epaisseur;
  const mat = MATIERES.find(m => m.id === p.matiere);
  const minBord = ep * 2;

  // Vérifier les trous
  p.trous.forEach((t, i) => {
    const r = t.diametre / 2;
    // Trou trop près du bord
    if (t.x - r < minBord) issues.push({ severity: 'error', code: 'TROU_BORD', message: `Trou ${i + 1} : distance bord gauche (${(t.x - r).toFixed(1)}mm) < min ${minBord}mm (2×ép.)`, elementId: t.id, elementType: 'trou' });
    if (t.y - r < minBord) issues.push({ severity: 'error', code: 'TROU_BORD', message: `Trou ${i + 1} : distance bord haut (${(t.y - r).toFixed(1)}mm) < min ${minBord}mm`, elementId: t.id, elementType: 'trou' });
    if (p.largeur - t.x - r < minBord) issues.push({ severity: 'error', code: 'TROU_BORD', message: `Trou ${i + 1} : distance bord droit (${(p.largeur - t.x - r).toFixed(1)}mm) < min ${minBord}mm`, elementId: t.id, elementType: 'trou' });
    if (p.hauteur - t.y - r < minBord) issues.push({ severity: 'error', code: 'TROU_BORD', message: `Trou ${i + 1} : distance bord bas (${(p.hauteur - t.y - r).toFixed(1)}mm) < min ${minBord}mm`, elementId: t.id, elementType: 'trou' });

    // Trou dans zone de pli
    p.plis.forEach((pli, j) => {
      const dist = Math.abs(t.x - pli.position);
      const minDistPli = ep * 3 + pli.rayonInterne;
      if (dist < minDistPli) issues.push({ severity: 'error', code: 'TROU_PLI', message: `Trou ${i + 1} : trop près du pli ${j + 1} (${dist.toFixed(1)}mm < ${minDistPli.toFixed(1)}mm)`, elementId: t.id, elementType: 'trou' });
    });

    // Chevauchement entre trous
    p.trous.forEach((t2, j) => {
      if (j <= i) return;
      const dist = Math.sqrt((t.x - t2.x) ** 2 + (t.y - t2.y) ** 2);
      const minDist = (t.diametre + t2.diametre) / 2 + ep;
      if (dist < minDist) issues.push({ severity: 'error', code: 'TROU_CHEVAUCHE', message: `Trous ${i + 1} et ${j + 1} : distance ${dist.toFixed(1)}mm < min ${minDist.toFixed(1)}mm`, elementId: t.id, elementType: 'trou' });
    });

    // Trou hors pièce
    if (t.x < 0 || t.y < 0 || t.x > p.largeur || t.y > p.hauteur) {
      issues.push({ severity: 'error', code: 'TROU_HORS', message: `Trou ${i + 1} : hors de la pièce`, elementId: t.id, elementType: 'trou' });
    }
  });

  // Vérifier les plis
  p.plis.forEach((pli, i) => {
    if (mat) {
      const minRi = mat.rayonIntMin(ep);
      if (pli.rayonInterne < minRi) issues.push({ severity: 'warning', code: 'PLI_RAYON', message: `Pli ${i + 1} : rayon ${pli.rayonInterne}mm < recommandé ${minRi.toFixed(1)}mm pour ${mat.nom}`, elementId: pli.id, elementType: 'pli' });
    }
    if (pli.position <= ep * 2) issues.push({ severity: 'warning', code: 'PLI_BORD', message: `Pli ${i + 1} : trop près du bord gauche (${pli.position}mm)`, elementId: pli.id, elementType: 'pli' });
    if (p.largeur - pli.position <= ep * 2) issues.push({ severity: 'warning', code: 'PLI_BORD', message: `Pli ${i + 1} : trop près du bord droit (${(p.largeur - pli.position).toFixed(1)}mm)`, elementId: pli.id, elementType: 'pli' });
    // Plis trop proches
    p.plis.forEach((p2, j) => {
      if (j <= i) return;
      const dist = Math.abs(pli.position - p2.position);
      if (dist < ep * 4) issues.push({ severity: 'warning', code: 'PLI_PROCHE', message: `Plis ${i + 1} et ${j + 1} : trop proches (${dist.toFixed(1)}mm < ${(ep * 4).toFixed(1)}mm)`, elementId: pli.id, elementType: 'pli' });
    });
  });

  // Dimensions minimales
  if (p.largeur < 10) issues.push({ severity: 'error', code: 'DIM_MIN', message: 'Largeur minimale : 10mm' });
  if (p.hauteur < 10) issues.push({ severity: 'error', code: 'DIM_MIN', message: 'Hauteur minimale : 10mm' });

  return issues;
}

// ═══════════════════════════════════════════════════
// COTATION AUTOMATIQUE (Feature 3)
// ═══════════════════════════════════════════════════

export function genererCotationsAuto(p: PieceConfig): AutoCote[] {
  const cotes: AutoCote[] = [];
  const trous = p.trous;

  // Entraxes horizontaux entre trous consécutifs (triés par X)
  const trousX = [...trous].sort((a, b) => a.x - b.x);
  for (let i = 0; i < trousX.length - 1; i++) {
    const a = trousX[i], b = trousX[i + 1];
    if (Math.abs(a.y - b.y) < 5) { // Quasi alignés en Y
      const d = Math.round((b.x - a.x) * 100) / 100;
      cotes.push({ type: 'horizontal', x1: a.x, y1: a.y, x2: b.x, y2: b.y, value: d, label: `${d}`, color: '#059669' });
    }
  }

  // Entraxes verticaux
  const trousY = [...trous].sort((a, b) => a.y - b.y);
  for (let i = 0; i < trousY.length - 1; i++) {
    const a = trousY[i], b = trousY[i + 1];
    if (Math.abs(a.x - b.x) < 5) {
      const d = Math.round((b.y - a.y) * 100) / 100;
      cotes.push({ type: 'vertical', x1: a.x, y1: a.y, x2: b.x, y2: b.y, value: d, label: `${d}`, color: '#059669' });
    }
  }

  // Distance trou → bord le plus proche
  trous.forEach(t => {
    const dGauche = t.x, dDroit = p.largeur - t.x, dHaut = t.y, dBas = p.hauteur - t.y;
    // Bord gauche si c'est le trou le plus à gauche
    if (!trous.some(t2 => t2.id !== t.id && t2.x < t.x && Math.abs(t2.y - t.y) < 5)) {
      cotes.push({ type: 'horizontal', x1: 0, y1: t.y, x2: t.x, y2: t.y, value: Math.round(dGauche * 10) / 10, label: `${Math.round(dGauche * 10) / 10}`, color: '#6366F1' });
    }
    // Bord haut si c'est le trou le plus en haut dans sa colonne X
    if (!trous.some(t2 => t2.id !== t.id && t2.y < t.y && Math.abs(t2.x - t.x) < 5)) {
      cotes.push({ type: 'vertical', x1: t.x, y1: 0, x2: t.x, y2: t.y, value: Math.round(dHaut * 10) / 10, label: `${Math.round(dHaut * 10) / 10}`, color: '#6366F1' });
    }
  });

  // Distances entre plis
  const plisT = [...p.plis].sort((a, b) => a.position - b.position);
  for (let i = 0; i < plisT.length - 1; i++) {
    const d = Math.round((plisT[i + 1].position - plisT[i].position) * 100) / 100;
    cotes.push({ type: 'horizontal', x1: plisT[i].position, y1: -8, x2: plisT[i + 1].position, y2: -8, value: d, label: `${d}`, color: '#3B82F6' });
  }

  return cotes;
}

// ═══════════════════════════════════════════════════
// DUPLICATION & SYMÉTRIE (Feature 2)
// ═══════════════════════════════════════════════════

export function miroirHorizontal(p: PieceConfig): PieceConfig {
  return {
    ...p,
    reference: p.reference + '-MH',
    nom: p.nom + ' (miroir H)',
    trous: p.trous.map(t => ({ ...t, id: uid(), x: p.largeur - t.x })),
    plis: p.plis.map(pl => ({ ...pl, id: uid(), position: p.largeur - pl.position })),
    encoches: p.encoches.map(e => {
      if (e.cote === 'gauche') return { ...e, id: uid(), cote: 'droite' as CoteEncoche };
      if (e.cote === 'droite') return { ...e, id: uid(), cote: 'gauche' as CoteEncoche };
      return { ...e, id: uid(), x: p.largeur - e.x - e.largeur };
    }),
    chanfreins: p.chanfreins.map(c => ({
      ...c,
      coin: c.coin === 'hg' ? 'hd' : c.coin === 'hd' ? 'hg' : c.coin === 'bg' ? 'bd' : 'bg' as Chanfrein['coin'],
    })),
    marquages: p.marquages.map(m => ({ ...m, id: uid(), x: p.largeur - m.x })),
    annotations: p.annotations.map(a => ({ ...a, id: uid(), x: p.largeur - a.x, fleche: a.fleche ? { x2: p.largeur - a.fleche.x2, y2: a.fleche.y2 } : undefined })),
  };
}

export function miroirVertical(p: PieceConfig): PieceConfig {
  return {
    ...p,
    reference: p.reference + '-MV',
    nom: p.nom + ' (miroir V)',
    trous: p.trous.map(t => ({ ...t, id: uid(), y: p.hauteur - t.y })),
    plis: p.plis.map(pl => ({ ...pl, id: uid(), direction: pl.direction === 'haut' ? 'bas' : 'haut' as 'haut' | 'bas' })),
    encoches: p.encoches.map(e => {
      if (e.cote === 'haut') return { ...e, id: uid(), cote: 'bas' as CoteEncoche };
      if (e.cote === 'bas') return { ...e, id: uid(), cote: 'haut' as CoteEncoche };
      return { ...e, id: uid(), y: p.hauteur - e.y - e.hauteur };
    }),
    chanfreins: p.chanfreins.map(c => ({
      ...c,
      coin: c.coin === 'hg' ? 'bg' : c.coin === 'bg' ? 'hg' : c.coin === 'hd' ? 'bd' : 'hd' as Chanfrein['coin'],
    })),
    marquages: p.marquages.map(m => ({ ...m, id: uid(), y: p.hauteur - m.y })),
    annotations: p.annotations.map(a => ({ ...a, id: uid(), y: p.hauteur - a.y, fleche: a.fleche ? { x2: a.fleche.x2, y2: p.hauteur - a.fleche.y2 } : undefined })),
  };
}

export function dupliquerPiece(p: PieceConfig): PieceConfig {
  return {
    ...p, id: undefined, created_at: undefined, updated_at: undefined,
    reference: p.reference + '-CPY',
    nom: p.nom + ' (copie)',
    plis: p.plis.map(pl => ({ ...pl, id: uid() })),
    trous: p.trous.map(t => ({ ...t, id: uid() })),
    encoches: p.encoches.map(e => ({ ...e, id: uid() })),
    marquages: p.marquages.map(m => ({ ...m, id: uid() })),
    annotations: p.annotations.map(a => ({ ...a, id: uid() })),
  };
}

/** Dupliquer un trou en motif linéaire */
export function motifLineaire(trou: Trou, count: number, dx: number, dy: number): Trou[] {
  const result: Trou[] = [];
  for (let i = 1; i <= count; i++) {
    result.push({ ...trou, id: uid(), x: trou.x + dx * i, y: trou.y + dy * i });
  }
  return result;
}

/** Dupliquer un trou en motif circulaire */
export function motifCirculaire(trou: Trou, count: number, cx: number, cy: number): Trou[] {
  const result: Trou[] = [];
  const r = Math.sqrt((trou.x - cx) ** 2 + (trou.y - cy) ** 2);
  const startAngle = Math.atan2(trou.y - cy, trou.x - cx);
  for (let i = 1; i <= count; i++) {
    const a = startAngle + (2 * Math.PI * i) / (count + 1);
    result.push({ ...trou, id: uid(), x: Math.round((cx + r * Math.cos(a)) * 10) / 10, y: Math.round((cy + r * Math.sin(a)) * 10) / 10 });
  }
  return result;
}

// ═══ UTILS ═══

export function uid(): string { return Math.random().toString(36).substring(2, 9); }

export function createDefaultPiece(): PieceConfig {
  return {
    matiere: 'acier', epaisseur: 2, finition: 'brut', formeBase: 'rectangle',
    largeur: 200, hauteur: 100, plis: [], trous: [], encoches: [],
    chanfreins: [], marquages: [], annotations: [],
    nom: 'Nouvelle pièce', reference: `AT-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    quantite: 1, remarques: '',
  };
}

export function pieceFromTemplate(tpl: PieceTemplate): PieceConfig {
  return {
    ...tpl.piece,
    chanfreins: [], marquages: [], annotations: [],
    nom: tpl.nom,
    reference: `AT-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    quantite: 1, remarques: '',
    plis: tpl.piece.plis.map(pl => ({ ...pl, id: uid() })),
    trous: tpl.piece.trous.map(t => ({ ...t, id: uid() })),
    encoches: tpl.piece.encoches.map(e => ({ ...e, id: uid() })),
  };
}

// ═══════════════════════════════════════════════════
// EXPORT DXF (Feature 24)
// ═══════════════════════════════════════════════════

export function genererDXF(p: PieceConfig): string {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  // Header
  w('0'); w('SECTION'); w('2'); w('HEADER');
  w('9'); w('$ACADVER'); w('1'); w('AC1009');
  w('0'); w('ENDSEC');

  // Entities section
  w('0'); w('SECTION'); w('2'); w('ENTITIES');

  // Contour rectangle (avec chanfreins)
  const pts: [number, number][] = [];
  const ch = (coin: string) => p.chanfreins.find(c => c.coin === coin);
  const chHG = ch('hg'), chHD = ch('hd'), chBG = ch('bg'), chBD = ch('bd');

  // Construire les points du contour
  // Haut-gauche
  if (chHG?.type === 'chanfrein') { pts.push([chHG.valeur, 0]); pts.push([0, chHG.valeur]); }
  else if (chHG?.type === 'rayon') { pts.push([chHG.valeur, 0]); /* arc simplifié en ligne */ pts.push([0, chHG.valeur]); }
  else { pts.push([0, 0]); }

  // Bas-gauche
  if (chBG?.type === 'chanfrein') { pts.push([0, p.hauteur - chBG.valeur]); pts.push([chBG.valeur, p.hauteur]); }
  else { pts.push([0, p.hauteur]); }

  // Bas-droit
  if (chBD?.type === 'chanfrein') { pts.push([p.largeur - chBD.valeur, p.hauteur]); pts.push([p.largeur, p.hauteur - chBD.valeur]); }
  else { pts.push([p.largeur, p.hauteur]); }

  // Haut-droit
  if (chHD?.type === 'chanfrein') { pts.push([p.largeur, chHD.valeur]); pts.push([p.largeur - chHD.valeur, 0]); }
  else { pts.push([p.largeur, 0]); }

  // Fermer
  pts.push(pts[0]);

  // Lines du contour
  for (let i = 0; i < pts.length - 1; i++) {
    w('0'); w('LINE');
    w('8'); w('CONTOUR');
    w('10'); w(String(pts[i][0]));
    w('20'); w(String(pts[i][1]));
    w('30'); w('0');
    w('11'); w(String(pts[i + 1][0]));
    w('21'); w(String(pts[i + 1][1]));
    w('31'); w('0');
  }

  // Plis (layer PLIS)
  p.plis.forEach(pli => {
    w('0'); w('LINE');
    w('8'); w('PLIS');
    w('10'); w(String(pli.position));
    w('20'); w('0');
    w('30'); w('0');
    w('11'); w(String(pli.position));
    w('21'); w(String(p.hauteur));
    w('31'); w('0');
  });

  // Trous (layer PERCAGES)
  p.trous.forEach(trou => {
    w('0'); w('CIRCLE');
    w('8'); w('PERCAGES');
    w('10'); w(String(trou.x));
    w('20'); w(String(trou.y));
    w('30'); w('0');
    w('40'); w(String(trou.diametre / 2));
  });

  // Encoches (layer ENCOCHES)
  p.encoches.forEach(enc => {
    const x1 = enc.x, y1 = enc.y;
    const x2 = enc.x + enc.largeur, y2 = enc.y + enc.hauteur;
    [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]].forEach(([ax, ay, bx, by]) => {
      w('0'); w('LINE'); w('8'); w('ENCOCHES');
      w('10'); w(String(ax)); w('20'); w(String(ay)); w('30'); w('0');
      w('11'); w(String(bx)); w('21'); w(String(by)); w('31'); w('0');
    });
  });

  // Marquages (layer MARQUAGE)
  p.marquages.forEach(m => {
    w('0'); w('TEXT');
    w('8'); w('MARQUAGE');
    w('10'); w(String(m.x));
    w('20'); w(String(m.y));
    w('30'); w('0');
    w('40'); w(String(m.taille));
    w('1'); w(m.texte);
  });

  w('0'); w('ENDSEC');
  w('0'); w('EOF');

  return lines.join('\n');
}

export function telechargerDXF(p: PieceConfig) {
  const dxf = genererDXF(p);
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.reference}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
