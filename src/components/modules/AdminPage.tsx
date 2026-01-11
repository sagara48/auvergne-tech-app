import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, Shield, MapPin, Settings, ChevronDown, ChevronUp,
  Check, X, Save, Loader2, UserCog, Building2, Search,
  RefreshCw, AlertTriangle
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// TYPES
// =============================================
interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  secteurs: number[];
}

interface Secteur {
  numero: number;
  nom: string;
  couleur: string;
}

// =============================================
// API FUNCTIONS
// =============================================
const getUsers = async (): Promise<UserProfile[]> => {
  // Récupérer les utilisateurs depuis auth.users via une fonction RPC ou une vue
  // Comme on n'a pas accès direct à auth.users, on utilise les profils
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .order('email');
  
  if (error) {
    console.warn('Erreur profiles:', error.message);
    // Fallback: essayer de récupérer via la session actuelle
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return [{
        id: user.id,
        email: user.email || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        secteurs: []
      }];
    }
    return [];
  }
  
  // Récupérer les secteurs pour chaque utilisateur
  const { data: userSecteurs } = await supabase
    .from('user_secteurs')
    .select('user_id, secteur');
  
  const secteursMap: Record<string, number[]> = {};
  (userSecteurs || []).forEach((us: any) => {
    if (!secteursMap[us.user_id]) {
      secteursMap[us.user_id] = [];
    }
    secteursMap[us.user_id].push(us.secteur);
  });
  
  return (profiles || []).map((p: any) => ({
    id: p.id,
    email: p.email || 'Sans email',
    created_at: p.created_at,
    last_sign_in_at: null,
    secteurs: secteursMap[p.id] || []
  }));
};

const getSecteurs = async (): Promise<Secteur[]> => {
  const { data, error } = await supabase
    .from('parc_secteurs')
    .select('numero, nom, couleur')
    .order('numero');
  
  if (error) {
    console.warn('Erreur secteurs:', error.message);
    return [];
  }
  return data || [];
};

const updateUserSecteurs = async (userId: string, secteurs: number[]) => {
  // Supprimer tous les secteurs existants
  await supabase
    .from('user_secteurs')
    .delete()
    .eq('user_id', userId);
  
  // Ajouter les nouveaux secteurs
  if (secteurs.length > 0) {
    const { error } = await supabase
      .from('user_secteurs')
      .insert(secteurs.map(s => ({ user_id: userId, secteur: s })));
    
    if (error) throw error;
  }
  
  return true;
};

// =============================================
// COMPOSANTS
// =============================================

