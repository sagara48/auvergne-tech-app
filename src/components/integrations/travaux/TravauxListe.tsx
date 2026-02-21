// components/travaux/TravauxListe.tsx
import React, { useState, useEffect } from 'react';
import {
  Wrench, Plus, Search, Filter, Calendar, Euro,
  Clock, CheckCircle, AlertTriangle, Loader2,
  ChevronRight, TrendingUp, Package, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TravauxDetail } from './TravauxDetail';

interface TravauxResume {
  id: string;
  numero: string;
  titre: string;
  statut: string;
  type_travaux: string | null;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  montant_devis_ht: number | null;
  nb_etapes: number;
  nb_etapes_terminees: number;
  pourcentage_global: number;
  nb_pieces: number;
  nb_pieces_a_commander: number;
  heures_prevues: number;
  heures_reelles: number;
}

interface Stats {
  total: number;
  enCours: number;
  enPreparation: number;
  termines: number;
  montantTotal: number;
  piecesACommander: number;
}

const STATUTS_CONFIG: Record<string, { label: string; color: string }> = {
  devis: { label: 'Devis', color: 'bg-gray-100 text-gray-600' },
  devis_envoye: { label: 'Devis envoyé', color: 'bg-blue-100 text-blue-600' },
  devis_accepte: { label: 'Accepté', color: 'bg-green-100 text-green-600' },
  devis_refuse: { label: 'Refusé', color: 'bg-red-100 text-red-600' },
  en_preparation: { label: 'Préparation', color: 'bg-yellow-100 text-yellow-600' },
  en_cours: { label: 'En cours', color: 'bg-blue-100 text-blue-600' },
  en_pause: { label: 'En pause', color: 'bg-orange-100 text-orange-600' },
  termine: { label: 'Terminé', color: 'bg-green-100 text-green-600' },
  facture: { label: 'Facturé', color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  annule: { label: 'Annulé', color: 'bg-red-100 text-red-600' },
};

export function TravauxListe() {
  const [travaux, setTravaux] = useState<TravauxResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<string | null>(null);
  const [selectedTravauxId, setSelectedTravauxId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    enCours: 0,
    enPreparation: 0,
    termines: 0,
    montantTotal: 0,
    piecesACommander: 0,
  });

  // Charger les travaux
  useEffect(() => {
    loadTravaux();
  }, []);

  const loadTravaux = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_travaux_avancement')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTravaux(data || []);

      // Calculer stats
      const travauxData = data || [];
      setStats({
        total: travauxData.length,
        enCours: travauxData.filter(t => t.statut === 'en_cours').length,
        enPreparation: travauxData.filter(t => t.statut === 'en_preparation').length,
        termines: travauxData.filter(t => t.statut === 'termine' || t.statut === 'facture').length,
        montantTotal: travauxData.reduce((sum, t) => sum + (t.montant_devis_ht || 0), 0),
        piecesACommander: travauxData.reduce((sum, t) => sum + (t.nb_pieces_a_commander || 0), 0),
      });
    } catch (err) {
      console.error('Erreur chargement travaux:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage
  const travauxFiltres = travaux.filter(t => {
    if (filtreStatut && t.statut !== filtreStatut) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.numero.toLowerCase().includes(s) ||
             t.titre.toLowerCase().includes(s);
    }
    return true;
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const formatMontant = (montant: number | null) => {
    if (!montant) return '-';
    return montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  // Si un travaux est sélectionné, afficher le détail
  if (selectedTravauxId) {
    return (
      <TravauxDetail
        travauxId={selectedTravauxId}
        onClose={() => { setSelectedTravauxId(null); loadTravaux(); }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Travaux</h1>
              <p className="text-sm text-gray-500">{stats.total} chantier{stats.total > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Nouveau
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">En cours</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.enCours}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Package className="w-4 h-4" />
              <span className="text-xs">Préparation</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.enPreparation}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Terminés</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{stats.termines}</p>
          </div>
          <div className="bg-[#FEF2F2] rounded-lg p-3">
            <div className="flex items-center gap-2 text-[#B91C1C] mb-1">
              <Euro className="w-4 h-4" />
              <span className="text-xs">CA Total</span>
            </div>
            <p className="text-lg font-bold text-[#991B1B]">{formatMontant(stats.montantTotal)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Pièces à commander</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.piecesACommander}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un chantier..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={filtreStatut || ''}
            onChange={(e) => setFiltreStatut(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : travauxFiltres.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wrench className="w-12 h-12 mx-auto mb-2" />
            <p>Aucun travaux</p>
          </div>
        ) : (
          <div className="space-y-3">
            {travauxFiltres.map(t => {
              const statutConfig = STATUTS_CONFIG[t.statut] || STATUTS_CONFIG.devis;
              const hasAlert = t.nb_pieces_a_commander > 0;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTravauxId(t.id)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    hasAlert ? 'border-l-4 border-l-red-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Progression circulaire */}
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke="#e5e7eb"
                          strokeWidth="4"
                          fill="none"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke={t.pourcentage_global === 100 ? '#22c55e' : '#6366f1'}
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${(t.pourcentage_global / 100) * 150.8} 150.8`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{t.pourcentage_global}%</span>
                      </div>
                    </div>

                    {/* Infos principales */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-gray-500">{t.numero}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statutConfig.color}`}>
                          {statutConfig.label}
                        </span>
                        {hasAlert && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t.nb_pieces_a_commander} pièce(s)
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{t.titre}</h3>
                      
                      {/* Métriques */}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(t.date_debut_prevue)} → {formatDate(t.date_fin_prevue)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {t.nb_etapes_terminees}/{t.nb_etapes} étapes
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {t.heures_reelles?.toFixed(0) || 0}h / {t.heures_prevues?.toFixed(0) || 0}h
                        </span>
                      </div>
                    </div>

                    {/* Montant */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatMontant(t.montant_devis_ht)}
                      </p>
                      <p className="text-xs text-gray-500">Devis HT</p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
