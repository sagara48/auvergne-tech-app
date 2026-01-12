/**
 * Service IA - Chatbot, Diagnostic et Analyse
 * Utilise l'API Claude/OpenAI pour l'intelligence artificielle
 */

import { supabase } from './supabase';

// Configuration API
const AI_API_URL = import.meta.env.VITE_AI_API_URL || '/api/ai';
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || '';

// Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface DiagnosticResult {
  causesProbables: Array<{
    cause: string;
    probabilite: number; // 0-100
    description: string;
    actions: string[];
  }>;
  piecesRecommandees: Array<{
    reference: string;
    designation: string;
    priorite: 'haute' | 'moyenne' | 'basse';
  }>;
  tempsEstime: number; // en minutes
  difficulte: 'facile' | 'moyenne' | 'difficile' | 'expert';
  documentationRelevante?: string[];
  sourceWeb?: Array<{
    titre: string;
    url: string;
    extrait: string;
  }>;
}

export interface PredictionPanne {
  ascenseurId: string;
  codeAppareil: string;
  adresse: string;
  ville: string;
  scoreRisque: number; // 0-100
  probabilitePanne7j: number;
  probabilitePanne30j: number;
  facteurs: Array<{
    facteur: string;
    impact: number;
    description: string;
  }>;
  recommandations: string[];
  prochaineVisite?: string;
}

// Base de connaissances technique intégrée
const BASE_CONNAISSANCES = {
  codesErreur: {
    'E01': { description: 'Défaut variateur', causes: ['Variateur HS', 'Surchauffe', 'Paramétrage incorrect'] },
    'E02': { description: 'Défaut sécurité porte', causes: ['Cellule photo sale', 'Patin usé', 'Câble coupé'] },
    'E03': { description: 'Surcharge cabine', causes: ['Capteur poids défaillant', 'Surcharge réelle'] },
    'E04': { description: 'Défaut frein', causes: ['Usure garnitures', 'Ressort cassé', 'Bobine HS'] },
    'E05': { description: 'Défaut niveau', causes: ['Capteur niveau HS', 'Décalage mécanique'] },
    'E10': { description: 'Défaut communication', causes: ['Câble bus coupé', 'Carte défaillante', 'Parasites'] },
    'E15': { description: 'Défaut moteur', causes: ['Surchauffe moteur', 'Roulement usé', 'Défaut isolation'] },
    'E20': { description: 'Défaut limiteur de vitesse', causes: ['Câble détendu', 'Limiteur bloqué'] },
    'E45': { description: 'Défaut encodeur', causes: ['Encodeur HS', 'Câble défectueux', 'Pollution'] },
  },
  symptomes: {
    'bruit_metallique': ['Patins de guidage usés', 'Amortisseurs HS', 'Roulements moteur', 'Poulie usée'],
    'vibrations': ['Déséquilibre câbles', 'Patins usés', 'Moteur désaligné', 'Frein mal réglé'],
    'arret_brusque': ['Défaut variateur', 'Coupure alimentation', 'Sécurité déclenchée'],
    'porte_bloque': ['Opérateur porte HS', 'Obstacle détecté', 'Patin coincé', 'Moteur porte HS'],
    'lenteur': ['Variateur fatigué', 'Frein qui frotte', 'Surcharge', 'Paramétrage vitesse'],
    'a_coups': ['Câbles usés', 'Poulie usée', 'Variateur défaillant', 'Frein mal réglé'],
  },
  marques: {
    'otis': { specialites: ['Gen2', 'GeN2 Comfort', 'MRL'], documentation: 'otis-tech-docs.pdf' },
    'schindler': { specialites: ['3300', '5500', 'S Series'], documentation: 'schindler-tech.pdf' },
    'kone': { specialites: ['MonoSpace', 'EcoSpace', 'MiniSpace'], documentation: 'kone-maintenance.pdf' },
    'thyssenkrupp': { specialites: ['Synergy', 'Evolution'], documentation: 'tk-guide.pdf' },
  }
};

// Historique de conversation par session
const conversationHistory: Map<string, ChatMessage[]> = new Map();

/**
 * Obtenir le contexte de l'ascenseur depuis la base de données
 */
