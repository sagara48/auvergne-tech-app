import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, Phone, MapPin, Building2, Calendar, Clock, AlertTriangle,
  FileText, Camera, CheckCircle, Wrench, History, Download,
  Navigation, ExternalLink, User, Shield, ChevronRight, Zap,
  Package, Plus, Minus, Search, Barcode, Trash2
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Textarea, Input } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface FicheAscenseurNFCProps {
  codeAppareil: string;
  onClose: () => void;
  onOpenHistorique?: (ascenseur: any) => void;
  onCreerTravaux?: (ascenseur: any, motif?: string) => void;
}

interface AscenseurComplet {
  id: string;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal: string;
  secteur: number;
  marque: string;
  modele: string;
  type_appareil: string;
  type_planning: string;
  nb_visites_an: number;
  en_arret: boolean;
  dernier_passage: string;
  localisation: string;
  tel_cabine: string;
  latitude?: number;
  longitude?: number;
}

interface DerniersEvenements {
  pannes: any[];
  visites: any[];
  travaux: any[];
}

interface DocumentLie {
  id: string;
  nom: string;
  categorie: string;
  url: string;
  created_at: string;
}

interface ArticleStock {
  id: string;
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
  categorie?: string;
}

interface PieceRemplacee {
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
  disponible: number;
}

// Récupérer l'ascenseur par code
async function getAscenseurByCode(codeAppareil: string): Promise<AscenseurComplet | null> {
  const { data, error } = await supabase
    .from('parc_ascenseurs')
    .select('*')
    .eq('code_appareil', codeAppareil)
    .maybeSingle();

  if (error) {
    console.error('Erreur récupération ascenseur:', error);
    return null;
  }

  return data;
}

// Récupérer les derniers événements
async function getDerniersEvenements(idWsoucont: number): Promise<DerniersEvenements> {
  const [pannesRes, visitesRes] = await Promise.all([
    supabase
      .from('parc_pannes')
      .select('*')
      .eq('id_wsoucont', idWsoucont)
      .order('date_appel', { ascending: false })
      .limit(5),
    supabase
      .from('planning_events')
      .select('*')
      .eq('type_event', 'tournee')
      .order('date_debut', { ascending: false })
      .limit(5),
  ]);

  return {
    pannes: pannesRes.data || [],
    visites: visitesRes.data || [],
    travaux: [],
  };
}

