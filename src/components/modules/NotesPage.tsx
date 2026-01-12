import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Pin, PinOff, Trash2, Edit, X, Archive, Share2, 
  Tag, Filter, Grid, List, Clock, User, Building2, Hammer, Folder, FolderPlus,
  FileCheck, MoreVertical, AlertTriangle, CheckCircle, Bell, BellOff, Paperclip,
  MessageSquare, Send, ChevronDown, ChevronRight, Bold, Italic, ListTodo,
  Columns, SortAsc, SortDesc, Calendar, Mail, Download, Eye, Check, Square,
  CheckSquare, Upload, Image, FileText, Layers, Link2, ExternalLink, QrCode,
  Users, UserPlus, Lock, Unlock, CalendarClock, Timer, Copy, Printer, Sparkles
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { 
  getNotes, createNote, updateNote, deleteNote, toggleNotePin,
  getNotesDossiers, createNoteDossier,
  getNoteCommentaires, createNoteCommentaire, deleteNoteCommentaire,
  getNotePiecesJointes, uploadNotePieceJointe, deleteNotePieceJointe,
  getAscenseurs, getContextNotes, getTechniciens
} from '@/services/api';
import {
  downloadNotePDF, shareNoteByEmail, generateNoteQRCode,
  getNotesPartages, partagerNote, supprimerPartage,
  getNotesLiees, lierNotes, supprimerLiaison,
  getNoteRappels, creerRappel, supprimerRappel,
  getEcheanceStatus,
  type NotePartage, type NoteLiaison, type NoteRappel
} from '@/services/noteService';
import { AdvancedNoteSearch } from '@/components/AdvancedNoteSearch';
import { type SearchResult } from '@/services/noteSearchService';
import type { Note, NoteCategorie } from '@/types';
import type { NoteDossier, NoteCommentaire, NotePieceJointe, ChecklistItem } from '@/services/api';
import { format, parseISO, formatDistanceToNow, addDays, addHours, addWeeks, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const CATEGORIES_CONFIG: Record<NoteCategorie, { label: string; icon: any; color: string }> = {
  perso: { label: 'Personnel', icon: User, color: '#6366f1' },
  technique: { label: 'Technique', icon: Hammer, color: '#f59e0b' },
  client: { label: 'Client', icon: Building2, color: '#22c55e' },
  urgent: { label: 'Urgent', icon: AlertTriangle, color: '#ef4444' },
};

const PRIORITES = [
  { value: 'basse', label: 'Basse', color: '#71717a' },
  { value: 'normale', label: 'Normale', color: '#3b82f6' },
  { value: 'haute', label: 'Haute', color: '#f59e0b' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
];

const STATUTS = [
  { value: 'active', label: 'Active', color: '#3b82f6' },
  { value: 'en_cours', label: 'En cours', color: '#f59e0b' },
  { value: 'terminee', label: 'Terminée', color: '#22c55e' },
  { value: 'archivee', label: 'Archivée', color: '#71717a' },
];

const NOTE_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7'];

// ============================================
// COMPOSANT CHECKLIST
// ============================================
function ChecklistEditor({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange([...items, { id: Date.now().toString(), texte: newItem, fait: false, ordre: items.length }]);
    setNewItem('');
  };

  const toggleItem = (id: string) => {
    onChange(items.map(i => i.id === id ? { ...i, fait: !i.fait } : i));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
  };

  const progress = items.length > 0 ? Math.round((items.filter(i => i.fait).length / items.length) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="w-4 h-4 text-[var(--text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Checklist</span>
        {items.length > 0 && (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-[var(--text-muted)]">{progress}%</span>
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button onClick={() => toggleItem(item.id)} className="flex-shrink-0">
              {item.fait ? (
                <CheckSquare className="w-4 h-4 text-green-500" />
              ) : (
                <Square className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>
            <span className={`flex-1 text-sm ${item.fait ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
              {item.texte}
            </span>
            <button onClick={() => removeItem(item.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded">
              <X className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input 
          value={newItem} 
          onChange={e => setNewItem(e.target.value)} 
          placeholder="Nouvelle tâche..." 
          className="flex-1 text-sm"
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <Button variant="ghost" size="sm" onClick={addItem}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT COMMENTAIRES
// ============================================
function CommentsSection({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: commentaires } = useQuery({
    queryKey: ['note-commentaires', noteId],
    queryFn: () => getNoteCommentaires(noteId),
  });

  const createMutation = useMutation({
    mutationFn: createNoteCommentaire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-commentaires', noteId] });
      setNewComment('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNoteCommentaire,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-commentaires', noteId] }),
  });

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-[var(--text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Commentaires</span>
        <Badge variant="gray" className="text-[10px]">{commentaires?.length || 0}</Badge>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
        {commentaires?.map(c => (
          <div key={c.id} className="flex gap-2 group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {c.technicien?.avatar_initiales || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-primary)]">{c.technicien?.prenom}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true, locale: fr })}
                </span>
                {c.technicien_id === CURRENT_USER_ID && (
                  <button onClick={() => deleteMutation.mutate(c.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{c.contenu}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="flex-1 text-sm"
          onKeyDown={e => e.key === 'Enter' && newComment.trim() && createMutation.mutate({ note_id: noteId, technicien_id: CURRENT_USER_ID, contenu: newComment })}
        />
        <Button variant="primary" size="sm" onClick={() => newComment.trim() && createMutation.mutate({ note_id: noteId, technicien_id: CURRENT_USER_ID, contenu: newComment })}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT PIECES JOINTES
// ============================================
function AttachmentsSection({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: piecesJointes } = useQuery({
    queryKey: ['note-pj', noteId],
    queryFn: () => getNotePiecesJointes(noteId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadNotePieceJointe(noteId, file, CURRENT_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-pj', noteId] });
      toast.success('Fichier ajouté');
    },
    onError: () => toast.error('Erreur upload'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotePieceJointe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-pj', noteId] }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const getFileIcon = (type?: string) => {
    if (type?.startsWith('image/')) return Image;
    return FileText;
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Pièces jointes</span>
          <Badge variant="gray" className="text-[10px]">{piecesJointes?.length || 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3 h-3" /> Ajouter
        </Button>
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
      </div>

      <div className="space-y-2">
        {piecesJointes?.map(pj => {
          const Icon = getFileIcon(pj.fichier_type);
          return (
            <div key={pj.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg group">
              <Icon className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{pj.nom}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {pj.fichier_taille ? `${(pj.fichier_taille / 1024).toFixed(0)} KB` : ''}
              </span>
              <a href={pj.fichier_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-blue-500/20 rounded">
                <Download className="w-3 h-3 text-blue-400" />
              </a>
              <button onClick={() => deleteMutation.mutate(pj.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded">
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          );
        })}
        {(!piecesJointes || piecesJointes.length === 0) && (
          <div className="text-xs text-[var(--text-muted)] text-center py-2">Aucune pièce jointe</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT ÉCHÉANCES ET RAPPELS
// ============================================
function EcheancesSection({ 
  noteId, 
  echeanceDate, 
  onEcheanceChange 
}: { 
  noteId?: string;
  echeanceDate: string;
  onEcheanceChange: (date: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showAddRappel, setShowAddRappel] = useState(false);

  const { data: rappels } = useQuery({
    queryKey: ['note-rappels', noteId],
    queryFn: () => noteId ? getNoteRappels(noteId) : Promise.resolve([]),
    enabled: !!noteId,
  });

  const createRappelMutation = useMutation({
    mutationFn: ({ type, dateRappel, delai }: { type: 'echeance' | 'rappel_avant'; dateRappel: string; delai?: number }) => 
      creerRappel(noteId!, type, dateRappel, delai),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-rappels', noteId] });
      toast.success('Rappel créé');
      setShowAddRappel(false);
    },
  });

  const deleteRappelMutation = useMutation({
    mutationFn: supprimerRappel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-rappels', noteId] }),
  });

  const echeanceStatus = getEcheanceStatus(echeanceDate);

  const presetRappels = [
    { label: '1 heure avant', delai: 60 },
    { label: '1 jour avant', delai: 1440 },
    { label: '1 semaine avant', delai: 10080 },
  ];

  const addPresetRappel = (delaiMinutes: number) => {
    if (!echeanceDate || !noteId) {
      toast.error('Définissez d\'abord une échéance');
      return;
    }
    const echeance = new Date(echeanceDate);
    const dateRappel = new Date(echeance.getTime() - delaiMinutes * 60 * 1000);
    createRappelMutation.mutate({ 
      type: 'rappel_avant', 
      dateRappel: dateRappel.toISOString(),
      delai: delaiMinutes
    });
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-[var(--text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Échéance & Rappels</span>
      </div>

      {/* Date d'échéance */}
      <div className="flex items-center gap-2 mb-3">
        <Input
          type="datetime-local"
          value={echeanceDate}
          onChange={e => onEcheanceChange(e.target.value)}
          className="flex-1"
        />
        {echeanceStatus.status !== 'none' && (
          <Badge 
            variant={echeanceStatus.status === 'depasse' ? 'red' : echeanceStatus.status === 'urgent' ? 'orange' : 'green'}
            className="text-[10px] whitespace-nowrap"
          >
            {echeanceStatus.label}
          </Badge>
        )}
      </div>

      {/* Raccourcis échéance */}
      <div className="flex gap-2 mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onEcheanceChange(format(addDays(new Date(), 1), "yyyy-MM-dd'T'17:00"))}
        >
          Demain
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onEcheanceChange(format(addWeeks(new Date(), 1), "yyyy-MM-dd'T'17:00"))}
        >
          1 semaine
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onEcheanceChange(format(addDays(new Date(), 30), "yyyy-MM-dd'T'17:00"))}
        >
          1 mois
        </Button>
      </div>

      {/* Rappels programmés */}
      {noteId && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-muted)]">Rappels programmés</span>
            <Button variant="ghost" size="sm" onClick={() => setShowAddRappel(!showAddRappel)}>
              <Bell className="w-3 h-3 mr-1" /> Ajouter
            </Button>
          </div>

          {showAddRappel && echeanceDate && (
            <div className="flex gap-1 mb-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
              {presetRappels.map(p => (
                <Button 
                  key={p.delai} 
                  variant="secondary" 
                  size="sm"
                  onClick={() => addPresetRappel(p.delai)}
                  disabled={createRappelMutation.isPending}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {rappels?.map(rappel => (
              <div key={rappel.id} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg group">
                <div className="flex items-center gap-2">
                  {rappel.envoye ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Timer className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-sm">
                    {format(parseISO(rappel.date_rappel), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </span>
                  {rappel.delai_minutes && (
                    <Badge variant="gray" className="text-[10px]">
                      {rappel.delai_minutes === 60 ? '1h avant' : 
                       rappel.delai_minutes === 1440 ? '1j avant' : 
                       rappel.delai_minutes === 10080 ? '1sem avant' : `${rappel.delai_minutes}min`}
                    </Badge>
                  )}
                </div>
                <button 
                  onClick={() => deleteRappelMutation.mutate(rappel.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
                >
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            {(!rappels || rappels.length === 0) && (
              <div className="text-xs text-[var(--text-muted)] text-center py-2">Aucun rappel programmé</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT PARTAGE AVEC COLLEGUES
// ============================================
function PartageSection({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const [showAddPartage, setShowAddPartage] = useState(false);
  const [selectedTechnicien, setSelectedTechnicien] = useState('');
  const [permission, setPermission] = useState<'lecture' | 'edition'>('lecture');

  const { data: partages } = useQuery({
    queryKey: ['note-partages', noteId],
    queryFn: () => getNotesPartages(noteId),
  });

  const { data: techniciens } = useQuery({
    queryKey: ['techniciens'],
    queryFn: getTechniciens,
  });

  const addPartageMutation = useMutation({
    mutationFn: () => partagerNote(noteId, selectedTechnicien, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-partages', noteId] });
      toast.success('Note partagée');
      setShowAddPartage(false);
      setSelectedTechnicien('');
    },
  });

  const deletePartageMutation = useMutation({
    mutationFn: supprimerPartage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-partages', noteId] }),
  });

  // Filtrer les techniciens déjà partagés
  const techniciensDispo = techniciens?.filter(
    (t: any) => !partages?.some(p => p.technicien_id === t.id)
  );

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Partage</span>
          <Badge variant="gray" className="text-[10px]">{partages?.length || 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAddPartage(!showAddPartage)}>
          <UserPlus className="w-3 h-3 mr-1" /> Partager
        </Button>
      </div>

      {showAddPartage && (
        <div className="flex gap-2 mb-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <Select 
            value={selectedTechnicien} 
            onChange={e => setSelectedTechnicien(e.target.value)}
            className="flex-1"
          >
            <option value="">Choisir un collègue...</option>
            {techniciensDispo?.map((t: any) => (
              <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
            ))}
          </Select>
          <Select value={permission} onChange={e => setPermission(e.target.value as any)} className="w-28">
            <option value="lecture">Lecture</option>
            <option value="edition">Édition</option>
          </Select>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => addPartageMutation.mutate()}
            disabled={!selectedTechnicien || addPartageMutation.isPending}
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {partages?.map(partage => (
          <div key={partage.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
              {partage.technicien?.avatar_initiales || '?'}
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">{partage.technicien?.prenom} {partage.technicien?.nom}</span>
            </div>
            <Badge variant={partage.permission === 'edition' ? 'blue' : 'gray'} className="text-[10px]">
              {partage.permission === 'edition' ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {partage.permission}
            </Badge>
            <button 
              onClick={() => deletePartageMutation.mutate(partage.id)}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
            >
              <X className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}
        {(!partages || partages.length === 0) && (
          <div className="text-xs text-[var(--text-muted)] text-center py-2">Note non partagée</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT LIAISONS ENTRE NOTES
// ============================================
function LiaisonsSection({ noteId, allNotes }: { noteId: string; allNotes?: Note[] }) {
  const queryClient = useQueryClient();
  const [showAddLiaison, setShowAddLiaison] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');
  const [typeLiaison, setTypeLiaison] = useState<'reference' | 'suite' | 'associee'>('reference');

  const { data: liaisons } = useQuery({
    queryKey: ['note-liaisons', noteId],
    queryFn: () => getNotesLiees(noteId),
  });

  const addLiaisonMutation = useMutation({
    mutationFn: () => lierNotes(noteId, selectedNote, typeLiaison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-liaisons', noteId] });
      toast.success('Notes liées');
      setShowAddLiaison(false);
      setSelectedNote('');
    },
    onError: () => toast.error('Ces notes sont déjà liées'),
  });

  const deleteLiaisonMutation = useMutation({
    mutationFn: supprimerLiaison,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-liaisons', noteId] }),
  });

  // Filtrer les notes déjà liées et la note actuelle
  const notesDispo = allNotes?.filter(
    n => n.id !== noteId && !liaisons?.some(l => l.note_cible_id === n.id)
  );

  const getTypeLiaisonLabel = (type: string) => {
    switch (type) {
      case 'reference': return 'Référence';
      case 'suite': return 'Suite de';
      case 'associee': return 'Associée';
      default: return type;
    }
  };

  const getTypeLiaisonColor = (type: string) => {
    switch (type) {
      case 'reference': return '#3b82f6';
      case 'suite': return '#22c55e';
      case 'associee': return '#a855f7';
      default: return '#6b7280';
    }
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Notes liées</span>
          <Badge variant="gray" className="text-[10px]">{liaisons?.length || 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAddLiaison(!showAddLiaison)}>
          <Plus className="w-3 h-3 mr-1" /> Lier
        </Button>
      </div>

      {showAddLiaison && (
        <div className="flex gap-2 mb-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <Select 
            value={selectedNote} 
            onChange={e => setSelectedNote(e.target.value)}
            className="flex-1"
          >
            <option value="">Choisir une note...</option>
            {notesDispo?.map(n => (
              <option key={n.id} value={n.id}>{n.titre}</option>
            ))}
          </Select>
          <Select value={typeLiaison} onChange={e => setTypeLiaison(e.target.value as any)} className="w-28">
            <option value="reference">Référence</option>
            <option value="suite">Suite de</option>
            <option value="associee">Associée</option>
          </Select>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => addLiaisonMutation.mutate()}
            disabled={!selectedNote || addLiaisonMutation.isPending}
          >
            <Link2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {liaisons?.map(liaison => (
          <div key={liaison.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg group hover:bg-[var(--bg-elevated)] cursor-pointer">
            <div 
              className="w-1 h-8 rounded-full" 
              style={{ backgroundColor: liaison.note_cible?.couleur || '#6366f1' }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{liaison.note_cible?.titre}</span>
              <Badge 
                variant="gray" 
                className="text-[10px]"
                style={{ backgroundColor: `${getTypeLiaisonColor(liaison.type_liaison)}20`, color: getTypeLiaisonColor(liaison.type_liaison) }}
              >
                {getTypeLiaisonLabel(liaison.type_liaison)}
              </Badge>
            </div>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
            <button 
              onClick={(e) => { e.stopPropagation(); deleteLiaisonMutation.mutate(liaison.id); }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
            >
              <X className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}
        {(!liaisons || liaisons.length === 0) && (
          <div className="text-xs text-[var(--text-muted)] text-center py-2">Aucune note liée</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT EXPORT ET ACTIONS
// ============================================
function ExportActionsSection({ note }: { note: Note }) {
  const [showQR, setShowQR] = useState(false);
  
  const handleExportPDF = async () => {
    try {
      await downloadNotePDF(note);
      toast.success('PDF téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/notes/${note.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié');
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="w-4 h-4 text-[var(--text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Export & Partage</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleExportPDF}>
          <Download className="w-3 h-3 mr-1" /> PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={() => shareNoteByEmail(note)}>
          <Mail className="w-3 h-3 mr-1" /> Email
        </Button>
        <Button variant="secondary" size="sm" onClick={handleCopyLink}>
          <Copy className="w-3 h-3 mr-1" /> Lien
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowQR(!showQR)}>
          <QrCode className="w-3 h-3 mr-1" /> QR
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="w-3 h-3 mr-1" /> Imprimer
        </Button>
      </div>

      {showQR && (
        <div className="mt-3 p-4 bg-white rounded-lg flex flex-col items-center">
          <img 
            src={generateNoteQRCode(note.id)} 
            alt="QR Code" 
            className="w-32 h-32"
          />
          <p className="text-xs text-gray-500 mt-2">Scannez pour accéder à la note</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// MODAL FORMULAIRE NOTE
// ============================================
function NoteFormModal({ 
  note, 
  onClose, 
  onSave,
  defaultAscenseurId,
  hideAscenseurSelect,
  allNotes
}: { 
  note?: Note; 
  onClose: () => void; 
  onSave: (data: Partial<Note>) => void;
  defaultAscenseurId?: string;
  hideAscenseurSelect?: boolean;
  allNotes?: Note[];
}) {
  const [titre, setTitre] = useState(note?.titre || '');
  const [contenu, setContenu] = useState(note?.contenu || '');
  const [categorie, setCategorie] = useState<NoteCategorie>(note?.categorie || 'perso');
  const [couleur, setCouleur] = useState(note?.couleur || NOTE_COLORS[0]);
  const [priorite, setPriorite] = useState(note?.priorite || 'normale');
  const [statut, setStatut] = useState(note?.statut || 'active');
  const [partage, setPartage] = useState(note?.partage || false);
  const [dossierId, setDossierId] = useState(note?.dossier_id || '');
  const [ascenseurId, setAscenseurId] = useState(note?.ascenseur_id || defaultAscenseurId || '');
  const [rappelDate, setRappelDate] = useState(note?.rappel_date ? format(parseISO(note.rappel_date), "yyyy-MM-dd'T'HH:mm") : '');
  const [echeanceDate, setEcheanceDate] = useState((note as any)?.echeance_date ? format(parseISO((note as any).echeance_date), "yyyy-MM-dd'T'HH:mm") : '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note?.checklist || []);
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState<'contenu' | 'checklist' | 'options' | 'avance'>('contenu');

  const { data: dossiers } = useQuery({ queryKey: ['notes-dossiers'], queryFn: getNotesDossiers });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleSubmit = () => {
    if (!titre.trim()) { toast.error('Le titre est requis'); return; }
    onSave({
      titre,
      contenu,
      categorie,
      couleur,
      priorite,
      statut,
      partage,
      dossier_id: dossierId || null,
      ascenseur_id: ascenseurId || null,
      rappel_date: rappelDate || null,
      echeance_date: echeanceDate || null,
      rappel_envoye: false,
      checklist,
      tags,
      technicien_id: CURRENT_USER_ID,
    } as any);
  };

  const handleSendEmail = () => {
    if (note) {
      shareNoteByEmail(note);
    } else {
      const subject = encodeURIComponent(`Note: ${titre}`);
      const body = encodeURIComponent(`${titre}\n\n${contenu}\n\n---\nEnvoyé depuis AuvergneTech`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 rounded" style={{ background: couleur }} />
              <Input 
                value={titre} 
                onChange={e => setTitre(e.target.value)} 
                placeholder="Titre de la note..." 
                className="text-lg font-semibold border-0 bg-transparent p-0 focus:ring-0"
              />
            </div>
            <div className="flex items-center gap-2">
              {note && (
                <Button variant="ghost" size="sm" onClick={handleSendEmail}>
                  <Mail className="w-4 h-4" />
                </Button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Métadonnées rapides */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[var(--border-primary)]">
            <Select value={categorie} onChange={e => setCategorie(e.target.value as NoteCategorie)} className="w-32">
              {Object.entries(CATEGORIES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Select value={priorite} onChange={e => setPriorite(e.target.value)} className="w-28">
              {PRIORITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Select value={statut} onChange={e => setStatut(e.target.value)} className="w-28">
              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select value={dossierId} onChange={e => setDossierId(e.target.value)} className="w-36">
              <option value="">Sans dossier</option>
              {dossiers?.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </Select>
            {!hideAscenseurSelect && (
              <Select value={ascenseurId} onChange={e => setAscenseurId(e.target.value)} className="w-36">
                <option value="">Aucun ascenseur</option>
                {ascenseurs?.map(a => <option key={a.id} value={a.id}>{a.code} - {a.adresse?.substring(0, 20)}</option>)}
              </Select>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {[
              { id: 'contenu', label: 'Contenu', icon: FileText },
              { id: 'checklist', label: 'Checklist', icon: ListTodo },
              { id: 'options', label: 'Options', icon: Layers },
              ...(note ? [{ id: 'avance', label: 'Avancé', icon: CalendarClock }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                  activeTab === tab.id ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'contenu' && (
              <div>
                <div className="flex gap-1 mb-2">
                  <button onClick={() => setContenu(contenu + '**texte**')} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Gras">
                    <Bold className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <button onClick={() => setContenu(contenu + '*texte*')} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Italique">
                    <Italic className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <button onClick={() => setContenu(contenu + '\n- ')} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded" title="Liste">
                    <ListTodo className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>
                <textarea
                  value={contenu}
                  onChange={e => setContenu(e.target.value)}
                  placeholder="Contenu de la note..."
                  className="w-full h-48 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            {activeTab === 'checklist' && (
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            )}

            {activeTab === 'options' && (
              <div className="space-y-4">
                {/* Couleur */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-2 block">Couleur</label>
                  <div className="flex gap-2 flex-wrap">
                    {NOTE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCouleur(c)}
                        className={`w-7 h-7 rounded-lg transition-all ${couleur === c ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-105'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Rappel */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                    <Bell className="w-4 h-4" /> Rappel
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      value={rappelDate}
                      onChange={e => setRappelDate(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setRappelDate(format(addDays(new Date(), 1), "yyyy-MM-dd'T'09:00"))}>
                      Demain
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRappelDate(format(addDays(new Date(), 7), "yyyy-MM-dd'T'09:00"))}>
                      1 semaine
                    </Button>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-elevated)] rounded text-xs">
                        #{tag}
                        <button onClick={() => setTags(tags.filter(t => t !== tag))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Ajouter un tag..." className="flex-1" onKeyDown={e => e.key === 'Enter' && addTag()} />
                    <Button variant="ghost" size="sm" onClick={addTag}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Partage */}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-primary)]">Partager avec l'équipe</span>
                  </div>
                  <button onClick={() => setPartage(!partage)} className={`w-10 h-6 rounded-full transition-colors ${partage ? 'bg-purple-500' : 'bg-[var(--bg-elevated)]'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${partage ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'avance' && note && (
              <div className="space-y-0 overflow-y-auto max-h-[400px]">
                {/* Section Échéances et Rappels */}
                <EcheancesSection 
                  noteId={note.id}
                  echeanceDate={echeanceDate}
                  onEcheanceChange={setEcheanceDate}
                />
                
                {/* Section Partage */}
                <PartageSection noteId={note.id} />
                
                {/* Section Liaisons */}
                <LiaisonsSection noteId={note.id} allNotes={allNotes} />
                
                {/* Section Export */}
                <ExportActionsSection note={note} />
              </div>
            )}
          </div>

          {/* Sections additionnelles pour édition */}
          {note && (
            <>
              <AttachmentsSection noteId={note.id} />
              <CommentsSection noteId={note.id} />
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)] mt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit}>
              {note ? 'Enregistrer' : 'Créer la note'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// CARTE DE NOTE
// ============================================
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
  viewMode: 'grid' | 'list' | 'kanban';
}) {
  const categoryConfig = CATEGORIES_CONFIG[note.categorie];
  const prioriteConfig = PRIORITES.find(p => p.value === note.priorite);
  const checklistProgress = note.checklist?.length > 0 
    ? Math.round((note.checklist.filter((i: ChecklistItem) => i.fait).length / note.checklist.length) * 100) 
    : null;
  
  // Calculer le statut d'échéance
  const echeanceStatus = getEcheanceStatus((note as any).echeance_date);

  if (viewMode === 'list') {
    return (
      <div onClick={onEdit} className={`flex items-center gap-4 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-dark-500 transition-all cursor-pointer group ${note.epingle ? 'ring-1 ring-purple-500/30' : ''} ${echeanceStatus.status === 'depasse' ? 'border-red-500/50' : ''}`}>
        <div className="w-1 h-10 rounded-full" style={{ backgroundColor: note.couleur }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.epingle && <Pin className="w-3 h-3 text-purple-400" />}
            <span className="font-medium text-[var(--text-primary)] truncate">{note.titre}</span>
            {note.rappel_date && <Bell className="w-3 h-3 text-amber-400" />}
            {echeanceStatus.status !== 'none' && (
              <Badge 
                variant={echeanceStatus.status === 'depasse' ? 'red' : echeanceStatus.status === 'urgent' ? 'orange' : 'green'}
                className="text-[10px] flex items-center gap-1"
              >
                <Timer className="w-3 h-3" />
                {echeanceStatus.label}
              </Badge>
            )}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] truncate">{note.contenu?.substring(0, 80)}</div>
        </div>
        {note.ascenseur && <Badge variant="blue" className="text-[10px]">{note.ascenseur.code}</Badge>}
        {checklistProgress !== null && (
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${checklistProgress}%` }} /></div>
            <span className="text-[10px] text-[var(--text-muted)]">{checklistProgress}%</span>
          </div>
        )}
        <Badge variant="gray" style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color }} className="text-[10px]">{categoryConfig.label}</Badge>
        <span className="text-xs text-[var(--text-muted)]">{formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={e => { e.stopPropagation(); onTogglePin(); }} className="p-1 hover:bg-[var(--bg-elevated)] rounded">
            {note.epingle ? <PinOff className="w-4 h-4 text-purple-400" /> : <Pin className="w-4 h-4 text-[var(--text-tertiary)]" />}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-red-500/20 rounded">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  // Vue grille / kanban
  return (
    <div onClick={onEdit} className={`flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden hover:border-dark-500 transition-all cursor-pointer group ${note.epingle ? 'ring-1 ring-purple-500/30' : ''} ${echeanceStatus.status === 'depasse' ? 'border-red-500/50' : ''}`}>
      <div className="h-1" style={{ backgroundColor: note.couleur }} />
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {note.epingle && <Pin className="w-3 h-3 text-purple-400 flex-shrink-0" />}
            <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">{note.titre}</h3>
          </div>
          <div className="flex items-center gap-1">
            {echeanceStatus.status !== 'none' && (
              <Timer className={`w-3 h-3 ${echeanceStatus.status === 'depasse' ? 'text-red-400 animate-pulse' : echeanceStatus.status === 'urgent' ? 'text-orange-400' : 'text-green-400'}`} />
            )}
            {note.rappel_date && <Bell className="w-3 h-3 text-amber-400" />}
            {note.partage && <Share2 className="w-3 h-3 text-blue-400" />}
          </div>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] flex-1 line-clamp-2 mb-2">{note.contenu || 'Aucun contenu'}</p>
        
        {/* Indicateur échéance */}
        {echeanceStatus.status !== 'none' && (
          <div className={`text-[10px] mb-2 px-2 py-1 rounded ${
            echeanceStatus.status === 'depasse' ? 'bg-red-500/20 text-red-400' :
            echeanceStatus.status === 'urgent' ? 'bg-orange-500/20 text-orange-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            ⏰ {echeanceStatus.label}
          </div>
        )}
        
        {checklistProgress !== null && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${checklistProgress}%` }} /></div>
            <span className="text-[10px] text-[var(--text-muted)]">{checklistProgress}%</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Badge variant="gray" style={{ backgroundColor: `${categoryConfig.color}20`, color: categoryConfig.color }} className="text-[10px]">{categoryConfig.label}</Badge>
            {note.ascenseur && <Badge variant="blue" className="text-[10px]">{note.ascenseur.code}</Badge>}
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================
export function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [filterPriorite, setFilterPriorite] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'titre' | 'priorite'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);
  
  // Recherche avancée
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleAdvancedSearch = (results: SearchResult[]) => {
    setAdvancedSearchResults(results);
    setIsSearching(false);
  };

  const { data: notes, isLoading } = useQuery({ 
    queryKey: ['notes', CURRENT_USER_ID], 
    queryFn: () => getNotes(CURRENT_USER_ID) 
  });
  const { data: dossiers } = useQuery({ queryKey: ['notes-dossiers'], queryFn: getNotesDossiers });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes'] }); toast.success('Note créée'); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Note> }) => updateNote(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes'] }); toast.success('Note modifiée'); setEditNote(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes'] }); toast.success('Note supprimée'); },
  });
  const togglePinMutation = useMutation({
    mutationFn: ({ id, epingle }: { id: string; epingle: boolean }) => toggleNotePin(id, epingle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });
  const createDossierMutation = useMutation({
    mutationFn: createNoteDossier,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes-dossiers'] }); toast.success('Dossier créé'); setShowDossierModal(false); },
  });

  // Filtrage et tri
  const filteredNotes = useMemo(() => {
    let result = notes || [];
    
    if (search) result = result.filter(n => n.titre.toLowerCase().includes(search.toLowerCase()) || n.contenu?.toLowerCase().includes(search.toLowerCase()));
    if (filterCategorie !== 'all') result = result.filter(n => n.categorie === filterCategorie);
    if (filterPriorite !== 'all') result = result.filter(n => n.priorite === filterPriorite);
    if (filterStatut !== 'all') result = result.filter(n => n.statut === filterStatut);
    if (selectedDossier === 'sans-dossier') result = result.filter(n => !n.dossier_id);
    else if (selectedDossier) result = result.filter(n => n.dossier_id === selectedDossier);

    // Tri
    result = [...result].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'date') comp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sortBy === 'titre') comp = a.titre.localeCompare(b.titre);
      else if (sortBy === 'priorite') {
        const order = ['urgente', 'haute', 'normale', 'basse'];
        comp = order.indexOf(a.priorite || 'normale') - order.indexOf(b.priorite || 'normale');
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    // Épinglées en premier
    result = [...result.filter(n => n.epingle), ...result.filter(n => !n.epingle)];
    
    return result;
  }, [notes, search, filterCategorie, filterPriorite, filterStatut, selectedDossier, sortBy, sortOrder]);

  // Groupement Kanban par statut
  const kanbanGroups = useMemo(() => {
    return STATUTS.map(s => ({
      ...s,
      notes: filteredNotes.filter(n => n.statut === s.value),
    }));
  }, [filteredNotes]);

  // Notes à afficher (recherche avancée ou filtres simples)
  const displayedNotes = useMemo(() => {
    if (useAdvancedSearch && advancedSearchResults) {
      return advancedSearchResults.map(r => r.note);
    }
    return filteredNotes;
  }, [useAdvancedSearch, advancedSearchResults, filteredNotes]);

  // Groupement Kanban pour les notes affichées
  const displayedKanbanGroups = useMemo(() => {
    return STATUTS.map(s => ({
      ...s,
      notes: displayedNotes.filter(n => n.statut === s.value),
    }));
  }, [displayedNotes]);

  const handleSave = (data: Partial<Note>) => {
    if (editNote) updateMutation.mutate({ id: editNote.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Sidebar Dossiers */}
      <div className="w-56 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Dossiers</h3>
          <button onClick={() => setShowDossierModal(true)} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <Plus className="w-4 h-4 text-[var(--text-tertiary)]" />
          </button>
        </div>
        <Card className="flex-1 overflow-hidden">
          <CardBody className="p-2 h-full overflow-y-auto">
            <button onClick={() => setSelectedDossier(null)} className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 ${selectedDossier === null ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-[var(--bg-tertiary)]'}`}>
              <Folder className="w-4 h-4" />
              <span className="text-sm flex-1 text-left">Toutes</span>
              <Badge variant="purple" className="text-[10px]">{notes?.length || 0}</Badge>
            </button>
            <button onClick={() => setSelectedDossier('sans-dossier')} className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 ${selectedDossier === 'sans-dossier' ? 'bg-gray-500/20 text-gray-300' : 'hover:bg-[var(--bg-tertiary)]'}`}>
              <FileText className="w-4 h-4" />
              <span className="text-sm flex-1 text-left">Sans dossier</span>
            </button>
            <div className="border-t border-[var(--border-primary)] my-2" />
            {dossiers?.map(d => (
              <button key={d.id} onClick={() => setSelectedDossier(d.id)} className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 ${selectedDossier === d.id ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-tertiary)]'}`}>
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${d.couleur}30` }}>
                  <Folder className="w-3 h-3" style={{ color: d.couleur }} />
                </div>
                <span className="text-sm flex-1 text-left truncate">{d.nom}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{notes?.filter(n => n.dossier_id === d.id).length || 0}</span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle recherche avancée */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setUseAdvancedSearch(false); setAdvancedSearchResults(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !useAdvancedSearch ? 'bg-purple-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Recherche simple
            </button>
            <button
              onClick={() => setUseAdvancedSearch(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                useAdvancedSearch ? 'bg-purple-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Recherche avancée
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Vue */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-[var(--bg-elevated)]' : ''}`}><Grid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-[var(--bg-elevated)]' : ''}`}><List className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('kanban')} className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-[var(--bg-elevated)]' : ''}`}><Columns className="w-4 h-4" /></button>
            </div>
            <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nouvelle note</Button>
          </div>
        </div>

        {/* Recherche avancée */}
        {useAdvancedSearch ? (
          <div className="mb-4">
            <AdvancedNoteSearch 
              onSearch={handleAdvancedSearch}
              isSearching={isSearching}
            />
          </div>
        ) : (
          /* Header recherche simple */
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-56" />
              </div>
              <Select value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)} className="w-32">
                <option value="all">Catégorie</option>
                {Object.entries(CATEGORIES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
              <Select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)} className="w-28">
                <option value="all">Priorité</option>
                {PRIORITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
              <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-28">
                <option value="all">Statut</option>
                {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {/* Tri */}
              <Select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-28">
                <option value="date">Date</option>
                <option value="titre">Titre</option>
                <option value="priorite">Priorité</option>
              </Select>
              <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Contenu */}
        <div className="flex-1 overflow-auto">
          {/* Résumé résultats recherche avancée */}
          {useAdvancedSearch && advancedSearchResults && (
            <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-sm">
                <span className="font-semibold text-purple-400">{advancedSearchResults.length}</span> note(s) trouvée(s)
                {advancedSearchResults.length > 0 && advancedSearchResults[0].score > 0 && (
                  <span className="text-[var(--text-muted)]"> — triées par pertinence</span>
                )}
              </p>
            </div>
          )}

          {viewMode === 'kanban' ? (
            <div className="flex gap-4 h-full">
              {displayedKanbanGroups.map(group => (
                <div key={group.value} className="w-72 flex-shrink-0 flex flex-col">
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: `${group.color}20` }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
                    <span className="text-sm font-medium" style={{ color: group.color }}>{group.label}</span>
                    <Badge variant="gray" className="text-[10px] ml-auto">{group.notes.length}</Badge>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {group.notes.map(note => (
                      <NoteCard key={note.id} note={note} viewMode="kanban" onEdit={() => setEditNote(note)} onDelete={() => deleteMutation.mutate(note.id)} onTogglePin={() => togglePinMutation.mutate({ id: note.id, epingle: !note.epingle })} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
              {displayedNotes.map(note => (
                <NoteCard key={note.id} note={note} viewMode={viewMode} onEdit={() => setEditNote(note)} onDelete={() => deleteMutation.mutate(note.id)} onTogglePin={() => togglePinMutation.mutate({ id: note.id, epingle: !note.epingle })} />
              ))}
            </div>
          )}

          {displayedNotes.length === 0 && !isLoading && (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Aucune note</h3>
              <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Créer une note</Button>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      {(showForm || editNote) && (
        <NoteFormModal note={editNote || undefined} onClose={() => { setShowForm(false); setEditNote(null); }} onSave={handleSave} allNotes={notes} />
      )}

      {showDossierModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardBody>
              <h2 className="text-lg font-bold mb-4">Nouveau dossier</h2>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createDossierMutation.mutate({ nom: fd.get('nom') as string, couleur: '#6366f1' }); }}>
                <Input name="nom" placeholder="Nom du dossier" className="mb-4" required />
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={() => setShowDossierModal(false)} className="flex-1">Annuler</Button>
                  <Button variant="primary" type="submit" className="flex-1">Créer</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

// Export pour utilisation contextuelle
export { NoteFormModal };

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
  contextLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['context-notes', contextType, contextId],
    queryFn: () => getContextNotes(contextType, contextId),
  });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-notes', contextType, contextId] });
      toast.success('Note créée');
      setShowForm(false);
    },
  });

  const handleSave = (data: Partial<Note>) => {
    createMutation.mutate({
      ...data,
      [`${contextType}_id`]: contextId,
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <FileText className="w-4 h-4" />
          Notes {contextLabel && <span className="text-[var(--text-muted)]">({contextLabel})</span>}
          <Badge variant="gray" className="text-[10px]">{notes?.length || 0}</Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> Note
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-[var(--text-muted)] text-sm">Chargement...</div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note: any) => (
            <div key={note.id} className="flex items-start gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
              <div className="w-1 h-full rounded" style={{ backgroundColor: note.couleur || '#6366f1' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {note.epingle && <Pin className="w-3 h-3 text-purple-400" />}
                  <span className="font-medium text-sm text-[var(--text-primary)] truncate">{note.titre}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">{note.contenu}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                  <span>{note.technicien?.prenom}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-[var(--text-muted)] text-sm">Aucune note</div>
      )}

      {showForm && (
        <NoteFormModal
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          defaultAscenseurId={contextType === 'ascenseur' ? contextId : undefined}
          hideAscenseurSelect={contextType === 'mise_service' || contextType === 'travaux' || contextType === 'client'}
        />
      )}
    </div>
  );
}