async function getAscenseurContext(codeAppareil?: string): Promise<string> {
  if (!codeAppareil) return '';
  
  try {
    // Récupérer les infos de l'ascenseur
    const { data: ascenseur } = await supabase
      .from('parc_ascenseurs')
      .select('*')
      .eq('code_appareil', codeAppareil)
      .single();
    
    if (!ascenseur) return '';
    
    // Récupérer l'historique des pannes
    const { data: pannes } = await supabase
      .from('parc_pannes')
      .select('*')
      .eq('id_wsoucont', ascenseur.id_wsoucont)
      .order('created_at', { ascending: false })
      .limit(20);
    
    let context = `
CONTEXTE ASCENSEUR:
- Code: ${ascenseur.code_appareil}
- Adresse: ${ascenseur.adresse}, ${ascenseur.ville}
- Marque: ${ascenseur.marque || 'Non renseignée'}
- Modèle: ${ascenseur.modele || 'Non renseigné'}
- Type: ${ascenseur.type_appareil || 'Non renseigné'}
- En arrêt: ${ascenseur.en_arret ? 'OUI' : 'Non'}
- Contrat: ${ascenseur.type_planning || 'Hors contrat'}
`;
    
    if (pannes && pannes.length > 0) {
      context += `\nHISTORIQUE DES PANNES (${pannes.length} dernières):\n`;
      pannes.slice(0, 10).forEach((p: any, i: number) => {
        const data = p.data_wpanne || {};
        context += `${i + 1}. ${data.Libelle || data.PANNES || 'Panne'} - ${data.DATE || ''}\n`;
      });
    }
    
    return context;
  } catch (error) {
    console.error('Erreur récupération contexte:', error);
    return '';
  }
}

/**
 * Rechercher des informations techniques sur le web
 */
async function searchTechnicalInfo(query: string): Promise<Array<{ titre: string; url: string; extrait: string }>> {
  // Note: En production, utiliser une vraie API de recherche (Google Custom Search, Bing, etc.)
  // Pour l'instant, on simule avec des résultats pertinents
  
  const results: Array<{ titre: string; url: string; extrait: string }> = [];
  
  // Simuler une recherche basée sur les mots-clés
  const keywords = query.toLowerCase();
  
  if (keywords.includes('variateur') || keywords.includes('inverter')) {
    results.push({
      titre: 'Guide dépannage variateur ascenseur - Techniques Pro',
      url: 'https://example.com/variateur-guide',
      extrait: 'Les variateurs de fréquence sont essentiels pour le contrôle de vitesse. Vérifier les codes erreur, la ventilation, et les connexions...'
    });
  }
  
  if (keywords.includes('porte') || keywords.includes('operateur')) {
    results.push({
      titre: 'Réglage opérateur de porte cabine - Manuel technique',
      url: 'https://example.com/operateur-porte',
      extrait: 'Procédure de réglage: 1) Vérifier l\'alignement, 2) Contrôler les patins, 3) Régler la force de fermeture...'
    });
  }
  
  if (keywords.includes('otis')) {
    results.push({
      titre: 'Documentation technique Otis Gen2',
      url: 'https://otis.com/tech-docs',
      extrait: 'Le système Gen2 utilise des courroies plates au lieu de câbles traditionnels. Maintenance spécifique requise...'
    });
  }
  
  if (keywords.includes('schindler')) {
    results.push({
      titre: 'Schindler 3300 - Guide de maintenance',
      url: 'https://schindler.com/maintenance',
      extrait: 'Ascenseur sans local machine. Points de contrôle: frein, variateur, sécurités, éclairage...'
    });
  }
  
  return results;
}

/**
 * Appeler l'API IA (Claude/OpenAI)
 */
async function callAIAPI(
  messages: ChatMessage[],
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // Si pas de clé API configurée, utiliser le mode simulation
  if (!AI_API_KEY) {
    return simulateAIResponse(messages, systemPrompt);
  }
  
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content?.[0]?.text || data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Erreur API IA:', error);
    return simulateAIResponse(messages, systemPrompt);
  }
}

/**
 * Simulation de réponse IA (mode hors ligne ou sans API)
 */
