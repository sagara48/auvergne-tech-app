// ═══════════════════════════════════════════════════════════════
// ATELIER TÔLERIE V3 — Complet avec BDD
// DB save/load, Commandes(13), Multi-PDF(16), Chanfreins(18),
// Marquages(19), Mesure(21), Annotations(22), DXF(24),
// + Bibliothèque(1), Symétrie(2), Cotation(3), Drag(4),
// Validation(5), Encoches(6), Multi-vues(7), Undo(9), Dark(12)
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Ruler, Scissors, Circle, FoldVertical, FileDown, Plus, Trash2,
  ChevronRight, ChevronLeft, RotateCcw, ZoomIn, ZoomOut, Grid3x3,
  Maximize2, Settings, Copy, Box, Layers, FlipHorizontal, FlipVertical,
  Undo2, Redo2, AlertTriangle, AlertCircle, CheckCircle2, BookOpen,
  Sun, Moon, SquareDashedBottom, Save, FolderOpen, ShoppingCart,
  FileType, PenLine, MessageSquare, Move, Crosshair, Type, Download,
} from 'lucide-react';
import { Card, CardBody, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieceConfig, Pli, Trou, Encoche, Chanfrein, Marquage, Annotation,
  AutoCote, ValidationIssue, MATIERES, FINITIONS, FORMES_BASE, PIECE_TEMPLATES,
  MatiereConfig, Matiere, TypeTrou, CoteEncoche,
  createDefaultPiece, pieceFromTemplate, uid,
  bendAllowance, getKFactor, longueurDeveloppee, poidsEstime,
  genererPlisFormeBase, genererPathDeveloppe, genererVueIso,
  validerPiece, genererCotationsAuto, telechargerDXF,
  miroirHorizontal, miroirVertical, dupliquerPiece, motifLineaire,
} from '@/services/tolerie';
import { getPieces, createPiece, updatePiece, deletePiece, creerCommandeDepuisPiece } from '@/services/tolerieApi';
import { PDFBuilder, PDF_COLORS, fmtDate } from '@/services/pdfBuilder';
import { useAppStore } from '@/stores/appStore';

// Steps
const STEPS = [
  { id: 1, label: 'Matière', icon: Layers, desc: 'Matière & bibliothèque' },
  { id: 2, label: 'Forme', icon: Box, desc: 'Dimensions, encoches, chanfreins' },
  { id: 3, label: 'Opérations', icon: Settings, desc: 'Plis, trous, marquages' },
  { id: 4, label: 'Plan', icon: FileDown, desc: 'Vérif., export PDF & DXF' },
];

// Canvas tools (Feature 21)
type CanvasTool = 'select' | 'measure' | 'annotate';

