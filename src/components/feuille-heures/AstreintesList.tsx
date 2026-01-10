import { Moon, Plus, X } from 'lucide-react';
import { Button, Input, Select, IconButton, Badge, Card, CardHeader, CardBody } from '@/components/ui';
import type { Astreinte, TypeAstreinte, AstreinteFormData } from '@/types';
import { TYPES_ASTREINTE_LABELS } from '@/types';

interface AstreintesListProps {
  astreintes: Astreinte[];
  onAdd: () => void;
  onUpdate: (astreinteId: string, data: Partial<AstreinteFormData>) => void;
  onDelete: (astreinteId: string) => void;
  isLoading?: boolean;
}

function getComptage(type: TypeAstreinte): 'rtt' | 'paye' {
  return type === 'samedi_jour' ? 'rtt' : 'paye';
}

export function AstreintesList({
  astreintes,
  onAdd,
  onUpdate,
  onDelete,
  isLoading,
}: AstreintesListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pink-500/20 flex items-center justify-center">
            <Moon className="w-5 h-5 text-pink-400" />
          </div>
          <span className="text-base font-bold text-[var(--text-primary)]">Astreintes</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </CardHeader>

      {/* Règles */}
      <div className="px-5 py-3 bg-pink-500/5 border-b border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
        <span className="text-pink-400 font-semibold">Règles :</span> Samedi jour → RTT • Samedi nuit → Payé • Dimanche → Payé • Nuit semaine → Payé
      </div>

      <CardBody className="p-0">
        {astreintes.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-muted)] text-sm">
            Aucune astreinte cette semaine
          </div>
        ) : (
          <div className="divide-y divide-dark-600">
            {astreintes.map((astreinte) => (
              <div
                key={astreinte.id}
                className="grid grid-cols-[150px_90px_90px_1fr_90px_80px_40px] gap-3 px-5 py-3 items-center hover:bg-[var(--bg-tertiary)]/50 transition-colors"
              >
                <Select
                  value={astreinte.type_astreinte}
                  onChange={(e) => onUpdate(astreinte.id, { type_astreinte: e.target.value as TypeAstreinte })}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {Object.entries(TYPES_ASTREINTE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="time"
                  value={astreinte.heure_depart || ''}
                  onChange={(e) => onUpdate(astreinte.id, { heure_depart: e.target.value })}
                  disabled={isLoading}
                  className="text-xs text-center font-mono"
                />
                <Input
                  value={astreinte.temps_trajet?.slice(0, 5) || ''}
                  onChange={(e) => onUpdate(astreinte.id, { temps_trajet: e.target.value + ':00' })}
                  disabled={isLoading}
                  placeholder="Trajet"
                  className="text-xs text-center font-mono"
                />
                <Input
                  value={astreinte.motif || ''}
                  onChange={(e) => onUpdate(astreinte.id, { motif: e.target.value })}
                  disabled={isLoading}
                  placeholder="Motif de l'intervention..."
                  className="text-xs"
                />
                <Input
                  value={astreinte.temps_site?.slice(0, 5) || ''}
                  onChange={(e) => onUpdate(astreinte.id, { temps_site: e.target.value + ':00' })}
                  disabled={isLoading}
                  placeholder="Site"
                  className="text-xs text-center font-mono"
                />
                <Badge variant={getComptage(astreinte.type_astreinte) === 'rtt' ? 'green' : 'pink'}>
                  {getComptage(astreinte.type_astreinte) === 'rtt' ? 'RTT' : 'Payé'}
                </Badge>
                <IconButton
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(astreinte.id)}
                  disabled={isLoading}
                >
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
