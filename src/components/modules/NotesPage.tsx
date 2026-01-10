import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Pin, PinOff, Trash2, Edit, X, Archive, Share2, 
  Tag, Filter, Grid, List, Clock, User, Building2, Hammer,
  FileCheck, MoreVertical, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { 
  getNotes, createNote, updateNote, deleteNote, toggleNotePin, 
  archiveNote, getNoteCategories, searchNotes 
} from '@/services/api';
import type { Note, NoteCategorie } from '@/types';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Configuration des catégories
const CATEGORIES_CONFIG: Record<NoteCategorie, { label: string; icon: any; color: string }> = {
  perso: { label: 'Personnel', icon: User, color: '#6366f1' },
  technique: { label: 'Technique', icon: Hammer, color: '#f59e0b' },
  client: { label: 'Client', icon: Building2, color: '#22c55e' },
  urgent: { label: 'Urgent', icon: AlertTriangle, color: '#ef4444' },
};

// Couleurs disponibles pour les notes
const NOTE_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#22c55e', // Green
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#a855f7', // Purple
];

// Composant carte de note
function NoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onTogglePin,
  viewMode
}: { 
  note: Note; 
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  viewMode: 'grid' | 'list';
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOwn = note.technicien_id === CURRENT_USER_ID;
  const categoryConfig = CATEGORIES_CONFIG[note.categorie];

  const contextLabel = note.ascenseur 
    ? `📍 ${note.ascenseur.code}` 
    : note.travaux 
    ? `🔧 ${note.travaux.code}`
    : note.client
    ? `🏢 ${note.client.raison_sociale}`
    : null;

  if (viewMode === 'list') {
    return (
      <div 
        className={`flex items-center gap-4 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-dark-500 transition-all cursor-pointer group ${
          note.epingle ? 'ring-1 ring-purple-500/30' : ''
        }`}
        onClick={onEdit}
      >
        <div 
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ backgroundColor: note.couleur }}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.epingle && <Pin className="w-3 h-3 text-purple-400" />}
            <span className="font-semibold text-[var(--text-primary)] truncate">{note.titre}</span>
            {note.partage && <Share2 className="w-3 h-3 text-blue-400" />}
          </div>
          <div className="text-sm text-[var(--text-tertiary)] truncate">
            {note.contenu?.substring(0, 100) || 'Aucun contenu'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {contextLabel && (
            <span className="text-xs text-[var(--text-tertiary)]">{contextLabel}</span>
          )}
          <Badge 
            variant="gray" 
            className="text-[10px]"
            style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color }}
          >
            {categoryConfig.label}
          </Badge>
          <span className="text-xs text-[var(--text-muted)]">
            {formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className="p-1.5 hover:bg-[var(--bg-elevated)] rounded"
          >
            {note.epingle ? <PinOff className="w-4 h-4 text-purple-400" /> : <Pin className="w-4 h-4 text-[var(--text-tertiary)]" />}
          </button>
          {isOwn && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 hover:bg-red-500/20 rounded"
            >
              <Trash2 className="w-4 h-4 text-[var(--text-tertiary)] hover:text-red-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden hover:border-dark-500 transition-all cursor-pointer group ${
        note.epingle ? 'ring-1 ring-purple-500/30' : ''
      }`}
      onClick={onEdit}
    >
      {/* Barre de couleur */}
      <div className="h-1" style={{ backgroundColor: note.couleur }} />
      
      <div className="p-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {note.epingle && <Pin className="w-3 h-3 text-purple-400 flex-shrink-0" />}
            <h3 className="font-semibold text-[var(--text-primary)] truncate">{note.titre}</h3>
          </div>
          <div className="flex items-center gap-1">
            {note.partage && <Share2 className="w-3 h-3 text-blue-400" />}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 hover:bg-[var(--bg-elevated)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg shadow-xl py-1 z-20 min-w-[140px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); onTogglePin(); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] flex items-center gap-2"
                  >
                    {note.epingle ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    {note.epingle ? 'Désépingler' : 'Épingler'}
                  </button>
                  {isOwn && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
                        className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] flex items-center gap-2"
                      >
                        <Edit className="w-3 h-3" /> Modifier
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                        className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--bg-elevated)] flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contenu */}
        <p className="text-sm text-[var(--text-tertiary)] flex-1 line-clamp-3 whitespace-pre-line">
          {note.contenu || 'Aucun contenu'}
        </p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded">
                #{tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-[10px] text-[var(--text-muted)]">+{note.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Context */}
        {contextLabel && (
          <div className="text-xs text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-secondary)]">
            {contextLabel}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-secondary)]">
          <Badge 
            variant="gray" 
            className="text-[10px]"
            style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color }}
          >
            {categoryConfig.label}
          </Badge>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            {!isOwn && note.technicien && (
              <span>{note.technicien.prenom}</span>
            )}
            <span>{formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal création/édition de note
function NoteFormModal({ 
  note, 
  onClose, 
  onSave 
}: { 
  note?: Note; 
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
}) {
  const [form, setForm] = useState({
    titre: note?.titre || '',
    contenu: note?.contenu || '',
    couleur: note?.couleur || NOTE_COLORS[0],
    categorie: note?.categorie || 'perso' as NoteCategorie,
    tags: note?.tags?.join(', ') || '',
    partage: note?.partage || false,
  });

  const handleSubmit = () => {
    if (!form.titre.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    const tags = form.tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    onSave({
      titre: form.titre.trim(),
      contenu: form.contenu.trim(),
      couleur: form.couleur,
      categorie: form.categorie,
      tags,
      partage: form.partage,
      technicien_id: CURRENT_USER_ID,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {note ? 'Modifier la note' : 'Nouvelle note'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Titre */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Titre *
              </label>
              <Input
                value={form.titre}
                onChange={e => setForm({ ...form, titre: e.target.value })}
                placeholder="Titre de la note..."
              />
            </div>

            {/* Contenu */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Contenu
              </label>
              <textarea
                value={form.contenu}
                onChange={e => setForm({ ...form, contenu: e.target.value })}
                placeholder="Écrivez votre note ici..."
                rows={6}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm placeholder-dark-400 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Catégorie et Couleur */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Catégorie
                </label>
                <Select
                  value={form.categorie}
                  onChange={e => setForm({ ...form, categorie: e.target.value as NoteCategorie })}
                >
                  {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Couleur
                </label>
                <div className="flex flex-wrap gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm({ ...form, couleur: color })}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        form.couleur === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-700 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Tags (séparés par des virgules)
              </label>
              <Input
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="ex: variateur, ABB, paramétrage"
              />
            </div>

            {/* Partage */}
            <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
              <input
                type="checkbox"
                id="partage"
                checked={form.partage}
                onChange={e => setForm({ ...form, partage: e.target.checked })}
                className="w-4 h-4 rounded border-dark-500 bg-[var(--bg-elevated)] text-purple-500 focus:ring-purple-500"
              />
              <label htmlFor="partage" className="flex-1">
                <div className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-400" />
                  Partager avec l'équipe
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  Cette note sera visible par tous les techniciens
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit}>
              {note ? 'Enregistrer' : 'Créer la note'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Page principale Notes
export function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'mine' | 'shared'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);

  // Queries
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', CURRENT_USER_ID],
    queryFn: () => getNotes(CURRENT_USER_ID),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note créée');
      setShowForm(false);
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Note> }) => updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note mise à jour');
      setEditNote(null);
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note supprimée');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ id, epingle }: { id: string; epingle: boolean }) => toggleNotePin(id, epingle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // Filtres
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    
    return notes.filter(note => {
      // Filtre recherche
      if (search) {
        const searchLower = search.toLowerCase();
        const matchTitle = note.titre.toLowerCase().includes(searchLower);
        const matchContent = note.contenu?.toLowerCase().includes(searchLower);
        const matchTags = note.tags?.some(t => t.toLowerCase().includes(searchLower));
        if (!matchTitle && !matchContent && !matchTags) return false;
      }

      // Filtre catégorie
      if (filterCategorie !== 'all' && note.categorie !== filterCategorie) return false;

      // Filtre type (mes notes / partagées)
      if (filterType === 'mine' && note.technicien_id !== CURRENT_USER_ID) return false;
      if (filterType === 'shared' && !note.partage) return false;

      return true;
    });
  }, [notes, search, filterCategorie, filterType]);

  // Grouper par épinglées / autres
  const pinnedNotes = filteredNotes.filter(n => n.epingle);
  const otherNotes = filteredNotes.filter(n => !n.epingle);

  // Stats
  const stats = useMemo(() => ({
    total: notes?.length || 0,
    mine: notes?.filter(n => n.technicien_id === CURRENT_USER_ID).length || 0,
    shared: notes?.filter(n => n.partage).length || 0,
    pinned: notes?.filter(n => n.epingle).length || 0,
  }), [notes]);

  const handleSave = (data: Partial<Note>) => {
    if (editNote) {
      updateMutation.mutate({ id: editNote.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette note ?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">📝 Mes Notes</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">
            {stats.total} notes • {stats.pinned} épinglées • {stats.shared} partagées
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouvelle note
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans les notes..."
                className="pl-10"
              />
            </div>

            {/* Filtre catégorie */}
            <Select
              value={filterCategorie}
              onChange={e => setFilterCategorie(e.target.value)}
              className="w-40"
            >
              <option value="all">Toutes catégories</option>
              {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </Select>

            {/* Filtre type */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
              {[
                { value: 'all', label: 'Toutes' },
                { value: 'mine', label: 'Mes notes' },
                { value: 'shared', label: 'Partagées' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterType(opt.value as typeof filterType)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    filterType === opt.value 
                      ? 'bg-purple-500 text-[var(--text-primary)]' 
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Vue mode */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notes épinglées */}
      {pinnedNotes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <Pin className="w-4 h-4" /> Épinglées
          </h2>
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
            : 'space-y-2'
          }>
            {pinnedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                viewMode={viewMode}
                onEdit={() => setEditNote(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => togglePinMutation.mutate({ id: note.id, epingle: !note.epingle })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Autres notes */}
      {otherNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">
              Toutes les notes
            </h2>
          )}
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
            : 'space-y-2'
          }>
            {otherNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                viewMode={viewMode}
                onEdit={() => setEditNote(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => togglePinMutation.mutate({ id: note.id, epingle: !note.epingle })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredNotes.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {search || filterCategorie !== 'all' ? 'Aucune note trouvée' : 'Aucune note'}
          </h3>
          <p className="text-[var(--text-tertiary)] mb-4">
            {search || filterCategorie !== 'all' 
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par créer votre première note'
            }
          </p>
          {!search && filterCategorie === 'all' && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Créer une note
            </Button>
          )}
        </Card>
      )}

      {/* Modals */}
      {(showForm || editNote) && (
        <NoteFormModal
          note={editNote || undefined}
          onClose={() => { setShowForm(false); setEditNote(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANT NOTES CONTEXTUELLES
// ============================================
export function ContextNotes({ 
  contextType, 
  contextId,
  contextLabel
}: { 
  contextType: 'ascenseur' | 'travaux' | 'client' | 'mise_service';
  contextId: string;
  contextLabel: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);

  const { data: notes } = useQuery({
    queryKey: ['context-notes', contextType, contextId],
    queryFn: async () => {
      const column = `${contextType}_id`;
      const { data } = await supabase
        .from('notes')
        .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
        .eq(column, contextId)
        .eq('archive', false)
        .order('epingle', { ascending: false })
        .order('updated_at', { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-notes', contextType, contextId] });
      toast.success('Note ajoutée');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-notes', contextType, contextId] });
      toast.success('Note supprimée');
    },
  });

  const handleCreate = (data: Partial<Note>) => {
    const contextField = `${contextType}_id`;
    createMutation.mutate({
      ...data,
      [contextField]: contextId,
      partage: true, // Notes contextuelles partagées par défaut
    });
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Notes</span>
          <Badge variant="gray" className="text-[10px]">{notes?.length || 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> Ajouter
        </Button>
      </div>

      {/* Liste des notes */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notes?.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            Aucune note sur cet élément
          </p>
        ) : (
          notes?.map(note => {
            const isOwn = note.technicien_id === CURRENT_USER_ID;
            const categoryConfig = CATEGORIES_CONFIG[note.categorie as NoteCategorie];
            
            return (
              <div 
                key={note.id}
                className="p-3 bg-[var(--bg-tertiary)] rounded-lg border-l-2 group"
                style={{ borderLeftColor: note.couleur }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {note.epingle && <Pin className="w-3 h-3 text-purple-400" />}
                    <span className="text-sm font-medium text-[var(--text-primary)]">{note.titre}</span>
                  </div>
                  {isOwn && (
                    <button 
                      onClick={() => deleteMutation.mutate(note.id)}
                      className="p-1 hover:bg-[var(--bg-elevated)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-[var(--text-tertiary)] hover:text-red-400" />
                    </button>
                  )}
                </div>
                {note.contenu && (
                  <p className="text-xs text-[var(--text-tertiary)] whitespace-pre-line mb-2 line-clamp-3">
                    {note.contenu}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${categoryConfig?.color}20`, color: categoryConfig?.color }}
                    >
                      {categoryConfig?.label}
                    </span>
                    <span>{note.technicien?.prenom}</span>
                  </div>
                  <span>{formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal création rapide */}
      {showForm && (
        <NoteFormModal
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}
