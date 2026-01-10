import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, X, FileText, StickyNote, Hammer, Package, Plus,
  Download, ExternalLink, ChevronRight, AlertTriangle, HelpCircle,
  Truck, Check, Eye
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import {
  getDocuments, getTravaux, getDemandes, createNote, createDemande,
  createNFCScan, getStockVehiculeByTechnicien, createStockMouvement
} from '@/services/api';
import type { NFCTag, Ascenseur, Travaux, Demande, Note, GEDDocument, StockVehicule } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCAscenseurModalProps {
  tag: NFCTag;
  ascenseur: Ascenseur;
  onClose: () => void;
}

type TabType = 'docs' | 'notes' | 'travaux' | 'stock' | 'demande';

export function NFCAscenseurModal({ tag, ascenseur, onClose }: NFCAscenseurModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('docs');

  // Enregistrer le scan
  useMutation({
    mutationFn: () => createNFCScan({
      tag_id: tag.id,
      technicien_id: CURRENT_USER_ID,
      action: 'consultation',
      ascenseur_id: ascenseur.id,
      device_info: 'web_nfc',
    }),
  }).mutate;

  const client = (ascenseur as any).client;

  const tabs = [
    { id: 'docs', label: 'Documents', icon: FileText, count: 0 },
    { id: 'notes', label: 'Notes', icon: StickyNote, count: 0 },
    { id: 'travaux', label: 'Travaux', icon: Hammer, count: 0 },
    { id: 'stock', label: 'Stock', icon: Package, count: 0 },
    { id: 'demande', label: 'Demande', icon: HelpCircle, count: 0 },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-cyan-400">{ascenseur.code}</h2>
                  <Badge variant={ascenseur.statut === 'en_service' ? 'green' : 'red'}>
                    {ascenseur.statut === 'en_service' ? 'En service' : 'Arrêt'}
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{client?.nom || 'Client'}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{ascenseur.adresse}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Infos rapides */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {ascenseur.marque} {ascenseur.modele}
            </span>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {ascenseur.type_ascenseur}
            </span>
            <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {ascenseur.nombre_niveaux} niveaux
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'docs' && <DocsTab ascenseurId={ascenseur.id} />}
          {activeTab === 'notes' && <NotesTab ascenseurId={ascenseur.id} ascenseurCode={ascenseur.code} />}
          {activeTab === 'travaux' && <TravauxTab ascenseurId={ascenseur.id} />}
          {activeTab === 'stock' && <StockTab ascenseurId={ascenseur.id} ascenseurCode={ascenseur.code} />}
          {activeTab === 'demande' && <DemandeTab ascenseurId={ascenseur.id} ascenseurCode={ascenseur.code} />}
        </div>
      </Card>
    </div>
  );
}

// Onglet Documents
function DocsTab({ ascenseurId }: { ascenseurId: string }) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', ascenseurId],
    queryFn: () => getDocuments({ ascenseurId }),
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  if (isLoading) return <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Documentation technique</h3>
        <Button variant="secondary" size="sm"><Plus className="w-4 h-4" /> Ajouter</Button>
      </div>

      {documents && documents.length > 0 ? (
        documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(doc.type_mime)}</span>
              <div>
                <div className="font-medium text-[var(--text-primary)]">{doc.nom}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {doc.categorie} • {format(parseISO(doc.created_at), 'd MMM yyyy', { locale: fr })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg">
                <Eye className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
              <button className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg">
                <Download className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          Aucun document pour cet ascenseur
        </div>
      )}
    </div>
  );
}

