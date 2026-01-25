// api/analyze-piece-photo.ts
// API Route Vercel pour analyser une photo de pièce avec Claude Vision

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, contexte } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image manquante' });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY manquante');
      return res.status(500).json({ error: 'Configuration API manquante' });
    }

    // Nettoyer le base64 agressivement
    let cleanBase64 = imageBase64;
    let mediaType = 'image/jpeg';
    
    // Extraire le type et le contenu du data URL
    if (imageBase64.includes('data:image/')) {
      const match = imageBase64.match(/^data:image\/([\w+]+);base64,(.+)$/s);
      if (match) {
        const type = match[1].toLowerCase().replace('+', '');
        mediaType = type === 'jpg' ? 'image/jpeg' : `image/${type}`;
        cleanBase64 = match[2];
      } else {
        // Fallback: juste supprimer le préfixe
        cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
      }
    }

    // Nettoyer le base64 : supprimer espaces, retours à la ligne, etc.
    cleanBase64 = cleanBase64.replace(/[\s\r\n]/g, '');

    // Valider que c'est du base64 valide
    if (!/^[A-Za-z0-9+/]+=*$/.test(cleanBase64)) {
      console.error('Base64 invalide après nettoyage');
      return res.status(400).json({ error: 'Format image invalide' });
    }

    // Vérifier taille (Claude accepte jusqu'à ~20MB)
    const estimatedSize = (cleanBase64.length * 3) / 4;
    console.log('Media type:', mediaType);
    console.log('Base64 length:', cleanBase64.length);
    console.log('Estimated size (bytes):', estimatedSize);

    if (estimatedSize > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image trop volumineuse (max 20MB)' });
    }

    // Prompt système amélioré pour l'identification de pièces d'ascenseur
    const systemPrompt = `Tu es un expert en maintenance d'ascenseurs avec 20 ans d'expérience. Analyse cette photo de pièce détachée.

TYPES DE PIÈCES COURANTS - identifie en priorité :
- SERRURE de porte palière : mécanisme avec galets/roulettes + verrou + contact électrique. Marques: Fermator, Wittur, Sematic, Selcom
- OPÉRATEUR de porte : moteur + mécanisme courroie/chaîne pour ouverture portes
- GALET / ROULETTE : roue en plastique ou métal pour guidage
- PATIN de guidage : glissière pour cabine ou contrepoids  
- CONTACTEUR / RELAIS : composant électrique de commutation
- CARTE ÉLECTRONIQUE : PCB avec composants
- BOUTON / POUSSOIR : commande cabine ou palier
- AFFICHEUR / DISPLAY : écran étage
- CAPTEUR / DÉTECTEUR : photocellule, magnétique, inductif
- VARIATEUR de fréquence : coffret électronique contrôle moteur
- LIMITEUR DE VITESSE : GRANDE roue (30-50cm diamètre) avec câble de sécurité

ATTENTION - ERREURS FRÉQUENTES À ÉVITER :
- SERRURE ≠ LIMITEUR : Une serrure est un mécanisme PLAT avec galets pour guider la porte. Un limiteur est une GRANDE ROUE.
- Si tu vois des galets + un mécanisme de verrouillage + une étiquette Fermator/Wittur/Sematic = c'est une SERRURE
- Les serrures Fermator ont souvent un QR code et le logo "Fermator" visible

MARQUES À CHERCHER sur les étiquettes : Fermator, Wittur, Sematic, Schindler, Otis, Kone, ThyssenKrupp, Selcom, Prisma, Montanari

LIS ATTENTIVEMENT toute étiquette, QR code, référence ou texte visible.

Réponds UNIQUEMENT en JSON valide:
{
  "type_piece": "string - type précis (ex: Serrure porte palière)",
  "description": "string - description détaillée de ce que tu vois",
  "marque_detectee": "string ou null - marque LUE sur l'étiquette",
  "references_lues": ["TOUTES les références/codes visibles"],
  "caracteristiques": ["caractéristiques techniques observées"],
  "etat": "neuf/usé/défectueux/indéterminé",
  "suggestions_recherche": ["marque + type + référence pour recherche catalogue"],
  "confiance": 0.0-1.0,
  "conseil_technique": "string ou null"
}`;

    let userPrompt = "Analyse cette photo de pièce d'ascenseur et identifie-la:";
    if (contexte?.marqueAscenseur) userPrompt += `\n- Marque ascenseur: ${contexte.marqueAscenseur}`;
    if (contexte?.codeAscenseur) userPrompt += `\n- Code: ${contexte.codeAscenseur}`;

    // Construire la requête Claude
    const claudeRequest = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: cleanBase64,
            },
          },
          { 
            type: 'text', 
            text: systemPrompt + '\n\n' + userPrompt 
          },
        ],
      }],
    };

    console.log('Envoi requête Claude...');

    // Appel Claude Vision
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeRequest),
    });

    const responseText = await response.text();
    console.log('Claude response status:', response.status);

    if (!response.ok) {
      console.error('Erreur Claude:', response.status, responseText);
      return res.status(500).json({ 
        error: `Erreur API Claude: ${response.status}`, 
        details: responseText.substring(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Erreur parsing réponse Claude:', e);
      return res.status(500).json({ error: 'Réponse Claude invalide' });
    }

    const textContent = data.content?.find((c: any) => c.type === 'text')?.text || '';
    console.log('Claude text content length:', textContent.length);

    // Parser JSON depuis la réponse
    let result;
    try {
      // Essayer de parser directement
      result = JSON.parse(textContent);
    } catch {
      // Essayer d'extraire le JSON du texte
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch {
          result = null;
        }
      }
    }

    // Si pas de JSON valide, construire une réponse par défaut
    if (!result) {
      result = {
        type_piece: 'Pièce analysée',
        description: textContent || 'Analyse effectuée mais format de réponse inattendu',
        references_lues: [],
        caracteristiques: [],
        suggestions_recherche: [],
        confiance: 0.5,
      };
    }

    // Valider et normaliser la réponse
    const validated = {
      type_piece: String(result.type_piece || 'Non identifié'),
      description: String(result.description || ''),
      marque_detectee: result.marque_detectee || null,
      references_lues: Array.isArray(result.references_lues) ? result.references_lues : [],
      caracteristiques: Array.isArray(result.caracteristiques) ? result.caracteristiques : [],
      etat: String(result.etat || 'indéterminé'),
      suggestions_recherche: Array.isArray(result.suggestions_recherche) ? result.suggestions_recherche : [],
      confiance: typeof result.confiance === 'number' ? result.confiance : 0.5,
      conseil_technique: result.conseil_technique || null,
    };

    console.log('Analyse réussie:', validated.type_piece);
    return res.status(200).json(validated);

  } catch (error: any) {
    console.error('Erreur handler:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de l\'analyse', 
      details: error?.message || 'Erreur inconnue'
    });
  }
}
