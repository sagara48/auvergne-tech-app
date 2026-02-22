// ═══════════════════════════════════════════════════════════════
// PROXY SIGMA4LIFTS — Vercel Serverless Function
// Contourne le CORS en relayant les appels côté serveur
// /api/sigma4/* → https://www.sigma4lifts.com/sigma-api/*
// ═══════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SIGMA4_API_BASE = 'https://www.sigma4lifts.com/sigma-api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers pour le frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extraire le path après /api/sigma4/
    const { path } = req.query;
    const sigmaPath = Array.isArray(path) ? path.join('/') : (path || '');
    const targetUrl = `${SIGMA4_API_BASE}/${sigmaPath}`;

    // Construire les headers pour Sigma4
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Transmettre le token d'auth si présent
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Transmettre les query params
    const url = new URL(targetUrl);
    const queryString = req.url?.split('?')[1];
    if (queryString) {
      // Retirer le param 'path' interne de Vercel
      const params = new URLSearchParams(queryString);
      params.delete('path');
      params.forEach((value, key) => url.searchParams.set(key, value));
    }

    // Appel vers Sigma4Lifts
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    // Body pour POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Transmettre le status code
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error('Sigma4 proxy error:', error);
    return res.status(502).json({
      error: 'Erreur de connexion à Sigma4Lifts',
      details: error.message || 'Serveur inaccessible',
    });
  }
}
