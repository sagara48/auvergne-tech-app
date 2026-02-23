// ═══════════════════════════════════════════════════════════════
// FEATURE TREE ENGINE — Historique paramétrique à la Fusion 360
// Chaque opération = nœud éditable, réordonnement, rollback
// ═══════════════════════════════════════════════════════════════

import { PieceConfig, Pli, Trou, Encoche, Chanfrein, Marquage, uid } from './tolerie';

// ═══ TYPES ═══

export type FeatureType =
  | 'base_shape'      // Forme de base (rectangle, L, U, Z, T)
  | 'dimension'        // Changement de dimensions
  | 'material'         // Changement matière/épaisseur
  | 'bend'             // Pli
  | 'flange'           // Rebord (ajout aile sur arête)
  | 'hem'              // Ourlet (pli 180°)
  | 'hole'             // Perçage
  | 'hole_pattern'     // Gabarit de perçage
  | 'cutout'           // Encoche / découpe
  | 'corner_relief'    // Dégagement de coin
  | 'tab_slot'         // Languette + fente
  | 'chamfer'          // Chanfrein / rayon
  | 'marking'          // Marquage / gravure
  | 'mirror'           // Symétrie
  | 'pattern'          // Répétition linéaire/circulaire
  | 'custom';          // Opération libre

export interface FeatureParams {
  [key: string]: any;
}

export interface FeatureNode {
  id: string;
  type: FeatureType;
  label: string;
  icon: string;           // Emoji pour l'arbre
  params: FeatureParams;
  enabled: boolean;       // Suppression logique (désactivé = grisé)
  locked: boolean;        // Verrouillé = non-éditable
  timestamp: string;
  children?: string[];    // IDs de features dépendantes
}

export interface FeatureTree {
  nodes: FeatureNode[];
  rollbackIndex: number;  // -1 = tout montrer, sinon index du dernier nœud visible
  activeNodeId: string | null; // Nœud en cours d'édition
}

// ═══ PARAMETRIC VARIABLES ═══

export interface ParamVariable {
  id: string;
  name: string;           // Ex: "largeur_rail", "entraxe"
  value: number;
  expression?: string;    // Ex: "largeur / 2", "entraxe_base + 10"
  unit: string;           // mm, °, kg...
  description?: string;
  linkedFeatures: string[]; // IDs des features qui utilisent cette variable
}

export interface ParamContext {
  variables: ParamVariable[];
  // Variables système auto-calculées
  computed: Record<string, number>;
}

// ═══ FEATURE NODE FACTORIES ═══

export function createFeatureNode(type: FeatureType, params: FeatureParams, label?: string): FeatureNode {
  const icons: Record<FeatureType, string> = {
    base_shape: '📐', dimension: '📏', material: '🧱',
    bend: '🔄', flange: '🔲', hem: '↩️',
    hole: '⭕', hole_pattern: '🔘', cutout: '✂️',
    corner_relief: '🔧', tab_slot: '🔗', chamfer: '◇',
    marking: '✏️', mirror: '🪞', pattern: '🔁', custom: '⚙️',
  };

  const autoLabel = label || generateLabel(type, params);

  return {
    id: uid(),
    type,
    label: autoLabel,
    icon: icons[type] || '⚙️',
    params: { ...params },
    enabled: true,
    locked: false,
    timestamp: new Date().toISOString(),
  };
}

function generateLabel(type: FeatureType, params: FeatureParams): string {
  switch (type) {
    case 'base_shape': return `Forme ${params.formeBase || 'rectangle'}`;
    case 'dimension': return `Dim ${params.largeur || '?'}×${params.hauteur || '?'}`;
    case 'material': return `${params.matiere || '?'} ép.${params.epaisseur || '?'}`;
    case 'bend': return `Pli ${params.angle || 90}° @${params.position || 0}mm`;
    case 'flange': return `Rebord ${params.longueur || '?'}mm ${params.angle || 90}°`;
    case 'hem': return `Ourlet ${params.edge || '?'} ${params.hemType || 'fermé'}`;
    case 'hole': return `∅${params.diametre || '?'} ${params.type || 'rond'}`;
    case 'hole_pattern': return `Gabarit ${params.count || '?'}×∅${params.diametre || '?'}`;
    case 'cutout': return `Encoche ${params.largeur || '?'}×${params.hauteur || '?'}`;
    case 'corner_relief': return `Dégagement coins (${params.reliefType || 'rond'})`;
    case 'tab_slot': return `Tab/Slot ${params.tabWidth || '?'}×${params.tabHeight || '?'}`;
    case 'chamfer': return `Chanfrein ${params.coin || '?'} ${params.valeur || '?'}mm`;
    case 'marking': return `Marquage "${(params.texte || '').slice(0, 15)}"`;
    case 'mirror': return `Miroir ${params.axis || 'H'}`;
    case 'pattern': return `Motif ${params.count || '?'}× ${params.direction || 'lin'}`;
    case 'custom': return params.label || 'Opération custom';
    default: return type;
  }
}

