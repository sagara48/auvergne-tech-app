import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Nfc, Plus, Search, Smartphone, Usb, Radio, Building2, Package, Box,
  Check, X, Edit, Trash2, History, AlertTriangle, Wifi, WifiOff,
  RefreshCw, Tag, ScanLine, Link2, Link2Off
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import {
  getNFCTags, getNFCScans, getNFCStats, createNFCTag, updateNFCTag, deleteNFCTag,
  getAscenseurs, getStockArticles, getVehicules, getNFCTagByUID
} from '@/services/api';
import { useNFC } from '@/hooks/useNFC';
import type { NFCTag, TypeTagNFC } from '@/types';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const TYPE_CONFIG: Record<TypeTagNFC, { label: string; icon: any; color: string; bgColor: string }> = {
  ascenseur: { label: 'Ascenseur', icon: Building2, color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  emplacement: { label: 'Emplacement', icon: Box, color: '#f59e0b', bgColor: 'bg-amber-500/20' },
  article: { label: 'Article', icon: Package, color: '#8b5cf6', bgColor: 'bg-purple-500/20' },
};

function EncodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const nfc = useNFC();
  const [step, setStep] = useState<'config' | 'scan' | 'success'>('config');
  const [type, setType] = useState<TypeTagNFC>('ascenseur');
  const [selectedId, setSelectedId] = useState('');
  const [label, setLabel] = useState('');
  const [emplacementCode, setEmplacementCode] = useState('');
  const [emplacementDesc, setEmplacementDesc] = useState('');
  const [vehiculeId, setVehiculeId] = useState('');
  const [scannedUID, setScannedUID] = useState('');

  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });
  const { data: articles } = useQuery({ queryKey: ['stock'], queryFn: getStockArticles });
  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: getVehicules });

  const createMutation = useMutation({
    mutationFn: (tag: Partial<NFCTag>) => createNFCTag(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
      queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
      toast.success('Tag NFC encodé avec succès');
      setStep('success');
      onSuccess();
    },
    onError: () => toast.error("Erreur lors de l'encodage"),
  });

  const handleStartScan = async () => {
    setStep('scan');
    try {
      await nfc.startReading((uid) => {
        setScannedUID(uid);
        nfc.stopReading();
        
        const tagData: Partial<NFCTag> = { uid, type, label: label || getDefaultLabel(), actif: true };
        if (type === 'ascenseur' && selectedId) tagData.ascenseur_id = selectedId;
        else if (type === 'article' && selectedId) tagData.article_id = selectedId;
        else if (type === 'emplacement') {
          tagData.emplacement_code = emplacementCode;
          tagData.emplacement_description = emplacementDesc;
          if (vehiculeId) tagData.vehicule_id = vehiculeId;
        }
        createMutation.mutate(tagData);
      });
    } catch (error: any) {
      toast.error(error.message);
      setStep('config');
    }
  };

  const getDefaultLabel = () => {
    if (type === 'ascenseur' && selectedId) {
      const asc = ascenseurs?.find(a => a.id === selectedId);
      return asc ? `Tag ${asc.code}` : 'Tag Ascenseur';
    }
    if (type === 'article' && selectedId) {
      const art = articles?.find(a => a.id === selectedId);
      return art ? `Tag ${art.reference}` : 'Tag Article';
    }
    if (type === 'emplacement') return emplacementCode ? `Emplacement ${emplacementCode}` : 'Tag Emplacement';
    return 'Nouveau Tag';
  };

  const canProceed = () => {
    if (type === 'ascenseur') return !!selectedId;
    if (type === 'article') return !!selectedId;
    if (type === 'emplacement') return !!emplacementCode;
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Nfc className="w-6 h-6 text-cyan-400" />
              Encoder un tag NFC
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="flex items-center gap-2">
              <Smartphone className={`w-5 h-5 ${nfc.capabilities.webNFC ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-sm text-[var(--text-secondary)]">Mobile {nfc.capabilities.webNFC ? '✓' : '✗'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Usb className={`w-5 h-5 ${nfc.capabilities.webUSB ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-sm text-[var(--text-secondary)]">USB {nfc.capabilities.webUSB ? '✓' : '✗'}</span>
            </div>
            {nfc.isUSBConnected && <Badge variant="green" className="ml-auto">USB connecté</Badge>}
          </div>

          {step === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Type de tag</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => { setType(key as TypeTagNFC); setSelectedId(''); }}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          type === key ? 'border-cyan-500 bg-cyan-500/10' : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: config.color }} />
                        <span className="text-xs text-[var(--text-secondary)]">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {type === 'ascenseur' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ascenseur *</label>
                  <Select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                    <option value="">Sélectionner...</option>
                    {ascenseurs?.map(asc => (
                      <option key={asc.id} value={asc.id}>{asc.code} - {asc.client?.nom} - {asc.adresse}</option>
                    ))}
                  </Select>
                </div>
              )}

              {type === 'article' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Article *</label>
                  <Select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                    <option value="">Sélectionner...</option>
                    {articles?.map(art => (
                      <option key={art.id} value={art.id}>{art.reference} - {art.designation}</option>
                    ))}
                  </Select>
                </div>
              )}

              {type === 'emplacement' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Code emplacement *</label>
                    <Input value={emplacementCode} onChange={e => setEmplacementCode(e.target.value.toUpperCase())} placeholder="Ex: DEP-A1-R2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                    <Input value={emplacementDesc} onChange={e => setEmplacementDesc(e.target.value)} placeholder="Ex: Étagère A - Rang 2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Véhicule (optionnel)</label>
                    <Select value={vehiculeId} onChange={e => setVehiculeId(e.target.value)}>
                      <option value="">Aucun (dépôt)</option>
                      {vehicules?.map(v => (
                        <option key={v.id} value={v.id}>{v.immatriculation} - {v.technicien?.prenom} {v.technicien?.nom}</option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Label (optionnel)</label>
                <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={getDefaultLabel()} />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
                <Button variant="primary" className="flex-1" onClick={handleStartScan} disabled={!canProceed() || !nfc.capabilities.any}>
                  <ScanLine className="w-4 h-4" /> Scanner le tag
                </Button>
              </div>
            </div>
          )}

          {step === 'scan' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                <Radio className="w-12 h-12 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">En attente d'un tag NFC...</h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-6">
                {nfc.capabilities.webNFC ? 'Approchez votre téléphone du tag' : 'Placez le tag sur le lecteur USB'}
              </p>
              <Button variant="secondary" onClick={() => { nfc.stopReading(); setStep('config'); }}>Annuler</Button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-12 h-12 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Tag encodé avec succès !</h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-2">UID: {scannedUID}</p>
              <Button variant="primary" onClick={onClose} className="mt-4">Fermer</Button>
            </div>
          )}

          {nfc.error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">{nfc.error}</span>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function TagDetailModal({ tag, onClose, onDelete }: { tag: NFCTag; onClose: () => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(tag.label || '');
  const [notes, setNotes] = useState(tag.notes || '');

  const { data: scans } = useQuery({
    queryKey: ['nfc-scans', tag.id],
    queryFn: () => getNFCScans({ tagId: tag.id, limit: 10 }),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<NFCTag>) => updateNFCTag(tag.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
      toast.success('Tag mis à jour');
      setIsEditing(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => updateNFCTag(tag.id, { actif: !tag.actif }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
      toast.success(tag.actif ? 'Tag désactivé' : 'Tag activé');
    },
  });

  const config = TYPE_CONFIG[tag.type];
  const Icon = config.icon;

  const getAssociationLabel = () => {
    if (tag.type === 'ascenseur' && tag.ascenseur) return `${tag.ascenseur.code} - ${(tag.ascenseur as any).client?.nom || 'Client'}`;
    if (tag.type === 'article' && tag.article) return `${tag.article.reference} - ${tag.article.designation}`;
    if (tag.type === 'emplacement') {
      let loc = tag.emplacement_code || 'Emplacement';
      if (tag.vehicule) loc += ` (${tag.vehicule.immatriculation})`;
      return loc;
    }
    return 'Non associé';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                <Icon className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{tag.label || 'Tag NFC'}</h2>
                <div className="text-sm text-[var(--text-tertiary)] font-mono">{tag.uid}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsEditing(!isEditing)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Badge variant={config.color as any}>{config.label}</Badge>
            <Badge variant={tag.actif ? 'green' : 'red'}>{tag.actif ? 'Actif' : 'Inactif'}</Badge>
          </div>

          {isEditing ? (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Label</label>
                <Input value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)]" />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)}>Annuler</Button>
                <Button variant="primary" onClick={() => updateMutation.mutate({ label, notes })}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">Association</div>
                <div className="font-medium text-[var(--text-primary)]">{getAssociationLabel()}</div>
              </div>
              {tag.emplacement_description && (
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">Description</div>
                  <div className="text-sm text-[var(--text-primary)]">{tag.emplacement_description}</div>
                </div>
              )}
              {tag.notes && (
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">Notes</div>
                  <div className="text-sm text-[var(--text-primary)]">{tag.notes}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[var(--text-tertiary)]">Créé le:</span>
                  <span className="ml-2 text-[var(--text-primary)]">{format(parseISO(tag.created_at), 'd MMM yyyy', { locale: fr })}</span>
                </div>
                {tag.derniere_utilisation && (
                  <div>
                    <span className="text-[var(--text-tertiary)]">Dernier scan:</span>
                    <span className="ml-2 text-[var(--text-primary)]">
                      {formatDistanceToNow(parseISO(tag.derniere_utilisation), { locale: fr, addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border-secondary)] pt-4">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <History className="w-4 h-4" /> Historique des scans
            </h3>
            {scans && scans.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scans.map(scan => (
                  <div key={scan.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-2">
                      <Badge variant="gray">{scan.action}</Badge>
                      <span className="text-sm text-[var(--text-secondary)]">{scan.technicien?.prenom} {scan.technicien?.nom}</span>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {formatDistanceToNow(parseISO(scan.created_at), { locale: fr, addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">Aucun scan enregistré</p>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border-secondary)]">
            <Button variant="secondary" onClick={() => toggleActiveMutation.mutate()}>
              {tag.actif ? <Link2Off className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {tag.actif ? 'Désactiver' : 'Activer'}
            </Button>
            <Button variant="danger" onClick={onDelete}><Trash2 className="w-4 h-4" /> Supprimer</Button>
            <Button variant="secondary" className="ml-auto" onClick={onClose}>Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function TestScanModal({ onClose }: { onClose: () => void }) {
  const nfc = useNFC();
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const startScan = async () => {
    setScanning(true);
    setScannedTag(null);
    setNotFound(false);
    
    try {
      await nfc.startReading(async (uid) => {
        nfc.stopReading();
        setScanning(false);
        const tag = await getNFCTagByUID(uid);
        if (tag) setScannedTag(tag);
        else setNotFound(true);
      });
    } catch (error: any) {
      toast.error(error.message);
      setScanning(false);
    }
  };

  const config = scannedTag ? TYPE_CONFIG[scannedTag.type] : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Test de scan NFC</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {!scanning && !scannedTag && !notFound && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Nfc className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-[var(--text-secondary)] mb-6">Testez la lecture d'un tag NFC</p>
              <Button variant="primary" onClick={startScan}><ScanLine className="w-4 h-4" /> Démarrer le scan</Button>
            </div>
          )}

          {scanning && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                <Radio className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-[var(--text-secondary)] mb-6">Approchez un tag NFC...</p>
              <Button variant="secondary" onClick={() => { nfc.stopReading(); setScanning(false); }}>Annuler</Button>
            </div>
          )}

          {scannedTag && config && (
            <div className="text-center py-4">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <config.icon className="w-10 h-10" style={{ color: config.color }} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{scannedTag.label || 'Tag trouvé'}</h3>
              <p className="text-sm text-[var(--text-tertiary)] font-mono mb-4">{scannedTag.uid}</p>
              <Badge variant={config.color as any} className="mb-4">{config.label}</Badge>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
                <Button variant="primary" className="flex-1" onClick={startScan}><RefreshCw className="w-4 h-4" /> Nouveau scan</Button>
              </div>
            </div>
          )}

          {notFound && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Tag non reconnu</h3>
              <p className="text-sm text-[var(--text-tertiary)] mb-6">Ce tag n'est pas enregistré</p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
                <Button variant="primary" className="flex-1" onClick={startScan}><RefreshCw className="w-4 h-4" /> Réessayer</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function NFCPage() {
  const queryClient = useQueryClient();
  const nfc = useNFC();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showEncode, setShowEncode] = useState(false);
  const [showTestScan, setShowTestScan] = useState(false);
  const [selectedTag, setSelectedTag] = useState<NFCTag | null>(null);

  const { data: tags, isLoading } = useQuery({ queryKey: ['nfc-tags'], queryFn: () => getNFCTags() });
  const { data: stats } = useQuery({ queryKey: ['nfc-stats'], queryFn: getNFCStats });
  const { data: recentScans } = useQuery({ queryKey: ['nfc-scans-recent'], queryFn: () => getNFCScans({ limit: 20 }) });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNFCTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
      queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
      toast.success('Tag supprimé');
      setSelectedTag(null);
    },
  });

  const filtered = useMemo(() => {
    if (!tags) return [];
    return tags.filter(t => {
      const matchSearch = t.uid.toLowerCase().includes(search.toLowerCase()) ||
        t.label?.toLowerCase().includes(search.toLowerCase()) ||
        t.emplacement_code?.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' || t.type === filterType;
      return matchSearch && matchType;
    });
  }, [tags, search, filterType]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Nfc className="w-7 h-7 text-cyan-400" />
            Gestion NFC
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Encodage et gestion des tags NFC</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
            {nfc.capabilities.webNFC && <><Smartphone className="w-4 h-4 text-green-400" /><span className="text-xs text-[var(--text-tertiary)]">Mobile</span></>}
            {nfc.capabilities.webUSB && <><Usb className={`w-4 h-4 ${nfc.isUSBConnected ? 'text-green-400' : 'text-[var(--text-tertiary)]'}`} /><span className="text-xs text-[var(--text-tertiary)]">USB</span></>}
            {!nfc.capabilities.any && <><WifiOff className="w-4 h-4 text-amber-400" /><span className="text-xs text-amber-400">Indisponible</span></>}
          </div>
          <Button variant="secondary" onClick={() => setShowTestScan(true)}><ScanLine className="w-4 h-4" /> Tester</Button>
          <Button variant="primary" onClick={() => setShowEncode(true)} disabled={!nfc.capabilities.any}>
            <Plus className="w-4 h-4" /> Encoder
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats?.total || 0, icon: Tag, color: 'cyan' },
          { label: 'Ascenseurs', value: stats?.ascenseur || 0, icon: Building2, color: 'cyan' },
          { label: 'Emplacements', value: stats?.emplacement || 0, icon: Box, color: 'amber' },
          { label: 'Articles', value: stats?.article || 0, icon: Package, color: 'purple' },
          { label: 'Scans/jour', value: stats?.scansToday || 0, icon: Wifi, color: 'green' },
          { label: 'Non associés', value: stats?.nonAssocies || 0, icon: Link2Off, color: 'red' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardBody className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
              <div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10" />
            </div>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-48">
              <option value="all">Tous les types</option>
              <option value="ascenseur">Ascenseurs</option>
              <option value="emplacement">Emplacements</option>
              <option value="article">Articles</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="divide-y divide-[var(--border-secondary)]">
          {isLoading ? (
            <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">Aucun tag trouvé</div>
          ) : (
            filtered.map(tag => {
              const config = TYPE_CONFIG[tag.type];
              const Icon = config.icon;
              return (
                <div key={tag.id} className="p-4 hover:bg-[var(--bg-tertiary)] cursor-pointer" onClick={() => setSelectedTag(tag)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{tag.label || 'Tag sans nom'}</span>
                          <Badge variant={tag.actif ? 'green' : 'red'} className="text-xs">{tag.actif ? 'Actif' : 'Inactif'}</Badge>
                        </div>
                        <div className="text-sm text-[var(--text-tertiary)] font-mono">{tag.uid}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={config.color as any}>{config.label}</Badge>
                      {tag.derniere_utilisation && (
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">
                          {formatDistanceToNow(parseISO(tag.derniere_utilisation), { locale: fr, addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><History className="w-5 h-5" /> Scans récents</h3>
          {recentScans && recentScans.length > 0 ? (
            <div className="space-y-2">
              {recentScans.slice(0, 10).map(scan => (
                <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="flex items-center gap-3">
                    <Badge variant="gray">{scan.action}</Badge>
                    <span className="text-sm text-[var(--text-primary)]">{scan.tag?.label || scan.tag?.uid}</span>
                    <span className="text-sm text-[var(--text-tertiary)]">par {scan.technicien?.prenom} {scan.technicien?.nom}</span>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {formatDistanceToNow(parseISO(scan.created_at), { locale: fr, addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--text-muted)] py-4">Aucun scan récent</p>
          )}
        </CardBody>
      </Card>

      {showEncode && <EncodeModal onClose={() => setShowEncode(false)} onSuccess={() => {}} />}
      {showTestScan && <TestScanModal onClose={() => setShowTestScan(false)} />}
      {selectedTag && (
        <TagDetailModal tag={selectedTag} onClose={() => setSelectedTag(null)}
          onDelete={() => { if (confirm('Supprimer ce tag ?')) deleteMutation.mutate(selectedTag.id); }} />
      )}
    </div>
  );
}
