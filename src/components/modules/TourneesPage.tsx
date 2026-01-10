import { useQuery } from '@tanstack/react-query';
import { Route, User, Building2, Calendar, Plus } from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { getTournees } from '@/services/api';

export function TourneesPage() {
  const { data: tournees } = useQuery({ queryKey: ['tournees'], queryFn: getTournees });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{tournees?.length || 0} tournées</h2>
          <p className="text-sm text-[var(--text-tertiary)]">Gestion des tournées d'entretien</p>
        </div>
        <Button variant="primary"><Plus className="w-4 h-4" /> Nouvelle tournée</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tournees?.map(tournee => (
          <Card key={tournee.id} className="hover:border-lime-500/50 transition-colors cursor-pointer">
            <CardBody>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-lime-500/20 flex items-center justify-center">
                  <Route className="w-6 h-6 text-lime-400" />
                </div>
                <Badge variant={tournee.actif ? 'green' : 'gray'}>
                  {tournee.actif ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{tournee.nom}</h3>
              <p className="text-sm text-lime-400 font-semibold mb-3">{tournee.code}</p>

              <div className="space-y-2 text-sm text-[var(--text-tertiary)]">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>{tournee.nb_ascenseurs} ascenseurs</span>
                </div>
                {tournee.technicien && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{tournee.technicien.prenom} {tournee.technicien.nom}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="capitalize">{tournee.frequence}</span>
                </div>
              </div>

              {tournee.secteur && (
                <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                  <Badge variant="blue">{tournee.secteur}</Badge>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
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
