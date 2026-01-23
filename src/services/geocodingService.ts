/**
 * Service de géocodage utilisant l'API Adresse du gouvernement français
 * https://adresse.data.gouv.fr/api-doc/adresse
 * 
 * API gratuite, sans clé, très précise pour les adresses françaises
 * 
 * Avec stratégies de fallback pour les adresses difficiles
 */

import { supabase } from './supabase';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  score: number; // Score de confiance (0-1)
  label: string; // Adresse normalisée
  city: string;
  postcode: string;
  type: string; // housenumber, street, municipality, etc.
  strategy?: string; // Quelle stratégie a fonctionné
}

export interface GeocodingError {
  error: string;
  address: string;
}

/**
 * Nettoie et normalise une adresse pour améliorer le géocodage
 */
function cleanAddress(address: string): string {
  if (!address) return '';
  
  let cleaned = address
    // Supprimer les caractères spéciaux problématiques
    .replace(/[«»""„‟]/g, '')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Normaliser les abréviations courantes
  const abbreviations: Record<string, string> = {
    'av\\.': 'avenue',
    'av ': 'avenue ',
    'bd\\.': 'boulevard',
    'bd ': 'boulevard ',
    'bvd\\.': 'boulevard',
    'bvd ': 'boulevard ',
    'pl\\.': 'place',
    'pl ': 'place ',
    'r\\.': 'rue',
    'r ': 'rue ',
    'imp\\.': 'impasse',
    'imp ': 'impasse ',
    'all\\.': 'allée',
    'all ': 'allée ',
    'crs\\.': 'cours',
    'crs ': 'cours ',
    'ch\\.': 'chemin',
    'ch ': 'chemin ',
    'rte\\.': 'route',
    'rte ': 'route ',
    'sq\\.': 'square',
    'sq ': 'square ',
    'résid\\.': 'résidence',
    'résid ': 'résidence ',
    'rés\\.': 'résidence',
    'rés ': 'résidence ',
    'bat\\.': 'bâtiment',
    'bat ': 'bâtiment ',
    'bât\\.': 'bâtiment',
    'bât ': 'bâtiment ',
    'appt\\.': '',
    'appt ': '',
    'apt\\.': '',
    'apt ': '',
    'esc\\.': '',
    'esc ': '',
    'etg\\.': '',
    'etg ': '',
    'étage': '',
  };
  
  for (const [abbr, full] of Object.entries(abbreviations)) {
    cleaned = cleaned.replace(new RegExp(abbr, 'gi'), full);
  }
  
  // Supprimer les infos d'étage, appartement, escalier
  cleaned = cleaned.replace(/\b(étage|etage|esc|escalier|appt?|appartement|porte|bat|bâtiment)\s*[a-z0-9]*\b/gi, '');
  
  // Supprimer les doublons d'espaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Extrait le numéro et la rue d'une adresse
 */
function extractStreetNumber(address: string): { number: string; street: string } {
  const match = address.match(/^(\d+[\s,\-]*(?:bis|ter|quater)?)\s*[,\s]*(.+)$/i);
  if (match) {
    return { number: match[1].trim(), street: match[2].trim() };
  }
  return { number: '', street: address };
}

/**
 * Géocode une adresse avec l'API Adresse
 */
async function geocodeWithAPI(
  query: string,
  postcode?: string,
  citycode?: string
): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '1'
    });
    
    if (postcode) params.append('postcode', postcode);
    if (citycode) params.append('citycode', citycode);
    
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?${params.toString()}`
    );
    
    if (!response.ok) {
      console.error('Erreur API Adresse:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      
      return {
        latitude: coords[1],
        longitude: coords[0],
        score: props.score,
        label: props.label,
        city: props.city,
        postcode: props.postcode,
        type: props.type
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Géocode une adresse avec Nominatim (OpenStreetMap) en fallback
 */
async function geocodeWithNominatim(
  address: string,
  city?: string,
  postcode?: string
): Promise<GeocodingResult | null> {
  try {
    let query = address;
    if (city) query += `, ${city}`;
    if (postcode) query += ` ${postcode}`;
    query += ', France';
    
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'fr'
    });
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'AuvergneTechApp/1.0'
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        score: 0.7, // Score arbitraire pour Nominatim
        label: result.display_name,
        city: city || '',
        postcode: postcode || '',
        type: result.type,
        strategy: 'nominatim'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erreur Nominatim:', error);
    return null;
  }
}

/**
 * Géocode une adresse unique via l'API Adresse
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  postcode?: string
): Promise<GeocodingResult | null> {
  // Construire la requête
  let query = address;
  if (city) query += `, ${city}`;
  if (postcode) query += ` ${postcode}`;
  
  return geocodeWithAPI(query, postcode);
}

/**
 * Géocode un ascenseur avec plusieurs stratégies de fallback
 */
export async function geocodeAscenseur(ascenseur: any): Promise<GeocodingResult | null> {
  const adresseOriginal = ascenseur.adresse || '';
  const adresse = cleanAddress(adresseOriginal);
  const ville = (ascenseur.ville || '').trim();
  const codePostal = (ascenseur.code_postal || '').trim();
  const nomBatiment = cleanAddress(ascenseur.nom_etablissement || ascenseur.nom_batiment || ascenseur.nom || '');
  
  // Si pas de ville, on ne peut pas géocoder
  if (!ville) {
    console.log(`✗ Pas de ville: ${ascenseur.code_appareil}`);
    return null;
  }
  
  const strategies: Array<{
    name: string;
    query: string;
    postcode?: string;
    minScore: number;
  }> = [];
  
  // Stratégie 1: Adresse complète nettoyée + ville + code postal
  if (adresse) {
    strategies.push({
      name: 'adresse_complete',
      query: `${adresse}, ${ville}`,
      postcode: codePostal,
      minScore: 0.4
    });
  }
  
  // Stratégie 2: Numéro + rue + ville (sans nom de bâtiment)
  const { number, street } = extractStreetNumber(adresse);
  if (number && street) {
    strategies.push({
      name: 'numero_rue_ville',
      query: `${number} ${street}, ${ville}`,
      postcode: codePostal,
      minScore: 0.4
    });
  }
  
  // Stratégie 3: Juste la rue + ville (sans numéro)
  if (street) {
    strategies.push({
      name: 'rue_ville',
      query: `${street}, ${ville}`,
      postcode: codePostal,
      minScore: 0.35
    });
  }
  
  // Stratégie 4: Nom du bâtiment + ville (pour les lieux connus)
  if (nomBatiment && nomBatiment.length > 3) {
    strategies.push({
      name: 'batiment_ville',
      query: `${nomBatiment}, ${ville}`,
      postcode: codePostal,
      minScore: 0.4
    });
  }
  
  // Stratégie 5: Adresse originale (sans nettoyage) - parfois mieux
  if (adresseOriginal && adresseOriginal !== adresse) {
    strategies.push({
      name: 'adresse_originale',
      query: `${adresseOriginal}, ${ville}`,
      postcode: codePostal,
      minScore: 0.4
    });
  }
  
  // Essayer chaque stratégie avec l'API Adresse
  for (const strategy of strategies) {
    const result = await geocodeWithAPI(strategy.query, strategy.postcode);
    
    if (result && result.score >= strategy.minScore) {
      result.strategy = strategy.name;
      console.log(`✓ Géocodé [${strategy.name}]: ${ascenseur.code_appareil} (score: ${(result.score * 100).toFixed(0)}%)`);
      return result;
    }
    
    // Pause entre les requêtes
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  // Fallback: Essayer Nominatim (OpenStreetMap) avec adresse
  if (adresse) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Nominatim rate limit
    const nominatimResult = await geocodeWithNominatim(adresse, ville, codePostal);
    if (nominatimResult) {
      nominatimResult.strategy = 'nominatim';
      console.log(`✓ Géocodé [nominatim]: ${ascenseur.code_appareil}`);
      return nominatimResult;
    }
  }
  
  // Fallback: Nominatim avec juste la rue
  if (street) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const nominatimStreet = await geocodeWithNominatim(street, ville, codePostal);
    if (nominatimStreet) {
      nominatimStreet.strategy = 'nominatim_rue';
      console.log(`✓ Géocodé [nominatim_rue]: ${ascenseur.code_appareil}`);
      return nominatimStreet;
    }
  }
  
  // FALLBACK FINAL: Centre-ville (position approximative mais mieux que rien)
  console.log(`⚠ Fallback centre-ville pour: ${ascenseur.code_appareil}`);
  const centreVille = await geocodeWithAPI(ville, codePostal);
  if (centreVille) {
    centreVille.strategy = 'centre_ville';
    centreVille.score = 0.2; // Score bas pour indiquer approximation
    centreVille.type = 'municipality';
    console.log(`✓ Géocodé [centre_ville]: ${ascenseur.code_appareil} -> ${ville}`);
    return centreVille;
  }
  
  console.log(`✗ Échec total: ${ascenseur.code_appareil} - ${adresse}, ${ville}`);
  return null;
}

/**
 * Géocode en masse plusieurs ascenseurs
 * Respecte la limite de l'API (environ 50 requêtes/seconde)
 */
export async function geocodeBatch(
  ascenseurs: any[],
  onProgress?: (current: number, total: number, lastResult: { code: string; success: boolean }) => void
): Promise<{
  success: number;
  failed: number;
  results: Array<{
    id: number;
    code_appareil: string;
    result: GeocodingResult | null;
    error?: string;
  }>;
}> {
  const results: Array<{
    id: number;
    code_appareil: string;
    result: GeocodingResult | null;
    error?: string;
  }> = [];
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < ascenseurs.length; i++) {
    const asc = ascenseurs[i];
    
    try {
      const result = await geocodeAscenseur(asc);
      
      // Le score est déjà vérifié dans geocodeAscenseur avec des seuils par stratégie
      if (result) {
        results.push({
          id: asc.id,
          code_appareil: asc.code_appareil,
          result,
          adresse: asc.adresse,
          ville: asc.ville
        });
        success++;
      } else {
        results.push({
          id: asc.id,
          code_appareil: asc.code_appareil,
          result: null,
          error: 'Adresse non trouvée',
          adresse: asc.adresse,
          ville: asc.ville
        });
        failed++;
      }
      
      if (onProgress) {
        onProgress(i + 1, ascenseurs.length, {
          code: asc.code_appareil,
          success: result !== null
        });
      }
      
      // Pause de 100ms entre chaque requête (Nominatim limite à 1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.push({
        id: asc.id,
        code_appareil: asc.code_appareil,
        result: null,
        error: String(error),
        adresse: asc.adresse,
        ville: asc.ville
      });
      failed++;
    }
  }
  
  return { success, failed, results };
}

/**
 * Met à jour les coordonnées GPS d'un ascenseur dans Supabase
 */
export async function updateAscenseurCoordinates(
  id: number,
  latitude: number,
  longitude: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('parc_ascenseurs')
      .update({
        latitude,
        longitude,
        geocoded_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) {
      console.error('Erreur mise à jour coordonnées:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur mise à jour coordonnées:', error);
    return false;
  }
}

/**
 * Géocode et met à jour en masse les ascenseurs
 * @param forceAll - Si true, re-géocode même les ascenseurs déjà géocodés
 * @param onProgress - Callback de progression
 */
export async function geocodeAndUpdateAll(
  onProgress?: (current: number, total: number, lastResult: { code: string; success: boolean }) => void,
  forceAll: boolean = false
): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
  failures: Array<{ id: number; code: string; adresse: string; ville: string; error: string }>;
}> {
  // Récupérer TOUS les ascenseurs avec pagination (Supabase limite à 1000)
  console.log('Récupération de tous les ascenseurs...');
  const allAscenseurs: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('parc_ascenseurs')
      .select('*')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Erreur récupération ascenseurs:', error);
      break;
    }
    
    if (data && data.length > 0) {
      allAscenseurs.push(...data);
      console.log(`Récupéré ${allAscenseurs.length} ascenseurs...`);
      from += batchSize;
      if (data.length < batchSize) break; // Plus de données
    } else {
      break;
    }
  }
  
  console.log(`Total ascenseurs récupérés: ${allAscenseurs.length}`);
  
  if (allAscenseurs.length === 0) {
    return { total: 0, success: 0, failed: 0, skipped: 0, failures: [] };
  }
  
  // Filtrer selon le mode
  let toGeocode: any[];
  let skipped: number;
  
  if (forceAll) {
    toGeocode = allAscenseurs;
    skipped = 0;
    console.log(`Géocodage FORCÉ de ${toGeocode.length} ascenseurs`);
  } else {
    toGeocode = allAscenseurs.filter((a: any) => !a.latitude || !a.longitude);
    skipped = allAscenseurs.length - toGeocode.length;
    console.log(`Géocodage de ${toGeocode.length} ascenseurs (${skipped} déjà géocodés)`);
  }
  
  if (toGeocode.length === 0) {
    return { total: 0, success: 0, failed: 0, skipped, failures: [] };
  }
  
  // Géocoder en masse
  const { success, failed, results } = await geocodeBatch(toGeocode, onProgress);
  
  // Collecter les échecs
  const failures: Array<{ id: number; code: string; adresse: string; ville: string; error: string }> = [];
  
  // Mettre à jour les coordonnées en base
  let updated = 0;
  for (const item of results) {
    if (item.result) {
      const ok = await updateAscenseurCoordinates(
        item.id,
        item.result.latitude,
        item.result.longitude
      );
      if (ok) updated++;
    } else {
      failures.push({
        id: item.id,
        code: item.code_appareil,
        adresse: (item as any).adresse || '',
        ville: (item as any).ville || '',
        error: item.error || 'Inconnu'
      });
    }
  }
  
  console.log(`Géocodage terminé: ${updated} mis à jour, ${failed} échecs`);
  
  return {
    total: toGeocode.length,
    success: updated,
    failed,
    skipped,
    failures
  };
}

/**
 * Récupère les ascenseurs non géocodés (avec pagination)
 */
export async function getUnGeocodedAscenseurs(): Promise<any[]> {
  const allAscenseurs: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('parc_ascenseurs')
      .select('id, code_appareil, adresse, ville, code_postal, latitude, longitude')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Erreur récupération ascenseurs:', error);
      break;
    }
    
    if (data && data.length > 0) {
      // Filtrer ceux sans GPS
      const sansGPS = data.filter((a: any) => !a.latitude || !a.longitude);
      allAscenseurs.push(...sansGPS);
      from += batchSize;
      if (data.length < batchSize) break;
    } else {
      break;
    }
  }
  
  return allAscenseurs;
}

/**
 * Met à jour manuellement les coordonnées d'un ascenseur
 */
export async function setManualCoordinates(
  id: number,
  latitude: number,
  longitude: number
): Promise<boolean> {
  return updateAscenseurCoordinates(id, latitude, longitude);
}

/**
 * Recherche d'adresses (autocomplétion)
 */
export async function searchAddresses(
  query: string,
  limit: number = 5
): Promise<GeocodingResult[]> {
  try {
    if (query.length < 3) return [];
    
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      type: 'housenumber' // Priorité aux numéros de rue
    });
    
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?${params.toString()}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return (data.features || []).map((feature: any) => ({
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      score: feature.properties.score,
      label: feature.properties.label,
      city: feature.properties.city,
      postcode: feature.properties.postcode,
      type: feature.properties.type
    }));
  } catch (error) {
    console.error('Erreur recherche adresses:', error);
    return [];
  }
}

/**
 * Géocodage inverse (coordonnées -> adresse)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude)
    });
    
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/reverse/?${params.toString()}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const props = feature.properties;
      
      return {
        latitude,
        longitude,
        score: props.score || 1,
        label: props.label,
        city: props.city,
        postcode: props.postcode,
        type: props.type
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erreur géocodage inverse:', error);
    return null;
  }
}
