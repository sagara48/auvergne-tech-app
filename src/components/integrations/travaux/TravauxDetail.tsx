// components/travaux/TravauxDetail.tsx
import React, { useState, useEffect } from 'react';
import {
  Wrench, Package, Clock, CheckCircle, AlertTriangle,
  Calendar, Users, FileText, Plus, Play, Pause,
  ChevronDown, ChevronRight, Loader2, ShoppingCart,
  ArrowRight, Building2, Euro, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePanier } from '@/hooks/usePanier';
import { DocumentsLies } from '../ged/DocumentsLies';

interface Travaux {
  id: string;
  numero: string;
  titre: string;
  description: string | null;
  type_travaux: string | null;
  statut: string;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  date_debut_reelle: string | null;
  date_fin_reelle: string | null;
  montant_devis_ht: number | null;
  montant_facture_ht: number | null;
  responsable_id: string | null;
  ascenseur_ids: string[];
  notes: string | null;
  // Calculés
  nb_etapes: number;
  nb_etapes_terminees: number;
  pourcentage_global: number;
  nb_pieces: number;
  nb_pieces_installees: number;
  nb_pieces_a_commander: number;
  cout_pieces_prevu: number;
  cout_pieces_reel: number;
  heures_prevues: number;
  heures_reelles: number;
}

interface TravauxEtape {
  id: string;
  numero: number;
  titre: string;
  description: string | null;
  statut: string;
  pourcentage_avancement: number;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  duree_prevue_heures: number | null;
  duree_reelle_heures: number | null;
}

interface TravauxPiece {
  id: string;
  piece_id: string | null;
  reference: string;
  designation: string | null;
  quantite_prevue: number;
  quantite_reservee: number;
  quantite_utilisee: number;
  source: string;
  statut: string;
  prix_unitaire_ht: number | null;
  photo_url?: string;
}

