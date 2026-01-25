// api/test-claude.ts
// Route de test pour vérifier la configuration Claude

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  // Vérifier la présence de la clé
  if (!anthropicApiKey) {
    return res.status(500).json({ 
      error: 'ANTHROPIC_API_KEY non configurée',
      configured: false 
    });
  }

  // Vérifier le format de la clé
  if (!anthropicApiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ 
      error: 'Format de clé API invalide',
      prefix: anthropicApiKey.substring(0, 10) + '...',
      configured: true 
    });
  }

  // Test simple sans image
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Réponds uniquement "OK" si tu reçois ce message.'
        }],
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      return res.status(200).json({
        configured: true,
        apiKeyValid: false,
        claudeStatus: response.status,
        claudeError: responseText
      });
    }

    const data = JSON.parse(responseText);
    const text = data.content?.[0]?.text || '';

    return res.status(200).json({
      configured: true,
      apiKeyValid: true,
      claudeStatus: response.status,
      claudeResponse: text,
      model: data.model
    });

  } catch (error: any) {
    return res.status(500).json({
      configured: true,
      apiKeyValid: false,
      error: error?.message || 'Erreur inconnue'
    });
  }
}
