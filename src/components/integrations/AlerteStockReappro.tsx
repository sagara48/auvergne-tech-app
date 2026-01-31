import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, Package, Bell, Check, X, ChevronRight, 
  Loader2, ShoppingCart, Plus, Minus, Send, RefreshCw
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Textarea, Select } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// TYPES
// =============================================
interface ArticleStockBas {
  id: string;
  vehicule_id: string;
  vehicule_immatriculation: string;
  technicien_nom?: string;
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
  seuil_alerte: number;
  quantite_recommandee?: number;
}

interface DemandeReappro {
  vehicule_id: string;
  vehicule_immatriculation: string;
  technicien_nom?: string;
  articles: {
    article_id: string;
    designation: string;
    reference?: string;
    quantite_actuelle: number;
    quantite_demandee: number;
  }[];
}

// =============================================
// API FUNCTIONS
// =============================================

// Récupérer tous les articles en stock bas (tous véhicules ou un seul)
async function getArticlesStockBas(vehiculeId?: string): Promise<ArticleStockBas[]> {
  let query = supabase
    .from('stock_vehicule')
    .select(`
      id,
      vehicule_id,
      article_id,
      quantite,
      seuil_alerte,
      quantite_recommandee,
      vehicule:vehicule_id(immatriculation, technicien:technicien_id(prenom, nom)),
      article:article_id(designation, reference)
    `);

  if (vehiculeId) {
    query = query.eq('vehicule_id', vehiculeId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Erreur récupération stock bas:', error);
    return [];
  }

  // Filtrer les articles en dessous du seuil
  return (data || [])
    .filter((s: any) => s.quantite <= (s.seuil_alerte || 3))
    .map((s: any) => ({
      id: s.id,
      vehicule_id: s.vehicule_id,
      vehicule_immatriculation: s.vehicule?.immatriculation || 'N/A',
      technicien_nom: s.vehicule?.technicien 
        ? `${s.vehicule.technicien.prenom} ${s.vehicule.technicien.nom}`.trim()
        : undefined,
      article_id: s.article_id,
      designation: s.article?.designation || 'Article inconnu',
      reference: s.article?.reference,
      quantite: s.quantite,
      seuil_alerte: s.seuil_alerte || 3,
      quantite_recommandee: s.quantite_recommandee || 5,
    }));
}

// Créer une demande de réapprovisionnement
async function creerDemandeReappro(demande: DemandeReappro): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  // Créer la demande principale
  const { data: newDemande, error } = await supabase
    .from('demandes')
    .insert({
      type: 'piece',
      priorite: 'normale',
      statut: 'en_attente',
      demandeur_id: user.id,
      titre: `Réappro. véhicule ${demande.vehicule_immatriculation}`,
      description: `Demande de réapprovisionnement automatique pour le véhicule ${demande.vehicule_immatriculation}${demande.technicien_nom ? ` (${demande.technicien_nom})` : ''}.\n\nArticles demandés:\n${
        demande.articles.map(a => `- ${a.designation}${a.reference ? ` (${a.reference})` : ''}: ${a.quantite_demandee} unité(s) (stock actuel: ${a.quantite_actuelle})`).join('\n')
      }`,
      metadata: {
        type_demande: 'reappro_vehicule',
        vehicule_id: demande.vehicule_id,
        vehicule_immatriculation: demande.vehicule_immatriculation,
        articles: demande.articles,
      },
    })
    .select()
    .single();

  if (error) throw error;

  // Créer une notification
  await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'stock',
    priority: 'normal',
    titre: 'Demande de réappro. créée',
    message: `Demande de réapprovisionnement créée pour ${demande.vehicule_immatriculation} (${demande.articles.length} article(s))`,
    lue: false,
    metadata: {
      demande_id: newDemande.id,
      vehicule_id: demande.vehicule_id,
    },
  });
}

// Créer automatiquement des demandes pour tous les véhicules avec stock bas
async function creerDemandesAutoReappro(): Promise<number> {
  const articlesStockBas = await getArticlesStockBas();
  
  if (articlesStockBas.length === 0) {
    return 0;
  }

  // Grouper par véhicule
  const parVehicule: Record<string, ArticleStockBas[]> = {};
  articlesStockBas.forEach(article => {
    if (!parVehicule[article.vehicule_id]) {
      parVehicule[article.vehicule_id] = [];
    }
    parVehicule[article.vehicule_id].push(article);
  });

  let demandesCreees = 0;

  // Créer une demande par véhicule
  for (const [vehiculeId, articles] of Object.entries(parVehicule)) {
    const firstArticle = articles[0];
    
    await creerDemandeReappro({
      vehicule_id: vehiculeId,
      vehicule_immatriculation: firstArticle.vehicule_immatriculation,
      technicien_nom: firstArticle.technicien_nom,
      articles: articles.map(a => ({
        article_id: a.article_id,
        designation: a.designation,
        reference: a.reference,
        quantite_actuelle: a.quantite,
        quantite_demandee: (a.quantite_recommandee || 5) - a.quantite,
      })),
    });
    
    demandesCreees++;
  }

  return demandesCreees;
}

// =============================================
// COMPOSANT ALERTE STOCK
// =============================================
interface AlerteStockProps {
  vehiculeId?: string; // Si fourni, affiche seulement ce véhicule
  showCreateButton?: boolean;
  compact?: boolean;
}