// Undo/Redo
function useHistory(initial: PieceConfig) {
  const [history, setHistory] = useState<PieceConfig[]>([initial]);
  const [idx, setIdx] = useState(0);
  const current = history[idx];
  const push = useCallback((next: PieceConfig) => { setHistory(h => [...h.slice(0, idx + 1), next].slice(-40)); setIdx(i => i + 1); }, [idx]);
  const undo = useCallback(() => { if (idx > 0) setIdx(i => i - 1); }, [idx]);
  const redo = useCallback(() => { if (idx < history.length - 1) setIdx(i => i + 1); }, [idx, history.length]);
  const reset = useCallback((p: PieceConfig) => { setHistory([p]); setIdx(0); }, []);
  return { piece: current, push, undo, redo, reset, canUndo: idx > 0, canRedo: idx < history.length - 1 };
}

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
  const [viewMode, setViewMode] = useState<'developpe' | 'iso'>('developpe');
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('select');
  const [selectedTrou, setSelectedTrou] = useState<string | null>(null);
  const [selectedPli, setSelectedPli] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showSaved, setShowSaved] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const qc = useQueryClient();
  const { setModuleActif } = useAppStore();

  const update = useCallback((partial: Partial<PieceConfig>) => push({ ...piece, ...partial }), [piece, push]);
  const matConfig = MATIERES.find(m => m.id === piece.matiere)!;
  const issues = useMemo(() => validerPiece(piece), [piece]);
  const autoCotes = useMemo(() => genererCotationsAuto(piece), [piece]);

  // DB queries
  const { data: savedPieces = [] } = useQuery({ queryKey: ['tolerie-pieces'], queryFn: getPieces, enabled: showSaved });
  const saveMut = useMutation({
    mutationFn: async (p: PieceConfig) => {
      if (p.id) return updatePiece(p.id, p);
      return createPiece(p);
    },
    onSuccess: (saved) => { push({ ...piece, id: saved.id, created_at: saved.created_at, updated_at: saved.updated_at }); qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Pièce sauvegardée'); },
    onError: () => toast.error('Erreur sauvegarde'),
  });
  const delMut = useMutation({
    mutationFn: deletePiece,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tolerie-pieces'] }); toast.success('Pièce supprimée'); },
  });
  const cmdMut = useMutation({
    mutationFn: creerCommandeDepuisPiece,
    onSuccess: () => { toast.success('Commande créée — ouvrir module Commandes ?'); },
    onError: () => toast.error('Erreur création commande'),
  });

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveMut.mutate(piece); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo, piece]);

  // Auto plis
  useEffect(() => {
    if (piece.formeBase !== 'custom' && piece.formeBase !== 'rectangle') {
      const plis = genererPlisFormeBase(piece.formeBase, piece.largeur, piece.hauteur, piece.epaisseur,
        { brancheL: piece.brancheL, profondeurU: piece.profondeurU, decalageZ: piece.decalageZ });
      push({ ...piece, plis });
    }
  }, [piece.formeBase, piece.largeur, piece.hauteur, piece.epaisseur, piece.brancheL, piece.profondeurU, piece.decalageZ]);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="h-full flex flex-col gap-2.5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-[16px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Atelier Tôlerie</h1>
            <p className="text-[9px] text-[var(--text-muted)]">Conception • Pliage • Perçage • Plan</p>
          </div>
          {issues.length > 0 && <div className="flex gap-1">
            {errorCount > 0 && <Badge variant="red" className="text-[8px]">{errorCount} err.</Badge>}
            {warnCount > 0 && <Badge variant="yellow" className="text-[8px]">{warnCount} av.</Badge>}
          </div>}
          {piece.id && <Badge variant="default" className="text-[8px] font-mono">ID: {piece.id.slice(0, 8)}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] disabled:opacity-20" title="Ctrl+Z"><Undo2 className="w-3 h-3" /></button>
          <button onClick={redo} disabled={!canRedo} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] disabled:opacity-20" title="Ctrl+Y"><Redo2 className="w-3 h-3" /></button>
          <div className="w-px h-3.5 bg-[var(--border-secondary)]" />
          <button onClick={() => push(miroirHorizontal(piece))} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Miroir H"><FlipHorizontal className="w-3 h-3" /></button>
          <button onClick={() => push(miroirVertical(piece))} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Miroir V"><FlipVertical className="w-3 h-3" /></button>
          <button onClick={() => push(dupliquerPiece(piece))} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Dupliquer"><Copy className="w-3 h-3" /></button>
          <div className="w-px h-3.5 bg-[var(--border-secondary)]" />
          <button onClick={() => saveMut.mutate(piece)} className="p-1 rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[#059669]" title="Sauvegarder (Ctrl+S)"><Save className="w-3 h-3" /></button>
          <button onClick={() => setShowSaved(!showSaved)} className={cn('p-1 rounded-[7px]', showSaved ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')} title="Pièces sauvegardées"><FolderOpen className="w-3 h-3" /></button>
          <div className="w-px h-3.5 bg-[var(--border-secondary)]" />
          <Input value={piece.nom} onChange={e => update({ nom: e.target.value })} className="w-36 text-[10px]" />
          <Input value={piece.reference} onChange={e => update({ reference: e.target.value })} className="w-24 text-[10px] font-mono" />
        </div>
      </div>

      {/* Saved pieces drawer */}
      {showSaved && (
        <Card><CardBody className="p-2 max-h-[140px] overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-[var(--text-primary)]">Pièces sauvegardées ({savedPieces.length})</p>
            <button onClick={() => { reset(createDefaultPiece()); setShowSaved(false); }} className="text-[9px] text-[var(--text-muted)] hover:text-[#B91C1C]">+ Nouvelle</button>
          </div>
          {savedPieces.length === 0 && <p className="text-[9px] text-[var(--text-muted)] text-center py-2">Aucune pièce sauvegardée</p>}
          <div className="grid grid-cols-3 gap-1">
            {savedPieces.map(sp => (
              <button key={sp.id} onClick={() => { reset(sp); setShowSaved(false); }}
                className="text-left p-1.5 rounded-[8px] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors group">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{sp.nom}</p>
                  <button onClick={e => { e.stopPropagation(); if (sp.id) delMut.mutate(sp.id); }} className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[#EA580C]"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
                <p className="text-[8px] text-[var(--text-muted)] font-mono">{sp.reference} · {sp.matiere} · {sp.largeur}×{sp.hauteur}</p>
              </button>
            ))}
          </div>
        </CardBody></Card>
      )}

      {/* STEPPER */}
      <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-secondary)]">
        {STEPS.map(s => { const Icon = s.icon; const active = step === s.id; const done = step > s.id;
          return <button key={s.id} onClick={() => setStep(s.id)} className={cn('flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] transition-all text-left', active ? 'bg-[#B91C1C] text-white' : done ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')}>
            <div className={cn('w-5 h-5 rounded-[6px] flex items-center justify-center flex-shrink-0', active ? 'bg-white/20' : done ? 'bg-[#B91C1C]/10' : 'bg-[var(--bg-tertiary)]')}><Icon className="w-2.5 h-2.5" /></div>
            <div><p className={cn('text-[9px] font-bold leading-tight', !active && !done && 'text-[var(--text-secondary)]')}>{s.label}</p><p className={cn('text-[7px]', active ? 'text-white/70' : 'text-[var(--text-muted)]')}>{s.desc}</p></div>
          </button>; })}
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto space-y-2 pr-0.5">
          {step === 1 && <StepMatiere piece={piece} update={update} reset={reset} matConfig={matConfig} />}
          {step === 2 && <StepForme piece={piece} update={update} />}
          {step === 3 && <StepOperations piece={piece} update={update} selectedPli={selectedPli} setSelectedPli={setSelectedPli} selectedTrou={selectedTrou} setSelectedTrou={setSelectedTrou} issues={issues} />}
          {step === 4 && <StepPlan piece={piece} update={update} matConfig={matConfig} issues={issues} onCommander={() => cmdMut.mutate(piece)} onGoCommandes={() => setModuleActif('commandes')} savedPieces={savedPieces} />}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <CanvasToolbar zoom={zoom} setZoom={setZoom} showGrid={showGrid} setShowGrid={setShowGrid} showCotes={showCotes} setShowCotes={setShowCotes}
            showAutoCotes={showAutoCotes} setShowAutoCotes={setShowAutoCotes} viewMode={viewMode} setViewMode={setViewMode}
            darkCanvas={darkCanvas} setDarkCanvas={setDarkCanvas} canvasTool={canvasTool} setCanvasTool={setCanvasTool}
            onReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} />
          <div className={cn('flex-1 rounded-xl overflow-hidden relative border', darkCanvas ? 'border-[#2a2a3e]' : 'border-[var(--border-secondary)]')}>
            <PieceCanvas piece={piece} update={update} zoom={zoom} showGrid={showGrid} showCotes={showCotes} showAutoCotes={showAutoCotes}
              autoCotes={autoCotes} viewMode={viewMode} darkCanvas={darkCanvas} svgRef={svgRef} pan={pan} setPan={setPan}
              selectedTrou={selectedTrou} setSelectedTrou={setSelectedTrou} selectedPli={selectedPli} setSelectedPli={setSelectedPli}
              canvasTool={canvasTool} measurePoints={measurePoints} setMeasurePoints={setMeasurePoints} />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between py-0.5">
        <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="flex items-center gap-1 px-2.5 py-1 rounded-[9px] text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-20">
          <ChevronLeft className="w-3 h-3" /> Précédent</button>
        <div className="flex items-center gap-2.5 text-[8px] text-[var(--text-muted)]">
          <span>Dév. <b className="text-[var(--text-primary)] font-mono">{longueurDeveloppee(piece).toFixed(1)}</b></span>
          <span>·</span><span>Poids <b className="text-[var(--text-primary)] font-mono">{poidsEstime(piece).toFixed(3)}kg</b></span>
          <span>·</span><span><b>{piece.plis.length}</b> plis · <b>{piece.trous.length}</b> trous · <b>{piece.encoches.length}</b> enc. · <b>{piece.marquages.length}</b> marq.</span>
        </div>
        <button onClick={() => step < 4 && setStep(step + 1)} disabled={step === 4} className="flex items-center gap-1 px-3 py-1 rounded-[9px] text-[10px] font-semibold bg-[#B91C1C] text-white hover:bg-[#991B1B] disabled:opacity-20">
          Suivant <ChevronRight className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 1 — MATIÈRE + BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════

function StepMatiere({ piece, update, reset, matConfig }: { piece: PieceConfig; update: (p: Partial<PieceConfig>) => void; reset: (p: PieceConfig) => void; matConfig: MatiereConfig }) {
  const [showLib, setShowLib] = useState(false);
  const cats = [...new Set(PIECE_TEMPLATES.map(t => t.categorie))];
  return (<>
    <button onClick={() => setShowLib(!showLib)} className={cn('w-full flex items-center gap-2 p-2 rounded-[9px] border transition-all', showLib ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20 text-[#B91C1C]' : 'border-[var(--border-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]')}>
      <BookOpen className="w-3.5 h-3.5" /><span className="text-[10px] font-bold flex-1 text-left">Bibliothèque pièces types</span><Badge variant="default" className="text-[8px]">{PIECE_TEMPLATES.length}</Badge></button>
    {showLib && <Card><CardBody className="p-2 space-y-1 max-h-[250px] overflow-y-auto">
      {cats.map(c => <div key={c}><p className="text-[8px] font-bold text-[var(--text-muted)] uppercase px-1 mb-0.5">{c}</p>
        {PIECE_TEMPLATES.filter(t => t.categorie === c).map(tpl => <button key={tpl.id} onClick={() => { reset(pieceFromTemplate(tpl)); setShowLib(false); toast.success(`"${tpl.nom}" chargé`); }}
          className="w-full text-left p-1.5 rounded-[7px] hover:bg-[var(--bg-tertiary)] mb-0.5"><div className="flex items-center gap-2"><span className="text-[12px]">{tpl.icon}</span><div><p className="text-[10px] font-semibold text-[var(--text-primary)]">{tpl.nom}</p><p className="text-[8px] text-[var(--text-muted)]">{tpl.description}</p></div></div></button>)}</div>)}
    </CardBody></Card>}
    <Card><CardBody className="p-2 space-y-1.5"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Matière</p>
      {MATIERES.map(m => <button key={m.id} onClick={() => update({ matiere: m.id, epaisseur: m.epaisseurs[3] || m.epaisseurs[0] })}
        className={cn('w-full flex items-center gap-2 p-1.5 rounded-[7px] border transition-all text-left', piece.matiere === m.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-transparent hover:bg-[var(--bg-tertiary)]')}>
        <div className="w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: m.couleur }} />
        <div><p className={cn('text-[10px] font-semibold', piece.matiere === m.id ? 'text-[#B91C1C]' : '')}>{m.nom}</p><p className="text-[7px] text-[var(--text-muted)]">ρ {m.densite} · K {m.kFactor}</p></div>
      </button>)}
    </CardBody></Card>
    <Card><CardBody className="p-2 space-y-1.5"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Épaisseur (mm)</p>
      <div className="flex flex-wrap gap-1">{matConfig.epaisseurs.map(ep => <button key={ep} onClick={() => update({ epaisseur: ep })}
        className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold border', piece.epaisseur === ep ? 'bg-[#B91C1C] text-white border-[#B91C1C]' : 'border-[var(--border-primary)] text-[var(--text-secondary)]')}>{ep}</button>)}</div>
    </CardBody></Card>
    <Card><CardBody className="p-2 space-y-1.5"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Finition</p>
      <div className="grid grid-cols-2 gap-1">{FINITIONS.map(f => <button key={f.id} onClick={() => update({ finition: f.id })}
        className={cn('px-1.5 py-1 rounded-[7px] text-[9px] font-medium border text-center', piece.finition === f.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20 text-[#B91C1C]' : 'border-[var(--border-secondary)] text-[var(--text-secondary)]')}>{f.nom}</button>)}</div>
      <div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-bold">Qté</span>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => update({ quantite: Math.max(1, piece.quantite - 1) })} className="w-5 h-5 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[11px] font-bold">−</button>
          <Input type="number" min={1} value={piece.quantite} onChange={e => update({ quantite: Math.max(1, parseInt(e.target.value) || 1) })} className="w-12 text-center text-[10px] font-bold" />
          <button onClick={() => update({ quantite: piece.quantite + 1 })} className="w-5 h-5 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[11px] font-bold">+</button>
        </div></div>
    </CardBody></Card>
  </>);
}

// ═══════════════════════════════════════════════════
// STEP 2 — FORME + ENCOCHES + CHANFREINS (18)
// ═══════════════════════════════════════════════════

function StepForme({ piece, update }: { piece: PieceConfig; update: (p: Partial<PieceConfig>) => void }) {
  const addEncoche = () => update({ encoches: [...piece.encoches, { id: uid(), x: piece.largeur / 4, y: 0, largeur: 20, hauteur: 10, cote: 'haut' }] });
  const updateEnc = (id: string, p: Partial<Encoche>) => update({ encoches: piece.encoches.map(e => e.id === id ? { ...e, ...p } : e) });
  const removeEnc = (id: string) => update({ encoches: piece.encoches.filter(e => e.id !== id) });

  const setChanfrein = (coin: Chanfrein['coin'], type: Chanfrein['type'], valeur: number) => {
    const existing = piece.chanfreins.filter(c => c.coin !== coin);
    if (valeur > 0) existing.push({ coin, type, valeur });
    update({ chanfreins: existing });
  };
  const getChanfrein = (coin: Chanfrein['coin']) => piece.chanfreins.find(c => c.coin === coin);

  return (<>
    <Card><CardBody className="p-2 space-y-1.5"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Profil</p>
      <div className="grid grid-cols-3 gap-1">{FORMES_BASE.map(f => <button key={f.id} onClick={() => update({ formeBase: f.id })}
        className={cn('p-1.5 rounded-[7px] border text-center', piece.formeBase === f.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]')}>
        <span className="text-[12px]">{f.icon}</span><p className={cn('text-[8px] font-bold mt-0.5', piece.formeBase === f.id && 'text-[#B91C1C]')}>{f.nom}</p></button>)}</div>
    </CardBody></Card>

    <Card><CardBody className="p-2 space-y-1.5"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Dimensions (mm)</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className="text-[7px] text-[var(--text-muted)]">Largeur</label><Input type="number" min={10} value={piece.largeur} onChange={e => update({ largeur: Math.max(10, parseFloat(e.target.value) || 0) })} className="text-[10px] font-mono" /></div>
        <div><label className="text-[7px] text-[var(--text-muted)]">Hauteur</label><Input type="number" min={10} value={piece.hauteur} onChange={e => update({ hauteur: Math.max(10, parseFloat(e.target.value) || 0) })} className="text-[10px] font-mono" /></div>
      </div>
      {piece.formeBase === 'L' && <div><label className="text-[7px] text-[var(--text-muted)]">Branche L</label><Input type="number" min={1} value={piece.brancheL || piece.hauteur} onChange={e => update({ brancheL: parseFloat(e.target.value) || 0 })} className="text-[10px] font-mono" /></div>}
      {piece.formeBase === 'U' && <div><label className="text-[7px] text-[var(--text-muted)]">Profondeur U</label><Input type="number" min={1} value={piece.profondeurU || piece.hauteur} onChange={e => update({ profondeurU: parseFloat(e.target.value) || 0 })} className="text-[10px] font-mono" /></div>}
      {piece.formeBase === 'Z' && <div><label className="text-[7px] text-[var(--text-muted)]">Décalage Z</label><Input type="number" min={1} value={piece.decalageZ || Math.round(piece.largeur / 3)} onChange={e => update({ decalageZ: parseFloat(e.target.value) || 0 })} className="text-[10px] font-mono" /></div>}
    </CardBody></Card>

    {/* Feature 18: Chanfreins */}
    <Card><CardBody className="p-2 space-y-1.5">
      <p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide">Chanfreins / Rayons de coins</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(['hg', 'hd', 'bg', 'bd'] as Chanfrein['coin'][]).map(coin => {
          const ch = getChanfrein(coin);
          const label = coin === 'hg' ? '↖ Haut-G' : coin === 'hd' ? '↗ Haut-D' : coin === 'bg' ? '↙ Bas-G' : '↘ Bas-D';
          return <div key={coin} className="p-1.5 rounded-[7px] border border-[var(--border-secondary)]">
            <p className="text-[8px] font-semibold text-[var(--text-secondary)] mb-1">{label}</p>
            <div className="flex gap-0.5 mb-1">
              <button onClick={() => setChanfrein(coin, 'chanfrein', ch?.valeur || 5)} className={cn('flex-1 py-0.5 rounded text-[7px] font-semibold', ch?.type === 'chanfrein' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>Chanfrein</button>
              <button onClick={() => setChanfrein(coin, 'rayon', ch?.valeur || 5)} className={cn('flex-1 py-0.5 rounded text-[7px] font-semibold', ch?.type === 'rayon' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>Rayon</button>
              <button onClick={() => setChanfrein(coin, 'chanfrein', 0)} className={cn('px-1 py-0.5 rounded text-[7px]', !ch ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' : 'text-[var(--text-muted)]')}>∅</button>
            </div>
            {ch && <Input type="number" min={0.5} step={0.5} value={ch.valeur} onChange={e => setChanfrein(coin, ch.type, parseFloat(e.target.value) || 0)} className="text-[9px] font-mono h-5" />}
          </div>;
        })}
      </div>
    </CardBody></Card>

    {/* Encoches */}
    <Card><CardBody className="p-2 space-y-1.5">
      <div className="flex items-center justify-between"><p className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wide"><SquareDashedBottom className="w-3 h-3 inline mr-1" />Encoches ({piece.encoches.length})</p>
        <button onClick={addEncoche} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><Plus className="w-2.5 h-2.5" /> Ajouter</button></div>
      {piece.encoches.map((enc, i) => <div key={enc.id} className="p-1.5 rounded-[7px] border border-[var(--border-secondary)]">
        <div className="flex items-center justify-between mb-1"><span className="text-[8px] font-bold">Enc. {i + 1}</span><button onClick={() => removeEnc(enc.id)} className="text-[var(--text-muted)] hover:text-[#EA580C]"><Trash2 className="w-2.5 h-2.5" /></button></div>
        <div className="flex gap-0.5 mb-1">{(['haut', 'bas', 'gauche', 'droite'] as CoteEncoche[]).map(c => <button key={c} onClick={() => updateEnc(enc.id, { cote: c })} className={cn('flex-1 py-0.5 rounded text-[7px] font-semibold capitalize', enc.cote === c ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>{c}</button>)}</div>
        <div className="grid grid-cols-4 gap-0.5">
          {[['X', enc.x, 'x'], ['Y', enc.y, 'y'], ['L', enc.largeur, 'largeur'], ['H', enc.hauteur, 'hauteur']].map(([l, v, k]) =>
            <div key={l as string}><label className="text-[6px] text-[var(--text-muted)]">{l as string}</label><Input type="number" value={v as number} onChange={e => updateEnc(enc.id, { [k as string]: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono h-5" /></div>)}
        </div>
      </div>)}
    </CardBody></Card>
  </>);
}

// ═══════════════════════════════════════════════════
// STEP 3 — PLIS, TROUS, MARQUAGES (19), VALIDATION
// ═══════════════════════════════════════════════════

function StepOperations({ piece, update, selectedPli, setSelectedPli, selectedTrou, setSelectedTrou, issues }: {
  piece: PieceConfig; update: (p: Partial<PieceConfig>) => void;
  selectedPli: string | null; setSelectedPli: (s: string | null) => void;
  selectedTrou: string | null; setSelectedTrou: (s: string | null) => void;
  issues: ValidationIssue[];
}) {
  const [tab, setTab] = useState<'plis' | 'trous' | 'marq' | 'valid'>('plis');
  const addPli = () => { const p: Pli = { id: uid(), position: piece.largeur / 2, angle: 90, rayonInterne: Math.max(piece.epaisseur, 1), direction: 'haut' }; update({ plis: [...piece.plis, p], formeBase: 'custom' }); setSelectedPli(p.id); };
  const updPli = (id: string, p: Partial<Pli>) => update({ plis: piece.plis.map(x => x.id === id ? { ...x, ...p } : x), formeBase: 'custom' });
  const rmPli = (id: string) => { update({ plis: piece.plis.filter(x => x.id !== id), formeBase: 'custom' }); if (selectedPli === id) setSelectedPli(null); };
  const addTrou = () => { const t: Trou = { id: uid(), x: piece.largeur / 2, y: piece.hauteur / 2, type: 'rond', diametre: 8 }; update({ trous: [...piece.trous, t] }); setSelectedTrou(t.id); };
  const updTrou = (id: string, p: Partial<Trou>) => update({ trous: piece.trous.map(x => x.id === id ? { ...x, ...p } : x) });
  const rmTrou = (id: string) => { update({ trous: piece.trous.filter(x => x.id !== id) }); if (selectedTrou === id) setSelectedTrou(null); };
  const addMarquage = () => update({ marquages: [...piece.marquages, { id: uid(), x: piece.largeur / 2, y: piece.hauteur / 2, texte: piece.reference, taille: 5, type: 'gravure' }] });
  const updMarq = (id: string, p: Partial<Marquage>) => update({ marquages: piece.marquages.map(x => x.id === id ? { ...x, ...p } : x) });
  const rmMarq = (id: string) => update({ marquages: piece.marquages.filter(x => x.id !== id) });
  const errC = issues.filter(i => i.severity === 'error').length;

  return (<>
    <div className="flex gap-0.5 p-0.5 bg-[var(--bg-secondary)] rounded-[9px] border border-[var(--border-secondary)]">
      {[{ id: 'plis' as const, l: `Plis (${piece.plis.length})`, ic: FoldVertical },
        { id: 'trous' as const, l: `Trous (${piece.trous.length})`, ic: Circle },
        { id: 'marq' as const, l: `Marq. (${piece.marquages.length})`, ic: Type },
        { id: 'valid' as const, l: `Vérif.`, ic: errC > 0 ? AlertTriangle : CheckCircle2, badge: issues.length },
      ].map(t => { const Ic = t.ic; return <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex-1 flex items-center justify-center gap-0.5 py-1 rounded-[7px] text-[9px] font-semibold', tab === t.id ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}><Ic className="w-2.5 h-2.5" /> {t.l}
        {t.badge ? <span className={cn('text-[7px] rounded px-0.5', tab === t.id ? 'bg-white/20' : errC > 0 ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500')}>{t.badge}</span> : null}</button>; })}
    </div>

    {tab === 'plis' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex items-center justify-between mb-0.5"><p className="text-[9px] font-bold">Pliages</p><button onClick={addPli} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-[var(--bg-tertiary)]"><Plus className="w-2.5 h-2.5" /> Ajouter</button></div>
      {piece.plis.length === 0 && <p className="text-[8px] text-[var(--text-muted)] py-2 text-center">Forme plate</p>}
      {piece.plis.map((pli, i) => { const pI = issues.filter(x => x.elementId === pli.id); return <div key={pli.id} onClick={() => setSelectedPli(pli.id)} className={cn('p-1.5 rounded-[7px] border cursor-pointer', selectedPli === pli.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]', pI.some(x => x.severity === 'error') && 'border-red-500/30')}>
        <div className="flex items-center justify-between mb-1"><span className="text-[8px] font-bold">Pli {i + 1}</span><div className="flex gap-0.5"><span className="text-[7px] text-[#B91C1C] font-mono">{bendAllowance(pli.rayonInterne, piece.epaisseur, pli.angle, getKFactor(piece.matiere, pli.rayonInterne, piece.epaisseur)).toFixed(1)}</span><button onClick={e => { e.stopPropagation(); rmPli(pli.id); }} className="text-[var(--text-muted)] hover:text-[#EA580C]"><Trash2 className="w-2.5 h-2.5" /></button></div></div>
        <div className="grid grid-cols-4 gap-1">{[['Pos', pli.position, 'position'], ['Ang', pli.angle, 'angle'], ['Ri', pli.rayonInterne, 'rayonInterne']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[6px] text-[var(--text-muted)]">{l as string}</label><Input type="number" value={v as number} onChange={e => updPli(pli.id, { [k as string]: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono h-5" /></div>)}
          <div><label className="text-[6px] text-[var(--text-muted)]">Dir</label><div className="flex gap-px"><button onClick={e => { e.stopPropagation(); updPli(pli.id, { direction: 'haut' }); }} className={cn('flex-1 rounded text-[7px] font-bold', pli.direction === 'haut' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>↑</button><button onClick={e => { e.stopPropagation(); updPli(pli.id, { direction: 'bas' }); }} className={cn('flex-1 rounded text-[7px] font-bold', pli.direction === 'bas' ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>↓</button></div></div></div>
        {pI.map((x, j) => <p key={j} className={cn('text-[7px] mt-0.5', x.severity === 'error' ? 'text-red-500' : 'text-amber-500')}>⚠ {x.message}</p>)}
      </div>; })}
    </CardBody></Card>}

    {tab === 'trous' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex items-center justify-between mb-0.5"><p className="text-[9px] font-bold">Perçages</p><button onClick={addTrou} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-[var(--bg-tertiary)]"><Plus className="w-2.5 h-2.5" /> Ajouter</button></div>
      {piece.trous.length === 0 && <p className="text-[8px] text-[var(--text-muted)] py-2 text-center">Aucun perçage</p>}
      {piece.trous.map((t, i) => { const tI = issues.filter(x => x.elementId === t.id); return <div key={t.id} onClick={() => setSelectedTrou(t.id)} className={cn('p-1.5 rounded-[7px] border cursor-pointer', selectedTrou === t.id ? 'bg-[var(--accent-bg)] border-[#B91C1C]/20' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]', tI.some(x => x.severity === 'error') && 'border-red-500/30')}>
        <div className="flex items-center justify-between mb-1"><span className="text-[8px] font-bold">Trou {i + 1}</span><div className="flex gap-0.5">
          <button onClick={e => { e.stopPropagation(); const n = { ...t, id: uid(), x: t.x + 30 }; update({ trous: [...piece.trous, n] }); }} className="p-0.5 text-[var(--text-muted)] hover:text-[#059669]" title="Dup."><Copy className="w-2.5 h-2.5" /></button>
          <button onClick={e => { e.stopPropagation(); update({ trous: [...piece.trous, ...motifLineaire(t, 2, 40, 0)] }); toast.success('Motif ajouté'); }} className="p-0.5 text-[var(--text-muted)] hover:text-[#3B82F6]" title="Motif ×3"><Grid3x3 className="w-2.5 h-2.5" /></button>
          <button onClick={e => { e.stopPropagation(); rmTrou(t.id); }} className="p-0.5 text-[var(--text-muted)] hover:text-[#EA580C]"><Trash2 className="w-2.5 h-2.5" /></button></div></div>
        <div className="grid grid-cols-3 gap-1 mb-1">{[['X', t.x, 'x'], ['Y', t.y, 'y'], ['∅', t.diametre, 'diametre']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[6px] text-[var(--text-muted)]">{l as string}</label><Input type="number" value={v as number} onChange={e => updTrou(t.id, { [k as string]: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono h-5" /></div>)}</div>
        <div className="flex gap-0.5">{(['rond', 'oblong', 'fraise', 'taraude'] as TypeTrou[]).map(tp => <button key={tp} onClick={e => { e.stopPropagation(); updTrou(t.id, { type: tp }); }} className={cn('flex-1 py-0.5 rounded text-[7px] font-semibold capitalize', t.type === tp ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{tp}</button>)}</div>
        {t.type === 'oblong' && <div className="mt-1"><Input type="number" min={1} value={t.longueurOblong || 15} onChange={e => updTrou(t.id, { longueurOblong: parseFloat(e.target.value) || 15 })} className="text-[9px] font-mono h-5" /></div>}
        {t.type === 'taraude' && <div className="mt-1"><Input value={t.taraudage || 'M8'} onChange={e => updTrou(t.id, { taraudage: e.target.value })} className="text-[9px] font-mono h-5" /></div>}
        {tI.map((x, j) => <p key={j} className={cn('text-[7px] mt-0.5', x.severity === 'error' ? 'text-red-500' : 'text-amber-500')}>⚠ {x.message}</p>)}
      </div>; })}
    </CardBody></Card>}

    {/* Feature 19: Marquages */}
    {tab === 'marq' && <Card><CardBody className="p-2 space-y-1">
      <div className="flex items-center justify-between mb-0.5"><p className="text-[9px] font-bold">Marquages / Gravures</p><button onClick={addMarquage} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-[var(--bg-tertiary)]"><Plus className="w-2.5 h-2.5" /> Ajouter</button></div>
      {piece.marquages.length === 0 && <p className="text-[8px] text-[var(--text-muted)] py-2 text-center">Aucun marquage</p>}
      {piece.marquages.map((m, i) => <div key={m.id} className="p-1.5 rounded-[7px] border border-[var(--border-secondary)]">
        <div className="flex items-center justify-between mb-1"><span className="text-[8px] font-bold">Marquage {i + 1}</span><button onClick={() => rmMarq(m.id)} className="text-[var(--text-muted)] hover:text-[#EA580C]"><Trash2 className="w-2.5 h-2.5" /></button></div>
        <Input value={m.texte} onChange={e => updMarq(m.id, { texte: e.target.value })} className="text-[9px] mb-1 h-6" placeholder="Texte..." />
        <div className="grid grid-cols-3 gap-1 mb-1">{[['X', m.x, 'x'], ['Y', m.y, 'y'], ['H', m.taille, 'taille']].map(([l, v, k]) =>
          <div key={l as string}><label className="text-[6px] text-[var(--text-muted)]">{l as string}</label><Input type="number" value={v as number} onChange={e => updMarq(m.id, { [k as string]: parseFloat(e.target.value) || 0 })} className="text-[9px] font-mono h-5" /></div>)}</div>
        <div className="flex gap-0.5">{(['gravure', 'poincon', 'etiquette'] as Marquage['type'][]).map(tp => <button key={tp} onClick={() => updMarq(m.id, { type: tp })} className={cn('flex-1 py-0.5 rounded text-[7px] font-semibold capitalize', m.type === tp ? 'bg-[#B91C1C] text-white' : 'bg-[var(--bg-tertiary)]')}>{tp}</button>)}</div>
      </div>)}
    </CardBody></Card>}

    {/* Validation */}
    {tab === 'valid' && <Card><CardBody className="p-2 space-y-1">
      <p className="text-[9px] font-bold">Vérifications automatiques</p>
      {issues.length === 0 ? <div className="flex items-center gap-1.5 p-2 rounded-[8px] bg-[#059669]/10"><CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /><p className="text-[10px] font-semibold text-[#059669]">Aucun problème</p></div> :
        issues.map((is, i) => <div key={i} onClick={() => { if (is.elementType === 'trou') { setSelectedTrou(is.elementId!); setTab('trous'); } if (is.elementType === 'pli') { setSelectedPli(is.elementId!); setTab('plis'); } }}
          className={cn('flex items-start gap-1.5 p-1.5 rounded-[7px] cursor-pointer', is.severity === 'error' ? 'bg-red-500/8 hover:bg-red-500/15' : 'bg-amber-500/8 hover:bg-amber-500/15')}>
          {is.severity === 'error' ? <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />}
          <p className={cn('text-[8px]', is.severity === 'error' ? 'text-red-600' : 'text-amber-600')}>{is.message}</p></div>)}
    </CardBody></Card>}
  </>);
}

// ═══════════════════════════════════════════════════
// STEP 4 — PLAN + EXPORT PDF/DXF + COMMANDE (13, 16, 24)
// ═══════════════════════════════════════════════════

function StepPlan({ piece, update, matConfig, issues, onCommander, onGoCommandes, savedPieces }: {
  piece: PieceConfig; update: (p: Partial<PieceConfig>) => void; matConfig: MatiereConfig; issues: ValidationIssue[];
  onCommander: () => void; onGoCommandes: () => void; savedPieces: PieceConfig[];
}) {
  const [multiIds, setMultiIds] = useState<string[]>([]);

  const handleExportPDF = () => { try { exportPlanPDF(piece, matConfig); toast.success('Plan PDF exporté'); } catch { toast.error('Erreur PDF'); } };
  const handleExportDXF = () => { try { telechargerDXF(piece); toast.success('DXF exporté'); } catch { toast.error('Erreur DXF'); } };
  const handleMultiPDF = () => {
    const pieces = savedPieces.filter(sp => sp.id && multiIds.includes(sp.id));
    if (pieces.length < 2) { toast.error('Sélectionnez au moins 2 pièces'); return; }
    try { exportMultiPDF(pieces); toast.success('Plan multi-pièces exporté'); } catch { toast.error('Erreur export'); }
  };

  return (<>
    <Card><CardBody className="p-2 space-y-0.5 text-[8px]">
      <p className="text-[9px] font-bold text-[var(--text-primary)] uppercase mb-1">Nomenclature</p>
      {[['Réf.', piece.reference], ['Nom', piece.nom], ['Matière', matConfig.nom], ['Ép.', `${piece.epaisseur} mm`],
        ['Finition', FINITIONS.find(f => f.id === piece.finition)?.nom || '—'], ['L×H', `${piece.largeur}×${piece.hauteur}`],
        ['Dév.', `${longueurDeveloppee(piece).toFixed(1)} mm`], ['Éléments', `${piece.plis.length}P ${piece.trous.length}T ${piece.encoches.length}E ${piece.chanfreins.length}Ch ${piece.marquages.length}M`],
        ['Poids', `${poidsEstime(piece).toFixed(3)} kg × ${piece.quantite} = ${(poidsEstime(piece) * piece.quantite).toFixed(3)} kg`],
      ].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-[var(--text-muted)]">{k}</span><span className="font-semibold font-mono">{v}</span></div>)}
    </CardBody></Card>

    {issues.length > 0 && <div className="flex items-center gap-1.5 p-1.5 rounded-[8px] bg-amber-500/10"><AlertTriangle className="w-3 h-3 text-amber-500" /><p className="text-[8px] text-amber-600 font-semibold">{issues.length} vérif. à revoir</p></div>}

    <Card><CardBody className="p-2"><p className="text-[9px] font-bold mb-1">Remarques</p>
      <textarea value={piece.remarques} onChange={e => update({ remarques: e.target.value })} rows={2} className="w-full px-2 py-1 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-[7px] resize-none focus:outline-none focus:border-[#B91C1C]" />
    </CardBody></Card>

    {/* Export buttons */}
    <div className="space-y-1.5">
      <button onClick={handleExportPDF} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[9px] text-[11px] font-bold bg-[#B91C1C] text-white hover:bg-[#991B1B]">
        <FileDown className="w-3.5 h-3.5" /> Exporter Plan PDF</button>
      <div className="flex gap-1.5">
        <button onClick={handleExportDXF} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-[9px] text-[10px] font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
          <Download className="w-3 h-3" /> Export DXF</button>
        <button onClick={onCommander} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-[9px] text-[10px] font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
          <ShoppingCart className="w-3 h-3" /> Commander</button>
      </div>
    </div>

    {/* Feature 16: Multi-pièces */}
    {savedPieces.length > 1 && <Card><CardBody className="p-2 space-y-1.5">
      <p className="text-[9px] font-bold text-[var(--text-primary)] uppercase">Plan multi-pièces</p>
      <p className="text-[8px] text-[var(--text-muted)]">Sélectionner les pièces à regrouper sur un plan</p>
      <div className="max-h-[80px] overflow-y-auto space-y-0.5">{savedPieces.map(sp => sp.id && (
        <label key={sp.id} className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-[var(--bg-tertiary)] cursor-pointer">
          <input type="checkbox" checked={multiIds.includes(sp.id)} onChange={e => setMultiIds(ids => e.target.checked ? [...ids, sp.id!] : ids.filter(x => x !== sp.id))} className="w-3 h-3 accent-[#B91C1C]" />
          <span className="text-[9px] text-[var(--text-primary)]">{sp.nom}</span>
          <span className="text-[7px] text-[var(--text-muted)] font-mono ml-auto">{sp.reference}</span>
        </label>))}</div>
      <button onClick={handleMultiPDF} disabled={multiIds.length < 2}
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-[9px] text-[10px] font-semibold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30">
        <Layers className="w-3 h-3" /> Exporter {multiIds.length} pièces</button>
    </CardBody></Card>}
  </>);
}

// ═══════════════════════════════════════════════════
// CANVAS TOOLBAR (+ mesure, annotation tools)
// ═══════════════════════════════════════════════════

function CanvasToolbar(props: { zoom: number; setZoom: (z: number) => void; showGrid: boolean; setShowGrid: (v: boolean) => void; showCotes: boolean; setShowCotes: (v: boolean) => void; showAutoCotes: boolean; setShowAutoCotes: (v: boolean) => void; viewMode: 'developpe' | 'iso'; setViewMode: (v: 'developpe' | 'iso') => void; darkCanvas: boolean; setDarkCanvas: (v: boolean) => void; canvasTool: CanvasTool; setCanvasTool: (t: CanvasTool) => void; onReset: () => void; }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5 p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-[8px]">
          <button onClick={() => props.setViewMode('developpe')} className={cn('px-2 py-0.5 rounded-[6px] text-[8px] font-semibold', props.viewMode === 'developpe' ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>Développé</button>
          <button onClick={() => props.setViewMode('iso')} className={cn('px-2 py-0.5 rounded-[6px] text-[8px] font-semibold', props.viewMode === 'iso' ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>3D</button>
        </div>
        <div className="w-px h-3 bg-[var(--border-secondary)]" />
        {/* Tools (Feature 21, 22) */}
        {[
          { t: 'select' as CanvasTool, ic: Move, title: 'Sélection' },
          { t: 'measure' as CanvasTool, ic: Crosshair, title: 'Mesure (clic 2 pts)' },
          { t: 'annotate' as CanvasTool, ic: MessageSquare, title: 'Annotation' },
        ].map(btn => { const Ic = btn.ic; return <button key={btn.t} onClick={() => props.setCanvasTool(btn.t)} className={cn('p-1 rounded-[6px]', props.canvasTool === btn.t ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')} title={btn.title}><Ic className="w-3 h-3" /></button>; })}
      </div>
      <div className="flex items-center gap-0.5">
        {[{ a: props.showGrid, t: props.setShowGrid, ic: Grid3x3 }, { a: props.showCotes, t: props.setShowCotes, ic: Ruler }, { a: props.showAutoCotes, t: props.setShowAutoCotes, ic: PenLine }, { a: props.darkCanvas, t: props.setDarkCanvas, ic: props.darkCanvas ? Sun : Moon }].map((b, i) => {
          const Ic = b.ic; return <button key={i} onClick={() => b.t(!b.a)} className={cn('p-1 rounded-[6px]', b.a ? 'bg-[var(--accent-bg)] text-[#B91C1C]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')}><Ic className="w-2.5 h-2.5" /></button>; })}
        <div className="w-px h-3 bg-[var(--border-secondary)] mx-0.5" />
        <button onClick={() => props.setZoom(Math.max(0.2, props.zoom - 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomOut className="w-3 h-3" /></button>
        <span className="text-[8px] font-mono w-7 text-center">{Math.round(props.zoom * 100)}%</span>
        <button onClick={() => props.setZoom(Math.min(5, props.zoom + 0.2))} className="p-0.5 text-[var(--text-muted)]"><ZoomIn className="w-3 h-3" /></button>
        <button onClick={props.onReset} className="p-0.5 text-[var(--text-muted)]"><Maximize2 className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// CANVAS SVG (+ drag, measure, annotations, chanfreins)
// ═══════════════════════════════════════════════════

function PieceCanvas({ piece, update, zoom, showGrid, showCotes, showAutoCotes, autoCotes, viewMode, darkCanvas, svgRef, pan, setPan, selectedTrou, setSelectedTrou, selectedPli, setSelectedPli, canvasTool, measurePoints, setMeasurePoints }: {
  piece: PieceConfig; update: (p: Partial<PieceConfig>) => void; zoom: number; showGrid: boolean; showCotes: boolean; showAutoCotes: boolean; autoCotes: AutoCote[]; viewMode: 'developpe' | 'iso'; darkCanvas: boolean;
  svgRef: React.RefObject<SVGSVGElement>; pan: { x: number; y: number }; setPan: (p: { x: number; y: number }) => void;
  selectedTrou: string | null; setSelectedTrou: (s: string | null) => void; selectedPli: string | null; setSelectedPli: (s: string | null) => void;
  canvasTool: CanvasTool; measurePoints: { x: number; y: number }[]; setMeasurePoints: (pts: { x: number; y: number }[]) => void;
}) {
  const [drag, setDrag] = useState<{ type: 'pan' | 'trou' | 'pli'; id?: string; sx: number; sy: number; ox?: number; oy?: number } | null>(null);
  const mc = MATIERES.find(m => m.id === piece.matiere);
  const W = piece.largeur, H = piece.hauteur, mg = 40;
  const bg = darkCanvas ? '#12121e' : 'var(--bg-primary)';
  const gc = darkCanvas ? '#2a2a3e' : 'var(--text-muted)';
  const cf = darkCanvas ? (mc?.couleurDark || '#9CA3AF') : (mc?.couleur || '#6B7280');
  const cc = darkCanvas ? '#FF6B6B' : '#B91C1C';
  const pc = darkCanvas ? '#60A5FA' : '#3B82F6';
  const tc = darkCanvas ? '#34D399' : '#059669';

  const svgToWorld = (cx: number, cy: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: Math.round((vb.x + (cx - r.left) * vb.width / r.width) / 5) * 5, y: Math.round((vb.y + (cy - r.top) * vb.height / r.height) / 5) * 5 };
  };

  const handleDown = (e: React.MouseEvent, type: 'pan' | 'trou' | 'pli' = 'pan', id?: string) => {
    e.stopPropagation();
    if (canvasTool === 'measure') {
      const pt = svgToWorld(e.clientX, e.clientY);
      setMeasurePoints(measurePoints.length >= 2 ? [pt] : [...measurePoints, pt]);
      return;
    }
    if (canvasTool === 'annotate') {
      const pt = svgToWorld(e.clientX, e.clientY);
      const txt = prompt('Annotation :');
      if (txt) update({ annotations: [...piece.annotations, { id: uid(), x: pt.x, y: pt.y, texte: txt }] });
      return;
    }
    if (type === 'trou') { const t = piece.trous.find(x => x.id === id); if (t) { setDrag({ type: 'trou', id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y }); setSelectedTrou(id!); } }
    else if (type === 'pli') { const p = piece.plis.find(x => x.id === id); if (p) { setDrag({ type: 'pli', id, sx: e.clientX, sy: e.clientY, ox: p.position }); setSelectedPli(id!); } }
    else if (e.button === 1 || e.altKey) setDrag({ type: 'pan', sx: e.clientX - pan.x, sy: e.clientY - pan.y });
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!drag) return;
    if (drag.type === 'pan') { setPan({ x: e.clientX - drag.sx, y: e.clientY - drag.sy }); return; }
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const sx = vb.width / r.width, sy = vb.height / r.height;
    const dx = (e.clientX - drag.sx) * sx, dy = (e.clientY - drag.sy) * sy;
    if (drag.type === 'trou' && drag.id) {
      const nx = Math.round(((drag.ox || 0) + dx) / 5) * 5, ny = Math.round(((drag.oy || 0) + dy) / 5) * 5;
      update({ trous: piece.trous.map(t => t.id === drag.id ? { ...t, x: Math.max(0, Math.min(W, nx)), y: Math.max(0, Math.min(H, ny)) } : t) });
    } else if (drag.type === 'pli' && drag.id) {
      const nx = Math.round(((drag.ox || 0) + dx) / 5) * 5;
      update({ plis: piece.plis.map(p => p.id === drag.id ? { ...p, position: Math.max(0, Math.min(W, nx)) } : p), formeBase: 'custom' });
    }
  };
  const handleUp = () => setDrag(null);

  if (viewMode === 'iso') {
    const iso = genererVueIso(piece); const ax = iso.segments.flatMap(s => [s.x1, s.x2]); const ay = iso.segments.flatMap(s => [s.y1, s.y2]);
    const mnX = Math.min(...ax, 0) - 20, mxX = Math.max(...ax, 0) + 20, mnY = Math.min(...ay, 0) - 20, mxY = Math.max(...ay, 0) + 20;
    return <svg ref={svgRef as any} className="w-full h-full" viewBox={`${mnX} ${mnY} ${mxX - mnX} ${mxY - mnY}`} style={{ background: bg }}>
      {iso.segments.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={cf} strokeWidth={1.5 / zoom} />)}
    </svg>;
  }

  const sc = zoom, vbX = -mg / sc + pan.x / sc, vbY = -mg / sc + pan.y / sc, vbW = (W + mg * 2) / sc, vbH = (H + mg * 2) / sc;

  return (
    <svg ref={svgRef as any} className="w-full h-full" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ background: bg, cursor: canvasTool === 'measure' ? 'crosshair' : canvasTool === 'annotate' ? 'cell' : drag ? 'move' : 'default' }}
      onMouseDown={e => handleDown(e)} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}>

      {showGrid && <g opacity={darkCanvas ? 0.25 : 0.1}>
        {Array.from({ length: Math.ceil((W + mg * 2) / 10) }, (_, i) => (i - Math.ceil(mg / 10)) * 10).map(x => <line key={`gx${x}`} x1={x} y1={-mg} x2={x} y2={H + mg} stroke={gc} strokeWidth={x % 50 === 0 ? 0.35 : 0.12} />)}
        {Array.from({ length: Math.ceil((H + mg * 2) / 10) }, (_, i) => (i - Math.ceil(mg / 10)) * 10).map(y => <line key={`gy${y}`} x1={-mg} y1={y} x2={W + mg} y2={y} stroke={gc} strokeWidth={y % 50 === 0 ? 0.35 : 0.12} />)}
      </g>}

      <path d={genererPathDeveloppe(piece)} fill={cf} fillOpacity={darkCanvas ? 0.18 : 0.1} stroke={cf} strokeWidth={0.7 / sc} />

      {/* Chanfreins visual */}
      {piece.chanfreins.map((ch, i) => {
        const v = ch.valeur; if (v <= 0) return null;
        let pts = '';
        if (ch.coin === 'hg') pts = `0,${v} ${v},0`;
        if (ch.coin === 'hd') pts = `${W - v},0 ${W},${v}`;
        if (ch.coin === 'bg') pts = `0,${H - v} ${v},${H}`;
        if (ch.coin === 'bd') pts = `${W - v},${H} ${W},${H - v}`;
        return <polyline key={i} points={pts} fill="none" stroke="#EA580C" strokeWidth={0.5 / sc} strokeDasharray={`${2 / sc} ${1 / sc}`} />;
      })}

      {/* Bends */}
      {piece.plis.map(pli => <g key={pli.id} onMouseDown={e => handleDown(e, 'pli', pli.id)} style={{ cursor: 'ew-resize' }}>
        <line x1={pli.position} y1={-3} x2={pli.position} y2={H + 3} stroke="transparent" strokeWidth={5 / sc} />
        <line x1={pli.position} y1={-3} x2={pli.position} y2={H + 3} stroke={selectedPli === pli.id ? cc : pc} strokeWidth={(selectedPli === pli.id ? 1 : 0.5) / sc} strokeDasharray={`${2.5 / sc} ${1.5 / sc}`} />
        <text x={pli.position} y={-4} fontSize={5 / sc} fill={pc} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{pli.direction === 'haut' ? '▲' : '▼'}{pli.angle}°</text>
      </g>)}

      {/* Holes */}
      {piece.trous.map(t => { const isSel = selectedTrou === t.id, r = t.diametre / 2; return <g key={t.id} onMouseDown={e => handleDown(e, 'trou', t.id)} style={{ cursor: 'move' }}>
        <circle cx={t.x} cy={t.y} r={Math.max(r, 3 / sc)} fill="transparent" />
        {t.type === 'oblong' ? <rect x={t.x - r} y={t.y - (t.longueurOblong || 15) / 2} width={t.diametre} height={t.longueurOblong || 15} rx={r} ry={r} fill={bg} stroke={isSel ? cc : tc} strokeWidth={(isSel ? 0.8 : 0.4) / sc} /> :
        <><circle cx={t.x} cy={t.y} r={r} fill={bg} stroke={isSel ? cc : tc} strokeWidth={(isSel ? 0.8 : 0.4) / sc} /><line x1={t.x - r * 0.35} y1={t.y} x2={t.x + r * 0.35} y2={t.y} stroke={tc} strokeWidth={0.2 / sc} /><line x1={t.x} y1={t.y - r * 0.35} x2={t.x} y2={t.y + r * 0.35} stroke={tc} strokeWidth={0.2 / sc} /></>}
        {showCotes && <text x={t.x + r + 1.5} y={t.y + 0.5} fontSize={4 / sc} fill={tc} fontFamily="monospace">∅{t.diametre}{t.type === 'taraude' ? ` ${t.taraudage || ''}` : ''}</text>}
      </g>; })}

      {/* Marquages (Feature 19) */}
      {piece.marquages.map(m => <text key={m.id} x={m.x} y={m.y} fontSize={m.taille / sc * zoom} fill={darkCanvas ? '#F59E0B' : '#D97706'} fontFamily="monospace" fontWeight="bold" textAnchor="middle" opacity={0.7}>{m.texte}</text>)}

      {/* Annotations (Feature 22) */}
      {piece.annotations.map(a => <g key={a.id}>
        {a.fleche && <line x1={a.x} y1={a.y} x2={a.fleche.x2} y2={a.fleche.y2} stroke="#8B5CF6" strokeWidth={0.4 / sc} />}
        <rect x={a.x - 1} y={a.y - 4} width={a.texte.length * 2.5 + 2} height={5} rx={1} fill={darkCanvas ? '#2D2654' : '#EDE9FE'} stroke="#8B5CF6" strokeWidth={0.2 / sc} />
        <text x={a.x} y={a.y} fontSize={3.5 / sc} fill="#8B5CF6" fontFamily="monospace">{a.texte}</text>
      </g>)}

      {/* Measure tool (Feature 21) */}
      {measurePoints.length >= 1 && <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={2 / sc} fill="#EC4899" />}
      {measurePoints.length === 2 && <>
        <line x1={measurePoints[0].x} y1={measurePoints[0].y} x2={measurePoints[1].x} y2={measurePoints[1].y} stroke="#EC4899" strokeWidth={0.5 / sc} strokeDasharray={`${2 / sc} ${1 / sc}`} />
        <circle cx={measurePoints[1].x} cy={measurePoints[1].y} r={2 / sc} fill="#EC4899" />
        <text x={(measurePoints[0].x + measurePoints[1].x) / 2} y={(measurePoints[0].y + measurePoints[1].y) / 2 - 3} fontSize={5 / sc} fill="#EC4899" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          {Math.sqrt((measurePoints[1].x - measurePoints[0].x) ** 2 + (measurePoints[1].y - measurePoints[0].y) ** 2).toFixed(1)} mm
        </text>
      </>}

      {/* Auto cotes */}
      {showAutoCotes && autoCotes.map((c, i) => { const mid = { x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 }; const isH = c.type === 'horizontal'; const off = isH ? -3.5 : 3.5;
        return <g key={i} opacity={0.6}><line x1={c.x1} y1={isH ? c.y1 + off : c.y1} x2={c.x2} y2={isH ? c.y2 + off : c.y2} stroke={c.color || '#059669'} strokeWidth={0.25 / sc} strokeDasharray={`${1.2 / sc} ${0.8 / sc}`} />
          <text x={isH ? mid.x : c.x1 + off + 1.5} y={isH ? mid.y + off - 0.5 : mid.y} fontSize={3.5 / sc} fill={c.color || '#059669'} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{c.label}</text></g>; })}

      {/* Main dimensions */}
      {showCotes && <><line x1={0} y1={H + 8} x2={W} y2={H + 8} stroke={cc} strokeWidth={0.25 / sc} /><text x={W / 2} y={H + 13} fontSize={5 / sc} fill={cc} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{W}</text>
        <line x1={-8} y1={0} x2={-8} y2={H} stroke={cc} strokeWidth={0.25 / sc} /><text x={-12} y={H / 2} fontSize={5 / sc} fill={cc} textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 ${-12} ${H / 2})`}>{H}</text></>}
    </svg>
  );
}

// ═══════════════════════════════════════════════════
// EXPORT PDF + MULTI-PIÈCES (Features 7, 16)
// ═══════════════════════════════════════════════════

function exportPlanPDF(piece: PieceConfig, matConfig: MatiereConfig) {
  const pdf = new PDFBuilder('Plan Technique', piece.reference, 'landscape');
  const d = pdf.doc;
  pdf.docTitle('Plan de Fabrication', piece.reference);
  pdf.docSubtitle(`${piece.nom} — ${matConfig.nom} ép. ${piece.epaisseur} mm`);
  pdf.kpiRow([{ label: 'Largeur', value: `${piece.largeur} mm` }, { label: 'Hauteur', value: `${piece.hauteur} mm` },
    { label: 'Développée', value: `${longueurDeveloppee(piece).toFixed(1)} mm` }, { label: 'Poids', value: `${poidsEstime(piece).toFixed(3)} kg` }, { label: 'Quantité', value: String(piece.quantite) }]);

  drawDevOnPDF(d, piece, pdf, matConfig);

  pdf.section('Nomenclature');
  pdf.info([['Référence', piece.reference], ['Matière', matConfig.nom], ['Épaisseur', `${piece.epaisseur} mm`],
    ['Finition', FINITIONS.find(f => f.id === piece.finition)?.nom || 'Brut'], ['Chanfreins', piece.chanfreins.map(c => `${c.coin}:${c.type} ${c.valeur}mm`).join(', ') || '—'],
    ['Marquages', piece.marquages.map(m => `"${m.texte}" (${m.type})`).join(', ') || '—']], 3);

  if (piece.plis.length > 0) { pdf.section('Pliage'); pdf.table(['#', 'Pos', 'Angle', 'Ri', 'Dir', 'BA'], piece.plis.map((p, i) => [String(i + 1), String(p.position), `${p.angle}°`, String(p.rayonInterne), p.direction === 'haut' ? '↑' : '↓', bendAllowance(p.rayonInterne, piece.epaisseur, p.angle, getKFactor(piece.matiere, p.rayonInterne, piece.epaisseur)).toFixed(2)])); }
  if (piece.trous.length > 0) { pdf.section('Perçages'); pdf.table(['#', 'Type', 'X', 'Y', '∅', 'Détail'], piece.trous.map((t, i) => [String(i + 1), t.type, String(t.x), String(t.y), String(t.diametre), t.type === 'taraude' ? t.taraudage || '—' : t.type === 'oblong' ? `L=${t.longueurOblong}` : '—'])); }
  if (piece.encoches.length > 0) { pdf.section('Encoches'); pdf.table(['#', 'Côté', 'X', 'Y', 'L', 'H'], piece.encoches.map((e, i) => [String(i + 1), e.cote, String(e.x), String(e.y), String(e.largeur), String(e.hauteur)])); }
  if (piece.remarques) { pdf.section('Remarques'); pdf.noteBox(piece.remarques); }
  pdf.save(`Plan-${piece.reference}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

function exportMultiPDF(pieces: PieceConfig[]) {
  const pdf = new PDFBuilder('Plan Multi-Pièces', `${pieces.length} pièces`, 'landscape');
  pdf.docTitle('Plan Multi-Pièces');
  pdf.docSubtitle(`${pieces.length} pièces — export du ${fmtDate(new Date())}`);
  pdf.table(['Réf', 'Nom', 'Matière', 'Ép.', 'L×H', 'Plis', 'Trous', 'Poids', 'Qté'],
    pieces.map(p => {const mc = MATIERES.find(m => m.id === p.matiere); return [p.reference, p.nom, mc?.nom || '—', `${p.epaisseur}`, `${p.largeur}×${p.hauteur}`, String(p.plis.length), String(p.trous.length), `${poidsEstime(p).toFixed(3)}kg`, String(p.quantite)];}));

  pieces.forEach((p, i) => {
    pdf.newPage();
    const mc = MATIERES.find(m => m.id === p.matiere)!;
    pdf.docTitle(`${i + 1}/${pieces.length} — ${p.nom}`, p.reference);
    pdf.docSubtitle(`${mc.nom} ép. ${p.epaisseur} mm — ${p.largeur}×${p.hauteur} mm`);
    drawDevOnPDF(pdf.doc, p, pdf, mc);
    if (p.plis.length > 0) pdf.table(['#', 'Pos', 'Angle', 'Dir'], p.plis.map((pl, j) => [String(j + 1), String(pl.position), `${pl.angle}°`, pl.direction === 'haut' ? '↑' : '↓']));
    if (p.trous.length > 0) pdf.table(['#', 'X', 'Y', '∅', 'Type'], p.trous.map((t, j) => [String(j + 1), String(t.x), String(t.y), String(t.diametre), t.type]));
  });
  pdf.save(`MultiPlan-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// Draw developed view on PDF (shared by single & multi)
function drawDevOnPDF(d: any, p: PieceConfig, pdf: PDFBuilder, mc: MatiereConfig) {
  pdf.section('Vue développée');
  const dy = pdf.y, mxH = 50;
  const sc = Math.min((pdf.cw * 0.55) / p.largeur, mxH / p.hauteur);
  const dW = p.largeur * sc, dH = p.hauteur * sc, dX = 25;
  d.setFillColor(240, 240, 245); d.setDrawColor(100, 100, 120); d.setLineWidth(0.2); d.rect(dX, dy, dW, dH, 'FD');
  p.plis.forEach(pli => { const px = dX + pli.position * sc; d.setDrawColor(59, 130, 246); d.setLineWidth(0.12); d.setLineDashPattern([1, 1], 0); d.line(px, dy - 1, px, dy + dH + 1); d.setLineDashPattern([], 0); });
  p.trous.forEach(t => { d.setDrawColor(5, 150, 105); d.setLineWidth(0.12); d.circle(dX + t.x * sc, dy + t.y * sc, Math.max((t.diametre / 2) * sc, 0.3), 'S'); });
  p.chanfreins.forEach(ch => { if (ch.valeur <= 0) return; d.setDrawColor(234, 88, 12); d.setLineWidth(0.15); const v = ch.valeur * sc;
    if (ch.coin === 'hg') d.line(dX, dy + v, dX + v, dy); if (ch.coin === 'hd') d.line(dX + dW - v, dy, dX + dW, dy + v);
    if (ch.coin === 'bg') d.line(dX, dy + dH - v, dX + v, dy + dH); if (ch.coin === 'bd') d.line(dX + dW - v, dy + dH, dX + dW, dy + dH - v); });
  p.marquages.forEach(m => { d.setFontSize(Math.max(m.taille * sc * 0.6, 3)); d.setTextColor(217, 119, 6); d.text(m.texte, dX + m.x * sc, dy + m.y * sc, { align: 'center' }); });
  // Cotes
  d.setDrawColor(185, 28, 28); d.setLineWidth(0.1); d.line(dX, dy + dH + 3, dX + dW, dy + dH + 3); d.setFontSize(5); d.setTextColor(185, 28, 28); d.text(`${p.largeur}`, dX + dW / 2, dy + dH + 7, { align: 'center' });
  // Iso
  const isoX = dX + dW + 15, isoW = pdf.cw * 0.35;
  d.setDrawColor(200, 200, 210); d.setLineWidth(0.08); d.roundedRect(isoX, dy, isoW, dH, 1, 1, 'S');
  const iso = genererVueIso(p); if (iso.segments.length > 0) {
    const ax = iso.segments.flatMap(s => [s.x1, s.x2]), ay = iso.segments.flatMap(s => [s.y1, s.y2]);
    const mnX = Math.min(...ax), mxX = Math.max(...ax), mnY = Math.min(...ay), mxY = Math.max(...ay);
    const iSc = Math.min((isoW - 8) / (mxX - mnX || 1), (dH - 8) / (mxY - mnY || 1));
    const oX = isoX + (isoW - (mxX - mnX) * iSc) / 2 - mnX * iSc, oY = dy + (dH - (mxY - mnY) * iSc) / 2 - mnY * iSc;
    d.setDrawColor(100, 100, 120); d.setLineWidth(0.15);
    iso.segments.forEach(s => d.line(oX + s.x1 * iSc, oY + s.y1 * iSc, oX + s.x2 * iSc, oY + s.y2 * iSc));
  }
  pdf.y = dy + dH + 10;
}