const STATUTS_TRAVAUX = {
  devis: { label: 'Devis', color: 'bg-gray-100 text-gray-600' },
  devis_envoye: { label: 'Devis envoyé', color: 'bg-blue-100 text-blue-600' },
  devis_accepte: { label: 'Devis accepté', color: 'bg-green-100 text-green-600' },
  devis_refuse: { label: 'Devis refusé', color: 'bg-red-100 text-red-600' },
  en_preparation: { label: 'En préparation', color: 'bg-yellow-100 text-yellow-600' },
  en_cours: { label: 'En cours', color: 'bg-blue-100 text-blue-600' },
  en_pause: { label: 'En pause', color: 'bg-orange-100 text-orange-600' },
  termine: { label: 'Terminé', color: 'bg-green-100 text-green-600' },
  facture: { label: 'Facturé', color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  annule: { label: 'Annulé', color: 'bg-red-100 text-red-600' },
};

const STATUTS_PIECE = {
  a_commander: { label: 'À commander', color: 'bg-red-100 text-red-600', icon: ShoppingCart },
  reserve: { label: 'Réservé', color: 'bg-yellow-100 text-yellow-600', icon: Clock },
  commande: { label: 'Commandé', color: 'bg-blue-100 text-blue-600', icon: Package },
  recu: { label: 'Reçu', color: 'bg-green-100 text-green-600', icon: CheckCircle },
  installe: { label: 'Installé', color: 'bg-[#FEE2E2] text-[#B91C1C]', icon: CheckCircle },
};

interface TravauxDetailProps {
  travauxId: string;
  onClose?: () => void;
}

export function TravauxDetail({ travauxId, onClose }: TravauxDetailProps) {
  const [travaux, setTravaux] = useState<Travaux | null>(null);
  const [etapes, setEtapes] = useState<TravauxEtape[]>([]);
  const [pieces, setPieces] = useState<TravauxPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'etapes' | 'pieces' | 'documents' | 'temps'>('etapes');
  const [expandedEtapes, setExpandedEtapes] = useState<Set<string>>(new Set());
  const [reservingPieces, setReservingPieces] = useState(false);

  const { ajouterAuPanier } = usePanier();

  // Charger les données
  useEffect(() => {
    loadTravaux();
  }, [travauxId]);

  const loadTravaux = async () => {
    setLoading(true);
    try {
      // Charger travaux avec stats
      const { data: travauxData, error: travauxError } = await supabase
        .from('v_travaux_avancement')
        .select('*')
        .eq('id', travauxId)
        .single();

      if (travauxError) throw travauxError;

      // Charger infos complémentaires
      const { data: travauxFull } = await supabase
        .from('travaux')
        .select('*')
        .eq('id', travauxId)
        .single();

      setTravaux({ ...travauxData, ...travauxFull });

      // Charger étapes
      const { data: etapesData } = await supabase
        .from('travaux_etapes')
        .select('*')
        .eq('travaux_id', travauxId)
        .order('numero');

      setEtapes(etapesData || []);

      // Charger pièces
      const { data: piecesData } = await supabase
        .from('travaux_pieces')
        .select('*, pieces_catalogue(photo_url)')
        .eq('travaux_id', travauxId)
        .order('statut, reference');

      setPieces((piecesData || []).map(p => ({
        ...p,
        photo_url: p.pieces_catalogue?.photo_url
      })));

    } catch (err) {
      console.error('Erreur chargement travaux:', err);
    } finally {
      setLoading(false);
    }
  };

  // Réserver les pièces depuis le stock
  const handleReserverPieces = async () => {
    setReservingPieces(true);
    try {
      const { data, error } = await supabase.rpc('travaux_reserver_pieces', {
        p_travaux_id: travauxId
      });

      if (error) throw error;

      // Afficher résultat
      const reservees = data?.filter((r: any) => r.statut === 'reserve').length || 0;
      const aCommander = data?.filter((r: any) => r.statut === 'a_commander').length || 0;

      alert(`${reservees} pièce(s) réservée(s)\n${aCommander} pièce(s) à commander`);

      loadTravaux();
    } catch (err: any) {
      console.error('Erreur réservation:', err);
      alert('Erreur: ' + err.message);
    } finally {
      setReservingPieces(false);
    }
  };

  // Commander les pièces manquantes
  const handleCommanderPieces = async () => {
    const piecesACommander = pieces.filter(p => p.statut === 'a_commander');

    for (const piece of piecesACommander) {
      await ajouterAuPanier({
        id: piece.piece_id || undefined,
        reference: piece.reference,
        designation: piece.designation || undefined,
        photo_url: piece.photo_url,
        prix_ht: piece.prix_unitaire_ht || undefined,
      }, piece.quantite_prevue - piece.quantite_reservee, {
        notes: `Pour travaux ${travaux?.numero}`,
      });
    }

    alert(`${piecesACommander.length} pièce(s) ajoutée(s) au panier`);
  };

  // Mettre à jour statut étape
  const updateEtapeStatut = async (etapeId: string, newStatut: string) => {
    try {
      const updates: any = { statut: newStatut };
      if (newStatut === 'en_cours' && !etapes.find(e => e.id === etapeId)?.date_debut_reelle) {
        updates.date_debut_reelle = new Date().toISOString().split('T')[0];
      }
      if (newStatut === 'termine') {
        updates.date_fin_reelle = new Date().toISOString().split('T')[0];
        updates.pourcentage_avancement = 100;
      }

      const { error } = await supabase
        .from('travaux_etapes')
        .update(updates)
        .eq('id', etapeId);

      if (error) throw error;
      loadTravaux();
    } catch (err) {
      console.error('Erreur mise à jour étape:', err);
    }
  };

  // Mettre à jour statut pièce
  const updatePieceStatut = async (pieceId: string, newStatut: string) => {
    try {
      const { error } = await supabase
        .from('travaux_pieces')
        .update({ statut: newStatut })
        .eq('id', pieceId);

      if (error) throw error;
      loadTravaux();
    } catch (err) {
      console.error('Erreur mise à jour pièce:', err);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!travaux) {
    return <div className="p-4 text-center text-gray-500">Travaux non trouvés</div>;
  }

  const statutConfig = STATUTS_TRAVAUX[travaux.statut as keyof typeof STATUTS_TRAVAUX] || STATUTS_TRAVAUX.devis;
  const piecesACommander = pieces.filter(p => p.statut === 'a_commander');

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-[#B91C1C] to-[#DC4444] text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Wrench className="w-6 h-6" />
              <span className="font-mono text-lg">{travaux.numero}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statutConfig.color}`}>
                {statutConfig.label}
              </span>
            </div>
            <h1 className="text-xl font-bold mt-1">{travaux.titre}</h1>
            {travaux.description && (
              <p className="text-indigo-100 text-sm mt-1">{travaux.description}</p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
          )}
        </div>

        {/* Barre de progression */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Avancement global</span>
            <span className="font-bold">{travaux.pourcentage_global || 0}%</span>
          </div>
          <div className="h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${travaux.pourcentage_global || 0}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-indigo-200">Étapes</p>
            <p className="text-lg font-bold">
              {travaux.nb_etapes_terminees}/{travaux.nb_etapes}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-indigo-200">Pièces</p>
            <p className="text-lg font-bold">
              {travaux.nb_pieces_installees}/{travaux.nb_pieces}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-indigo-200">Heures</p>
            <p className="text-lg font-bold">
              {travaux.heures_reelles?.toFixed(1) || 0}h / {travaux.heures_prevues?.toFixed(1) || 0}h
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-indigo-200">Coût pièces</p>
            <p className="text-lg font-bold">
              {travaux.cout_pieces_reel?.toFixed(0) || 0}€
            </p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex border-b">
        {[
          { id: 'etapes', label: 'Étapes', icon: Clock, count: etapes.length },
          { id: 'pieces', label: 'Pièces', icon: Package, count: pieces.length, alert: piecesACommander.length },
          { id: 'documents', label: 'Documents', icon: FileText },
          { id: 'temps', label: 'Temps', icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">
                {tab.count}
              </span>
            )}
            {tab.alert && tab.alert > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                {tab.alert}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto">
        {/* Onglet Étapes */}
        {activeTab === 'etapes' && (
          <div className="p-4 space-y-3">
            {etapes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-2" />
                <p>Aucune étape définie</p>
              </div>
            ) : (
              etapes.map((etape, index) => (
                <div
                  key={etape.id}
                  className={`border rounded-lg overflow-hidden ${
                    etape.statut === 'termine' ? 'bg-green-50 border-green-200' :
                    etape.statut === 'en_cours' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50'
                  }`}
                >
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => {
                      const newExpanded = new Set(expandedEtapes);
                      if (newExpanded.has(etape.id)) {
                        newExpanded.delete(etape.id);
                      } else {
                        newExpanded.add(etape.id);
                      }
                      setExpandedEtapes(newExpanded);
                    }}
                  >
                    {/* Numéro */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      etape.statut === 'termine' ? 'bg-green-500 text-white' :
                      etape.statut === 'en_cours' ? 'bg-blue-500 text-white' :
                      'bg-gray-300 text-gray-600'
                    }`}>
                      {etape.statut === 'termine' ? '✓' : etape.numero}
                    </div>

                    {/* Titre */}
                    <div className="flex-1">
                      <p className="font-medium">{etape.titre}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {etape.duree_prevue_heures && (
                          <span>{etape.duree_prevue_heures}h prévues</span>
                        )}
                        {etape.date_debut_prevue && (
                          <span>• Du {formatDate(etape.date_debut_prevue)}</span>
                        )}
                      </div>
                    </div>

                    {/* Progression */}
                    <div className="w-24">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${etape.statut === 'termine' ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${etape.pourcentage_avancement}%` }}
                        />
                      </div>
                      <p className="text-xs text-center mt-1">{etape.pourcentage_avancement}%</p>
                    </div>

                    {/* Actions rapides */}
                    <div className="flex gap-1">
                      {etape.statut === 'a_faire' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateEtapeStatut(etape.id, 'en_cours'); }}
                          className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                          title="Démarrer"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {etape.statut === 'en_cours' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateEtapeStatut(etape.id, 'en_pause'); }}
                            className="p-2 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateEtapeStatut(etape.id, 'termine'); }}
                            className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            title="Terminer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {etape.statut === 'en_pause' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateEtapeStatut(etape.id, 'en_cours'); }}
                          className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                          title="Reprendre"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedEtapes.has(etape.id) ? 'rotate-90' : ''
                    }`} />
                  </div>

                  {/* Détails étape */}
                  {expandedEtapes.has(etape.id) && (
                    <div className="px-4 pb-4 pt-0 border-t">
                      {etape.description && (
                        <p className="text-sm text-gray-600 mt-3">{etape.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">Durée prévue:</span>{' '}
                          <strong>{etape.duree_prevue_heures || '-'}h</strong>
                        </div>
                        <div>
                          <span className="text-gray-500">Durée réelle:</span>{' '}
                          <strong>{etape.duree_reelle_heures || '-'}h</strong>
                        </div>
                        <div>
                          <span className="text-gray-500">Début:</span>{' '}
                          <strong>{formatDate(etape.date_debut_reelle || etape.date_debut_prevue)}</strong>
                        </div>
                        <div>
                          <span className="text-gray-500">Fin:</span>{' '}
                          <strong>{formatDate(etape.date_fin_reelle || etape.date_fin_prevue)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Onglet Pièces */}
        {activeTab === 'pieces' && (
          <div className="p-4">
            {/* Actions pièces */}
            {piecesACommander.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">
                      {piecesACommander.length} pièce(s) à commander
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReserverPieces}
                      disabled={reservingPieces}
                      className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                    >
                      {reservingPieces ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                      Réserver stock
                    </button>
                    <button
                      onClick={handleCommanderPieces}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Ajouter au panier
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Liste pièces */}
            <div className="space-y-2">
              {pieces.map(piece => {
                const statutPiece = STATUTS_PIECE[piece.statut as keyof typeof STATUTS_PIECE] || STATUTS_PIECE.a_commander;
                const StatutIcon = statutPiece.icon;

                return (
                  <div
                    key={piece.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      piece.statut === 'a_commander' ? 'bg-red-50 border-red-200' :
                      piece.statut === 'installe' ? 'bg-green-50 border-green-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Image */}
                    <div className="w-12 h-12 bg-white rounded border flex-shrink-0 overflow-hidden">
                      {piece.photo_url ? (
                        <img src={piece.photo_url} alt={piece.reference} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-medium text-blue-600">{piece.reference}</p>
                      <p className="text-sm text-gray-600 truncate">{piece.designation}</p>
                    </div>

                    {/* Quantités */}
                    <div className="text-center">
                      <p className="font-bold">
                        {piece.quantite_utilisee}/{piece.quantite_prevue}
                      </p>
                      <p className="text-xs text-gray-500">utilisé/prévu</p>
                    </div>

                    {/* Prix */}
                    {piece.prix_unitaire_ht && (
                      <div className="text-right">
                        <p className="font-medium">{(piece.quantite_prevue * piece.prix_unitaire_ht).toFixed(2)}€</p>
                        <p className="text-xs text-gray-500">{piece.prix_unitaire_ht}€/u</p>
                      </div>
                    )}

                    {/* Statut */}
                    <select
                      value={piece.statut}
                      onChange={(e) => updatePieceStatut(piece.id, e.target.value)}
                      className={`px-2 py-1 rounded text-sm font-medium border-0 ${statutPiece.color}`}
                    >
                      {Object.entries(STATUTS_PIECE).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Onglet Documents */}
        {activeTab === 'documents' && (
          <div className="p-4">
            <DocumentsLies
              entiteType="travaux"
              entiteId={travauxId}
              entiteNom={travaux.titre}
            />
          </div>
        )}

        {/* Onglet Temps */}
        {activeTab === 'temps' && (
          <div className="p-4">
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-2" />
              <p>Suivi du temps de travail</p>
              <p className="text-sm">Connecté aux feuilles d'heures</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