export function AlerteStock({ vehiculeId, showCreateButton = true, compact = false }: AlerteStockProps) {
  const queryClient = useQueryClient();
  const [selectedArticles, setSelectedArticles] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);

  // Récupérer les articles en stock bas
  const { data: articlesStockBas, isLoading, refetch } = useQuery({
    queryKey: ['articles-stock-bas', vehiculeId],
    queryFn: () => getArticlesStockBas(vehiculeId),
    refetchInterval: 60000, // Refresh toutes les minutes
  });

  // Mutation pour créer une demande
  const createDemandeMutation = useMutation({
    mutationFn: creerDemandeReappro,
    onSuccess: () => {
      toast.success('Demande de réapprovisionnement créée');
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      setShowModal(false);
      setSelectedArticles({});
    },
    onError: (error) => {
      toast.error('Erreur lors de la création de la demande');
      console.error(error);
    },
  });

  // Mutation pour créer toutes les demandes auto
  const createAllMutation = useMutation({
    mutationFn: creerDemandesAutoReappro,
    onSuccess: (count) => {
      toast.success(`${count} demande(s) de réapprovisionnement créée(s)`);
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      refetch();
    },
    onError: (error) => {
      toast.error('Erreur lors de la création des demandes');
      console.error(error);
    },
  });

  // Grouper par véhicule
  const articlesParVehicule = (articlesStockBas || []).reduce((acc, article) => {
    if (!acc[article.vehicule_id]) {
      acc[article.vehicule_id] = {
        vehicule_id: article.vehicule_id,
        immatriculation: article.vehicule_immatriculation,
        technicien_nom: article.technicien_nom,
        articles: [],
      };
    }
    acc[article.vehicule_id].articles.push(article);
    return acc;
  }, {} as Record<string, { vehicule_id: string; immatriculation: string; technicien_nom?: string; articles: ArticleStockBas[] }>);

  const vehicules = Object.values(articlesParVehicule);
  const totalAlerts = articlesStockBas?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (totalAlerts === 0) {
    return (
      <Card>
        <CardBody className="p-4 text-center">
          <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">Tous les stocks sont OK</p>
        </CardBody>
      </Card>
    );
  }

  // Version compacte (pour widget)
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {totalAlerts} alerte(s) stock
            </span>
          </div>
          {showCreateButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowModal(true)}
              className="text-amber-400"
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Commander
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {(articlesStockBas || []).slice(0, 3).map(article => (
            <div 
              key={article.id}
              className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg text-sm"
            >
              <span className="truncate text-[var(--text-primary)]">{article.designation}</span>
              <Badge variant="amber">{article.quantite}/{article.seuil_alerte}</Badge>
            </div>
          ))}
          {totalAlerts > 3 && (
            <p className="text-xs text-center text-[var(--text-muted)]">
              +{totalAlerts - 3} autres alertes
            </p>
          )}
        </div>
      </div>
    );
  }

  // Version complète
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Alertes stock ({totalAlerts})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {showCreateButton && vehicules.length > 1 && (
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => createAllMutation.mutate()}
              disabled={createAllMutation.isPending}
            >
              {createAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Créer toutes les demandes
            </Button>
          )}
        </div>
      </div>

      {/* Liste par véhicule */}
      <div className="space-y-3">
        {vehicules.map(vehicule => (
          <Card key={vehicule.vehicule_id} className="border-amber-500/30 bg-amber-500/5">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    🚐 {vehicule.immatriculation}
                  </p>
                  {vehicule.technicien_nom && (
                    <p className="text-xs text-[var(--text-muted)]">{vehicule.technicien_nom}</p>
                  )}
                </div>
                <Badge variant="amber">{vehicule.articles.length} alerte(s)</Badge>
              </div>

              <div className="space-y-2">
                {vehicule.articles.map(article => (
                  <div 
                    key={article.id}
                    className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-primary)] truncate">{article.designation}</p>
                      {article.reference && (
                        <p className="text-[10px] text-[var(--text-muted)]">{article.reference}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-400">{article.quantite}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">seuil: {article.seuil_alerte}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showCreateButton && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    const articles = vehicule.articles.reduce((acc, a) => {
                      acc[a.article_id] = (a.quantite_recommandee || 5) - a.quantite;
                      return acc;
                    }, {} as Record<string, number>);
                    setSelectedArticles(articles);
                    
                    createDemandeMutation.mutate({
                      vehicule_id: vehicule.vehicule_id,
                      vehicule_immatriculation: vehicule.immatriculation,
                      technicien_nom: vehicule.technicien_nom,
                      articles: vehicule.articles.map(a => ({
                        article_id: a.article_id,
                        designation: a.designation,
                        reference: a.reference,
                        quantite_actuelle: a.quantite,
                        quantite_demandee: (a.quantite_recommandee || 5) - a.quantite,
                      })),
                    });
                  }}
                  disabled={createDemandeMutation.isPending}
                >
                  {createDemandeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ShoppingCart className="w-4 h-4 mr-1" />
                  )}
                  Créer demande réappro.
                </Button>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =============================================
// WIDGET POUR DASHBOARD
// =============================================
export function AlerteStockWidget() {
  return (
    <Card>
      <CardBody className="p-4">
        <AlerteStock compact showCreateButton />
      </CardBody>
    </Card>
  );
}

// =============================================
// HOOK POUR VÉRIFICATION AUTOMATIQUE
// =============================================
export function useStockAlerts(vehiculeId?: string) {
  const { data: articlesStockBas, refetch } = useQuery({
    queryKey: ['articles-stock-bas', vehiculeId],
    queryFn: () => getArticlesStockBas(vehiculeId),
    refetchInterval: 300000, // Refresh toutes les 5 minutes
  });

  return {
    alertes: articlesStockBas || [],
    count: articlesStockBas?.length || 0,
    hasAlerts: (articlesStockBas?.length || 0) > 0,
    refetch,
  };
}

export default AlerteStock;
