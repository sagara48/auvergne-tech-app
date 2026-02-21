// components/vehicules/DemandesReappro.tsx
import React, { useState, useEffect } from 'react';
import {
  Package, Truck, Clock, CheckCircle, Send, X,
  Loader2, ChevronDown, ChevronRight, AlertTriangle,
  Check, XCircle, ArrowRight, User, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DemandeReappro {
  id: string;
  vehicule_id: string;
  vehicule_immatriculation?: string;
  vehicule_nom?: string;
  technicien_nom?: string;
  emplacement_source_nom?: string;
  statut: string;
  urgence: string;
  date_demande: string;
  date_validation: string | null;
  date_preparation: string | null;
  date_livraison: string | null;
  notes: string | null;
  lignes: LigneReappro[];
}

interface LigneReappro {
  id: string;
  reference: string;
  designation: string | null;
  quantite_demandee: number;
  quantite_validee: number | null;
  quantite_livree: number;
  motif: string | null;
}

const STATUTS = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  validee: { label: 'Validée', color: 'bg-blue-100 text-blue-700', icon: Check },
  preparee: { label: 'Préparée', color: 'bg-[#FEE2E2] text-[#991B1B]', icon: Package },
  livree: { label: 'Livrée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const URGENCES = {
  normale: { label: 'Normale', color: 'text-gray-600' },
  urgent: { label: 'Urgent', color: 'text-orange-600' },
  tres_urgent: { label: 'Très urgent', color: 'text-red-600' },
};

export function DemandesReappro() {
  const [demandes, setDemandes] = useState<DemandeReappro[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDemande, setExpandedDemande] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadDemandes();
  }, []);

  const loadDemandes = async () => {
    setLoading(true);
    try {
      // Charger les demandes avec les véhicules
      const { data: demandesData, error } = await supabase
        .from('stocks_demandes_reappro')
        .select(`
          *,
          vehicules:vehicule_id (immatriculation, marque, modele),
          emplacement_source:emplacement_source_id (nom)
        `)
        .order('date_demande', { ascending: false });

      if (error) throw error;

      // Pour chaque demande, charger les lignes
      const demandesAvecLignes = await Promise.all(
        (demandesData || []).map(async (d) => {
          const { data: lignes } = await supabase
            .from('stocks_demandes_reappro_lignes')
            .select('*')
            .eq('demande_id', d.id);

          return {
            ...d,
            vehicule_immatriculation: d.vehicules?.immatriculation,
            vehicule_nom: `${d.vehicules?.marque} ${d.vehicules?.modele}`,
            emplacement_source_nom: d.emplacement_source?.nom,
            lignes: lignes || [],
          };
        })
      );

      setDemandes(demandesAvecLignes);
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Changer le statut d'une demande
  const updateStatut = async (demandeId: string, newStatut: string) => {
    setProcessing(demandeId);
    try {
      const updates: any = { statut: newStatut };
      
      // Ajouter les dates selon le statut
      if (newStatut === 'validee') {
        updates.date_validation = new Date().toISOString();
        // Valider toutes les quantités demandées
        await supabase
          .from('stocks_demandes_reappro_lignes')
          .update({ quantite_validee: supabase.raw('quantite_demandee') })
          .eq('demande_id', demandeId);
      } else if (newStatut === 'preparee') {
        updates.date_preparation = new Date().toISOString();
      } else if (newStatut === 'livree') {
        updates.date_livraison = new Date().toISOString();
        
        // Créer les mouvements de stock
        const demande = demandes.find(d => d.id === demandeId);
        if (demande) {
          // Récupérer l'emplacement du véhicule
          const { data: emplVehicule } = await supabase
            .from('stocks_emplacements')
            .select('id')
            .eq('vehicule_id', demande.vehicule_id)
            .single();

          if (emplVehicule) {
            for (const ligne of demande.lignes) {
              // Sortie du dépôt source
              // Entrée dans le véhicule
              // (Simplification: à adapter selon votre fonction create_stock_movement)
            }
          }
        }
      }

      const { error } = await supabase
        .from('stocks_demandes_reappro')
        .update(updates)
        .eq('id', demandeId);

      if (error) throw error;
      loadDemandes();
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    } finally {
      setProcessing(null);
    }
  };

  // Filtrage
  const demandesFiltrees = demandes.filter(d => {
    if (filtreStatut && d.statut !== filtreStatut) return false;
    return true;
  });

  // Stats
  const stats = {
    enAttente: demandes.filter(d => d.statut === 'en_attente').length,
    validees: demandes.filter(d => d.statut === 'validee').length,
    preparees: demandes.filter(d => d.statut === 'preparee').length,
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Demandes de réappro</h1>
              <p className="text-sm text-gray-500">{demandes.length} demande{demandes.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-yellow-600">En attente</p>
              <p className="text-xl font-bold text-yellow-700">{stats.enAttente}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
            <Check className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600">Validées</p>
              <p className="text-xl font-bold text-blue-700">{stats.validees}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#FEF2F2] rounded-lg">
            <Package className="w-5 h-5 text-[#B91C1C]" />
            <div>
              <p className="text-sm text-[#B91C1C]">À livrer</p>
              <p className="text-xl font-bold text-[#991B1B]">{stats.preparees}</p>
            </div>
          </div>
        </div>

        {/* Filtre */}
        <select
          value={filtreStatut || ''}
          onChange={(e) => setFiltreStatut(e.target.value || null)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          </div>
        ) : demandesFiltrees.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Send className="w-12 h-12 mx-auto mb-2" />
            <p>Aucune demande</p>
          </div>
        ) : (
          <div className="space-y-3">
            {demandesFiltrees.map(demande => {
              const statutConfig = STATUTS[demande.statut as keyof typeof STATUTS] || STATUTS.en_attente;
              const StatutIcon = statutConfig.icon;
              const isExpanded = expandedDemande === demande.id;
              const urgenceConfig = URGENCES[demande.urgence as keyof typeof URGENCES] || URGENCES.normale;

              return (
                <div
                  key={demande.id}
                  className="bg-white rounded-lg border overflow-hidden"
                >
                  {/* Header demande */}
                  <div
                    onClick={() => setExpandedDemande(isExpanded ? null : demande.id)}
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statutConfig.color}`}>
                      <StatutIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{demande.vehicule_immatriculation}</span>
                        <span className="text-sm text-gray-500">{demande.vehicule_nom}</span>
                        {demande.urgence !== 'normale' && (
                          <span className={`text-xs font-medium ${urgenceConfig.color}`}>
                            • {urgenceConfig.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(demande.date_demande)}
                        </span>
                        <span>{demande.lignes.length} article{demande.lignes.length > 1 ? 's' : ''}</span>
                        {demande.emplacement_source_nom && (
                          <span>Depuis: {demande.emplacement_source_nom}</span>
                        )}
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutConfig.color}`}>
                      {statutConfig.label}
                    </span>

                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Détail demande */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-gray-50">
                      {/* Lignes */}
                      <div className="space-y-2 mb-4">
                        {demande.lignes.map(ligne => (
                          <div
                            key={ligne.id}
                            className="flex items-center gap-4 p-3 bg-white rounded-lg border"
                          >
                            <Package className="w-5 h-5 text-gray-400" />
                            <div className="flex-1">
                              <p className="font-mono font-medium">{ligne.reference}</p>
                              <p className="text-sm text-gray-500">{ligne.designation}</p>
                              {ligne.motif && (
                                <p className="text-xs text-orange-600 mt-1">{ligne.motif}</p>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="font-bold">{ligne.quantite_demandee}</p>
                              <p className="text-xs text-gray-500">demandé</p>
                            </div>
                            {ligne.quantite_validee !== null && (
                              <div className="text-center">
                                <p className="font-bold text-blue-600">{ligne.quantite_validee}</p>
                                <p className="text-xs text-gray-500">validé</p>
                              </div>
                            )}
                            {ligne.quantite_livree > 0 && (
                              <div className="text-center">
                                <p className="font-bold text-green-600">{ligne.quantite_livree}</p>
                                <p className="text-xs text-gray-500">livré</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Timeline */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                        <span>Demande: {formatDate(demande.date_demande)}</span>
                        {demande.date_validation && (
                          <>
                            <ArrowRight className="w-3 h-3" />
                            <span>Validée: {formatDate(demande.date_validation)}</span>
                          </>
                        )}
                        {demande.date_preparation && (
                          <>
                            <ArrowRight className="w-3 h-3" />
                            <span>Préparée: {formatDate(demande.date_preparation)}</span>
                          </>
                        )}
                        {demande.date_livraison && (
                          <>
                            <ArrowRight className="w-3 h-3" />
                            <span>Livrée: {formatDate(demande.date_livraison)}</span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {demande.statut === 'en_attente' && (
                          <>
                            <button
                              onClick={() => updateStatut(demande.id, 'validee')}
                              disabled={processing === demande.id}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {processing === demande.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Valider
                            </button>
                            <button
                              onClick={() => updateStatut(demande.id, 'annulee')}
                              disabled={processing === demande.id}
                              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Annuler
                            </button>
                          </>
                        )}
                        {demande.statut === 'validee' && (
                          <button
                            onClick={() => updateStatut(demande.id, 'preparee')}
                            disabled={processing === demande.id}
                            className="flex items-center gap-2 px-4 py-2 bg-[#B91C1C] text-white rounded-lg hover:bg-[#991B1B] disabled:opacity-50"
                          >
                            {processing === demande.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                            Marquer préparée
                          </button>
                        )}
                        {demande.statut === 'preparee' && (
                          <button
                            onClick={() => updateStatut(demande.id, 'livree')}
                            disabled={processing === demande.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {processing === demande.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Marquer livrée
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