function simulateAIResponse(messages: ChatMessage[], systemPrompt: string): string {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
  
  // Réponses basées sur les mots-clés
  if (lastMessage.includes('bonjour') || lastMessage.includes('salut')) {
    return "Bonjour ! Je suis l'assistant technique IA. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions sur les pannes, les codes erreur, les procédures de maintenance...";
  }
  
  if (lastMessage.includes('code erreur') || lastMessage.includes('code e')) {
    const codeMatch = lastMessage.match(/e(\d+)/i);
    if (codeMatch) {
      const code = `E${codeMatch[1].padStart(2, '0')}`;
      const info = BASE_CONNAISSANCES.codesErreur[code as keyof typeof BASE_CONNAISSANCES.codesErreur];
      if (info) {
        return `**Code ${code}: ${info.description}**\n\nCauses possibles:\n${info.causes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n💡 Commencez par vérifier les causes les plus fréquentes en premier.`;
      }
    }
    return "Pouvez-vous me préciser le code erreur exact ? Par exemple E01, E02, E45...";
  }
  
  if (lastMessage.includes('bruit') || lastMessage.includes('vibration')) {
    return `**Analyse des symptômes: Bruits/Vibrations**\n\n🔍 Causes probables:\n1. **Patins de guidage usés** (70%) - Vérifier l'usure et le jeu\n2. **Roulements moteur** (50%) - Écouter le bruit caractéristique\n3. **Poulie de traction usée** (40%) - Inspecter les gorges\n4. **Câbles endommagés** (30%) - Vérifier visuellement\n\n🛠️ Actions recommandées:\n- Faire tourner l'ascenseur à vide et localiser le bruit\n- Vérifier l'état des patins en cabine et contrepoids\n- Contrôler le jeu des guidages\n\n⏱️ Temps estimé: 30-60 minutes`;
  }
  
  if (lastMessage.includes('porte') && (lastMessage.includes('bloque') || lastMessage.includes('coince'))) {
    return `**Problème de porte bloquée**\n\n🔍 Diagnostic rapide:\n1. **Cellule photoélectrique sale** - Nettoyer avec chiffon sec\n2. **Obstacle dans le seuil** - Vérifier et dégager\n3. **Patin de porte usé** - Inspecter l'usure\n4. **Opérateur de porte HS** - Tester en mode manuel\n\n⚠️ Sécurité: Toujours couper l'alimentation avant intervention sur les portes.\n\n📋 Procédure:\n1. Passer en mode inspection\n2. Tester ouverture/fermeture manuelle\n3. Vérifier les réglages de force\n4. Contrôler les fins de course`;
  }
  
  if (lastMessage.includes('variateur') || lastMessage.includes('inverter')) {
    return `**Dépannage Variateur**\n\n🔧 Points de contrôle:\n1. **Codes défaut** - Relever sur l'afficheur\n2. **Ventilation** - Vérifier que les ventilateurs tournent\n3. **Température** - Pas de surchauffe anormale\n4. **Connexions** - Resserrer si nécessaire\n\n💡 Conseil: Avant de remplacer un variateur, toujours:\n- Sauvegarder les paramètres\n- Vérifier l'alimentation en amont\n- Contrôler le moteur (isolement)\n\n⚡ Attention: Condensateurs dangereux même hors tension!`;
  }
  
  if (lastMessage.includes('otis') || lastMessage.includes('gen2')) {
    return `**Spécificités Otis Gen2**\n\n🏷️ Caractéristiques:\n- Système à courroies plates (pas de câbles)\n- Machine sans réducteur (gearless)\n- Variateur ReGen (récupération d'énergie)\n\n🔧 Points d'attention:\n1. **Courroies** - Vérifier tension et usure\n2. **Encodeur moteur** - Sensible à la poussière\n3. **Frein** - Réglage spécifique Otis\n\n📚 Documentation: Consulter le manuel Otis PSSE pour les procédures détaillées.`;
  }
  
  if (lastMessage.includes('schindler') || lastMessage.includes('3300') || lastMessage.includes('5500')) {
    return `**Spécificités Schindler**\n\n🏷️ Gamme:\n- 3300: Ascenseur MRL économique\n- 5500: Ascenseur premium personnalisable\n\n🔧 Points d'attention:\n1. **Variateur** - Codes erreur sur afficheur LCD\n2. **Tableau de commande** - Interface Schindler PORT\n3. **Frein** - Double frein de sécurité\n\n💡 Astuce: Les codes erreur Schindler commencent par "F" suivi de chiffres.`;
  }
  
  // Réponse générique
  return `Je comprends votre question sur "${lastMessage.substring(0, 50)}..."\n\nPour vous aider au mieux, pouvez-vous me préciser:\n- La marque et le modèle de l'ascenseur\n- Les symptômes exacts observés\n- Les codes erreur affichés (si applicable)\n- L'historique récent (interventions, modifications)\n\nJe peux vous aider avec les diagnostics, les procédures de maintenance, et les codes erreur des principales marques.`;
}

/**
 * Chat avec l'assistant IA
 */
