import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, User, AlertTriangle, CheckCircle, Plus, Gauge, Package, ArrowLeftRight, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getVehicules, getStockVehicule, createTransfert, getStockArticles } from '@/services/api';
import { differenceInDays } from 'date-fns';
import type { StatutVehicule } from '@/types';
import toast from 'react-hot-toast';

const STATUT_CONFIG: Record<StatutVehicule, { label: string; color: 'green' | 'blue' | 'amber' | 'red' }> = {
  disponible: { label: 'Disponible', color: 'blue' },
  en_service: { label: 'En service', color: 'green' },
  maintenance: { label: 'Maintenance', color: 'amber' },
  hors_service: { label: 'Hors service', color: 'red' },
};

function VehiculeStock({ vehiculeId, technicienId }: { vehiculeId: string; technicienId?: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const queryClient = useQueryClient();

  const { data: stock } = useQuery({ queryKey: ['stock-vehicule', vehiculeId], queryFn: () => getStockVehicule(vehiculeId) });
  const { data: articlesDepot } = useQuery({ queryKey: ['stock-articles'], queryFn: getStockArticles });

  const mutation = useMutation({
    mutationFn: (data: any) => createTransfert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
      queryClient.invalidateQueries({ queryKey: ['transferts'] });
      toast.success('Demande de transfert créée');
      setShowModal(false);
    },
  });

  const handleSubmit = () => {
    if (!selectedArticle || !technicienId) return;
    mutation.mutate({
      article_id: selectedArticle,
      quantite: qty,
      source_type: direction === 'in' ? 'depot' : 'vehicule',
      source_vehicule_id: direction === 'out' ? vehiculeId : undefined,
      destination_type: direction === 'in' ? 'vehicule' : 'depot',
      destination_vehicule_id: direction === 'in' ? vehiculeId : undefined,
      motif: 'Demande technicien',
      demande_par: technicienId,
    });
  };

  const alertes = stock?.filter(s => s.quantite <= s.quantite_min) || [];

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <Package className="w-4 h-4" /> Stock ({stock?.length || 0})
          {alertes.length > 0 && <Badge variant="red">{alertes.length} alertes</Badge>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
          <ArrowLeftRight className="w-3 h-3" /> Transfert
        </Button>
      </div>

      {stock && stock.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {stock.map(item => (
            <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${item.quantite <= item.quantite_min ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--bg-tertiary)]'}`}>
              <div>
                <div className="font-medium text-[var(--text-primary)]">{item.article?.designation}</div>
                <div className="text-[var(--text-muted)]">{item.article?.reference}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${item.quantite <= item.quantite_min ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{item.quantite}</div>
                <div className="text-[var(--text-muted)]">min: {item.quantite_min}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-[var(--text-muted)] text-sm">Aucun article</div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[420px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Transfert stock</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-[var(--text-tertiary)]" /></button>
              </div>
              <div className="space-y-4">
                <Select value={direction} onChange={e => setDirection(e.target.value as any)}>
                  <option value="in">Dépôt → Véhicule</option>
                  <option value="out">Véhicule → Dépôt</option>
                </Select>
                <Select value={selectedArticle} onChange={e => setSelectedArticle(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {(direction === 'in' ? articlesDepot : stock?.map(s => s.article))?.map(a => (
                    <option key={a?.id} value={a?.id}>{a?.reference} - {a?.designation}</option>
                  ))}
                </Select>
                <Input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annuler</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={!selectedArticle}>Demander</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export function VehiculesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: getVehicules });

  const getCtStatus = (d?: string) => {
    if (!d) return { label: 'Non renseigné', color: 'gray' };
    const days = differenceInDays(new Date(d), new Date());
    if (days < 0) return { label: 'CT expiré', color: 'red' };
    if (days < 30) return { label: `CT ${days}j`, color: 'amber' };
    return { label: 'CT OK', color: 'green' };
  };

  const stats = {
    total: vehicules?.length || 0,
    en_service: vehicules?.filter(v => v.statut === 'en_service').length || 0,
    disponible: vehicules?.filter(v => v.statut === 'disponible').length || 0,
    ct_proche: vehicules?.filter(v => v.date_ct && differenceInDays(new Date(v.date_ct), new Date()) < 30).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Véhicules', value: stats.total, icon: Car, color: 'green' },
          { label: 'En service', value: stats.en_service, icon: CheckCircle, color: 'green' },
          { label: 'Disponibles', value: stats.disponible, icon: Car, color: 'blue' },
          { label: 'CT à faire', value: stats.ct_proche, icon: AlertTriangle, color: 'amber' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-${s.color}-500/20 flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 text-${s.color}-400`} />
              </div>
              <div>
                <div className={`text-2xl font-extrabold ${s.value > 0 && i > 0 ? `text-${s.color}-400` : 'text-[var(--text-primary)]'}`}>{s.value}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{s.label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="primary"><Plus className="w-4 h-4" /> Nouveau véhicule</Button>
      </div>

      <div className="space-y-4">
        {vehicules?.map(v => {
          const ct = getCtStatus(v.date_ct);
          const cfg = STATUT_CONFIG[v.statut];
          const isExp = expanded === v.id;
          return (
            <Card key={v.id}>
              <CardBody>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(isExp ? null : v.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Car className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{v.immatriculation}</div>
                      <div className="text-sm text-[var(--text-tertiary)]">{v.marque} {v.modele}</div>
                      {v.technicien && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                          <User className="w-3 h-3" /> {v.technicien.prenom} {v.technicien.nom}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={cfg.color}>{cfg.label}</Badge>
                      <div className="text-xs text-[var(--text-muted)] mt-1"><Gauge className="w-3 h-3 inline mr-1" />{v.kilometrage?.toLocaleString()} km</div>
                    </div>
                    <Badge variant={ct.color as any}>{ct.label}</Badge>
                    {isExp ? <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />}
                  </div>
                </div>
                {isExp && <VehiculeStock vehiculeId={v.id} technicienId={v.technicien_id} />}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {(!vehicules || vehicules.length === 0) && (
        <Card><CardBody className="text-center py-12 text-[var(--text-muted)]">Aucun véhicule</CardBody></Card>
      )}
    </div>
  );
}
