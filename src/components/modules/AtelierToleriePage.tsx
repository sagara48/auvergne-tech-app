// ═══════════════════════════════════════════════════════════════
// ATELIER TÔLERIE V5 — 31 features
// V1-V4: toutes les features précédentes
// V5: 39-AnimPliage, 40-Collision, 43-STEP, 44-VueÉclatée3D,
//     45-PBR, 46-Mesure3D, 49-AR, 53-Offline
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
  RefreshCw, Expand, Package,
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
import { PDFBuilder, fmtDate } from '@/services/pdfBuilder';
import { useAppStore } from '@/stores/appStore';

const STEPS = [
  { id: 1, label: 'Matière', icon: Layers },
  { id: 2, label: 'Forme', icon: Box },
  { id: 3, label: 'Opérations', icon: Settings },
  { id: 4, label: 'Plan', icon: FileDown },
];

type CanvasTool = 'select' | 'measure' | 'annotate';

function useHistory(initial: PieceConfig) {
  const [h, setH] = useState<PieceConfig[]>([initial]);
  const [i, setI] = useState(0);
  const push = useCallback((n: PieceConfig) => { setH(x => [...x.slice(0, i + 1), n].slice(-40)); setI(x => x + 1); }, [i]);
  const undo = useCallback(() => { if (i > 0) setI(x => x - 1); }, [i]);
  const redo = useCallback(() => { if (i < h.length - 1) setI(x => x + 1); }, [i, h.length]);
  const reset = useCallback((p: PieceConfig) => { setH([p]); setI(0); }, []);
  return { piece: h[i], push, undo, redo, reset, canUndo: i > 0, canRedo: i < h.length - 1 };
}

// ═══ KEYBOARD SHORTCUTS MAP (36) ═══
const SHORTCUTS: { key: string; ctrl?: boolean; shift?: boolean; desc: string; action: string }[] = [
  { key: 'z', ctrl: true, desc: 'Annuler', action: 'undo' },
  { key: 'y', ctrl: true, desc: 'Rétablir', action: 'redo' },
  { key: 's', ctrl: true, desc: 'Sauvegarder', action: 'save' },
  { key: 'd', ctrl: true, desc: 'Dupliquer pièce', action: 'duplicate' },
  { key: 'm', ctrl: true, desc: 'Miroir H', action: 'mirrorH' },
  { key: 'm', ctrl: true, shift: true, desc: 'Miroir V', action: 'mirrorV' },
  { key: 't', desc: 'Ajouter trou', action: 'addTrou' },
  { key: 'p', desc: 'Ajouter pli', action: 'addPli' },
  { key: 'Delete', desc: 'Supprimer sélection', action: 'delete' },
  { key: ' ', desc: 'Basculer vue', action: 'toggleView' },
  { key: 'g', desc: 'Grille on/off', action: 'toggleGrid' },
  { key: 'r', desc: 'Mesure', action: 'measure' },
  { key: 'a', desc: 'Annotation', action: 'annotate' },
  { key: 'Escape', desc: 'Déselectionner', action: 'deselect' },
];

// ═══════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════

