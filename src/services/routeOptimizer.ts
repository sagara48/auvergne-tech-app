/**
 * Service d'optimisation des tournées
 * Calcul des distances, temps de trajet et optimisation de l'ordre de passage
 */

export interface Location {
  id: number | string;
  code: string;
  adresse: string;
  ville: string;
  codePostal?: string;
  lat?: number;
  lng?: number;
  priorite?: number;
  tempsIntervention?: number; // en minutes
}

export interface RouteSegment {
  from: Location;
  to: Location;
  distance: number; // en km
  duration: number; // en minutes
  polyline?: string;
}

export interface OptimizedRoute {
  locations: Location[];
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  totalInterventionTime: number;
  estimatedEndTime: Date;
  savings?: {
    distance: number;
    duration: number;
  };
}

// Coordonnées des villes d'Auvergne (fallback)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'clermont-ferrand': { lat: 45.7772, lng: 3.0870 },
  'vichy': { lat: 46.1278, lng: 3.4253 },
  'montluçon': { lat: 46.3422, lng: 2.6031 },
  'moulins': { lat: 46.5673, lng: 3.3326 },
  'aurillac': { lat: 44.9267, lng: 2.4454 },
  'le puy-en-velay': { lat: 45.0430, lng: 3.8845 },
  'riom': { lat: 45.8947, lng: 3.1142 },
  'issoire': { lat: 45.5448, lng: 3.2499 },
  'thiers': { lat: 45.8575, lng: 3.5478 },
  'cournon-d\'auvergne': { lat: 45.7403, lng: 3.1969 },
  'chamalières': { lat: 45.7744, lng: 3.0644 },
  'royat': { lat: 45.7625, lng: 3.0492 },
};

/**
 * Obtenir les coordonnées d'une adresse (via Nominatim ou cache)
 */
