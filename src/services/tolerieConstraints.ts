// ═══════════════════════════════════════════════════════════════
// SKETCHER 2D CONTRAINT — Solver géométrique
// Entités: points, lignes, arcs, cercles
// Contraintes: horizontal, vertical, coïncident, dimension, etc.
// ═══════════════════════════════════════════════════════════════

import { uid } from './tolerie';

// ═══ TYPES GÉOMÉTRIQUES ═══

export interface SketchPoint {
  id: string;
  x: number;
  y: number;
  fixed: boolean;      // Point d'ancrage (ne bouge pas)
  construction: boolean; // Point de construction (non-coupé)
}

export interface SketchLine {
  id: string;
  startId: string;     // ID du point début
  endId: string;       // ID du point fin
  construction: boolean;
}

export interface SketchArc {
  id: string;
  centerId: string;    // ID du point centre
  startId: string;
  endId: string;
  radius: number;
  construction: boolean;
}

export interface SketchCircle {
  id: string;
  centerId: string;
  radius: number;
  construction: boolean;
}

export type SketchEntityType = 'point' | 'line' | 'arc' | 'circle';

export type SketchEntity =
  | { type: 'point'; data: SketchPoint }
  | { type: 'line'; data: SketchLine }
  | { type: 'arc'; data: SketchArc }
  | { type: 'circle'; data: SketchCircle };

// ═══ CONTRAINTES ═══

export type ConstraintType =
  | 'horizontal'      // Ligne horizontale
  | 'vertical'        // Ligne verticale
  | 'coincident'      // 2 points au même endroit
  | 'perpendicular'   // 2 lignes perpendiculaires
  | 'parallel'        // 2 lignes parallèles
  | 'equal_length'    // 2 lignes même longueur
  | 'tangent'         // Ligne tangente à arc/cercle
  | 'concentric'      // 2 cercles/arcs même centre
  | 'symmetric'       // 2 points symétriques / axe
  | 'midpoint'        // Point au milieu d'une ligne
  | 'colinear'        // 2 lignes colinéaires
  | 'fix'             // Point fixé en position
  | 'dimension_h'     // Cote horizontale
  | 'dimension_v'     // Cote verticale
  | 'dimension_d'     // Cote distance (oblique)
  | 'dimension_angle' // Cote angulaire
  | 'dimension_radius'; // Cote rayon

export interface SketchConstraint {
  id: string;
  type: ConstraintType;
  entityIds: string[];  // IDs des entités concernées (points, lignes, etc.)
  value?: number;       // Pour les cotes dimensionnelles
  expression?: string;  // Expression paramétrique pour la valeur
  driven: boolean;      // true = cote de référence (non-contraignante)
  satisfied: boolean;   // Résultat du solveur
}

// ═══ SKETCH STATE ═══

export interface Sketch {
  points: SketchPoint[];
  lines: SketchLine[];
  arcs: SketchArc[];
  circles: SketchCircle[];
  constraints: SketchConstraint[];
  // État
  fullyConstrained: boolean;
  underConstrained: string[]; // IDs des entités sous-contraintes
  overConstrained: string[];  // IDs des contraintes en conflit
}

// ═══ SKETCH FACTORY ═══

export function createEmptySketch(): Sketch {
  return {
    points: [], lines: [], arcs: [], circles: [],
    constraints: [],
    fullyConstrained: false,
    underConstrained: [],
    overConstrained: [],
  };
}

