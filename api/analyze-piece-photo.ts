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

    // Nettoyer et détecter le type
    let cleanBase64 = imageBase64;
    let mediaType = 'image/jpeg';
    
    if (imageBase64.startsWith('data:image/')) {
      const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const type = match[1].toLowerCase();
        mediaType = type === 'jpg' ? 'image/jpeg' : `image/${type}`;
        cleanBase64 = match[2];
      }
    }

    console.log('Type détecté:', mediaType);
    console.log('Taille base64:', cleanBase64.length);

    // Prompt
    const systemPrompt = `Tu es un expert en maintenance d'ascenseurs. Analyse cette photo de pièce et identifie-la.

Réponds UNIQUEMENT en JSON valide:
{
  "type_piece": "string",
  "description": "string",
  "marque_detectee": "string ou null",
  "references_lues": ["array de strings"],
  "caracteristiques": ["array de strings"],
  "etat": "neuf/usé/défectueux/indéterminé",
  "suggestions_recherche": ["array de strings"],
  "confiance": 0.0-1.0,
  "conseil_technique": "string ou null"
}`;

    let userPrompt = "Analyse cette photo de pièce d'ascenseur:";
    if (contexte?.marqueAscenseur) userPrompt += `\n- Marque: ${contexte.marqueAscenseur}`;
    if (contexte?.codeAscenseur) userPrompt += `\n- Code: ${contexte.codeAscenseur}`;

    // Appel Claude Vision
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
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
            { type: 'text', text: userPrompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur Claude:', response.status, errorText);
      return res.status(500).json({ error: `Erreur API: ${response.status}`, details: errorText });
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text')?.text || '';

    // Parser JSON
    let result;
    try {
      result = JSON.parse(textContent);
    } catch {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          type_piece: 'Non identifié',
          description: textContent,
          references_lues: [],
          caracteristiques: [],
          suggestions_recherche: [],
          confiance: 0.3,
        };
      }
    }

    return res.status(200).json({
      type_piece: result.type_piece || 'Non identifié',
      description: result.description || '',
      marque_detectee: result.marque_detectee || null,
      references_lues: Array.isArray(result.references_lues) ? result.references_lues : [],
      caracteristiques: Array.isArray(result.caracteristiques) ? result.caracteristiques : [],
      etat: result.etat || 'indéterminé',
      suggestions_recherche: Array.isArray(result.suggestions_recherche) ? result.suggestions_recherche : [],
      confiance: typeof result.confiance === 'number' ? result.confiance : 0.5,
      conseil_technique: result.conseil_technique || null,
    });

  } catch (error: any) {
    console.error('Erreur:', error);
    return res.status(500).json({ error: 'Erreur analyse', details: error?.message });
  }
}