// ═══ FEATURE TREE OPERATIONS ═══

export function createEmptyTree(): FeatureTree {
  return { nodes: [], rollbackIndex: -1, activeNodeId: null };
}

export function addFeature(tree: FeatureTree, node: FeatureNode): FeatureTree {
  // Si rollback actif, tronquer l'arbre au rollback point
  const effectiveNodes = tree.rollbackIndex >= 0
    ? tree.nodes.slice(0, tree.rollbackIndex + 1)
    : [...tree.nodes];

  return {
    ...tree,
    nodes: [...effectiveNodes, node],
    rollbackIndex: -1, // Reset rollback
    activeNodeId: null,
  };
}

export function removeFeature(tree: FeatureTree, nodeId: string): FeatureTree {
  return {
    ...tree,
    nodes: tree.nodes.filter(n => n.id !== nodeId),
  };
}

export function toggleFeature(tree: FeatureTree, nodeId: string): FeatureTree {
  return {
    ...tree,
    nodes: tree.nodes.map(n => n.id === nodeId ? { ...n, enabled: !n.enabled } : n),
  };
}

export function updateFeatureParams(tree: FeatureTree, nodeId: string, params: Partial<FeatureParams>): FeatureTree {
  return {
    ...tree,
    nodes: tree.nodes.map(n => n.id === nodeId ? { ...n, params: { ...n.params, ...params }, label: generateLabel(n.type, { ...n.params, ...params }) } : n),
  };
}

export function reorderFeature(tree: FeatureTree, nodeId: string, newIndex: number): FeatureTree {
  const idx = tree.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1 || newIndex === idx) return tree;
  const nodes = [...tree.nodes];
  const [node] = nodes.splice(idx, 1);
  nodes.splice(newIndex, 0, node);
  return { ...tree, nodes };
}

export function setRollback(tree: FeatureTree, index: number): FeatureTree {
  return { ...tree, rollbackIndex: index };
}

export function setActiveNode(tree: FeatureTree, nodeId: string | null): FeatureTree {
  return { ...tree, activeNodeId: nodeId };
}

// ═══ REPLAY: Feature Tree → PieceConfig ═══
// Reconstruit la pièce en rejouant chaque opération activée

export function replayTree(tree: FeatureTree, basePiece: PieceConfig): PieceConfig {
  let piece = { ...basePiece, plis: [], trous: [], encoches: [], chanfreins: [], marquages: [] as any[] };

  const maxIndex = tree.rollbackIndex >= 0 ? tree.rollbackIndex : tree.nodes.length - 1;

  for (let i = 0; i <= maxIndex && i < tree.nodes.length; i++) {
    const node = tree.nodes[i];
    if (!node.enabled) continue;
    piece = applyFeature(piece, node);
  }

  return piece;
}

