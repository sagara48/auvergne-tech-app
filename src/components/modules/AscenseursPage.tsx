import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, Filter, MapPin, AlertTriangle, CheckCircle, Wrench, Plus } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getAscenseurs } from '@/services/api';
import type { StatutAscenseur } from '@/types';

const STATUT_CONFIG: Record<StatutAscenseur, { label: string; color: 'green' | 'red' | 'gray' | 'amber'; icon: any }> = {
  en_service: { label: 'En service', color: 'green', icon: CheckCircle },
  en_panne: { label: 'En panne', color: 'red', icon: AlertTriangle },
  arrete: { label: 'Arrêté', color: 'gray', icon: AlertTriangle },
  en_travaux: { label: 'En travaux', color: 'amber', icon: Wrench },
};

export function AscenseursPage() {
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterSecteur, setFilterSecteur] = useState<string>('all');

  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });

  const secteurs = [...new Set(ascenseurs?.map(a => a.secteur).filter(Boolean))] as string[];

  const filtered = ascenseurs?.filter(a => {
    const matchSearch = a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.adresse.toLowerCase().includes(search.toLowerCase()) ||
      a.ville?.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' || a.statut === filterStatut;
    const matchSecteur = filterSecteur === 'all' || a.secteur === filterSecteur;
    return matchSearch && matchStatut && matchSecteur;
  }) || [];

  const stats = {
    total: ascenseurs?.length || 0,
    en_service: ascenseurs?.filter(a => a.statut === 'en_service').length || 0,
    en_panne: ascenseurs?.filter(a => a.statut === 'en_panne').length || 0,
    en_travaux: ascenseurs?.filter(a => a.statut === 'en_travaux').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Total ascenseurs</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-green-400">{stats.en_service}</div>
              <div className="text-xs text-[var(--text-tertiary)]">En service</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-red-400">{stats.en_panne}</div>
              <div className="text-xs text-[var(--text-tertiary)]">En panne</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">{stats.en_travaux}</div>
              <div className="text-xs text-[var(--text-tertiary)]">En travaux</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
          </div>
          <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-40">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={filterSecteur} onChange={e => setFilterSecteur(e.target.value)} className="w-40">
            <option value="all">Tous les secteurs</option>
            {secteurs.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <Button variant="primary"><Plus className="w-4 h-4" /> Nouvel ascenseur</Button>
      </div>

      {/* Liste */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map(asc => {
          const config = STATUT_CONFIG[asc.statut];
          const Icon = config.icon;
          return (
            <Card key={asc.id} className="hover:border-cyan-500/50 transition-colors cursor-pointer">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-cyan-400">{asc.code}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{asc.marque} {asc.modele}</div>
                  </div>
                  <Badge variant={config.color}>
                    <Icon className="w-3 h-3 mr-1" /> {config.label}
                  </Badge>
                </div>

                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)] mb-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-[var(--text-muted)]" />
                  <div>
                    <div>{asc.adresse}</div>
                    <div className="text-[var(--text-muted)]">{asc.ville}</div>
                  </div>
                </div>

                {asc.client && (
                  <div className="text-xs text-[var(--text-tertiary)] mb-3">
                    Client : {asc.client.raison_sociale}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
                  <Badge variant="purple">{asc.type_contrat}</Badge>
                  {asc.secteur && <Badge variant="blue">{asc.secteur}</Badge>}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card><CardBody className="text-center py-12 text-[var(--text-muted)]">Aucun ascenseur trouvé</CardBody></Card>
      )}
    </div>
  );
}