// Créer un sketch rectangulaire initial (contour de la tôle)
export function createRectangleSketch(width: number, height: number): Sketch {
  const p1: SketchPoint = { id: 'p_origin', x: 0, y: 0, fixed: true, construction: false };
  const p2: SketchPoint = { id: 'p_tr', x: width, y: 0, fixed: false, construction: false };
  const p3: SketchPoint = { id: 'p_br', x: width, y: height, fixed: false, construction: false };
  const p4: SketchPoint = { id: 'p_bl', x: 0, y: height, fixed: false, construction: false };

  const l1: SketchLine = { id: 'l_top', startId: 'p_origin', endId: 'p_tr', construction: false };
  const l2: SketchLine = { id: 'l_right', startId: 'p_tr', endId: 'p_br', construction: false };
  const l3: SketchLine = { id: 'l_bottom', startId: 'p_br', endId: 'p_bl', construction: false };
  const l4: SketchLine = { id: 'l_left', startId: 'p_bl', endId: 'p_origin', construction: false };

  const constraints: SketchConstraint[] = [
    { id: 'c_fix_origin', type: 'fix', entityIds: ['p_origin'], driven: false, satisfied: true },
    { id: 'c_h_top', type: 'horizontal', entityIds: ['l_top'], driven: false, satisfied: true },
    { id: 'c_v_right', type: 'vertical', entityIds: ['l_right'], driven: false, satisfied: true },
    { id: 'c_h_bottom', type: 'horizontal', entityIds: ['l_bottom'], driven: false, satisfied: true },
    { id: 'c_v_left', type: 'vertical', entityIds: ['l_left'], driven: false, satisfied: true },
    { id: 'c_dim_width', type: 'dimension_h', entityIds: ['l_top'], value: width, driven: false, satisfied: true },
    { id: 'c_dim_height', type: 'dimension_v', entityIds: ['l_right'], value: height, driven: false, satisfied: true },
  ];

  return {
    points: [p1, p2, p3, p4], lines: [l1, l2, l3, l4],
    arcs: [], circles: [], constraints,
    fullyConstrained: true, underConstrained: [], overConstrained: [],
  };
}

// ═══ ENTITY OPERATIONS ═══

export function addPoint(sketch: Sketch, x: number, y: number, fixed = false): { sketch: Sketch; pointId: string } {
  const id = `p_${uid()}`;
  const pt: SketchPoint = { id, x, y, fixed, construction: false };
  return { sketch: { ...sketch, points: [...sketch.points, pt] }, pointId: id };
}

export function addLine(sketch: Sketch, x1: number, y1: number, x2: number, y2: number): { sketch: Sketch; lineId: string; startId: string; endId: string } {
  const startId = `p_${uid()}`;
  const endId = `p_${uid()}`;
  const lineId = `l_${uid()}`;
  const start: SketchPoint = { id: startId, x: x1, y: y1, fixed: false, construction: false };
  const end: SketchPoint = { id: endId, x: x2, y: y2, fixed: false, construction: false };
  const line: SketchLine = { id: lineId, startId, endId, construction: false };
  return {
    sketch: { ...sketch, points: [...sketch.points, start, end], lines: [...sketch.lines, line] },
    lineId, startId, endId,
  };
}

export function addCircleEntity(sketch: Sketch, cx: number, cy: number, radius: number): { sketch: Sketch; circleId: string; centerId: string } {
  const centerId = `p_${uid()}`;
  const circleId = `c_${uid()}`;
  const center: SketchPoint = { id: centerId, x: cx, y: cy, fixed: false, construction: false };
  const circle: SketchCircle = { id: circleId, centerId, radius, construction: false };
  return {
    sketch: { ...sketch, points: [...sketch.points, center], circles: [...sketch.circles, circle] },
    circleId, centerId,
  };
}

// ═══ CONSTRAINT OPERATIONS ═══

export function addConstraint(sketch: Sketch, type: ConstraintType, entityIds: string[], value?: number): Sketch {
  const c: SketchConstraint = {
    id: `cst_${uid()}`, type, entityIds,
    value, driven: false, satisfied: false,
  };
  const updated = { ...sketch, constraints: [...sketch.constraints, c] };
  return solveConstraints(updated);
}

export function removeConstraint(sketch: Sketch, constraintId: string): Sketch {
  const updated = { ...sketch, constraints: sketch.constraints.filter(c => c.id !== constraintId) };
  return solveConstraints(updated);
}

export function updateConstraintValue(sketch: Sketch, constraintId: string, value: number): Sketch {
  const updated = {
    ...sketch,
    constraints: sketch.constraints.map(c => c.id === constraintId ? { ...c, value } : c),
  };
  return solveConstraints(updated);
}

export function toggleDriven(sketch: Sketch, constraintId: string): Sketch {
  return {
    ...sketch,
    constraints: sketch.constraints.map(c => c.id === constraintId ? { ...c, driven: !c.driven } : c),
  };
}

// ═══ CONSTRAINT SOLVER ═══
// Solveur itératif simple (Gauss-Seidel) — suffisant pour les cas tôlerie

const SOLVER_MAX_ITER = 100;
const SOLVER_TOLERANCE = 0.01; // mm

