/**
 * Service OCR pour extraction de texte depuis images et PDFs
 * Utilise Tesseract.js pour la reconnaissance de caractères
 */

// Configuration OCR
interface OCRConfig {
  language: string;
  workerPath?: string;
  corePath?: string;
  langPath?: string;
}

interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  processingTime: number;
}

interface OCRBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

// État du worker Tesseract
let tesseractWorker: any = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialiser le worker Tesseract
 */
async function initTesseract(config: OCRConfig = { language: 'fra' }): Promise<void> {
  if (tesseractWorker) return;
  if (initPromise) return initPromise;
  
  isInitializing = true;
  
  initPromise = (async () => {
    try {
      // Import dynamique de Tesseract.js
      const Tesseract = await import('tesseract.js');
      
      tesseractWorker = await Tesseract.createWorker(config.language, 1, {
        workerPath: config.workerPath || 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        corePath: config.corePath || 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
        langPath: config.langPath || 'https://tessdata.projectnaptha.com/4.0.0',
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            // Progression disponible via m.progress (0-1)
            console.log(`OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      console.log('Tesseract initialisé avec succès');
    } catch (error) {
      console.error('Erreur initialisation Tesseract:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initPromise;
}

/**
 * Extraire le texte d'une image
 */
export async function extractTextFromImage(
  imageSource: string | File | Blob,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const startTime = Date.now();
  
  await initTesseract();
  
  if (!tesseractWorker) {
    throw new Error('Worker Tesseract non initialisé');
  }
  
  try {
    // Configurer le callback de progression
    if (onProgress) {
      tesseractWorker.setParameters({
        tessedit_pageseg_mode: 1 // Auto avec OSD
      });
    }
    
    const result = await tesseractWorker.recognize(imageSource);
    
    const ocrResult: OCRResult = {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      blocks: result.data.blocks?.map((block: any) => ({
        text: block.text,
        confidence: block.confidence,
        bbox: block.bbox
      })) || [],
      processingTime: Date.now() - startTime
    };
    
    return ocrResult;
  } catch (error) {
    console.error('Erreur OCR:', error);
    throw error;
  }
}

/**
 * Extraire le texte de plusieurs images
 */
export async function extractTextFromImages(
  images: (string | File | Blob)[],
  onProgress?: (current: number, total: number) => void
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];
  
  for (let i = 0; i < images.length; i++) {
    if (onProgress) {
      onProgress(i + 1, images.length);
    }
    
    const result = await extractTextFromImage(images[i]);
    results.push(result);
  }
  
  return results;
}

/**
 * Terminer le worker Tesseract
 */
export async function terminateTesseract(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
    initPromise = null;
  }
}

/**
 * Recherche full-text dans le texte extrait
 */
export function searchInText(text: string, query: string): SearchMatch[] {
  if (!query.trim()) return [];
  
  const matches: SearchMatch[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const words = lowerQuery.split(/\s+/);
  
  // Recherche de la phrase exacte
  let pos = 0;
  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    const start = Math.max(0, pos - 50);
    const end = Math.min(text.length, pos + query.length + 50);
    
    matches.push({
      type: 'exact',
      position: pos,
      context: text.substring(start, end),
      highlight: text.substring(pos, pos + query.length)
    });
    
    pos += query.length;
  }
  
  // Si pas de correspondance exacte, rechercher les mots individuels
  if (matches.length === 0 && words.length > 1) {
    words.forEach(word => {
      if (word.length < 3) return;
      
      let pos = 0;
      while ((pos = lowerText.indexOf(word, pos)) !== -1) {
        const start = Math.max(0, pos - 30);
        const end = Math.min(text.length, pos + word.length + 30);
        
        matches.push({
          type: 'partial',
          position: pos,
          context: text.substring(start, end),
          highlight: text.substring(pos, pos + word.length)
        });
        
        pos += word.length;
      }
    });
  }
  
  // Limiter et dédupliquer
  const uniqueMatches = matches
    .filter((match, index, self) => 
      index === self.findIndex(m => Math.abs(m.position - match.position) < 20)
    )
    .slice(0, 10);
  
  return uniqueMatches;
}

interface SearchMatch {
  type: 'exact' | 'partial';
  position: number;
  context: string;
  highlight: string;
}

/**
 * Convertir un PDF en images pour OCR (nécessite pdf.js)
 */
export async function pdfToImages(pdfFile: File): Promise<string[]> {
  try {
    // Import dynamique de pdf.js
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      images.push(canvas.toDataURL('image/png'));
    }
    
    return images;
  } catch (error) {
    console.error('Erreur conversion PDF:', error);
    throw error;
  }
}

/**
 * Extraire le texte d'un PDF via OCR
 */
export async function extractTextFromPDF(
  pdfFile: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const images = await pdfToImages(pdfFile);
  
  if (onProgress) {
    onProgress(0, images.length);
  }
  
  const results = await extractTextFromImages(images, onProgress);
  
  return results.map(r => r.text).join('\n\n--- Page suivante ---\n\n');
}

/**
 * Analyser un document et extraire les métadonnées
 */
export interface DocumentMetadata {
  type?: string;
  date?: string;
  montant?: number;
  reference?: string;
  entreprise?: string;
  keywords: string[];
}

export function analyzeDocumentText(text: string): DocumentMetadata {
  const metadata: DocumentMetadata = {
    keywords: []
  };
  
  // Détecter le type de document
  const lowerText = text.toLowerCase();
  if (lowerText.includes('facture') || lowerText.includes('invoice')) {
    metadata.type = 'facture';
  } else if (lowerText.includes('devis') || lowerText.includes('quotation')) {
    metadata.type = 'devis';
  } else if (lowerText.includes('contrat') || lowerText.includes('contract')) {
    metadata.type = 'contrat';
  } else if (lowerText.includes('rapport') || lowerText.includes('report')) {
    metadata.type = 'rapport';
  } else if (lowerText.includes('certificat') || lowerText.includes('certificate')) {
    metadata.type = 'certificat';
  }
  
  // Extraire les dates (format français)
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }
  
  // Extraire les montants
  const montantMatch = text.match(/(\d+[\s\u00A0]?\d*[,\.]\d{2})\s*€/);
  if (montantMatch) {
    metadata.montant = parseFloat(montantMatch[1].replace(/[\s\u00A0]/g, '').replace(',', '.'));
  }
  
  // Extraire les références (numéro de facture, etc.)
  const refMatch = text.match(/(?:n[°o]|ref|référence|numéro)[\s:]*([A-Z0-9\-\/]+)/i);
  if (refMatch) {
    metadata.reference = refMatch[1];
  }
  
  // Extraire les mots-clés importants
  const keywords = new Set<string>();
  const importantWords = [
    'ascenseur', 'maintenance', 'réparation', 'contrôle', 'visite',
    'panne', 'intervention', 'contrat', 'garantie', 'certification',
    'sécurité', 'conformité', 'inspection', 'urgence', 'pièce'
  ];
  
  importantWords.forEach(word => {
    if (lowerText.includes(word)) {
      keywords.add(word);
    }
  });
  
  metadata.keywords = Array.from(keywords);
  
  return metadata;
}

/**
 * Stocker le texte OCR dans le document (localStorage comme cache)
 */
export function cacheOCRText(documentId: string, text: string, metadata?: DocumentMetadata): void {
  try {
    const cache = JSON.parse(localStorage.getItem('ocr_cache') || '{}');
    cache[documentId] = {
      text,
      metadata,
      timestamp: Date.now()
    };
    localStorage.setItem('ocr_cache', JSON.stringify(cache));
  } catch (e) {
    console.warn('Erreur cache OCR:', e);
  }
}

/**
 * Récupérer le texte OCR depuis le cache
 */
export function getCachedOCRText(documentId: string): { text: string; metadata?: DocumentMetadata } | null {
  try {
    const cache = JSON.parse(localStorage.getItem('ocr_cache') || '{}');
    const entry = cache[documentId];
    
    if (entry) {
      // Cache valide pendant 30 jours
      if (Date.now() - entry.timestamp < 30 * 24 * 60 * 60 * 1000) {
        return { text: entry.text, metadata: entry.metadata };
      }
    }
  } catch (e) {
    console.warn('Erreur lecture cache OCR:', e);
  }
  return null;
}

/**
 * Recherche full-text dans tous les documents cachés
 */
export function searchAllDocuments(query: string): Array<{ documentId: string; matches: SearchMatch[] }> {
  try {
    const cache = JSON.parse(localStorage.getItem('ocr_cache') || '{}');
    const results: Array<{ documentId: string; matches: SearchMatch[] }> = [];
    
    Object.entries(cache).forEach(([documentId, entry]: [string, any]) => {
      if (entry.text) {
        const matches = searchInText(entry.text, query);
        if (matches.length > 0) {
          results.push({ documentId, matches });
        }
      }
    });
    
    return results;
  } catch (e) {
    console.warn('Erreur recherche documents:', e);
    return [];
  }
}
