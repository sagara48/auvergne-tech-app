/**
 * Service d'optimisation des tournées
 * Algorithmes de calcul d'itinéraires optimisés
 */

export interface PointTournee {
  id: string;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal?: string;
  secteur: number;
  lat?: number;
  lng?: number;
  wordre?: number;
  duree_estimee?: number; // Durée d'intervention estimée en minutes
  priorite?: 'haute' | 'normale' | 'basse';
  en_arret?: boolean;
  type_planning?: string;
}

export interface TourneeOptimisee {
  points: PointTournee[];
  distanceTotale: number; // en km
  dureeEstimee: number; // en minutes
  heureDepart: string;
  heureArrivee: string;
  economies: {
    distanceGagnee: number;
    tempsGagne: number;
  };
}

export interface OptimizationOptions {
  heureDepart?: string; // Format HH:mm
  tempsMaxTournee?: number; // en minutes
  inclureArrets?: boolean;
  prioriserUrgents?: boolean;
  vitesseMoyenne?: number; // km/h
}

// Coordonnées approximatives des villes d'Auvergne (fallback)
const COORDS_VILLES: Record<string, { lat: number; lng: number }> = {
  'clermont-ferrand': { lat: 45.7772, lng: 3.0870 },
  'vichy': { lat: 46.1167, lng: 3.4167 },
  'montlucon': { lat: 46.3400, lng: 2.6000 },
  'moulins': { lat: 46.5667, lng: 3.3333 },
  'aurillac': { lat: 44.9300, lng: 2.4400 },
  'le puy-en-velay': { lat: 45.0428, lng: 3.8853 },
  'issoire': { lat: 45.5447, lng: 3.2489 },
  'thiers': { lat: 45.8547, lng: 3.5489 },
  'riom': { lat: 45.8936, lng: 3.1139 },
  'cournon-d\'auvergne': { lat: 45.7397, lng: 3.1964 },
  'chamalières': { lat: 45.7778, lng: 3.0631 },
  'aubière': { lat: 45.7522, lng: 3.1119 },
};

/**
 * Obtenir les coordonnées approximatives d'une ville
 */
function getCoordsVille(ville: string): { lat: number; lng: number } | null {
  const villeNorm = ville.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, '')
    .trim();
  
  // Chercher une correspondance exacte ou partielle
  for (const [key, coords] of Object.entries(COORDS_VILLES)) {
    if (villeNorm.includes(key) || key.includes(villeNorm)) {
      return coords;
    }
  }
  
  // Fallback: centre de l'Auvergne
  return { lat: 45.7772, lng: 3.0870 };
}

/**
 * Calculer la distance entre deux points (formule de Haversine)
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculer la matrice des distances entre tous les points
 */
function calculerMatriceDistances(points: PointTournee[]): number[][] {
  const n = points.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    const pi = points[i];
    const coordsI = pi.lat && pi.lng ? { lat: pi.lat, lng: pi.lng } : getCoordsVille(pi.ville);
    
    for (let j = i + 1; j < n; j++) {
      const pj = points[j];
      const coordsJ = pj.lat && pj.lng ? { lat: pj.lat, lng: pj.lng } : getCoordsVille(pj.ville);
      
      if (coordsI && coordsJ) {
        const dist = haversineDistance(coordsI.lat, coordsI.lng, coordsJ.lat, coordsJ.lng);
        // Ajouter 30% pour tenir compte des routes réelles
        matrix[i][j] = dist * 1.3;
        matrix[j][i] = dist * 1.3;
      }
    }
  }
  
  return matrix;
}

/**
 * Algorithme du plus proche voisin (Nearest Neighbor)
 * Simple mais efficace pour les petites tournées
 */
function nearestNeighbor(
  points: PointTournee[],
  distances: number[][],
  startIndex: number = 0
): number[] {
  const n = points.length;
  const visited = new Set<number>([startIndex]);
  const order = [startIndex];
  let current = startIndex;
  
  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    
    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distances[current][i] < nearestDist) {
        nearest = i;
        nearestDist = distances[current][i];
      }
    }
    
    if (nearest !== -1) {
      visited.add(nearest);
      order.push(nearest);
      current = nearest;
    }
  }
  
  return order;
}