function applyFeature(piece: PieceConfig, node: FeatureNode): PieceConfig {
  const p = node.params;

  switch (node.type) {
    case 'base_shape':
      return { ...piece, formeBase: p.formeBase || 'rectangle', brancheL: p.brancheL, profondeurU: p.profondeurU, decalageZ: p.decalageZ };

    case 'dimension':
      return { ...piece, largeur: p.largeur ?? piece.largeur, hauteur: p.hauteur ?? piece.hauteur };

    case 'material':
      return { ...piece, matiere: p.matiere ?? piece.matiere, epaisseur: p.epaisseur ?? piece.epaisseur, finition: p.finition ?? piece.finition };

    case 'bend': {
      const pli: Pli = { id: p.id || uid(), position: p.position, angle: p.angle ?? 90, rayonInterne: p.rayonInterne ?? piece.epaisseur, direction: p.direction ?? 'haut' };
      return { ...piece, plis: [...piece.plis, pli] };
    }

    case 'flange': {
      // Flange = pli + extension de dimension
      const edge = p.edge as 'haut' | 'bas' | 'gauche' | 'droite';
      const pli: Pli = {
        id: p.id || uid(),
        position: edge === 'gauche' ? p.longueur : edge === 'droite' ? piece.largeur - p.longueur : piece.largeur / 2,
        angle: p.angle ?? 90,
        rayonInterne: p.rayonInterne ?? piece.epaisseur,
        direction: (edge === 'haut' || edge === 'gauche') ? 'haut' : 'bas',
      };
      return { ...piece, plis: [...piece.plis, pli], formeBase: 'custom' };
    }

    case 'hem': {
      // Ourlet = pli 180° au bord
      const hemEdge = p.edge as 'haut' | 'bas' | 'gauche' | 'droite';
      const hemType = p.hemType || 'closed'; // closed, open, teardrop
      const hemGap = hemType === 'open' ? (p.gap ?? piece.epaisseur) : 0;
      const pli: Pli = {
        id: p.id || uid(),
        position: hemEdge === 'gauche' ? p.depth || piece.epaisseur * 3 : hemEdge === 'droite' ? piece.largeur - (p.depth || piece.epaisseur * 3) : piece.largeur / 2,
        angle: 180,
        rayonInterne: hemGap > 0 ? hemGap : piece.epaisseur * 0.5,
        direction: (hemEdge === 'haut' || hemEdge === 'gauche') ? 'haut' : 'bas',
      };
      return { ...piece, plis: [...piece.plis, pli], formeBase: 'custom' };
    }

    case 'hole': {
      const trou: Trou = { id: p.id || uid(), x: p.x, y: p.y, type: p.type || 'rond', diametre: p.diametre, longueurOblong: p.longueurOblong, angleOblong: p.angleOblong, profondeur: p.profondeur, taraudage: p.taraudage };
      return { ...piece, trous: [...piece.trous, trou] };
    }

    case 'hole_pattern': {
      const trous: Trou[] = [];
      const cx = p.cx ?? piece.largeur / 2, cy = p.cy ?? piece.hauteur / 2;
      const rows = p.rows || 1, cols = p.cols || 1;
      const spacingX = p.spacingX || 50, spacingY = p.spacingY || 50;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          trous.push({
            id: uid(), x: cx - ((cols - 1) * spacingX) / 2 + c * spacingX,
            y: cy - ((rows - 1) * spacingY) / 2 + r * spacingY,
            type: p.type || 'rond', diametre: p.diametre || 10,
          });
        }
      }
      return { ...piece, trous: [...piece.trous, ...trous] };
    }

    case 'cutout': {
      const enc: Encoche = { id: p.id || uid(), x: p.x, y: p.y, largeur: p.largeur, hauteur: p.hauteur, cote: p.cote || 'haut' };
      return { ...piece, encoches: [...piece.encoches, enc] };
    }

    case 'corner_relief': {
      // Auto corner relief: ajouter des encoches aux intersections de plis
      const reliefType = p.reliefType || 'round'; // round, square, vnotch
      const reliefSize = p.reliefSize || piece.epaisseur * 2;
      const reliefs: Encoche[] = [];

      // Pour chaque pli, ajouter un dégagement en haut et en bas
      piece.plis.forEach(pli => {
        if (reliefType === 'round') {
          reliefs.push({ id: uid(), x: pli.position - reliefSize / 2, y: -reliefSize / 2, largeur: reliefSize, hauteur: reliefSize, cote: 'haut' });
          reliefs.push({ id: uid(), x: pli.position - reliefSize / 2, y: piece.hauteur - reliefSize / 2, largeur: reliefSize, hauteur: reliefSize, cote: 'bas' });
        } else {
          reliefs.push({ id: uid(), x: pli.position - reliefSize / 2, y: 0, largeur: reliefSize, hauteur: reliefSize, cote: 'haut' });
          reliefs.push({ id: uid(), x: pli.position - reliefSize / 2, y: piece.hauteur - reliefSize, largeur: reliefSize, hauteur: reliefSize, cote: 'bas' });
        }
      });

      return { ...piece, encoches: [...piece.encoches, ...reliefs] };
    }

    case 'tab_slot': {
      // Tab = languette qui dépasse, Slot = fente pour recevoir la languette
      const tabW = p.tabWidth || 15;
      const tabH = p.tabHeight || piece.epaisseur;
      const tabEdge = p.edge as 'haut' | 'bas' | 'gauche' | 'droite';
      const tabCount = p.count || 3;
      const spacing = (tabEdge === 'haut' || tabEdge === 'bas')
        ? piece.largeur / (tabCount + 1)
        : piece.hauteur / (tabCount + 1);

      // Ajouter des encoches inverses (les espaces entre les tabs)
      const encoches: Encoche[] = [];
      for (let i = 0; i < tabCount; i++) {
        const pos = spacing * (i + 1);
        if (tabEdge === 'haut' || tabEdge === 'bas') {
          encoches.push({ id: uid(), x: pos - tabW / 2, y: tabEdge === 'haut' ? 0 : piece.hauteur - tabH, largeur: tabW, hauteur: tabH, cote: tabEdge });
        } else {
          encoches.push({ id: uid(), x: tabEdge === 'gauche' ? 0 : piece.largeur - tabH, y: pos - tabW / 2, largeur: tabH, hauteur: tabW, cote: tabEdge });
        }
      }
      return { ...piece, encoches: [...piece.encoches, ...encoches] };
    }

    case 'chamfer': {
      const ch: Chanfrein = { coin: p.coin, type: p.type || 'chanfrein', valeur: p.valeur };
      return { ...piece, chanfreins: [...piece.chanfreins.filter(c => c.coin !== p.coin), ch] };
    }

    case 'marking': {
      const m: Marquage = { id: p.id || uid(), x: p.x, y: p.y, texte: p.texte, taille: p.taille || 5, type: p.markType || 'gravure' };
      return { ...piece, marquages: [...piece.marquages, m] };
    }

    case 'mirror': {
      if (p.axis === 'H') {
        const mirrored = piece.trous.map(t => ({ ...t, id: uid(), y: piece.hauteur - t.y }));
        return { ...piece, trous: [...piece.trous, ...mirrored] };
      } else {
        const mirrored = piece.trous.map(t => ({ ...t, id: uid(), x: piece.largeur - t.x }));
        return { ...piece, trous: [...piece.trous, ...mirrored] };
      }
    }

    case 'pattern': {
      // Répétition linéaire d'un ensemble
      const count = p.count || 2;
      const dx = p.dx || 0, dy = p.dy || 0;
      const newTrous: Trou[] = [];
      const sourceTrous = piece.trous.filter(t => p.sourceIds?.includes(t.id));
      for (let i = 1; i < count; i++) {
        sourceTrous.forEach(t => {
          newTrous.push({ ...t, id: uid(), x: t.x + dx * i, y: t.y + dy * i });
        });
      }
      return { ...piece, trous: [...piece.trous, ...newTrous] };
    }

    default:
      return piece;
  }
}

