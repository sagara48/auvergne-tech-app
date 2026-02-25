// ═══════════════════════════════════════════════════════════════
// FREE DRAW CANVAS — Dessin libre de contour tôlerie
// Dessiner un polygone point par point, coter, éditer
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  MousePointer2, Pencil, Ruler, Move, Trash2, CornerDownRight,
  ZoomIn, ZoomOut, Grid3x3, Target, Undo2, Redo2, RotateCcw,
  Plus, X, Check, Eye, EyeOff, Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══ TYPES ═══

export interface Point2D {
  x: number;
  y: number;
}

export interface OutlineEdge {
  from: number;  // index in outline
  to: number;
  length: number;
}

export type DrawTool = 'select' | 'draw' | 'dimension' | 'hole' | 'pan';

interface DimensionEdit {
  edgeIdx: number;
  value: string;
  midX: number;
  midY: number;
}

interface FreeDrawCanvasProps {
  outline: Point2D[];
  trous: any[];
  onOutlineChange: (outline: Point2D[]) => void;
  onTrousChange: (trous: any[]) => void;
  onBoundsChange: (w: number, h: number) => void;
  darkCanvas?: boolean;
  showGrid?: boolean;
  epaisseur?: number;
  className?: string;
}

// ═══ HELPERS ═══

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function snapToGrid(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

function edgeMidpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function edgeAngle(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function pointToEdgeDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function computeBounds(outline: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  if (outline.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  outline.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function outlineArea(pts: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
}

function uid(): string { return Math.random().toString(36).substring(2, 9); }

// ═══ COMPOSANT PRINCIPAL ═══

export default function FreeDrawCanvas({
  outline,
  trous,
  onOutlineChange,
  onTrousChange,
  onBoundsChange,
  darkCanvas = false,
  showGrid: showGridProp = true,
  epaisseur = 2,
  className,
}: FreeDrawCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // ── State ──
  const [tool, setTool] = useState<DrawTool>(outline.length === 0 ? 'draw' : 'select');
  const [closed, setClosed] = useState(outline.length >= 3);
  const [drawPoints, setDrawPoints] = useState<Point2D[]>(outline.length >= 3 ? [] : [...outline]);
  const [mousePos, setMousePos] = useState<Point2D>({ x: 0, y: 0 });
  const [hoverVertex, setHoverVertex] = useState<number | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{ type: 'vertex' | 'pan'; idx?: number; startPan?: Point2D; startMouse?: Point2D } | null>(null);
  const [dimEdit, setDimEdit] = useState<DimensionEdit | null>(null);
  const [showCotes, setShowCotes] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [showGridState, setShowGridState] = useState(showGridProp);
  const [gridSize, setGridSize] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [orthoMode, setOrthoMode] = useState(false);
  const [holeRadius, setHoleRadius] = useState(5);

  const dimInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ──
  const isClosed = closed && outline.length >= 3;
  const pts = isClosed ? outline : drawPoints;
  const bounds = useMemo(() => computeBounds(outline), [outline]);

  // Update bounds on outline change
  useEffect(() => {
    if (outline.length >= 3) {
      const b = computeBounds(outline);
      onBoundsChange(Math.round(b.w * 100) / 100, Math.round(b.h * 100) / 100);
    }
  }, [outline]);

  // Auto-focus dim input
  useEffect(() => {
    if (dimEdit && dimInputRef.current) dimInputRef.current.focus();
  }, [dimEdit]);

  // ── Coordinate conversion ──
  const svgPoint = useCallback((e: React.MouseEvent): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawX = (e.clientX - rect.left - rect.width / 2) / zoom - pan.x;
    const rawY = (e.clientY - rect.top - rect.height / 2) / zoom - pan.y;
    return { x: rawX, y: rawY };
  }, [zoom, pan]);

  const snap = useCallback((p: Point2D, ortho?: Point2D): Point2D => {
    let { x, y } = p;
    if (gridSnap) { x = snapToGrid(x, gridSize); y = snapToGrid(y, gridSize); }
    if (orthoMode && ortho) {
      const dx = Math.abs(x - ortho.x), dy = Math.abs(y - ortho.y);
      if (dx > dy) y = ortho.y; else x = ortho.x;
    }
    return { x, y };
  }, [gridSnap, gridSize, orthoMode]);

  // ── Edge helpers ──
  const getEdges = useCallback((points: Point2D[]): OutlineEdge[] => {
    if (points.length < 2) return [];
    const edges: OutlineEdge[] = [];
    const n = points.length;
    const loop = isClosed ? n : n - 1;
    for (let i = 0; i < loop; i++) {
      const j = (i + 1) % n;
      edges.push({ from: i, to: j, length: Math.round(dist(points[i], points[j]) * 100) / 100 });
    }
    return edges;
  }, [isClosed]);

  const edges = useMemo(() => getEdges(pts), [pts, getEdges]);

  // ── Find nearest vertex / edge ──
  const findVertex = useCallback((mp: Point2D, threshold: number): number | null => {
    const t = threshold / zoom;
    for (let i = 0; i < pts.length; i++) {
      if (dist(mp, pts[i]) < t) return i;
    }
    return null;
  }, [pts, zoom]);

  const findEdge = useCallback((mp: Point2D, threshold: number): number | null => {
    const t = threshold / zoom;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (pointToEdgeDist(mp, pts[e.from], pts[e.to]) < t) return i;
    }
    return null;
  }, [pts, edges, zoom]);

  // ══════════════════════
  // EVENT HANDLERS
  // ══════════════════════

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const raw = svgPoint(e);
    const lastPt = drawPoints.length > 0 ? drawPoints[drawPoints.length - 1] : undefined;
    const mp = snap(raw, lastPt);
    setMousePos(mp);
    setOrthoMode(e.shiftKey);

    if (dragging) {
      if (dragging.type === 'vertex' && dragging.idx != null) {
        const snapped = snap(raw);
        const newOutline = [...outline];
        newOutline[dragging.idx] = snapped;
        onOutlineChange(newOutline);
      } else if (dragging.type === 'pan' && dragging.startPan && dragging.startMouse) {
        const dx = (e.clientX - dragging.startMouse.x) / zoom;
        const dy = (e.clientY - dragging.startMouse.y) / zoom;
        setPan({ x: dragging.startPan.x + dx, y: dragging.startPan.y + dy });
      }
      return;
    }

    // Hover detection
    if (tool === 'select' || tool === 'dimension') {
      setHoverVertex(findVertex(mp, 12));
      setHoverEdge(hoverVertex === null ? findEdge(mp, 8) : null);
    }
  }, [svgPoint, snap, dragging, tool, outline, drawPoints, findVertex, findEdge, hoverVertex, onOutlineChange, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      // Middle click or pan tool → pan
      setDragging({ type: 'pan', startPan: { ...pan }, startMouse: { x: e.clientX, y: e.clientY } });
      e.preventDefault();
      return;
    }

    const raw = svgPoint(e);
    const lastPt = drawPoints.length > 0 ? drawPoints[drawPoints.length - 1] : undefined;
    const mp = snap(raw, lastPt);

    if (tool === 'draw') {
      // ─── DRAW MODE ───
      if (!isClosed) {
        // Check if closing
        if (drawPoints.length >= 3) {
          if (dist(mp, drawPoints[0]) < 15 / zoom) {
            // Close the polygon!
            const finalOutline = [...drawPoints];
            onOutlineChange(finalOutline);
            setClosed(true);
            setDrawPoints([]);
            setTool('select');
            return;
          }
        }
        setDrawPoints(prev => [...prev, mp]);
      }
    } else if (tool === 'select') {
      // ─── SELECT MODE ───
      if (hoverVertex !== null) {
        setSelectedVertex(hoverVertex);
        setSelectedEdge(null);
        setDragging({ type: 'vertex', idx: hoverVertex });
      } else if (hoverEdge !== null) {
        setSelectedEdge(hoverEdge);
        setSelectedVertex(null);
      } else {
        setSelectedVertex(null);
        setSelectedEdge(null);
      }
    } else if (tool === 'dimension') {
      // ─── DIMENSION MODE ───
      if (hoverEdge !== null && isClosed) {
        const edge = edges[hoverEdge];
        const mid = edgeMidpoint(pts[edge.from], pts[edge.to]);
        setDimEdit({
          edgeIdx: hoverEdge,
          value: String(Math.round(edge.length * 10) / 10),
          midX: mid.x,
          midY: mid.y,
        });
      }
    } else if (tool === 'hole') {
      // ─── HOLE MODE ───
      if (isClosed) {
        const snapped = snap(raw);
        const newTrou = {
          id: uid(),
          x: snapped.x, y: snapped.y,
          type: 'rond' as const,
          diametre: holeRadius * 2,
        };
        onTrousChange([...trous, newTrou]);
      }
    }
  }, [tool, svgPoint, snap, drawPoints, isClosed, outline, hoverVertex, hoverEdge, edges, pts, zoom, pan, onOutlineChange, onTrousChange, trous, holeRadius]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.1, Math.min(10, z * factor)));
  }, []);

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dimEdit) return; // Don't capture keys during dim edit
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') {
        if (tool === 'draw' && drawPoints.length > 0) {
          setDrawPoints([]);
        }
        setSelectedVertex(null); setSelectedEdge(null); setDimEdit(null);
        setTool('select');
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (tool === 'draw' && drawPoints.length > 0) {
          setDrawPoints(prev => prev.slice(0, -1));
          return;
        }
        if (selectedVertex !== null && outline.length > 3) {
          const newOutline = outline.filter((_, i) => i !== selectedVertex);
          onOutlineChange(newOutline);
          setSelectedVertex(null);
        }
      }
      if (e.key === 'Enter' && tool === 'draw' && drawPoints.length >= 3) {
        onOutlineChange([...drawPoints]);
        setClosed(true);
        setDrawPoints([]);
        setTool('select');
      }
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'd' || e.key === 'D') setTool('draw');
      if (e.key === 'c' || e.key === 'C') setTool('dimension');
      if (e.key === 'h' || e.key === 'H') setTool('hole');
      // Split edge (insert vertex)
      if (e.key === 'i' && selectedEdge !== null && isClosed) {
        const edge = edges[selectedEdge];
        const mid = edgeMidpoint(outline[edge.from], outline[edge.to]);
        const snapped = gridSnap ? { x: snapToGrid(mid.x, gridSize), y: snapToGrid(mid.y, gridSize) } : mid;
        const newOutline = [...outline];
        newOutline.splice(edge.to, 0, snapped);
        onOutlineChange(newOutline);
        setSelectedEdge(null);
      }
      // Grip grid size
      if (e.key === '+' || e.key === '=') setGridSize(g => Math.min(100, g * 2));
      if (e.key === '-') setGridSize(g => Math.max(1, g / 2));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tool, drawPoints, selectedVertex, selectedEdge, outline, isClosed, edges, dimEdit, gridSnap, gridSize, onOutlineChange]);

  // ── Dimension edit ──
  const applyDimension = useCallback(() => {
    if (!dimEdit || !isClosed) return;
    const newLen = parseFloat(dimEdit.value);
    if (isNaN(newLen) || newLen <= 0) { setDimEdit(null); return; }

    const edge = edges[dimEdit.edgeIdx];
    const curLen = edge.length;
    if (Math.abs(curLen - newLen) < 0.01) { setDimEdit(null); return; }

    const a = outline[edge.from], b = outline[edge.to];
    const angle = edgeAngle(a, b);
    const ratio = newLen / curLen;

    // Move vertex B to match new length
    const newB: Point2D = {
      x: Math.round((a.x + Math.cos(angle) * newLen) * 100) / 100,
      y: Math.round((a.y + Math.sin(angle) * newLen) * 100) / 100,
    };

    // Cascade: shift all vertices after B by the delta
    const dx = newB.x - b.x, dy = newB.y - b.y;
    const newOutline = outline.map((p, i) => {
      if (i === edge.to) return newB;
      // Shift subsequent vertices to maintain shape
      if (isAfter(i, edge.to, outline.length)) return { x: p.x + dx, y: p.y + dy };
      return p;
    });

    onOutlineChange(newOutline);
    setDimEdit(null);
  }, [dimEdit, edges, outline, isClosed, onOutlineChange]);

  // ── Double click → split edge ──
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isClosed) return;
    const mp = svgPoint(e);
    const edgeIdx = findEdge(mp, 10);
    if (edgeIdx !== null) {
      const edge = edges[edgeIdx];
      const mid = snap(edgeMidpoint(outline[edge.from], outline[edge.to]));
      const newOutline = [...outline];
      newOutline.splice(edge.to, 0, mid);
      onOutlineChange(newOutline);
    }
  }, [isClosed, svgPoint, findEdge, edges, outline, snap, onOutlineChange]);

  // ── Reset ──
  const resetOutline = useCallback(() => {
    onOutlineChange([]);
    setDrawPoints([]);
    setClosed(false);
    setTool('draw');
    setSelectedVertex(null);
    setSelectedEdge(null);
    setDimEdit(null);
  }, [onOutlineChange]);

  // ══════════════════════
  // RENDERING
  // ══════════════════════

  const bg = darkCanvas ? '#1a1a2e' : '#fafbfc';
  const gridColor = darkCanvas ? 'rgba(100,100,150,0.15)' : 'rgba(0,0,80,0.06)';
  const gridColorMajor = darkCanvas ? 'rgba(100,100,150,0.3)' : 'rgba(0,0,80,0.12)';
  const shapeStroke = darkCanvas ? '#60A5FA' : '#2563EB';
  const shapeFill = darkCanvas ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)';
  const vertexFill = darkCanvas ? '#3B82F6' : '#2563EB';
  const vertexHover = '#F59E0B';
  const vertexSelected = '#EF4444';
  const edgeHoverColor = '#F59E0B';
  const dimColor = darkCanvas ? '#34D399' : '#059669';
  const previewColor = darkCanvas ? '#818CF8' : '#6366F1';
  const trouColor = darkCanvas ? '#F472B6' : '#DB2777';
  const textColor = darkCanvas ? '#E2E8F0' : '#1E293B';

  // Viewbox
  const vbSize = 600;
  const vbHalf = vbSize / 2;

  // Grid pattern
  const gridSvgSize = gridSize;
  const majorEvery = gridSize >= 10 ? 5 : 10;

  // Status bar
  const area = isClosed ? outlineArea(outline) : 0;
  const perimeter = edges.reduce((s, e) => s + e.length, 0);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-0.5 mr-2">
          {[
            { id: 'select' as DrawTool, icon: MousePointer2, label: 'Sélection (V)', shortcut: 'V' },
            { id: 'draw' as DrawTool, icon: Pencil, label: 'Dessiner (D)', shortcut: 'D' },
            { id: 'dimension' as DrawTool, icon: Ruler, label: 'Coter (C)', shortcut: 'C' },
            { id: 'hole' as DrawTool, icon: Circle, label: 'Perçage (H)', shortcut: 'H' },
            { id: 'pan' as DrawTool, icon: Move, label: 'Déplacer', shortcut: '' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={cn(
                'p-1.5 rounded transition-all',
                tool === t.id
                  ? 'bg-[#B91C1C] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              <t.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--border-secondary)]" />

        {/* Grid & Snap */}
        <div className="flex items-center gap-0.5 mx-1">
          <button
            onClick={() => setShowGridState(g => !g)}
            title="Grille"
            className={cn('p-1.5 rounded', showGridState ? 'text-blue-500' : 'text-[var(--text-muted)]')}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setGridSnap(s => !s)}
            title={`Magnétisme (${gridSize}mm)`}
            className={cn('p-1.5 rounded', gridSnap ? 'text-amber-500' : 'text-[var(--text-muted)]')}
          >
            <Target className="w-4 h-4" />
          </button>
          <select
            value={gridSize}
            onChange={e => setGridSize(Number(e.target.value))}
            className="text-[10px] px-1 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-primary)]"
          >
            {[1, 2, 5, 10, 25, 50].map(v => <option key={v} value={v}>{v}mm</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-[var(--border-secondary)]" />

        {/* View */}
        <div className="flex items-center gap-0.5 mx-1">
          <button onClick={() => setShowCotes(c => !c)} title="Cotations" className={cn('p-1.5 rounded', showCotes ? 'text-emerald-500' : 'text-[var(--text-muted)]')}>
            {showCotes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setZoom(z => Math.min(10, z * 1.3))} title="Zoom +" className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.1, z / 1.3))} title="Zoom -" className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset vue" className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border-secondary)]" />

        {/* Actions */}
        <div className="flex items-center gap-0.5 mx-1">
          {isClosed && selectedEdge !== null && (
            <button
              onClick={() => {
                const edge = edges[selectedEdge];
                const mid = snap(edgeMidpoint(outline[edge.from], outline[edge.to]));
                const newOutline = [...outline]; newOutline.splice(edge.to, 0, mid);
                onOutlineChange(newOutline); setSelectedEdge(null);
              }}
              title="Insérer sommet (I)"
              className="p-1.5 rounded text-blue-500 hover:bg-blue-500/10"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {isClosed && selectedVertex !== null && outline.length > 3 && (
            <button
              onClick={() => {
                onOutlineChange(outline.filter((_, i) => i !== selectedVertex));
                setSelectedVertex(null);
              }}
              title="Supprimer sommet (Del)"
              className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={resetOutline} title="Effacer tout" className="p-1.5 rounded text-red-500/60 hover:bg-red-500/10 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hole radius */}
        {tool === 'hole' && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[10px] text-[var(--text-muted)]">∅</span>
            <input
              type="number"
              value={holeRadius * 2}
              onChange={e => setHoleRadius(Math.max(1, Number(e.target.value) / 2))}
              className="w-12 text-[10px] px-1 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-primary)] font-mono"
            />
            <span className="text-[10px] text-[var(--text-muted)]">mm</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status */}
        <div className="flex items-center gap-3 text-[9px] text-[var(--text-muted)] font-mono">
          <span>X:{mousePos.x.toFixed(0)} Y:{mousePos.y.toFixed(0)}</span>
          {isClosed && <span>{outline.length} pts</span>}
          {isClosed && <span>P:{perimeter.toFixed(1)}mm</span>}
          {isClosed && <span>S:{area.toFixed(0)}mm²</span>}
          {orthoMode && <span className="text-amber-500 font-bold">ORTHO</span>}
          {gridSnap && <span className="text-blue-400">SNAP {gridSize}</span>}
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div className="flex-1 relative overflow-hidden" style={{ background: bg }}>
        {/* Instructions overlay */}
        {!isClosed && drawPoints.length === 0 && tool === 'draw' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className={cn('px-6 py-4 rounded-2xl backdrop-blur-sm text-center max-w-sm',
              darkCanvas ? 'bg-slate-800/80 text-slate-200' : 'bg-white/80 text-slate-700 shadow-lg')}>
              <Pencil className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm mb-1">Dessinez votre pièce</p>
              <p className="text-xs opacity-70">
                Cliquez pour placer les sommets du contour.
                <br />Cliquez sur le premier point ou <kbd className="px-1 py-0.5 bg-black/10 rounded text-[10px]">Entrée</kbd> pour fermer.
                <br /><kbd className="px-1 py-0.5 bg-black/10 rounded text-[10px]">Shift</kbd> = contrainte H/V &nbsp;
                <kbd className="px-1 py-0.5 bg-black/10 rounded text-[10px]">Retour</kbd> = annuler dernier point
              </p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: getCursor(tool, hoverVertex, hoverEdge, dragging) }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onContextMenu={e => e.preventDefault()}
        >
          {/* Transform group */}
          <g transform={`translate(${svgRef.current ? svgRef.current.clientWidth / 2 : 300}, ${svgRef.current ? svgRef.current.clientHeight / 2 : 250}) scale(${zoom}) translate(${pan.x}, ${pan.y})`}>

            {/* Grid */}
            {showGridState && (
              <g>
                {Array.from({ length: 201 }, (_, i) => {
                  const v = (i - 100) * gridSize;
                  const isMajor = i % majorEvery === 0;
                  return (
                    <g key={i}>
                      <line x1={v} y1={-100 * gridSize} x2={v} y2={100 * gridSize}
                        stroke={isMajor ? gridColorMajor : gridColor} strokeWidth={isMajor ? 0.5 / zoom : 0.25 / zoom} />
                      <line y1={v} x1={-100 * gridSize} y2={v} x2={100 * gridSize}
                        stroke={isMajor ? gridColorMajor : gridColor} strokeWidth={isMajor ? 0.5 / zoom : 0.25 / zoom} />
                    </g>
                  );
                })}
                {/* Origin cross */}
                <line x1={-8 / zoom} y1={0} x2={8 / zoom} y2={0} stroke={darkCanvas ? '#EF444440' : '#EF444430'} strokeWidth={1 / zoom} />
                <line x1={0} y1={-8 / zoom} x2={0} y2={8 / zoom} stroke={darkCanvas ? '#EF444440' : '#EF444430'} strokeWidth={1 / zoom} />
              </g>
            )}

            {/* ─── CLOSED SHAPE ─── */}
            {isClosed && (
              <>
                {/* Fill */}
                <polygon
                  points={outline.map(p => `${p.x},${p.y}`).join(' ')}
                  fill={shapeFill}
                  stroke={shapeStroke}
                  strokeWidth={1.5 / zoom}
                  strokeLinejoin="round"
                />

                {/* Edge hover highlight */}
                {hoverEdge !== null && (
                  <line
                    x1={outline[edges[hoverEdge].from].x} y1={outline[edges[hoverEdge].from].y}
                    x2={outline[edges[hoverEdge].to].x} y2={outline[edges[hoverEdge].to].y}
                    stroke={edgeHoverColor} strokeWidth={3 / zoom} opacity={0.6}
                  />
                )}

                {/* Selected edge highlight */}
                {selectedEdge !== null && edges[selectedEdge] && (
                  <line
                    x1={outline[edges[selectedEdge].from].x} y1={outline[edges[selectedEdge].from].y}
                    x2={outline[edges[selectedEdge].to].x} y2={outline[edges[selectedEdge].to].y}
                    stroke={vertexSelected} strokeWidth={2.5 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                  />
                )}

                {/* Dimension labels on edges */}
                {showCotes && edges.map((edge, i) => {
                  const a = outline[edge.from], b = outline[edge.to];
                  const mid = edgeMidpoint(a, b);
                  const angle = edgeAngle(a, b);
                  const normalAngle = angle + Math.PI / 2;
                  const offset = 12 / zoom;
                  const labelX = mid.x + Math.cos(normalAngle) * offset;
                  const labelY = mid.y + Math.sin(normalAngle) * offset;
                  const rotDeg = (angle * 180 / Math.PI);
                  // Keep text readable (not upside down)
                  const adjustedRot = rotDeg > 90 || rotDeg < -90 ? rotDeg + 180 : rotDeg;

                  // Dimension line
                  const tickLen = 4 / zoom;
                  const lineOff = 8 / zoom;

                  return (
                    <g key={i} opacity={dimEdit?.edgeIdx === i ? 0.3 : 0.8}>
                      {/* Dimension line */}
                      <line
                        x1={a.x + Math.cos(normalAngle) * lineOff}
                        y1={a.y + Math.sin(normalAngle) * lineOff}
                        x2={b.x + Math.cos(normalAngle) * lineOff}
                        y2={b.y + Math.sin(normalAngle) * lineOff}
                        stroke={dimColor} strokeWidth={0.5 / zoom}
                      />
                      {/* Extension lines */}
                      <line
                        x1={a.x + Math.cos(normalAngle) * (lineOff - tickLen)}
                        y1={a.y + Math.sin(normalAngle) * (lineOff - tickLen)}
                        x2={a.x + Math.cos(normalAngle) * (lineOff + tickLen)}
                        y2={a.y + Math.sin(normalAngle) * (lineOff + tickLen)}
                        stroke={dimColor} strokeWidth={0.4 / zoom}
                      />
                      <line
                        x1={b.x + Math.cos(normalAngle) * (lineOff - tickLen)}
                        y1={b.y + Math.sin(normalAngle) * (lineOff - tickLen)}
                        x2={b.x + Math.cos(normalAngle) * (lineOff + tickLen)}
                        y2={b.y + Math.sin(normalAngle) * (lineOff + tickLen)}
                        stroke={dimColor} strokeWidth={0.4 / zoom}
                      />
                      {/* Label */}
                      <text
                        x={labelX} y={labelY}
                        fontSize={10 / zoom}
                        fill={dimColor}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="monospace"
                        fontWeight="bold"
                        transform={`rotate(${adjustedRot} ${labelX} ${labelY})`}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDimEdit({ edgeIdx: i, value: String(Math.round(edge.length * 10) / 10), midX: labelX, midY: labelY });
                        }}
                      >
                        {Math.round(edge.length * 10) / 10}
                      </text>
                    </g>
                  );
                })}

                {/* Vertices */}
                {outline.map((p, i) => {
                  const isHover = hoverVertex === i;
                  const isSel = selectedVertex === i;
                  const r = (isSel ? 5 : isHover ? 4.5 : 3.5) / zoom;
                  return (
                    <circle
                      key={i}
                      cx={p.x} cy={p.y} r={r}
                      fill={isSel ? vertexSelected : isHover ? vertexHover : vertexFill}
                      stroke="white" strokeWidth={1 / zoom}
                      style={{ cursor: 'move' }}
                    />
                  );
                })}

                {/* Trous (holes) */}
                {trous.map((t: any) => (
                  <g key={t.id}>
                    <circle cx={t.x} cy={t.y} r={t.diametre / 2}
                      fill="transparent" stroke={trouColor} strokeWidth={1 / zoom} />
                    <line x1={t.x - 2 / zoom} y1={t.y} x2={t.x + 2 / zoom} y2={t.y}
                      stroke={trouColor} strokeWidth={0.3 / zoom} />
                    <line x1={t.x} y1={t.y - 2 / zoom} x2={t.x} y2={t.y + 2 / zoom}
                      stroke={trouColor} strokeWidth={0.3 / zoom} />
                    <text x={t.x + t.diametre / 2 + 3 / zoom} y={t.y + 1 / zoom}
                      fontSize={8 / zoom} fill={trouColor} fontFamily="monospace">∅{t.diametre}</text>
                  </g>
                ))}
              </>
            )}

            {/* ─── DRAWING PREVIEW ─── */}
            {!isClosed && drawPoints.length > 0 && (
              <>
                {/* Placed segments */}
                <polyline
                  points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={previewColor}
                  strokeWidth={1.5 / zoom}
                  strokeLinejoin="round"
                />
                {/* Rubber band to mouse */}
                <line
                  x1={drawPoints[drawPoints.length - 1].x} y1={drawPoints[drawPoints.length - 1].y}
                  x2={mousePos.x} y2={mousePos.y}
                  stroke={previewColor} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                />
                {/* Closing hint line */}
                {drawPoints.length >= 3 && dist(mousePos, drawPoints[0]) < 15 / zoom && (
                  <line
                    x1={mousePos.x} y1={mousePos.y}
                    x2={drawPoints[0].x} y2={drawPoints[0].y}
                    stroke="#22C55E" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                  />
                )}
                {/* Placed vertices */}
                {drawPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y}
                    r={(i === 0 && drawPoints.length >= 3 && dist(mousePos, drawPoints[0]) < 15 / zoom ? 6 : 3.5) / zoom}
                    fill={i === 0 && drawPoints.length >= 3 ? '#22C55E' : previewColor}
                    stroke="white" strokeWidth={0.8 / zoom}
                  />
                ))}
                {/* Edge lengths */}
                {showCotes && drawPoints.length >= 2 && drawPoints.slice(1).map((p, i) => {
                  const prev = drawPoints[i];
                  const d = dist(prev, p);
                  const mid = edgeMidpoint(prev, p);
                  return (
                    <text key={i} x={mid.x} y={mid.y - 6 / zoom}
                      fontSize={9 / zoom} fill={dimColor} textAnchor="middle"
                      fontFamily="monospace" fontWeight="bold">
                      {Math.round(d * 10) / 10}
                    </text>
                  );
                })}
                {/* Live distance to mouse */}
                {drawPoints.length > 0 && (
                  <text
                    x={(drawPoints[drawPoints.length - 1].x + mousePos.x) / 2}
                    y={(drawPoints[drawPoints.length - 1].y + mousePos.y) / 2 - 8 / zoom}
                    fontSize={9 / zoom} fill={previewColor} textAnchor="middle"
                    fontFamily="monospace" fontWeight="bold" opacity={0.7}
                  >
                    {Math.round(dist(drawPoints[drawPoints.length - 1], mousePos) * 10) / 10}
                  </text>
                )}
              </>
            )}

            {/* ─── CURSOR CROSSHAIR ─── */}
            {(tool === 'draw' || tool === 'hole') && (
              <g opacity={0.4}>
                <line x1={mousePos.x - 10 / zoom} y1={mousePos.y} x2={mousePos.x + 10 / zoom} y2={mousePos.y}
                  stroke={textColor} strokeWidth={0.3 / zoom} />
                <line x1={mousePos.x} y1={mousePos.y - 10 / zoom} x2={mousePos.x} y2={mousePos.y + 10 / zoom}
                  stroke={textColor} strokeWidth={0.3 / zoom} />
              </g>
            )}

            {/* Hole preview */}
            {tool === 'hole' && isClosed && (
              <circle cx={mousePos.x} cy={mousePos.y} r={holeRadius}
                fill="transparent" stroke={trouColor} strokeWidth={0.8 / zoom}
                strokeDasharray={`${3 / zoom} ${2 / zoom}`} opacity={0.6} />
            )}
          </g>
        </svg>

        {/* ═══ DIMENSION EDIT OVERLAY ═══ */}
        {dimEdit && svgRef.current && (
          <div
            className="absolute z-20"
            style={{
              left: svgRef.current.clientWidth / 2 + (dimEdit.midX + pan.x) * zoom - 40,
              top: svgRef.current.clientHeight / 2 + (dimEdit.midY + pan.y) * zoom - 16,
            }}
          >
            <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-emerald-500 rounded-lg shadow-lg px-2 py-1">
              <input
                ref={dimInputRef}
                type="number"
                value={dimEdit.value}
                onChange={e => setDimEdit({ ...dimEdit, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') applyDimension(); if (e.key === 'Escape') setDimEdit(null); }}
                className="w-20 text-xs font-mono bg-transparent text-emerald-600 dark:text-emerald-400 outline-none text-center"
                step="0.1"
              />
              <span className="text-[10px] text-[var(--text-muted)]">mm</span>
              <button onClick={applyDimension} className="p-0.5 text-emerald-500 hover:text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDimEdit(null)} className="p-0.5 text-[var(--text-muted)] hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM HINTS ═══ */}
      <div className="flex items-center gap-4 px-3 py-1 bg-[var(--bg-secondary)] border-t border-[var(--border-secondary)] text-[9px] text-[var(--text-muted)]">
        {tool === 'draw' && !isClosed && <span>🖊️ Cliquez pour placer les sommets • <b>Shift</b>=ortho • <b>Entrée</b>=fermer • <b>Retour</b>=annuler pt</span>}
        {tool === 'select' && isClosed && <span>↗️ Glissez un sommet pour le déplacer • <b>Double-clic</b> sur arête=insérer pt • <b>Suppr</b>=retirer pt • <b>I</b>=insérer</span>}
        {tool === 'dimension' && isClosed && <span>📏 Cliquez sur une cotation pour l'éditer • La cote modifie la longueur de l'arête</span>}
        {tool === 'hole' && isClosed && <span>⊙ Cliquez pour placer un perçage ∅{holeRadius * 2}mm</span>}
        {tool === 'pan' && <span>✋ Glissez pour déplacer la vue • Molette=zoom</span>}
        <span className="ml-auto opacity-60">Molette=zoom • Clic milieu=déplacer</span>
      </div>
    </div>
  );
}

// ═══ HELPERS ═══

function getCursor(tool: DrawTool, hoverV: number | null, hoverE: number | null, dragging: any): string {
  if (dragging?.type === 'pan') return 'grabbing';
  if (dragging?.type === 'vertex') return 'move';
  if (tool === 'pan') return 'grab';
  if (tool === 'draw') return 'crosshair';
  if (tool === 'hole') return 'crosshair';
  if (tool === 'dimension') return hoverE !== null ? 'pointer' : 'default';
  if (hoverV !== null) return 'move';
  if (hoverE !== null) return 'pointer';
  return 'default';
}

function isAfter(idx: number, afterIdx: number, total: number): boolean {
  // For a circular polygon: determine if idx comes "after" afterIdx
  // Simple approach: treat afterIdx+1 through end as "after"
  if (afterIdx < total - 1) return idx > afterIdx;
  return false;
}
