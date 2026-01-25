// supabase/functions/analyze-piece-photo/index.ts
// Edge Function pour analyser une photo de pièce avec Claude Vision

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyseRequest {
  imageBase64: string;
  contexte?: {
    marqueAscenseur?: string;
    typeAscenseur?: string;
    codeAscenseur?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, contexte } = (await req.json()) as AnalyseRequest;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image manquante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clé API Anthropic depuis les secrets Supabase
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY non configurée');
      return new Response(
        JSON.stringify({ error: 'Configuration API manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prompt système pour l'analyse
    const systemPrompt = `Tu es un expert en maintenance d'ascenseurs. Tu analyses des photos de pièces détachées pour les identifier.

Ton objectif est d'identifier :
1. Le TYPE de pièce (contacteur, bouton, carte électronique, galet, patin, câble, etc.)
2. La MARQUE si visible (Schindler, Otis, Kone, ThyssenKrupp, etc.)
3. Les RÉFÉRENCES visibles sur la pièce (numéros gravés, étiquettes, codes)
4. L'ÉTAT de la pièce (neuf, usé, défectueux)
5. Des SUGGESTIONS de recherche pour trouver cette pièce chez Sodimas, Hauer ou MGTI

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "type_piece": "string - type de pièce identifié",
  "description": "string - description détaillée de la pièce",
  "marque_detectee": "string ou null - marque si identifiable",
  "references_lues": ["array de strings - toutes les références visibles"],
  "caracteristiques": ["array de strings - caractéristiques techniques observées"],
  "etat": "string - neuf/usé/défectueux/indéterminé",
  "suggestions_recherche": ["array de strings - termes à rechercher chez les fournisseurs"],
  "confiance": 0.0-1.0,
  "conseil_technique": "string ou null - conseil pour le technicien"
}`;

    let userPrompt = "Analyse cette photo de pièce d'ascenseur et identifie-la :";
    
    if (contexte?.marqueAscenseur) {
      userPrompt += `\n- Marque de l'ascenseur : ${contexte.marqueAscenseur}`;
    }
    if (contexte?.typeAscenseur) {
      userPrompt += `\n- Type d'ascenseur : ${contexte.typeAscenseur}`;
    }
    if (contexte?.codeAscenseur) {
      userPrompt += `\n- Code appareil : ${contexte.codeAscenseur}`;
    }

    // Nettoyer le base64 si nécessaire
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Appel à Claude Vision
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur API Claude:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erreur API Claude: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.content.find((c: any) => c.type === 'text')?.text || '';

    // Parser la réponse JSON
    let result;
    try {
      // Essayer de parser directement
      result = JSON.parse(textContent);
    } catch {
      // Essayer d'extraire le JSON du texte
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // Construire une réponse par défaut
        result = {
          type_piece: 'Pièce non identifiée',
          description: textContent,
          marque_detectee: null,
          references_lues: [],
          caracteristiques: [],
          etat: 'indéterminé',
          suggestions_recherche: [],
          confiance: 0.3,
          conseil_technique: null,
        };
      }
    }

    // Valider la structure
    const validated = {
      type_piece: result.type_piece || 'Pièce non identifiée',
      description: result.description || '',
      marque_detectee: result.marque_detectee || null,
      references_lues: Array.isArray(result.references_lues) ? result.references_lues : [],
      caracteristiques: Array.isArray(result.caracteristiques) ? result.caracteristiques : [],
      etat: result.etat || 'indéterminé',
      suggestions_recherche: Array.isArray(result.suggestions_recherche) ? result.suggestions_recherche : [],
      confiance: typeof result.confiance === 'number' ? result.confiance : 0.5,
      conseil_technique: result.conseil_technique || null,
    };

    return new Response(
      JSON.stringify(validated),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur analyse photo:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de l\'analyse' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
