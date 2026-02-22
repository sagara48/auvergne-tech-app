// ═══════════════════════════════════════════════════════════════
// PROXY VERCEL — Sigma4Lifts API
// /api/sigma4/* → https://www.sigma4lifts.com/sigma/rs/*
// Catch-all : supporte tous les sous-chemins y compris
//   /divide/lifts/{id}/status
//   /divide/lifts/{id}/control/{cabina}/ecogo/{action}
//   /divide/lifts/{id}/messages
//   /divide/lifts/{id}/parameters
//   /divide/dashboard
//   /divide/login
// ═══════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';

const S4L_BASE = 'https://www.sigma4lifts.com/sigma/rs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // Extraire le sous-chemin après /api/sigma4/
  const { slug } = req.query;
  const pathSegments = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const subPath = '/' + pathSegments.join('/');

  // Construire l'URL cible
  const targetUrl = new URL(subPath, S4L_BASE);

  // Passer les query params (sauf 'slug' interne à Vercel)
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === 'slug') continue;
    if (Array.isArray(val)) val.forEach(v => searchParams.append(key, v));
    else if (val) searchParams.append(key, val);
  }
  if (searchParams.toString()) targetUrl.search = searchParams.toString();

  // Headers à transférer
  const headers: Record<string, string> = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    // Body pour POST/PUT/PATCH
    if (req.method && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = (req.headers['content-type'] || '').toLowerCase();

      if (ct.includes('x-www-form-urlencoded')) {
        // Form data : Vercel parse en objet → re-sérialiser en form
        if (typeof req.body === 'object' && req.body) {
          fetchOptions.body = new URLSearchParams(req.body as Record<string, string>).toString();
        } else if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        }
      } else if (typeof req.body === 'string') {
        fetchOptions.body = req.body;
      } else if (req.body != null) {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Headers de réponse importants
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // Lire le body de la réponse S4L
    const responseText = await response.text();

    // Transférer le status code exact de S4L (y compris les erreurs)
    res.status(response.status);

    // Si erreur S4L, enrichir avec des détails de debug
    if (!response.ok) {
      console.error('[sigma4-proxy]', req.method, subPath, response.status, responseText.substring(0, 500));
    }

    // Retourner le body tel quel
    try {
      res.json(JSON.parse(responseText));
    } catch {
      res.send(responseText || '');
    }
  } catch (error: any) {
    console.error('[sigma4-proxy]', req.method, subPath, error.message);
    res.status(502).json({
      error: 'Proxy error',
      message: error.message,
      target: targetUrl.toString(),
    });
  }
}
