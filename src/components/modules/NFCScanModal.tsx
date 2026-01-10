import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, FileText, StickyNote, Hammer, Package, Plus, 
  Building2, MapPin, Download, ExternalLink, Calendar,
  ChevronRight, Minus, AlertCircle, Check, Send
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getNfcTagByUid, createNfcScan, getDocumentsByAscenseur, 
  getTravauxByAscenseur, createDemande, getStockVehicule,
  createStockMouvement
} from '@/services/api';
import { nfcService, checkNFCSupport, NFCReadResult } from '@/services/nfcService';
import type { NfcTag, Ascenseur, Travaux } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const CURRENT_VEHICULE_ID = 'eeee1111-1111-1111-1111-111111111111';

interface NFCScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Résultat du scan avec fiche ascenseur
function AscenseurScannedView({
  tag,
  ascenseur,
  onClose
}: {
  tag: NfcTag;
  ascenseur: Ascenseur;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'docs' | 'notes' | 'travaux' | 'stock'>('docs');
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewDemande, setShowNewDemande] = useState(false);
  const [showSortieStock, setShowSortieStock] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents } = useQuery({
    queryKey: ['documents-ascenseur', ascenseur.id],
    queryFn: () => getDocumentsByAscenseur(ascenseur.id),
  });

  const { data: travaux } = useQuery({
    queryKey: ['travaux-ascenseur', ascenseur.id],
    queryFn: () => getTravauxByAscenseur(ascenseur.id),
  });

  const { data: stockVehicule } = useQuery({
    queryKey: ['stock-vehicule', CURRENT_VEHICULE_ID],
    queryFn: () => getStockVehicule(CURRENT_VEHICULE_ID),
  });

  const client = (ascenseur as any).client;

  return (
    <div className="space-y-4">
      {/* Header ascenseur */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
        <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-7 h-7 text-cyan-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-cyan-400">{ascenseur.code}</span>
            <Badge variant={ascenseur.statut === 'en_service' ? 'green' : 'amber'}>
              {ascenseur.statut === 'en_service' ? 'En service' : ascenseur.statut}
            </Badge>
          </div>
          <div className="text-[var(--text-primary)] font-medium">{client?.nom}</div>
          <div className="text-sm text-[var(--text-tertiary)]">{client?.adresse}</div>
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
            <span>{ascenseur.marque} {ascenseur.modele}</span>
            <span>•</span>
            <span>{ascenseur.type_ascenseur}</span>
            <span>•</span>
            <span>{ascenseur.nombre_niveaux} niveaux</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
        {[
          { id: 'docs', label: 'Documents', icon: FileText, count: documents?.length },
          { id: 'notes', label: 'Notes', icon: StickyNote },
          { id: 'travaux', label: 'Travaux', icon: Hammer, count: travaux?.length },
          { id: 'stock', label: 'Stock', icon: Package },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow' 
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge variant="cyan" className="text-xs">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Documents */}
      {activeTab === 'docs' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--text-primary)]">Documentation technique</h3>
          </div>
          {documents && documents.length > 0 ? (
            documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{doc.nom}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{doc.type_document}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-[var(--bg-hover)] rounded-lg">
                    <Download className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </button>
                  <button className="p-2 hover:bg-[var(--bg-hover)] rounded-lg">
                    <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun document disponible</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--text-primary)]">Notes sur cet ascenseur</h3>
            <Button variant="secondary" size="sm" onClick={() => setShowNewNote(true)}>
              <Plus className="w-4 h-4" /> Nouvelle note
            </Button>
          </div>
          <div className="text-center py-8 text-[var(--text-muted)]">
            <StickyNote className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucune note pour cet ascenseur</p>
          </div>
        </div>
      )}

      {/* Tab: Travaux */}
      {activeTab === 'travaux' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--text-primary)]">Travaux en cours</h3>
          </div>
          {travaux && travaux.length > 0 ? (
            travaux.map((t: Travaux) => (
              <div key={t.id} className="p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-purple-400">{t.code}</span>
                  <Badge variant={t.statut === 'en_cours' ? 'amber' : 'blue'}>
                    {t.statut === 'en_cours' ? 'En cours' : t.statut}
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{t.titre}</div>
                {t.date_butoir && (
                  <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mt-2">
                    <Calendar className="w-3 h-3" />
                    Échéance: {format(parseISO(t.date_butoir), 'd MMM yyyy', { locale: fr })}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Hammer className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun travaux en cours</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Stock véhicule */}
      {activeTab === 'stock' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-[var(--text-primary)]">Sortir une pièce du véhicule</h3>
          </div>
          {stockVehicule && stockVehicule.length > 0 ? (
            stockVehicule.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      {item.article?.designation}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {item.article?.reference} • {item.quantite} en stock
                    </div>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  disabled={item.quantite <= 0}
                  onClick={() => {
                    // TODO: Implémenter la sortie stock
                    toast.success(`1x ${item.article?.designation} sorti du stock`);
                  }}
                >
                  <Minus className="w-4 h-4" /> Sortir
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun stock dans le véhicule</p>
            </div>
          )}
        </div>
      )}

      {/* Actions rapides */}
      <div className="flex gap-2 pt-4 border-t border-[var(--border-secondary)]">
        <Button variant="secondary" className="flex-1" onClick={() => setShowNewNote(true)}>
          <StickyNote className="w-4 h-4" /> Note
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setShowNewDemande(true)}>
          <Send className="w-4 h-4" /> Demande
        </Button>
        <Button variant="primary" onClick={onClose}>
          Fermer
        </Button>
      </div>

      {/* Modal nouvelle demande */}
      {showNewDemande && (
        <NewDemandeModal
          ascenseur={ascenseur}
          onClose={() => setShowNewDemande(false)}
          onSuccess={() => {
            setShowNewDemande(false);
            toast.success('Demande envoyée');
          }}
        />
      )}
    </div>
  );
}

// Modal nouvelle demande
function NewDemandeModal({
  ascenseur,
  onClose,
  onSuccess
}: {
  ascenseur: Ascenseur;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<'piece' | 'aide'>('piece');
  const [objet, setObjet] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createDemande,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      onSuccess();
    },
    onError: () => {
      toast.error('Erreur lors de la création');
    },
  });

  const handleSubmit = () => {
    if (!objet.trim()) {
      toast.error('Veuillez saisir un objet');
      return;
    }
    createMutation.mutate({
      technicien_id: CURRENT_USER_ID,
      type_demande: type,
      objet: `[${ascenseur.code}] ${objet}`,
      description,
      priorite: 'normale',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Nouvelle demande</h3>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <span className="text-sm text-cyan-400">Pour: {ascenseur.code}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Type</label>
              <Select value={type} onChange={e => setType(e.target.value as any)}>
                <option value="piece">Demande de pièce</option>
                <option value="aide">Demande d'aide</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Objet *</label>
              <Input value={objet} onChange={e => setObjet(e.target.value)} placeholder="Ex: Besoin contacteur 40A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                placeholder="Détails..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Composant principal du scan
export function NFCScanModal({ isOpen, onClose }: NFCScanModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedTag, setScannedTag] = useState<NfcTag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualUid, setManualUid] = useState('');
  const queryClient = useQueryClient();

  const support = checkNFCSupport();

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setScannedTag(null);

    try {
      const mode = support.webNFC ? 'webnfc' : 'webusb';
      
      if (mode === 'webusb') {
        const connected = await nfcService.connectUSB();
        if (!connected) {
          setError('Impossible de se connecter au lecteur USB');
          setIsScanning(false);
          return;
        }
      }

      nfcService.setMode(mode);
      await nfcService.startReading(
        async (result: NFCReadResult) => {
          nfcService.stopReading();
          setIsScanning(false);
          
          // Chercher le tag en base
          const tag = await getNfcTagByUid(result.uid);
          if (tag) {
            setScannedTag(tag);
            // Enregistrer le scan
            await createNfcScan({
              tag_id: tag.id,
              technicien_id: CURRENT_USER_ID,
              action: 'consultation',
              metadata: { source: mode },
            });
            queryClient.invalidateQueries({ queryKey: ['nfc-scans'] });
          } else {
            setError(`Tag inconnu: ${result.uid}`);
          }
        },
        (err) => {
          setError(err.message);
          setIsScanning(false);
        }
      );
    } catch (err: any) {
      setError(err.message);
      setIsScanning(false);
    }
  };

  const searchManualUid = async () => {
    if (!manualUid.trim()) return;
    
    setError(null);
    const tag = await getNfcTagByUid(manualUid.trim());
    if (tag) {
      setScannedTag(tag);
      await createNfcScan({
        tag_id: tag.id,
        technicien_id: CURRENT_USER_ID,
        action: 'consultation',
        metadata: { source: 'manual' },
      });
    } else {
      setError(`Tag inconnu: ${manualUid}`);
    }
  };

  const stopScan = () => {
    nfcService.stopReading();
    setIsScanning(false);
  };

  const reset = () => {
    setScannedTag(null);
    setError(null);
    setManualUid('');
  };

  useEffect(() => {
    if (!isOpen) {
      nfcService.stopReading();
      setIsScanning(false);
      setScannedTag(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Building2 className="w-6 h-6 text-cyan-400" />
              Scanner un tag NFC
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Vue scan initial */}
          {!scannedTag && (
            <div className="space-y-4">
              {/* Zone de scan */}
              <div className="text-center py-8">
                <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-4 transition-all ${
                  isScanning 
                    ? 'bg-cyan-500/20 animate-pulse' 
                    : error 
                      ? 'bg-red-500/20' 
                      : 'bg-[var(--bg-tertiary)]'
                }`}>
                  {error ? (
                    <AlertCircle className="w-16 h-16 text-red-400" />
                  ) : (
                    <Building2 className={`w-16 h-16 ${isScanning ? 'text-cyan-400' : 'text-[var(--text-muted)]'}`} />
                  )}
                </div>

                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                  {isScanning ? 'Approchez le tag...' : error ? 'Erreur' : 'Prêt à scanner'}
                </h3>

                {error && (
                  <p className="text-sm text-red-400 mb-4">{error}</p>
                )}

                {(support.webNFC || support.webUSB) && (
                  <div className="mb-4">
                    {!isScanning ? (
                      <Button variant="primary" onClick={startScan}>
                        Démarrer le scan
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={stopScan}>
                        Annuler
                      </Button>
                    )}
                  </div>
                )}

                {!support.webNFC && !support.webUSB && (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                    <p className="text-sm text-amber-400">
                      NFC non disponible. Utilisez la saisie manuelle ci-dessous.
                    </p>
                  </div>
                )}
              </div>

              {/* Saisie manuelle */}
              <div className="border-t border-[var(--border-secondary)] pt-4">
                <p className="text-sm text-[var(--text-tertiary)] mb-2">Ou rechercher par UID :</p>
                <div className="flex gap-2">
                  <Input
                    value={manualUid}
                    onChange={e => setManualUid(e.target.value)}
                    placeholder="Ex: 04:A3:B2:C1:D4:E5:F6"
                    className="flex-1 font-mono"
                  />
                  <Button variant="secondary" onClick={searchManualUid}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Vue résultat: Ascenseur */}
          {scannedTag && scannedTag.type === 'ascenseur' && scannedTag.ascenseur && (
            <AscenseurScannedView
              tag={scannedTag}
              ascenseur={scannedTag.ascenseur}
              onClose={() => { reset(); onClose(); }}
            />
          )}

          {/* Vue résultat: Emplacement stock */}
          {scannedTag && scannedTag.type === 'emplacement' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400">{scannedTag.label || 'Emplacement'}</div>
                  <div className="text-[var(--text-primary)]">{scannedTag.emplacement}</div>
                </div>
              </div>

              <div className="text-center py-8 text-[var(--text-muted)]">
                <Package className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>Fonctionnalité inventaire à venir</p>
              </div>

              <Button variant="primary" className="w-full" onClick={() => { reset(); onClose(); }}>
                Fermer
              </Button>
            </div>
          )}

          {/* Bouton retour si tag scanné */}
          {scannedTag && (
            <button 
              onClick={reset}
              className="mt-4 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              ← Scanner un autre tag
            </button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
