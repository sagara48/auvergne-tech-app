import { useState, useEffect, useCallback } from 'react';
import { nfcService, NFCWriteData } from '@/services/nfcService';
import type { NFCReaderState } from '@/types';

export function useNFC() {
  const [state, setState] = useState<NFCReaderState>({
    available: false,
    reading: false,
    writing: false,
    error: undefined,
    lastTag: undefined,
  });

  const [isUSBConnected, setIsUSBConnected] = useState(false);

  useEffect(() => {
    const caps = nfcService.getCapabilities();
    setState(s => ({ ...s, available: caps.any }));
  }, []);

  const startReading = useCallback(async (onTag: (uid: string, deviceType: string) => void) => {
    setState(s => ({ ...s, reading: true, error: undefined }));
    
    try {
      const mode = nfcService.getBestAvailableMode();
      
      if (mode === 'web_nfc') {
        await nfcService.startWebNFCReading(
          (result) => {
            setState(s => ({ ...s, lastTag: result.uid }));
            onTag(result.uid, result.deviceType);
          },
          (error) => {
            setState(s => ({ ...s, error: error.message }));
          }
        );
      } else if (mode === 'web_usb') {
        if (!nfcService.isUSBConnected()) {
          await nfcService.connectUSBReader();
          setIsUSBConnected(true);
        }
        nfcService.startUSBPolling(
          (result) => {
            setState(s => ({ ...s, lastTag: result.uid }));
            onTag(result.uid, result.deviceType);
          },
          (error) => {
            setState(s => ({ ...s, error: error.message }));
          }
        );
      } else {
        throw new Error('Aucun lecteur NFC disponible');
      }
    } catch (error: any) {
      setState(s => ({ ...s, reading: false, error: error.message }));
      throw error;
    }
  }, []);

  const stopReading = useCallback(async () => {
    await nfcService.stopReading();
    setState(s => ({ ...s, reading: false }));
  }, []);

  const writeTag = useCallback(async (data: NFCWriteData): Promise<string> => {
    setState(s => ({ ...s, writing: true, error: undefined }));
    
    try {
      const mode = nfcService.getBestAvailableMode();
      let uid: string;
      
      if (mode === 'web_nfc') {
        uid = await nfcService.writeWebNFC(data);
      } else if (mode === 'web_usb') {
        if (!nfcService.isUSBConnected()) {
          await nfcService.connectUSBReader();
          setIsUSBConnected(true);
        }
        uid = await nfcService.writeUSBTag(data);
      } else {
        throw new Error('Aucun lecteur NFC disponible');
      }
      
      setState(s => ({ ...s, writing: false, lastTag: uid }));
      return uid;
    } catch (error: any) {
      setState(s => ({ ...s, writing: false, error: error.message }));
      throw error;
    }
  }, []);

  const connectUSB = useCallback(async () => {
    try {
      await nfcService.connectUSBReader();
      setIsUSBConnected(true);
      setState(s => ({ ...s, error: undefined }));
      return true;
    } catch (error: any) {
      setState(s => ({ ...s, error: error.message }));
      return false;
    }
  }, []);

  const disconnectUSB = useCallback(async () => {
    await nfcService.disconnectUSB();
    setIsUSBConnected(false);
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: undefined }));
  }, []);

  return {
    ...state,
    capabilities: nfcService.getCapabilities(),
    isUSBConnected,
    startReading,
    stopReading,
    writeTag,
    connectUSB,
    disconnectUSB,
    clearError,
  };
}
