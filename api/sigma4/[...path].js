// Proxy Sigma4Lifts — contourne CORS
// /api/sigma4/* → https://www.sigma4lifts.com/sigma-api/*

const SIGMA4_API_BASE = 'https://www.sigma4lifts.com/sigma-api';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extraire le path: /api/sigma4/auth/login → auth/login
    const sigmaPath = Array.isArray(req.query.path)
      ? req.query.path.join('/')
      : (req.query.path || '');

    const targetUrl = new URL(`${SIGMA4_API_BASE}/${sigmaPath}`);

    // Transmettre les query params (sauf "path" interne Vercel)
    const rawQuery = req.url.split('?')[1];
    if (rawQuery) {
      const params = new URLSearchParams(rawQuery);
      params.delete('path');
      params.forEach((value, key) => targetUrl.searchParams.set(key, value));
    }

    // Headers
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Fetch options
    const fetchOpts = { method: req.method || 'GET', headers };

    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOpts.body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl.toString(), fetchOpts);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Sigma4 proxy error:', error);
    return res.status(502).json({
      error: 'Erreur de connexion à Sigma4Lifts',
      details: error.message || 'Serveur inaccessible',
    });
  }
};