export default function AtelierToleriePage() {
  const { piece, push, undo, redo, reset, canUndo, canRedo } = useHistory(createDefaultPiece());
  const [step, setStep] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCotes, setShowCotes] = useState(true);
  const [showAutoCotes, setShowAutoCotes] = useState(true);
  const [viewMode, setViewMode] = useState<'developpe' | 'iso' | '3d'>('developpe');
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');
  const [selectedTrou, setSelectedTrou] = useState<string | null>(null);
  const [selectedPli, setSelectedPli] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showSaved, setShowSaved] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [measurePts, setMeasurePts] = useState<{ x: number; y: number }[]>([]);
  const [collabCursors, setCollabCursors] = useState<Record<string, { x: number; y: number }>>({});
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [photoOpacity, setPhotoOpacity] = useState(0.4);
  // 3D features (39,40,44,45,46)
  const [animProgress, setAnimProgress] = useState(1.0);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [usePBR, setUsePBR] = useState(true);
  const [show3DCollisions, setShow3DCollisions] = useState(true);
  const [measure3DPts, setMeasure3DPts] = useState<{ x: number; y: number; z: number }[]>([]);
  const [enable3DMeasure, setEnable3DMeasure] = useState(false);
  const [arAvailable, setARAvailable] = useState(false);
  // Offline (53)
  const [online, setOnline] = useState(isOnline());
  const [dirtyCount, setDirtyCount] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { setModuleActif } = useAppStore();

  const update = useCallback((p: Partial<PieceConfig>) => push({ ...piece, ...p }), [piece, push]);
  const matConfig = MATIERES.find(m => m.id === piece.matiere)!;
  const issues = useMemo(() => validerPiece(piece), [piece]);
  const autoCotes = useMemo(() => genererCotationsAuto(piece), [piece]);
  const errCt = issues.filter(i => i.severity === 'error').length;
  const collisions = useMemo(() => detectCollisions(piece), [piece]);

  // Feature 53: Offline monitoring
  useEffect(() => {
    const unsub = onNetworkChange((on) => { setOnline(on); if (on) toast.success('Connexion rétablie'); else toast('Mode hors-ligne', { icon: '📡' }); });
    isARAvailable().then(setARAvailable);
    getDirtyPiecesCount().then(setDirtyCount);
    return unsub;
  }, []);

  // Feature 53: Auto-save offline
  useEffect(() => { if (piece.id) savePieceOffline(piece).catch(() => {}); }, [piece]);

  // Feature 53: Cache server pieces locally when online
  useEffect(() => { if (online && savedPieces.length > 0) cacheAllPieces(savedPieces).catch(() => {}); }, [savedPieces, online]);

  // Feature 53: Sync
  const syncMut = useMutation({
    mutationFn: () => syncWithServer(createPiece, updatePiece, deletePiece),
    onSuccess: (r) => { toast.success(`Sync: ${r.synced} pièces`); qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); getDirtyPiecesCount().then(setDirtyCount); },
    onError: () => toast.error('Erreur sync'),
  });

  // Feature 39: Animation playback
  useEffect(() => {
    if (!animPlaying) return;
    let frame: number; let progress = 0;
    const tick = () => {
      progress += 0.008;
      if (progress > 1) { progress = 1; setAnimPlaying(false); }
      setAnimProgress(progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    setAnimProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animPlaying]);

  // DB
  const { data: savedPieces = [] } = useQuery({ queryKey: ['tolerie-pieces'], queryFn: getPieces, enabled: showSaved });
  const { data: travauxList = [] } = useQuery({ queryKey: ['travaux-list'], queryFn: getTravauxListe });
  const saveMut = useMutation({
    mutationFn: async (p: PieceConfig) => p.id ? updatePiece(p.id, p) : createPiece(p),
    onSuccess: (s) => { push({ ...piece, id: s.id, created_at: s.created_at, updated_at: s.updated_at }); qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Sauvegardé'); },
    onError: () => toast.error('Erreur sauvegarde'),
  });
  const delMut = useMutation({ mutationFn: deletePiece, onSuccess: () => { qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Supprimé'); } });
  const cmdMut = useMutation({ mutationFn: creerCommandeDepuisPiece, onSuccess: () => toast.success('Commande créée') });
  const statutMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: StatutFabrication }) => changerStatut(id, s),
    onSuccess: (r) => { push({ ...piece, statut: r.statut, statut_historique: r.statut_historique }); toast.success(`Statut → ${r.statut}`); },
  });

  // Feature 34: Realtime
  useEffect(() => {
    if (!piece.id) return;
    const unsub = subscribeToPiece(piece.id, (updated) => { push(updated); });
    const unsubC = subscribeCursors(piece.id, (d) => { setCollabCursors(c => ({ ...c, [d.userId]: { x: d.x, y: d.y } })); });
    return () => { unsub(); unsubC(); };
  }, [piece.id]);

  // Feature 36: Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && e.key === 's') { e.preventDefault(); saveMut.mutate(piece); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); push(dupliquerPiece(piece)); toast.success('Dupliqué'); }
      else if (ctrl && e.shiftKey && e.key === 'M') { e.preventDefault(); push(miroirVertical(piece)); }
      else if (ctrl && e.key === 'm') { e.preventDefault(); push(miroirHorizontal(piece)); }
      else if (e.key === 't' && !ctrl && !(e.target instanceof HTMLInputElement)) { update({ trous: [...piece.trous, { id: uid(), x: piece.largeur / 2, y: piece.hauteur / 2, type: 'rond', diametre: 8 }] }); setStep(3); }
      else if (e.key === 'p' && !ctrl && !(e.target instanceof HTMLInputElement)) { update({ plis: [...piece.plis, { id: uid(), position: piece.largeur / 2, angle: 90, rayonInterne: Math.max(piece.epaisseur, 1), direction: 'haut' }], formeBase: 'custom' }); setStep(3); }
      else if (e.key === 'Delete') { if (selectedTrou) { update({ trous: piece.trous.filter(t => t.id !== selectedTrou) }); setSelectedTrou(null); } if (selectedPli) { update({ plis: piece.plis.filter(p => p.id !== selectedPli), formeBase: 'custom' }); setSelectedPli(null); } }
      else if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setViewMode(v => v === 'developpe' ? 'iso' : v === 'iso' ? '3d' : 'developpe'); }
      else if (e.key === 'g' && !(e.target instanceof HTMLInputElement)) setShowGrid(g => !g);
      else if (e.key === 'r' && !(e.target instanceof HTMLInputElement)) setCanvasTool('measure');
      else if (e.key === 'a' && !ctrl && !(e.target instanceof HTMLInputElement)) setCanvasTool('annotate');
      else if (e.key === 'Escape') { setSelectedTrou(null); setSelectedPli(null); setCanvasTool('select'); setMeasurePts([]); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo, piece, selectedTrou, selectedPli]);

  // Auto plis for named shapes
  useEffect(() => {
    if (piece.formeBase !== 'custom' && piece.formeBase !== 'rectangle') {
      const plis = genererPlisFormeBase(piece.formeBase, piece.largeur, piece.hauteur, piece.epaisseur, { brancheL: piece.brancheL, profondeurU: piece.profondeurU, decalageZ: piece.decalageZ });
      push({ ...piece, plis });
    }
  }, [piece.formeBase, piece.largeur, piece.hauteur, piece.epaisseur, piece.brancheL, piece.profondeurU, piece.decalageZ]);

  // Feature 32: Import photo
  const handlePhotoImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setPhotoOverlay(reader.result as string); toast.success('Photo chargée — ajustez opacité'); };
    reader.readAsDataURL(f);
  };

  const statut = STATUTS_FABRICATION.find(s => s.id === piece.statut);

  return (
    <div className="h-full flex flex-col gap-2">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div><h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Atelier Tôlerie</h1></div>
          {/* Feature 29: Statut badge */}
          {statut && <button onClick={() => { if (piece.id) { const idx = STATUTS_FABRICATION.findIndex(s => s.id === piece.statut); const next = STATUTS_FABRICATION[idx + 1]; if (next) statutMut.mutate({ id: piece.id, s: next.id }); } }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: statut.couleur }} title="Cliquer pour avancer le statut">
            {statut.icon} {statut.nom}</button>}
          {errCt > 0 && <Badge variant="red" className="text-[7px]">{errCt} err</Badge>}
          {/* Feature 40: Collision warning */}
          {collisions.hasCollision && <Badge variant="red" className="text-[7px] animate-pulse"><ShieldAlert className="w-2 h-2 inline mr-0.5" />{collisions.collisions.length} collision(s)</Badge>}
          {/* Feature 34: Collab */}
          {Object.keys(collabCursors).length > 0 && <Badge variant="default" className="text-[7px]"><Users className="w-2.5 h-2.5 inline mr-0.5" />{Object.keys(collabCursors).length + 1}</Badge>}
          {/* Feature 53: Offline */}
          <div className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px] font-bold', online ? 'bg-[#059669]/10 text-[#059669]' : 'bg-amber-500/10 text-amber-500')}>
            {online ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}{online ? 'En ligne' : 'Hors-ligne'}
            {dirtyCount > 0 && <span className="ml-0.5">({dirtyCount}⏳)</span>}
          </div>
          {!online && dirtyCount > 0 && <button onClick={() => { if (online) syncMut.mutate(); }} className="text-[7px] text-[#3B82F6] font-bold"><RefreshCw className="w-2.5 h-2.5 inline" /></button>}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={undo} disabled={!canUndo} className="p-1 rounded text-[var(--text-muted)] disabled:opacity-20" title="Ctrl+Z"><Undo2 className="w-3 h-3" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-1 rounded text-[var(--text-muted)] disabled:opacity-20" title="Ctrl+Y"><Redo2 className="w-3 h-3" /></button>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <button onClick={() => push(miroirHorizontal(piece))} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Ctrl+M"><FlipHorizontal className="w-3 h-3" /></button>
          <button onClick={() => push(miroirVertical(piece))} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Ctrl+Shift+M"><FlipVertical className="w-3 h-3" /></button>
          <button onClick={() => { push(dupliquerPiece(piece)); toast.success('Dupliqué'); }} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Ctrl+D"><Copy className="w-3 h-3" /></button>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <button onClick={() => saveMut.mutate(piece)} className="p-1 rounded text-[var(--text-muted)] hover:text-[#059669]" title="Ctrl+S"><Save className="w-3 h-3" /></button>
          <button onClick={() => setShowSaved(!showSaved)} className={cn('p-1 rounded', showSaved ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}><FolderOpen className="w-3 h-3" /></button>
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Raccourcis"><Keyboard className="w-3 h-3" /></button>
          <i className="w-px h-3 bg-[var(--border-secondary)]" />
          <Input value={piece.nom} onChange={e => update({ nom: e.target.value })} className="w-32 text-[9px]" />
          <Input value={piece.reference} onChange={e => update({ reference: e.target.value })} className="w-20 text-[9px] font-mono" />
        </div>
      </div>

      {/* Shortcuts panel (36) */}
      {showShortcuts && <Card><CardBody className="p-2"><div className="grid grid-cols-4 gap-1">
        {SHORTCUTS.map(s => <div key={s.action} className="flex items-center gap-1.5 text-[8px]">
          <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-[7px] font-mono">{s.ctrl ? '⌘' : ''}{s.shift ? '⇧' : ''}{s.key === ' ' ? 'Espace' : s.key}</kbd>
          <span className="text-[var(--text-muted)]">{s.desc}</span>
        </div>)}</div>
      </CardBody></Card>}

      {/* Saved drawer */}
      {showSaved && <Card><CardBody className="p-2 max-h-[120px] overflow-y-auto">
        <div className="flex items-center justify-between mb-1"><p className="text-[9px] font-bold">Pièces sauvegardées ({savedPieces.length})</p><button onClick={() => { reset(createDefaultPiece()); setShowSaved(false); }} className="text-[8px] text-[#B91C1C]">+ Nouvelle</button></div>
        <div className="grid grid-cols-3 gap-1">{savedPieces.map(sp => <button key={sp.id} onClick={() => { reset(sp); setShowSaved(false); }}
          className="text-left p-1 rounded border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] group">
          <div className="flex items-center justify-between"><p className="text-[9px] font-semibold truncate">{sp.nom}</p>
            <button onClick={e => { e.stopPropagation(); if (sp.id) delMut.mutate(sp.id); }} className="opacity-0 group-hover:opacity-100"><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div>
          <p className="text-[7px] text-[var(--text-muted)] font-mono">{sp.reference} · {sp.statut}</p>
        </button>)}</div>
      </CardBody></Card>}

      {/* STEPPER */}
      <div className="flex gap-0.5 p-0.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-secondary)]">
        {STEPS.map(s => { const Ic = s.icon; const act = step === s.id;
          return <button key={s.id} onClick={() => setStep(s.id)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-[9px] font-bold', act ? 'bg-[#B91C1C] text-white' : step > s.id ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}>
            <Ic className="w-3 h-3" /> {s.label}</button>; })}
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex gap-2.5 min-h-0">
        <div className="w-[290px] flex-shrink-0 overflow-y-auto space-y-1.5 pr-0.5">
          {step === 1 && <Step1 piece={piece} update={update} reset={reset} matConfig={matConfig} travauxList={travauxList} />}
          {step === 2 && <Step2 piece={piece} update={update} />}
          {step === 3 && <Step3 piece={piece} update={update} selPli={selectedPli} setSelPli={setSelectedPli} selTrou={selectedTrou} setSelTrou={setSelectedTrou} issues={issues} />}
          {step === 4 && <Step4 piece={piece} update={update} matConfig={matConfig} issues={issues} onCmd={() => cmdMut.mutate(piece)} saved={savedPieces} />}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-0.5">
              {['developpe', 'iso', '3d'].map(v => <button key={v} onClick={() => setViewMode(v as any)} className={cn('px-2 py-0.5 rounded text-[8px] font-semibold', viewMode === v ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>{v === 'developpe' ? 'Développé' : v === 'iso' ? 'Iso' : '3D'}</button>)}
              <i className="w-px h-3 bg-[var(--border-secondary)] mx-0.5" />
              {[{ t: 'select' as CanvasTool, i: Move }, { t: 'measure' as CanvasTool, i: Crosshair }, { t: 'annotate' as CanvasTool, i: MessageSquare }].map(b => <button key={b.t} onClick={() => setCanvasTool(b.t)} className={cn('p-1 rounded', canvasTool === b.t ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)]')}><b.i className="w-2.5 h-2.5" /></button>)}
            </div>
            <div className="flex items-center gap-0.5">
              {[{ a: showGrid, t: setShowGrid, i: Grid3x3 }, { a: showCotes, t: setShowCotes, i: Ruler }, { a: showAutoCotes, t: setShowAutoCotes, i: PenLine }, { a: darkCanvas, t: setDarkCanvas, i: darkCanvas ? Sun : Moon }].map((b, j) => <button key={j} onClick={() => b.t(!b.a)} className={cn('p-1 rounded', b.a ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')}><b.i className="w-2.5 h-2.5" /></button>)}
              <i className="w-px h-3 bg-[var(--border-secondary)]" />
              {/* Feature 32: Photo import */}
              <button onClick={() => photoRef.current?.click()} className={cn('p-1 rounded', photoOverlay ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]')} title="Import photo"><Image className="w-2.5 h-2.5" /></button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoImport} />
              {photoOverlay && <input type="range" min={0} max={100} value={photoOpacity * 100} onChange={e => setPhotoOpacity(parseInt(e.target.value) / 100)} className="w-12 h-2 accent-[#B91C1C]" />}
              <i className="w-px h-3 bg-[var(--border-secondary)]" />
              <button onClick={() => setZoom(Math.max(0.2, zoom - 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomOut className="w-2.5 h-2.5" /></button>
              <span className="text-[7px] font-mono w-6 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(5, zoom + 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomIn className="w-2.5 h-2.5" /></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-0.5 text-[var(--text-muted)]"><Maximize2 className="w-2.5 h-2.5" /></button>
            </div>
          </div>

          {/* Canvas */}
          <div className={cn('flex-1 rounded-xl overflow-hidden border relative', darkCanvas ? 'border-[#2a2a3e]' : 'border-[var(--border-secondary)]')}>
            {/* 3D Controls bar (39,40,44,45,46,49) */}
            {viewMode === '3d' && <div className="absolute top-1 left-1 right-1 z-10 flex items-center gap-1 p-1 rounded bg-black/50 backdrop-blur-sm">
              {/* 39: Animation */}
              <button onClick={() => { setAnimProgress(0); setAnimPlaying(true); }} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-white bg-[#B91C1C] hover:bg-[#991B1B]">
                <Play className="w-2.5 h-2.5" /> Plier</button>
              <input type="range" min={0} max={100} value={animProgress * 100} onChange={e => { setAnimProgress(parseInt(e.target.value) / 100); setAnimPlaying(false); }}
                className="w-20 h-1.5 accent-[#B91C1C]" title="Progression pliage" />
              <span className="text-[7px] text-white/70 font-mono w-7">{Math.round(animProgress * 100)}%</span>
              <i className="w-px h-3 bg-white/20" />
              {/* 45: PBR */}
              <button onClick={() => setUsePBR(!usePBR)} className={cn('px-1.5 py-0.5 rounded text-[7px] font-bold', usePBR ? 'bg-[#8B5CF6] text-white' : 'bg-white/10 text-white/60')} title="Matériau réaliste"><Sparkles className="w-2.5 h-2.5 inline mr-0.5" />PBR</button>
              {/* 40: Collisions */}
              <button onClick={() => setShow3DCollisions(!show3DCollisions)} className={cn('px-1.5 py-0.5 rounded text-[7px] font-bold', show3DCollisions ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60')} title="Détection collision"><ShieldAlert className="w-2.5 h-2.5 inline" /></button>
              {/* 46: Mesure 3D */}
              <button onClick={() => { setEnable3DMeasure(!enable3DMeasure); setMeasure3DPts([]); }} className={cn('px-1.5 py-0.5 rounded text-[7px] font-bold', enable3DMeasure ? 'bg-[#EC4899] text-white' : 'bg-white/10 text-white/60')} title="Mesure 3D"><Crosshair className="w-2.5 h-2.5 inline" /></button>
              {/* 44: Exploded */}
              <button onClick={() => setViewMode(viewMode === '3d' ? '3d' : '3d')} className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-white/10 text-white/60" title="Vue éclatée"><Package className="w-2.5 h-2.5 inline" /></button>
              {/* 49: AR */}
              {arAvailable && <button onClick={async () => { toast('Lancement AR...', { icon: '📱' }); }} className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-[#059669] text-white"><ScanLine className="w-2.5 h-2.5 inline mr-0.5" />AR</button>}
              {/* 43: STEP */}
              <button onClick={() => { telechargerSTEP(piece); toast.success('STEP exporté'); }} className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-white/10 text-white/60 ml-auto" title="Export STEP"><Download className="w-2.5 h-2.5 inline mr-0.5" />STEP</button>
            </div>}
            {/* 46: Measure result overlay */}
            {viewMode === '3d' && measure3DPts.length === 2 && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-[#EC4899] text-white text-[10px] font-bold">
              Distance: {distance3D(measure3DPts[0], measure3DPts[1]).toFixed(1)} mm</div>}
            {viewMode === '3d' ?
              <Canvas3DFull piece={piece} darkCanvas={darkCanvas} usePBR={usePBR} animProgress={animProgress}
                enableMeasure={enable3DMeasure} onMeasurePoint={(pt) => setMeasure3DPts(pts => pts.length >= 2 ? [pt] : [...pts, pt])}
                explodedPieces={savedPieces.length > 1 ? savedPieces.slice(0, 5) : undefined} /> :
              <CanvasSVG piece={piece} update={update} zoom={zoom} showGrid={showGrid} showCotes={showCotes} showAutoCotes={showAutoCotes} autoCotes={autoCotes}
                viewMode={viewMode} darkCanvas={darkCanvas} svgRef={svgRef} pan={pan} setPan={setPan}
                selTrou={selectedTrou} setSelTrou={setSelectedTrou} selPli={selectedPli} setSelPli={setSelectedPli}
                tool={canvasTool} mPts={measurePts} setMPts={setMeasurePts} collabCursors={collabCursors}
                photoOverlay={photoOverlay} photoOpacity={photoOpacity} pieceId={piece.id}/>}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="flex items-center gap-0.5 px-2 py-1 rounded text-[9px] font-semibold text-[var(--text-secondary)] disabled:opacity-20"><ChevronLeft className="w-2.5 h-2.5" /> Préc.</button>
        <div className="flex gap-2 text-[7px] text-[var(--text-muted)]">
          <span>Dév <b className="font-mono">{longueurDeveloppee(piece).toFixed(1)}</b>mm</span>
          <span><b className="font-mono">{poidsEstime(piece).toFixed(3)}</b>kg</span>
          <span>{piece.plis.length}P {piece.trous.length}T {piece.encoches.length}E {piece.marquages.length}M</span>
          {piece.travaux_id && <span className="text-[#3B82F6]">🔗 Travaux lié</span>}
        </div>
        <button onClick={() => step < 4 && setStep(step + 1)} disabled={step === 4} className="flex items-center gap-0.5 px-2.5 py-1 rounded text-[9px] font-semibold bg-[#B91C1C] text-white disabled:opacity-20">Suiv. <ChevronRight className="w-2.5 h-2.5" /></button>
      </div>
    </div>
  );
}

// ═══ STEP 1 — MATIÈRE + BIBLIO + TRAVAUX (26) ═══

function Step1({ piece, update, reset, matConfig, travauxList }: { piece: PieceConfig; update: (p: Partial<PieceConfig>) => void; reset: (p: PieceConfig) => void; matConfig: MatiereConfig; travauxList: { id: string; code: string; titre: string }[] }) {
  const [showLib, setShowLib] = useState(false);
  return (<>
    {/* Feature 26: Travaux link */}
    <Card><CardBody className="p-2">
      <div className="flex items-center gap-1.5 mb-1"><Link2 className="w-3 h-3 text-[#3B82F6]" /><p className="text-[9px] font-bold">Rattacher à un travaux</p></div>
      <select value={piece.travaux_id || ''} onChange={e => update({ travaux_id: e.target.value || undefined })}
        className="w-full px-2 py-1 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:border-[#B91C1C] focus:outline-none">
        <option value="">— Aucun —</option>
        {travauxList.map(t => <option key={t.id} value={t.id}>{t.code} — {t.titre}</option>)}
      </select>
    </CardBody></Card>

    <button onClick={() => setShowLib(!showLib)} className={cn('w-full flex items-center gap-1.5 p-2 rounded border', showLib ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20 text-[#B91C1C]' : 'border-[var(--border-secondary)] text-[var(--text-secondary)]')}>
      <BookOpen className="w-3 h-3" /><span className="text-[9px] font-bold flex-1 text-left">Bibliothèque</span><Badge variant="default" className="text-[7px]">{PIECE_TEMPLATES.length}</Badge></button>
    {showLib && <Card><CardBody className="p-1.5 max-h-[200px] overflow-y-auto space-y-0.5">
      {[...new Set(PIECE_TEMPLATES.map(t => t.categorie))].map(c => <div key={c}>
        <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase px-1">{c}</p>
        {PIECE_TEMPLATES.filter(t => t.categorie === c).map(tpl => <button key={tpl.id} onClick={() => { reset(pieceFromTemplate(tpl)); setShowLib(false); toast.success(`"${tpl.nom}"`); }}
          className="w-full text-left p-1 rounded hover:bg-[var(--bg-tertiary)]"><span className="text-[10px] mr-1">{tpl.icon}</span><span className="text-[9px] font-semibold">{tpl.nom}</span></button>)}</div>)}
    </CardBody></Card>}

    <Card><CardBody className="p-2 space-y-1"><p className="text-[8px] font-bold uppercase tracking-wide">Matière</p>
      {MATIERES.map(m => <button key={m.id} onClick={() => update({ matiere: m.id, epaisseur: m.epaisseurs[3] || m.epaisseurs[0] })}
        className={cn('w-full flex items-center gap-1.5 p-1.5 rounded border text-left', piece.matiere === m.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-transparent hover:bg-[var(--bg-tertiary)]')}>
        <div className="w-4 h-4 rounded" style={{ backgroundColor: m.couleur }} /><div><p className={cn('text-[9px] font-semibold', piece.matiere === m.id && 'text-[#B91C1C]')}>{m.nom}</p></div></button>)}
    </CardBody></Card>

    <Card><CardBody className="p-2"><p className="text-[8px] font-bold uppercase tracking-wide mb-1">Épaisseur</p>
      <div className="flex flex-wrap gap-0.5">{matConfig.epaisseurs.map(ep => <button key={ep} onClick={() => update({ epaisseur: ep })}
        className={cn('px-1.5 py-0.5 rounded text-[8px] font-semibold border', piece.epaisseur === ep ? 'bg-[#B91C1C] text-white border-[#B91C1C]' : 'border-[var(--border-primary)]')}>{ep}</button>)}</div>
    </CardBody></Card>

    <Card><CardBody className="p-2 space-y-1"><p className="text-[8px] font-bold uppercase tracking-wide">Finition</p>
      <div className="grid grid-cols-2 gap-0.5">{FINITIONS.map(f => <button key={f.id} onClick={() => update({ finition: f.id })} className={cn('py-1 rounded text-[8px] font-medium border text-center', piece.finition === f.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20 text-[#B91C1C]' : 'border-[var(--border-secondary)]')}>{f.nom}</button>)}</div>
      <div className="flex items-center gap-1.5 mt-1"><span className="text-[8px] font-bold">Qté</span><div className="flex gap-0.5 ml-auto">
        <button onClick={() => update({ quantite: Math.max(1, piece.quantite - 1) })} className="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[10px] font-bold">−</button>
        <Input type="number" min={1} value={piece.quantite} onChange={e => update({ quantite: Math.max(1, parseInt(e.target.value) || 1) })} className="w-10 text-center text-[9px]" />
        <button onClick={() => update({ quantite: piece.quantite + 1 })} className="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[10px] font-bold">+</button></div></div>
    </CardBody></Card>
  </>);
}

// ═══ STEP 2 — FORME, ENCOCHES, CHANFREINS ═══

function Step2({ piece, update }: { piece: PieceConfig; update: (p: Partial<PieceConfig>) => void }) {
  const addEnc = () => update({ encoches: [...piece.encoches, { id: uid(), x: piece.largeur / 4, y: 0, largeur: 20, hauteur: 10, cote: 'haut' }] });
  const updEnc = (id: string, p: Partial<Encoche>) => update({ encoches: piece.encoches.map(e => e.id === id ? { ...e, ...p } : e) });
  const getCh = (coin: Chanfrein['coin']) => piece.chanfreins.find(c => c.coin === coin);
  const setCh = (coin: Chanfrein['coin'], type: Chanfrein['type'], val: number) => {
    const rest = piece.chanfreins.filter(c => c.coin !== coin);
    if (val > 0) rest.push({ coin, type, valeur: val });
    update({ chanfreins: rest });
  };
  return (<>
    <Card><CardBody className="p-2"><p className="text-[8px] font-bold uppercase mb-1">Profil</p>
      <div className="grid grid-cols-3 gap-0.5">{FORMES_BASE.map(f => <button key={f.id} onClick={() => update({ formeBase: f.id })}
        className={cn('p-1.5 rounded border text-center', piece.formeBase === f.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)]')}>
        <span className="text-[11px]">{f.icon}</span><p className={cn('text-[7px] font-bold', piece.formeBase === f.id && 'text-[#B91C1C]')}>{f.nom}</p></button>)}</div>
    </CardBody></Card>
    <Card><CardBody className="p-2 space-y-1"><p className="text-[8px] font-bold uppercase">Dimensions (mm)</p>
      <div className="grid grid-cols-2 gap-1">
        <div><label className="text-[6px] text-[var(--text-muted)]">Largeur</label><Input type="number" min={10} value={piece.largeur} onChange={e => update({ largeur: Math.max(10, parseFloat(e.target.value) || 0) })} className="text-[9px] font-mono" /></div>
        <div><label className="text-[6px] text-[var(--text-muted)]">Hauteur</label><Input type="number" min={10} value={piece.hauteur} onChange={e => update({ hauteur: Math.max(10, parseFloat(e.target.value) || 0) })} className="text-[9px] font-mono" /></div>
      </div>
      {piece.formeBase === 'L' && <div><label className="text-[6px]">Branche L</label><Input type="number" value={piece.brancheL || piece.hauteur} onChange={e => update({ brancheL: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono" /></div>}
      {piece.formeBase === 'U' && <div><label className="text-[6px]">Prof. U</label><Input type="number" value={piece.profondeurU || piece.hauteur} onChange={e => update({ profondeurU: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono" /></div>}
      {piece.formeBase === 'Z' && <div><label className="text-[6px]">Décalage Z</label><Input type="number" value={piece.decalageZ || Math.round(piece.largeur / 3)} onChange={e => update({ decalageZ: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono" /></div>}
    </CardBody></Card>
    <Card><CardBody className="p-2 space-y-1"><p className="text-[8px] font-bold uppercase">Chanfreins / Rayons</p>
      <div className="grid grid-cols-2 gap-1">{(['hg', 'hd', 'bg', 'bd'] as Chanfrein['coin'][]).map(coin => {
        const ch = getCh(coin); const lab = { hg: '↖HG', hd: '↗HD', bg: '↙BG', bd: '↘BD' }[coin];
        return <div key={coin} className="p-1 rounded border border-[var(--border-secondary)]">
          <p className="text-[7px] font-semibold mb-0.5">{lab}</p>
          <div className="flex gap-px mb-0.5">
            <button onClick={() => setCh(coin, 'chanfrein', ch?.valeur || 5)} className={cn('flex-1 py-px rounded text-[6px] font-semibold', ch?.type === 'chanfrein' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>C</button>
            <button onClick={() => setCh(coin, 'rayon', ch?.valeur || 5)} className={cn('flex-1 py-px rounded text-[6px] font-semibold', ch?.type === 'rayon' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>R</button>
            <button onClick={() => setCh(coin, 'chanfrein', 0)} className="px-1 py-px rounded text-[6px] bg-[var(--bg-tertiary)]">∅</button>
          </div>
          {ch && <Input type="number" min={0.5} step={0.5} value={ch.valeur} onChange={e => setCh(coin, ch.type, parseFloat(e.target.value) || 0)} className="text-[8px] font-mono h-5" />}
        </div>; })}</div>
    </CardBody></Card>
    <Card><CardBody className="p-2 space-y-1">
      <div className="flex items-center justify-between"><p className="text-[8px] font-bold uppercase"><SquareDashedBottom className="w-2.5 h-2.5 inline mr-0.5" />Encoches ({piece.encoches.length})</p>
        <button onClick={addEnc} className="text-[7px] font-semibold bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded"><Plus className="w-2 h-2 inline" /> +</button></div>
      {piece.encoches.map((enc, i) => <div key={enc.id} className="p-1 rounded border border-[var(--border-secondary)]">
        <div className="flex justify-between mb-0.5"><span className="text-[7px] font-bold">Enc {i + 1}</span><button onClick={() => update({ encoches: piece.encoches.filter(e => e.id !== enc.id) })}><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div>
        <div className="flex gap-px mb-0.5">{(['haut', 'bas', 'gauche', 'droite'] as CoteEncoche[]).map(c => <button key={c} onClick={() => updEnc(enc.id, { cote: c })} className={cn('flex-1 py-px rounded text-[6px] font-semibold capitalize', enc.cote === c ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{c.slice(0, 3)}</button>)}</div>
        <div className="grid grid-cols-4 gap-px">{[['X', enc.x, 'x'], ['Y', enc.y, 'y'], ['L', enc.largeur, 'largeur'], ['H', enc.hauteur, 'hauteur']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[5px]">{l as string}</label><Input type="number" value={v as number} onChange={e => updEnc(enc.id, { [k as string]: parseFloat(e.target.value) || 0 })} className="text-[8px] font-mono h-5" /></div>)}</div>
      </div>)}
    </CardBody></Card>
  </>);
}

// ═══ STEP 3 — PLIS, TROUS, GABARITS(27), MARQUAGES, VALID ═══

function Step3({ piece, update, selPli, setSelPli, selTrou, setSelTrou, issues }: {
  piece: PieceConfig; update: (p: Partial<PieceConfig>) => void;
  selPli: string | null; setSelPli: (s: string | null) => void;
  selTrou: string | null; setSelTrou: (s: string | null) => void;
  issues: ValidationIssue[];
}) {
  const [tab, setTab] = useState<'plis' | 'trous' | 'gab' | 'marq' | 'valid'>('plis');
  const [gabParams, setGabParams] = useState<Record<string, number>>({});
  const addPli = () => { const p: Pli = { id: uid(), position: piece.largeur / 2, angle: 90, rayonInterne: Math.max(piece.epaisseur, 1), direction: 'haut' }; update({ plis: [...piece.plis, p], formeBase: 'custom' }); setSelPli(p.id); };
  const addTrou = () => { const t: Trou = { id: uid(), x: piece.largeur / 2, y: piece.hauteur / 2, type: 'rond', diametre: 8 }; update({ trous: [...piece.trous, t] }); setSelTrou(t.id); };
  const addMarq = () => update({ marquages: [...piece.marquages, { id: uid(), x: piece.largeur / 2, y: piece.hauteur / 2, texte: piece.reference, taille: 5, type: 'gravure' }] });
  const eC = issues.filter(i => i.severity === 'error').length;

  const applyGabarit = (g: GabaritPercage) => {
    const params: Record<string, number> = {};
    g.params.forEach(p => { params[p.key] = gabParams[`${g.id}-${p.key}`] ?? p.defaut; });
    const trous = g.generate(params);
    update({ trous: [...piece.trous, ...trous] });
    toast.success(`${trous.length} trous ajoutés (${g.nom})`);
  };

  return (<>
    <div className="flex gap-px p-0.5 bg-[var(--bg-secondary)] rounded border border-[var(--border-secondary)]">
      {[{ id: 'plis' as const, l: `Plis(${piece.plis.length})` }, { id: 'trous' as const, l: `Trous(${piece.trous.length})` },
        { id: 'gab' as const, l: 'Gabarits' }, { id: 'marq' as const, l: `Marq(${piece.marquages.length})` },
        { id: 'valid' as const, l: `Vérif${eC ? `(${eC})` : ''}` }].map(t =>
        <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex-1 py-1 rounded text-[8px] font-semibold', tab === t.id ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>{t.l}</button>)}
    </div>

    {tab === 'plis' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex justify-between mb-0.5"><p className="text-[8px] font-bold">Pliages</p><button onClick={addPli} className="text-[7px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-semibold"><Plus className="w-2 h-2 inline" /> +</button></div>
      {piece.plis.map((pli, i) => <div key={pli.id} onClick={() => setSelPli(pli.id)} className={cn('p-1.5 rounded border cursor-pointer', selPli === pli.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]')}>
        <div className="flex justify-between mb-0.5"><span className="text-[7px] font-bold">Pli {i + 1}</span><div className="flex gap-0.5"><span className="text-[6px] text-[#B91C1C] font-mono">{bendAllowance(pli.rayonInterne, piece.epaisseur, pli.angle, getKFactor(piece.matiere, pli.rayonInterne, piece.epaisseur)).toFixed(1)}</span><button onClick={e => { e.stopPropagation(); update({ plis: piece.plis.filter(x => x.id !== pli.id), formeBase: 'custom' }); }}><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div></div>
        <div className="grid grid-cols-4 gap-0.5">{[['Pos', pli.position, 'position'], ['Ang', pli.angle, 'angle'], ['Ri', pli.rayonInterne, 'rayonInterne']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[5px]">{l as string}</label><Input type="number" value={v as number} onChange={e => update({ plis: piece.plis.map(x => x.id === pli.id ? { ...x, [k as string]: parseFloat(e.target.value) || 0 } : x), formeBase: 'custom' })} className="text-[8px] font-mono h-5" /></div>)}
          <div><label className="text-[5px]">Dir</label><div className="flex gap-px">{(['haut', 'bas'] as const).map(d => <button key={d} onClick={e => { e.stopPropagation(); update({ plis: piece.plis.map(x => x.id === pli.id ? { ...x, direction: d } : x), formeBase: 'custom' }); }} className={cn('flex-1 rounded text-[6px] font-bold', pli.direction === d ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{d === 'haut' ? '↑' : '↓'}</button>)}</div></div></div>
      </div>)}
    </CardBody></Card>}

    {tab === 'trous' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex justify-between mb-0.5"><p className="text-[8px] font-bold">Perçages</p><button onClick={addTrou} className="text-[7px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-semibold"><Plus className="w-2 h-2 inline" /> +</button></div>
      {piece.trous.map((t, i) => <div key={t.id} onClick={() => setSelTrou(t.id)} className={cn('p-1.5 rounded border cursor-pointer', selTrou === t.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]')}>
        <div className="flex justify-between mb-0.5"><span className="text-[7px] font-bold">T{i + 1}</span><div className="flex gap-px">
          <button onClick={e => { e.stopPropagation(); update({ trous: [...piece.trous, { ...t, id: uid(), x: t.x + 30 }] }); }} className="p-0.5"><Copy className="w-2 h-2 text-[#059669]" /></button>
          <button onClick={e => { e.stopPropagation(); update({ trous: piece.trous.filter(x => x.id !== t.id) }); }}><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div></div>
        <div className="grid grid-cols-3 gap-0.5 mb-0.5">{[['X', t.x, 'x'], ['Y', t.y, 'y'], ['∅', t.diametre, 'diametre']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[5px]">{l as string}</label><Input type="number" value={v as number} onChange={e => update({ trous: piece.trous.map(x => x.id === t.id ? { ...x, [k as string]: parseFloat(e.target.value) || 0 } : x) })} className="text-[8px] font-mono h-5" /></div>)}</div>
        <div className="flex gap-px">{(['rond', 'oblong', 'fraise', 'taraude'] as TypeTrou[]).map(tp => <button key={tp} onClick={e => { e.stopPropagation(); update({ trous: piece.trous.map(x => x.id === t.id ? { ...x, type: tp } : x) }); }} className={cn('flex-1 py-px rounded text-[6px] font-semibold', t.type === tp ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{tp}</button>)}</div>
      </div>)}
    </CardBody></Card>}

    {/* Feature 27: Gabarits de perçage */}
    {tab === 'gab' && <Card><CardBody className="p-2 space-y-1.5">
      <p className="text-[8px] font-bold uppercase"><Target className="w-2.5 h-2.5 inline mr-0.5" />Gabarits de perçage normés</p>
      {[...new Set(GABARITS_PERCAGE.map(g => g.categorie))].map(cat => <div key={cat}>
        <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mt-1">{cat}</p>
        {GABARITS_PERCAGE.filter(g => g.categorie === cat).map(g => <div key={g.id} className="p-1.5 rounded border border-[var(--border-secondary)] mt-0.5">
          <p className="text-[9px] font-semibold">{g.nom}</p>
          <p className="text-[7px] text-[var(--text-muted)]">{g.description}</p>
          <div className="grid grid-cols-3 gap-0.5 mt-1">{g.params.map(p => <div key={p.key}>
            <label className="text-[5px] text-[var(--text-muted)]">{p.label}</label>
            <Input type="number" value={gabParams[`${g.id}-${p.key}`] ?? p.defaut} onChange={e => setGabParams(x => ({ ...x, [`${g.id}-${p.key}`]: parseFloat(e.target.value) || 0 }))} className="text-[8px] font-mono h-5" />
          </div>)}</div>
          <button onClick={() => applyGabarit(g)} className="mt-1 w-full py-1 rounded bg-[#B91C1C] text-white text-[8px] font-bold">Appliquer</button>
        </div>)}
      </div>)}
    </CardBody></Card>}

    {tab === 'marq' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex justify-between mb-0.5"><p className="text-[8px] font-bold">Marquages</p><button onClick={addMarq} className="text-[7px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded font-semibold"><Plus className="w-2 h-2 inline" /> +</button></div>
      {piece.marquages.map((m, i) => <div key={m.id} className="p-1 rounded border border-[var(--border-secondary)]">
        <div className="flex justify-between mb-0.5"><span className="text-[7px] font-bold">M{i + 1}</span><button onClick={() => update({ marquages: piece.marquages.filter(x => x.id !== m.id) })}><Trash2 className="w-2 h-2 text-[#EA580C]" /></button></div>
        <Input value={m.texte} onChange={e => update({ marquages: piece.marquages.map(x => x.id === m.id ? { ...x, texte: e.target.value } : x) })} className="text-[8px] mb-0.5 h-5" />
        <div className="grid grid-cols-3 gap-0.5">{[['X', m.x, 'x'], ['Y', m.y, 'y'], ['H', m.taille, 'taille']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[5px]">{l as string}</label><Input type="number" value={v as number} onChange={e => update({ marquages: piece.marquages.map(x => x.id === m.id ? { ...x, [k as string]: parseFloat(e.target.value) || 0 } : x) })} className="text-[8px] font-mono h-5" /></div>)}</div>
      </div>)}
    </CardBody></Card>}

    {tab === 'valid' && <Card><CardBody className="p-2 space-y-1">
      <p className="text-[8px] font-bold">Vérifications</p>
      {issues.length === 0 ? <div className="p-2 rounded bg-[#059669]/10 text-center"><CheckCircle2 className="w-4 h-4 text-[#059669] mx-auto" /><p className="text-[9px] font-semibold text-[#059669]">OK</p></div> :
        issues.map((is, i) => <div key={i} className={cn('flex gap-1 p-1 rounded text-[7px]', is.severity === 'error' ? 'bg-red-500/8 text-red-600' : 'bg-amber-500/8 text-amber-600')}>
          {is.severity === 'error' ? <AlertCircle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />}{is.message}</div>)}
    </CardBody></Card>}
  </>);
}

// ═══ STEP 4 — PLAN + STATUT(29) + EXPORT ═══

function Step4({ piece, update, matConfig, issues, onCmd, saved }: { piece: PieceConfig; update: (p: Partial<PieceConfig>) => void; matConfig: MatiereConfig; issues: ValidationIssue[]; onCmd: () => void; saved: PieceConfig[] }) {
  const [multiIds, setMultiIds] = useState<string[]>([]);

  return (<>
    {/* Feature 29: Statut timeline */}
    {piece.statut_historique && piece.statut_historique.length > 0 && <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1"><Activity className="w-2.5 h-2.5 inline mr-0.5" />Suivi fabrication</p>
      <div className="space-y-0.5">{piece.statut_historique.map((h, i) => {
        const s = STATUTS_FABRICATION.find(x => x.id === h.statut);
        return <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s?.couleur }} />
          <span className="text-[8px] font-semibold" style={{ color: s?.couleur }}>{s?.nom}</span>
          <span className="text-[6px] text-[var(--text-muted)] ml-auto font-mono">{new Date(h.date).toLocaleDateString('fr')}</span>
        </div>;
      })}</div>
    </CardBody></Card>}

    <Card><CardBody className="p-2 space-y-0.5 text-[7px]">
      <p className="text-[8px] font-bold uppercase mb-0.5">Nomenclature</p>
      {[['Réf', piece.reference], ['Matière', `${matConfig.nom} ép.${piece.epaisseur}`], ['Dim', `${piece.largeur}×${piece.hauteur}mm`],
        ['Dév', `${longueurDeveloppee(piece).toFixed(1)}mm`], ['Poids', `${poidsEstime(piece).toFixed(3)}kg ×${piece.quantite} = ${(poidsEstime(piece) * piece.quantite).toFixed(3)}kg`],
      ].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-[var(--text-muted)]">{k}</span><span className="font-semibold font-mono">{v}</span></div>)}
    </CardBody></Card>

    <Card><CardBody className="p-2"><p className="text-[8px] font-bold mb-0.5">Remarques</p>
      <textarea value={piece.remarques} onChange={e => update({ remarques: e.target.value })} rows={2} className="w-full px-1.5 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded resize-none focus:outline-none focus:border-[#B91C1C]" />
    </CardBody></Card>

    <div className="space-y-1">
      <button onClick={() => { exportPlanPDF(piece, matConfig); toast.success('PDF exporté'); }} className="w-full py-2 rounded bg-[#B91C1C] text-white text-[10px] font-bold"><FileDown className="w-3 h-3 inline mr-1" />Plan PDF</button>
      <div className="flex gap-1">
        <button onClick={() => { telechargerDXF(piece); toast.success('DXF'); }} className="flex-1 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-semibold"><Download className="w-3 h-3 inline mr-0.5" />DXF</button>
        <button onClick={() => { telechargerSTEP(piece); toast.success('STEP'); }} className="flex-1 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-semibold"><Cuboid className="w-3 h-3 inline mr-0.5" />STEP</button>
        <button onClick={onCmd} className="flex-1 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-semibold"><ShoppingCart className="w-3 h-3 inline mr-0.5" />Cmd</button>
      </div>
    </div>

    {saved.length > 1 && <Card><CardBody className="p-2 space-y-1">
      <p className="text-[8px] font-bold uppercase"><Layers className="w-2.5 h-2.5 inline mr-0.5" />Multi-pièces PDF</p>
      <div className="max-h-[60px] overflow-y-auto space-y-px">{saved.map(sp => sp.id && <label key={sp.id} className="flex items-center gap-1 py-px px-0.5 rounded hover:bg-[var(--bg-tertiary)] cursor-pointer text-[8px]">
        <input type="checkbox" checked={multiIds.includes(sp.id)} onChange={e => setMultiIds(ids => e.target.checked ? [...ids, sp.id!] : ids.filter(x => x !== sp.id))} className="w-2.5 h-2.5 accent-[#B91C1C]" />
        {sp.nom} <span className="text-[6px] text-[var(--text-muted)] font-mono ml-auto">{sp.reference}</span></label>)}</div>
      <button onClick={() => { if (multiIds.length < 2) return; exportMultiPDF(saved.filter(sp => sp.id && multiIds.includes(sp.id))); toast.success('Multi-PDF'); }}
        disabled={multiIds.length < 2} className="w-full py-1 rounded bg-[var(--bg-tertiary)] text-[8px] font-semibold disabled:opacity-30">Exporter {multiIds.length} pièces</button>
    </CardBody></Card>}
  </>);
}

// ═══ CANVAS SVG (all visual features) ═══

function CanvasSVG({ piece, update, zoom, showGrid, showCotes, showAutoCotes, autoCotes, viewMode, darkCanvas, svgRef, pan, setPan, selTrou, setSelTrou, selPli, setSelPli, tool, mPts, setMPts, collabCursors, photoOverlay, photoOpacity, pieceId }: any) {
  const [drag, setDrag] = useState<any>(null);
  const mc = MATIERES.find(m => m.id === piece.matiere); const W = piece.largeur, H = piece.hauteur, mg = 40;
  const bg = darkCanvas ? '#12121e' : 'var(--bg-primary)'; const gc = darkCanvas ? '#2a2a3e' : 'var(--text-muted)';
  const cf = darkCanvas ? (mc?.couleurDark || '#9CA3AF') : (mc?.couleur || '#6B7280');
  const cc = darkCanvas ? '#FF6B6B' : '#B91C1C'; const pc = darkCanvas ? '#60A5FA' : '#3B82F6'; const tc = darkCanvas ? '#34D399' : '#059669';

  const toWorld = (cx: number, cy: number) => { const svg = svgRef.current; if (!svg) return { x: 0, y: 0 }; const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: Math.round((vb.x + (cx - r.left) * vb.width / r.width) / 5) * 5, y: Math.round((vb.y + (cy - r.top) * vb.height / r.height) / 5) * 5 }; };

  const handleDown = (e: React.MouseEvent, type = 'pan', id?: string) => {
    e.stopPropagation();
    if (tool === 'measure') { const pt = toWorld(e.clientX, e.clientY); setMPts(mPts.length >= 2 ? [pt] : [...mPts, pt]); return; }
    if (tool === 'annotate') { const pt = toWorld(e.clientX, e.clientY); const txt = prompt('Annotation:'); if (txt) update({ annotations: [...piece.annotations, { id: uid(), x: pt.x, y: pt.y, texte: txt }] }); return; }
    if (type === 'trou') { const t = piece.trous.find((x: any) => x.id === id); if (t) { setDrag({ type: 'trou', id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y }); setSelTrou(id); } }
    else if (type === 'pli') { const p = piece.plis.find((x: any) => x.id === id); if (p) { setDrag({ type: 'pli', id, sx: e.clientX, sy: e.clientY, ox: p.position }); setSelPli(id); } }
    else if (e.button === 1 || e.altKey) setDrag({ type: 'pan', sx: e.clientX - pan.x, sy: e.clientY - pan.y });
    // Feature 34: broadcast
    if (pieceId) { const pt = toWorld(e.clientX, e.clientY); broadcastCursor(pieceId, 'me', pt.x, pt.y); }
  };
  const handleMove = (e: React.MouseEvent) => { if (!drag) return; if (drag.type === 'pan') { setPan({ x: e.clientX - drag.sx, y: e.clientY - drag.sy }); return; }
    const svg = svgRef.current; if (!svg) return; const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sx = vb.width / r.width, sy = vb.height / r.height;
    const dx = (e.clientX - drag.sx) * sx, dy = (e.clientY - drag.sy) * sy;
    if (drag.type === 'trou') { const nx = Math.round(((drag.ox || 0) + dx) / 5) * 5, ny = Math.round(((drag.oy || 0) + dy) / 5) * 5;
      update({ trous: piece.trous.map((t: any) => t.id === drag.id ? { ...t, x: Math.max(0, Math.min(W, nx)), y: Math.max(0, Math.min(H, ny)) } : t) }); }
    else if (drag.type === 'pli') { const nx = Math.round(((drag.ox || 0) + dx) / 5) * 5;
      update({ plis: piece.plis.map((p: any) => p.id === drag.id ? { ...p, position: Math.max(0, Math.min(W, nx)) } : p), formeBase: 'custom' }); }};
  const handleUp = () => setDrag(null);

  if (viewMode === 'iso') { const iso = genererVueIso(piece); const ax = iso.segments.flatMap((s: any) => [s.x1, s.x2]), ay = iso.segments.flatMap((s: any) => [s.y1, s.y2]);
    const mnX = Math.min(...ax, 0) - 20, mxX = Math.max(...ax, 0) + 20, mnY = Math.min(...ay, 0) - 20, mxY = Math.max(...ay, 0) + 20;
    return <svg ref={svgRef} className="w-full h-full" viewBox={`${mnX} ${mnY} ${mxX - mnX} ${mxY - mnY}`} style={{ background: bg }}>{iso.segments.map((s: any, i: number) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={cf} strokeWidth={1.5 / zoom} />)}</svg>; }

  const sc = zoom, vbX = -mg / sc + pan.x / sc, vbY = -mg / sc + pan.y / sc, vbW = (W + mg * 2) / sc, vbH = (H + mg * 2) / sc;

  return <svg ref={svgRef} className="w-full h-full" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
    style={{ background: bg, cursor: tool === 'measure' ? 'crosshair' : tool === 'annotate' ? 'cell' : 'default' }}
    onMouseDown={e => handleDown(e)} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}>
    {/* Photo overlay (32) */}
    {photoOverlay && <image href={photoOverlay} x={0} y={0} width={W} height={H} opacity={photoOpacity} preserveAspectRatio="none" />}
    {showGrid && <g opacity={darkCanvas ? 0.2 : 0.08}>{Array.from({ length: Math.ceil(W / 10) + 8 }, (_, i) => (i - 4) * 10).map(x => <line key={`gx${x}`} x1={x} y1={-mg} x2={x} y2={H + mg} stroke={gc} strokeWidth={x % 50 === 0 ? 0.3 : 0.1} />)}
      {Array.from({ length: Math.ceil(H / 10) + 8 }, (_, i) => (i - 4) * 10).map(y => <line key={`gy${y}`} x1={-mg} y1={y} x2={W + mg} y2={y} stroke={gc} strokeWidth={y % 50 === 0 ? 0.3 : 0.1} />)}</g>}
    <path d={genererPathDeveloppe(piece)} fill={cf} fillOpacity={darkCanvas ? 0.15 : 0.08} stroke={cf} strokeWidth={0.6 / sc} />
    {piece.chanfreins.map((ch: any, i: number) => { const v = ch.valeur; if (v <= 0) return null; let pts = ''; if (ch.coin === 'hg') pts = `0,${v} ${v},0`; if (ch.coin === 'hd') pts = `${W - v},0 ${W},${v}`; if (ch.coin === 'bg') pts = `0,${H - v} ${v},${H}`; if (ch.coin === 'bd') pts = `${W - v},${H} ${W},${H - v}`;
      return <polyline key={i} points={pts} fill="none" stroke="#EA580C" strokeWidth={0.4 / sc} strokeDasharray={`${1.5 / sc} ${1 / sc}`} />; })}
    {piece.plis.map((pli: any) => <g key={pli.id} onMouseDown={e => handleDown(e, 'pli', pli.id)} style={{ cursor: 'ew-resize' }}>
      <line x1={pli.position} y1={-2} x2={pli.position} y2={H + 2} stroke="transparent" strokeWidth={5 / sc} />
      <line x1={pli.position} y1={-2} x2={pli.position} y2={H + 2} stroke={selPli === pli.id ? cc : pc} strokeWidth={(selPli === pli.id ? 1 : 0.5) / sc} strokeDasharray={`${2 / sc} ${1.5 / sc}`} />
      <text x={pli.position} y={-3} fontSize={4.5 / sc} fill={pc} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{pli.direction === 'haut' ? '▲' : '▼'}{pli.angle}°</text></g>)}
    {piece.trous.map((t: any) => { const sel = selTrou === t.id, r = t.diametre / 2; return <g key={t.id} onMouseDown={e => handleDown(e, 'trou', t.id)} style={{ cursor: 'move' }}>
      <circle cx={t.x} cy={t.y} r={Math.max(r, 3 / sc)} fill="transparent" />
      <circle cx={t.x} cy={t.y} r={r} fill={bg} stroke={sel ? cc : tc} strokeWidth={(sel ? 0.8 : 0.4) / sc} />
      <line x1={t.x - r * 0.3} y1={t.y} x2={t.x + r * 0.3} y2={t.y} stroke={tc} strokeWidth={0.15 / sc} /><line x1={t.x} y1={t.y - r * 0.3} x2={t.x} y2={t.y + r * 0.3} stroke={tc} strokeWidth={0.15 / sc} />
      {showCotes && <text x={t.x + r + 1} y={t.y + 0.5} fontSize={3.5 / sc} fill={tc} fontFamily="monospace">∅{t.diametre}</text>}</g>; })}
    {piece.marquages.map((m: any) => <text key={m.id} x={m.x} y={m.y} fontSize={m.taille / sc * zoom} fill={darkCanvas ? '#F59E0B' : '#D97706'} fontFamily="monospace" fontWeight="bold" textAnchor="middle" opacity={0.6}>{m.texte}</text>)}
    {piece.annotations.map((a: any) => <g key={a.id}><rect x={a.x - 0.5} y={a.y - 3.5} width={a.texte.length * 2.2 + 1} height={4.5} rx={0.8} fill={darkCanvas ? '#2D2654' : '#EDE9FE'} stroke="#8B5CF6" strokeWidth={0.15 / sc} />
      <text x={a.x} y={a.y} fontSize={3 / sc} fill="#8B5CF6" fontFamily="monospace">{a.texte}</text></g>)}
    {mPts.length >= 1 && <circle cx={mPts[0].x} cy={mPts[0].y} r={1.5 / sc} fill="#EC4899" />}
    {mPts.length === 2 && <><line x1={mPts[0].x} y1={mPts[0].y} x2={mPts[1].x} y2={mPts[1].y} stroke="#EC4899" strokeWidth={0.4 / sc} strokeDasharray={`${1.5 / sc} ${1 / sc}`} />
      <circle cx={mPts[1].x} cy={mPts[1].y} r={1.5 / sc} fill="#EC4899" />
      <text x={(mPts[0].x + mPts[1].x) / 2} y={(mPts[0].y + mPts[1].y) / 2 - 2} fontSize={4.5 / sc} fill="#EC4899" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        {Math.sqrt((mPts[1].x - mPts[0].x) ** 2 + (mPts[1].y - mPts[0].y) ** 2).toFixed(1)}mm</text></>}
    {showAutoCotes && autoCotes.map((c: any, i: number) => { const mid = { x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 }; const isH = c.type === 'horizontal'; const off = isH ? -3 : 3;
      return <g key={i} opacity={0.5}><line x1={c.x1} y1={isH ? c.y1 + off : c.y1} x2={c.x2} y2={isH ? c.y2 + off : c.y2} stroke={c.color || '#059669'} strokeWidth={0.2 / sc} strokeDasharray={`${1 / sc}`} />
        <text x={isH ? mid.x : c.x1 + off + 1} y={isH ? mid.y + off - 0.5 : mid.y} fontSize={3 / sc} fill={c.color || '#059669'} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{c.label}</text></g>; })}
    {showCotes && <><line x1={0} y1={H + 7} x2={W} y2={H + 7} stroke={cc} strokeWidth={0.2 / sc} /><text x={W / 2} y={H + 11} fontSize={4.5 / sc} fill={cc} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{W}</text>
      <line x1={-7} y1={0} x2={-7} y2={H} stroke={cc} strokeWidth={0.2 / sc} /><text x={-10} y={H / 2} fontSize={4.5 / sc} fill={cc} textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 ${-10} ${H / 2})`}>{H}</text></>}
    {/* Feature 34: Collab cursors */}
    {Object.entries(collabCursors).map(([uid, pos]: any) => <g key={uid}><circle cx={pos.x} cy={pos.y} r={3 / sc} fill="#8B5CF6" opacity={0.7} /><text x={pos.x + 4 / sc} y={pos.y} fontSize={3 / sc} fill="#8B5CF6">{uid.slice(0, 4)}</text></g>)}
  </svg>;
}

// ═══ CANVAS 3D FULL (39,40,43,44,45,46,49) ═══

function Canvas3DFull({ piece, darkCanvas, usePBR, animProgress, enableMeasure, onMeasurePoint, explodedPieces }: {
  piece: PieceConfig; darkCanvas: boolean; usePBR: boolean; animProgress: number;
  enableMeasure: boolean; onMeasurePoint: (pt: { x: number; y: number; z: number }) => void;
  explodedPieces?: PieceConfig[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    // Clean previous
    if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; }

    const init = async () => {
      let THREE: any;
      try { THREE = (window as any).THREE || await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' as any); }
      catch { THREE = (window as any).THREE; }
      if (!THREE) {
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;flex-direction:column"><p>⚠️ Three.js non disponible</p><p style="font-size:10px;margin-top:4px">Ajouter le script CDN dans index.html</p></div>';
        return;
      }

      const opts: Scene3DOptions = {
        mode: explodedPieces && explodedPieces.length > 1 ? 'exploded' : 'normal',
        darkCanvas, usePBR, animProgress,
        explodedPieces, explodeDistance: 60,
        enableMeasure,
        onMeasurePoint,
      };

      try {
        const result = buildScene(THREE, piece, mount, opts);
        sceneRef.current = result;
      } catch (err) {
        console.error('3D init error:', err);
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:11px">Erreur initialisation 3D</div>';
      }
    };
    init();

    return () => { if (sceneRef.current) { sceneRef.current.cleanup(); sceneRef.current = null; } };
  }, [piece.plis, piece.largeur, piece.hauteur, piece.epaisseur, piece.matiere, piece.trous.length, darkCanvas, usePBR, explodedPieces?.length]);

  // Feature 39: Update animation progress
  useEffect(() => {
    if (sceneRef.current?.setProgress) sceneRef.current.setProgress(animProgress);
  }, [animProgress]);

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: enableMeasure ? 'crosshair' : 'default' }} />;
}

// ═══ PDF EXPORTS ═══

function exportPlanPDF(p: PieceConfig, mc: MatiereConfig) {
  const pdf = new PDFBuilder('Plan Technique', p.reference, 'landscape');
  pdf.docTitle('Plan de Fabrication', p.reference);
  pdf.docSubtitle(`${p.nom} — ${mc.nom} ép. ${p.epaisseur} mm`);
  pdf.kpiRow([{ label: 'Largeur', value: `${p.largeur}mm` }, { label: 'Hauteur', value: `${p.hauteur}mm` },
    { label: 'Développée', value: `${longueurDeveloppee(p).toFixed(1)}mm` }, { label: 'Poids', value: `${poidsEstime(p).toFixed(3)}kg` }, { label: 'Qté', value: String(p.quantite) }]);
  drawDev(pdf, p, mc);
  pdf.section('Nomenclature');
  pdf.info([['Réf', p.reference], ['Matière', mc.nom], ['Ép.', `${p.epaisseur}mm`], ['Finition', FINITIONS.find(f => f.id === p.finition)?.nom || 'Brut'], ['Statut', p.statut]], 3);
  if (p.plis.length > 0) { pdf.section('Pliage'); pdf.table(['#', 'Pos', 'Angle', 'Ri', 'Dir', 'BA'], p.plis.map((x, i) => [String(i + 1), String(x.position), `${x.angle}°`, String(x.rayonInterne), x.direction === 'haut' ? '↑' : '↓', bendAllowance(x.rayonInterne, p.epaisseur, x.angle, getKFactor(p.matiere, x.rayonInterne, p.epaisseur)).toFixed(2)])); }
  if (p.trous.length > 0) { pdf.section('Perçages'); pdf.table(['#', 'Type', 'X', 'Y', '∅'], p.trous.map((t, i) => [String(i + 1), t.type, String(t.x), String(t.y), String(t.diametre)])); }
  if (p.remarques) { pdf.section('Remarques'); pdf.noteBox(p.remarques); }
  pdf.save(`Plan-${p.reference}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

function exportMultiPDF(pieces: PieceConfig[]) {
  const pdf = new PDFBuilder('Multi-Pièces', `${pieces.length} pièces`, 'landscape');
  pdf.docTitle('Plan Multi-Pièces');
  pdf.table(['Réf', 'Nom', 'Mat', 'Ép', 'L×H', 'P', 'T', 'Poids', 'Qté'], pieces.map(p => { const mc = MATIERES.find(m => m.id === p.matiere); return [p.reference, p.nom, mc?.nom || '', `${p.epaisseur}`, `${p.largeur}×${p.hauteur}`, String(p.plis.length), String(p.trous.length), `${poidsEstime(p).toFixed(3)}`, String(p.quantite)]; }));
  pieces.forEach((p, i) => { pdf.newPage(); const mc = MATIERES.find(m => m.id === p.matiere)!; pdf.docTitle(`${i + 1}/${pieces.length} — ${p.nom}`, p.reference); drawDev(pdf, p, mc); });
  pdf.save(`MultiPlan-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

function drawDev(pdf: PDFBuilder, p: PieceConfig, mc: MatiereConfig) {
  pdf.section('Vue développée + Isométrique');
  const d = pdf.doc, dy = pdf.y, sc = Math.min((pdf.cw * 0.5) / p.largeur, 50 / p.hauteur), dW = p.largeur * sc, dH = p.hauteur * sc, dX = 25;
  d.setFillColor(240, 240, 245); d.setDrawColor(100, 100, 120); d.setLineWidth(0.15); d.rect(dX, dy, dW, dH, 'FD');
  p.plis.forEach(x => { d.setDrawColor(59, 130, 246); d.setLineWidth(0.1); d.setLineDashPattern([1, 1], 0); d.line(dX + x.position * sc, dy - 1, dX + x.position * sc, dy + dH + 1); d.setLineDashPattern([], 0); });
  p.trous.forEach(t => { d.setDrawColor(5, 150, 105); d.setLineWidth(0.1); d.circle(dX + t.x * sc, dy + t.y * sc, Math.max((t.diametre / 2) * sc, 0.25), 'S'); });
  d.setDrawColor(185, 28, 28); d.setLineWidth(0.08); d.line(dX, dy + dH + 2, dX + dW, dy + dH + 2); d.setFontSize(5); d.setTextColor(185, 28, 28); d.text(`${p.largeur}`, dX + dW / 2, dy + dH + 5.5, { align: 'center' });
  const iX = dX + dW + 12, iW = pdf.cw * 0.35; d.setDrawColor(200, 200, 210); d.setLineWidth(0.06); d.roundedRect(iX, dy, iW, dH, 1, 1, 'S');
  const iso = genererVueIso(p); if (iso.segments.length > 0) { const ax = iso.segments.flatMap((s: any) => [s.x1, s.x2]), ay = iso.segments.flatMap((s: any) => [s.y1, s.y2]);
    const mnX = Math.min(...ax), mxX = Math.max(...ax), mnY = Math.min(...ay), mxY = Math.max(...ay);
    const iSc = Math.min((iW - 6) / (mxX - mnX || 1), (dH - 6) / (mxY - mnY || 1));
    const oX = iX + (iW - (mxX - mnX) * iSc) / 2 - mnX * iSc, oY = dy + (dH - (mxY - mnY) * iSc) / 2 - mnY * iSc;
    d.setDrawColor(100, 100, 120); d.setLineWidth(0.12);
    iso.segments.forEach((s: any) => d.line(oX + s.x1 * iSc, oY + s.y1 * iSc, oX + s.x2 * iSc, oY + s.y2 * iSc)); }
  pdf.y = dy + dH + 8;
}
