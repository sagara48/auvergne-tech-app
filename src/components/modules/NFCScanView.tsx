import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, FileText, StickyNote, Hammer, Package, HelpCircle,
  X, Plus, Download, Eye, Clock, User, MapPin, Calendar,
  ChevronRight, AlertTriangle, Check, Search, Minus, Send
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getAscenseur, getTravaux, getDocuments, getNotes, createNote,
  createDemande, getStockVehicule, createStockMouvement, createNFCScan
} from '@/services/api';
import type { Ascenseur, Travaux, Document, Note, StockVehicule } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCScanViewProps {
  ascenseurId: string;
  tagId: string;
  onClose: () => void;
}

// Onglet Documentation
function DocumentsTab({ ascenseurId }: { ascenseurId: string }) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', 'ascenseur', ascenseurId],
    queryFn: () => getDocuments({ ascenseur_id: ascenseurId }),
  });

  if (isLoading) {
    return <div className="p-4 text-center text-[var(--text-muted)]">Chargement...</div>;
  }

  if (!documents?.length) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-[var(--text-muted)]">Aucun document pour cet ascenseur</p>
      </div>
    );
  }

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'etude_securite': return '📋';
      case 'manuel_technique': return '📘';
      case 'schema_electrique': return '⚡';
      case 'plan': return '📐';
      case 'certificat': return '🔒';
      default: return '📄';
    }
  };

  return (
    <div className="divide-y divide-[var(--border-secondary)]">
      {documents.map(doc => (
        <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)]/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getDocIcon(doc.type)}</span>
            <div>
              <div className="font-medium text-[var(--text-primary)]">{doc.nom}</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {doc.version && `v${doc.version} • `}
                {format(parseISO(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <Eye className="w-4 h-4" /> Voir
            </Button>
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Onglet Notes
function NotesTab({ ascenseurId, tagId }: { ascenseurId: string; tagId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNote, setNewNote] = useState({ titre: '', contenu: '' });
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', 'ascenseur', ascenseurId],
    queryFn: async () => {
      const allNotes = await getNotes(CURRENT_USER_ID, true);
      return allNotes.filter(n => n.ascenseur_id === ascenseurId);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const note = await createNote({
        titre: newNote.titre,
        contenu: newNote.contenu,
        couleur: '#06b6d4',
        categorie: 'technique',
        technicien_id: CURRENT_USER_ID,
        ascenseur_id: ascenseurId,
      });
      // Log le scan
      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: 'note',
        metadata: { note_id: note.id },
      });
      return note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note créée');
      setShowAdd(false);
      setNewNote({ titre: '', contenu: '' });
    },
  });

  return (
    <div>
      <div className="p-4 border-b border-[var(--border-secondary)]">
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Nouvelle note
        </Button>
      </div>

      {showAdd && (
        <div className="p-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)]">
          <Input
            value={newNote.titre}
            onChange={e => setNewNote({ ...newNote, titre: e.target.value })}
            placeholder="Titre de la note"
            className="mb-2"
          />
          <textarea
            value={newNote.contenu}
            onChange={e => setNewNote({ ...newNote, contenu: e.target.value })}
            placeholder="Contenu..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] mb-2"
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => createMutation.mutate()}
              disabled={!newNote.titre || createMutation.isPending}
            >
              Créer
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-4 text-center text-[var(--text-muted)]">Chargement...</div>
      ) : !notes?.length ? (
        <div className="p-8 text-center">
          <StickyNote className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">Aucune note pour cet ascenseur</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-secondary)]">
          {notes.map(note => (
            <div key={note.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-[var(--text-primary)]">{note.titre}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {format(parseISO(note.created_at), 'dd/MM HH:mm', { locale: fr })}
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{note.contenu}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Onglet Travaux
function TravauxTab({ ascenseurId }: { ascenseurId: string }) {
  const { data: travaux, isLoading } = useQuery({
    queryKey: ['travaux', 'ascenseur', ascenseurId],
    queryFn: async () => {
      const all = await getTravaux();
      return all.filter(t => t.ascenseur_id === ascenseurId && !t.archive);
    },
  });

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'planifie': return <Badge variant="blue">Planifié</Badge>;
      case 'en_cours': return <Badge variant="amber">En cours</Badge>;
      case 'en_attente': return <Badge variant="gray">En attente</Badge>;
      case 'termine': return <Badge variant="green">Terminé</Badge>;
      default: return <Badge variant="gray">{statut}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-[var(--text-muted)]">Chargement...</div>;
  }

  if (!travaux?.length) {
    return (
      <div className="p-8 text-center">
        <Hammer className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-[var(--text-muted)]">Aucun travaux en cours</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-secondary)]">
      {travaux.map(t => (
        <div key={t.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-400">{t.code}</span>
              {getStatutBadge(t.statut)}
            </div>
          </div>
          <div className="font-medium text-[var(--text-primary)] mb-1">{t.titre}</div>
          {t.description && (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{t.description}</p>
          )}
          {t.technicien && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-tertiary)]">
              <User className="w-3 h-3" />
              {t.technicien.prenom} {t.technicien.nom}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Onglet Demande
function DemandeTab({ ascenseurId, tagId, onClose }: { ascenseurId: string; tagId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    type: 'aide',
    objet: '',
    description: '',
    priorite: 'normale',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const demande = await createDemande({
        type: form.type as any,
        objet: form.objet,
        description: form.description,
        priorite: form.priorite as any,
        ascenseur_id: ascenseurId,
        technicien_id: CURRENT_USER_ID,
      });
      // Log le scan
      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: 'demande',
        metadata: { demande_id: demande.id, type: form.type },
      });
      return demande;
    },
    onSuccess: (demande) => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success(`Demande ${demande.code} créée`);
      onClose();
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Type de demande</label>
        <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="aide">🆘 Demande d'aide</option>
          <option value="piece">📦 Demande de pièce</option>
          <option value="information">ℹ️ Demande d'information</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Objet *</label>
        <Input
          value={form.objet}
          onChange={e => setForm({ ...form, objet: e.target.value })}
          placeholder="Ex: Besoin aide diagnostic variateur"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Détails de la demande..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Priorité</label>
        <Select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })}>
          <option value="basse">Basse</option>
          <option value="normale">Normale</option>
          <option value="haute">Haute</option>
          <option value="urgente">Urgente</option>
        </Select>
      </div>

      <Button 
        variant="primary" 
        className="w-full"
        onClick={() => createMutation.mutate()}
        disabled={!form.objet || createMutation.isPending}
      >
        <Send className="w-4 h-4" /> Envoyer la demande
      </Button>
    </div>
  );
}

// Onglet Stock Véhicule
function StockTab({ ascenseurId, tagId }: { ascenseurId: string; tagId: string }) {
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<StockVehicule | null>(null);
  const [quantite, setQuantite] = useState(1);
  const queryClient = useQueryClient();

  const { data: stockVehicule, isLoading } = useQuery({
    queryKey: ['stock-vehicule', CURRENT_USER_ID],
    queryFn: () => getStockVehicule(CURRENT_USER_ID),
  });

  const sortieMutation = useMutation({
    mutationFn: async () => {
      if (!selectedArticle) return;
      await createStockMouvement(
        selectedArticle.article_id,
        'sortie',
        quantite,
        `Sortie pour ascenseur (NFC)`,
        undefined,
        CURRENT_USER_ID
      );
      // Log le scan
      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: 'sortie_stock',
        metadata: { 
          article_id: selectedArticle.article_id,
          designation: selectedArticle.article?.designation,
          quantite,
          ascenseur_id: ascenseurId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
      toast.success(`${quantite}x ${selectedArticle?.article?.designation} sorti(s) du stock`);
      setSelectedArticle(null);
      setQuantite(1);
    },
  });

  const filtered = stockVehicule?.filter(s => 
    s.article?.designation?.toLowerCase().includes(search.toLowerCase()) ||
    s.article?.reference?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="p-4 border-b border-[var(--border-secondary)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une pièce..."
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-[var(--text-muted)]">Chargement...</div>
      ) : !filtered?.length ? (
        <div className="p-8 text-center">
          <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">Aucune pièce dans le véhicule</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-secondary)]">
          {filtered.map(item => (
            <div key={item.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)]">
                    {item.article?.designation}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    Réf: {item.article?.reference} • Dispo: {item.quantite}
                  </div>
                </div>
                
                {selectedArticle?.id === item.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantite(Math.max(1, quantite - 1))}
                      className="p-1 rounded bg-[var(--bg-tertiary)]"
                    >
                      <Minus className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                    <span className="w-8 text-center font-medium">{quantite}</span>
                    <button
                      onClick={() => setQuantite(Math.min(item.quantite, quantite + 1))}
                      className="p-1 rounded bg-[var(--bg-tertiary)]"
                    >
                      <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => sortieMutation.mutate()}
                      disabled={sortieMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => { setSelectedArticle(null); setQuantite(1); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setSelectedArticle(item)}
                    disabled={item.quantite === 0}
                  >
                    <Package className="w-4 h-4" /> Sortir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Composant principal
export function NFCScanView({ ascenseurId, tagId, onClose }: NFCScanViewProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'notes' | 'travaux' | 'demande' | 'stock'>('docs');
  const queryClient = useQueryClient();

  const { data: ascenseur, isLoading } = useQuery({
    queryKey: ['ascenseur', ascenseurId],
    queryFn: () => getAscenseur(ascenseurId),
  });

  // Log le scan à l'ouverture
  useEffect(() => {
    createNFCScan({
      tag_id: tagId,
      technicien_id: CURRENT_USER_ID,
      action: 'consultation',
      metadata: { source: 'mobile' },
    }).catch(console.error);
  }, [tagId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <Card className="w-[500px]">
          <CardBody className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!ascenseur) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <Card className="w-[500px]">
          <CardBody className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-semibold text-[var(--text-primary)]">Ascenseur non trouvé</h3>
            <Button variant="secondary" className="mt-4" onClick={onClose}>Fermer</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'docs', label: 'Docs', icon: FileText },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'travaux', label: 'Travaux', icon: Hammer },
    { id: 'demande', label: 'Demande', icon: HelpCircle },
    { id: 'stock', label: 'Stock', icon: Package },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-400 text-lg">{ascenseur.code}</span>
                  <Badge variant={ascenseur.statut === 'en_service' ? 'green' : 'red'}>
                    {ascenseur.statut === 'en_service' ? 'En service' : ascenseur.statut}
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{ascenseur.client?.nom}</div>
                <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <MapPin className="w-3 h-3" />
                  {ascenseur.adresse}, {ascenseur.ville}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Infos techniques */}
          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
            <span>🏭 {ascenseur.marque}</span>
            <span>📋 {ascenseur.modele}</span>
            <span>🔢 {ascenseur.numero_serie}</span>
            <span>🏢 {ascenseur.nb_niveaux} niveaux</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-secondary)]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' 
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'docs' && <DocumentsTab ascenseurId={ascenseurId} />}
          {activeTab === 'notes' && <NotesTab ascenseurId={ascenseurId} tagId={tagId} />}
          {activeTab === 'travaux' && <TravauxTab ascenseurId={ascenseurId} />}
          {activeTab === 'demande' && <DemandeTab ascenseurId={ascenseurId} tagId={tagId} onClose={onClose} />}
          {activeTab === 'stock' && <StockTab ascenseurId={ascenseurId} tagId={tagId} />}
        </div>
      </Card>
    </div>
  );
}
