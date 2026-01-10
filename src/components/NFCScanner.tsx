import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Nfc, Radio, X, Building2, Box, Package, AlertTriangle,
  Smartphone, WifiOff, ScanLine, Monitor
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { useNFC } from '@/hooks/useNFC';
import { getNFCTagByUID, createNFCScan } from '@/services/api';
import { NFCAscenseurModal } from './NFCScanModal';
import { NFCEmplacementModal } from './NFCEmplacementModal';
import type { NFCTag } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCScannerProps {
  autoStart?: boolean;
  onClose?: () => void;
  fullScreen?: boolean;
}

export function NFCScanner({ autoStart = false, onClose, fullScreen = false }: NFCScannerProps) {
  const nfc = useNFC();
  const [scanning, setScanning] = useState(false);
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [showAscenseurModal, setShowAscenseurModal] = useState(false);
  const [showEmplacementModal, setShowEmplacementModal] = useState(false);

  useEffect(() => {
    if (autoStart && nfc.capabilities.any) {
      startScan();
    }
    return () => {
      nfc.stopReading();
    };
  }, [autoStart]);

  const startScan = async () => {
    setScanning(true);
    setScannedTag(null);
    setNotFound(null);

    try {
      await nfc.startReading(async (uid, deviceType) => {
        nfc.stopReading();
        setScanning(false);

        // Chercher le tag
        const tag = await getNFCTagByUID(uid);

        if (tag) {
          // Enregistrer le scan
          await createNFCScan({
            tag_id: tag.id,
            technicien_id: CURRENT_USER_ID,
            action: 'consultation',
            ascenseur_id: tag.ascenseur_id,
            article_id: tag.article_id,
            device_info: deviceType,
          });

          setScannedTag(tag);

          // Ouvrir le modal approprié
          if (tag.type === 'ascenseur' && tag.ascenseur) {
            setShowAscenseurModal(true);
          } else if (tag.type === 'emplacement') {
            setShowEmplacementModal(true);
          }
        } else {
          setNotFound(uid);
          toast.error('Tag non reconnu');
        }
      });
    } catch (error: any) {
      toast.error(error.message);
      setScanning(false);
    }
  };

  const handleReset = () => {
    setScannedTag(null);
    setNotFound(null);
    setShowAscenseurModal(false);
    setShowEmplacementModal(false);
  };

  const containerClass = fullScreen
    ? 'fixed inset-0 bg-[var(--bg-primary)] z-50 flex flex-col'
    : '';

  return (
    <div className={containerClass}>
      {fullScreen && (
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-secondary)]">
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Nfc className="w-6 h-6 text-cyan-400" />
            Scanner NFC
          </h1>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          )}
        </div>
      )}

      <div className={`flex-1 flex items-center justify-center ${fullScreen ? 'p-8' : 'p-4'}`}>
        <Card className="w-full max-w-md">
          <CardBody className="p-8">
            {/* État NFC non disponible */}
            {!nfc.capabilities.any && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <WifiOff className="w-12 h-12 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  NFC non disponible
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-4">
                  Votre appareil ne supporte pas le NFC ou la fonctionnalité est désactivée.
                </p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-red-400" />
                    <span className="text-[var(--text-tertiary)]">Mobile NFC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Usb className="w-4 h-4 text-red-400" />
                    <span className="text-[var(--text-tertiary)]">USB</span>
                  </div>
                </div>
              </div>
            )}

            {/* État initial - prêt à scanner */}
            {nfc.capabilities.any && !scanning && !scannedTag && !notFound && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Nfc className="w-12 h-12 text-cyan-400" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  Scanner un tag NFC
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Appuyez sur le bouton puis approchez votre appareil du tag
                </p>

                <Button variant="primary" size="lg" onClick={startScan} className="w-full">
                  <ScanLine className="w-5 h-5" />
                  Démarrer le scan
                </Button>

                <div className="flex items-center justify-center gap-4 mt-6 text-sm">
                  {nfc.capabilities.webNFC ? (
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">NFC Prêt</span>
                    </div>
                  ) : nfc.capabilities.isMobile ? (
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400">NFC non supporté sur ce téléphone</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400">Disponible uniquement sur mobile</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* État en cours de scan */}
            {scanning && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                  <Radio className="w-12 h-12 text-cyan-400" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  En attente...
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Approchez votre téléphone du tag NFC
                </p>
                <Button variant="secondary" onClick={() => { nfc.stopReading(); setScanning(false); }}>
                  Annuler
                </Button>
              </div>
            )}

            {/* Tag trouvé - affichage résumé */}
            {scannedTag && !showAscenseurModal && !showEmplacementModal && (
              <div className="text-center">
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                  scannedTag.type === 'ascenseur' ? 'bg-cyan-500/20' :
                  scannedTag.type === 'emplacement' ? 'bg-amber-500/20' : 'bg-purple-500/20'
                }`}>
                  {scannedTag.type === 'ascenseur' && <Building2 className="w-12 h-12 text-cyan-400" />}
                  {scannedTag.type === 'emplacement' && <Box className="w-12 h-12 text-amber-400" />}
                  {scannedTag.type === 'article' && <Package className="w-12 h-12 text-purple-400" />}
                </div>

                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  {scannedTag.label || 'Tag trouvé'}
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] font-mono mb-4">
                  {scannedTag.uid}
                </p>

                <Badge variant={
                  scannedTag.type === 'ascenseur' ? 'cyan' :
                  scannedTag.type === 'emplacement' ? 'amber' : 'purple'
                } className="mb-6">
                  {scannedTag.type === 'ascenseur' ? 'Ascenseur' :
                   scannedTag.type === 'emplacement' ? 'Emplacement' : 'Article'}
                </Badge>

                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={handleReset}>
                    Nouveau scan
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => {
                      if (scannedTag.type === 'ascenseur') setShowAscenseurModal(true);
                      else if (scannedTag.type === 'emplacement') setShowEmplacementModal(true);
                    }}
                  >
                    Voir détails
                  </Button>
                </div>
              </div>
            )}

            {/* Tag non trouvé */}
            {notFound && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  Tag non reconnu
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] font-mono mb-2">
                  {notFound}
                </p>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Ce tag n'est pas enregistré dans le système.
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={handleReset}>
                    Annuler
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={startScan}>
                    Réessayer
                  </Button>
                </div>
              </div>
            )}

            {/* Erreur */}
            {nfc.error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-sm text-red-400">{nfc.error}</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Modals */}
      {showAscenseurModal && scannedTag?.ascenseur && (
        <NFCAscenseurModal
          tag={scannedTag}
          ascenseur={scannedTag.ascenseur}
          onClose={() => {
            setShowAscenseurModal(false);
            handleReset();
          }}
        />
      )}

      {showEmplacementModal && scannedTag && (
        <NFCEmplacementModal
          tag={scannedTag}
          onClose={() => {
            setShowEmplacementModal(false);
            handleReset();
          }}
        />
      )}
    </div>
  );
}

// Bouton flottant pour déclencher le scan
export function NFCScanButton({ onClick }: { onClick: () => void }) {
  const nfc = useNFC();

  if (!nfc.capabilities.any) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-40"
      title="Scanner NFC"
    >
      <Nfc className="w-6 h-6" />
    </button>
  );
}