export async function chatWithAssistant(
  message: string,
  sessionId: string,
  context?: { codeAppareil?: string; includeWebSearch?: boolean }
): Promise<{ response: string; sources?: any[] }> {
  // Récupérer ou créer l'historique de conversation
  let history = conversationHistory.get(sessionId) || [];
  
  // Ajouter le message utilisateur
  history.push({ role: 'user', content: message, timestamp: new Date() });
  
  // Construire le contexte
  let ascenseurContext = '';
  if (context?.codeAppareil) {
    ascenseurContext = await getAscenseurContext(context.codeAppareil);
  }
  
  // Recherche web si demandée
  let webResults: any[] = [];
  if (context?.includeWebSearch) {
    webResults = await searchTechnicalInfo(message);
  }
  
  // Prompt système
  const systemPrompt = `Tu es un assistant technique expert en ascenseurs et monte-charges. Tu aides les techniciens de maintenance avec:
- Le diagnostic des pannes
- L'interprétation des codes erreur
- Les procédures de maintenance
- Les spécificités des différentes marques (Otis, Schindler, Kone, ThyssenKrupp, etc.)

Tu dois être précis, professionnel et orienté sécurité. Toujours rappeler les consignes de sécurité pertinentes.

${ascenseurContext}

${webResults.length > 0 ? `INFORMATIONS WEB TROUVÉES:\n${webResults.map(r => `- ${r.titre}: ${r.extrait}`).join('\n')}` : ''}

BASE DE CONNAISSANCES DISPONIBLE:
- Codes erreur standards: E01-E50
- Symptômes courants et causes
- Spécificités par marque

Réponds de manière structurée avec des emojis pour la clarté. Utilise du markdown pour le formatage.`;
  
  // Appeler l'API IA
  const response = await callAIAPI(history, systemPrompt);
  
  // Ajouter la réponse à l'historique
  history.push({ role: 'assistant', content: response, timestamp: new Date() });
  
  // Limiter l'historique à 20 messages
  if (history.length > 20) {
    history = history.slice(-20);
  }
  
  // Sauvegarder l'historique
  conversationHistory.set(sessionId, history);
  
  return {
    response,
    sources: webResults.length > 0 ? webResults : undefined
  };
}

/**
 * Obtenir un diagnostic basé sur les symptômes
 */
export async function getDiagnostic(
  symptomes: string[],
  codeAppareil?: string,
  codeErreur?: string,
  marque?: string
): Promise<DiagnosticResult> {
  // Récupérer le contexte de l'ascenseur
  const context = codeAppareil ? await getAscenseurContext(codeAppareil) : '';
  
  // Analyser les symptômes avec la base de connaissances
  const causesDetectees: Map<string, number> = new Map();
  
  symptomes.forEach(symptome => {
    const symptomeNorm = symptome.toLowerCase().replace(/[^a-z]/g, '_');
    const causes = BASE_CONNAISSANCES.symptomes[symptomeNorm as keyof typeof BASE_CONNAISSANCES.symptomes] || [];
    causes.forEach((cause, index) => {
      const score = causesDetectees.get(cause) || 0;
      causesDetectees.set(cause, score + (100 - index * 20));
    });
  });
  
  // Ajouter les causes du code erreur si présent
  if (codeErreur) {
    const erreurInfo = BASE_CONNAISSANCES.codesErreur[codeErreur as keyof typeof BASE_CONNAISSANCES.codesErreur];
    if (erreurInfo) {
      erreurInfo.causes.forEach((cause, index) => {
        const score = causesDetectees.get(cause) || 0;
        causesDetectees.set(cause, score + (150 - index * 30));
      });
    }
  }
  
  // Trier par probabilité
  const causesSorted = Array.from(causesDetectees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const maxScore = causesSorted[0]?.[1] || 100;
  
  // Recherche web pour informations complémentaires
  const webResults = await searchTechnicalInfo(symptomes.join(' ') + ' ' + (marque || ''));
  
  return {
    causesProbables: causesSorted.map(([cause, score]) => ({
      cause,
      probabilite: Math.round((score / maxScore) * 100),
      description: `Vérifier ${cause.toLowerCase()}`,
      actions: [
        `Inspecter visuellement`,
        `Tester le composant`,
        `Remplacer si défaillant`
      ]
    })),
    piecesRecommandees: causesSorted.slice(0, 3).map(([cause]) => ({
      reference: `REF-${cause.substring(0, 3).toUpperCase()}`,
      designation: cause,
      priorite: 'moyenne' as const
    })),
    tempsEstime: 30 + causesSorted.length * 15,
    difficulte: causesSorted.length > 3 ? 'difficile' : 'moyenne',
    documentationRelevante: marque ? [BASE_CONNAISSANCES.marques[marque.toLowerCase() as keyof typeof BASE_CONNAISSANCES.marques]?.documentation].filter(Boolean) : [],
    sourceWeb: webResults
  };
}

/**
 * Effacer l'historique de conversation
 */
export function clearConversation(sessionId: string): void {
  conversationHistory.delete(sessionId);
}

/**
 * Obtenir l'historique de conversation
 */
export function getConversationHistory(sessionId: string): ChatMessage[] {
  return conversationHistory.get(sessionId) || [];
}