// ═══ TREE ↔ PIECE SYNC ═══

/** Créer un arbre initial depuis une PieceConfig existante */
export function treeFromPiece(piece: PieceConfig): FeatureTree {
  const nodes: FeatureNode[] = [];

  // 1. Matière
  nodes.push(createFeatureNode('material', {
    matiere: piece.matiere, epaisseur: piece.epaisseur, finition: piece.finition,
  }));

  // 2. Forme de base
  nodes.push(createFeatureNode('base_shape', {
    formeBase: piece.formeBase, brancheL: piece.brancheL,
    profondeurU: piece.profondeurU, decalageZ: piece.decalageZ,
  }));

  // 3. Dimensions
  nodes.push(createFeatureNode('dimension', {
    largeur: piece.largeur, hauteur: piece.hauteur,
  }));

  // 4. Plis
  piece.plis.forEach(pli => {
    nodes.push(createFeatureNode('bend', {
      id: pli.id, position: pli.position, angle: pli.angle,
      rayonInterne: pli.rayonInterne, direction: pli.direction,
    }));
  });

  // 5. Trous
  piece.trous.forEach(trou => {
    nodes.push(createFeatureNode('hole', { ...trou }));
  });

  // 6. Encoches
  piece.encoches.forEach(enc => {
    nodes.push(createFeatureNode('cutout', { ...enc }));
  });

  // 7. Chanfreins
  piece.chanfreins.forEach(ch => {
    nodes.push(createFeatureNode('chamfer', { ...ch }));
  });

  // 8. Marquages
  piece.marquages.forEach(m => {
    nodes.push(createFeatureNode('marking', { ...m }));
  });

  return { nodes, rollbackIndex: -1, activeNodeId: null };
}

