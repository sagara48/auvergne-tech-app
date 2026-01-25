import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Package, Calendar, User, MapPin, Search, Filter,
  ChevronDown, ChevronRight, RefreshCw, Download, Clock
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, subDays, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================
// TYPES
// =============================================
interface PieceRemplaceeRecord {
  id: string;
  date: string;
  code_appareil: string;
  adresse?: string;
  ville?: string;
  designation: string;
  reference?: string;
  quantite: number;
  technicien_nom?: string;
  motif?: string;
}

interface PiecesParAppareil {
  code_appareil: string;
  adresse?: string;
  ville?: string;
  total_pieces: number;
  derniere_intervention: string;
  pieces: PieceRemplaceeRecord[];
}

// =============================================
// API FUNCTIONS
// =============================================

// Récupérer les pièces remplacées pour un ascenseur spécifique
async function getPiecesRemplaceesByAscenseur(codeAppareil: string): Promise<PieceRemplaceeRecord[]> {
  // 1. Depuis stock_mouvements
  const { data: mouvements } = await supabase
    .from('stock_mouvements')
    .select(`
      id,
      date_mouvement,
      quantite,
      motif,
      code_appareil,
      technicien:technicien_id(prenom, nom),
      article:article_id(designation, reference)
    `)
    .eq('code_appareil', codeAppareil)
    .eq('type_mouvement', 'sortie')
    .order('date_mouvement', { ascending: false })
    .limit(100);

  const pieces: PieceRemplaceeRecord[] = (mouvements || []).map((m: any) => ({
    id: m.id,
    date: m.date_mouvement,
    code_appareil: m.code_appareil,
    designation: m.article?.designation || 'Article inconnu',
    reference: m.article?.reference,
    quantite: m.quantite,
    technicien_nom: m.technicien ? `${m.technicien.prenom} ${m.technicien.nom}`.trim() : undefined,
    motif: m.motif,
  }));

  // 2. Depuis interventions_rapides
  const { data: interventions } = await supabase
    .from('interventions_rapides')
    .select('*')
    .eq('code_appareil', codeAppareil)
    .eq('type_intervention', 'remplacement_pieces')
    .order('date_intervention', { ascending: false })
    .limit(50);

  // Extraire les pièces des interventions
  (interventions || []).forEach((i: any) => {
    if (i.pieces_detail && Array.isArray(i.pieces_detail)) {
      i.pieces_detail.forEach((p: any) => {
        // Éviter les doublons si déjà dans mouvements
        const exists = pieces.find(
          existing => existing.date === i.date_intervention && 
                      existing.designation === p.designation &&
                      existing.quantite === p.quantite
        );
        if (!exists) {
          pieces.push({
            id: `${i.id}-${p.article_id || p.designation}`,
            date: i.date_intervention,
            code_appareil: i.code_appareil,
            adresse: i.adresse,
            ville: i.ville,
            designation: p.designation,
            reference: p.reference,
            quantite: p.quantite,
            technicien_nom: i.technicien_info,
            motif: i.description,
          });
        }
      });
    }
  });

  // 3. Depuis travaux terminés sur cet ascenseur
  // Chercher les travaux soit par ascenseur_id (ancien) soit par code_appareil (nouveau)
  
  // D'abord chercher par code_appareil direct
  const { data: travauxByCode } = await supabase
    .from('travaux')
    .select(`
      id,
      code,
      titre,
      pieces,
      code_appareil,
      updated_at,
      technicien:technicien_id(prenom, nom)
    `)
    .eq('code_appareil', codeAppareil)
    .eq('statut', 'termine')
    .not('pieces', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  // Ensuite chercher par ascenseur_id (ancienne méthode)
  const { data: ascenseurData } = await supabase
    .from('ascenseurs')
    .select('id')
    .eq('code_appareil', codeAppareil)
    .maybeSingle();

  let travauxByAscenseurId: any[] = [];
  if (ascenseurData?.id) {
    const { data } = await supabase
      .from('travaux')
      .select(`
        id,
        code,
        titre,
        pieces,
        updated_at,
        technicien:technicien_id(prenom, nom)
      `)
      .eq('ascenseur_id', ascenseurData.id)
      .eq('statut', 'termine')
      .not('pieces', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(50);
    travauxByAscenseurId = data || [];
  }

  // Combiner et dédupliquer
  const allTravaux = [...(travauxByCode || []), ...travauxByAscenseurId];
  const uniqueTravaux = allTravaux.filter((t, idx, self) => 
    idx === self.findIndex(x => x.id === t.id)
  );

  uniqueTravaux.forEach((t: any) => {
    if (t.pieces && Array.isArray(t.pieces)) {
      t.pieces.forEach((p: any) => {
        // Ne prendre que les pièces consommées
        if (!p.consommee) return;

        // Vérifier si cette pièce n'est pas déjà présente
        const exists = pieces.find(
          existing => 
            existing.designation === p.designation &&
            existing.quantite === p.quantite &&
            existing.date?.substring(0, 10) === t.updated_at?.substring(0, 10)
        );

        if (!exists) {
          pieces.push({
            id: `travaux-${t.id}-${p.id || p.designation}`,
            date: t.updated_at,
            code_appareil: codeAppareil,
            designation: p.designation,
            reference: p.reference,
            quantite: p.quantite,
            technicien_nom: t.technicien ? `${t.technicien.prenom} ${t.technicien.nom}`.trim() : undefined,
            motif: `Travaux: ${t.titre || t.code}`,
          });
        }
      });
    }
  });

  // Trier par date décroissante
  pieces.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return pieces;
}

// Récupérer toutes les pièces remplacées (tous appareils)
async function getAllPiecesRemplacees(
  dateDebut?: string, 
  dateFin?: string,
  secteur?: number
): Promise<PieceRemplaceeRecord[]> {
  // 1. Récupérer depuis stock_mouvements (avec code_appareil)
  let query = supabase
    .from('stock_mouvements')
    .select(`
      id,
      date_mouvement,
      quantite,
      motif,
      code_appareil,
      technicien:technicien_id(prenom, nom),
      article:article_id(designation, reference)
    `)
    .eq('type_mouvement', 'sortie')
    .not('code_appareil', 'is', null)
    .order('date_mouvement', { ascending: false })
    .limit(500);

  if (dateDebut) {
    query = query.gte('date_mouvement', dateDebut);
  }
  if (dateFin) {
    query = query.lte('date_mouvement', dateFin);
  }

  const { data: mouvements } = await query;

  // 2. Récupérer depuis travaux terminés (avec pièces consommées)
  let travauxQuery = supabase
    .from('travaux')
    .select(`
      id,
      code,
      titre,
      statut,
      pieces,
      code_appareil,
      updated_at,
      ascenseur:ascenseur_id(code_appareil, adresse, ville, secteur),
      technicien:technicien_id(prenom, nom)
    `)
    .eq('statut', 'termine')
    .not('pieces', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (dateDebut) {
    travauxQuery = travauxQuery.gte('updated_at', dateDebut);
  }
  if (dateFin) {
    travauxQuery = travauxQuery.lte('updated_at', dateFin);
  }

  const { data: travaux } = await travauxQuery;

  // Récupérer les infos des ascenseurs pour avoir adresse/ville
  const codesAppareils = [...new Set((mouvements || []).map((m: any) => m.code_appareil).filter(Boolean))];
  
  let ascenseursMap: Record<string, { adresse?: string; ville?: string; secteur?: number }> = {};
  if (codesAppareils.length > 0) {
    const { data: ascenseurs } = await supabase
      .from('parc_ascenseurs')
      .select('code_appareil, adresse, ville, secteur')
      .in('code_appareil', codesAppareils);
    
    (ascenseurs || []).forEach((a: any) => {
      ascenseursMap[a.code_appareil] = { adresse: a.adresse, ville: a.ville, secteur: a.secteur };
    });
  }

  // Transformer les mouvements en pièces
  let pieces: PieceRemplaceeRecord[] = (mouvements || []).map((m: any) => {
    const asc = ascenseursMap[m.code_appareil] || {};
    return {
      id: m.id,
      date: m.date_mouvement,
      code_appareil: m.code_appareil,
      adresse: asc.adresse,
      ville: asc.ville,
      designation: m.article?.designation || 'Article inconnu',
      reference: m.article?.reference,
      quantite: m.quantite,
      technicien_nom: m.technicien ? `${m.technicien.prenom} ${m.technicien.nom}`.trim() : undefined,
      motif: m.motif,
    };
  });

  // 3. Ajouter les pièces des travaux terminés (éviter doublons)
  (travaux || []).forEach((t: any) => {
    if (t.pieces && Array.isArray(t.pieces)) {
      // Utiliser code_appareil direct (nouveau) ou via jointure (ancien)
      const codeAppareil = t.code_appareil || t.ascenseur?.code_appareil;
      if (!codeAppareil) return;

      t.pieces.forEach((p: any) => {
        // Ne prendre que les pièces consommées
        if (!p.consommee) return;

        // Vérifier si cette pièce n'est pas déjà dans les mouvements
        const exists = pieces.find(
          existing => 
            existing.code_appareil === codeAppareil &&
            existing.designation === p.designation &&
            existing.quantite === p.quantite &&
            // Comparer les dates (même jour)
            existing.date?.substring(0, 10) === t.updated_at?.substring(0, 10)
        );

        if (!exists) {
          pieces.push({
            id: `travaux-${t.id}-${p.id || p.designation}`,
            date: t.updated_at,
            code_appareil: codeAppareil,
            adresse: t.ascenseur?.adresse,
            ville: t.ascenseur?.ville,
            designation: p.designation,
            reference: p.reference,
            quantite: p.quantite,
            technicien_nom: t.technicien ? `${t.technicien.prenom} ${t.technicien.nom}`.trim() : undefined,
            motif: `Travaux: ${t.titre || t.code}`,
          });
        }
      });
    }
  });

  // Trier par date décroissante
  pieces.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filtrer par secteur si demandé
  if (secteur !== undefined) {
    // Mettre à jour ascenseursMap avec les ascenseurs des travaux
    (travaux || []).forEach((t: any) => {
      if (t.ascenseur?.code_appareil) {
        ascenseursMap[t.ascenseur.code_appareil] = {
          adresse: t.ascenseur.adresse,
          ville: t.ascenseur.ville,
          secteur: t.ascenseur.secteur,
        };
      }
    });

    const codesInSecteur = Object.entries(ascenseursMap)
      .filter(([_, v]) => v.secteur === secteur)
      .map(([k, _]) => k);
    pieces = pieces.filter(p => codesInSecteur.includes(p.code_appareil));
  }

  return pieces;
}

// Grouper par appareil
function grouperParAppareil(pieces: PieceRemplaceeRecord[]): PiecesParAppareil[] {
  const map: Record<string, PiecesParAppareil> = {};

  pieces.forEach(p => {
    if (!map[p.code_appareil]) {
      map[p.code_appareil] = {
        code_appareil: p.code_appareil,
        adresse: p.adresse,
        ville: p.ville,
        total_pieces: 0,
        derniere_intervention: p.date,
        pieces: [],
      };
    }
    map[p.code_appareil].total_pieces += p.quantite;
    map[p.code_appareil].pieces.push(p);
    if (new Date(p.date) > new Date(map[p.code_appareil].derniere_intervention)) {
      map[p.code_appareil].derniere_intervention = p.date;
    }
  });

  return Object.values(map).sort((a, b) => 
    new Date(b.derniere_intervention).getTime() - new Date(a.derniere_intervention).getTime()
  );
}

// =============================================
// COMPOSANT: Liste pièces pour un ascenseur
// =============================================
interface PiecesAscenseurProps {
  codeAppareil: string;
  compact?: boolean;
}

export function PiecesRemplaceesByAscenseur({ codeAppareil, compact = false }: PiecesAscenseurProps) {
  const { data: pieces, isLoading, refetch } = useQuery({
    queryKey: ['pieces-remplacees-ascenseur', codeAppareil],
    queryFn: () => getPiecesRemplaceesByAscenseur(codeAppareil),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!pieces || pieces.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune pièce remplacée</p>
      </div>
    );
  }

  // Grouper par date
  const piecesParDate: Record<string, PieceRemplaceeRecord[]> = {};
  pieces.forEach(p => {
    const dateKey = format(parseISO(p.date), 'yyyy-MM-dd');
    if (!piecesParDate[dateKey]) {
      piecesParDate[dateKey] = [];
    }
    piecesParDate[dateKey].push(p);
  });

  const totalPieces = pieces.reduce((acc, p) => acc + p.quantite, 0);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {totalPieces} pièce(s) remplacée(s)
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Liste par date */}
      <div className="space-y-2 max-h-[400px] overflow-auto">
        {Object.entries(piecesParDate).slice(0, compact ? 5 : undefined).map(([dateKey, piecesJour]) => (
          <Card key={dateKey} className="bg-[var(--bg-secondary)]">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {format(parseISO(dateKey), 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
                {piecesJour[0].technicien_nom && (
                  <>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {piecesJour[0].technicien_nom}
                    </span>
                  </>
                )}
              </div>
              <div className="space-y-1">
                {piecesJour.map(piece => (
                  <div 
                    key={piece.id}
                    className="flex items-center justify-between py-1 px-2 bg-[var(--bg-primary)] rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {piece.designation}
                      </p>
                      {piece.reference && (
                        <p className="text-[10px] text-[var(--text-muted)]">{piece.reference}</p>
                      )}
                    </div>
                    <Badge variant="purple" className="ml-2">×{piece.quantite}</Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {compact && Object.keys(piecesParDate).length > 5 && (
        <p className="text-xs text-center text-[var(--text-muted)]">
          +{Object.keys(piecesParDate).length - 5} autres interventions
        </p>
      )}
    </div>
  );
}

// =============================================
// COMPOSANT: Vue globale toutes pièces remplacées
// =============================================
interface PiecesRemplaceesParcProps {
  secteurs?: number[];
}

export function PiecesRemplaceesParc({ secteurs }: PiecesRemplaceesParcProps) {
  const [periode, setPeriode] = useState<'7j' | '30j' | 'mois' | 'tout'>('30j');
  const [search, setSearch] = useState('');
  const [expandedAppareil, setExpandedAppareil] = useState<string | null>(null);
  const [secteurFiltre, setSecteurFiltre] = useState<number | undefined>();

  // Calculer les dates selon la période
  const getDateRange = () => {
    const now = new Date();
    switch (periode) {
      case '7j': return { debut: format(subDays(now, 7), 'yyyy-MM-dd'), fin: undefined };
      case '30j': return { debut: format(subDays(now, 30), 'yyyy-MM-dd'), fin: undefined };
      case 'mois': return { debut: format(startOfMonth(now), 'yyyy-MM-dd'), fin: undefined };
      default: return { debut: undefined, fin: undefined };
    }
  };

  const { debut, fin } = getDateRange();

  const { data: pieces, isLoading, refetch } = useQuery({
    queryKey: ['pieces-remplacees-parc', periode, secteurFiltre],
    queryFn: () => getAllPiecesRemplacees(debut, fin, secteurFiltre),
  });

  // Grouper par appareil
  const piecesParAppareil = grouperParAppareil(pieces || []);

  // Filtrer par recherche
  const filteredAppareils = piecesParAppareil.filter(a => 
    a.code_appareil.toLowerCase().includes(search.toLowerCase()) ||
    a.adresse?.toLowerCase().includes(search.toLowerCase()) ||
    a.ville?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats globales
  const totalPieces = (pieces || []).reduce((acc, p) => acc + p.quantite, 0);
  const totalAppareils = piecesParAppareil.length;

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{totalPieces}</p>
            <p className="text-xs text-[var(--text-muted)]">Pièces</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalAppareils}</p>
            <p className="text-xs text-[var(--text-muted)]">Appareils</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {/* Période */}
        <div className="flex rounded-lg overflow-hidden border border-[var(--border-primary)]">
          {[
            { value: '7j', label: '7 jours' },
            { value: '30j', label: '30 jours' },
            { value: 'mois', label: 'Ce mois' },
            { value: 'tout', label: 'Tout' },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setPeriode(p.value as any)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                periode === p.value
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            type="text"
            placeholder="Rechercher appareil, adresse..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Secteur */}
        {secteurs && secteurs.length > 0 && (
          <Select
            value={secteurFiltre?.toString() || ''}
            onChange={e => setSecteurFiltre(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-32"
          >
            <option value="">Tous secteurs</option>
            {secteurs.map(s => (
              <option key={s} value={s}>Secteur {s}</option>
            ))}
          </Select>
        )}
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : filteredAppareils.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucune pièce remplacée sur cette période</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAppareils.map(appareil => (
            <Card key={appareil.code_appareil} className="overflow-hidden">
              <button
                onClick={() => setExpandedAppareil(
                  expandedAppareil === appareil.code_appareil ? null : appareil.code_appareil
                )}
                className="w-full p-3 flex items-center justify-between hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedAppareil === appareil.code_appareil ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                  <div className="text-left">
                    <p className="font-mono font-semibold text-[var(--text-primary)]">
                      {appareil.code_appareil}
                    </p>
                    {(appareil.adresse || appareil.ville) && (
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {appareil.adresse}, {appareil.ville}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge variant="purple">{appareil.total_pieces} pièce(s)</Badge>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {format(parseISO(appareil.derniere_intervention), 'dd/MM/yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              </button>

              {/* Détail des pièces */}
              {expandedAppareil === appareil.code_appareil && (
                <div className="border-t border-[var(--border-primary)] p-3 bg-[var(--bg-secondary)]">
                  <div className="space-y-2">
                    {appareil.pieces.map(piece => (
                      <div 
                        key={piece.id}
                        className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--text-primary)]">{piece.designation}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(piece.date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            {piece.technicien_nom && (
                              <>
                                <span>•</span>
                                <User className="w-3 h-3" />
                                {piece.technicien_nom}
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="gray">×{piece.quantite}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// EXPORTS
// =============================================
export default PiecesRemplaceesParc;
