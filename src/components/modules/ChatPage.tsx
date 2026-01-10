import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, Send, Hash, Users, Search, Plus, MoreVertical, 
  Paperclip, Image, Smile, AtSign, X, Check, Edit2, Trash2,
  ChevronDown, Bell, BellOff, Settings, User, Hammer, FileCheck
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input } from '@/components/ui';
import { 
  getChatChannels, getChatMessages, sendChatMessage, deleteChatMessage,
  getUnreadCounts, markChannelAsRead, getTechniciens
} from '@/services/api';
import { supabase } from '@/services/supabase';
import type { ChatChannel, ChatMessage, Technicien } from '@/types';
import { format, parseISO, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Formater la date du message
function formatMessageDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return `Hier ${format(date, 'HH:mm')}`;
  return format(date, 'd MMM HH:mm', { locale: fr });
}

// Composant Avatar
function Avatar({ user, size = 'md' }: { user?: Partial<Technicien>; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-[var(--text-primary)] flex-shrink-0`}>
      {user?.avatar_initiales || user?.prenom?.[0] || '?'}
    </div>
  );
}

// Composant Message
function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar,
  onDelete,
  techniciens
}: { 
  message: ChatMessage; 
  isOwn: boolean; 
  showAvatar: boolean;
  onDelete: () => void;
  techniciens: Technicien[];
}) {
  const [showMenu, setShowMenu] = useState(false);

  // Parser les mentions dans le contenu
  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const tech = techniciens.find(t => 
          t.prenom?.toLowerCase() === part.toLowerCase() ||
          `${t.prenom}${t.nom?.[0]}`.toLowerCase() === part.toLowerCase()
        );
        return (
          <span key={i} className="text-blue-400 font-semibold bg-blue-500/20 px-1 rounded">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
      {showAvatar ? (
        <Avatar user={message.sender} size="sm" />
      ) : (
        <div className="w-6" />
      )}
      
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showAvatar && !isOwn && (
          <div className="text-xs text-[var(--text-tertiary)] mb-1 ml-1">
            {message.sender?.prenom} {message.sender?.nom?.[0]}.
          </div>
        )}
        
        <div className="relative">
          <div
            className={`px-3 py-2 rounded-2xl ${
              isOwn 
                ? 'bg-purple-600 text-[var(--text-primary)] rounded-br-md' 
                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-md'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap break-words">
              {renderContent(message.content)}
            </div>
            {message.edited_at && (
              <span className="text-[10px] opacity-60 ml-1">(modifié)</span>
            )}
          </div>
          
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatMessageDate(message.created_at)}
            </span>
          </div>

          {/* Menu actions */}
          {isOwn && (
            <div className="absolute top-0 right-full mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-[var(--bg-elevated)] rounded"
              >
                <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg shadow-xl py-1 z-10 min-w-[120px]">
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--bg-elevated)] flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant Input Message avec mentions
function MessageInput({ 
  onSend, 
  techniciens,
  placeholder = "Écrire un message..."
}: { 
  onSend: (content: string, mentions: string[]) => void;
  techniciens: Technicien[];
  placeholder?: string;
}) {
  const [message, setMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTechs = useMemo(() => {
    if (!mentionSearch) return techniciens;
    return techniciens.filter(t => 
      t.prenom?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      t.nom?.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [techniciens, mentionSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, filteredTechs.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filteredTechs[mentionIndex]) {
        e.preventDefault();
        insertMention(filteredTechs[mentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Détecter @mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      if (spaceIndex === -1) {
        setShowMentions(true);
        setMentionSearch(afterAt);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (tech: Technicien) => {
    const lastAtIndex = message.lastIndexOf('@');
    const newMessage = message.substring(0, lastAtIndex) + `@${tech.prenom} `;
    setMessage(newMessage);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!message.trim()) return;
    
    // Extraire les mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      const tech = techniciens.find(t => 
        t.prenom?.toLowerCase() === match[1].toLowerCase()
      );
      if (tech) mentions.push(tech.id);
    }
    
    onSend(message.trim(), mentions);
    setMessage('');
  };

  return (
    <div className="relative">
      {/* Liste mentions */}
      {showMentions && filteredTechs.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filteredTechs.slice(0, 6).map((tech, i) => (
            <button
              key={tech.id}
              onClick={() => insertMention(tech)}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-elevated)] ${
                i === mentionIndex ? 'bg-[var(--bg-elevated)]' : ''
              }`}
            >
              <Avatar user={tech} size="sm" />
              <div className="text-left">
                <div className="text-sm text-[var(--text-primary)]">{tech.prenom} {tech.nom}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{tech.role?.nom}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl">
        <button className="p-1.5 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <Paperclip className="w-5 h-5" />
        </button>
        
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-dark-500 focus:outline-none"
        />
        
        <button 
          onClick={() => {
            setShowMentions(!showMentions);
            setMentionSearch('');
          }}
          className={`p-1.5 hover:bg-[var(--bg-elevated)] rounded-lg ${showMentions ? 'text-purple-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
        >
          <AtSign className="w-5 h-5" />
        </button>
        
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[var(--text-primary)] transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Composant Canal dans la sidebar
function ChannelItem({ 
  channel, 
  isActive, 
  unreadCount,
  onClick 
}: { 
  channel: ChatChannel; 
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive 
          ? 'bg-purple-500/20 text-purple-400' 
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="text-lg">{channel.icone}</span>
      <span className="flex-1 text-left text-sm font-medium truncate">{channel.nom}</span>
      {unreadCount > 0 && (
        <Badge variant="red" className="text-[10px] px-1.5 py-0">{unreadCount}</Badge>
      )}
    </button>
  );
}

// Page principale Chat
export function ChatPage() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: channels } = useQuery({ 
    queryKey: ['chat-channels'], 
    queryFn: getChatChannels 
  });
  
  const { data: techniciens } = useQuery({ 
    queryKey: ['techniciens'], 
    queryFn: getTechniciens 
  });

  const { data: unreadCounts } = useQuery({
    queryKey: ['chat-unread', CURRENT_USER_ID],
    queryFn: () => getUnreadCounts(CURRENT_USER_ID),
    refetchInterval: 30000, // Refresh toutes les 30s
  });

  const activeChannel = channels?.find(c => c.id === activeChannelId);

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['chat-messages', activeChannelId],
    queryFn: () => activeChannelId ? getChatMessages(activeChannelId) : Promise.resolve([]),
    enabled: !!activeChannelId,
  });

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (data: { content: string; mentions: string[] }) => 
      sendChatMessage({
        channel_id: activeChannelId!,
        sender_id: CURRENT_USER_ID,
        content: data.content,
        mentions: data.mentions,
        type: 'text',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChannelId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChannelId] });
      toast.success('Message supprimé');
    },
  });

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sélectionner le premier canal par défaut
  useEffect(() => {
    if (channels?.length && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Marquer comme lu
  useEffect(() => {
    if (activeChannelId && messages?.length) {
      const lastMessage = messages[messages.length - 1];
      markChannelAsRead(activeChannelId, CURRENT_USER_ID, lastMessage.id);
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
    }
  }, [activeChannelId, messages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`chat-${activeChannelId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `channel_id=eq.${activeChannelId}`
        },
        () => {
          refetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, refetchMessages]);

  const publicChannels = channels?.filter(c => c.type === 'public') || [];
  const directChannels = channels?.filter(c => c.type === 'direct') || [];
  
  const totalUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

  // Grouper les messages par date
  const groupedMessages = useMemo(() => {
    if (!messages) return [];
    
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';
    
    for (const msg of messages) {
      const msgDate = format(parseISO(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }
    
    return groups;
  }, [messages]);

  const formatDateSeparator = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return 'Hier';
    return format(date, 'd MMMM yyyy', { locale: fr });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <Card className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-400" />
                Messages
              </h2>
              {totalUnread > 0 && (
                <Badge variant="red">{totalUnread}</Badge>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Canaux */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Canaux publics */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-3 py-1 text-xs text-[var(--text-muted)] uppercase font-semibold">
                <Hash className="w-3 h-3" />
                Canaux
              </div>
              <div className="space-y-0.5">
                {publicChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={channel.id === activeChannelId}
                    unreadCount={unreadCounts?.[channel.id] || 0}
                    onClick={() => setActiveChannelId(channel.id)}
                  />
                ))}
              </div>
            </div>

            {/* Messages directs */}
            {directChannels.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-1 text-xs text-[var(--text-muted)] uppercase font-semibold">
                  <Users className="w-3 h-3" />
                  Messages directs
                </div>
                <div className="space-y-0.5">
                  {directChannels.map(channel => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={channel.id === activeChannelId}
                      unreadCount={unreadCounts?.[channel.id] || 0}
                      onClick={() => setActiveChannelId(channel.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border-primary)]">
            <div className="flex items-center gap-3">
              <Avatar user={techniciens?.find(t => t.id === CURRENT_USER_ID)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {techniciens?.find(t => t.id === CURRENT_USER_ID)?.prenom || 'Utilisateur'}
                </div>
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  En ligne
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Zone de chat principale */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {activeChannel ? (
          <>
            {/* Header du canal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activeChannel.icone}</span>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">{activeChannel.nom}</h3>
                  {activeChannel.description && (
                    <p className="text-xs text-[var(--text-tertiary)]">{activeChannel.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  <Search className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  <Bell className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {groupedMessages.map((group, groupIdx) => (
                <div key={group.date}>
                  {/* Séparateur de date */}
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-[var(--bg-elevated)]"></div>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {formatDateSeparator(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-[var(--bg-elevated)]"></div>
                  </div>

                  {/* Messages du jour */}
                  <div className="space-y-2">
                    {group.messages.map((msg, idx) => {
                      const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                      const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                      const isOwn = msg.sender_id === CURRENT_USER_ID;

                      return (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isOwn={isOwn}
                          showAvatar={showAvatar}
                          onDelete={() => deleteMutation.mutate(msg.id)}
                          techniciens={techniciens || []}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-[var(--border-primary)]">
              <MessageInput
                onSend={(content, mentions) => sendMutation.mutate({ content, mentions })}
                techniciens={techniciens || []}
                placeholder={`Message dans #${activeChannel.nom}...`}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Sélectionnez un canal pour commencer</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Composant Chat Contextuel (pour les modals Travaux/MES)
export function ContextChat({ 
  contextType, 
  contextId,
  contextLabel
}: { 
  contextType: 'travaux' | 'mise_service';
  contextId: string;
  contextLabel: string;
}) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, refetch } = useQuery({
    queryKey: ['context-messages', contextType, contextId],
    queryFn: async () => {
      const column = contextType === 'mise_service' ? 'mise_service_id' : `${contextType}_id`;
      const { data } = await supabase
        .from('chat_messages')
        .select('*, sender:techniciens(id, nom, prenom, avatar_initiales)')
        .eq(column, contextId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: techniciens } = useQuery({ 
    queryKey: ['techniciens'], 
    queryFn: getTechniciens 
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const data: any = {
        sender_id: CURRENT_USER_ID,
        content: message,
        type: 'text',
      };
      if (contextType === 'travaux') data.travaux_id = contextId;
      if (contextType === 'mise_service') data.mise_service_id = contextId;
      return sendChatMessage(data);
    },
    onSuccess: () => {
      setMessage('');
      refetch();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime
  useEffect(() => {
    const column = contextType === 'mise_service' ? 'mise_service_id' : `${contextType}_id`;
    const channel = supabase
      .channel(`context-${contextType}-${contextId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `${column}=eq.${contextId}`
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contextType, contextId, refetch]);

  return (
    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Discussion</span>
        <Badge variant="purple" className="text-[10px]">{messages?.length || 0}</Badge>
      </div>

      {/* Messages */}
      <div className="max-h-48 overflow-y-auto space-y-2 mb-3 p-3 bg-[var(--bg-tertiary)] rounded-xl">
        {messages?.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            Aucun message. Démarrez la discussion !
          </p>
        ) : (
          messages?.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.sender_id === CURRENT_USER_ID ? 'flex-row-reverse' : ''}`}>
              <Avatar user={msg.sender} size="sm" />
              <div className={`max-w-[80%] ${msg.sender_id === CURRENT_USER_ID ? 'text-right' : ''}`}>
                <div className="text-[10px] text-[var(--text-muted)] mb-0.5">
                  {msg.sender?.prenom} • {formatMessageDate(msg.created_at)}
                </div>
                <div className={`text-xs px-2 py-1 rounded-lg inline-block ${
                  msg.sender_id === CURRENT_USER_ID 
                    ? 'bg-purple-600 text-[var(--text-primary)]' 
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && message.trim() && sendMutation.mutate()}
          placeholder="Ajouter un commentaire..."
          className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-dark-500 focus:outline-none focus:border-purple-500"
        />
        <Button 
          variant="primary" 
          size="sm"
          onClick={() => message.trim() && sendMutation.mutate()}
          disabled={!message.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