// ═══ PARAMETRIC VARIABLES ENGINE ═══

export function createParamContext(): ParamContext {
  return { variables: [], computed: {} };
}

export function addVariable(ctx: ParamContext, name: string, value: number, unit = 'mm', description = ''): ParamContext {
  // Vérifier unicité
  if (ctx.variables.some(v => v.name === name)) {
    return updateVariable(ctx, name, value);
  }
  return {
    ...ctx,
    variables: [...ctx.variables, { id: uid(), name, value, unit, description, linkedFeatures: [] }],
  };
}

export function updateVariable(ctx: ParamContext, name: string, value: number): ParamContext {
  return {
    ...ctx,
    variables: ctx.variables.map(v => v.name === name ? { ...v, value } : v),
  };
}

export function removeVariable(ctx: ParamContext, name: string): ParamContext {
  return {
    ...ctx,
    variables: ctx.variables.filter(v => v.name !== name),
  };
}

/** Évaluer une expression paramétrique. Ex: "largeur / 2 + 10" */
export function evalExpression(expr: string, ctx: ParamContext): number | null {
  try {
    // Construire le scope de variables
    const scope: Record<string, number> = { ...ctx.computed };
    ctx.variables.forEach(v => { scope[v.name] = v.value; });

    // Sanitize: uniquement chiffres, opérateurs, noms de variables, parenthèses
    const sanitized = expr.replace(/[^a-zA-Z0-9_+\-*/().,%\s]/g, '');

    // Remplacer les noms de variables par leurs valeurs
    let evaluated = sanitized;
    Object.entries(scope).sort((a, b) => b[0].length - a[0].length).forEach(([name, val]) => {
      evaluated = evaluated.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    });

    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${evaluated})`)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Recalculer toutes les variables avec expressions */
export function resolveAllVariables(ctx: ParamContext): ParamContext {
  const resolved = { ...ctx };
  // Itérer plusieurs fois pour résoudre les dépendances circulaires (max 5 passes)
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    resolved.variables = resolved.variables.map(v => {
      if (v.expression) {
        const val = evalExpression(v.expression, resolved);
        if (val !== null && val !== v.value) {
          changed = true;
          return { ...v, value: val };
        }
      }
      return v;
    });
    if (!changed) break;
  }
  return resolved;
}

/** Lier une variable à une feature */
export function linkVariableToFeature(ctx: ParamContext, varName: string, featureId: string): ParamContext {
  return {
    ...ctx,
    variables: ctx.variables.map(v =>
      v.name === varName
        ? { ...v, linkedFeatures: [...new Set([...v.linkedFeatures, featureId])] }
        : v
    ),
  };
}

// ═══ HELPERS ═══

export function getVisibleNodes(tree: FeatureTree): FeatureNode[] {
  if (tree.rollbackIndex >= 0) {
    return tree.nodes.slice(0, tree.rollbackIndex + 1);
  }
  return tree.nodes;
}

export function getEnabledNodes(tree: FeatureTree): FeatureNode[] {
  return getVisibleNodes(tree).filter(n => n.enabled);
}

export function getNodeById(tree: FeatureTree, id: string): FeatureNode | undefined {
  return tree.nodes.find(n => n.id === id);
}

export function getNodeIndex(tree: FeatureTree, id: string): number {
  return tree.nodes.findIndex(n => n.id === id);
}

export function canMoveUp(tree: FeatureTree, id: string): boolean {
  const idx = getNodeIndex(tree, id);
  return idx > 0;
}

export function canMoveDown(tree: FeatureTree, id: string): boolean {
  const idx = getNodeIndex(tree, id);
  return idx >= 0 && idx < tree.nodes.length - 1;
}

export function moveUp(tree: FeatureTree, id: string): FeatureTree {
  const idx = getNodeIndex(tree, id);
  if (idx <= 0) return tree;
  return reorderFeature(tree, id, idx - 1);
}

export function moveDown(tree: FeatureTree, id: string): FeatureTree {
  const idx = getNodeIndex(tree, id);
  if (idx < 0 || idx >= tree.nodes.length - 1) return tree;
  return reorderFeature(tree, id, idx + 1);
}