/**
 * Amélioration par 2-opt (échange de segments)
 */
function twoOptImprove(
  order: number[],
  distances: number[][]
): number[] {
  const n = order.length;
  let improved = true;
  let bestOrder = [...order];
  
  while (improved) {
    improved = false;
    
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        // Calculer le gain d'un échange 2-opt
        const d1 = distances[bestOrder[i]][bestOrder[i + 1]] + 
                   distances[bestOrder[j]][bestOrder[(j + 1) % n]];
        const d2 = distances[bestOrder[i]][bestOrder[j]] + 
                   distances[bestOrder[i + 1]][bestOrder[(j + 1) % n]];
        
        if (d2 < d1) {
          // Inverser le segment entre i+1 et j
          const newOrder = [...bestOrder];
          let left = i + 1;
          let right = j;
          while (left < right) {
            [newOrder[left], newOrder[right]] = [newOrder[right], newOrder[left]];
            left++;
            right--;
          }
          bestOrder = newOrder;
          improved = true;
        }
      }
    }
  }
  
  return bestOrder;
}

/**
 * Calculer la distance totale d'une tournée
 */
function calculerDistanceTotale(order: number[], distances: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += distances[order[i]][order[i + 1]];
  }
  return total;
}

/**
 * Optimiser une tournée
 */
export function optimiserTournee(
  points: PointTournee[],
  options: OptimizationOptions = {}
): TourneeOptimisee {
  const {
    heureDepart = '08:00',
    tempsMaxTournee = 480, // 8 heures par défaut
    inclureArrets = true,
    prioriserUrgents = true,
    vitesseMoyenne = 40, // km/h en ville
  } = options;
  
  // Filtrer les points si nécessaire
  let pointsFiltres = inclureArrets ? points : points.filter(p => !p.en_arret);
  
  // Trier par priorité si demandé
  if (prioriserUrgents) {
    pointsFiltres = [...pointsFiltres].sort((a, b) => {
      const prioriteOrder = { haute: 0, normale: 1, basse: 2 };
      const pa = prioriteOrder[a.priorite || 'normale'];
      const pb = prioriteOrder[b.priorite || 'normale'];
      if (pa !== pb) return pa - pb;
      // Les arrêts sont prioritaires
      if (a.en_arret && !b.en_arret) return -1;
      if (!a.en_arret && b.en_arret) return 1;
      return 0;
    });
  }
  
  if (pointsFiltres.length === 0) {
    return {
      points: [],
      distanceTotale: 0,
      dureeEstimee: 0,
      heureDepart,
      heureArrivee: heureDepart,
      economies: { distanceGagnee: 0, tempsGagne: 0 }
    };
  }
  
  if (pointsFiltres.length === 1) {
    return {
      points: pointsFiltres,
      distanceTotale: 0,
      dureeEstimee: pointsFiltres[0].duree_estimee || 30,
      heureDepart,
      heureArrivee: calculerHeureArrivee(heureDepart, pointsFiltres[0].duree_estimee || 30),
      economies: { distanceGagnee: 0, tempsGagne: 0 }
    };
  }
  
  // Calculer la matrice des distances
  const distances = calculerMatriceDistances(pointsFiltres);
  
  // Calculer la distance de l'ordre original (wordre)
  const ordreOriginal = pointsFiltres
    .map((p, i) => ({ index: i, wordre: p.wordre || 999 }))
    .sort((a, b) => a.wordre - b.wordre)
    .map(x => x.index);
  const distanceOriginale = calculerDistanceTotale(ordreOriginal, distances);
  
  // Trouver le meilleur point de départ (le plus au nord/ouest)
  let bestStart = 0;
  let bestLat = -Infinity;
  pointsFiltres.forEach((p, i) => {
    const coords = p.lat && p.lng ? { lat: p.lat, lng: p.lng } : getCoordsVille(p.ville);
    if (coords && coords.lat > bestLat) {
      bestLat = coords.lat;
      bestStart = i;
    }
  });
  
  // Appliquer l'algorithme du plus proche voisin
  let optimizedOrder = nearestNeighbor(pointsFiltres, distances, bestStart);
  
  // Améliorer avec 2-opt
  optimizedOrder = twoOptImprove(optimizedOrder, distances);
  
  // Calculer les métriques
  const distanceOptimisee = calculerDistanceTotale(optimizedOrder, distances);
  
  // Calculer la durée totale
  const tempsTrajet = (distanceOptimisee / vitesseMoyenne) * 60; // en minutes
  const tempsInterventions = pointsFiltres.reduce((sum, p) => sum + (p.duree_estimee || 30), 0);
  const dureeEstimee = Math.round(tempsTrajet + tempsInterventions);
  
  // Réordonner les points
  const pointsOptimises = optimizedOrder.map(i => ({
    ...pointsFiltres[i],
    wordre: optimizedOrder.indexOf(i) + 1
  }));
  
  // Calculer les économies
  const tempsOriginal = (distanceOriginale / vitesseMoyenne) * 60 + tempsInterventions;
  
  return {
    points: pointsOptimises,
    distanceTotale: Math.round(distanceOptimisee * 10) / 10,
    dureeEstimee,
    heureDepart,
    heureArrivee: calculerHeureArrivee(heureDepart, dureeEstimee),
    economies: {
      distanceGagnee: Math.round((distanceOriginale - distanceOptimisee) * 10) / 10,
      tempsGagne: Math.round(tempsOriginal - dureeEstimee)
    }
  };
}