export function solveConstraints(sketch: Sketch): Sketch {
  let points = sketch.points.map(p => ({ ...p }));
  const lines = sketch.lines;
  const circles = sketch.circles.map(c => ({ ...c }));
  const constraints = sketch.constraints.filter(c => !c.driven);

  const getPoint = (id: string) => points.find(p => p.id === id);
  const getLine = (id: string) => lines.find(l => l.id === id);

  for (let iter = 0; iter < SOLVER_MAX_ITER; iter++) {
    let maxError = 0;

    for (const c of constraints) {
      switch (c.type) {
        case 'fix': {
          const pt = getPoint(c.entityIds[0]);
          if (pt) pt.fixed = true;
          break;
        }

        case 'horizontal': {
          const line = getLine(c.entityIds[0]);
          if (!line) break;
          const p1 = getPoint(line.startId);
          const p2 = getPoint(line.endId);
          if (!p1 || !p2) break;
          const avgY = (p1.y + p2.y) / 2;
          const err = Math.abs(p1.y - p2.y);
          if (!p1.fixed) p1.y = avgY;
          if (!p2.fixed) p2.y = avgY;
          maxError = Math.max(maxError, err);
          break;
        }

        case 'vertical': {
          const line = getLine(c.entityIds[0]);
          if (!line) break;
          const p1 = getPoint(line.startId);
          const p2 = getPoint(line.endId);
          if (!p1 || !p2) break;
          const avgX = (p1.x + p2.x) / 2;
          const err = Math.abs(p1.x - p2.x);
          if (!p1.fixed) p1.x = avgX;
          if (!p2.fixed) p2.x = avgX;
          maxError = Math.max(maxError, err);
          break;
        }

        case 'coincident': {
          const p1 = getPoint(c.entityIds[0]);
          const p2 = getPoint(c.entityIds[1]);
          if (!p1 || !p2) break;
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const err = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (!p1.fixed) { p1.x = mx; p1.y = my; }
          if (!p2.fixed) { p2.x = mx; p2.y = my; }
          maxError = Math.max(maxError, err);
          break;
        }

        case 'perpendicular': {
          const l1 = getLine(c.entityIds[0]);
          const l2 = getLine(c.entityIds[1]);
          if (!l1 || !l2) break;
          const p1s = getPoint(l1.startId), p1e = getPoint(l1.endId);
          const p2s = getPoint(l2.startId), p2e = getPoint(l2.endId);
          if (!p1s || !p1e || !p2s || !p2e) break;
          const dx1 = p1e.x - p1s.x, dy1 = p1e.y - p1s.y;
          const dx2 = p2e.x - p2s.x, dy2 = p2e.y - p2s.y;
          const dot = dx1 * dx2 + dy1 * dy2;
          maxError = Math.max(maxError, Math.abs(dot));
          // Ajuster l2 pour être perpendiculaire
          if (Math.abs(dot) > SOLVER_TOLERANCE && !p2e.fixed) {
            const angle1 = Math.atan2(dy1, dx1);
            const len2 = Math.hypot(dx2, dy2);
            const targetAngle = angle1 + Math.PI / 2;
            p2e.x = p2s.x + Math.cos(targetAngle) * len2;
            p2e.y = p2s.y + Math.sin(targetAngle) * len2;
          }
          break;
        }

        case 'parallel': {
          const l1 = getLine(c.entityIds[0]);
          const l2 = getLine(c.entityIds[1]);
          if (!l1 || !l2) break;
          const p1s = getPoint(l1.startId), p1e = getPoint(l1.endId);
          const p2s = getPoint(l2.startId), p2e = getPoint(l2.endId);
          if (!p1s || !p1e || !p2s || !p2e) break;
          const angle1 = Math.atan2(p1e.y - p1s.y, p1e.x - p1s.x);
          const len2 = Math.hypot(p2e.x - p2s.x, p2e.y - p2s.y);
          if (!p2e.fixed) {
            p2e.x = p2s.x + Math.cos(angle1) * len2;
            p2e.y = p2s.y + Math.sin(angle1) * len2;
          }
          break;
        }

        case 'equal_length': {
          const l1 = getLine(c.entityIds[0]);
          const l2 = getLine(c.entityIds[1]);
          if (!l1 || !l2) break;
          const p1s = getPoint(l1.startId), p1e = getPoint(l1.endId);
          const p2s = getPoint(l2.startId), p2e = getPoint(l2.endId);
          if (!p1s || !p1e || !p2s || !p2e) break;
          const len1 = Math.hypot(p1e.x - p1s.x, p1e.y - p1s.y);
          const len2 = Math.hypot(p2e.x - p2s.x, p2e.y - p2s.y);
          const err = Math.abs(len1 - len2);
          if (err > SOLVER_TOLERANCE && !p2e.fixed) {
            const angle2 = Math.atan2(p2e.y - p2s.y, p2e.x - p2s.x);
            p2e.x = p2s.x + Math.cos(angle2) * len1;
            p2e.y = p2s.y + Math.sin(angle2) * len1;
          }
          maxError = Math.max(maxError, err);
          break;
        }

        case 'midpoint': {
          const pt = getPoint(c.entityIds[0]);
          const line = getLine(c.entityIds[1]);
          if (!pt || !line) break;
          const ps = getPoint(line.startId), pe = getPoint(line.endId);
          if (!ps || !pe) break;
          const mx = (ps.x + pe.x) / 2, my = (ps.y + pe.y) / 2;
          const err = Math.hypot(pt.x - mx, pt.y - my);
          if (!pt.fixed) { pt.x = mx; pt.y = my; }
          maxError = Math.max(maxError, err);
          break;
        }

        case 'dimension_h': {
          const line = getLine(c.entityIds[0]);
          if (!line || c.value === undefined) break;
          const ps = getPoint(line.startId), pe = getPoint(line.endId);
          if (!ps || !pe) break;
          const currentW = Math.abs(pe.x - ps.x);
          const err = Math.abs(currentW - c.value);
          if (err > SOLVER_TOLERANCE && !pe.fixed) {
            pe.x = ps.x + (pe.x >= ps.x ? c.value : -c.value);
          }
          maxError = Math.max(maxError, err);
          break;
        }

        case 'dimension_v': {
          const line = getLine(c.entityIds[0]);
          if (!line || c.value === undefined) break;
          const ps = getPoint(line.startId), pe = getPoint(line.endId);
          if (!ps || !pe) break;
          const currentH = Math.abs(pe.y - ps.y);
          const err = Math.abs(currentH - c.value);
          if (err > SOLVER_TOLERANCE && !pe.fixed) {
            pe.y = ps.y + (pe.y >= ps.y ? c.value : -c.value);
          }
          maxError = Math.max(maxError, err);
          break;
        }

        case 'dimension_d': {
          if (c.entityIds.length >= 2 && c.value !== undefined) {
            const p1 = getPoint(c.entityIds[0]);
            const p2 = getPoint(c.entityIds[1]);
            if (!p1 || !p2) break;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const err = Math.abs(dist - c.value);
            if (err > SOLVER_TOLERANCE && !p2.fixed && dist > 0) {
              const scale = c.value / dist;
              p2.x = p1.x + (p2.x - p1.x) * scale;
              p2.y = p1.y + (p2.y - p1.y) * scale;
            }
            maxError = Math.max(maxError, err);
          }
          break;
        }

        case 'dimension_angle': {
          const l1 = getLine(c.entityIds[0]);
          if (!l1 || c.value === undefined) break;
          const ps = getPoint(l1.startId), pe = getPoint(l1.endId);
          if (!ps || !pe) break;
          const targetRad = (c.value * Math.PI) / 180;
          const len = Math.hypot(pe.x - ps.x, pe.y - ps.y);
          if (!pe.fixed) {
            pe.x = ps.x + Math.cos(targetRad) * len;
            pe.y = ps.y + Math.sin(targetRad) * len;
          }
          break;
        }

        case 'dimension_radius': {
          const circle = circles.find(cc => cc.id === c.entityIds[0]);
          if (circle && c.value !== undefined) {
            circle.radius = c.value;
          }
          break;
        }

        case 'symmetric': {
          // p1 et p2 symétriques par rapport à la ligne
          const p1 = getPoint(c.entityIds[0]);
          const p2 = getPoint(c.entityIds[1]);
          const axis = getLine(c.entityIds[2]);
          if (!p1 || !p2 || !axis) break;
          const as = getPoint(axis.startId), ae = getPoint(axis.endId);
          if (!as || !ae) break;
          // Projeter p1 sur l'axe et calculer le symétrique
          const dx = ae.x - as.x, dy = ae.y - as.y;
          const len2 = dx * dx + dy * dy;
          if (len2 === 0) break;
          const t = ((p1.x - as.x) * dx + (p1.y - as.y) * dy) / len2;
          const projX = as.x + t * dx, projY = as.y + t * dy;
          if (!p2.fixed) {
            p2.x = 2 * projX - p1.x;
            p2.y = 2 * projY - p1.y;
          }
          break;
        }
      }
    }

    // Mettre à jour le statut des contraintes
    sketch.constraints.forEach(c => {
      c.satisfied = checkConstraintSatisfied(c, points, lines, circles);
    });

    if (maxError < SOLVER_TOLERANCE) break;
  }

  // Analyser sous/sur-contrainte
  const freePoints = points.filter(p => !p.fixed && !isFullyConstrained(p.id, sketch.constraints, lines));
  const conflicting = sketch.constraints.filter(c => !c.driven && !c.satisfied);

  return {
    ...sketch,
    points,
    circles,
    fullyConstrained: freePoints.length === 0 && conflicting.length === 0,
    underConstrained: freePoints.map(p => p.id),
    overConstrained: conflicting.map(c => c.id),
  };
}

