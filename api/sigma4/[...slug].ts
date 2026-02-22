// ═══════════════════════════════════════════════════════════════
// PROXY VERCEL — Sigma4Lifts API
// /api/sigma4/* → https://www.sigma4lifts.com/sigma/rs/*
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
  const { slug, ...queryRest } = req.query;
  const pathSegments = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const subPath = '/' + pathSegments.join('/');

  // ⚠️ Concaténation (new URL() avec path absolu écrase le base path)
  let targetUrl = S4L_BASE + subPath;

  // Query params (sans 'slug' interne Vercel)
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(queryRest)) {
    if (Array.isArray(val)) val.forEach(v => searchParams.append(key, v));
    else if (val) searchParams.append(key, String(val));
  }
  if (searchParams.toString()) targetUrl += '?' + searchParams.toString();

  // Headers
  const headers: Record<string, string> = {};
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;

  try {
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    // Body pour POST/PUT/PATCH
    if (req.method && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = (req.headers['content-type'] || '').toLowerCase();

      if (ct.includes('x-www-form-urlencoded')) {
        if (typeof req.body === 'object' && req.body) {
          fetchOptions.body = new URLSearchParams(req.body as Record<string, string>).toString();
        } else if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        }
      } else {
        // JSON (default)
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        } else if (req.body != null && typeof req.body === 'object') {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }
    }

    console.log('[sigma4-proxy]', req.method, targetUrl, fetchOptions.body ? `body=${fetchOptions.body}` : '');

    const response = await fetch(targetUrl, fetchOptions);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[sigma4-proxy] ERROR', req.method, targetUrl, response.status, responseText.substring(0, 500));
    }

    res.status(response.status);

    try {
      res.json(JSON.parse(responseText));
    } catch {
      res.send(responseText || '');
    }
  } catch (error: any) {
    console.error('[sigma4-proxy] CRASH', req.method, targetUrl, error.message);
    res.status(502).json({
      error: 'Proxy error',
      message: error.message,
      target: targetUrl,
    });
  }
}