// Carte utilisateur avec gestion des secteurs
function UserCard({ 
  user, 
  secteurs, 
  onSave 
}: { 
  user: UserProfile; 
  secteurs: Secteur[];
  onSave: (userId: string, secteurs: number[]) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSecteurs, setSelectedSecteurs] = useState<number[]>(user.secteurs);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const toggleSecteur = (numero: number) => {
    setSelectedSecteurs(prev => {
      const newSecteurs = prev.includes(numero)
        ? prev.filter(s => s !== numero)
        : [...prev, numero].sort((a, b) => a - b);
      
      // Vérifier si il y a des changements
      const originalSet = new Set(user.secteurs);
      const newSet = new Set(newSecteurs);
      const changed = originalSet.size !== newSet.size || 
        [...originalSet].some(s => !newSet.has(s));
      setHasChanges(changed);
      
      return newSecteurs;
    });
  };
  
  const selectAll = () => {
    const allSecteurs = secteurs.map(s => s.numero);
    setSelectedSecteurs(allSecteurs);
    setHasChanges(true);
  };
  
  const selectNone = () => {
    setSelectedSecteurs([]);
    setHasChanges(user.secteurs.length > 0);
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(user.id, selectedSecteurs);
      setHasChanges(false);
      toast.success('Secteurs mis à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };
  
  const getSecteurLabel = () => {
    if (selectedSecteurs.length === 0) {
      return <Badge variant="green">Tous les secteurs</Badge>;
    }
    if (selectedSecteurs.length === secteurs.length) {
      return <Badge variant="blue">Tous les secteurs (explicite)</Badge>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {selectedSecteurs.map(s => {
          const secteur = secteurs.find(sec => sec.numero === s);
          return (
            <Badge key={s} variant="gray" className="text-[10px]">
              {secteur?.nom || `Secteur ${s}`}
            </Badge>
          );
        })}
      </div>
    );
  };
  
  return (
    <Card className={hasChanges ? 'border-orange-500/50' : ''}>
      <CardBody className="p-0">
        {/* Header cliquable */}
        <div 
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-secondary)]"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-medium">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {getSecteurLabel()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="orange" className="animate-pulse">Non sauvegardé</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </div>
        </div>
        
        {/* Contenu étendu */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-[var(--border-primary)]">
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Secteurs autorisés
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={selectAll}>
                    Tous
                  </Button>
                  <Button size="sm" variant="secondary" onClick={selectNone}>
                    Aucun
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-[var(--text-muted)] mb-3">
                💡 Si aucun secteur n'est sélectionné, l'utilisateur a accès à tous les secteurs par défaut.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {secteurs.map(secteur => (
                  <button
                    key={secteur.numero}
                    onClick={() => toggleSecteur(secteur.numero)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedSecteurs.includes(secteur.numero)
                        ? 'bg-orange-500/20 border-orange-500 text-orange-500'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-orange-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        selectedSecteurs.includes(secteur.numero)
                          ? 'bg-orange-500 text-white'
                          : 'bg-[var(--bg-tertiary)]'
                      }`}>
                        {selectedSecteurs.includes(secteur.numero) && (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{secteur.nom}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Secteur {secteur.numero}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {hasChanges && (
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="primary" 
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers
  });
  
  const { data: secteurs, isLoading: loadingSecteurs } = useQuery({
    queryKey: ['admin-secteurs'],
    queryFn: getSecteurs
  });
  
  const handleSaveUserSecteurs = async (userId: string, newSecteurs: number[]) => {
    await updateUserSecteurs(userId, newSecteurs);
    await refetchUsers();
  };
  
  const filteredUsers = users?.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase())
  ) || [];
  
  const isLoading = loadingUsers || loadingSecteurs;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Administration</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Gestion des utilisateurs et des accès
              </p>
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => refetchUsers()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'users', label: 'Utilisateurs', icon: Users },
            { id: 'settings', label: 'Paramètres', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'users' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{users?.length || 0}</p>
                      <p className="text-xs text-[var(--text-muted)]">Utilisateurs</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{secteurs?.length || 0}</p>
                      <p className="text-xs text-[var(--text-muted)]">Secteurs</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <UserCog className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {users?.filter(u => u.secteurs.length > 0).length || 0}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">Avec restrictions</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Users list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <Card>
                <CardBody className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-50" />
                  <p className="text-[var(--text-muted)]">
                    {search ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur enregistré'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Assurez-vous que la table "profiles" existe et contient les utilisateurs.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    secteurs={secteurs || []}
                    onSave={handleSaveUserSecteurs}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {activeTab === 'settings' && (
          <Card>
            <CardBody className="p-6">
              <h2 className="text-lg font-semibold mb-4">Paramètres généraux</h2>
              <p className="text-[var(--text-muted)]">
                Les paramètres supplémentaires seront disponibles prochainement.
              </p>
              
              <div className="mt-6 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                <h3 className="text-sm font-medium mb-2">Légende des accès</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="green">Tous les secteurs</Badge>
                    <span className="text-[var(--text-muted)]">
                      L'utilisateur a accès à tous les secteurs (aucune restriction)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="gray">Secteur X</Badge>
                    <span className="text-[var(--text-muted)]">
                      L'utilisateur a accès uniquement aux secteurs listés
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
