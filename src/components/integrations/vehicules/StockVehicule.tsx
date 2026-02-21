// components/vehicules/StockVehicule.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Package, AlertTriangle, RefreshCw, Plus,
  Minus, ArrowRight, Search, Filter, CheckCircle,
  Clock, Loader2, Send, MapPin, Fuel, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StockItem {
  stock_id: string;
  piece_id: string;
  reference: string;
  designation: string | null;
  quantite: number;
  quantite_disponible: number;
  seuil_min: number;
  quantite_recommandee: number;
  niveau_stock: 'ok' | 'bas' | 'critique' | 'rupture';
  photo_url: string | null;
}

interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  technicien_nom: string | null;
  technicien_id: string | null;
  kilometrage: number | null;
  date_prochain_ct: string | null;
  date_prochain_entretien: string | null;
  derniere_position: { lat: number; lng: number; timestamp: string } | null;
}

interface AlerteVehicule {
  vehicule_id: string;
  immatriculation: string;
  vehicule_nom: string;
  technicien_nom: string | null;
  nb_ruptures: number;
  nb_critiques: number;
  nb_bas: number;
  refs_urgentes: string[];
}

interface DemandeReappro {
  id: string;
  vehicule_id: string;
  statut: string;
  date_demande: string;
  urgence: string;
  nb_lignes: number;
}

const NIVEAU_COLORS = {
  ok: 'bg-green-100 text-green-700',
  bas: 'bg-yellow-100 text-yellow-700',
  critique: 'bg-orange-100 text-orange-700',
  rupture: 'bg-red-100 text-red-700',
};

const NIVEAU_LABELS = {
  ok: 'OK',
  bas: 'Bas',
  critique: 'Critique',
  rupture: 'Rupture',
};

