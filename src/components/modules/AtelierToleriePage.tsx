// ═══════════════════════════════════════════════════════════════
// ATELIER TÔLERIE V6 — Fusion 360 Style
// V6: Feature Tree paramétrique, Sketcher 2D contraint,
//     Split View fold/unfold, Flange/Hem/Tab-Slot tools,
//     Corner Relief auto, Smart Dimensions, Parametric vars
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Ruler, Circle, FoldVertical, FileDown, Plus, Trash2,
  ChevronRight, ChevronLeft, ZoomIn, ZoomOut, Grid3x3,
  Maximize2, Settings, Copy, Box, Layers, FlipHorizontal, FlipVertical,
  Undo2, Redo2, AlertTriangle, AlertCircle, CheckCircle2, BookOpen,
  Sun, Moon, SquareDashedBottom, Save, FolderOpen, ShoppingCart,
  PenLine, MessageSquare, Move, Crosshair, Type, Download,
  Link2, Target, Activity, Image, Users, Keyboard, Cuboid,
  Play, Pause, ShieldAlert, Sparkles, ScanLine, Wifi, WifiOff,
  RefreshCw, Expand, Package, Wand2, Loader2, Send, ChevronDown,
  // V6 new icons
  GitBranch, Eye, EyeOff, Lock, Unlock, GripVertical,
  PanelLeftClose, PanelLeft, SplitSquareHorizontal, Columns2,
  ArrowUpDown, Pencil, Variable, Hash, CornerDownRight,
  Scissors, Combine, MousePointer2, Spline, CircleDot,
  ToggleLeft, ToggleRight, SlidersHorizontal, Maximize, Minimize,
  ChevronUp, MoreHorizontal, X, Check,
} from 'lucide-react';
import { Card, CardBody, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieceConfig, Pli, Trou, Encoche, Chanfrein, Marquage, Annotation,
  AutoCote, ValidationIssue, MATIERES, FINITIONS, FORMES_BASE, PIECE_TEMPLATES,
  GABARITS_PERCAGE, STATUTS_FABRICATION, MatiereConfig, TypeTrou, CoteEncoche,
  StatutFabrication, GabaritPercage,
  createDefaultPiece, pieceFromTemplate, uid,
  bendAllowance, getKFactor, longueurDeveloppee, poidsEstime,
  genererPlisFormeBase, genererPathDeveloppe, genererVueIso,
  validerPiece, genererCotationsAuto, telechargerDXF,
  miroirHorizontal, miroirVertical, dupliquerPiece, motifLineaire,
} from '@/services/tolerie';
import {
  getPieces, createPiece, updatePiece, deletePiece, creerCommandeDepuisPiece,
  changerStatut, getTravauxListe, subscribeToPiece, subscribeCursors, broadcastCursor,
} from '@/services/tolerieApi';
import {
  buildScene, detectCollisions, telechargerSTEP, isARAvailable, startARSession,
  PBR_MATERIALS, distance3D, Scene3DOptions,
} from '@/services/tolerie3d';
import {
  savePieceOffline, getPiecesOffline, deletePieceOffline,
  addToSyncQueue, syncWithServer, isOnline, onNetworkChange, cacheAllPieces, getDirtyPiecesCount,
} from '@/services/tolerieOffline';
import { genererPieceDepuisTexte, EXEMPLES_IA } from '@/services/tolerieIA';
import { PDFBuilder, fmtDate } from '@/services/pdfBuilder';
import { useAppStore } from '@/stores/appStore';
// V6 imports
import {
  FeatureTree, FeatureNode, FeatureType, ParamContext, ParamVariable,
  createEmptyTree, addFeature, removeFeature, toggleFeature,
  updateFeatureParams, reorderFeature, setRollback, setActiveNode,
  createFeatureNode, replayTree, treeFromPiece,
  getVisibleNodes, getEnabledNodes, getNodeById,
  moveUp, moveDown, canMoveUp, canMoveDown,
  createParamContext, addVariable, updateVariable, removeVariable,
  evalExpression, resolveAllVariables, linkVariableToFeature,
} from '@/services/tolerieFeatureTree';
import {
  Sketch, SketchPoint, SketchLine, SketchConstraint, ConstraintType,
  createEmptySketch, createRectangleSketch,
  addPoint, addLine, addCircleEntity,
  addConstraint, removeConstraint, updateConstraintValue, toggleDriven,
  solveConstraints, hitTest, snapToGrid, snapToPoint,
  detectSmartDimension, applySmartDimension,
  sketchToPieceDimensions, sketchToBendPositions,
  getLineGeometry, getLineLength, getLineAngle,
} from '@/services/tolerieConstraints';
import {
  FlangeConfig, HemConfig, TabSlotConfig, CornerReliefConfig,
  SmartDimension, FoldState, HemType, CornerReliefType,
  defaultFlangeConfig, defaultHemConfig, defaultTabSlotConfig, defaultCornerReliefConfig,
  applyFlange, applyHem, flangePreview, hemDevelopedLength,
  generateCornerReliefs, generateSlots, generateTabs,
  autoSmartDimensions, validateDimensionChain,
  defaultFoldState, foldPoint, generateFoldMesh, bendingForce, recommendedVOpening,
  HEM_TYPES, CORNER_RELIEF_TYPES, GDT_SYMBOLS,
} from '@/services/tolerieSheetMetalOps';

// ═══ LAYOUT MODES ═══

type LayoutMode = 'classic' | 'split' | 'tree';
type CanvasTool = 'select' | 'measure' | 'annotate' | 'flange' | 'hem' | 'sketch_line' | 'sketch_circle' | 'dimension';

// ═══ UNDO/REDO with Feature Tree ═══

