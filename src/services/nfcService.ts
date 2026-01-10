/**
 * Service NFC Unifié
 * Gère Web NFC (mobile Chrome) et WebSocket (serveur NFC local pour USB)
 */

export type NFCDeviceType = 'web_nfc' | 'local_server' | 'none';

export interface NFCReadResult {
  uid: string;
  deviceType: NFCDeviceType;
  timestamp: Date;
}

export interface NFCWriteData {
  type: 'ascenseur' | 'emplacement' | 'article';
  id: string;
  label?: string;
}

type NFCCallback = (result: NFCReadResult) => void;
type NFCErrorCallback = (error: Error) => void;

class NFCService {
  private webNFCSupported: boolean = false;
  private isReading: boolean = false;
  private abortController: AbortController | null = null;
  private onReadCallback: NFCCallback | null = null;
  private onErrorCallback: NFCErrorCallback | null = null;
  private pollingStop: (() => void) | null = null;
  
  // WebSocket pour serveur NFC local
  private ws: WebSocket | null = null;
  private wsConnected: boolean = false;
  private wsServerUrl = 'ws://localhost:8765';
  private lastUID: string | null = null;

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    this.webNFCSupported = 'NDEFReader' in window;
  }

  getCapabilities(): { webNFC: boolean; webUSB: boolean; localServer: boolean; any: boolean } {
    return {
      webNFC: this.webNFCSupported,
      webUSB: false, // WebUSB ne fonctionne pas avec les lecteurs NFC (classe protégée)
      localServer: true, // Toujours disponible si le serveur Python tourne
      any: this.webNFCSupported || true,
    };
  }

  getBestAvailableMode(): NFCDeviceType {
    if (this.webNFCSupported) return 'web_nfc';
    return 'local_server';
  }

  async startWebNFCReading(
    onRead: NFCCallback,
    onError?: NFCErrorCallback
  ): Promise<void> {
    if (!this.webNFCSupported) {
      throw new Error('Web NFC non supporté sur cet appareil');
    }

    if (this.isReading) {
      await this.stopReading();
    }

    this.onReadCallback = onRead;
    this.onErrorCallback = onError || null;
    this.abortController = new AbortController();

    try {
      const ndef = new (window as any).NDEFReader();
      
      await ndef.scan({ signal: this.abortController.signal });
      this.isReading = true;

      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        const uid = this.formatUID(serialNumber);
        if (this.onReadCallback) {
          this.onReadCallback({
            uid,
            deviceType: 'web_nfc',
            timestamp: new Date(),
          });
        }
      });

      ndef.addEventListener('readingerror', () => {
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error('Erreur de lecture NFC'));
        }
      });

    } catch (error: any) {
      this.isReading = false;
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission NFC refusée. Veuillez autoriser l\'accès NFC.');
      }
      throw error;
    }
  }

  async writeWebNFC(data: NFCWriteData): Promise<string> {
    if (!this.webNFCSupported) {
      throw new Error('Web NFC non supporté sur cet appareil');
    }

    const ndef = new (window as any).NDEFReader();
    
    const payload = JSON.stringify({
      app: 'auvergne-tech',
      version: 1,
      type: data.type,
      id: data.id,
      label: data.label,
      encoded: new Date().toISOString(),
    });

    try {
      await ndef.write({
        records: [
          { recordType: 'text', data: payload },
          { recordType: 'url', data: `https://app.auvergne-tech.fr/nfc/${data.type}/${data.id}` }
        ]
      });

      return new Promise((resolve, reject) => {
        const readController = new AbortController();
        
        ndef.scan({ signal: readController.signal }).then(() => {
          ndef.addEventListener('reading', ({ serialNumber }: any) => {
            readController.abort();
            resolve(this.formatUID(serialNumber));
          }, { once: true });
        }).catch(reject);

        setTimeout(() => {
          readController.abort();
          reject(new Error('Timeout lecture UID'));
        }, 10000);
      });

    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission NFC refusée');
      }
      throw error;
    }
  }

  // ================================================
  // SERVEUR NFC LOCAL (WebSocket)
  // ================================================

  async connectUSBReader(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsServerUrl);
        
        this.ws.onopen = () => {
          console.log('✅ Connecté au serveur NFC local');
          this.wsConnected = true;
          
          // Envoyer une commande de connexion
          this.ws?.send(JSON.stringify({ command: 'connect' }));
          resolve(true);
        };

        this.ws.onclose = () => {
          console.log('❌ Déconnecté du serveur NFC local');
          this.wsConnected = false;
          this.stopReading();
        };

        this.ws.onerror = () => {
          this.wsConnected = false;
          reject(new Error(
            'Impossible de se connecter au serveur NFC local.\n\n' +
            '1. Installez pyscard: pip install pyscard websockets\n' +
            '2. Lancez: python nfc_server.py\n' +
            '3. Réessayez'
          ));
        };

        // Timeout de connexion
        setTimeout(() => {
          if (!this.wsConnected) {
            this.ws?.close();
            reject(new Error('Timeout de connexion au serveur NFC'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  async readUSBTag(): Promise<NFCReadResult | null> {
    if (!this.ws || !this.wsConnected) {
      throw new Error('Serveur NFC non connecté');
    }

    return new Promise((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.ws?.removeEventListener('message', handleMessage);
          
          if (data.success && data.uid) {
            resolve({
              uid: this.formatUID(data.uid),
              deviceType: 'local_server',
              timestamp: new Date(),
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify({ command: 'getUID' }));

      // Timeout
      setTimeout(() => {
        this.ws?.removeEventListener('message', handleMessage);
        resolve(null);
      }, 2000);
    });
  }

  async writeUSBTag(data: NFCWriteData): Promise<string> {
    if (!this.ws || !this.wsConnected) {
      throw new Error('Serveur NFC non connecté');
    }

    // D'abord lire l'UID
    const readResult = await this.readUSBTag();
    if (!readResult) {
      throw new Error('Aucun tag détecté. Placez un tag sur le lecteur.');
    }

    const payload = JSON.stringify({
      app: 'auvergne-tech',
      version: 1,
      type: data.type,
      id: data.id,
      label: data.label,
      encoded: new Date().toISOString(),
    });

    // Convertir en hex
    const hexData = Array.from(new TextEncoder().encode(payload))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.ws?.removeEventListener('message', handleMessage);
          
          if (data.success) {
            resolve(readResult.uid);
          } else {
            reject(new Error(data.error || 'Échec de l\'écriture'));
          }
        } catch (e) {
          reject(e);
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this.ws?.send(JSON.stringify({ command: 'writeBlock', block: 4, data: hexData }));

      setTimeout(() => {
        this.ws?.removeEventListener('message', handleMessage);
        reject(new Error('Timeout écriture NFC'));
      }, 5000);
    });
  }

  startUSBPolling(
    onRead: NFCCallback,
    onError?: NFCErrorCallback,
    intervalMs: number = 500
  ): () => void {
    let polling = true;
    this.lastUID = null;

    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.success && data.present && data.uid) {
            const uid = this.formatUID(data.uid);
            if (uid !== this.lastUID) {
              this.lastUID = uid;
              onRead({
                uid,
                deviceType: 'local_server',
                timestamp: new Date(),
              });
            }
          } else if (data.present === false) {
            this.lastUID = null;
          }
        } catch (e) {
          // Ignore
        }
      };
    }

    const poll = () => {
      if (!polling || !this.ws || !this.wsConnected) return;
      
      try {
        this.ws.send(JSON.stringify({ command: 'poll' }));
      } catch (e) {
        if (onError) onError(e as Error);
      }

      if (polling) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    const stopFn = () => { 
      polling = false; 
      this.lastUID = null;
    };
    this.pollingStop = stopFn;
    return stopFn;
  }

  async stopReading(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pollingStop) {
      this.pollingStop();
      this.pollingStop = null;
    }
    this.isReading = false;
    this.onReadCallback = null;
    this.onErrorCallback = null;
    this.lastUID = null;
  }

  async disconnectUSB(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.lastUID = null;
  }

  isCurrentlyReading(): boolean {
    return this.isReading;
  }

  isUSBConnected(): boolean {
    return this.wsConnected;
  }

  private formatUID(serialNumber: string): string {
    if (!serialNumber) return 'UNKNOWN';
    return serialNumber
      .replace(/:/g, '')
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() || serialNumber.toUpperCase();
  }
}

export const nfcService = new NFCService();
