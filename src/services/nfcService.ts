/**
 * Service NFC pour AuvergneTech
 * Web NFC uniquement (Chrome Android)
 */

export type NFCDeviceType = 'web_nfc' | 'none';

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

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    this.webNFCSupported = 'NDEFReader' in window;
  }

  getCapabilities(): { webNFC: boolean; any: boolean; isMobile: boolean } {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return {
      webNFC: this.webNFCSupported,
      any: this.webNFCSupported,
      isMobile,
    };
  }

  isAvailable(): boolean {
    return this.webNFCSupported;
  }

  async startReading(
    onRead: NFCCallback,
    onError?: NFCErrorCallback
  ): Promise<void> {
    if (!this.webNFCSupported) {
      throw new Error('NFC non disponible. Utilisez Chrome sur Android.');
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

  async writeTag(data: NFCWriteData): Promise<string> {
    if (!this.webNFCSupported) {
      throw new Error('NFC non disponible. Utilisez Chrome sur Android.');
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

      // Lire l'UID après écriture
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

  async stopReading(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isReading = false;
    this.onReadCallback = null;
    this.onErrorCallback = null;
  }

  isCurrentlyReading(): boolean {
    return this.isReading;
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