// Onglet Notes
function NotesTab({ ascenseurId, ascenseurCode }: { ascenseurId: string; ascenseurCode: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newNote, setNewNote] = useState({ titre: '', contenu: '' });

  // Pour l'instant on simule, il faudrait filtrer les notes par ascenseur
  const notes: Note[] = [];

  const createMutation = useMutation({
    mutationFn: () => createNote({
      titre: newNote.titre || `Note ${ascenseurCode}`,
      contenu: newNote.contenu,
      technicien_id: CURRENT_USER_ID,
      type: 'perso',
      tags: [ascenseurCode],
    }),
    onSuccess: () => {
      toast.success('Note créée');
      setShowAdd(false);
      setNewNote({ titre: '', contenu: '' });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Notes sur l'appareil</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Nouvelle note
        </Button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3">
          <Input
            placeholder="Titre (optionnel)"
            value={newNote.titre}
            onChange={e => setNewNote({ ...newNote, titre: e.target.value })}
          />
          <textarea
            placeholder="Contenu de la note..."
            value={newNote.contenu}
            onChange={e => setNewNote({ ...newNote, contenu: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={() => createMutation.mutate()} disabled={!newNote.contenu}>
              <Check className="w-4 h-4" /> Créer
            </Button>
          </div>
        </div>
      )}

      {notes.length > 0 ? (
        notes.map(note => (
          <div key={note.id} className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="font-medium text-[var(--text-primary)]">{note.titre}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-1">{note.contenu}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-2">
              {format(parseISO(note.created_at), 'd MMM yyyy HH:mm', { locale: fr })}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          Aucune note pour cet ascenseur
        </div>
      )}
    </div>
  );
}

// Onglet Travaux
function TravauxTab({ ascenseurId }: { ascenseurId: string }) {
  const { data: allTravaux, isLoading } = useQuery({
    queryKey: ['travaux'],
    queryFn: () => getTravaux(),
  });

  // Filtrer les travaux liés à cet ascenseur (via client ou description)
  const travaux = allTravaux?.filter(t => 
    !t.archive && ['planifie', 'en_cours'].includes(t.statut)
  ).slice(0, 5) || [];

  const getStatutConfig = (statut: string) => {
    switch (statut) {
      case 'planifie': return { label: 'Planifié', color: 'blue' };
      case 'en_cours': return { label: 'En cours', color: 'amber' };
      case 'termine': return { label: 'Terminé', color: 'green' };
      default: return { label: statut, color: 'gray' };
    }
  };

  if (isLoading) return <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[var(--text-primary)] mb-4">Travaux en cours</h3>

      {travaux.length > 0 ? (
        travaux.map(t => {
          const config = getStatutConfig(t.statut);
          return (
            <div key={t.id} className="p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-purple-400">{t.code}</span>
                <Badge variant={config.color as any}>{config.label}</Badge>
              </div>
              <div className="text-sm text-[var(--text-primary)]">{t.titre}</div>
              {t.description && (
                <div className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">{t.description}</div>
              )}
              {t.date_debut && (
                <div className="text-xs text-[var(--text-tertiary)] mt-2">
                  Début: {format(parseISO(t.date_debut), 'd MMM yyyy', { locale: fr })}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          Aucun travaux en cours
        </div>
      )}
    </div>
  );
}

// Onglet Stock (sortie véhicule)
function StockTab({ ascenseurId, ascenseurCode }: { ascenseurId: string; ascenseurCode: string }) {
  const queryClient = useQueryClient();
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [quantite, setQuantite] = useState(1);

  // Stock du véhicule de l'utilisateur
  const { data: stockVehicule, isLoading } = useQuery({
    queryKey: ['stock-vehicule-technicien', CURRENT_USER_ID],
    queryFn: () => getStockVehiculeByTechnicien(CURRENT_USER_ID),
  });

  const sortieMutation = useMutation({
    mutationFn: async () => {
      // Créer un mouvement de sortie
      await createStockMouvement(
        selectedArticle.article_id,
        'sortie',
        quantite,
        `Sortie pour ${ascenseurCode}`,
        undefined,
        CURRENT_USER_ID
      );
    },
    onSuccess: () => {
      toast.success(`${quantite}x ${selectedArticle.article?.designation} sorti(s)`);
      setSelectedArticle(null);
      setQuantite(1);
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
    },
    onError: () => toast.error('Erreur lors de la sortie'),
  });

  if (isLoading) return <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Stock véhicule</h3>
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Truck className="w-4 h-4" />
          Mon véhicule
        </div>
      </div>

      {selectedArticle && (
        <div className="p-4 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-medium text-[var(--text-primary)]">{selectedArticle.article?.designation}</div>
              <div className="text-sm text-[var(--text-tertiary)]">
                Disponible: {selectedArticle.quantite} | Sortie pour: {ascenseurCode}
              </div>
            </div>
            <button onClick={() => setSelectedArticle(null)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
              <X className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={selectedArticle.quantite}
              value={quantite}
              onChange={e => setQuantite(Math.min(selectedArticle.quantite, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20"
            />
            <Button variant="primary" onClick={() => sortieMutation.mutate()} disabled={sortieMutation.isPending}>
              <Check className="w-4 h-4" /> Confirmer sortie
            </Button>
          </div>
        </div>
      )}

      {stockVehicule && stockVehicule.length > 0 ? (
        <div className="space-y-2">
          {stockVehicule.filter(s => s.quantite > 0).map(item => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
                selectedArticle?.id === item.id ? 'ring-2 ring-cyan-500' : ''
              }`}
              onClick={() => { setSelectedArticle(item); setQuantite(1); }}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{item.article?.designation}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{item.article?.reference}</div>
                </div>
              </div>
              <Badge variant="cyan">{item.quantite} dispo</Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          Stock véhicule vide
        </div>
      )}
    </div>
  );
}

// Onglet Demande
function DemandeTab({ ascenseurId, ascenseurCode }: { ascenseurId: string; ascenseurCode: string }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'aide' | 'piece'>('aide');
  const [form, setForm] = useState({ objet: '', description: '' });

  const createMutation = useMutation({
    mutationFn: () => createDemande({
      code: `DEM-${Date.now().toString().slice(-6)}`,
      type: type === 'aide' ? 'support' : 'commande',
      objet: form.objet || `${type === 'aide' ? 'Aide' : 'Pièce'} pour ${ascenseurCode}`,
      description: form.description,
      demandeur_id: CURRENT_USER_ID,
      priorite: 'normale',
      statut: 'en_attente',
    }),
    onSuccess: () => {
      toast.success('Demande créée');
      setForm({ objet: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-[var(--text-primary)]">Nouvelle demande</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setType('aide')}
          className={`p-4 rounded-lg border-2 transition-colors ${
            type === 'aide' ? 'border-pink-500 bg-pink-500/10' : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <HelpCircle className="w-8 h-8 mx-auto mb-2 text-pink-400" />
          <div className="text-sm font-medium text-[var(--text-primary)]">Demande d'aide</div>
          <div className="text-xs text-[var(--text-tertiary)]">Assistance technique</div>
        </button>
        <button
          onClick={() => setType('piece')}
          className={`p-4 rounded-lg border-2 transition-colors ${
            type === 'piece' ? 'border-purple-500 bg-purple-500/10' : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <Package className="w-8 h-8 mx-auto mb-2 text-purple-400" />
          <div className="text-sm font-medium text-[var(--text-primary)]">Demande de pièce</div>
          <div className="text-xs text-[var(--text-tertiary)]">Commande matériel</div>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Objet</label>
        <Input
          value={form.objet}
          onChange={e => setForm({ ...form, objet: e.target.value })}
          placeholder={`${type === 'aide' ? 'Aide' : 'Pièce'} pour ${ascenseurCode}`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description *</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={4}
          placeholder="Décrivez votre demande..."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => createMutation.mutate()}
          disabled={!form.description || createMutation.isPending}
        >
          <Plus className="w-4 h-4" /> Créer la demande
        </Button>
      </div>
    </div>
  );
}
