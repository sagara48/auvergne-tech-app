/**
 * Service NFC unifié pour AuvergneTech
 * Supporte Web NFC (mobile Chrome Android) et WebUSB (lecteur USB bureau)
 */

// Types
export interface NFCTagData {
  uid: string;
  type?: string;
  data?: string;
}

export interface NFCReadResult {
  success: boolean;
  tag?: NFCTagData;
  error?: string;
}

export interface NFCWriteResult {
  success: boolean;
  error?: string;
}

type NFCEventCallback = (tag: NFCTagData) => void;

// Vérification des capacités
export function isWebNFCSupported(): boolean {
  return 'NDEFReader' in window;
}

export function isWebUSBSupported(): boolean {
  return 'usb' in navigator;
}

export function getNFCCapabilities() {
  return {
    webNFC: isWebNFCSupported(),
    webUSB: isWebUSBSupported(),
    anySupported: isWebNFCSupported() || isWebUSBSupported(),
  };
}

// ================================================
// WEB NFC (Mobile Chrome Android)
// ================================================

class WebNFCService {
  private reader: any = null;
  private abortController: AbortController | null = null;
  private isScanning = false;

  async startScan(onTagRead: NFCEventCallback): Promise<void> {
    if (!isWebNFCSupported()) {
      throw new Error('Web NFC non supporté sur cet appareil');
    }

    if (this.isScanning) {
      return;
    }

    try {
      // @ts-ignore - NDEFReader n'est pas encore dans les types TS standard
      this.reader = new NDEFReader();
      this.abortController = new AbortController();
      this.isScanning = true;

      this.reader.addEventListener('reading', ({ serialNumber, message }: any) => {
        const uid = serialNumber || this.formatUID(message);
        let data = '';
        
        // Extraire les données NDEF si présentes
        if (message?.records) {
          for (const record of message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder(record.encoding || 'utf-8');
              data = decoder.decode(record.data);
              break;
            }
            if (record.recordType === 'url') {
              const decoder = new TextDecoder();
              data = decoder.decode(record.data);
              break;
            }
          }
        }

        onTagRead({
          uid: this.formatSerialNumber(uid),
          data,
        });
      });

      this.reader.addEventListener('readingerror', () => {
        console.error('Erreur de lecture NFC');
      });

      await this.reader.scan({ signal: this.abortController.signal });
    } catch (error: any) {
      this.isScanning = false;
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission NFC refusée. Veuillez autoriser l\'accès NFC.');
      }
      throw error;
    }
  }

  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isScanning = false;
  }

  async write(data: string): Promise<NFCWriteResult> {
    if (!isWebNFCSupported()) {
      return { success: false, error: 'Web NFC non supporté' };
    }

    try {
      // @ts-ignore
      const writer = new NDEFReader();
      await writer.write({
        records: [
          { recordType: 'text', data },
        ],
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private formatSerialNumber(serial: string): string {
    if (!serial) return 'UNKNOWN';
    // Formater en XX:XX:XX:XX:XX:XX:XX
    const hex = serial.replace(/:/g, '').toUpperCase();
    return hex.match(/.{1,2}/g)?.join(':') || serial;
  }

  private formatUID(message: any): string {
    return `TAG-${Date.now()}`;
  }

  getIsScanning(): boolean {
    return this.isScanning;
  }
}

// ================================================
// WEB USB (Lecteur USB Bureau)
// ================================================

// Vendors connus de lecteurs NFC USB
const NFC_USB_VENDORS = [
  { vendorId: 0x072f, name: 'ACS (ACR122U)' },
  { vendorId: 0x04e6, name: 'SCM Microsystems' },
  { vendorId: 0x076b, name: 'OmniKey' },
  { vendorId: 0x1a86, name: 'QinHeng Electronics' },
  { vendorId: 0x04cc, name: 'ST-Ericsson' },
];

class WebUSBService {
  private device: USBDevice | null = null;
  private isConnected = false;

  async connect(): Promise<boolean> {
    if (!isWebUSBSupported()) {
      throw new Error('WebUSB non supporté sur ce navigateur');
    }

    try {
      // Demander un appareil USB
      this.device = await navigator.usb.requestDevice({
        filters: NFC_USB_VENDORS.map(v => ({ vendorId: v.vendorId })),
      });

      await this.device.open();
      
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      
      await this.device.claimInterface(0);
      this.isConnected = true;
      
      return true;
    } catch (error: any) {
      console.error('Erreur connexion USB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
      } catch (e) {
        console.error('Erreur déconnexion USB:', e);
      }
      this.device = null;
      this.isConnected = false;
    }
  }

  async readTag(): Promise<NFCReadResult> {
    if (!this.device || !this.isConnected) {
      return { success: false, error: 'Lecteur non connecté' };
    }

    try {
      // Commande APDU pour lire l'UID (GET_UID pour ACR122U)
      const GET_UID_CMD = new Uint8Array([0xFF, 0xCA, 0x00, 0x00, 0x00]);
      
      const result = await this.device.transferOut(2, GET_UID_CMD);
      
      if (result.status !== 'ok') {
        return { success: false, error: 'Erreur envoi commande' };
      }

      // Lire la réponse
      const response = await this.device.transferIn(2, 64);
      
      if (response.status === 'ok' && response.data) {
        const uid = this.parseUID(response.data);
        return { success: true, tag: { uid } };
      }

      return { success: false, error: 'Pas de tag détecté' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async writeTag(data: string): Promise<NFCWriteResult> {
    if (!this.device || !this.isConnected) {
      return { success: false, error: 'Lecteur non connecté' };
    }

    try {
      // Écriture NDEF simplifiée
      const encoder = new TextEncoder();
      const payload = encoder.encode(data);
      
      // Construire le message NDEF
      const ndefMessage = this.buildNDEFMessage(payload);
      
      // Commande d'écriture (spécifique au lecteur)
      const WRITE_CMD = new Uint8Array([
        0xFF, 0xD6, 0x00, 0x04, ndefMessage.length,
        ...ndefMessage,
      ]);

      const result = await this.device.transferOut(2, WRITE_CMD);
      
      if (result.status === 'ok') {
        return { success: true };
      }
      
      return { success: false, error: 'Erreur écriture' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private parseUID(data: DataView): string {
    const bytes: string[] = [];
    for (let i = 0; i < Math.min(data.byteLength - 2, 7); i++) {
      bytes.push(data.getUint8(i).toString(16).padStart(2, '0').toUpperCase());
    }
    return bytes.join(':');
  }

  private buildNDEFMessage(payload: Uint8Array): Uint8Array {
    // Message NDEF simplifié pour texte
    const header = new Uint8Array([
      0x03,                           // NDEF message
      payload.length + 7,             // Length
      0xD1,                           // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1
      0x01,                           // Type length
      payload.length + 3,             // Payload length
      0x54,                           // Type: 'T' (text)
      0x02,                           // Status byte: UTF-8, 2-char lang code
      0x66, 0x72,                     // Language: 'fr'
    ]);
    
    const message = new Uint8Array(header.length + payload.length + 1);
    message.set(header);
    message.set(payload, header.length);
    message[message.length - 1] = 0xFE; // Terminator
    
    return message;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getDeviceName(): string | null {
    return this.device?.productName || null;
  }
}

// ================================================
// SERVICE UNIFIÉ
// ================================================

class NFCService {
  private webNFC = new WebNFCService();
  private webUSB = new WebUSBService();
  private currentMode: 'none' | 'webnfc' | 'webusb' = 'none';
  private scanCallback: NFCEventCallback | null = null;
  private pollInterval: number | null = null;

  getCapabilities() {
    return getNFCCapabilities();
  }

  getCurrentMode() {
    return this.currentMode;
  }

  isScanning() {
    return this.currentMode !== 'none';
  }

  // Démarrer le scan avec Web NFC (mobile)
  async startMobileScan(onTagRead: NFCEventCallback): Promise<void> {
    if (this.currentMode !== 'none') {
      this.stopScan();
    }

    this.scanCallback = onTagRead;
    this.currentMode = 'webnfc';
    await this.webNFC.startScan(onTagRead);
  }

  // Connecter le lecteur USB
  async connectUSBReader(): Promise<boolean> {
    const connected = await this.webUSB.connect();
    if (connected) {
      this.currentMode = 'webusb';
    }
    return connected;
  }

  // Démarrer le polling USB
  startUSBPoll(onTagRead: NFCEventCallback, intervalMs = 500): void {
    this.scanCallback = onTagRead;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = window.setInterval(async () => {
      const result = await this.webUSB.readTag();
      if (result.success && result.tag) {
        onTagRead(result.tag);
      }
    }, intervalMs);
  }

  // Arrêter tout scan
  stopScan(): void {
    if (this.currentMode === 'webnfc') {
      this.webNFC.stopScan();
    }
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.currentMode = 'none';
    this.scanCallback = null;
  }

  // Déconnecter USB
  async disconnectUSB(): Promise<void> {
    this.stopScan();
    await this.webUSB.disconnect();
    this.currentMode = 'none';
  }

  // Écrire sur un tag
  async writeTag(data: string): Promise<NFCWriteResult> {
    if (this.currentMode === 'webnfc') {
      return this.webNFC.write(data);
    } else if (this.currentMode === 'webusb') {
      return this.webUSB.writeTag(data);
    }
    return { success: false, error: 'Aucun lecteur connecté' };
  }

  // Lecture unique USB
  async readUSBTag(): Promise<NFCReadResult> {
    return this.webUSB.readTag();
  }

  getUSBDeviceName(): string | null {
    return this.webUSB.getDeviceName();
  }
}

// Instance singleton
export const nfcService = new NFCService();

// Export des classes pour tests
export { WebNFCService, WebUSBService, NFCService };