// Récupérer les documents liés
async function getDocumentsLies(codeAppareil: string): Promise<DocumentLie[]> {
  const { data } = await supabase
    .from('documents')
    .select('id, nom, categorie, fichier_url, created_at')
    .or(`tags.ilike.%${codeAppareil}%,nom.ilike.%${codeAppareil}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  return (data || []).map((d: any) => ({
    id: d.id,
    nom: d.nom,
    categorie: d.categorie,
    url: d.fichier_url,
    created_at: d.created_at,
  }));
}

// Récupérer le stock du véhicule du technicien connecté
async function getStockVehiculeTechnicien(): Promise<{ vehiculeId: string | null; articles: ArticleStock[] }> {
  try {
    // Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { vehiculeId: null, articles: [] };

    // Trouver le véhicule assigné au technicien
    const { data: vehicule } = await supabase
      .from('vehicules')
      .select('id')
      .eq('technicien_id', user.id)
      .maybeSingle();

    if (!vehicule) return { vehiculeId: null, articles: [] };

    // Récupérer le stock du véhicule
    const { data: stock } = await supabase
      .from('stock_vehicules')
      .select(`
        id,
        article_id,
        quantite,
        article:article_id(id, designation, reference, categorie:categorie_id(nom))
      `)
      .eq('vehicule_id', vehicule.id)
      .gt('quantite', 0)
      .order('article(designation)');

    const articles: ArticleStock[] = (stock || []).map((s: any) => ({
      id: s.id,
      article_id: s.article_id,
      designation: s.article?.designation || 'Article inconnu',
      reference: s.article?.reference,
      quantite: s.quantite,
      categorie: s.article?.categorie?.nom,
    }));

    return { vehiculeId: vehicule.id, articles };
  } catch (error) {
    console.error('Erreur récupération stock véhicule:', error);
    return { vehiculeId: null, articles: [] };
  }
}

// Enregistrer une visite/passage
async function enregistrerVisite(idWsoucont: number, technicienId: string, note?: string): Promise<void> {
  // Mettre à jour la date de dernier passage
  await supabase
    .from('parc_ascenseurs')
    .update({ dernier_passage: new Date().toISOString() })
    .eq('id_wsoucont', idWsoucont);

  // Créer un enregistrement de passage (optionnel si table existe)
  try {
    await supabase.from('parc_passages').insert({
      id_wsoucont: idWsoucont,
      technicien_id: technicienId,
      date_passage: new Date().toISOString(),
      note,
    });
  } catch {
    // Table peut ne pas exister
  }
}

// Signaler un problème
async function signalerProbleme(
  ascenseur: AscenseurComplet, 
  motif: string, 
  technicienId: string
): Promise<void> {
  await supabase.from('parc_arrets').insert({
    id_wsoucont: ascenseur.id_wsoucont,
    code_appareil: ascenseur.code_appareil,
    adresse: ascenseur.adresse,
    ville: ascenseur.ville,
    secteur: ascenseur.secteur,
    date_appel: new Date().toISOString(),
    heure_appel: format(new Date(), 'HH:mm'),
    motif,
    demandeur: 'Technicien terrain',
  });

  // Mettre l'ascenseur en arrêt
  await supabase
    .from('parc_ascenseurs')
    .update({ en_arret: true })
    .eq('id_wsoucont', ascenseur.id_wsoucont);
}

// Enregistrer les pièces remplacées
async function enregistrerPiecesRemplacees(
  ascenseur: AscenseurComplet,
  vehiculeId: string,
  pieces: PieceRemplacee[],
  note: string,
  technicienId: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Créer les mouvements de stock (sortie véhicule)
  for (const piece of pieces) {
    // Décrémenter le stock véhicule
    const { data: stockActuel } = await supabase
      .from('stock_vehicules')
      .select('quantite')
      .eq('vehicule_id', vehiculeId)
      .eq('article_id', piece.article_id)
      .single();

    if (stockActuel) {
      const nouvelleQuantite = Math.max(0, stockActuel.quantite - piece.quantite);
      await supabase
        .from('stock_vehicules')
        .update({ quantite: nouvelleQuantite, updated_at: now })
        .eq('vehicule_id', vehiculeId)
        .eq('article_id', piece.article_id);
    }

    // Créer le mouvement de stock
    await supabase.from('stock_mouvements').insert({
      article_id: piece.article_id,
      type_mouvement: 'sortie',
      quantite: piece.quantite,
      motif: `Remplacement sur ${ascenseur.code_appareil}`,
      reference_doc: ascenseur.code_appareil,
      vehicule_id: vehiculeId,
      technicien_id: technicienId,
      created_at: now,
    });
  }

  // 2. Créer un enregistrement d'intervention rapide
  const piecesListe = pieces.map(p => `${p.quantite}x ${p.designation}`).join(', ');
  
  await supabase.from('interventions_rapides').insert({
    code_appareil: ascenseur.code_appareil,
    id_wsoucont: ascenseur.id_wsoucont,
    adresse: ascenseur.adresse,
    ville: ascenseur.ville,
    secteur: ascenseur.secteur,
    date_intervention: now,
    type_intervention: 'remplacement_pieces',
    description: note || 'Remplacement de pièces',
    pieces_utilisees: piecesListe,
    pieces_detail: pieces,
    technicien_id: technicienId,
  }).catch(() => {
    // Table peut ne pas exister, on continue
  });

  // 3. Mettre à jour le dernier passage
  await supabase
    .from('parc_ascenseurs')
    .update({ dernier_passage: now })
    .eq('id_wsoucont', ascenseur.id_wsoucont);
}

export function FicheAscenseurNFC({ codeAppareil, onClose, onOpenHistorique, onCreerTravaux }: FicheAscenseurNFCProps) {
  const queryClient = useQueryClient();
  const [showSignalerModal, setShowSignalerModal] = useState(false);
  const [showValiderModal, setShowValiderModal] = useState(false);
  const [showPiecesModal, setShowPiecesModal] = useState(false);
  const [motifProbleme, setMotifProbleme] = useState('');
  const [noteVisite, setNoteVisite] = useState('');
  
  // État pour les pièces remplacées
  const [piecesRemplacees, setPiecesRemplacees] = useState<PieceRemplacee[]>([]);
  const [searchPiece, setSearchPiece] = useState('');
  const [notePieces, setNotePieces] = useState('');

  // Récupérer l'ascenseur
  const { data: ascenseur, isLoading: loadingAsc } = useQuery({
    queryKey: ['ascenseur-nfc', codeAppareil],
    queryFn: () => getAscenseurByCode(codeAppareil),
  });

  // Récupérer les derniers événements
  const { data: evenements } = useQuery({
    queryKey: ['evenements-ascenseur', ascenseur?.id_wsoucont],
    queryFn: () => getDerniersEvenements(ascenseur!.id_wsoucont),
    enabled: !!ascenseur?.id_wsoucont,
  });

  // Récupérer les documents
  const { data: documents } = useQuery({
    queryKey: ['documents-ascenseur', codeAppareil],
    queryFn: () => getDocumentsLies(codeAppareil),
  });

  // Récupérer le stock du véhicule
  const { data: stockVehicule } = useQuery({
    queryKey: ['stock-vehicule-technicien'],
    queryFn: getStockVehiculeTechnicien,
  });

  // Filtrer les articles par recherche
  const articlesFiltres = stockVehicule?.articles.filter(a => 
    !searchPiece || 
    a.designation.toLowerCase().includes(searchPiece.toLowerCase()) ||
    a.reference?.toLowerCase().includes(searchPiece.toLowerCase())
  ) || [];

  // Mutation signaler problème
  const signalerMutation = useMutation({
    mutationFn: async () => {
      if (!ascenseur) throw new Error('Ascenseur non trouvé');
      const { data: { user } } = await supabase.auth.getUser();
      await signalerProbleme(ascenseur, motifProbleme, user?.id || '');
    },
    onSuccess: () => {
      toast.success('Problème signalé');
      setShowSignalerModal(false);
      setMotifProbleme('');
      queryClient.invalidateQueries({ queryKey: ['ascenseur-nfc'] });
    },
    onError: () => toast.error('Erreur lors du signalement'),
  });

  // Mutation valider visite
  const validerMutation = useMutation({
    mutationFn: async () => {
      if (!ascenseur) throw new Error('Ascenseur non trouvé');
      const { data: { user } } = await supabase.auth.getUser();
      await enregistrerVisite(ascenseur.id_wsoucont, user?.id || '', noteVisite);
    },
    onSuccess: () => {
      toast.success('Visite enregistrée');
      setShowValiderModal(false);
      setNoteVisite('');
      queryClient.invalidateQueries({ queryKey: ['ascenseur-nfc'] });
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  // Mutation enregistrer pièces
  const piecesMutation = useMutation({
    mutationFn: async () => {
      if (!ascenseur) throw new Error('Ascenseur non trouvé');
      if (!stockVehicule?.vehiculeId) throw new Error('Véhicule non trouvé');
      if (piecesRemplacees.length === 0) throw new Error('Aucune pièce sélectionnée');
      
      const { data: { user } } = await supabase.auth.getUser();
      await enregistrerPiecesRemplacees(
        ascenseur, 
        stockVehicule.vehiculeId, 
        piecesRemplacees, 
        notePieces,
        user?.id || ''
      );
    },
    onSuccess: () => {
      toast.success(`${piecesRemplacees.length} pièce(s) enregistrée(s)`);
      setShowPiecesModal(false);
      setPiecesRemplacees([]);
      setNotePieces('');
      setSearchPiece('');
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule-technicien'] });
      queryClient.invalidateQueries({ queryKey: ['ascenseur-nfc'] });
    },
    onError: (error: any) => toast.error(error.message || 'Erreur lors de l\'enregistrement'),
  });

  // Ajouter une pièce à la liste
  const ajouterPiece = (article: ArticleStock) => {
    const exists = piecesRemplacees.find(p => p.article_id === article.article_id);
    if (exists) {
      // Incrémenter la quantité
      setPiecesRemplacees(prev => prev.map(p => 
        p.article_id === article.article_id 
          ? { ...p, quantite: Math.min(p.quantite + 1, p.disponible) }
          : p
      ));
    } else {
      // Ajouter nouvelle pièce
      setPiecesRemplacees(prev => [...prev, {
        article_id: article.article_id,
        designation: article.designation,
        reference: article.reference,
        quantite: 1,
        disponible: article.quantite,
      }]);
    }
  };

  // Modifier la quantité d'une pièce
  const modifierQuantite = (articleId: string, delta: number) => {
    setPiecesRemplacees(prev => prev.map(p => {
      if (p.article_id === articleId) {
        const newQty = Math.max(1, Math.min(p.quantite + delta, p.disponible));
        return { ...p, quantite: newQty };
      }
      return p;
    }));
  };

  // Retirer une pièce
  const retirerPiece = (articleId: string) => {
    setPiecesRemplacees(prev => prev.filter(p => p.article_id !== articleId));
  };

  // Calculs
  const joursSinceVisite = ascenseur?.dernier_passage 
    ? differenceInDays(new Date(), parseISO(ascenseur.dernier_passage))
    : null;

  const joursEntreVisites = ascenseur?.nb_visites_an 
    ? Math.round(365 / ascenseur.nb_visites_an)
    : 30;

  const prochaineVisite = ascenseur?.dernier_passage && ascenseur?.nb_visites_an
    ? new Date(parseISO(ascenseur.dernier_passage).getTime() + joursEntreVisites * 24 * 60 * 60 * 1000)
    : null;

  const visiteDue = joursSinceVisite !== null && joursSinceVisite >= joursEntreVisites;

  // Ouvrir navigation
  const ouvrirNavigation = () => {
    if (!ascenseur) return;
    const adresse = encodeURIComponent(`${ascenseur.adresse}, ${ascenseur.code_postal} ${ascenseur.ville}, France`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${adresse}`, '_blank');
  };

  // Appeler cabine
  const appelerCabine = () => {
    if (!ascenseur?.tel_cabine) return;
    window.location.href = `tel:${ascenseur.tel_cabine}`;
  };

  if (loadingAsc) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-[var(--text-muted)] mt-4">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!ascenseur) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Ascenseur non trouvé</h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Le code <strong>{codeAppareil}</strong> n'existe pas dans le parc
          </p>
          <Button variant="secondary" className="mt-6" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                ascenseur.en_arret ? 'bg-red-500/20' : 'bg-lime-500/20'
              }`}>
                <Building2 className={`w-6 h-6 ${ascenseur.en_arret ? 'text-red-400' : 'text-lime-400'}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{ascenseur.code_appareil}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{ascenseur.adresse}</p>
                <p className="text-xs text-[var(--text-muted)]">{ascenseur.code_postal} {ascenseur.ville}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Badges status */}
          <div className="flex flex-wrap gap-2 mt-3">
            {ascenseur.en_arret ? (
              <Badge variant="red" className="animate-pulse">🔴 En arrêt</Badge>
            ) : (
              <Badge variant="green">🟢 En service</Badge>
            )}
            {ascenseur.type_planning && (
              <Badge variant="blue">{ascenseur.type_planning}</Badge>
            )}
            <Badge variant="purple">Secteur {ascenseur.secteur}</Badge>
            {ascenseur.nb_visites_an && (
              <Badge variant="gray">{ascenseur.nb_visites_an} vis/an</Badge>
            )}
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Téléphone cabine */}
          {ascenseur.tel_cabine && (
            <button 
              onClick={appelerCabine}
              className="w-full p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between hover:bg-blue-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Téléphone cabine</p>
                  <p className="text-xs text-blue-400">{ascenseur.tel_cabine}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-400" />
            </button>
          )}

          {/* Dernière visite */}
          <Card className={visiteDue ? 'border-orange-500/50' : ''}>
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className={`w-5 h-5 ${visiteDue ? 'text-orange-400' : 'text-[var(--text-muted)]'}`} />
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Dernière visite</p>
                    <p className="text-sm font-medium">
                      {ascenseur.dernier_passage 
                        ? format(parseISO(ascenseur.dernier_passage), 'd MMM yyyy', { locale: fr })
                        : 'Jamais'
                      }
                      {joursSinceVisite !== null && (
                        <span className={`ml-2 text-xs ${visiteDue ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
                          ({joursSinceVisite}j)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {prochaineVisite && (
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">Prochaine</p>
                    <p className="text-xs font-medium">
                      {format(prochaineVisite, 'd MMM', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>
              {visiteDue && (
                <div className="mt-2 p-2 bg-orange-500/10 rounded-lg">
                  <p className="text-xs text-orange-400">⚠️ Visite à effectuer</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Historique récent */}
          {evenements && (evenements.pannes.length > 0) && (
            <Card>
              <CardBody className="p-3">
                <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Événements récents
                </h4>
                <div className="space-y-2">
                  {evenements.pannes.slice(0, 3).map((panne: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                      <Badge variant={panne.etat === 'resolu' ? 'green' : 'red'} className="text-[10px]">
                        {panne.etat === 'resolu' ? '✓' : '●'} Panne
                      </Badge>
                      <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">
                        {panne.motif || panne.cause}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {format(parseISO(panne.date_appel), 'd/MM', { locale: fr })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Documents */}
          {documents && documents.length > 0 && (
            <Card>
              <CardBody className="p-3">
                <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </h4>
                <div className="space-y-1">
                  {documents.slice(0, 4).map(doc => (
                    <a 
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <span className="text-xs text-[var(--text-secondary)] truncate">{doc.nom}</span>
                      </div>
                      <Download className="w-4 h-4 text-[var(--text-muted)]" />
                    </a>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Infos techniques */}
          <Card>
            <CardBody className="p-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Informations techniques
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-[var(--text-muted)]">Marque</p>
                  <p className="font-medium">{ascenseur.marque || '-'}</p>
                </div>
                <div className="p-2 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-[var(--text-muted)]">Type</p>
                  <p className="font-medium">{ascenseur.type_appareil || '-'}</p>
                </div>
                <div className="p-2 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-[var(--text-muted)]">Modèle</p>
                  <p className="font-medium">{ascenseur.modele || '-'}</p>
                </div>
                <div className="p-2 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-[var(--text-muted)]">Localisation</p>
                  <p className="font-medium">{ascenseur.localisation || '-'}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--border-primary)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={ouvrirNavigation}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Itinéraire
            </Button>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => onOpenHistorique?.(ascenseur)}
            >
              <History className="w-4 h-4 mr-2" />
              Historique
            </Button>
          </div>

          {/* Bouton Pièces remplacées */}
          <Button 
            variant="secondary" 
            className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            onClick={() => setShowPiecesModal(true)}
          >
            <Package className="w-4 h-4 mr-2" />
            Signaler remplacement pièces
          </Button>

          <Button 
            variant="primary" 
            className="w-full bg-red-500 hover:bg-red-600"
            onClick={() => setShowSignalerModal(true)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Signaler un problème
          </Button>

          <Button 
            variant="primary" 
            className="w-full"
            onClick={() => setShowValiderModal(true)}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Valider ma visite
          </Button>

          {onCreerTravaux && (
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => onCreerTravaux(ascenseur)}
            >
              <Wrench className="w-4 h-4 mr-2" />
              Créer intervention
            </Button>
          )}
        </div>

        {/* Modal Signaler problème */}
        {showSignalerModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
            <div className="bg-[var(--bg-primary)] rounded-xl p-4 w-full max-w-sm">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                🚨 Signaler un problème
              </h3>
              <Textarea
                value={motifProbleme}
                onChange={e => setMotifProbleme(e.target.value)}
                placeholder="Décrivez le problème..."
                rows={4}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowSignalerModal(false)}>
                  Annuler
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  onClick={() => signalerMutation.mutate()}
                  disabled={!motifProbleme.trim() || signalerMutation.isPending}
                >
                  Signaler
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Valider visite */}
        {showValiderModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
            <div className="bg-[var(--bg-primary)] rounded-xl p-4 w-full max-w-sm">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                ✅ Valider ma visite
              </h3>
              <Textarea
                value={noteVisite}
                onChange={e => setNoteVisite(e.target.value)}
                placeholder="Note optionnelle (ex: RAS, graissage effectué...)"
                rows={3}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowValiderModal(false)}>
                  Annuler
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={() => validerMutation.mutate()}
                  disabled={validerMutation.isPending}
                >
                  Valider
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pièces remplacées */}
        {showPiecesModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
            <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    Pièces remplacées
                  </h3>
                  <button onClick={() => setShowPiecesModal(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Sélectionnez les pièces depuis votre stock véhicule
                </p>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Pièces sélectionnées */}
                {piecesRemplacees.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)]">
                      Pièces à enregistrer ({piecesRemplacees.length})
                    </h4>
                    {piecesRemplacees.map(piece => (
                      <div key={piece.article_id} className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{piece.designation}</p>
                          {piece.reference && (
                            <p className="text-[10px] text-[var(--text-muted)]">{piece.reference}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => modifierQuantite(piece.article_id, -1)}
                            className="w-6 h-6 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{piece.quantite}</span>
                          <button
                            onClick={() => modifierQuantite(piece.article_id, 1)}
                            className="w-6 h-6 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                            disabled={piece.quantite >= piece.disponible}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => retirerPiece(piece.article_id)}
                            className="w-6 h-6 rounded bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center ml-1"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recherche */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <Input
                    value={searchPiece}
                    onChange={e => setSearchPiece(e.target.value)}
                    placeholder="Rechercher une pièce..."
                    className="pl-9"
                  />
                </div>

                {/* Liste du stock véhicule */}
                {!stockVehicule?.vehiculeId ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-muted)]">Aucun véhicule assigné</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Contactez votre responsable</p>
                  </div>
                ) : articlesFiltres.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-[var(--text-muted)]">
                      {searchPiece ? 'Aucun résultat' : 'Stock véhicule vide'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)]">
                      Stock véhicule ({articlesFiltres.length})
                    </h4>
                    {articlesFiltres.slice(0, 20).map(article => {
                      const dejaAjoute = piecesRemplacees.find(p => p.article_id === article.article_id);
                      return (
                        <button
                          key={article.id}
                          onClick={() => ajouterPiece(article)}
                          disabled={dejaAjoute && dejaAjoute.quantite >= article.quantite}
                          className={`w-full text-left p-2 rounded-lg border transition-colors ${
                            dejaAjoute 
                              ? 'bg-purple-500/5 border-purple-500/30' 
                              : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-purple-500/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-[var(--text-primary)] truncate">{article.designation}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {article.reference && (
                                  <span className="text-[10px] text-[var(--text-muted)]">{article.reference}</span>
                                )}
                                {article.categorie && (
                                  <Badge variant="gray" className="text-[8px]">{article.categorie}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={article.quantite > 2 ? 'green' : article.quantite > 0 ? 'orange' : 'red'} className="text-[10px]">
                                {article.quantite} dispo
                              </Badge>
                              <Plus className={`w-4 h-4 ${dejaAjoute ? 'text-purple-400' : 'text-[var(--text-muted)]'}`} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Note */}
                {piecesRemplacees.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">
                      Note (optionnel)
                    </label>
                    <Textarea
                      value={notePieces}
                      onChange={e => setNotePieces(e.target.value)}
                      placeholder="Ex: Remplacement suite usure normale..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border-primary)] flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => {
                  setShowPiecesModal(false);
                  setPiecesRemplacees([]);
                  setSearchPiece('');
                  setNotePieces('');
                }}>
                  Annuler
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={() => piecesMutation.mutate()}
                  disabled={piecesRemplacees.length === 0 || piecesMutation.isPending}
                >
                  {piecesMutation.isPending ? (
                    <span className="animate-spin mr-2">⏳</span>
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer ({piecesRemplacees.length})
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