function checkConstraintSatisfied(c: SketchConstraint, points: SketchPoint[], lines: SketchLine[], circles: SketchCircle[]): boolean {
  const getP = (id: string) => points.find(p => p.id === id);
  const getL = (id: string) => lines.find(l => l.id === id);
  const TOL = 0.1;

  switch (c.type) {
    case 'horizontal': {
      const l = getL(c.entityIds[0]); if (!l) return false;
      const s = getP(l.startId), e = getP(l.endId); if (!s || !e) return false;
      return Math.abs(s.y - e.y) < TOL;
    }
    case 'vertical': {
      const l = getL(c.entityIds[0]); if (!l) return false;
      const s = getP(l.startId), e = getP(l.endId); if (!s || !e) return false;
      return Math.abs(s.x - e.x) < TOL;
    }
    case 'coincident': {
      const p1 = getP(c.entityIds[0]), p2 = getP(c.entityIds[1]); if (!p1 || !p2) return false;
      return Math.hypot(p1.x - p2.x, p1.y - p2.y) < TOL;
    }
    case 'dimension_h': {
      const l = getL(c.entityIds[0]); if (!l || !c.value) return false;
      const s = getP(l.startId), e = getP(l.endId); if (!s || !e) return false;
      return Math.abs(Math.abs(e.x - s.x) - c.value) < TOL;
    }
    case 'dimension_v': {
      const l = getL(c.entityIds[0]); if (!l || !c.value) return false;
      const s = getP(l.startId), e = getP(l.endId); if (!s || !e) return false;
      return Math.abs(Math.abs(e.y - s.y) - c.value) < TOL;
    }
    default: return true;
  }
}

