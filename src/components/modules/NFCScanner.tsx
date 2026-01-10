import { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, X, AlertTriangle, Smartphone, Tag
} from 'lucide-react';
import { Card, CardBody, Button } from '@/components/ui';
import { nfcService, getNFCCapabilities, NFCTagData } from '@/services/nfc';
import { getNFCTagByUID, createNFCScan } from '@/services/api';
import { NFCScanView } from './NFCScanView';
import { NFCStockView } from './NFCStockView';
import type { NFCTag } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NFCScanner({ isOpen, onClose }: NFCScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [unknownUID, setUnknownUID] = useState<string | null>(null);

  const capabilities = getNFCCapabilities();

  const handleTagScanned = useCallback(async (tagData: NFCTagData) => {
    try {
      // Chercher le tag dans la base
      const tag = await getNFCTagByUID(tagData.uid);
      
      if (tag) {
        setScannedTag(tag);
        setIsScanning(false);
        nfcService.stopScan();
      } else {
        setUnknownUID(tagData.uid);
        setIsScanning(false);
        nfcService.stopScan();
        toast.error('Tag non reconnu');
      }
    } catch (err) {
      console.error('Erreur lookup tag:', err);
      setError('Erreur lors de la recherche du tag');
    }
  }, []);

  const startScan = async () => {
    if (!capabilities.webNFC) {
      setError('Web NFC non disponible. Utilisez Chrome sur Android.');
      return;
    }

    setError(null);
    setIsScanning(true);

    try {
      await nfcService.startMobileScan(handleTagScanned);
    } catch (err: any) {
      setError(err.message);
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    nfcService.stopScan();
    setIsScanning(false);
    setScannedTag(null);
    setUnknownUID(null);
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (isOpen && capabilities.webNFC) {
      startScan();
    }
    return () => {
      nfcService.stopScan();
    };
  }, [isOpen]);

  // Afficher la vue appropriée selon le type de tag
  if (scannedTag) {
    if (scannedTag.type === 'ascenseur' && scannedTag.ascenseur_id) {
      return (
        <NFCScanView
          ascenseurId={scannedTag.ascenseur_id}
          tagId={scannedTag.id}
          onClose={handleClose}
        />
      );
    }

    if (scannedTag.type === 'emplacement' && scannedTag.emplacement) {
      return (
        <NFCStockView
          emplacement={scannedTag.emplacement}
          tagId={scannedTag.id}
          onClose={handleClose}
        />
      );
    }

    // Tag non associé correctement
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <Card className="w-[400px]">
          <CardBody className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Tag non configuré</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Ce tag existe mais n'est pas correctement associé.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] font-mono mb-4">
              UID: {scannedTag.uid}
            </p>
            <Button variant="secondary" onClick={handleClose}>Fermer</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[400px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-6 h-6 text-cyan-400" />
              Scanner NFC
            </h2>
            <button onClick={handleClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {!capabilities.webNFC ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">NFC non disponible</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Le Web NFC n'est disponible que sur Chrome Android.
                <br />
                Utilisez l'application sur votre smartphone.
              </p>
              <Button variant="secondary" onClick={handleClose}>Fermer</Button>
            </div>
          ) : isScanning ? (
            <div className="text-center py-8">
              <div className="w-24 h-24 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Wifi className="w-12 h-12 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">En attente de scan...</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Approchez votre téléphone du tag NFC
              </p>
              <Button variant="secondary" onClick={handleClose}>Annuler</Button>
            </div>
          ) : unknownUID ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">Tag non reconnu</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Ce tag n'est pas enregistré dans le système.
              </p>
              <p className="text-xs text-[var(--text-tertiary)] font-mono mb-4">
                UID: {unknownUID}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={handleClose}>Fermer</Button>
                <Button variant="primary" onClick={() => { setUnknownUID(null); startScan(); }}>
                  Réessayer
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">Erreur</h3>
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={handleClose}>Fermer</Button>
                <Button variant="primary" onClick={startScan}>Réessayer</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Smartphone className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
              <Button variant="primary" onClick={startScan}>
                <Wifi className="w-4 h-4" /> Démarrer le scan
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// Hook pour utiliser le scanner NFC
export function useNFCScanner() {
  const [isOpen, setIsOpen] = useState(false);

  const openScanner = () => setIsOpen(true);
  const closeScanner = () => setIsOpen(false);

  return {
    isOpen,
    openScanner,
    closeScanner,
    NFCScannerComponent: () => <NFCScanner isOpen={isOpen} onClose={closeScanner} />,
  };
}
