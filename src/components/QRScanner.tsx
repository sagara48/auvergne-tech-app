import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, QrCode, Loader2, AlertCircle, Building2, Package, Box } from 'lucide-react';
import { Button, Badge, Card, CardBody } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface QRScannerProps {
  fullScreen?: boolean;
  autoStart?: boolean;
  onClose: () => void;
  onScanResult?: (data: string, tag?: any) => void;
}

export function QRScanner({ fullScreen, autoStart, onClose, onScanResult }: QRScannerProps) {
  const { setModuleActif } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: string; tag: any } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Démarrer la caméra
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      setScanning(false);
    }
  }, []);

  // Arrêter la caméra
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setScanning(false);
    setCameraReady(false);
  }, []);

  // Scan loop avec BarcodeDetector
  useEffect(() => {
    if (!cameraReady || !scanning) return;

    const detector = 'BarcodeDetector' in window
      ? new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      : null;

    if (!detector) {
      setError('BarcodeDetector non supporté. Utilisez Chrome ou Edge.');
      return;
    }

    const scan = async () => {
      if (!videoRef.current || !scanning) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const qrData = barcodes[0].rawValue;
          handleScanResult(qrData);
          return; // Stop scanning
        }
      } catch (e) {
        // Ignore detection errors
      }
      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraReady, scanning]);

  // Recherche du tag dans la DB
  const handleScanResult = async (data: string) => {
    stopCamera();

    // Format attendu: "AT-{type}-{id}" ou UID brut
    let tag = null;
    try {
      // Chercher par UID ou par données QR
      const { data: tagData } = await supabase
        .from('nfc_tags')
        .select('*, ascenseur:ascenseur_id(code_appareil, adresse, ville, statut)')
        .or(`uid.eq.${data},qr_data.eq.${data}`)
        .maybeSingle();
      tag = tagData;
    } catch (e) {
      console.warn('Tag lookup failed:', e);
    }

    setResult({ data, tag });

    if (tag) {
      toast.success(`QR identifié : ${tag.label || tag.type}`);
    } else {
      toast.error('QR Code non reconnu dans la base');
    }

    if (onScanResult) onScanResult(data, tag);
  };

  // Navigation vers la fiche
  const navigateToTag = () => {
    if (!result?.tag) return;
    const tag = result.tag;
    if (tag.type === 'ascenseur' && tag.ascenseur_id) {
      setModuleActif('ascenseurs');
    } else if (tag.type === 'article' && tag.article_id) {
      setModuleActif('stock');
    } else if (tag.type === 'emplacement') {
      setModuleActif('stock');
    }
    onClose();
  };

  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  }, [autoStart]);

  const TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
    ascenseur: { label: 'Ascenseur', icon: Building2, color: '#06b6d4' },
    article: { label: 'Article', icon: Package, color: '#B91C1C' },
    emplacement: { label: 'Emplacement', icon: Box, color: '#f59e0b' },
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center",
      fullScreen ? "bg-black" : "bg-black/80"
    )}>
      <div className={cn(
        "flex flex-col overflow-hidden",
        fullScreen ? "w-full h-full" : "w-[500px] max-h-[90vh] rounded-2xl"
      )} style={{ backgroundColor: 'var(--bg-primary)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-[var(--text-primary)]">Scanner QR Code</span>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Camera view */}
        <div className="flex-1 relative bg-black flex items-center justify-center min-h-[300px]">
          {scanning && (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-cyan-400 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                  {/* Scan line animation */}
                  <div className="absolute left-2 right-2 h-0.5 bg-cyan-400 animate-pulse" style={{ top: '50%' }} />
                </div>
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-400">{error}</p>
              <Button variant="primary" className="mt-4" onClick={startCamera}>Réessayer</Button>
            </div>
          )}

          {!scanning && !error && !result && (
            <div className="p-6 text-center">
              <QrCode className="w-16 h-16 text-cyan-400/50 mx-auto mb-3" />
              <p className="text-sm text-[var(--text-tertiary)] mb-4">Placez le QR Code dans le cadre</p>
              <Button variant="primary" onClick={startCamera}>
                <Camera className="w-4 h-4" /> Ouvrir la caméra
              </Button>
            </div>
          )}

          {/* Résultat */}
          {result && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <Card className="w-full max-w-sm">
                <CardBody className="space-y-4">
                  {result.tag ? (
                    <>
                      <div className="flex items-center gap-3">
                        {(() => {
                          const info = TYPE_INFO[result.tag.type] || TYPE_INFO.emplacement;
                          const Icon = info.icon;
                          return (
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}20` }}>
                              <Icon className="w-6 h-6" style={{ color: info.color }} />
                            </div>
                          );
                        })()}
                        <div>
                          <div className="text-lg font-bold text-[var(--text-primary)]">{result.tag.label || 'Tag identifié'}</div>
                          <Badge variant="blue">{TYPE_INFO[result.tag.type]?.label || result.tag.type}</Badge>
                        </div>
                      </div>
                      {result.tag.ascenseur && (
                        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{result.tag.ascenseur.code_appareil}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{result.tag.ascenseur.adresse} — {result.tag.ascenseur.ville}</div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="primary" className="flex-1" onClick={navigateToTag}>
                          Ouvrir la fiche
                        </Button>
                        <Button variant="secondary" onClick={() => { setResult(null); startCamera(); }}>
                          Re-scanner
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <div className="text-sm font-semibold text-[var(--text-primary)]">QR Code non reconnu</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1 font-mono break-all">{result.data}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => { setResult(null); startCamera(); }}>
                          Re-scanner
                        </Button>
                        <Button variant="secondary" onClick={onClose}>Fermer</Button>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