function isFullyConstrained(pointId: string, constraints: SketchConstraint[], lines: SketchLine[]): boolean {
  // Un point est contraint s'il est référencé par au moins 2 contraintes dimensionnelles ou géométriques
  let constraintCount = 0;
  for (const c of constraints) {
    if (c.driven) continue;
    if (c.entityIds.includes(pointId)) constraintCount++;
    // Contraintes sur les lignes qui touchent ce point
    for (const eid of c.entityIds) {
      const line = lines.find(l => l.id === eid);
      if (line && (line.startId === pointId || line.endId === pointId)) constraintCount++;
    }
  }
  return constraintCount >= 2;
}

// ═══ SMART DIMENSION DETECTION ═══

export type SmartDimTarget =
  | { type: 'line_h'; lineId: string }
  | { type: 'line_v'; lineId: string }
  | { type: 'point_point'; p1Id: string; p2Id: string }
  | { type: 'line_angle'; lineId: string }
  | { type: 'circle_radius'; circleId: string };

/** Détecter automatiquement le type de cote à appliquer */
export function detectSmartDimension(sketch: Sketch, entityIds: string[]): SmartDimTarget | null {
  if (entityIds.length === 1) {
    const line = sketch.lines.find(l => l.id === entityIds[0]);
    if (line) {
      const s = sketch.points.find(p => p.id === line.startId);
      const e = sketch.points.find(p => p.id === line.endId);
      if (s && e) {
        if (Math.abs(s.y - e.y) < 1) return { type: 'line_h', lineId: line.id };
        if (Math.abs(s.x - e.x) < 1) return { type: 'line_v', lineId: line.id };
        return { type: 'line_angle', lineId: line.id };
      }
    }
    const circle = sketch.circles.find(c => c.id === entityIds[0]);
    if (circle) return { type: 'circle_radius', circleId: circle.id };
  }
  if (entityIds.length === 2) {
    const p1 = sketch.points.find(p => p.id === entityIds[0]);
    const p2 = sketch.points.find(p => p.id === entityIds[1]);
    if (p1 && p2) return { type: 'point_point', p1Id: p1.id, p2Id: p2.id };
  }
  return null;
}

