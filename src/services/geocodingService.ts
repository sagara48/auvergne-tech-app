/**
 * Service de géocodage utilisant l'API Adresse du gouvernement français
 * https://adresse.data.gouv.fr/api-doc/adresse
 * 
 * API gratuite, sans clé, très précise pour les adresses françaises
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
}

export interface GeocodingError {
  error: string;
  address: string;
}

/**
 * Géocode une adresse unique via l'API Adresse
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  postcode?: string
): Promise<GeocodingResult | null> {
  try {
    // Construire la requête
    let query = address;
    if (city) query += `, ${city}`;
    if (postcode) query += ` ${postcode}`;
    
    const params = new URLSearchParams({
      q: query,
      limit: '1'
    });
    
    // Ajouter le code postal comme filtre si disponible
    if (postcode) {
      params.append('postcode', postcode);
    }
    
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
 * Géocode un ascenseur (adresse + ville + code postal)
 */
export async function geocodeAscenseur(ascenseur: any): Promise<GeocodingResult | null> {
  // Construire l'adresse complète
  let address = ascenseur.adresse || '';
  
  // Essayer différents noms de colonnes pour le nom de l'établissement
  const nomEtablissement = ascenseur.nom_etablissement || ascenseur.nom_batiment || ascenseur.nom || '';
  
  // Si on a un nom d'établissement, l'ajouter pour plus de précision
  if (nomEtablissement && !address.includes(nomEtablissement)) {
    address = `${nomEtablissement}, ${address}`;
  }
  
  return geocodeAddress(address, ascenseur.ville, ascenseur.code_postal);
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
      
      if (result && result.score > 0.4) {
        // Score acceptable (> 40%)
        results.push({
          id: asc.id,
          code_appareil: asc.code_appareil,
          result
        });
        success++;
      } else {
        results.push({
          id: asc.id,
          code_appareil: asc.code_appareil,
          result: null,
          error: result ? `Score trop faible: ${(result.score * 100).toFixed(0)}%` : 'Adresse non trouvée'
        });
        failed++;
      }
      
      if (onProgress) {
        onProgress(i + 1, ascenseurs.length, {
          code: asc.code_appareil,
          success: result !== null && result.score > 0.4
        });
      }
      
      // Pause de 50ms entre chaque requête pour respecter les limites
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      results.push({
        id: asc.id,
        code_appareil: asc.code_appareil,
        result: null,
        error: String(error)
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
 * Géocode et met à jour en masse les ascenseurs sans coordonnées
 */
export async function geocodeAndUpdateAll(
  onProgress?: (current: number, total: number, lastResult: { code: string; success: boolean }) => void
): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
}> {
  // Récupérer tous les ascenseurs sans coordonnées
  // On utilise select('*') pour éviter les erreurs de colonnes inexistantes
  const { data: ascenseurs, error } = await supabase
    .from('parc_ascenseurs')
    .select('*');
  
  if (error || !ascenseurs) {
    console.error('Erreur récupération ascenseurs:', error);
    return { total: 0, success: 0, failed: 0, skipped: 0 };
  }
  
  // Filtrer ceux qui n'ont pas de coordonnées
  const toGeocode = ascenseurs.filter((a: any) => !a.latitude || !a.longitude);
  const skipped = ascenseurs.length - toGeocode.length;
  
  console.log(`Géocodage de ${toGeocode.length} ascenseurs (${skipped} déjà géocodés)`);
  
  // Géocoder en masse
  const { success, failed, results } = await geocodeBatch(toGeocode, onProgress);
  
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
    }
  }
  
  console.log(`Géocodage terminé: ${updated} mis à jour, ${failed} échecs`);
  
  return {
    total: toGeocode.length,
    success: updated,
    failed,
    skipped
  };
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
