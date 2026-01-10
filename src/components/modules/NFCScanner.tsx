import { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, X, AlertTriangle, Smartphone, Tag, Monitor
} from 'lucide-react';
import { Card, CardBody, Button } from '@/components/ui';
import { useNFC } from '@/hooks/useNFC';
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
  const nfc = useNFC();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [unknownUID, setUnknownUID] = useState<string | null>(null);

  const handleTagScanned = useCallback(async (uid: string) => {
    try {
      const tag = await getNFCTagByUID(uid);
      
      if (tag) {
        setScannedTag(tag);
        await createNFCScan({
          tag_id: tag.id,
          technicien_id: CURRENT_USER_ID,
          action: 'consultation',
        });
        toast.success('Tag reconnu !');
      } else {
        setUnknownUID(uid);
        toast.error('Tag non reconnu');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Erreur lors du scan');
    }
  }, []);

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setScannedTag(null);
    setUnknownUID(null);

    try {
      await nfc.startReading((uid) => {
        nfc.stopReading();
        setIsScanning(false);
        handleTagScanned(uid);
      });
    } catch (err: any) {
      setError(err.message);
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    nfc.stopReading();
    setIsScanning(false);
  };

  const reset = () => {
    setScannedTag(null);
    setUnknownUID(null);
    setError(null);
  };

  useEffect(() => {
    return () => {
      nfc.stopReading();
    };
  }, []);

  if (!isOpen) return null;

  // Vue tag ascenseur/emplacement scanné
  if (scannedTag && (scannedTag.type === 'ascenseur' || scannedTag.type === 'emplacement')) {
    return (
      <NFCScanView
        tag={scannedTag}
        onClose={() => { reset(); onClose(); }}
        onRescan={() => { reset(); startScan(); }}
      />
    );
  }

  // Vue stock
  if (scannedTag && scannedTag.type === 'article') {
    return (
      <NFCStockView
        tag={scannedTag}
        onClose={() => { reset(); onClose(); }}
        onRescan={() => { reset(); startScan(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-6 h-6 text-cyan-400" />
              Scanner NFC
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Message mobile uniquement pour desktop */}
          {!nfc.capabilities.isMobile && (
            <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <Monitor className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-200 font-medium">Fonctionnalité mobile</p>
                  <p className="text-xs text-amber-200/70 mt-1">
                    Le scan NFC nécessite un smartphone Android avec Chrome.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Zone de scan */}
          <div className="text-center py-8">
            {!isScanning && !error && !unknownUID && (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Smartphone className="w-12 h-12 text-cyan-400" />
                </div>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  {nfc.capabilities.webNFC 
                    ? 'Cliquez pour scanner un tag NFC'
                    : 'NFC non disponible sur cet appareil'
                  }
                </p>
                <Button 
                  variant="primary" 
                  onClick={startScan}
                  disabled={!nfc.capabilities.webNFC}
                >
                  <Wifi className="w-4 h-4" /> Démarrer le scan
                </Button>
              </>
            )}

            {isScanning && (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                  <Wifi className="w-12 h-12 text-cyan-400" />
                </div>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Approchez votre téléphone du tag NFC...
                </p>
                <Button variant="secondary" onClick={stopScan}>
                  Annuler
                </Button>
              </>
            )}

            {error && (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-red-400" />
                </div>
                <p className="text-sm text-red-400 mb-6">{error}</p>
                <Button variant="secondary" onClick={() => setError(null)}>
                  Réessayer
                </Button>
              </>
            )}

            {unknownUID && (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-amber-400" />
                </div>
                <p className="text-sm text-amber-400 mb-2">Tag non reconnu</p>
                <p className="text-xs text-[var(--text-tertiary)] font-mono mb-6">{unknownUID}</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="secondary" onClick={reset}>
                    Annuler
                  </Button>
                  <Button variant="primary" onClick={startScan}>
                    Scanner à nouveau
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Hook pour utiliser le scanner NFC facilement
export function useNFCScanner() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    openScanner: () => setIsOpen(true),
    closeScanner: () => setIsOpen(false),
    NFCScannerComponent: () => <NFCScanner isOpen={isOpen} onClose={() => setIsOpen(false)} />,
  };
}
