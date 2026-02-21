// components/notes/NotesContextuelles.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  StickyNote, Plus, Pin, AlertTriangle, Info, Wrench,
  User, Phone, MessageSquare, Tag, X, Edit, Trash2,
  Eye, Clock, Bell, Send, Loader2, ChevronDown, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Note {
  id: string;
  titre: string | null;
  contenu: string;
  type: 'info' | 'attention' | 'urgent' | 'procedure' | 'contact' | 'technique';
  importance: number;
  epingle: boolean;
  tags: string[];
  date_rappel: string | null;
  auteur_nom: string | null;
  auteur_id: string;
  created_at: string;
  updated_at: string;
  nb_vues: number;
  nb_commentaires: number;
  rappel_actif: boolean;
}

interface Commentaire {
  id: string;
  contenu: string;
  auteur_id: string;
  auteur_nom?: string;
  created_at: string;
}

interface NotesContextuellesProps {
  contexteType: 'ascenseur' | 'client' | 'intervention' | 'travaux' | 'vehicule';
  contexteId: string;
  contexteNom?: string;
  compact?: boolean;
}

const TYPE_CONFIG = {
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Info' },
  attention: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Attention' },
  urgent: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200', label: 'Urgent' },
  procedure: { icon: Wrench, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Procédure' },
  contact: { icon: Phone, color: 'bg-green-100 text-green-700 border-green-200', label: 'Contact' },
  technique: { icon: Wrench, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Technique' },
};

export function NotesContextuelles({ 
  contexteType, 
  contexteId, 
  contexteNom,
  compact = false 
}: NotesContextuellesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Récupérer l'utilisateur courant
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Charger les notes
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      // Utiliser la fonction RPC pour récupérer les notes du contexte
      const { data, error } = await supabase.rpc('get_notes_contexte', {
        p_contexte_type: contexteType,
        p_contexte_id: contexteId,
        p_include_epingle: true,
      });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Erreur chargement notes:', err);
      // Fallback: requête directe
      const { data } = await supabase
        .from('v_notes_contexte')
        .select('*')
        .contains(contexteType + '_ids', [contexteId])
        .order('epingle', { ascending: false })
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false });
      
      setNotes(data || []);
    } finally {
      setLoading(false);
    }
  }, [contexteType, contexteId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Charger les commentaires d'une note
  const loadCommentaires = async (noteId: string) => {
    const { data } = await supabase
      .from('notes_commentaires')
      .select('*, profiles:auteur_id(full_name)')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true });

    setCommentaires((data || []).map(c => ({
      ...c,
      auteur_nom: c.profiles?.full_name
    })));
  };

  // Ouvrir une note
  const handleOpenNote = async (note: Note) => {
    setSelectedNote(note);
    loadCommentaires(note.id);

    // Marquer comme vue
    if (currentUserId) {
      await supabase.rpc('note_marquer_vue', {
        p_note_id: note.id,
        p_user_id: currentUserId,
      });
    }
  };

  // Ajouter un commentaire
  const handleAddComment = async (noteId: string, contenu: string) => {
    if (!currentUserId || !contenu.trim()) return;

    try {
      const { error } = await supabase
        .from('notes_commentaires')
        .insert({
          note_id: noteId,
          auteur_id: currentUserId,
          contenu: contenu.trim(),
        });

      if (error) throw error;
      loadCommentaires(noteId);
      loadNotes();
    } catch (err) {
      console.error('Erreur ajout commentaire:', err);
    }
  };

  // Toggle épingle
  const handleToggleEpingle = async (note: Note) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ epingle: !note.epingle })
        .eq('id', note.id);

      if (error) throw error;
      loadNotes();
    } catch (err) {
      console.error('Erreur toggle épingle:', err);
    }
  };

  // Supprimer une note
  const handleDelete = async (noteId: string) => {
    if (!confirm('Supprimer cette note ?')) return;

    try {
      const { error } = await supabase
        .from('notes')
        .update({ archive: true })
        .eq('id', noteId);

      if (error) throw error;
      setSelectedNote(null);
      loadNotes();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  // Filtrage
  const notesFiltrees = notes.filter(note => {
    if (filtreType && note.type !== filtreType) return false;
    if (search) {
      const s = search.toLowerCase();
      return note.titre?.toLowerCase().includes(s) ||
             note.contenu.toLowerCase().includes(s) ||
             note.tags.some(t => t.toLowerCase().includes(s));
    }
    return true;
  });

  // Notes épinglées vs normales
  const notesEpinglees = notesFiltrees.filter(n => n.epingle);
  const notesNormales = notesFiltrees.filter(n => !n.epingle);

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString('fr-FR');
  };

  if (compact) {
    // Version compacte pour sidebar
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-gray-600 flex items-center gap-1">
            <StickyNote className="w-4 h-4" />
            Notes ({notes.length})
          </h4>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {notesEpinglees.slice(0, 2).map(note => {
          const config = TYPE_CONFIG[note.type];
          const Icon = config.icon;
          return (
            <div
              key={note.id}
              onClick={() => handleOpenNote(note)}
              className={`p-2 rounded-lg border cursor-pointer ${config.color}`}
            >
              <div className="flex items-start gap-2">
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {note.titre && (
                    <p className="font-medium text-sm truncate">{note.titre}</p>
                  )}
                  <p className="text-xs line-clamp-2">{note.contenu}</p>
                </div>
                {note.epingle && <Pin className="w-3 h-3 flex-shrink-0" />}
              </div>
            </div>
          );
        })}

        {notes.length > 2 && (
          <button className="text-xs text-blue-600 hover:underline w-full text-center">
            Voir toutes les notes ({notes.length})
          </button>
        )}

        {showAddModal && (
          <AddNoteModal
            contexteType={contexteType}
            contexteId={contexteId}
            onClose={() => setShowAddModal(false)}
            onSaved={() => { setShowAddModal(false); loadNotes(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-yellow-600" />
            Notes
            {contexteNom && <span className="text-gray-400 font-normal">- {contexteNom}</span>}
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
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
            value={filtreType || ''}
            onChange={(e) => setFiltreType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Tous les types</option>
            {Object.entries(TYPE_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste notes */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
          </div>
        ) : notesFiltrees.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <StickyNote className="w-12 h-12 mx-auto mb-2" />
            <p>Aucune note</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Notes épinglées */}
            {notesEpinglees.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  Épinglées
                </h4>
                <div className="space-y-2">
                  {notesEpinglees.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onClick={() => handleOpenNote(note)}
                      onToggleEpingle={() => handleToggleEpingle(note)}
                      isOwner={note.auteur_id === currentUserId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Autres notes */}
            {notesNormales.length > 0 && (
              <div>
                {notesEpinglees.length > 0 && (
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Autres notes
                  </h4>
                )}
                <div className="space-y-2">
                  {notesNormales.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onClick={() => handleOpenNote(note)}
                      onToggleEpingle={() => handleToggleEpingle(note)}
                      isOwner={note.auteur_id === currentUserId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal ajout note */}
      {showAddModal && (
        <AddNoteModal
          contexteType={contexteType}
          contexteId={contexteId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); loadNotes(); }}
        />
      )}

      {/* Modal détail note */}
      {selectedNote && (
        <NoteDetailModal
          note={selectedNote}
          commentaires={commentaires}
          onClose={() => { setSelectedNote(null); setCommentaires([]); }}
          onAddComment={(contenu) => handleAddComment(selectedNote.id, contenu)}
          onDelete={() => handleDelete(selectedNote.id)}
          onToggleEpingle={() => { handleToggleEpingle(selectedNote); setSelectedNote({ ...selectedNote, epingle: !selectedNote.epingle }); }}
          isOwner={selectedNote.auteur_id === currentUserId}
        />
      )}
    </div>
  );
}

// Composant carte note
function NoteCard({ 
  note, 
  onClick, 
  onToggleEpingle,
  isOwner 
}: { 
  note: Note; 
  onClick: () => void;
  onToggleEpingle: () => void;
  isOwner: boolean;
}) {
  const config = TYPE_CONFIG[note.type];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${config.color}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/50`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {note.titre && (
                <p className="font-semibold">{note.titre}</p>
              )}
              <p className={`text-sm ${note.titre ? 'line-clamp-2' : 'line-clamp-3'}`}>
                {note.contenu}
              </p>
            </div>
            
            <button
              onClick={(e) => { e.stopPropagation(); onToggleEpingle(); }}
              className={`p-1 rounded hover:bg-white/50 ${note.epingle ? 'text-yellow-600' : 'text-gray-400'}`}
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>

          {/* Tags */}
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {note.tags.map((tag, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-white/50 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 mt-2 text-xs opacity-70">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {note.auteur_nom}
            </span>
            <span>{new Date(note.created_at).toLocaleDateString('fr-FR')}</span>
            {note.nb_commentaires > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {note.nb_commentaires}
              </span>
            )}
            {note.rappel_actif && (
              <span className="flex items-center gap-1 text-red-600">
                <Bell className="w-3 h-3" />
                Rappel
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal ajout note
function AddNoteModal({
  contexteType,
  contexteId,
  onClose,
  onSaved,
}: {
  contexteType: string;
  contexteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [type, setType] = useState<string>('info');
  const [importance, setImportance] = useState(1);
  const [epingle, setEpingle] = useState(false);
  const [tags, setTags] = useState('');
  const [dateRappel, setDateRappel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!contenu.trim()) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const noteData: any = {
        titre: titre.trim() || null,
        contenu: contenu.trim(),
        type,
        importance,
        epingle,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        date_rappel: dateRappel || null,
        auteur_id: user.id,
      };

      // Ajouter la liaison selon le contexte
      noteData[contexteType + '_ids'] = [contexteId];

      const { error } = await supabase.from('notes').insert(noteData);
      if (error) throw error;

      onSaved();
    } catch (err: any) {
      console.error('Erreur création note:', err);
      alert('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Nouvelle note</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, val]) => {
                const Icon = val.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      type === key ? val.color + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {val.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-sm font-medium mb-1">Titre (optionnel)</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: Attention gardien"
            />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-sm font-medium mb-1">Contenu *</label>
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
              placeholder="Écrivez votre note ici..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: clé, gardien, accès"
            />
          </div>

          {/* Options */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Importance</label>
              <select
                value={importance}
                onChange={(e) => setImportance(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value={1}>Normale</option>
                <option value={2}>Importante</option>
                <option value={3}>Très importante</option>
                <option value={4}>Critique</option>
                <option value={5}>Urgente</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Rappel</label>
              <input
                type="datetime-local"
                value={dateRappel}
                onChange={(e) => setDateRappel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Épingler */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={epingle}
              onChange={(e) => setEpingle(e.target.checked)}
              className="rounded"
            />
            <Pin className="w-4 h-4 text-yellow-600" />
            <span className="text-sm">Épingler cette note</span>
          </label>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!contenu.trim() || saving}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal détail note
function NoteDetailModal({
  note,
  commentaires,
  onClose,
  onAddComment,
  onDelete,
  onToggleEpingle,
  isOwner,
}: {
  note: Note;
  commentaires: Commentaire[];
  onClose: () => void;
  onAddComment: (contenu: string) => void;
  onDelete: () => void;
  onToggleEpingle: () => void;
  isOwner: boolean;
}) {
  const [newComment, setNewComment] = useState('');
  const config = TYPE_CONFIG[note.type];
  const Icon = config.icon;

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-4 border-b ${config.color}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-6 h-6" />
              <div>
                {note.titre && <h3 className="font-semibold text-lg">{note.titre}</h3>}
                <p className="text-sm opacity-70">
                  Par {note.auteur_nom} • {new Date(note.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleEpingle}
                className={`p-2 rounded-lg hover:bg-white/30 ${note.epingle ? '' : 'opacity-50'}`}
              >
                <Pin className="w-5 h-5" />
              </button>
              {isOwner && (
                <button
                  onClick={onDelete}
                  className="p-2 rounded-lg hover:bg-white/30 text-red-600"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/30">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto p-4">
          <p className="whitespace-pre-wrap">{note.contenu}</p>

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {note.tags.map((tag, i) => (
                <span key={i} className="text-sm px-2 py-1 bg-gray-100 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Commentaires */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Commentaires ({commentaires.length})
            </h4>

            <div className="space-y-3">
              {commentaires.map(comm => (
                <div key={comm.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{comm.auteur_nom}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(comm.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm">{comm.contenu}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ajouter commentaire */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
              placeholder="Ajouter un commentaire..."
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
