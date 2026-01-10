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

  useEffect(() => {
    const caps = nfcService.getCapabilities();
    setState(s => ({ ...s, available: caps.any }));
  }, []);

  const startReading = useCallback(async (onTag: (uid: string, deviceType: string) => void) => {
    setState(s => ({ ...s, reading: true, error: undefined }));
    
    try {
      await nfcService.startReading(
        (result) => {
          setState(s => ({ ...s, lastTag: result.uid }));
          onTag(result.uid, result.deviceType);
        },
        (error) => {
          setState(s => ({ ...s, error: error.message }));
        }
      );
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
      const uid = await nfcService.writeTag(data);
      setState(s => ({ ...s, writing: false, lastTag: uid }));
      return uid;
    } catch (error: any) {
      setState(s => ({ ...s, writing: false, error: error.message }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: undefined }));
  }, []);

  return {
    ...state,
    capabilities: nfcService.getCapabilities(),
    startReading,
    stopReading,
    writeTag,
    clearError,
  };
}
