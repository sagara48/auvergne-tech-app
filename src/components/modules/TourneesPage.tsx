import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Route, User, Building2, Calendar, Plus, Package, AlertTriangle,
  ChevronRight, ChevronDown, ChevronUp, Truck, CheckCircle, Search,
  MapPin, Wrench, Eye, TrendingDown, Shield, Navigation, Clock,
  GripVertical, ExternalLink, Map, RotateCcw, Play, Zap,
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input } from '@/components/ui';
import { getTournees, getAscenseurs, getTravaux, getStockGlobal } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/stores/appStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Tournee } from '@/types';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// ═══════════════════════════════════════════
// SYNERGY 11: Pré-chargement intelligent
// ═══════════════════════════════════════════

interface PieceRecommandee {
  designation: string;
  reference?: string;
  raison: string;
  quantiteConseillee: number;
  enStock: boolean;
  stockQte: number;
  urgence: 'haute' | 'moyenne' | 'basse';
}

function PrechargementPanel({ tournee, ascenseurs, travaux, stockGlobal }: {
  tournee: Tournee;
  ascenseurs: any[];
  travaux: any[];
  stockGlobal: any[];
}) {
  const { setModuleActif } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const ascTournee = useMemo(() => {
    if (!ascenseurs) return [];
    return ascenseurs.filter((a: any) =>
      a.tournee_id === tournee.id ||
      a.secteur === tournee.secteur ||
      (tournee.code && a.tournee_code === tournee.code)
    ).slice(0, 50);
  }, [ascenseurs, tournee]);

  const recommendations = useMemo((): PieceRecommandee[] => {
    if (!travaux || !ascTournee.length) return [];
    const recs: PieceRecommandee[] = [];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const pannesParType: Record<string, { count: number; ascenseurs: string[] }> = {};
    travaux.forEach((t: any) => {
      if (!t.ascenseur_id) return;
      const isInTournee = ascTournee.some(a => a.id === t.ascenseur_id);
      if (!isInTournee) return;
      if (t.type !== 'depannage' || !t.date_creation || new Date(t.date_creation) < sixMonthsAgo) return;

      const piece = t.designation_piece || t.piece_remplacee || t.composant || 'Composant inconnu';
      if (!pannesParType[piece]) pannesParType[piece] = { count: 0, ascenseurs: [] };
      pannesParType[piece].count++;
      const ascCode = ascTournee.find(a => a.id === t.ascenseur_id)?.code_appareil || '?';
      if (!pannesParType[piece].ascenseurs.includes(ascCode)) pannesParType[piece].ascenseurs.push(ascCode);
    });

    Object.entries(pannesParType).forEach(([piece, data]) => {
      if (data.count >= 2) {
        const stockItem = stockGlobal?.find((s: any) =>
          (s.designation || s.article?.designation || '').toLowerCase().includes(piece.toLowerCase())
        );
        recs.push({
          designation: piece,
          reference: stockItem?.reference,
          raison: `${data.count} remplacements en 6 mois (${data.ascenseurs.slice(0, 3).join(', ')})`,
          quantiteConseillee: Math.max(1, Math.ceil(data.count / 3)),
          enStock: !!stockItem && (stockItem.quantite || 0) > 0,
          stockQte: stockItem?.quantite || 0,
          urgence: data.count >= 4 ? 'haute' : data.count >= 2 ? 'moyenne' : 'basse',
        });
      }
    });

    const standardParts = ['Contacteur de porte', 'Patin de guidage', 'Ampoule cabine', 'Courroie'];
    standardParts.forEach(part => {
      if (!recs.some(r => r.designation.toLowerCase().includes(part.toLowerCase()))) {
        const stockItem = stockGlobal?.find((s: any) =>
          (s.designation || s.article?.designation || '').toLowerCase().includes(part.toLowerCase())
        );
        if (stockItem && stockItem.quantite !== undefined && stockItem.quantite <= (stockItem.quantite_min || 2)) {
          recs.push({
            designation: part,
            reference: stockItem.reference,
            raison: "Pièce d'usure standard — stock bas",
            quantiteConseillee: 1,
            enStock: stockItem.quantite > 0,
            stockQte: stockItem.quantite,
            urgence: stockItem.quantite === 0 ? 'haute' : 'basse',
          });
        }
      }
    });

    return recs.sort((a, b) => ({ haute: 0, moyenne: 1, basse: 2 }[a.urgence] - { haute: 0, moyenne: 1, basse: 2 }[b.urgence]));
  }, [travaux, ascTournee, stockGlobal]);

  if (ascTournee.length === 0 && recommendations.length === 0) return null;
  const manquantes = recommendations.filter(r => !r.enStock);

  return (
    <Card className={manquantes.length > 0 ? 'border-amber-500/30' : 'border-green-500/20'}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-lime-500/5 to-green-500/5 hover:from-lime-500/10 hover:to-green-500/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-lime-500/20 flex items-center justify-center">
            <Package className="w-4 h-4 text-lime-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-[var(--text-primary)]">Pré-chargement intelligent</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {recommendations.length} pièces recommandées • {ascTournee.length} ascenseurs
              {manquantes.length > 0 && <span className="text-amber-400 ml-1">• {manquantes.length} manquantes</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {manquantes.length > 0 && <Badge variant="amber">{manquantes.length} ⚠️</Badge>}
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </div>
      </button>

      {expanded && (
        <CardBody className="p-3 space-y-2">
          {recommendations.length === 0 ? (
            <div className="text-center py-4 text-sm text-[var(--text-muted)]">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              Aucune pièce particulière recommandée
            </div>
          ) : (
            <>
              {recommendations.map((rec, i) => {
                const urgColors = { haute: 'border-red-500/30 bg-red-500/5', moyenne: 'border-amber-500/20 bg-amber-500/5', basse: 'border-[var(--border-secondary)] bg-transparent' };
                return (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${urgColors[rec.urgence]}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{rec.designation}</span>
                        {rec.reference && <span className="text-[10px] text-[var(--text-muted)] font-mono">{rec.reference}</span>}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{rec.raison}</div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <div className="text-xs font-bold text-[var(--text-primary)]">×{rec.quantiteConseillee}</div>
                      <Badge variant={rec.enStock ? 'green' : 'red'} className="text-[9px]">
                        {rec.enStock ? `${rec.stockQte} dispo` : 'Rupture'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {manquantes.length > 0 && (
                <Button variant="danger" size="sm" className="w-full mt-2" onClick={() => setModuleActif('commandes')}>
                  <Truck className="w-3.5 h-3.5" /> Commander les {manquantes.length} pièces manquantes
                </Button>
              )}
            </>
          )}
        </CardBody>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// GPS ROUTE OPTIMIZER
// Nearest-neighbor + 2-opt pour optimiser l'itinéraire
// ═══════════════════════════════════════════

interface AscenseurGPS {
  id: string;
  code: string;
  adresse: string;
  ville: string;
  lat: number;
  lng: number;
  statut?: string;
  dureeEstimee: number; // minutes d'intervention estimées
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborTSP(points: AscenseurGPS[]): AscenseurGPS[] {
  if (points.length <= 2) return [...points];
  const visited = new Set<number>();
  const route: number[] = [0];
  visited.add(0);
  
  while (visited.size < points.length) {
    const last = route[route.length - 1];
    let nearest = -1;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const d = haversineDistance(points[last].lat, points[last].lng, points[i].lat, points[i].lng);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    if (nearest === -1) break;
    route.push(nearest);
    visited.add(nearest);
  }
  return route.map(i => points[i]);
}

function twoOptImprove(points: AscenseurGPS[]): AscenseurGPS[] {
  if (points.length <= 3) return points;
  const route = [...points];
  let improved = true;
  let iterations = 0;
  
  while (improved && iterations < 100) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const d1 = haversineDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng) +
                    (j + 1 < route.length ? haversineDistance(route[j].lat, route[j].lng, route[j + 1].lat, route[j + 1].lng) : 0);
        const d2 = haversineDistance(route[i].lat, route[i].lng, route[j].lat, route[j].lng) +
                    (j + 1 < route.length ? haversineDistance(route[i + 1].lat, route[i + 1].lng, route[j + 1].lat, route[j + 1].lng) : 0);
        if (d2 < d1 - 0.001) {
          // Reverse segment i+1..j
          const segment = route.splice(i + 1, j - i);
          segment.reverse();
          route.splice(i + 1, 0, ...segment);
          improved = true;
        }
      }
    }
  }
  return route;
}

function GPSRouteOptimizer({ tournee, ascenseurs }: { tournee: Tournee; ascenseurs: any[] }) {
  const [optimizedRoute, setOptimizedRoute] = useState<AscenseurGPS[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(true);

  // Ascenseurs avec coordonnées (simulées à partir de l'adresse si manquantes)
  const ascGPS = useMemo((): AscenseurGPS[] => {
    if (!ascenseurs) return [];
    const filtered = ascenseurs.filter((a: any) =>
      a.tournee_id === tournee.id || a.secteur === tournee.secteur || a.tournee_code === tournee.code
    );
    
    // Générer des coordonnées autour de Clermont-Ferrand si manquantes
    const baseLat = 45.7772;
    const baseLng = 3.0870;
    
    return filtered.map((a: any, idx: number) => ({
      id: a.id,
      code: a.code_appareil || `ASC-${idx}`,
      adresse: a.adresse || '',
      ville: a.ville || 'Clermont-Ferrand',
      lat: a.latitude || a.lat || (baseLat + (Math.sin(idx * 2.3) * 0.03) + (idx * 0.002)),
      lng: a.longitude || a.lng || (baseLng + (Math.cos(idx * 1.7) * 0.04) + (idx * 0.003)),
      statut: a.statut,
      dureeEstimee: a.type_appareil === 'ascenseur' ? 45 : 30,
    }));
  }, [ascenseurs, tournee]);

  // Optimiser le trajet
  const handleOptimize = useCallback(() => {
    if (ascGPS.length === 0) return;
    const nn = nearestNeighborTSP(ascGPS);
    const optimized = twoOptImprove(nn);
    setOptimizedRoute(optimized);
  }, [ascGPS]);

  const route = optimizedRoute || ascGPS;

  // Stats du parcours
  const routeStats = useMemo(() => {
    let totalDist = 0;
    let totalDuree = 0;
    for (let i = 0; i < route.length; i++) {
      totalDuree += route[i].dureeEstimee;
      if (i < route.length - 1) {
        const d = haversineDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
        totalDist += d;
        totalDuree += Math.round(d / 40 * 60); // 40 km/h en ville
      }
    }
    return { totalDist: Math.round(totalDist * 10) / 10, totalDuree, nbStops: route.length };
  }, [route]);

  // SVG Map bounds
  const mapBounds = useMemo(() => {
    if (route.length === 0) return { minLat: 45.7, maxLat: 45.85, minLng: 2.95, maxLng: 3.15 };
    const lats = route.map(p => p.lat);
    const lngs = route.map(p => p.lng);
    const pad = 0.01;
    return {
      minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad,
      minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad,
    };
  }, [route]);

  const toSVG = (lat: number, lng: number) => {
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 500;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 300;
    return { x, y };
  };

  // Ouvrir dans Google Maps / Waze
  const openInGoogleMaps = () => {
    const waypoints = route.map(p => `${p.lat},${p.lng}`).join('/');
    window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
  };

  const openInWaze = () => {
    if (route.length > 0) {
      const last = route[route.length - 1];
      window.open(`https://waze.com/ul?ll=${last.lat},${last.lng}&navigate=yes`, '_blank');
    }
  };

  // Drag & drop reorder
  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    const newRoute = [...route];
    const [moved] = newRoute.splice(dragIndex, 1);
    newRoute.splice(idx, 0, moved);
    setOptimizedRoute(newRoute);
    setDragIndex(idx);
  };
  const handleDragEnd = () => setDragIndex(null);

  if (ascGPS.length === 0) return null;

  return (
    <Card className="border-blue-500/20">
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">Optimisation GPS</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {routeStats.nbStops} étapes • {routeStats.totalDist} km • ~{Math.floor(routeStats.totalDuree / 60)}h{String(routeStats.totalDuree % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowMap(!showMap)}>
            <Map className="w-3.5 h-3.5" /> {showMap ? 'Liste' : 'Carte'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleOptimize}>
            <Zap className="w-3.5 h-3.5" /> {optimizedRoute ? 'Ré-optimiser' : 'Optimiser'}
          </Button>
        </div>
      </div>

      <CardBody className="p-3 space-y-3">
        {/* Stats rapides */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Distance', value: `${routeStats.totalDist} km`, color: 'blue' },
            { label: 'Trajet', value: `${Math.round(routeStats.totalDist / 40 * 60)} min`, color: 'cyan' },
            { label: 'Interventions', value: `${route.reduce((a, r) => a + r.dureeEstimee, 0)} min`, color: 'purple' },
            { label: 'Total estimé', value: `${Math.floor(routeStats.totalDuree / 60)}h${String(routeStats.totalDuree % 60).padStart(2, '0')}`, color: 'green' },
          ].map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-center">
              <div className={`text-lg font-bold text-${s.color}-400`}>{s.value}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Carte SVG */}
        {showMap && route.length > 0 && (
          <div className="rounded-xl overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
            <svg viewBox="0 0 500 300" className="w-full h-auto" style={{ minHeight: 200 }}>
              {/* Grille */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--border-secondary)" strokeWidth="0.5" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="500" height="300" fill="url(#grid)" />

              {/* Lignes de route */}
              {route.map((p, i) => {
                if (i === route.length - 1) return null;
                const from = toSVG(p.lat, p.lng);
                const to = toSVG(route[i + 1].lat, route[i + 1].lng);
                return (
                  <line key={`line-${i}`}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={optimizedRoute ? '#3b82f6' : '#6b7280'} strokeWidth="2"
                    strokeDasharray={optimizedRoute ? 'none' : '6 4'}
                    opacity={0.7}
                  />
                );
              })}

              {/* Direction arrows */}
              {optimizedRoute && route.map((p, i) => {
                if (i === route.length - 1) return null;
                const from = toSVG(p.lat, p.lng);
                const to = toSVG(route[i + 1].lat, route[i + 1].lng);
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
                return (
                  <polygon key={`arrow-${i}`}
                    points="-4,-3 4,0 -4,3"
                    fill="#3b82f6"
                    transform={`translate(${mx},${my}) rotate(${angle})`}
                    opacity={0.8}
                  />
                );
              })}

              {/* Marqueurs */}
              {route.map((p, i) => {
                const { x, y } = toSVG(p.lat, p.lng);
                const isBreakdown = p.statut === 'en_panne';
                return (
                  <g key={`marker-${i}`}>
                    <circle cx={x} cy={y} r="12"
                      fill={isBreakdown ? '#ef4444' : optimizedRoute ? '#3b82f6' : '#6b7280'}
                      opacity={0.9}
                    />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize="9" fontWeight="bold"
                    >
                      {i + 1}
                    </text>
                    <text x={x} y={y + 22} textAnchor="middle"
                      fill="var(--text-secondary, #9ca3af)" fontSize="7" fontWeight="500"
                    >
                      {p.code.length > 12 ? p.code.substring(0, 12) + '…' : p.code}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* Liste ordonnée drag & drop */}
        {!showMap && (
          <div className="space-y-1">
            {route.map((stop, i) => {
              const distNext = i < route.length - 1
                ? haversineDistance(stop.lat, stop.lng, route[i + 1].lat, route[i + 1].lng)
                : 0;
              const tempsTrajet = Math.round(distNext / 40 * 60);
              return (
                <div key={stop.id}>
                  <div
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                      dragIndex === i ? 'border-blue-500/50 bg-blue-500/10' : 'border-transparent bg-[var(--bg-tertiary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                      stop.statut === 'en_panne' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{stop.code}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] truncate">{stop.adresse} — {stop.ville}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-[var(--text-secondary)]">{stop.dureeEstimee} min</div>
                      {stop.statut === 'en_panne' && <Badge variant="red" className="text-[8px]">Panne</Badge>}
                    </div>
                  </div>
                  {i < route.length - 1 && distNext > 0 && (
                    <div className="flex items-center gap-2 ml-10 my-0.5 text-[10px] text-[var(--text-muted)]">
                      <div className="w-px h-4 bg-blue-500/30" />
                      <Navigation className="w-3 h-3 text-blue-400" />
                      <span>{Math.round(distNext * 10) / 10} km — {tempsTrajet} min</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions navigation */}
        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="sm" className="flex-1" onClick={openInGoogleMaps}>
            <ExternalLink className="w-3.5 h-3.5" /> Google Maps
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={openInWaze}>
            <Navigation className="w-3.5 h-3.5" /> Waze
          </Button>
          {optimizedRoute && (
            <Button variant="secondary" size="sm" onClick={() => setOptimizedRoute(null)}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// PAGE TOURNÉES
// ═══════════════════════════════════════════
export function TourneesPage() {
  const { setModuleActif } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedTournee, setSelectedTournee] = useState<Tournee | null>(null);
  const [filterActif, setFilterActif] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: tournees } = useQuery({ queryKey: ['tournees'], queryFn: getTournees });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });
  const { data: travaux } = useQuery({ queryKey: ['travaux-tournees'], queryFn: () => getTravaux() });
  const { data: stockGlobal } = useQuery({ queryKey: ['stock-global'], queryFn: getStockGlobal });

  const filtered = useMemo(() => {
    if (!tournees) return [];
    return tournees.filter(t => {
      const matchSearch = !search || t.nom.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase());
      const matchActif = filterActif === 'all' || (filterActif === 'active' ? t.actif : !t.actif);
      return matchSearch && matchActif;
    });
  }, [tournees, search, filterActif]);

  const stats = {
    total: tournees?.length || 0,
    actives: tournees?.filter(t => t.actif).length || 0,
    ascenseursCouverts: tournees?.reduce((a, t) => a + t.nb_ascenseurs, 0) || 0,
    techsAssignes: new Set(tournees?.filter(t => t.technicien_id).map(t => t.technicien_id)).size,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tournées', value: stats.total, icon: Route, color: 'lime' },
          { label: 'Actives', value: stats.actives, icon: CheckCircle, color: 'green' },
          { label: 'Ascenseurs', value: stats.ascenseursCouverts, icon: Building2, color: 'cyan' },
          { label: 'Techniciens', value: stats.techsAssignes, icon: User, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardBody className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 flex items-center justify-center`}>
                <Icon className={`w-6 h-6 text-${color}-400`} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">{value}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterActif(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterActif === f ? 'bg-lime-500/20 text-lime-400' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                {f === 'all' ? 'Toutes' : f === 'active' ? 'Actives' : 'Inactives'}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary"><Plus className="w-4 h-4" /> Nouvelle tournée</Button>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {filtered.map(tournee => {
          const isSelected = selectedTournee?.id === tournee.id;
          const ascCount = ascenseurs?.filter((a: any) =>
            a.tournee_id === tournee.id || a.secteur === tournee.secteur
          ).length || tournee.nb_ascenseurs;

          return (
            <div key={tournee.id} className="space-y-2">
              <Card
                className={`hover:border-lime-500/50 transition-all cursor-pointer ${isSelected ? 'border-lime-500/50' : ''}`}
                onClick={() => setSelectedTournee(isSelected ? null : tournee)}
              >
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-lime-500/20 flex items-center justify-center">
                        <Route className="w-6 h-6 text-lime-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">{tournee.nom}</h3>
                          <Badge variant={tournee.actif ? 'green' : 'gray'}>{tournee.actif ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-tertiary)]">
                          <span className="text-lime-400 font-mono font-semibold">{tournee.code}</span>
                          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {ascCount} ascenseurs</span>
                          <span className="flex items-center gap-1 capitalize"><Calendar className="w-3.5 h-3.5" /> {tournee.frequence}</span>
                          {tournee.technicien && (
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {tournee.technicien.prenom} {tournee.technicien.nom}</span>
                          )}
                          {tournee.secteur && <Badge variant="blue">{tournee.secteur}</Badge>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </CardBody>
              </Card>

              {/* Pré-chargement intelligent + GPS */}
              {isSelected && ascenseurs && travaux && stockGlobal && (
                <div className="space-y-2">
                  <GPSRouteOptimizer
                    tournee={tournee}
                    ascenseurs={ascenseurs as any[]}
                  />
                  <PrechargementPanel
                    tournee={tournee}
                    ascenseurs={ascenseurs as any[]}
                    travaux={travaux as any[]}
                    stockGlobal={stockGlobal as any[]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(!tournees || tournees.length === 0) && (
        <Card>
          <CardBody className="text-center py-12 text-[var(--text-muted)]">
            Aucune tournée configurée
          </CardBody>
        </Card>
      )}
    </div>
  );
}
