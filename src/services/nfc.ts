/**
 * Service NFC unifié pour AuvergneTech
 * Supporte Web NFC (mobile Chrome Android), WebSocket (serveur local), et WebUSB (fallback)
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
    webSocket: true, // Toujours disponible si le serveur tourne
    anySupported: isWebNFCSupported() || isWebUSBSupported() || true,
  };
}

// ================================================
// WEBSOCKET SERVICE (Serveur NFC Local)
// ================================================

class WebSocketNFCService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private serverUrl = 'ws://localhost:8765';
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private pollInterval: number | null = null;
  private onTagCallback: NFCEventCallback | null = null;

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.onopen = () => {
          console.log('✅ Connecté au serveur NFC local');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve(true);
        };

        this.ws.onclose = () => {
          console.log('❌ Déconnecté du serveur NFC local');
          this.isConnected = false;
          this.stopPoll();
        };

        this.ws.onerror = (error) => {
          console.error('Erreur WebSocket NFC:', error);
          this.isConnected = false;
          reject(new Error('Impossible de se connecter au serveur NFC local. Lancez nfc_server.py'));
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Si c'est une réponse de poll avec un tag
            if (data.success && data.present && data.uid && this.onTagCallback) {
              this.onTagCallback({ uid: this.formatUID(data.uid) });
            }
          } catch (e) {
            console.error('Erreur parsing message NFC:', e);
          }
        };

        // Timeout de connexion
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('Timeout de connexion au serveur NFC'));
          }
        }, 3000);

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopPoll();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private sendCommand(command: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.isConnected) {
        reject(new Error('Non connecté au serveur NFC'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.ws?.removeEventListener('message', handleMessage);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };

      this.ws.addEventListener('message', handleMessage);
      this.ws.send(JSON.stringify({ command, ...params }));

      // Timeout
      setTimeout(() => {
        this.ws?.removeEventListener('message', handleMessage);
        reject(new Error('Timeout commande NFC'));
      }, 5000);
    });
  }

  async getUID(): Promise<NFCReadResult> {
    try {
      const result = await this.sendCommand('getUID');
      if (result.success) {
        return { 
          success: true, 
          tag: { uid: this.formatUID(result.uid) } 
        };
      }
      return { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async readBlock(block: number): Promise<any> {
    return this.sendCommand('readBlock', { block });
  }

  async writeBlock(block: number, data: string): Promise<NFCWriteResult> {
    try {
      const result = await this.sendCommand('writeBlock', { block, data });
      return { success: result.success, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  startPoll(onTagRead: NFCEventCallback, intervalMs = 500): void {
    this.onTagCallback = onTagRead;
    this.stopPoll();
    
    let lastUID: string | null = null;

    this.pollInterval = window.setInterval(async () => {
      if (!this.ws || !this.isConnected) return;
      
      try {
        this.ws.send(JSON.stringify({ command: 'poll' }));
      } catch (e) {
        // Ignore
      }
    }, intervalMs);

    // Écouter les réponses de poll
    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.success && data.present && data.uid) {
            const formattedUID = this.formatUID(data.uid);
            if (formattedUID !== lastUID) {
              lastUID = formattedUID;
              onTagRead({ uid: formattedUID });
            }
          } else if (!data.present) {
            lastUID = null;
          }
        } catch (e) {
          // Ignore
        }
      };
    }
  }

  stopPoll(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.onTagCallback = null;
  }

  private formatUID(uid: string): string {
    if (!uid) return 'UNKNOWN';
    // Formater en XX:XX:XX:XX:XX:XX:XX
    const hex = uid.replace(/:/g, '').toUpperCase();
    return hex.match(/.{1,2}/g)?.join(':') || uid;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async listReaders(): Promise<string[]> {
    try {
      const result = await this.sendCommand('listReaders');
      return result.readers || [];
    } catch {
      return [];
    }
  }
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
// SERVICE UNIFIÉ
// ================================================

class NFCService {
  private webNFC = new WebNFCService();
  private webSocket = new WebSocketNFCService();
  private currentMode: 'none' | 'webnfc' | 'websocket' = 'none';
  private scanCallback: NFCEventCallback | null = null;

  getCapabilities() {
    return getNFCCapabilities();
  }

  getCurrentMode() {
    return this.currentMode;
  }

  isScanning() {
    return this.currentMode !== 'none';
  }

  isConnected() {
    return this.webSocket.getIsConnected();
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

  // Connecter au serveur NFC local (WebSocket)
  async connectLocalServer(): Promise<boolean> {
    try {
      const connected = await this.webSocket.connect();
      if (connected) {
        this.currentMode = 'websocket';
      }
      return connected;
    } catch (error) {
      throw error;
    }
  }

  // Démarrer le polling via WebSocket
  startLocalPoll(onTagRead: NFCEventCallback, intervalMs = 500): void {
    this.scanCallback = onTagRead;
    this.webSocket.startPoll(onTagRead, intervalMs);
  }

  // Arrêter tout scan
  stopScan(): void {
    if (this.currentMode === 'webnfc') {
      this.webNFC.stopScan();
    } else if (this.currentMode === 'websocket') {
      this.webSocket.stopPoll();
    }

    this.currentMode = 'none';
    this.scanCallback = null;
  }

  // Déconnecter
  async disconnect(): Promise<void> {
    this.stopScan();
    await this.webSocket.disconnect();
    this.currentMode = 'none';
  }

  // Écrire sur un tag
  async writeTag(data: string, block = 4): Promise<NFCWriteResult> {
    if (this.currentMode === 'webnfc') {
      return this.webNFC.write(data);
    } else if (this.currentMode === 'websocket') {
      return this.webSocket.writeBlock(block, data);
    }
    return { success: false, error: 'Aucun lecteur connecté' };
  }

  // Lecture unique via WebSocket
  async readTag(): Promise<NFCReadResult> {
    return this.webSocket.getUID();
  }

  // Lister les lecteurs disponibles
  async listReaders(): Promise<string[]> {
    return this.webSocket.listReaders();
  }
}

// Instance singleton
export const nfcService = new NFCService();

// Export des classes pour tests
export { WebNFCService, WebSocketNFCService, NFCService };