/**
 * Calculer l'heure d'arrivée estimée
 */
function calculerHeureArrivee(heureDepart: string, dureeMinutes: number): string {
  const [h, m] = heureDepart.split(':').map(Number);
  const totalMinutes = h * 60 + m + dureeMinutes;
  const heures = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Générer l'URL Google Maps pour la tournée optimisée
 */
export function genererURLGoogleMaps(tournee: TourneeOptimisee): string {
  if (tournee.points.length === 0) return '';
  
  const waypoints = tournee.points
    .slice(0, 10) // Limite Google Maps
    .map(p => encodeURIComponent(`${p.adresse}, ${p.ville}, France`))
    .join('/');
  
  return `https://www.google.com/maps/dir/${waypoints}`;
}

/**
 * Estimer le temps de trajet entre deux points
 */
export function estimerTempsTrajet(
  from: PointTournee,
  to: PointTournee,
  vitesseMoyenne: number = 40
): number {
  const coordsFrom = from.lat && from.lng ? { lat: from.lat, lng: from.lng } : getCoordsVille(from.ville);
  const coordsTo = to.lat && to.lng ? { lat: to.lat, lng: to.lng } : getCoordsVille(to.ville);
  
  if (!coordsFrom || !coordsTo) return 15; // Fallback 15 min
  
  const distance = haversineDistance(coordsFrom.lat, coordsFrom.lng, coordsTo.lat, coordsTo.lng) * 1.3;
  return Math.round((distance / vitesseMoyenne) * 60);
}

/**
 * Diviser une grande tournée en sous-tournées
 */
export function diviserTournee(
  points: PointTournee[],
  tempsMaxParTournee: number = 480 // 8h
): PointTournee[][] {
  const tournees: PointTournee[][] = [];
  let tourneeActuelle: PointTournee[] = [];
  let tempsActuel = 0;
  
  const tourneeOptimisee = optimiserTournee(points);
  
  for (const point of tourneeOptimisee.points) {
    const dureePoint = point.duree_estimee || 30;
    
    if (tempsActuel + dureePoint > tempsMaxParTournee && tourneeActuelle.length > 0) {
      tournees.push(tourneeActuelle);
      tourneeActuelle = [];
      tempsActuel = 0;
    }
    
    tourneeActuelle.push(point);
    tempsActuel += dureePoint;
    
    // Ajouter temps de trajet estimé
    if (tourneeActuelle.length > 1) {
      tempsActuel += 15; // 15 min moyenne entre points
    }
  }
  
  if (tourneeActuelle.length > 0) {
    tournees.push(tourneeActuelle);
  }
  
  return tournees;
}