/** Appliquer une smart dimension détectée */
export function applySmartDimension(sketch: Sketch, target: SmartDimTarget, value: number): Sketch {
  switch (target.type) {
    case 'line_h':
      return addConstraint(sketch, 'dimension_h', [target.lineId], value);
    case 'line_v':
      return addConstraint(sketch, 'dimension_v', [target.lineId], value);
    case 'point_point':
      return addConstraint(sketch, 'dimension_d', [target.p1Id, target.p2Id], value);
    case 'line_angle':
      return addConstraint(sketch, 'dimension_angle', [target.lineId], value);
    case 'circle_radius':
      return addConstraint(sketch, 'dimension_radius', [target.circleId], value);
  }
}

// ═══ SKETCH → PIECE CONVERSION ═══

/** Convertir le contour du sketch en PieceConfig (bounding box + features) */
export function sketchToPieceDimensions(sketch: Sketch): { largeur: number; hauteur: number } {
  if (sketch.points.length === 0) return { largeur: 100, hauteur: 50 };
  const xs = sketch.points.filter(p => !p.construction).map(p => p.x);
  const ys = sketch.points.filter(p => !p.construction).map(p => p.y);
  return {
    largeur: Math.max(...xs) - Math.min(...xs),
    hauteur: Math.max(...ys) - Math.min(...ys),
  };
}

/** Extraire les lignes verticales du sketch comme positions de pli potentielles */
export function sketchToBendPositions(sketch: Sketch): number[] {
  const positions: number[] = [];
  const minX = Math.min(...sketch.points.filter(p => !p.construction).map(p => p.x));

  for (const line of sketch.lines) {
    if (line.construction) continue;
    const s = sketch.points.find(p => p.id === line.startId);
    const e = sketch.points.find(p => p.id === line.endId);
    if (!s || !e) continue;
    // Ligne verticale intérieure = pli potentiel
    if (Math.abs(s.x - e.x) < 1 && s.x > minX + 1) {
      positions.push(s.x - minX);
    }
  }
  return positions;
}

// ═══ SKETCH SVG RENDERING HELPERS ═══

export interface SketchRenderOptions {
  showConstruction: boolean;
  showConstraints: boolean;
  showDimensions: boolean;
  highlightUnderConstrained: boolean;
  selectedEntityId: string | null;
}

export function getLineGeometry(sketch: Sketch, lineId: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const line = sketch.lines.find(l => l.id === lineId);
  if (!line) return null;
  const s = sketch.points.find(p => p.id === line.startId);
  const e = sketch.points.find(p => p.id === line.endId);
  if (!s || !e) return null;
  return { x1: s.x, y1: s.y, x2: e.x, y2: e.y };
}

export function getLineLength(sketch: Sketch, lineId: string): number {
  const g = getLineGeometry(sketch, lineId);
  if (!g) return 0;
  return Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
}

export function getLineAngle(sketch: Sketch, lineId: string): number {
  const g = getLineGeometry(sketch, lineId);
  if (!g) return 0;
  return (Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180) / Math.PI;
}

/** Snap un point à la grille ou aux points existants */
export function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

export function snapToPoint(x: number, y: number, sketch: Sketch, threshold = 5): SketchPoint | null {
  for (const p of sketch.points) {
    if (Math.hypot(p.x - x, p.y - y) < threshold) return p;
  }
  return null;
}

/** Trouver le point/ligne le plus proche du curseur */
export function hitTest(sketch: Sketch, x: number, y: number, threshold = 5): { type: 'point' | 'line' | 'circle'; id: string } | null {
  // Points en priorité
  for (const p of sketch.points) {
    if (Math.hypot(p.x - x, p.y - y) < threshold) {
      return { type: 'point', id: p.id };
    }
  }
  // Lignes
  for (const l of sketch.lines) {
    const s = sketch.points.find(p => p.id === l.startId);
    const e = sketch.points.find(p => p.id === l.endId);
    if (!s || !e) continue;
    const dist = distPointToSegment(x, y, s.x, s.y, e.x, e.y);
    if (dist < threshold) return { type: 'line', id: l.id };
  }
  // Cercles
  for (const c of sketch.circles) {
    const center = sketch.points.find(p => p.id === c.centerId);
    if (!center) continue;
    const dist = Math.abs(Math.hypot(x - center.x, y - center.y) - c.radius);
    if (dist < threshold) return { type: 'circle', id: c.id };
  }
  return null;
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
