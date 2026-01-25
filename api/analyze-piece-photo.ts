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

    // Prompt système
    const systemPrompt = `Tu es un expert en maintenance d'ascenseurs. Analyse cette photo de pièce et identifie-la.

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "type_piece": "string - type de pièce identifié",
  "description": "string - description détaillée",
  "marque_detectee": "string ou null",
  "references_lues": ["array de références visibles"],
  "caracteristiques": ["array de caractéristiques"],
  "etat": "neuf/usé/défectueux/indéterminé",
  "suggestions_recherche": ["termes à rechercher"],
  "confiance": 0.0-1.0,
  "conseil_technique": "string ou null"
}`;

    let userPrompt = "Analyse cette photo de pièce d'ascenseur et identifie-la:";
    if (contexte?.marqueAscenseur) userPrompt += `\n- Marque ascenseur: ${contexte.marqueAscenseur}`;
    if (contexte?.codeAscenseur) userPrompt += `\n- Code: ${contexte.codeAscenseur}`;

    // Construire la requête Claude
    const claudeRequest = {
      model: 'claude-3-5-sonnet-20241022',
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
