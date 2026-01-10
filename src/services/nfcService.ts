/**
 * Service NFC Unifié
 * Gère Web NFC (mobile Chrome) et WebUSB (lecteur USB bureau)
 */

export type NFCDeviceType = 'web_nfc' | 'web_usb' | 'none';

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
  private webUSBSupported: boolean = false;
  private isReading: boolean = false;
  private abortController: AbortController | null = null;
  private usbDevice: USBDevice | null = null;
  private onReadCallback: NFCCallback | null = null;
  private onErrorCallback: NFCErrorCallback | null = null;
  private pollingStop: (() => void) | null = null;

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    this.webNFCSupported = 'NDEFReader' in window;
    this.webUSBSupported = 'usb' in navigator;
  }

  getCapabilities(): { webNFC: boolean; webUSB: boolean; any: boolean } {
    return {
      webNFC: this.webNFCSupported,
      webUSB: this.webUSBSupported,
      any: this.webNFCSupported || this.webUSBSupported,
    };
  }

  getBestAvailableMode(): NFCDeviceType {
    if (this.webNFCSupported) return 'web_nfc';
    if (this.webUSBSupported) return 'web_usb';
    return 'none';
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

  async connectUSBReader(): Promise<boolean> {
    if (!this.webUSBSupported) {
      throw new Error('WebUSB non supporté sur ce navigateur');
    }

    try {
      const filters = [
        { vendorId: 0x072F }, // ACS (ACR122U)
        { vendorId: 0x04E6 }, // SCM Microsystems
        { vendorId: 0x076B }, // OmniKey
        { vendorId: 0x1A86 }, // QinHeng (CH340)
        { vendorId: 0x0403 }, // FTDI
      ];

      this.usbDevice = await navigator.usb.requestDevice({ filters });
      await this.usbDevice.open();
      
      if (this.usbDevice.configuration === null) {
        await this.usbDevice.selectConfiguration(1);
      }
      
      await this.usbDevice.claimInterface(0);
      
      return true;
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        throw new Error('Aucun lecteur NFC USB détecté. Connectez votre lecteur et réessayez.');
      }
      throw error;
    }
  }

  async readUSBTag(): Promise<NFCReadResult | null> {
    if (!this.usbDevice) {
      throw new Error('Lecteur USB non connecté');
    }

    try {
      const command = new Uint8Array([0xFF, 0xCA, 0x00, 0x00, 0x00]);
      
      await this.usbDevice.transferOut(2, command);
      const result = await this.usbDevice.transferIn(1, 64);
      
      if (result.data && result.data.byteLength >= 4) {
        const uid = this.arrayToHex(new Uint8Array(result.data.buffer));
        return {
          uid,
          deviceType: 'web_usb',
          timestamp: new Date(),
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async writeUSBTag(data: NFCWriteData): Promise<string> {
    if (!this.usbDevice) {
      throw new Error('Lecteur USB non connecté');
    }

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

    const textRecord = this.createNDEFTextRecord(payload);
    
    try {
      const writeCommand = new Uint8Array([
        0xFF, 0xD6, 0x00, 0x04,
        textRecord.length,
        ...textRecord
      ]);

      await this.usbDevice.transferOut(2, writeCommand);
      const result = await this.usbDevice.transferIn(1, 64);
      
      if (result.data) {
        const response = new Uint8Array(result.data.buffer);
        if (response[response.length - 2] === 0x90 && response[response.length - 1] === 0x00) {
          return readResult.uid;
        }
      }
      
      throw new Error('Échec de l\'écriture');
    } catch (error) {
      throw new Error('Erreur lors de l\'écriture du tag');
    }
  }

  startUSBPolling(
    onRead: NFCCallback,
    onError?: NFCErrorCallback,
    intervalMs: number = 500
  ): () => void {
    let lastUID: string | null = null;
    let polling = true;

    const poll = async () => {
      if (!polling) return;

      try {
        const result = await this.readUSBTag();
        
        if (result && result.uid !== lastUID) {
          lastUID = result.uid;
          onRead(result);
        } else if (!result) {
          lastUID = null;
        }
      } catch (error: any) {
        if (onError) onError(error);
      }

      if (polling) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    const stopFn = () => { polling = false; };
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
  }

  async disconnectUSB(): Promise<void> {
    if (this.usbDevice) {
      await this.usbDevice.close();
      this.usbDevice = null;
    }
  }

  isCurrentlyReading(): boolean {
    return this.isReading;
  }

  isUSBConnected(): boolean {
    return this.usbDevice !== null;
  }

  private formatUID(serialNumber: string): string {
    return serialNumber
      .replace(/:/g, '')
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() || serialNumber.toUpperCase();
  }

  private arrayToHex(array: Uint8Array): string {
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }

  private createNDEFTextRecord(text: string): Uint8Array {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const languageCode = encoder.encode('fr');
    
    const record = new Uint8Array(1 + languageCode.length + textBytes.length);
    record[0] = languageCode.length;
    record.set(languageCode, 1);
    record.set(textBytes, 1 + languageCode.length);
    
    return record;
  }
}

export const nfcService = new NFCService();
