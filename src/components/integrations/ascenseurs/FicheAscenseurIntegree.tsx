// components/ascenseurs/FicheAscenseurIntegree.tsx
// Exemple d'intégration des nouveaux composants dans une fiche ascenseur existante

import React, { useState, useEffect } from 'react';
import {
  Building2, FileText, StickyNote, History, Wrench,
  Package, AlertTriangle, MapPin, Calendar, Phone,
  ChevronRight, Settings, Shield, Clock, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DocumentsLies } from '../ged/DocumentsLies';
import { NotesContextuelles } from '../notes/NotesContextuelles';

interface Ascenseur {
  id: string;
  numero_immeuble: string;
  adresse: string;
  code_postal: string;
  ville: string;
  marque: string;
  modele: string | null;
  type_equipement: string | null;
  annee_installation: number | null;
  numero_fabrication: string | null;
  etages_desservis: number | null;
  charge_nominale: number | null;
  vitesse: number | null;
  contrat_type: string | null;
  client_nom: string | null;
  secteur: string | null;
}

interface Stats {
  interventions_annee: number;
  pannes_annee: number;
  dernier_controle: string | null;
  prochain_controle: string | null;
  documents_manquants: number;
  notes_urgentes: number;
}

interface FicheAscenseurIntegreeProps {
  ascenseurId: string;
}

export function FicheAscenseurIntegree({ ascenseurId }: FicheAscenseurIntegreeProps) {
  const [ascenseur, setAscenseur] = useState<Ascenseur | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'documents' | 'notes' | 'historique'>('info');

  useEffect(() => {
    loadAscenseur();
  }, [ascenseurId]);

  const loadAscenseur = async () => {
    setLoading(true);
    try {
      // Charger les infos de l'ascenseur
      const { data: ascenseurData, error } = await supabase
        .from('ascenseurs')
        .select('*')
        .eq('id', ascenseurId)
        .single();

      if (error) throw error;
      setAscenseur(ascenseurData);

      // Charger les stats (exemple - adapter selon vos tables)
      // ...

    } catch (err) {
      console.error('Erreur chargement ascenseur:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !ascenseur) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: 'Informations', icon: Building2 },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'historique', label: 'Historique', icon: History },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header avec infos principales */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{ascenseur.numero_immeuble}</h1>
                <p className="text-blue-100">{ascenseur.marque} {ascenseur.modele}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <MapPin className="w-4 h-4" />
              <span>{ascenseur.adresse}, {ascenseur.code_postal} {ascenseur.ville}</span>
            </div>
          </div>

          {/* Badges statut */}
          <div className="flex flex-col items-end gap-2">
            {ascenseur.contrat_type && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                {ascenseur.contrat_type}
              </span>
            )}
            {ascenseur.secteur && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                Secteur {ascenseur.secteur}
              </span>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
              <Wrench className="w-4 h-4" />
              Interventions
            </div>
            <p className="text-2xl font-bold">12</p>
            <p className="text-xs text-blue-200">cette année</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Pannes
            </div>
            <p className="text-2xl font-bold">3</p>
            <p className="text-xs text-blue-200">cette année</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
              <Shield className="w-4 h-4" />
              Contrôle
            </div>
            <p className="text-lg font-bold">15/03/26</p>
            <p className="text-xs text-blue-200">prochain</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Score santé
            </div>
            <p className="text-2xl font-bold">78%</p>
            <p className="text-xs text-blue-200">bon état</p>
          </div>
        </div>
      </div>

      {/* Navigation onglets */}
      <div className="bg-white border-b flex">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <div className="p-6 grid grid-cols-2 gap-6">
            {/* Caractéristiques techniques */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Caractéristiques techniques
              </h3>
              <div className="space-y-3">
                <InfoRow label="Marque" value={ascenseur.marque} />
                <InfoRow label="Modèle" value={ascenseur.modele || '-'} />
                <InfoRow label="Type" value={ascenseur.type_equipement || '-'} />
                <InfoRow label="N° fabrication" value={ascenseur.numero_fabrication || '-'} />
                <InfoRow label="Année installation" value={ascenseur.annee_installation?.toString() || '-'} />
                <InfoRow label="Étages desservis" value={ascenseur.etages_desservis?.toString() || '-'} />
                <InfoRow label="Charge nominale" value={ascenseur.charge_nominale ? `${ascenseur.charge_nominale} kg` : '-'} />
                <InfoRow label="Vitesse" value={ascenseur.vitesse ? `${ascenseur.vitesse} m/s` : '-'} />
              </div>
            </div>

            {/* Contrat et client */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Contrat
              </h3>
              <div className="space-y-3">
                <InfoRow label="Client" value={ascenseur.client_nom || '-'} />
                <InfoRow label="Type contrat" value={ascenseur.contrat_type || '-'} />
                <InfoRow label="Secteur" value={ascenseur.secteur || '-'} />
              </div>
            </div>

            {/* Notes épinglées (version compacte) */}
            <div className="col-span-2">
              <NotesContextuelles
                contexteType="ascenseur"
                contexteId={ascenseurId}
                compact
              />
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="p-6">
            <DocumentsLies
              entiteType="ascenseur"
              entiteId={ascenseurId}
              entiteNom={ascenseur.numero_immeuble}
            />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-6">
            <NotesContextuelles
              contexteType="ascenseur"
              contexteId={ascenseurId}
              contexteNom={ascenseur.numero_immeuble}
            />
          </div>
        )}

        {activeTab === 'historique' && (
          <div className="p-6">
            <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2" />
              <p>Historique des interventions</p>
              <p className="text-sm">Connecté au module Interventions</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Composant ligne d'info
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