export function StockVehicule() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [alertes, setAlertes] = useState<AlerteVehicule[]>([]);
  const [selectedVehicule, setSelectedVehicule] = useState<Vehicule | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [search, setSearch] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState<string | null>(null);
  const [showReapproModal, setShowReapproModal] = useState(false);
  const [generatingReappro, setGeneratingReappro] = useState(false);

  // Charger les véhicules et alertes
  useEffect(() => {
    loadVehicules();
    loadAlertes();
  }, []);

  const loadVehicules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicules')
        .select(`
          id, immatriculation, marque, modele,
          technicien_principal_id, kilometrage,
          date_prochain_ct, date_prochain_entretien, derniere_position
        `)
        .eq('actif', true)
        .order('immatriculation');

      if (error) throw error;

      // Récupérer les noms des techniciens
      const vehiculesAvecTechnicien = await Promise.all(
        (data || []).map(async (v) => {
          let technicien_nom = null;
          if (v.technicien_principal_id) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', v.technicien_principal_id)
              .single();
            technicien_nom = userData?.full_name;
          }
          return { ...v, technicien_nom, technicien_id: v.technicien_principal_id };
        })
      );

      setVehicules(vehiculesAvecTechnicien);
    } catch (err) {
      console.error('Erreur chargement véhicules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAlertes = async () => {
    try {
      const { data } = await supabase
        .from('v_alertes_reappro_vehicules')
        .select('*');
      if (data) setAlertes(data);
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
    }
  };

  // Charger le stock d'un véhicule
  const loadStockVehicule = async (vehiculeId: string) => {
    setLoadingStock(true);
    try {
      const { data, error } = await supabase
        .from('v_stock_vehicule')
        .select('*')
        .eq('vehicule_id', vehiculeId)
        .order('niveau_stock', { ascending: true });

      if (error) throw error;
      setStock(data || []);
    } catch (err) {
      console.error('Erreur chargement stock:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  // Sélectionner un véhicule
  const handleSelectVehicule = (vehicule: Vehicule) => {
    setSelectedVehicule(vehicule);
    loadStockVehicule(vehicule.id);
  };

  // Générer demande de réappro
  const handleGenererReappro = async () => {
    if (!selectedVehicule) return;

    setGeneratingReappro(true);
    try {
      const { data, error } = await supabase.rpc('generer_demande_reappro', {
        p_vehicule_id: selectedVehicule.id,
      });

      if (error) throw error;

      alert(`Demande de réapprovisionnement créée !`);
      loadStockVehicule(selectedVehicule.id);
      loadAlertes();
    } catch (err: any) {
      console.error('Erreur génération réappro:', err);
      alert('Erreur: ' + err.message);
    } finally {
      setGeneratingReappro(false);
    }
  };

  // Filtrage stock
  const stockFiltre = stock.filter(item => {
    if (filtreNiveau && item.niveau_stock !== filtreNiveau) return false;
    if (search) {
      const s = search.toLowerCase();
      return item.reference.toLowerCase().includes(s) ||
             item.designation?.toLowerCase().includes(s);
    }
    return true;
  });

  // Stats stock véhicule sélectionné
  const stockStats = {
    total: stock.length,
    ruptures: stock.filter(s => s.niveau_stock === 'rupture').length,
    critiques: stock.filter(s => s.niveau_stock === 'critique').length,
    bas: stock.filter(s => s.niveau_stock === 'bas').length,
  };

  const getAlerte = (vehiculeId: string) => alertes.find(a => a.vehicule_id === vehiculeId);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Liste des véhicules */}
      <div className={`${selectedVehicule ? 'w-1/3 border-r' : 'w-full'} flex flex-col bg-white`}>
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            Stock Véhicules
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {vehicules.length} véhicule{vehicules.length > 1 ? 's' : ''}
            {alertes.length > 0 && (
              <span className="text-red-600 ml-2">
                • {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        {/* Alertes globales */}
        {alertes.length > 0 && !selectedVehicule && (
          <div className="p-4 bg-red-50 border-b">
            <h3 className="font-medium text-red-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Véhicules à réapprovisionner
            </h3>
            <div className="space-y-2">
              {alertes.slice(0, 3).map(alerte => (
                <div
                  key={alerte.vehicule_id}
                  onClick={() => {
                    const v = vehicules.find(v => v.id === alerte.vehicule_id);
                    if (v) handleSelectVehicule(v);
                  }}
                  className="flex items-center justify-between p-2 bg-white rounded-lg cursor-pointer hover:shadow"
                >
                  <div>
                    <p className="font-medium text-sm">{alerte.immatriculation}</p>
                    <p className="text-xs text-gray-500">{alerte.technicien_nom}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerte.nb_ruptures > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        {alerte.nb_ruptures} rupture{alerte.nb_ruptures > 1 ? 's' : ''}
                      </span>
                    )}
                    {alerte.nb_critiques > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                        {alerte.nb_critiques} critique{alerte.nb_critiques > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste véhicules */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="divide-y">
              {vehicules.map(vehicule => {
                const alerte = getAlerte(vehicule.id);
                const isSelected = selectedVehicule?.id === vehicule.id;

                return (
                  <div
                    key={vehicule.id}
                    onClick={() => handleSelectVehicule(vehicule)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          alerte ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <Truck className={`w-5 h-5 ${alerte ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {vehicule.immatriculation}
                          </p>
                          <p className="text-sm text-gray-500">
                            {vehicule.marque} {vehicule.modele}
                          </p>
                          {vehicule.technicien_nom && (
                            <p className="text-xs text-blue-600 mt-1">
                              👤 {vehicule.technicien_nom}
                            </p>
                          )}
                        </div>
                      </div>

                      {alerte && (
                        <div className="flex flex-col items-end gap-1">
                          {alerte.nb_ruptures > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                              {alerte.nb_ruptures} rupture
                            </span>
                          )}
                          {alerte.nb_critiques > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                              {alerte.nb_critiques} critique
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Infos véhicule */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {vehicule.kilometrage && (
                        <span className="flex items-center gap-1">
                          <Fuel className="w-3 h-3" />
                          {vehicule.kilometrage.toLocaleString()} km
                        </span>
                      )}
                      {vehicule.date_prochain_ct && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          CT: {formatDate(vehicule.date_prochain_ct)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Détail stock véhicule */}
      {selectedVehicule && (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header véhicule */}
          <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedVehicule.immatriculation}</h2>
                  <p className="text-blue-100">
                    {selectedVehicule.marque} {selectedVehicule.modele}
                    {selectedVehicule.technicien_nom && ` • ${selectedVehicule.technicien_nom}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicule(null)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{stockStats.total}</p>
                <p className="text-xs text-blue-100">Références</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${stockStats.ruptures > 0 ? 'text-red-300' : ''}`}>
                  {stockStats.ruptures}
                </p>
                <p className="text-xs text-blue-100">Ruptures</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${stockStats.critiques > 0 ? 'text-orange-300' : ''}`}>
                  {stockStats.critiques}
                </p>
                <p className="text-xs text-blue-100">Critiques</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{stockStats.bas}</p>
                <p className="text-xs text-blue-100">Bas</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <select
                value={filtreNiveau || ''}
                onChange={(e) => setFiltreNiveau(e.target.value || null)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Tous niveaux</option>
                <option value="rupture">Rupture</option>
                <option value="critique">Critique</option>
                <option value="bas">Bas</option>
                <option value="ok">OK</option>
              </select>
            </div>

            {(stockStats.ruptures > 0 || stockStats.critiques > 0 || stockStats.bas > 0) && (
              <button
                onClick={handleGenererReappro}
                disabled={generatingReappro}
                className="ml-4 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {generatingReappro ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Demander réappro
              </button>
            )}
          </div>

          {/* Liste stock */}
          <div className="flex-1 overflow-auto p-4">
            {loadingStock ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : stockFiltre.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2" />
                <p>Aucun article en stock</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stockFiltre.map(item => (
                  <div
                    key={item.stock_id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      item.niveau_stock === 'rupture' ? 'bg-red-50 border-red-200' :
                      item.niveau_stock === 'critique' ? 'bg-orange-50 border-orange-200' :
                      item.niveau_stock === 'bas' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Image */}
                    <div className="w-14 h-14 bg-white rounded-lg border flex-shrink-0 overflow-hidden">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.reference} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-medium text-blue-600">{item.reference}</p>
                      <p className="text-sm text-gray-600 truncate">{item.designation || '-'}</p>
                    </div>

                    {/* Quantités */}
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${
                        item.niveau_stock === 'rupture' ? 'text-red-600' :
                        item.niveau_stock === 'critique' ? 'text-orange-600' :
                        item.niveau_stock === 'bas' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {item.quantite}
                      </p>
                      <p className="text-xs text-gray-500">
                        min: {item.seuil_min} / rec: {item.quantite_recommandee}
                      </p>
                    </div>

                    {/* Badge niveau */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${NIVEAU_COLORS[item.niveau_stock]}`}>
                      {NIVEAU_LABELS[item.niveau_stock]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