function useFeatureHistory(initialPiece: PieceConfig) {
  const [tree, setTree] = useState<FeatureTree>(() => treeFromPiece(initialPiece));
  const [basePiece, setBasePiece] = useState<PieceConfig>(initialPiece);
  const [undoStack, setUndoStack] = useState<FeatureTree[]>([]);
  const [redoStack, setRedoStack] = useState<FeatureTree[]>([]);

  const piece = useMemo(() => replayTree(tree, basePiece), [tree, basePiece]);

  const pushTree = useCallback((newTree: FeatureTree) => {
    setUndoStack(s => [...s.slice(-39), tree]);
    setRedoStack([]);
    setTree(newTree);
  }, [tree]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(s => [tree, ...s]);
    setTree(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  }, [tree, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(s => [...s, tree]);
    setTree(redoStack[0]);
    setRedoStack(s => s.slice(1));
  }, [tree, redoStack]);

  const resetPiece = useCallback((p: PieceConfig) => {
    setBasePiece(p);
    setTree(treeFromPiece(p));
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const addNode = useCallback((type: FeatureType, params: any, label?: string) => {
    const node = createFeatureNode(type, params, label);
    pushTree(addFeature(tree, node));
    return node.id;
  }, [tree, pushTree]);

  const removeNode = useCallback((id: string) => {
    pushTree(removeFeature(tree, id));
  }, [tree, pushTree]);

  const toggleNode = useCallback((id: string) => {
    pushTree(toggleFeature(tree, id));
  }, [tree, pushTree]);

  const updateNode = useCallback((id: string, params: any) => {
    pushTree(updateFeatureParams(tree, id, params));
  }, [tree, pushTree]);

  const reorder = useCallback((id: string, newIdx: number) => {
    pushTree(reorderFeature(tree, id, newIdx));
  }, [tree, pushTree]);

  const setRollbackIdx = useCallback((idx: number) => {
    setTree(prev => setRollback(prev, idx));
  }, []);

  const setActiveNodeId = useCallback((id: string | null) => {
    setTree(prev => setActiveNode(prev, id));
  }, []);

  return {
    piece, tree, basePiece,
    addNode, removeNode, toggleNode, updateNode, reorder,
    setRollbackIdx, setActiveNodeId, resetPiece,
    undo, redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

// ═══ KEYBOARD SHORTCUTS (extended) ═══

const SHORTCUTS: { key: string; ctrl?: boolean; shift?: boolean; desc: string; action: string }[] = [
  { key: 'z', ctrl: true, desc: 'Annuler', action: 'undo' },
  { key: 'y', ctrl: true, desc: 'Rétablir', action: 'redo' },
  { key: 's', ctrl: true, desc: 'Sauvegarder', action: 'save' },
  { key: 'd', ctrl: true, desc: 'Dupliquer pièce', action: 'duplicate' },
  { key: 'm', ctrl: true, desc: 'Miroir H', action: 'mirrorH' },
  { key: 'm', ctrl: true, shift: true, desc: 'Miroir V', action: 'mirrorV' },
  { key: 't', desc: 'Ajouter trou', action: 'addTrou' },
  { key: 'p', desc: 'Ajouter pli', action: 'addPli' },
  { key: 'f', desc: 'Outil Flange', action: 'flangeTool' },
  { key: 'h', desc: 'Outil Hem', action: 'hemTool' },
  { key: 'l', desc: 'Sketcher: Ligne', action: 'sketchLine' },
  { key: 'c', desc: 'Sketcher: Cercle', action: 'sketchCircle' },
  { key: 'Delete', desc: 'Supprimer sélection', action: 'delete' },
  { key: ' ', desc: 'Basculer vue', action: 'toggleView' },
  { key: 'g', desc: 'Grille on/off', action: 'toggleGrid' },
  { key: 'r', desc: 'Mesure', action: 'measure' },
  { key: 'a', desc: 'Annotation', action: 'annotate' },
  { key: 'Tab', desc: 'Plier/Déplier', action: 'toggleFold' },
  { key: 'Escape', desc: 'Déselectionner', action: 'deselect' },
];

// ═══════════════════════════════════════════════════
// COMPOSANT PRINCIPAL V6
// ═══════════════════════════════════════════════════

export default function AtelierToleriePage() {
  const {
    piece, tree, basePiece, addNode, removeNode, toggleNode,
    updateNode, reorder, setRollbackIdx, setActiveNodeId,
    resetPiece, undo, redo, canUndo, canRedo,
  } = useFeatureHistory(createDefaultPiece());

  // Layout & View
  const [layout, setLayout] = useState<LayoutMode>('tree');
  const [showTree, setShowTree] = useState(true);
  const [viewMode, setViewMode] = useState<'developpe' | 'iso' | '3d'>('developpe');
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCotes, setShowCotes] = useState(true);
  const [showSmartDims, setShowSmartDims] = useState(true);
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Split view fold/unfold
  const [foldState, setFoldState] = useState<FoldState>(defaultFoldState());
  const [splitView, setSplitView] = useState(false);

  // Selection
  const [selectedTrou, setSelectedTrou] = useState<string | null>(null);
  const [selectedPli, setSelectedPli] = useState<string | null>(null);

  // Tools config
  const [flangeConfig, setFlangeConfig] = useState<FlangeConfig>(defaultFlangeConfig('droite'));
  const [hemConfig, setHemConfig] = useState<HemConfig>(defaultHemConfig('haut'));
  const [tabSlotConfig, setTabSlotConfig] = useState<TabSlotConfig>(defaultTabSlotConfig('bas', 2));
  const [cornerReliefConfig, setCornerReliefConfig] = useState<CornerReliefConfig>(defaultCornerReliefConfig(2));

  // Sketcher
  const [sketch, setSketch] = useState<Sketch>(createRectangleSketch(piece.largeur, piece.hauteur));
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchSelection, setSketchSelection] = useState<string[]>([]);

  // Parametric
  const [paramCtx, setParamCtx] = useState<ParamContext>(createParamContext());
  const [showParams, setShowParams] = useState(false);

  // Smart Dimensions
  const autoSmartDimsRaw = useMemo(() => autoSmartDimensions(piece), [piece]);
  const [customDims, setCustomDims] = useState<SmartDimension[]>([]);
  const smartDims = useMemo(() => [...autoSmartDimsRaw, ...customDims], [autoSmartDimsRaw, customDims]);
  const dimValidation = useMemo(() => validateDimensionChain(smartDims, piece), [smartDims, piece]);

  // Dimension editing: when user changes a value, propagate to geometry
  const handleDimEdit = useCallback((dimId: string, newValue: number) => {
    // Check if it's a custom dim first
    const customIdx = customDims.findIndex(d => d.id === dimId);
    if (customIdx >= 0) {
      setCustomDims(prev => prev.map(d => d.id === dimId ? { ...d, value: newValue } : d));
      return;
    }
    // Auto dim → propagate to geometry via feature tree
    const dim = autoSmartDimsRaw.find(d => d.id === dimId);
    if (!dim) return;
    if (dim.type === 'horizontal' && dim.source.type === 'edge') {
      // Largeur globale
      addNode('dimension', { largeur: newValue, hauteur: piece.hauteur });
      toast.success(`Largeur → ${newValue}mm`);
    } else if (dim.type === 'vertical' && dim.source.type === 'edge') {
      // Hauteur globale
      addNode('dimension', { largeur: piece.largeur, hauteur: newValue });
      toast.success(`Hauteur → ${newValue}mm`);
    } else if (dim.type === 'horizontal' && dim.source.type === 'bend') {
      // Position de pli
      const pliId = dim.source.id1;
      const node = tree.nodes.find(n => n.type === 'bend' && n.params.id === pliId);
      if (node) { updateNode(node.id, { position: newValue }); toast.success(`Pli → ${newValue}mm`); }
    } else if (dim.type === 'horizontal' && dim.source.type === 'hole_center' && !dim.source.id2) {
      // Position X d'un trou
      const node = tree.nodes.find(n => n.type === 'hole' && n.params.id === dim.source.id1);
      if (node) { updateNode(node.id, { x: newValue }); toast.success(`Trou X → ${newValue}mm`); }
    } else if (dim.type === 'radius') {
      // Diamètre trou
      const node = tree.nodes.find(n => n.type === 'hole' && n.params.id === dim.source.id1);
      if (node) { updateNode(node.id, { diametre: newValue }); toast.success(`∅ → ${newValue}mm`); }
    }
  }, [customDims, autoSmartDimsRaw, piece, tree, addNode, updateNode]);

  // Add manual dimension (tool dimension: click 2 points)
  const [dimPoints, setDimPoints] = useState<{ x: number; y: number }[]>([]);
  const handleAddManualDim = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
    const isH = dx > dy;
    const value = isH ? dx : dy;
    const newDim: SmartDimension = {
      id: uid(),
      type: isH ? 'horizontal' : (dx < 1 && dy > 1) ? 'vertical' : 'distance',
      source: { type: 'point', id1: `${p1.x},${p1.y}`, id2: `${p2.x},${p2.y}` },
      value: Math.round(value * 10) / 10,
      displayOffset: isH ? -(piece.hauteur + 10 + customDims.filter(d => d.type === 'horizontal').length * 6) : -(piece.largeur + 10 + customDims.filter(d => d.type === 'vertical').length * 6),
      _manual: true, _p1: p1, _p2: p2,
    } as any;
    setCustomDims(prev => [...prev, newDim]);
    toast.success(`Cote ${isH ? 'H' : 'V'} ajoutée: ${newDim.value}mm`);
  }, [piece, customDims]);

  const handleRemoveDim = useCallback((dimId: string) => {
    setCustomDims(prev => prev.filter(d => d.id !== dimId));
  }, []);

  // Existing features (collab, offline, etc.)
  const [showSaved, setShowSaved] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [dirtyCount, setDirtyCount] = useState(0);
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [photoOpacity, setPhotoOpacity] = useState(0.4);
  const [animProgress, setAnimProgress] = useState(1.0);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [usePBR, setUsePBR] = useState(true);
  const [collabCursors, setCollabCursors] = useState<Record<string, { x: number; y: number }>>({});
  const [measurePts, setMeasurePts] = useState<{ x: number; y: number }[]>([]);
  const [measure3DPts, setMeasure3DPts] = useState<{ x: number; y: number; z: number }[]>([]);
  const [enable3DMeasure, setEnable3DMeasure] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { setModuleActif } = useAppStore();

  // Derived
  const matConfig = MATIERES.find(m => m.id === piece?.matiere) || MATIERES[0];
  const issues = useMemo(() => piece ? validerPiece(piece) : [], [piece]);
  const autoCotes = useMemo(() => piece ? genererCotationsAuto(piece) : [], [piece]);
  const errCt = issues.filter(i => i.severity === 'error').length;
  const collisions = useMemo(() => piece ? detectCollisions(piece) : { hasCollision: false, collisions: [] }, [piece]);
  const statut = STATUTS_FABRICATION.find(s => s.id === piece.statut);
  const visibleNodes = getVisibleNodes(tree);
  const enabledNodes = getEnabledNodes(tree);

  // Convenience update (adds a feature node)
  const update = useCallback((p: Partial<PieceConfig>) => {
    // Direct update via basePiece for simple property changes
    // For tracked ops, use addNode instead
    if (p.nom !== undefined || p.reference !== undefined || p.remarques !== undefined || p.quantite !== undefined || p.travaux_id !== undefined || p.statut !== undefined) {
      // Non-geometric changes → update basePiece directly (not tracked in tree)
      resetPiece({ ...piece, ...p });
    }
  }, [piece, resetPiece]);

  if (!piece) return null;

  // ═══ DB Queries & Mutations ═══

  const { data: savedPieces = [] } = useQuery({ queryKey: ['tolerie-pieces'], queryFn: getPieces, enabled: showSaved });
  const { data: travauxList = [] } = useQuery({ queryKey: ['travaux-list'], queryFn: getTravauxListe });

  const saveMut = useMutation({
    mutationFn: async (p: PieceConfig) => p.id ? updatePiece(p.id, p) : createPiece(p),
    onSuccess: (s) => { resetPiece({ ...piece, id: s.id, created_at: s.created_at, updated_at: s.updated_at }); qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Sauvegardé'); },
    onError: () => toast.error('Erreur sauvegarde'),
  });
  const delMut = useMutation({ mutationFn: deletePiece, onSuccess: () => { qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Supprimé'); } });
  const cmdMut = useMutation({ mutationFn: creerCommandeDepuisPiece, onSuccess: () => toast.success('Commande créée') });
  const statutMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: StatutFabrication }) => changerStatut(id, s),
    onSuccess: (r) => { update({ statut: r.statut, statut_historique: r.statut_historique }); toast.success(`Statut → ${r.statut}`); },
  });
  const syncMut = useMutation({
    mutationFn: () => syncWithServer(createPiece, updatePiece, deletePiece),
    onSuccess: (r) => { toast.success(`Sync: ${r.synced} pièces`); qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); },
  });

  // ═══ EFFECTS ═══

  // Offline monitoring
  useEffect(() => {
    const unsub = onNetworkChange((on) => { setOnline(on); });
    getDirtyPiecesCount().then(setDirtyCount);
    return unsub;
  }, []);

  // Auto-save offline
  useEffect(() => { if (piece.id) savePieceOffline(piece).catch(() => {}); }, [piece]);

  // Cache server pieces
  useEffect(() => { if (online && savedPieces.length > 0) cacheAllPieces(savedPieces).catch(() => {}); }, [savedPieces, online]);

  // Fold/unfold animation
  useEffect(() => {
    if (!foldState.animating) return;
    let frame: number;
    const target = foldState.progress > 0.5 ? 0 : 1;
    const step = 0.015 * foldState.speed;
    const tick = () => {
      setFoldState(prev => {
        const next = target === 1 ? Math.min(prev.progress + step, 1) : Math.max(prev.progress - step, 0);
        const done = next === target;
        if (done) return { ...prev, progress: target, animating: false };
        return { ...prev, progress: next };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [foldState.animating, foldState.speed]);

  // Realtime collab
  useEffect(() => {
    if (!piece.id) return;
    const unsub = subscribeToPiece(piece.id, (updated) => { resetPiece(updated); });
    const unsubC = subscribeCursors(piece.id, (d) => { setCollabCursors(c => ({ ...c, [d.userId]: { x: d.x, y: d.y } })); });
    return () => { unsub(); unsubC(); };
  }, [piece.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && e.key === 's') { e.preventDefault(); saveMut.mutate(piece); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); addNode('mirror', { axis: 'V' }, 'Dupliquer'); toast.success('Dupliqué'); }
      else if (e.key === 'f' && !ctrl && !isInput) { setCanvasTool('flange'); toast('Outil Flange actif', { icon: '🔲' }); }
      else if (e.key === 'h' && !ctrl && !isInput) { setCanvasTool('hem'); toast('Outil Hem actif', { icon: '↩️' }); }
      else if (e.key === 'l' && !ctrl && !isInput) { setCanvasTool('sketch_line'); setSketchMode(true); toast('Sketcher: Ligne', { icon: '📏' }); }
      else if (e.key === 'c' && !ctrl && !isInput) { setCanvasTool('sketch_circle'); setSketchMode(true); toast('Sketcher: Cercle', { icon: '⭕' }); }
      else if (e.key === 't' && !ctrl && !isInput) { addNode('hole', { x: piece.largeur / 2, y: piece.hauteur / 2, type: 'rond', diametre: 8 }); }
      else if (e.key === 'p' && !ctrl && !isInput) { addNode('bend', { position: piece.largeur / 2, angle: 90, rayonInterne: piece.epaisseur, direction: 'haut' }); }
      else if (e.key === 'Delete') {
        if (tree.activeNodeId) { removeNode(tree.activeNodeId); setActiveNodeId(null); }
        else if (selectedTrou) { /* find & remove trou node */ setSelectedTrou(null); }
        else if (selectedPli) { setSelectedPli(null); }
      }
      else if (e.key === ' ' && !isInput) { e.preventDefault(); setViewMode(v => v === 'developpe' ? 'iso' : v === 'iso' ? '3d' : 'developpe'); }
      else if (e.key === 'g' && !isInput) setShowGrid(g => !g);
      else if (e.key === 'r' && !isInput) setCanvasTool('measure');
      else if (e.key === 'Tab' && !isInput) { e.preventDefault(); setFoldState(prev => ({ ...prev, animating: true })); }
      else if (e.key === 'Escape') { setSelectedTrou(null); setSelectedPli(null); setCanvasTool('select'); setSketchMode(false); setActiveNodeId(null); setMeasurePts([]); setSketchSelection([]); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo, piece, tree.activeNodeId, selectedTrou, selectedPli]);

  // Photo import
  const handlePhotoImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setPhotoOverlay(reader.result as string); toast.success('Photo chargée'); };
    reader.readAsDataURL(f);
  };

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col gap-1.5">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Atelier Tôlerie</h1>
          <Badge variant="default" className="text-[6px] font-bold">V6</Badge>
          {statut && <button onClick={() => { if (piece.id) { const idx = STATUTS_FABRICATION.findIndex(s => s.id === piece.statut); const next = STATUTS_FABRICATION[idx + 1]; if (next) statutMut.mutate({ id: piece.id, s: next.id }); } }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: statut.couleur }}>
            {statut.icon} {statut.nom}</button>}
          {errCt > 0 && <Badge variant="red" className="text-[7px]">{errCt} err</Badge>}
          {collisions.hasCollision && <Badge variant="red" className="text-[7px] animate-pulse"><ShieldAlert className="w-2 h-2 inline mr-0.5" />{collisions.collisions.length} collision(s)</Badge>}
          {!dimValidation.valid && <Badge variant="red" className="text-[7px]"><AlertTriangle className="w-2 h-2 inline mr-0.5" />Chaîne de cotes</Badge>}
          {Object.keys(collabCursors).length > 0 && <Badge variant="default" className="text-[7px]"><Users className="w-2.5 h-2.5 inline mr-0.5" />{Object.keys(collabCursors).length + 1}</Badge>}
          <div className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px] font-bold', online ? 'bg-[#059669]/10 text-[#059669]' : 'bg-amber-500/10 text-amber-500')}>
            {online ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}{online ? 'En ligne' : 'Hors-ligne'}
            {dirtyCount > 0 && <span className="ml-0.5">({dirtyCount}⏳)</span>}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Layout toggles */}
          <div className="flex gap-px bg-[var(--bg-secondary)] rounded p-0.5 border border-[var(--border-secondary)]">
            {[
              { id: 'tree' as LayoutMode, icon: GitBranch, tip: 'Feature Tree' },
              { id: 'split' as LayoutMode, icon: Columns2, tip: 'Split View' },
              { id: 'classic' as LayoutMode, icon: Box, tip: 'Classique' },
            ].map(l => <button key={l.id} onClick={() => setLayout(l.id)} title={l.tip}
              className={cn('p-1 rounded', layout === l.id ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>
              <l.icon className="w-3 h-3" /></button>)}
          </div>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <button onClick={undo} disabled={!canUndo} className="p-1 rounded text-[var(--text-muted)] disabled:opacity-20" title="Ctrl+Z"><Undo2 className="w-3 h-3" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-1 rounded text-[var(--text-muted)] disabled:opacity-20" title="Ctrl+Y"><Redo2 className="w-3 h-3" /></button>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <button onClick={() => saveMut.mutate(piece)} className="p-1 rounded text-[var(--text-muted)] hover:text-[#059669]" title="Ctrl+S"><Save className="w-3 h-3" /></button>
          <button onClick={() => setShowSaved(!showSaved)} className={cn('p-1 rounded', showSaved ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}><FolderOpen className="w-3 h-3" /></button>
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="p-1 rounded text-[var(--text-muted)]"><Keyboard className="w-3 h-3" /></button>
          <button onClick={() => setShowParams(!showParams)} className={cn('p-1 rounded', showParams ? 'text-[#8B5CF6]' : 'text-[var(--text-muted)]')} title="Variables"><Variable className="w-3 h-3" /></button>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <Input value={piece.nom} onChange={e => update({ nom: e.target.value })} className="w-32 text-[9px]" />
          <Input value={piece.reference} onChange={e => update({ reference: e.target.value })} className="w-20 text-[9px] font-mono" />
        </div>
      </div>

      {/* Shortcuts panel */}
      {showShortcuts && <Card><CardBody className="p-2"><div className="grid grid-cols-5 gap-1">
        {SHORTCUTS.map(s => <div key={s.action} className="flex items-center gap-1.5 text-[8px]">
          <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-[7px] font-mono">{s.ctrl ? '⌘' : ''}{s.shift ? '⇧' : ''}{s.key === ' ' ? 'Space' : s.key === 'Tab' ? 'Tab' : s.key}</kbd>
          <span className="text-[var(--text-muted)]">{s.desc}</span>
        </div>)}</div>
      </CardBody></Card>}

      {/* Parametric variables panel */}
      {showParams && <ParametricPanel paramCtx={paramCtx} setParamCtx={setParamCtx} tree={tree} />}

      {/* Saved drawer */}
      {showSaved && <Card><CardBody className="p-2 max-h-[100px] overflow-y-auto">
        <div className="flex items-center justify-between mb-1"><p className="text-[9px] font-bold">Pièces sauvegardées ({savedPieces.length})</p>
          <button onClick={() => { resetPiece(createDefaultPiece()); setShowSaved(false); }} className="text-[8px] text-[#B91C1C]">+ Nouvelle</button></div>
        <div className="grid grid-cols-3 gap-1">{savedPieces.map(sp => <button key={sp.id} onClick={() => { resetPiece(sp); setShowSaved(false); }}
          className="text-left p-1 rounded border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] group">
          <div className="flex items-center justify-between"><p className="text-[9px] font-semibold truncate">{sp.nom}</p>
            <button onClick={e => { e.stopPropagation(); if (sp.id) delMut.mutate(sp.id); }} className="opacity-0 group-hover:opacity-100"><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div>
          <p className="text-[7px] text-[var(--text-muted)] font-mono">{sp.reference} · {sp.statut}</p>
        </button>)}</div>
      </CardBody></Card>}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex gap-2 min-h-0">

        {/* LEFT: Feature Tree (if layout = tree) */}
        {layout === 'tree' && showTree && (
          <div className="w-[220px] flex-shrink-0 flex flex-col gap-1 overflow-hidden">
            <FeatureTreePanel
              tree={tree}
              onToggle={toggleNode}
              onRemove={removeNode}
              onSelect={setActiveNodeId}
              onUpdate={updateNode}
              onMoveUp={(id) => reorder(id, tree.nodes.findIndex(n => n.id === id) - 1)}
              onMoveDown={(id) => reorder(id, tree.nodes.findIndex(n => n.id === id) + 1)}
              onRollback={setRollbackIdx}
              activeId={tree.activeNodeId}
              rollbackIndex={tree.rollbackIndex}
            />
            {/* Quick add tools */}
            <SheetMetalToolbox
              onFlange={(config) => addNode('flange', config)}
              onHem={(config) => addNode('hem', config)}
              onCornerRelief={(config) => addNode('corner_relief', config)}
              onTabSlot={(config) => addNode('tab_slot', config)}
              onBend={() => addNode('bend', { position: piece.largeur / 2, angle: 90, rayonInterne: piece.epaisseur, direction: 'haut' })}
              onHole={() => addNode('hole', { x: piece.largeur / 2, y: piece.hauteur / 2, type: 'rond', diametre: 8 })}
              piece={piece}
            />
          </div>
        )}

        {/* CANVAS AREA */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas Toolbar */}
          <CanvasToolbar
            viewMode={viewMode} setViewMode={setViewMode}
            canvasTool={canvasTool} setCanvasTool={setCanvasTool}
            showGrid={showGrid} setShowGrid={setShowGrid}
            showCotes={showCotes} setShowCotes={setShowCotes}
            showSmartDims={showSmartDims} setShowSmartDims={setShowSmartDims}
            darkCanvas={darkCanvas} setDarkCanvas={setDarkCanvas}
            zoom={zoom} setZoom={setZoom} setPan={setPan}
            splitView={splitView} setSplitView={setSplitView}
            foldState={foldState} setFoldState={setFoldState}
            sketchMode={sketchMode} setSketchMode={setSketchMode}
            photoRef={photoRef} photoOverlay={photoOverlay}
            photoOpacity={photoOpacity} setPhotoOpacity={setPhotoOpacity}
            showTree={showTree} setShowTree={setShowTree}
            layout={layout}
          />

          {/* Canvas content */}
          <div className="flex-1 relative rounded-xl border border-[var(--border-secondary)] overflow-hidden">
            {splitView ? (
              /* ═══ SPLIT VIEW: Développé à gauche, 3D pliée à droite ═══ */
              <div className="flex w-full h-full">
                <div className="flex-1 border-r border-[var(--border-secondary)]">
                  <CanvasSVG piece={piece} zoom={zoom} showGrid={showGrid} showCotes={showCotes}
                    showSmartDims={showSmartDims} smartDims={smartDims} autoCotes={autoCotes}
                    viewMode="developpe" darkCanvas={darkCanvas} svgRef={svgRef} pan={pan} setPan={setPan}
                    selTrou={selectedTrou} setSelTrou={setSelectedTrou} selPli={selectedPli} setSelPli={setSelectedPli}
                    tool={canvasTool} mPts={measurePts} setMPts={setMeasurePts} collabCursors={collabCursors}
                    photoOverlay={photoOverlay} photoOpacity={photoOpacity} pieceId={piece.id}
                    foldState={foldState} sketchMode={sketchMode} sketch={sketch}
                    onFlangeEdge={(edge) => { addNode('flange', { ...flangeConfig, edge }); setCanvasTool('select'); }}
                    onHemEdge={(edge) => { addNode('hem', { ...hemConfig, edge }); setCanvasTool('select'); }}
                    onDimEdit={handleDimEdit} onDimAdd={handleAddManualDim} onDimRemove={handleRemoveDim}
                    dimPoints={dimPoints} setDimPoints={setDimPoints}
                  />
                </div>
                <div className="flex-1">
                  <Canvas3DFold piece={piece} foldProgress={foldState.progress} darkCanvas={darkCanvas}
                    highlightedBend={foldState.highlightedBend} showBendLines={foldState.showBendLines} />
                </div>
              </div>
            ) : viewMode === '3d' ? (
              <Canvas3DFull piece={piece} darkCanvas={darkCanvas} usePBR={usePBR} animProgress={animProgress}
                enableMeasure={enable3DMeasure} onMeasurePoint={(pt) => setMeasure3DPts(pts => pts.length >= 2 ? [pt] : [...pts, pt])}
                explodedPieces={savedPieces.length > 1 ? savedPieces.slice(0, 5) : undefined} />
            ) : (
              <CanvasSVG piece={piece} zoom={zoom} showGrid={showGrid} showCotes={showCotes}
                showSmartDims={showSmartDims} smartDims={smartDims} autoCotes={autoCotes}
                viewMode={viewMode} darkCanvas={darkCanvas} svgRef={svgRef} pan={pan} setPan={setPan}
                selTrou={selectedTrou} setSelTrou={setSelectedTrou} selPli={selectedPli} setSelPli={setSelectedPli}
                tool={canvasTool} mPts={measurePts} setMPts={setMeasurePts} collabCursors={collabCursors}
                photoOverlay={photoOverlay} photoOpacity={photoOpacity} pieceId={piece.id}
                foldState={foldState} sketchMode={sketchMode} sketch={sketch}
                onFlangeEdge={(edge) => { addNode('flange', { ...flangeConfig, edge }); setCanvasTool('select'); }}
                onHemEdge={(edge) => { addNode('hem', { ...hemConfig, edge }); setCanvasTool('select'); }}
                onDimEdit={handleDimEdit} onDimAdd={handleAddManualDim} onDimRemove={handleRemoveDim}
                dimPoints={dimPoints} setDimPoints={setDimPoints}
              />
            )}
            {/* Fold/unfold overlay controls */}
            {splitView && <FoldControls foldState={foldState} setFoldState={setFoldState} />}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoImport} />
          </div>
        </div>

        {/* RIGHT: Active tool / node editor */}
        {tree.activeNodeId && (
          <div className="w-[260px] flex-shrink-0 overflow-y-auto">
            <FeatureNodeEditor
              node={getNodeById(tree, tree.activeNodeId)!}
              piece={piece}
              onUpdate={(params) => updateNode(tree.activeNodeId!, params)}
              onClose={() => setActiveNodeId(null)}
              paramCtx={paramCtx}
            />
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[7px] text-[var(--text-muted)]">
            <GitBranch className="w-2.5 h-2.5 inline mr-0.5" />
            {enabledNodes.length}/{tree.nodes.length} features
            {tree.rollbackIndex >= 0 && <span className="text-amber-500 ml-1">⟵ rollback @{tree.rollbackIndex + 1}</span>}
          </span>
          {sketchMode && <Badge variant="default" className="text-[7px] bg-[#8B5CF6]/10 text-[#8B5CF6]">
            Sketcher {sketch.fullyConstrained ? '✓ Contraint' : `${sketch.underConstrained.length} DOF`}
          </Badge>}
        </div>
        <div className="flex gap-2 text-[7px] text-[var(--text-muted)]">
          <span>Dév <b className="font-mono">{longueurDeveloppee(piece).toFixed(1)}</b>mm</span>
          <span><b className="font-mono">{poidsEstime(piece).toFixed(3)}</b>kg</span>
          <span>{piece.plis.length}P {piece.trous.length}T {piece.encoches.length}E</span>
          {piece.plis.length > 0 && <span>Force: <b className="font-mono">{bendingForce(piece.hauteur, piece.epaisseur, piece.matiere, recommendedVOpening(piece.epaisseur), 90).toFixed(1)}</b>t</span>}
          {piece.travaux_id && <span className="text-[#3B82F6]">🔗 Travaux</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => { telechargerDXF(piece); toast.success('DXF'); }} className="px-2 py-1 rounded border border-[var(--border-secondary)] text-[8px] font-semibold"><Download className="w-2.5 h-2.5 inline mr-0.5" />DXF</button>
          <button onClick={() => { telechargerSTEP(piece); toast.success('STEP'); }} className="px-2 py-1 rounded border border-[var(--border-secondary)] text-[8px] font-semibold"><Cuboid className="w-2.5 h-2.5 inline mr-0.5" />STEP</button>
          <button onClick={() => { exportPlanPDF(piece, matConfig, smartDims); toast.success('PDF'); }} className="px-2 py-1 rounded bg-[#B91C1C] text-white text-[8px] font-semibold"><FileDown className="w-2.5 h-2.5 inline mr-0.5" />PDF</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// FEATURE TREE PANEL
// ═══════════════════════════════════════════════════

function FeatureTreePanel({ tree, onToggle, onRemove, onSelect, onUpdate, onMoveUp, onMoveDown, onRollback, activeId, rollbackIndex }: {
  tree: FeatureTree; onToggle: (id: string) => void; onRemove: (id: string) => void;
  onSelect: (id: string | null) => void; onUpdate: (id: string, p: any) => void;
  onMoveUp: (id: string) => void; onMoveDown: (id: string) => void;
  onRollback: (idx: number) => void; activeId: string | null; rollbackIndex: number;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <Card className="flex-1 overflow-hidden">
      <CardBody className="p-0 h-full flex flex-col">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-1">
            <GitBranch className="w-3 h-3 text-[#B91C1C]" />
            <span className="text-[9px] font-bold">Feature Tree</span>
          </div>
          <div className="flex gap-0.5">
            {rollbackIndex >= 0 && <button onClick={() => onRollback(-1)}
              className="text-[7px] text-amber-500 font-bold px-1 py-0.5 rounded hover:bg-amber-500/10">
              Reset ↻
            </button>}
            <span className="text-[7px] text-[var(--text-muted)]">{tree.nodes.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-px">
          {tree.nodes.map((node, idx) => {
            const isActive = activeId === node.id;
            const isBeyondRollback = rollbackIndex >= 0 && idx > rollbackIndex;
            const isRollbackPoint = idx === rollbackIndex;
            return (
              <div key={node.id}>
                <div
                  onClick={() => onSelect(isActive ? null : node.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer group transition-all',
                    isActive ? 'bg-[#B91C1C]/10 border border-[#B91C1C]/30' : 'hover:bg-[var(--bg-tertiary)] border border-transparent',
                    isBeyondRollback && 'opacity-30',
                    !node.enabled && 'opacity-40 line-through',
                  )}
                >
                  {/* Drag handle */}
                  <GripVertical className="w-2 h-2 text-[var(--text-muted)] opacity-0 group-hover:opacity-50 cursor-grab" />
                  {/* Icon */}
                  <span className="text-[10px]">{node.icon}</span>
                  {/* Label */}
                  <span className={cn('flex-1 text-[8px] font-semibold truncate', isActive && 'text-[#B91C1C]')}>
                    {node.label}
                  </span>
                  {/* Actions */}
                  <div className="flex gap-px opacity-0 group-hover:opacity-100">
                    <button onClick={e => { e.stopPropagation(); onToggle(node.id); }}
                      className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]" title={node.enabled ? 'Désactiver' : 'Activer'}>
                      {node.enabled ? <Eye className="w-2 h-2 text-[#059669]" /> : <EyeOff className="w-2 h-2 text-[var(--text-muted)]" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); onMoveUp(node.id); }}
                      className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"><ChevronUp className="w-2 h-2" /></button>
                    <button onClick={e => { e.stopPropagation(); onMoveDown(node.id); }}
                      className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"><ChevronDown className="w-2 h-2" /></button>
                    <button onClick={e => { e.stopPropagation(); onRemove(node.id); }}
                      className="p-0.5 rounded hover:bg-red-500/10"><Trash2 className="w-2 h-2 text-[#EA580C]" /></button>
                  </div>
                </div>
                {/* Rollback marker */}
                {isRollbackPoint && <div className="flex items-center gap-1 px-2 py-0.5">
                  <div className="flex-1 h-px bg-amber-400" /><span className="text-[6px] font-bold text-amber-500">ROLLBACK</span><div className="flex-1 h-px bg-amber-400" />
                </div>}
                {/* Rollback click zones between nodes */}
                <div className="h-0.5 hover:h-1 hover:bg-amber-400/20 cursor-pointer transition-all rounded"
                  onClick={() => onRollback(idx)} title={`Rollback après ${node.label}`} />
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// SHEET METAL TOOLBOX (Quick add)
// ═══════════════════════════════════════════════════

function SheetMetalToolbox({ onFlange, onHem, onCornerRelief, onTabSlot, onBend, onHole, piece }: {
  onFlange: (config: FlangeConfig) => void; onHem: (config: HemConfig) => void;
  onCornerRelief: (config: CornerReliefConfig) => void; onTabSlot: (config: TabSlotConfig) => void;
  onBend: () => void; onHole: () => void; piece: PieceConfig;
}) {
  const [expanded, setExpanded] = useState(false);

  const tools = [
    { icon: '🔄', label: 'Pli', desc: '90° @centre', action: onBend, color: '#3B82F6' },
    { icon: '⭕', label: 'Perçage', desc: '∅8 centre', action: onHole, color: '#059669' },
    { icon: '🔲', label: 'Flange', desc: 'Rebord', action: () => onFlange(defaultFlangeConfig('droite')), color: '#8B5CF6' },
    { icon: '↩️', label: 'Ourlet', desc: 'Hem 180°', action: () => onHem(defaultHemConfig('haut')), color: '#EC4899' },
    { icon: '🔧', label: 'Corner Relief', desc: 'Dégagement', action: () => onCornerRelief(defaultCornerReliefConfig(piece.epaisseur)), color: '#F59E0B' },
    { icon: '🔗', label: 'Tab/Slot', desc: 'Assemblage', action: () => onTabSlot(defaultTabSlotConfig('bas', piece.epaisseur)), color: '#14B8A6' },
  ];

  return (
    <Card>
      <CardBody className="p-1.5">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-primary)]">
          <Settings className="w-3 h-3 text-[#B91C1C]" />
          <span className="flex-1 text-left">Outils Tôlerie</span>
          <ChevronDown className={cn('w-2.5 h-2.5 transition-transform', expanded && 'rotate-180')} />
        </button>
        {expanded && <div className="grid grid-cols-2 gap-1 mt-1.5">
          {tools.map(t => (
            <button key={t.label} onClick={t.action}
              className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] text-left transition-colors">
              <span className="text-[12px]">{t.icon}</span>
              <div>
                <p className="text-[8px] font-bold" style={{ color: t.color }}>{t.label}</p>
                <p className="text-[6px] text-[var(--text-muted)]">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>}
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// CANVAS TOOLBAR
// ═══════════════════════════════════════════════════

function CanvasToolbar({ viewMode, setViewMode, canvasTool, setCanvasTool, showGrid, setShowGrid,
  showCotes, setShowCotes, showSmartDims, setShowSmartDims, darkCanvas, setDarkCanvas,
  zoom, setZoom, setPan, splitView, setSplitView, foldState, setFoldState,
  sketchMode, setSketchMode, photoRef, photoOverlay, photoOpacity, setPhotoOpacity,
  showTree, setShowTree, layout }: any) {

  return (
    <div className="flex items-center justify-between mb-0.5">
      <div className="flex items-center gap-0.5">
        {/* Tree toggle */}
        {layout === 'tree' && <button onClick={() => setShowTree((s: boolean) => !s)}
          className={cn('p-1 rounded', showTree ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}>
          {showTree ? <PanelLeftClose className="w-2.5 h-2.5" /> : <PanelLeft className="w-2.5 h-2.5" />}
        </button>}
        <i className="w-px h-3 bg-[var(--border-secondary)]" />

        {/* View modes */}
        {!splitView && ['developpe', 'iso', '3d'].map(v => <button key={v} onClick={() => setViewMode(v)}
          className={cn('px-2 py-0.5 rounded text-[8px] font-semibold', viewMode === v ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>
          {v === 'developpe' ? 'Développé' : v === 'iso' ? 'Iso' : '3D'}</button>)}

        {/* Split view toggle */}
        <button onClick={() => setSplitView((s: boolean) => !s)}
          className={cn('px-2 py-0.5 rounded text-[8px] font-semibold flex items-center gap-0.5', splitView ? 'bg-[#8B5CF6] text-white' : 'text-[var(--text-muted)]')}>
          <SplitSquareHorizontal className="w-2.5 h-2.5" /> Split
        </button>

        <i className="w-px h-3 bg-[var(--border-secondary)] mx-0.5" />

        {/* Drawing tools */}
        {[
          { t: 'select' as CanvasTool, i: MousePointer2, tip: 'Sélection (Esc)' },
          { t: 'sketch_line' as CanvasTool, i: Pencil, tip: 'Ligne (L)' },
          { t: 'sketch_circle' as CanvasTool, i: CircleDot, tip: 'Cercle (C)' },
          { t: 'flange' as CanvasTool, i: CornerDownRight, tip: 'Flange (F)' },
          { t: 'hem' as CanvasTool, i: ToggleLeft, tip: 'Hem (H)' },
          { t: 'dimension' as CanvasTool, i: Ruler, tip: 'Cote (D)' },
          { t: 'measure' as CanvasTool, i: Crosshair, tip: 'Mesure (R)' },
          { t: 'annotate' as CanvasTool, i: MessageSquare, tip: 'Note (A)' },
        ].map(b => <button key={b.t} onClick={() => { setCanvasTool(b.t); if (b.t.startsWith('sketch_')) setSketchMode(true); }}
          title={b.tip}
          className={cn('p-1 rounded', canvasTool === b.t ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)]')}>
          <b.i className="w-2.5 h-2.5" /></button>)}

        {/* Sketcher mode indicator */}
        {sketchMode && <Badge variant="default" className="text-[7px] bg-[#8B5CF6]/10 text-[#8B5CF6] ml-1">
          <Spline className="w-2 h-2 inline mr-0.5" />Sketcher
        </Badge>}
      </div>

      <div className="flex items-center gap-0.5">
        {[
          { a: showGrid, t: setShowGrid, i: Grid3x3, tip: 'Grille' },
          { a: showCotes, t: setShowCotes, i: Ruler, tip: 'Cotes' },
          { a: showSmartDims, t: setShowSmartDims, i: Hash, tip: 'Smart Dims' },
          { a: darkCanvas, t: setDarkCanvas, i: darkCanvas ? Sun : Moon, tip: 'Thème' },
        ].map((b, j) => <button key={j} onClick={() => b.t(!b.a)} title={b.tip}
          className={cn('p-1 rounded', b.a ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}>
          <b.i className="w-2.5 h-2.5" /></button>)}
        <i className="w-px h-3 bg-[var(--border-secondary)]" />
        <button onClick={() => photoRef.current?.click()} className={cn('p-1 rounded', photoOverlay ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}><Image className="w-2.5 h-2.5" /></button>
        {photoOverlay && <input type="range" min={0} max={100} value={photoOpacity * 100} onChange={(e: any) => setPhotoOpacity(parseInt(e.target.value) / 100)} className="w-10 h-2 accent-[#B91C1C]" />}
        <i className="w-px h-3 bg-[var(--border-secondary)]" />
        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomOut className="w-2.5 h-2.5" /></button>
        <span className="text-[7px] font-mono w-6 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(5, zoom + 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomIn className="w-2.5 h-2.5" /></button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-0.5 text-[var(--text-muted)]"><Maximize2 className="w-2.5 h-2.5" /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// FOLD/UNFOLD CONTROLS (overlay in split view)
// ═══════════════════════════════════════════════════

function FoldControls({ foldState, setFoldState }: { foldState: FoldState; setFoldState: React.Dispatch<React.SetStateAction<FoldState>> }) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-primary)]/90 backdrop-blur border border-[var(--border-secondary)] shadow-lg">
      <button onClick={() => setFoldState(prev => ({ ...prev, progress: 0 }))}
        className={cn('text-[8px] font-bold px-2 py-0.5 rounded-full', foldState.progress === 0 ? 'bg-[#3B82F6] text-white' : 'text-[var(--text-muted)]')}>
        Déplié
      </button>
      <input type="range" min={0} max={100} value={foldState.progress * 100}
        onChange={e => setFoldState(prev => ({ ...prev, progress: parseInt(e.target.value) / 100, animating: false }))}
        className="w-32 h-1.5 accent-[#B91C1C]" />
      <button onClick={() => setFoldState(prev => ({ ...prev, progress: 1 }))}
        className={cn('text-[8px] font-bold px-2 py-0.5 rounded-full', foldState.progress === 1 ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>
        Plié
      </button>
      <button onClick={() => setFoldState(prev => ({ ...prev, animating: true }))}
        className="p-1 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]">
        {foldState.animating ? <Pause className="w-3 h-3 text-[#B91C1C]" /> : <Play className="w-3 h-3" />}
      </button>
      <select value={foldState.speed} onChange={e => setFoldState(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
        className="text-[7px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded px-1 py-0.5">
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={3}>3×</option>
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PARAMETRIC VARIABLES PANEL
// ═══════════════════════════════════════════════════

function ParametricPanel({ paramCtx, setParamCtx, tree }: { paramCtx: ParamContext; setParamCtx: React.Dispatch<React.SetStateAction<ParamContext>>; tree: FeatureTree }) {
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const val = parseFloat(newValue) || 0;
    setParamCtx(ctx => addVariable(ctx, newName.trim(), val));
    setNewName(''); setNewValue('');
    toast.success(`Variable $${newName} = ${val}`);
  };

  return (
    <Card><CardBody className="p-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Variable className="w-3 h-3 text-[#8B5CF6]" />
        <span className="text-[9px] font-bold">Variables paramétriques</span>
        <Badge variant="default" className="text-[6px]">{paramCtx.variables.length}</Badge>
      </div>
      {/* List */}
      {paramCtx.variables.length > 0 && <div className="space-y-0.5 mb-1.5">
        {paramCtx.variables.map(v => (
          <div key={v.id} className="flex items-center gap-1 p-1 rounded bg-[var(--bg-tertiary)]">
            <span className="text-[8px] font-mono text-[#8B5CF6] font-bold">${v.name}</span>
            <span className="text-[7px] text-[var(--text-muted)]">=</span>
            <Input type="number" value={v.value}
              onChange={e => setParamCtx(ctx => updateVariable(ctx, v.name, parseFloat(e.target.value) || 0))}
              className="w-16 text-[8px] font-mono h-5" />
            <span className="text-[6px] text-[var(--text-muted)]">{v.unit}</span>
            {v.expression && <span className="text-[6px] text-[#8B5CF6] font-mono">({v.expression})</span>}
            {v.linkedFeatures.length > 0 && <Badge variant="default" className="text-[5px]">{v.linkedFeatures.length} ↗</Badge>}
            <button onClick={() => setParamCtx(ctx => removeVariable(ctx, v.name))} className="ml-auto p-0.5">
              <Trash2 className="w-2 h-2 text-[#EA580C]" /></button>
          </div>
        ))}
      </div>}
      {/* Add new */}
      <div className="flex gap-1">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="nom" className="flex-1 text-[8px] h-5" />
        <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="valeur" className="w-16 text-[8px] font-mono h-5" />
        <button onClick={handleAdd} className="px-2 py-0.5 rounded bg-[#8B5CF6] text-white text-[7px] font-bold">+</button>
      </div>
    </CardBody></Card>
  );
}

// ═══════════════════════════════════════════════════
// FEATURE NODE EDITOR (Right panel)
// ═══════════════════════════════════════════════════

function FeatureNodeEditor({ node, piece, onUpdate, onClose, paramCtx }: {
  node: FeatureNode; piece: PieceConfig; onUpdate: (params: any) => void; onClose: () => void; paramCtx: ParamContext;
}) {
  if (!node) return null;
  const p = node.params;

  return (
    <Card>
      <CardBody className="p-2 space-y-1.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px]">{node.icon}</span>
            <div>
              <p className="text-[10px] font-bold text-[#B91C1C]">{node.label}</p>
              <p className="text-[7px] text-[var(--text-muted)]">{node.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]"><X className="w-3 h-3" /></button>
        </div>

        {/* Type-specific editors */}
        {node.type === 'bend' && <>
          <div className="grid grid-cols-3 gap-1">
            <div><label className="text-[6px] text-[var(--text-muted)]">Position</label>
              <Input type="number" value={p.position} onChange={e => onUpdate({ position: parseFloat(e.target.value) || 0 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px] text-[var(--text-muted)]">Angle</label>
              <Input type="number" value={p.angle} onChange={e => onUpdate({ angle: parseFloat(e.target.value) || 90 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px] text-[var(--text-muted)]">Ri</label>
              <Input type="number" value={p.rayonInterne} onChange={e => onUpdate({ rayonInterne: parseFloat(e.target.value) || 1 })} className="text-[8px] font-mono h-5" /></div>
          </div>
          <div className="flex gap-px">{(['haut', 'bas'] as const).map(d =>
            <button key={d} onClick={() => onUpdate({ direction: d })} className={cn('flex-1 py-1 rounded text-[8px] font-bold', p.direction === d ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{d === 'haut' ? '↑ Haut' : '↓ Bas'}</button>
          )}</div>
          <div className="p-1.5 rounded bg-[var(--bg-tertiary)] text-[7px]">
            <span className="text-[var(--text-muted)]">BA = </span>
            <span className="font-mono font-bold">{bendAllowance(p.rayonInterne || piece.epaisseur, piece.epaisseur, p.angle || 90, getKFactor(piece.matiere, p.rayonInterne || piece.epaisseur, piece.epaisseur)).toFixed(2)}mm</span>
            <span className="text-[var(--text-muted)] ml-2">Force ≈ </span>
            <span className="font-mono font-bold">{bendingForce(piece.hauteur, piece.epaisseur, piece.matiere, recommendedVOpening(piece.epaisseur), p.angle || 90).toFixed(1)}t</span>
          </div>
        </>}

        {node.type === 'hole' && <>
          <div className="grid grid-cols-3 gap-1">
            {[['X', p.x, 'x'], ['Y', p.y, 'y'], ['∅', p.diametre, 'diametre']].map(([l, v, k]) =>
              <div key={l as string}><label className="text-[6px] text-[var(--text-muted)]">{l as string}</label>
                <Input type="number" value={v as number} onChange={e => onUpdate({ [k as string]: parseFloat(e.target.value) || 0 })} className="text-[8px] font-mono h-5" /></div>)}
          </div>
          <div className="flex gap-px">{(['rond', 'oblong', 'fraise', 'taraude'] as TypeTrou[]).map(tp =>
            <button key={tp} onClick={() => onUpdate({ type: tp })} className={cn('flex-1 py-1 rounded text-[7px] font-bold', p.type === tp ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{tp}</button>
          )}</div>
        </>}

        {node.type === 'flange' && <>
          <p className="text-[8px] font-bold">Rebord (Flange)</p>
          <div className="flex gap-px">{(['haut', 'bas', 'gauche', 'droite'] as EdgeSide[]).map(e =>
            <button key={e} onClick={() => onUpdate({ edge: e })} className={cn('flex-1 py-1 rounded text-[7px] font-bold', p.edge === e ? 'bg-[#8B5CF6] text-white' : 'bg-[var(--bg-tertiary)]')}>{e}</button>
          )}</div>
          <div className="grid grid-cols-2 gap-1">
            <div><label className="text-[6px]">Longueur</label><Input type="number" value={p.longueur || 30} onChange={e => onUpdate({ longueur: parseFloat(e.target.value) || 30 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Angle</label><Input type="number" value={p.angle || 90} onChange={e => onUpdate({ angle: parseFloat(e.target.value) || 90 })} className="text-[8px] font-mono h-5" /></div>
          </div>
        </>}

        {node.type === 'hem' && <>
          <p className="text-[8px] font-bold">Ourlet (Hem)</p>
          <div className="flex gap-px">{(['haut', 'bas', 'gauche', 'droite'] as EdgeSide[]).map(e =>
            <button key={e} onClick={() => onUpdate({ edge: e })} className={cn('flex-1 py-1 rounded text-[7px] font-bold', p.edge === e ? 'bg-[#EC4899] text-white' : 'bg-[var(--bg-tertiary)]')}>{e}</button>
          )}</div>
          <div className="grid grid-cols-2 gap-1">
            {HEM_TYPES.map(ht => <button key={ht.id} onClick={() => onUpdate({ hemType: ht.id })}
              className={cn('p-1 rounded border text-left', p.hemType === ht.id ? 'bg-[#EC4899]/10 border-[#EC4899]/30' : 'border-[var(--border-secondary)]')}>
              <span className="text-[10px]">{ht.icon}</span>
              <p className="text-[7px] font-bold">{ht.nom}</p>
              <p className="text-[5px] text-[var(--text-muted)]">{ht.desc}</p>
            </button>)}
          </div>
          <div><label className="text-[6px]">Profondeur</label><Input type="number" value={p.depth || 8} onChange={e => onUpdate({ depth: parseFloat(e.target.value) || 8 })} className="text-[8px] font-mono h-5" /></div>
        </>}

        {node.type === 'corner_relief' && <>
          <p className="text-[8px] font-bold">Dégagement de coins</p>
          <div className="grid grid-cols-2 gap-1">
            {CORNER_RELIEF_TYPES.map(cr => <button key={cr.id} onClick={() => onUpdate({ reliefType: cr.id })}
              className={cn('p-1 rounded border text-left', p.reliefType === cr.id ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30' : 'border-[var(--border-secondary)]')}>
              <span className="text-[10px]">{cr.icon}</span>
              <p className="text-[7px] font-bold">{cr.nom}</p>
            </button>)}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[7px]">
              <input type="checkbox" checked={p.autoSize !== false} onChange={e => onUpdate({ autoSize: e.target.checked })} className="w-2.5 h-2.5 accent-[#B91C1C]" />
              Taille auto ({(piece.epaisseur * 1.5).toFixed(1)}mm)
            </label>
            {p.autoSize === false && <Input type="number" value={p.reliefSize || piece.epaisseur * 1.5} onChange={e => onUpdate({ reliefSize: parseFloat(e.target.value) })} className="w-14 text-[8px] font-mono h-5" />}
          </div>
        </>}

        {node.type === 'tab_slot' && <>
          <p className="text-[8px] font-bold">Languettes / Fentes</p>
          <div className="flex gap-px">{(['haut', 'bas', 'gauche', 'droite'] as EdgeSide[]).map(e =>
            <button key={e} onClick={() => onUpdate({ edge: e })} className={cn('flex-1 py-1 rounded text-[7px] font-bold', p.edge === e ? 'bg-[#14B8A6] text-white' : 'bg-[var(--bg-tertiary)]')}>{e}</button>
          )}</div>
          <div className="grid grid-cols-3 gap-1">
            <div><label className="text-[6px]">Nombre</label><Input type="number" value={p.count || 3} onChange={e => onUpdate({ count: parseInt(e.target.value) || 3 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Largeur</label><Input type="number" value={p.tabWidth || 15} onChange={e => onUpdate({ tabWidth: parseFloat(e.target.value) || 15 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Jeu</label><Input type="number" value={p.slotClearance || 0.15} step={0.05} onChange={e => onUpdate({ slotClearance: parseFloat(e.target.value) || 0.15 })} className="text-[8px] font-mono h-5" /></div>
          </div>
        </>}

        {node.type === 'material' && <>
          <div className="space-y-1">
            {MATIERES.map(m => <button key={m.id} onClick={() => onUpdate({ matiere: m.id })}
              className={cn('w-full flex items-center gap-1.5 p-1 rounded border', p.matiere === m.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-transparent hover:bg-[var(--bg-tertiary)]')}>
              <div className="w-3 h-3 rounded" style={{ backgroundColor: m.couleur }} />
              <span className={cn('text-[9px] font-semibold', p.matiere === m.id && 'text-[#B91C1C]')}>{m.nom}</span></button>)}
          </div>
          <div><label className="text-[6px]">Épaisseur (mm)</label>
            <div className="flex flex-wrap gap-0.5">{(MATIERES.find(m => m.id === p.matiere)?.epaisseurs || []).map(ep =>
              <button key={ep} onClick={() => onUpdate({ epaisseur: ep })}
                className={cn('px-1.5 py-0.5 rounded text-[8px] font-semibold border', p.epaisseur === ep ? 'bg-[#B91C1C] text-white border-[#B91C1C]' : 'border-[var(--border-primary)]')}>{ep}</button>
            )}</div>
          </div>
        </>}

        {node.type === 'dimension' && <>
          <div className="grid grid-cols-2 gap-1">
            <div><label className="text-[6px]">Largeur (mm)</label><Input type="number" value={p.largeur} onChange={e => onUpdate({ largeur: parseFloat(e.target.value) || 100 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Hauteur (mm)</label><Input type="number" value={p.hauteur} onChange={e => onUpdate({ hauteur: parseFloat(e.target.value) || 50 })} className="text-[8px] font-mono h-5" /></div>
          </div>
        </>}

        {node.type === 'base_shape' && <>
          <div className="grid grid-cols-3 gap-0.5">{FORMES_BASE.map(f =>
            <button key={f.id} onClick={() => onUpdate({ formeBase: f.id })}
              className={cn('p-1 rounded border text-center', p.formeBase === f.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)]')}>
              <span className="text-[11px]">{f.icon}</span>
              <p className={cn('text-[7px] font-bold', p.formeBase === f.id && 'text-[#B91C1C]')}>{f.nom}</p>
            </button>
          )}</div>
        </>}

        {node.type === 'hole_pattern' && <>
          <p className="text-[8px] font-bold">Gabarit de perçage</p>
          <div className="grid grid-cols-2 gap-1">
            <div><label className="text-[6px]">Lignes</label><Input type="number" value={p.rows || 1} onChange={e => onUpdate({ rows: parseInt(e.target.value) || 1 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Colonnes</label><Input type="number" value={p.cols || 1} onChange={e => onUpdate({ cols: parseInt(e.target.value) || 1 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Espacement X</label><Input type="number" value={p.spacingX || 50} onChange={e => onUpdate({ spacingX: parseFloat(e.target.value) || 50 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">Espacement Y</label><Input type="number" value={p.spacingY || 50} onChange={e => onUpdate({ spacingY: parseFloat(e.target.value) || 50 })} className="text-[8px] font-mono h-5" /></div>
            <div><label className="text-[6px]">∅</label><Input type="number" value={p.diametre || 10} onChange={e => onUpdate({ diametre: parseFloat(e.target.value) || 10 })} className="text-[8px] font-mono h-5" /></div>
          </div>
        </>}
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// CANVAS SVG (enhanced with Smart Dims, Flange preview, Sketch)
// ═══════════════════════════════════════════════════

function CanvasSVG({ piece, zoom, showGrid, showCotes, showSmartDims, smartDims, autoCotes,
  viewMode, darkCanvas, svgRef, pan, setPan, selTrou, setSelTrou, selPli, setSelPli,
  tool, mPts, setMPts, collabCursors, photoOverlay, photoOpacity, pieceId,
  foldState, sketchMode, sketch, onFlangeEdge, onHemEdge,
  onDimEdit, onDimAdd, onDimRemove, dimPoints, setDimPoints }: any) {

  const [drag, setDrag] = useState<any>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [editingDimId, setEditingDimId] = useState<string | null>(null);
  const [editingDimValue, setEditingDimValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const mc = MATIERES.find(m => m.id === piece.matiere);
  const W = piece.largeur, H = piece.hauteur, mg = 40;
  const bg = darkCanvas ? '#12121e' : 'var(--bg-primary)';
  const gc = darkCanvas ? '#2a2a3e' : 'var(--text-muted)';
  const cf = darkCanvas ? (mc?.couleurDark || '#9CA3AF') : (mc?.couleur || '#6B7280');
  const cc = darkCanvas ? '#FF6B6B' : '#B91C1C';

  const toWorld = (cx: number, cy: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: Math.round((vb.x + (cx - r.left) * vb.width / r.width) / 5) * 5, y: Math.round((vb.y + (cy - r.top) * vb.height / r.height) / 5) * 5 };
  };

  // Edge detection for flange/hem tools
  const detectEdge = (cx: number, cy: number): string | null => {
    const pt = toWorld(cx, cy);
    const threshold = 10;
    if (pt.y < threshold) return 'haut';
    if (pt.y > H - threshold) return 'bas';
    if (pt.x < threshold) return 'gauche';
    if (pt.x > W - threshold) return 'droite';
    return null;
  };

  const handleDown = (e: React.MouseEvent, type = 'pan', id?: string) => {
    e.stopPropagation();
    // Close dim editor on outside click
    if (editingDimId && type === 'pan') { setEditingDimId(null); }
    if (tool === 'dimension') {
      const pt = toWorld(e.clientX, e.clientY);
      if (!dimPoints || dimPoints.length === 0) {
        setDimPoints([pt]);
      } else {
        // Second click → create dimension
        onDimAdd(dimPoints[0], pt);
        setDimPoints([]);
      }
      return;
    }
    if (tool === 'flange') {
      const edge = detectEdge(e.clientX, e.clientY);
      if (edge) { onFlangeEdge(edge); return; }
    }
    if (tool === 'hem') {
      const edge = detectEdge(e.clientX, e.clientY);
      if (edge) { onHemEdge(edge); return; }
    }
    if (tool === 'measure') { const pt = toWorld(e.clientX, e.clientY); setMPts(mPts.length >= 2 ? [pt] : [...mPts, pt]); return; }
    if (tool === 'annotate') { const pt = toWorld(e.clientX, e.clientY); const txt = prompt('Annotation:'); if (txt) { /* addNode annotation */ } return; }
    if (type === 'trou') { setSelTrou(id); }
    else if (type === 'pli') { setSelPli(id); }
    else if (e.button === 1 || e.altKey) setDrag({ type: 'pan', sx: e.clientX - pan.x, sy: e.clientY - pan.y });
    if (pieceId) { const pt = toWorld(e.clientX, e.clientY); broadcastCursor(pieceId, 'me', pt.x, pt.y); }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (tool === 'flange' || tool === 'hem') {
      const edge = detectEdge(e.clientX, e.clientY);
      setHoverEdge(edge);
    }
    if (drag?.type === 'pan') { setPan({ x: e.clientX - drag.sx, y: e.clientY - drag.sy }); }
  };
  const handleUp = () => setDrag(null);

  if (viewMode === 'iso') {
    const iso = genererVueIso(piece);
    const ax = iso.segments.flatMap((s: any) => [s.x1, s.x2]), ay = iso.segments.flatMap((s: any) => [s.y1, s.y2]);
    const mnX = Math.min(...ax, 0) - 20, mxX = Math.max(...ax, 0) + 20, mnY = Math.min(...ay, 0) - 20, mxY = Math.max(...ay, 0) + 20;
    return <svg ref={svgRef} className="w-full h-full" viewBox={`${mnX} ${mnY} ${mxX - mnX} ${mxY - mnY}`} style={{ background: bg }}>
      {iso.segments.map((s: any, i: number) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={cf} strokeWidth={1.5 / zoom} />)}
    </svg>;
  }

  const sc = zoom, vbX = -mg / sc + pan.x / sc, vbY = -mg / sc + pan.y / sc, vbW = (W + mg * 2) / sc, vbH = (H + mg * 2) / sc;

  return (
    <svg ref={svgRef} className="w-full h-full" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ background: bg, cursor: tool === 'dimension' ? 'crosshair' : tool === 'flange' || tool === 'hem' ? 'pointer' : tool === 'measure' ? 'crosshair' : 'default' }}
      onMouseDown={e => handleDown(e)} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}>

      {/* Photo overlay */}
      {photoOverlay && <image href={photoOverlay} x={0} y={0} width={W} height={H} opacity={photoOpacity} preserveAspectRatio="none" />}

      {/* Grid */}
      {showGrid && <g opacity={darkCanvas ? 0.2 : 0.08}>
        {Array.from({ length: Math.ceil(W / 10) + 8 }, (_, i) => (i - 4) * 10).map(x =>
          <line key={`gx${x}`} x1={x} y1={-mg} x2={x} y2={H + mg} stroke={gc} strokeWidth={x % 50 === 0 ? 0.3 : 0.1} />)}
        {Array.from({ length: Math.ceil(H / 10) + 8 }, (_, i) => (i - 4) * 10).map(y =>
          <line key={`gy${y}`} x1={-mg} y1={y} x2={W + mg} y2={y} stroke={gc} strokeWidth={y % 50 === 0 ? 0.3 : 0.1} />)}
      </g>}

      {/* Piece shape */}
      <path d={genererPathDeveloppe(piece)} fill={cf} fillOpacity={darkCanvas ? 0.15 : 0.08} stroke={cf} strokeWidth={0.6 / sc} />

      {/* Edge hover highlight (flange/hem tool) */}
      {(tool === 'flange' || tool === 'hem') && hoverEdge && <rect
        x={hoverEdge === 'gauche' ? -3 : hoverEdge === 'droite' ? W - 3 : 0}
        y={hoverEdge === 'haut' ? -3 : hoverEdge === 'bas' ? H - 3 : 0}
        width={hoverEdge === 'gauche' || hoverEdge === 'droite' ? 6 : W}
        height={hoverEdge === 'haut' || hoverEdge === 'bas' ? 6 : H}
        fill={tool === 'flange' ? '#8B5CF6' : '#EC4899'} fillOpacity={0.3}
        rx={1} className="pointer-events-none"
      />}

      {/* Plis */}
      {piece.plis.map((pli: Pli) => <g key={pli.id}>
        <line x1={pli.position} y1={-2} x2={pli.position} y2={H + 2}
          stroke={selPli === pli.id ? '#FF6B6B' : '#3B82F6'} strokeWidth={selPli === pli.id ? 1 : 0.4}
          strokeDasharray={selPli === pli.id ? 'none' : '2 1'} className="cursor-pointer"
          onMouseDown={e => handleDown(e, 'pli', pli.id)} />
        <text x={pli.position} y={-4} textAnchor="middle" fontSize={3} fill="#3B82F6" fontWeight="bold">{pli.angle}°</text>
      </g>)}

      {/* Trous */}
      {piece.trous.map((t: Trou) => <g key={t.id} onMouseDown={e => handleDown(e, 'trou', t.id)} className="cursor-pointer">
        <circle cx={t.x} cy={t.y} r={t.diametre / 2}
          fill="none" stroke={selTrou === t.id ? '#FF6B6B' : '#059669'}
          strokeWidth={selTrou === t.id ? 0.8 : 0.3} />
        <circle cx={t.x} cy={t.y} r={0.5} fill={selTrou === t.id ? '#FF6B6B' : '#059669'} />
      </g>)}

      {/* Encoches */}
      {piece.encoches.map((e: Encoche) =>
        <rect key={e.id} x={e.x} y={e.y} width={e.largeur} height={e.hauteur}
          fill="none" stroke="#EA580C" strokeWidth={0.3} strokeDasharray="1 0.5" />)}

      {/* Smart Dimensions (clickable to edit) */}
      {showSmartDims && smartDims && smartDims.map((dim: SmartDimension) =>
        <SmartDimSVG key={dim.id} dim={dim} piece={piece} zoom={zoom} darkCanvas={darkCanvas}
          isEditing={editingDimId === dim.id}
          onStartEdit={() => { setEditingDimId(dim.id); setEditingDimValue(String(dim.value)); }}
          onRemove={() => onDimRemove?.(dim.id)}
          isManual={(dim as any)._manual}
        />
      )}

      {/* Dimension tool: first point marker */}
      {tool === 'dimension' && dimPoints && dimPoints.length === 1 && <g>
        <circle cx={dimPoints[0].x} cy={dimPoints[0].y} r={1.5} fill="none" stroke="#2563EB" strokeWidth={0.3} />
        <line x1={dimPoints[0].x - 2} y1={dimPoints[0].y} x2={dimPoints[0].x + 2} y2={dimPoints[0].y} stroke="#2563EB" strokeWidth={0.2} />
        <line x1={dimPoints[0].x} y1={dimPoints[0].y - 2} x2={dimPoints[0].x} y2={dimPoints[0].y + 2} stroke="#2563EB" strokeWidth={0.2} />
      </g>}

      {/* Manual dims: point markers */}
      {showSmartDims && smartDims.filter((d: any) => d._manual && d._p1 && d._p2).map((dim: any) => <g key={`mp_${dim.id}`}>
        <circle cx={dim._p1.x} cy={dim._p1.y} r={0.8} fill="#2563EB" />
        <circle cx={dim._p2.x} cy={dim._p2.y} r={0.8} fill="#2563EB" />
      </g>)}

      {/* Auto cotes */}
      {showCotes && autoCotes.map((c: AutoCote, i: number) =>
        <g key={i}>
          <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c.color || cc} strokeWidth={0.15} markerEnd="url(#arrow)" />
          <text x={(c.x1 + c.x2) / 2} y={(c.y1 + c.y2) / 2 - 1.5} textAnchor="middle" fontSize={2.5} fill={c.color || cc} fontWeight="bold">{c.label}</text>
        </g>
      )}

      {/* Measure */}
      {mPts.length === 2 && <g>
        <line x1={mPts[0].x} y1={mPts[0].y} x2={mPts[1].x} y2={mPts[1].y} stroke="#EC4899" strokeWidth={0.4} strokeDasharray="2 1" />
        <text x={(mPts[0].x + mPts[1].x) / 2} y={(mPts[0].y + mPts[1].y) / 2 - 2} textAnchor="middle" fontSize={3} fill="#EC4899" fontWeight="bold">
          {Math.hypot(mPts[1].x - mPts[0].x, mPts[1].y - mPts[0].y).toFixed(1)}mm
        </text>
      </g>}

      {/* Collab cursors */}
      {Object.entries(collabCursors).map(([uid, pos]: any) =>
        <circle key={uid} cx={pos.x} cy={pos.y} r={2} fill="#8B5CF6" opacity={0.5} />
      )}

      {/* Inline dimension editor (foreignObject) */}
      {editingDimId && (() => {
        const dim = smartDims?.find((d: SmartDimension) => d.id === editingDimId);
        if (!dim) return null;
        // Calculate position
        let ex = 0, ey = 0;
        if (dim.type === 'horizontal') {
          const x1 = dim.source.type === 'hole_center' ? piece.trous.find((t: Trou) => t.id === dim.source.id1)?.x || 0 : (dim as any)._p1?.x ?? 0;
          const x2 = dim.source.id2 ? (piece.trous.find((t: Trou) => t.id === dim.source.id2)?.x || piece.largeur) : (dim as any)._p2?.x ?? piece.largeur;
          ex = (x1 + x2) / 2;
          ey = dim.displayOffset < 0 ? dim.displayOffset : piece.hauteur - dim.displayOffset;
        } else if (dim.type === 'vertical') {
          ex = dim.displayOffset < 0 ? dim.displayOffset : piece.largeur - dim.displayOffset;
          ey = piece.hauteur / 2;
        } else if (dim.type === 'radius') {
          const trou = piece.trous.find((t: Trou) => t.id === dim.source.id1);
          if (trou) { ex = trou.x + trou.diametre / 2 + 5; ey = trou.y; }
        } else if ((dim as any)._manual && (dim as any)._p1 && (dim as any)._p2) {
          ex = ((dim as any)._p1.x + (dim as any)._p2.x) / 2;
          ey = ((dim as any)._p1.y + (dim as any)._p2.y) / 2 - 6;
        }
        return <foreignObject x={ex - 15} y={ey - 5} width={30} height={10} className="overflow-visible">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
            <input
              ref={editInputRef}
              autoFocus
              type="number"
              value={editingDimValue}
              onChange={e => setEditingDimValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = parseFloat(editingDimValue);
                  if (val > 0) onDimEdit?.(editingDimId, val);
                  setEditingDimId(null);
                } else if (e.key === 'Escape') {
                  setEditingDimId(null);
                }
              }}
              onBlur={() => {
                const val = parseFloat(editingDimValue);
                if (val > 0) onDimEdit?.(editingDimId, val);
                setEditingDimId(null);
              }}
              style={{
                width: '28px', height: '8px', fontSize: '5px', fontFamily: 'monospace',
                fontWeight: 'bold', textAlign: 'center', border: '0.3px solid #2563EB',
                borderRadius: '1px', background: darkCanvas ? '#1e1e2e' : 'white',
                color: '#2563EB', outline: 'none', padding: '0 1px',
              }}
            />
          </div>
        </foreignObject>;
      })()}

      {/* SVG defs */}
      <defs>
        <marker id="arrow" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto">
          <polygon points="0 0, 4 1.5, 0 3" fill={cc} />
        </marker>
        <marker id="dimArrowR" markerWidth="3" markerHeight="2.5" refX="3" refY="1.25" orient="auto">
          <polygon points="0 0, 3 1.25, 0 2.5" fill={darkCanvas ? '#60A5FA' : '#2563EB'} />
        </marker>
        <marker id="dimArrowL" markerWidth="3" markerHeight="2.5" refX="0" refY="1.25" orient="auto">
          <polygon points="3 0, 0 1.25, 3 2.5" fill={darkCanvas ? '#60A5FA' : '#2563EB'} />
        </marker>
      </defs>
    </svg>
  );
}

// ═══ SMART DIMENSION SVG RENDERING ═══

function SmartDimSVG({ dim, piece, zoom, darkCanvas, isEditing, onStartEdit, onRemove, isManual }: {
  dim: SmartDimension; piece: PieceConfig; zoom: number; darkCanvas: boolean;
  isEditing?: boolean; onStartEdit?: () => void; onRemove?: () => void; isManual?: boolean;
}) {
  const color = darkCanvas ? '#60A5FA' : '#2563EB';
  const manualColor = darkCanvas ? '#F59E0B' : '#D97706';
  const c = isManual ? manualColor : color;
  const tolerance = dim.tolerance;
  const fmtVal = (v: number) => v.toFixed(v % 1 === 0 ? 0 : 1);

  // Helper: resolved coords for manual dims stored with _p1/_p2
  const mp1 = (dim as any)._p1 as { x: number; y: number } | undefined;
  const mp2 = (dim as any)._p2 as { x: number; y: number } | undefined;

  // ─── HORIZONTAL ───
  if (dim.type === 'horizontal') {
    let x1: number, x2: number;
    if (mp1 && mp2) { x1 = Math.min(mp1.x, mp2.x); x2 = Math.max(mp1.x, mp2.x); }
    else {
      x1 = dim.source.type === 'hole_center' ? piece.trous.find(t => t.id === dim.source.id1)?.x || 0 : 0;
      x2 = dim.source.id2 ? (piece.trous.find(t => t.id === dim.source.id2)?.x || piece.largeur) : piece.largeur;
    }
    const refY = mp1 ? Math.min(mp1.y, mp2?.y ?? mp1.y) : 0;
    const y = mp1 ? refY - 8 - (isManual ? 4 : 0) : (dim.displayOffset < 0 ? dim.displayOffset : piece.hauteur - dim.displayOffset);
    const midX = (x1 + x2) / 2;

    return <g className="cursor-pointer" onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(); }}>
      {/* Extension lines */}
      <line x1={x1} y1={mp1 ? mp1.y : 0} x2={x1} y2={y} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      <line x1={x2} y1={mp2 ? mp2.y : 0} x2={x2} y2={y} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      {/* Dimension line + arrows */}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth={0.2} markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      {/* Tick marks */}
      <line x1={x1} y1={y - 1.5} x2={x1} y2={y + 1.5} stroke={c} strokeWidth={0.15} />
      <line x1={x2} y1={y - 1.5} x2={x2} y2={y + 1.5} stroke={c} strokeWidth={0.15} />
      {/* Value badge */}
      <rect x={midX - 8} y={y - 3} width={16} height={4} rx={0.5}
        fill={darkCanvas ? '#1e1e2e' : 'white'} stroke={c} strokeWidth={isEditing ? 0.3 : 0.1}
        className={isEditing ? '' : 'hover:stroke-[0.25]'} />
      <text x={midX} y={y - 0.5} textAnchor="middle" fontSize={2.5} fill={c} fontWeight="bold" fontFamily="monospace">
        {fmtVal(dim.value)}
        {tolerance && <tspan fontSize={1.3} opacity={0.6}> +{tolerance.plus}/-{tolerance.minus}</tspan>}
      </text>
      {/* Manual badge + remove */}
      {isManual && <g>
        <rect x={midX + 9} y={y - 2.5} width={3} height={3} rx={0.5} fill={c} fillOpacity={0.15}
          className="cursor-pointer hover:fill-opacity-40" onClick={e => { e.stopPropagation(); onRemove?.(); }} />
        <text x={midX + 10.5} y={y - 0.5} textAnchor="middle" fontSize={2} fill={c} fontWeight="bold">×</text>
      </g>}
    </g>;
  }

  // ─── VERTICAL ───
  if (dim.type === 'vertical') {
    let y1: number, y2: number;
    if (mp1 && mp2) { y1 = Math.min(mp1.y, mp2.y); y2 = Math.max(mp1.y, mp2.y); }
    else { y1 = 0; y2 = piece.hauteur; }
    const refX = mp1 ? Math.min(mp1.x, mp2?.x ?? mp1.x) : 0;
    const x = mp1 ? refX - 8 - (isManual ? 4 : 0) : (dim.displayOffset < 0 ? dim.displayOffset : piece.largeur - dim.displayOffset);
    const midY = (y1 + y2) / 2;

    return <g className="cursor-pointer" onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(); }}>
      {/* Extension lines */}
      <line x1={mp1 ? mp1.x : 0} y1={y1} x2={x} y2={y1} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      <line x1={mp2 ? mp2.x : 0} y1={y2} x2={x} y2={y2} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      {/* Dimension line */}
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={c} strokeWidth={0.2} markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      {/* Tick marks */}
      <line x1={x - 1.5} y1={y1} x2={x + 1.5} y2={y1} stroke={c} strokeWidth={0.15} />
      <line x1={x - 1.5} y1={y2} x2={x + 1.5} y2={y2} stroke={c} strokeWidth={0.15} />
      {/* Value badge */}
      <rect x={x - 8} y={midY - 2} width={12} height={4} rx={0.5}
        fill={darkCanvas ? '#1e1e2e' : 'white'} stroke={c} strokeWidth={isEditing ? 0.3 : 0.1} />
      <text x={x - 2} y={midY + 0.8} textAnchor="middle" fontSize={2.5} fill={c} fontWeight="bold" fontFamily="monospace"
        transform={`rotate(-90 ${x - 2} ${midY + 0.8})`}>
        {fmtVal(dim.value)}
      </text>
      {isManual && <g>
        <rect x={x - 2} y={midY + 3} width={3} height={3} rx={0.5} fill={c} fillOpacity={0.15}
          className="cursor-pointer hover:fill-opacity-40" onClick={e => { e.stopPropagation(); onRemove?.(); }} />
        <text x={x - 0.5} y={midY + 5} textAnchor="middle" fontSize={2} fill={c} fontWeight="bold">×</text>
      </g>}
    </g>;
  }

  // ─── DISTANCE (oblique manual dim) ───
  if (dim.type === 'distance' && mp1 && mp2) {
    const midX = (mp1.x + mp2.x) / 2, midY = (mp1.y + mp2.y) / 2;
    const angle = Math.atan2(mp2.y - mp1.y, mp2.x - mp1.x) * 180 / Math.PI;
    const perpOff = 4; // offset perpendicular to line
    const nx = -Math.sin(angle * Math.PI / 180) * perpOff;
    const ny = Math.cos(angle * Math.PI / 180) * perpOff;

    return <g className="cursor-pointer" onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(); }}>
      {/* Extension lines */}
      <line x1={mp1.x} y1={mp1.y} x2={mp1.x + nx} y2={mp1.y + ny} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      <line x1={mp2.x} y1={mp2.y} x2={mp2.x + nx} y2={mp2.y + ny} stroke={c} strokeWidth={0.08} strokeDasharray="0.5 0.5" opacity={0.5} />
      {/* Dim line */}
      <line x1={mp1.x + nx} y1={mp1.y + ny} x2={mp2.x + nx} y2={mp2.y + ny}
        stroke={c} strokeWidth={0.2} markerStart="url(#dimArrowL)" markerEnd="url(#dimArrowR)" />
      {/* Value */}
      <rect x={midX + nx - 7} y={midY + ny - 2.5} width={14} height={4} rx={0.5}
        fill={darkCanvas ? '#1e1e2e' : 'white'} stroke={c} strokeWidth={0.1} />
      <text x={midX + nx} y={midY + ny + 0.3} textAnchor="middle" fontSize={2.5} fill={c} fontWeight="bold" fontFamily="monospace">
        {fmtVal(dim.value)}
      </text>
      {isManual && <g>
        <rect x={midX + nx + 8} y={midY + ny - 2} width={3} height={3} rx={0.5} fill={c} fillOpacity={0.15}
          className="cursor-pointer hover:fill-opacity-40" onClick={e => { e.stopPropagation(); onRemove?.(); }} />
        <text x={midX + nx + 9.5} y={midY + ny + 0.3} textAnchor="middle" fontSize={2} fill={c} fontWeight="bold">×</text>
      </g>}
    </g>;
  }

  // ─── RADIUS (hole diameter) ───
  if (dim.type === 'radius') {
    const trou = piece.trous.find((t: Trou) => t.id === dim.source.id1);
    if (!trou) return null;
    const tx = trou.x + trou.diametre / 2 + 2, ty = trou.y;
    return <g className="cursor-pointer" onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(); }}>
      {/* Leader line */}
      <line x1={trou.x} y1={trou.y} x2={tx} y2={ty - 1.5} stroke={c} strokeWidth={0.1} />
      <rect x={tx - 1} y={ty - 3} width={10} height={3} rx={0.4}
        fill={darkCanvas ? '#1e1e2e' : 'white'} stroke={c} strokeWidth={0.08} />
      <text x={tx + 4} y={ty - 1} textAnchor="middle" fontSize={2} fill={c} fontWeight="bold" fontFamily="monospace">
        ∅{fmtVal(dim.value)}
      </text>
    </g>;
  }

  return null;
}

// ═══════════════════════════════════════════════════
// CANVAS 3D FOLD (for split view)
// ═══════════════════════════════════════════════════

function Canvas3DFold({ piece, foldProgress, darkCanvas, highlightedBend, showBendLines }: {
  piece: PieceConfig; foldProgress: number; darkCanvas: boolean;
  highlightedBend: string | null; showBendLines: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; }

    const init = async () => {
      let THREE: any;
      try { THREE = (window as any).THREE || await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' as any); }
      catch { THREE = (window as any).THREE; }
      if (!THREE) {
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:11px;flex-direction:column"><p>⚠️ Three.js requis</p></div>';
        return;
      }

      try {
        const opts: Scene3DOptions = {
          mode: 'normal', darkCanvas, usePBR: true,
          animProgress: foldProgress,
          enableMeasure: false,
          onMeasurePoint: () => {},
        };
        const result = buildScene(THREE, piece, mount, opts);
        sceneRef.current = result;
      } catch (err) {
        console.error('3D fold init error:', err);
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:11px">Erreur 3D</div>';
      }
    };
    init();
    return () => { if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; } };
  }, [piece.plis, piece.largeur, piece.hauteur, piece.epaisseur, piece.matiere, piece.trous.length, darkCanvas]);

  useEffect(() => {
    if (sceneRef.current?.setProgress) sceneRef.current.setProgress(foldProgress);
  }, [foldProgress]);

  return <div ref={mountRef} className="w-full h-full" />;
}

// ═══════════════════════════════════════════════════
// CANVAS 3D FULL (existing — unchanged)
// ═══════════════════════════════════════════════════

function Canvas3DFull({ piece, darkCanvas, usePBR, animProgress, enableMeasure, onMeasurePoint, explodedPieces }: {
  piece: PieceConfig; darkCanvas: boolean; usePBR: boolean; animProgress: number;
  enableMeasure: boolean; onMeasurePoint: (pt: { x: number; y: number; z: number }) => void;
  explodedPieces?: PieceConfig[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; }
    const init = async () => {
      let THREE: any;
      try { THREE = (window as any).THREE || await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' as any); }
      catch { THREE = (window as any).THREE; }
      if (!THREE) {
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;flex-direction:column"><p>⚠️ Three.js non disponible</p></div>';
        return;
      }
      try {
        const opts: Scene3DOptions = {
          mode: explodedPieces && explodedPieces.length > 1 ? 'exploded' : 'normal',
          darkCanvas, usePBR, animProgress, explodedPieces, explodeDistance: 60,
          enableMeasure, onMeasurePoint,
        };
        const result = buildScene(THREE, piece, mount, opts);
        sceneRef.current = result;
      } catch (err) {
        console.error('3D init error:', err);
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:11px">Erreur 3D</div>';
      }
    };
    init();
    return () => { if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; } };
  }, [piece.plis, piece.largeur, piece.hauteur, piece.epaisseur, piece.matiere, piece.trous.length, darkCanvas, usePBR, explodedPieces?.length]);

  useEffect(() => {
    if (sceneRef.current?.setProgress) sceneRef.current.setProgress(animProgress);
  }, [animProgress]);

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: enableMeasure ? 'crosshair' : 'default' }} />;
}

// ═══ PDF EXPORTS ═══

function exportPlanPDF(p: PieceConfig, mc: MatiereConfig, dims?: SmartDimension[]) {
  const pdf = new PDFBuilder('Plan Technique', p.reference, 'landscape');
  pdf.docTitle('Plan de Fabrication', p.reference);
  pdf.docSubtitle(`${p.nom} — ${mc.nom} ép. ${p.epaisseur} mm`);
  pdf.kpiRow([
    { label: 'Largeur', value: `${p.largeur}mm` },
    { label: 'Hauteur', value: `${p.hauteur}mm` },
    { label: 'Développée', value: `${longueurDeveloppee(p).toFixed(1)}mm` },
    { label: 'Poids', value: `${poidsEstime(p).toFixed(3)}kg` },
    { label: 'Qté', value: String(p.quantite) },
  ]);

  // ─── Vue développée avec cotations ───
  pdf.section('Vue développée cotée');
  const d = pdf.doc, dy = pdf.y;
  // Marges pour les cotations extérieures
  const dimMarginL = 18, dimMarginT = 14, dimMarginR = 8, dimMarginB = 8;
  const availW = pdf.cw * 0.55, availH = 65;
  const sc = Math.min((availW - dimMarginL - dimMarginR) / p.largeur, (availH - dimMarginT - dimMarginB) / p.hauteur);
  const dW = p.largeur * sc, dH = p.hauteur * sc;
  const dX = 25 + dimMarginL, dY = dy + dimMarginT;
  const fmtV = (v: number) => v.toFixed(v % 1 === 0 ? 0 : 1);

  // Background
  d.setFillColor(245, 246, 250); d.setDrawColor(120, 120, 140); d.setLineWidth(0.2);
  d.rect(dX, dY, dW, dH, 'FD');

  // Plis (tirets bleus)
  p.plis.forEach(pli => {
    d.setDrawColor(59, 130, 246); d.setLineWidth(0.12);
    d.setLineDashPattern([1.2, 0.8], 0);
    d.line(dX + pli.position * sc, dY - 1, dX + pli.position * sc, dY + dH + 1);
    d.setLineDashPattern([], 0);
    // Angle label
    d.setFontSize(5); d.setTextColor(59, 130, 246);
    d.text(`${pli.angle}°`, dX + pli.position * sc, dY - 2, { align: 'center' });
  });

  // Trous (cercles verts + point centre)
  p.trous.forEach(t => {
    d.setDrawColor(5, 150, 105); d.setLineWidth(0.12);
    const r = Math.max((t.diametre / 2) * sc, 0.3);
    d.circle(dX + t.x * sc, dY + t.y * sc, r, 'S');
    d.setFillColor(5, 150, 105);
    d.circle(dX + t.x * sc, dY + t.y * sc, 0.15, 'F');
  });

  // Encoches (tirets orange)
  p.encoches.forEach(e => {
    d.setDrawColor(234, 88, 12); d.setLineWidth(0.1);
    d.setLineDashPattern([0.8, 0.4], 0);
    d.rect(dX + e.x * sc, dY + e.y * sc, e.largeur * sc, e.hauteur * sc, 'S');
    d.setLineDashPattern([], 0);
  });

  // ─── COTATIONS SUR LE PLAN ───
  const dimColor = { r: 37, g: 99, b: 235 }; // #2563EB
  const manualColor = { r: 217, g: 119, b: 6 }; // #D97706
  const allDims = dims || autoSmartDimensions(p);

  allDims.forEach(dim => {
    const isManual = (dim as any)._manual;
    const col = isManual ? manualColor : dimColor;
    d.setDrawColor(col.r, col.g, col.b); d.setTextColor(col.r, col.g, col.b);
    d.setLineWidth(0.1); d.setFontSize(5);

    const mp1 = (dim as any)._p1 as { x: number; y: number } | undefined;
    const mp2 = (dim as any)._p2 as { x: number; y: number } | undefined;

    if (dim.type === 'horizontal') {
      let x1Src: number, x2Src: number;
      if (mp1 && mp2) { x1Src = Math.min(mp1.x, mp2.x); x2Src = Math.max(mp1.x, mp2.x); }
      else {
        x1Src = dim.source.type === 'hole_center' ? (p.trous.find(t => t.id === dim.source.id1)?.x || 0) : 0;
        x2Src = dim.source.id2 ? (p.trous.find(t => t.id === dim.source.id2)?.x || p.largeur) : p.largeur;
      }
      const px1 = dX + x1Src * sc, px2 = dX + x2Src * sc;
      const isAbove = dim.displayOffset < 0 || (mp1 && mp1.y < p.hauteur / 2);
      // Stagger: use displayOffset index for spacing
      const offsetIdx = allDims.filter(dd => dd.type === 'horizontal').indexOf(dim);
      const yOff = isAbove
        ? dY - 3.5 - offsetIdx * 3.5
        : dY + dH + 3.5 + offsetIdx * 3.5;

      // Extension lines (dashed)
      d.setLineDashPattern([0.4, 0.3], 0);
      d.line(px1, isAbove ? dY : dY + dH, px1, yOff);
      d.line(px2, isAbove ? dY : dY + dH, px2, yOff);
      d.setLineDashPattern([], 0);
      // Dimension line
      d.line(px1, yOff, px2, yOff);
      // Arrows (small triangles)
      drawPDFArrow(d, px1, yOff, 'right', col);
      drawPDFArrow(d, px2, yOff, 'left', col);
      // Tick marks
      d.line(px1, yOff - 1, px1, yOff + 1);
      d.line(px2, yOff - 1, px2, yOff + 1);
      // Value label (white box background)
      const midPx = (px1 + px2) / 2;
      const label = fmtV(dim.value) + (dim.tolerance ? ` +${dim.tolerance.plus}/-${dim.tolerance.minus}` : '');
      const labelW = d.getTextWidth(label) + 1.5;
      d.setFillColor(255, 255, 255); d.rect(midPx - labelW / 2, yOff - 2.2, labelW, 3, 'F');
      d.text(label, midPx, yOff + 0.2, { align: 'center' });
    }

    else if (dim.type === 'vertical') {
      let y1Src: number, y2Src: number;
      if (mp1 && mp2) { y1Src = Math.min(mp1.y, mp2.y); y2Src = Math.max(mp1.y, mp2.y); }
      else { y1Src = 0; y2Src = p.hauteur; }
      const py1 = dY + y1Src * sc, py2 = dY + y2Src * sc;
      const isLeft = dim.displayOffset < 0 || (mp1 && mp1.x < p.largeur / 2);
      const offsetIdx = allDims.filter(dd => dd.type === 'vertical').indexOf(dim);
      const xOff = isLeft
        ? dX - 3.5 - offsetIdx * 3.5
        : dX + dW + 3.5 + offsetIdx * 3.5;

      // Extension lines
      d.setLineDashPattern([0.4, 0.3], 0);
      d.line(isLeft ? dX : dX + dW, py1, xOff, py1);
      d.line(isLeft ? dX : dX + dW, py2, xOff, py2);
      d.setLineDashPattern([], 0);
      // Dimension line
      d.line(xOff, py1, xOff, py2);
      // Arrows
      drawPDFArrow(d, xOff, py1, 'down', col);
      drawPDFArrow(d, xOff, py2, 'up', col);
      // Tick marks
      d.line(xOff - 1, py1, xOff + 1, py1);
      d.line(xOff - 1, py2, xOff + 1, py2);
      // Value label (rotated -90°)
      const midPy = (py1 + py2) / 2;
      const label = fmtV(dim.value);
      // jsPDF text rotation: use save/restore + translate + rotate
      d.saveGraphicsState();
      // White background box (drawn at rotated coords)
      const labelW = d.getTextWidth(label) + 1.5;
      d.setFillColor(255, 255, 255);
      d.rect(xOff - 1.5, midPy - labelW / 2, 3, labelW, 'F');
      // Draw text rotated
      const textOpts = { angle: 90, align: 'center' as const };
      d.text(label, xOff + 0.2, midPy, textOpts);
      d.restoreGraphicsState();
    }

    else if (dim.type === 'distance' && mp1 && mp2) {
      const px1 = dX + mp1.x * sc, py1 = dY + mp1.y * sc;
      const px2 = dX + mp2.x * sc, py2 = dY + mp2.y * sc;
      const angle = Math.atan2(py2 - py1, px2 - px1);
      const perpOff = 3;
      const nx = -Math.sin(angle) * perpOff, ny = Math.cos(angle) * perpOff;
      // Extension
      d.setLineDashPattern([0.4, 0.3], 0);
      d.line(px1, py1, px1 + nx, py1 + ny);
      d.line(px2, py2, px2 + nx, py2 + ny);
      d.setLineDashPattern([], 0);
      // Dim line
      d.line(px1 + nx, py1 + ny, px2 + nx, py2 + ny);
      // Value
      const midX = (px1 + px2) / 2 + nx, midY = (py1 + py2) / 2 + ny;
      const label = fmtV(dim.value);
      const labelW = d.getTextWidth(label) + 1.5;
      d.setFillColor(255, 255, 255); d.rect(midX - labelW / 2, midY - 2, labelW, 3, 'F');
      d.text(label, midX, midY + 0.3, { align: 'center' });
    }

    else if (dim.type === 'radius') {
      const trou = p.trous.find(t => t.id === dim.source.id1);
      if (!trou) return;
      const cx = dX + trou.x * sc, cy = dY + trou.y * sc;
      const label = `∅${fmtV(dim.value)}`;
      // Leader line
      d.setLineWidth(0.08);
      d.line(cx, cy, cx + 6, cy - 3);
      d.line(cx + 6, cy - 3, cx + 12, cy - 3);
      // Label
      d.setFillColor(255, 255, 255);
      const labelW = d.getTextWidth(label) + 1;
      d.rect(cx + 6, cy - 5, labelW, 3, 'F');
      d.text(label, cx + 6.5, cy - 2.8);
    }
  });

  // Position cursor after the drawing
  const drawingBottom = dY + dH + 12 + allDims.filter(dd => dd.type === 'horizontal' && (dd.displayOffset >= 0 || (dd as any)._manual)).length * 3.5;
  pdf.y = Math.max(drawingBottom, dY + dH + 10);

  // ─── Nomenclature ───
  pdf.section('Nomenclature');
  pdf.info([['Réf', p.reference], ['Matière', mc.nom], ['Ép.', `${p.epaisseur}mm`],
    ['Finition', FINITIONS.find(f => f.id === p.finition)?.nom || 'Brut'], ['Statut', p.statut]], 3);

  if (p.plis.length > 0) {
    pdf.section('Pliage');
    pdf.table(['#', 'Pos', 'Angle', 'Ri', 'Dir', 'BA', 'Force', 'Vé'],
      p.plis.map((x, i) => [
        String(i + 1), `${x.position}mm`, `${x.angle}°`, `${x.rayonInterne}mm`,
        x.direction === 'haut' ? '↑' : '↓',
        bendAllowance(x.rayonInterne, p.epaisseur, x.angle, getKFactor(p.matiere, x.rayonInterne, p.epaisseur)).toFixed(2) + 'mm',
        `${bendingForce(p.hauteur, p.epaisseur, p.matiere, recommendedVOpening(p.epaisseur), x.angle).toFixed(1)}t`,
        `V${recommendedVOpening(p.epaisseur)}`,
      ]));
  }
  if (p.trous.length > 0) {
    pdf.section('Perçages');
    pdf.table(['#', 'Type', 'X', 'Y', '∅', 'Dist. bord min'], p.trous.map((t, i) => {
      const dL = t.x - t.diametre / 2, dR = p.largeur - t.x - t.diametre / 2;
      const dT = t.y - t.diametre / 2, dB = p.hauteur - t.y - t.diametre / 2;
      const minDist = Math.min(dL, dR, dT, dB);
      return [String(i + 1), t.type, `${t.x}mm`, `${t.y}mm`, `∅${t.diametre}`, `${minDist.toFixed(1)}mm${minDist < p.epaisseur * 2 ? ' ⚠' : ''}`];
    }));
  }

  // ─── Tableau récapitulatif des cotes ───
  if (allDims.length > 0) {
    pdf.section('Cotations');
    pdf.table(['#', 'Type', 'Valeur', 'Tolérance', 'Source'],
      allDims.map((dim, i) => [
        String(i + 1),
        dim.type === 'horizontal' ? 'Horiz.' : dim.type === 'vertical' ? 'Vert.' : dim.type === 'radius' ? 'Diamètre' : 'Distance',
        `${fmtV(dim.value)}mm`,
        dim.tolerance ? `+${dim.tolerance.plus}/-${dim.tolerance.minus}` : '—',
        (dim as any)._manual ? 'Manuelle' : dim.source.type === 'edge' ? 'Encombrement' : dim.source.type === 'hole_center' ? 'Entraxe' : dim.source.type === 'bend' ? 'Pli' : dim.source.type,
      ]));
  }

  if (p.remarques) { pdf.section('Remarques'); pdf.noteBox(p.remarques); }
  pdf.save(`Plan-${p.reference}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

/** Dessiner une flèche de cotation dans le PDF */
function drawPDFArrow(d: any, x: number, y: number, direction: 'left' | 'right' | 'up' | 'down', col: { r: number; g: number; b: number }) {
  d.setFillColor(col.r, col.g, col.b);
  const s = 0.8;
  switch (direction) {
    case 'right': d.triangle(x, y, x + s, y - s * 0.5, x + s, y + s * 0.5, 'F'); break;
    case 'left': d.triangle(x, y, x - s, y - s * 0.5, x - s, y + s * 0.5, 'F'); break;
    case 'down': d.triangle(x, y, x - s * 0.5, y + s, x + s * 0.5, y + s, 'F'); break;
    case 'up': d.triangle(x, y, x - s * 0.5, y - s, x + s * 0.5, y - s, 'F'); break;
  }
}