export async function geocodeAddress(adresse: string, ville: string): Promise<{ lat: number; lng: number } | null> {
  // Vérifier le cache local
  const cacheKey = `geo_${ville.toLowerCase()}_${adresse.substring(0, 20)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }
  
  // Fallback sur les coordonnées de ville connues
  const normalizedVille = ville.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalizedVille.includes(key) || key.includes(normalizedVille)) {
      // Ajouter un léger offset basé sur l'adresse pour différencier
      const offset = (hashCode(adresse) % 100) / 10000;
      const result = { lat: coords.lat + offset, lng: coords.lng + offset };
      localStorage.setItem(cacheKey, JSON.stringify(result));
      return result;
    }
  }
  
  // Si pas de correspondance, utiliser Clermont-Ferrand par défaut
  return CITY_COORDS['clermont-ferrand'];
}

/**
 * Hash simple pour générer des offsets
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Calculer la distance entre deux points (formule Haversine)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estimer le temps de trajet (basé sur la distance)
 */
export function estimateTravelTime(distanceKm: number): number {
  // Vitesse moyenne en ville/périurbain : 40 km/h
  // + temps de parking/accès : 5 min par arrêt
  const driveTime = (distanceKm / 40) * 60;
  return Math.round(driveTime + 5);
}

/**
 * Calculer la matrice des distances entre toutes les locations
 */
export async function calculateDistanceMatrix(locations: Location[]): Promise<number[][]> {
  // Géocoder toutes les adresses
  const coordsPromises = locations.map(loc => 
    loc.lat && loc.lng 
      ? Promise.resolve({ lat: loc.lat, lng: loc.lng })
      : geocodeAddress(loc.adresse, loc.ville)
  );
  
  const coords = await Promise.all(coordsPromises);
  
  // Calculer la matrice
  const matrix: number[][] = [];
  
  for (let i = 0; i < locations.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < locations.length; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else if (coords[i] && coords[j]) {
        matrix[i][j] = calculateDistance(
          coords[i]!.lat, coords[i]!.lng,
          coords[j]!.lat, coords[j]!.lng
        );
      } else {
        matrix[i][j] = Infinity;
      }
    }
  }
  
  return matrix;
}

/**
 * Algorithme du plus proche voisin pour l'optimisation de tournée
 */
export function nearestNeighborOptimization(
  distanceMatrix: number[][],
  startIndex: number = 0
): number[] {
  const n = distanceMatrix.length;
  const visited = new Set<number>();
  const route: number[] = [startIndex];
  visited.add(startIndex);
  
  while (visited.size < n) {
    const current = route[route.length - 1];
    let nearestDist = Infinity;
    let nearestIndex = -1;
    
    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
        nearestDist = distanceMatrix[current][i];
        nearestIndex = i;
      }
    }
    
    if (nearestIndex !== -1) {
      route.push(nearestIndex);
      visited.add(nearestIndex);
    }
  }
  
  return route;
}

/**
 * Améliorer la route avec 2-opt
 */
export function twoOptImprovement(
  route: number[],
  distanceMatrix: number[][]
): number[] {
  let improved = true;
  let bestRoute = [...route];
  
  while (improved) {
    improved = false;
    
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        const currentDist = 
          distanceMatrix[bestRoute[i - 1]][bestRoute[i]] +
          distanceMatrix[bestRoute[j]][bestRoute[j + 1]];
        
        const newDist = 
          distanceMatrix[bestRoute[i - 1]][bestRoute[j]] +
          distanceMatrix[bestRoute[i]][bestRoute[j + 1]];
        
        if (newDist < currentDist) {
          // Inverser le segment entre i et j
          const newRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j + 1).reverse(),
            ...bestRoute.slice(j + 1)
          ];
          bestRoute = newRoute;
          improved = true;
        }
      }
    }
  }
  
  return bestRoute;
}

/**
 * Optimiser une tournée complète
 */
export async function optimizeRoute(
  locations: Location[],
  startTime: Date = new Date(),
  defaultInterventionTime: number = 30
): Promise<OptimizedRoute> {
  if (locations.length === 0) {
    return {
      locations: [],
      segments: [],
      totalDistance: 0,
      totalDuration: 0,
      totalInterventionTime: 0,
      estimatedEndTime: startTime
    };
  }
  
  if (locations.length === 1) {
    return {
      locations,
      segments: [],
      totalDistance: 0,
      totalDuration: 0,
      totalInterventionTime: locations[0].tempsIntervention || defaultInterventionTime,
      estimatedEndTime: new Date(startTime.getTime() + (locations[0].tempsIntervention || defaultInterventionTime) * 60 * 1000)
    };
  }
  
  // Calculer la matrice des distances
  const distanceMatrix = await calculateDistanceMatrix(locations);
  
  // Calculer la distance totale de la route originale
  let originalDistance = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    originalDistance += distanceMatrix[i][i + 1];
  }
  
  // Optimiser avec nearest neighbor + 2-opt
  let optimizedOrder = nearestNeighborOptimization(distanceMatrix, 0);
  optimizedOrder = twoOptImprovement(optimizedOrder, distanceMatrix);
  
  // Réorganiser les locations selon l'ordre optimisé
  const optimizedLocations = optimizedOrder.map(i => locations[i]);
  
  // Calculer les segments
  const segments: RouteSegment[] = [];
  let totalDistance = 0;
  let totalTravelDuration = 0;
  
  for (let i = 0; i < optimizedLocations.length - 1; i++) {
    const from = optimizedLocations[i];
    const to = optimizedLocations[i + 1];
    const distance = distanceMatrix[optimizedOrder[i]][optimizedOrder[i + 1]];
    const duration = estimateTravelTime(distance);
    
    segments.push({
      from,
      to,
      distance,
      duration
    });
    
    totalDistance += distance;
    totalTravelDuration += duration;
  }
  
  // Calculer le temps total d'intervention
  const totalInterventionTime = optimizedLocations.reduce(
    (sum, loc) => sum + (loc.tempsIntervention || defaultInterventionTime),
    0
  );
  
  const totalDuration = totalTravelDuration + totalInterventionTime;
  
  // Calculer l'heure de fin estimée
  const estimatedEndTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);
  
  // Calculer les économies
  const originalDuration = locations.reduce(
    (sum, _, i) => i < locations.length - 1 
      ? sum + estimateTravelTime(distanceMatrix[i][i + 1])
      : sum,
    0
  );
  
  return {
    locations: optimizedLocations,
    segments,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.round(totalDuration),
    totalInterventionTime,
    estimatedEndTime,
    savings: {
      distance: Math.round((originalDistance - totalDistance) * 10) / 10,
      duration: Math.round(originalDuration - totalTravelDuration)
    }
  };
}

/**
 * Générer un lien Google Maps pour la tournée
 */
export function generateGoogleMapsUrl(locations: Location[]): string {
  if (locations.length === 0) return '';
  
  const waypoints = locations
    .slice(0, 10) // Google Maps limite à 10 waypoints
    .map(loc => encodeURIComponent(`${loc.adresse}, ${loc.ville}, France`))
    .join('/');
  
  return `https://www.google.com/maps/dir/${waypoints}`;
}

/**
 * Générer un lien Waze pour la tournée
 */
export function generateWazeUrl(location: Location): string {
  const query = encodeURIComponent(`${location.adresse}, ${location.ville}, France`);
  return `https://waze.com/ul?q=${query}&navigate=yes`;
}

/**
 * Formater la durée en heures et minutes
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  }
}

/**
 * Formater la distance
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}
