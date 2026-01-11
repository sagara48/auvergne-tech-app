"""
Progilift Logs API - Historique des synchronisations
Table: parc_sync_logs
"""

import os
import json
import ssl
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

try:
    ssl_context = ssl.create_default_context()
except:
    ssl_context = ssl._create_unverified_context()

def get_logs(limit=50, sync_type=None, status=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/parc_sync_logs?select=*&order=sync_date.desc&limit={limit}"
        
        if sync_type:
            url += f"&sync_type=eq.{sync_type}"
        if status:
            url += f"&status=eq.{status}"
        
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return []

def get_stats():
    """Statistiques des synchronisations"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {}
    try:
        logs = get_logs(100)
        
        if not logs:
            return {}
        
        # Calculer les stats
        total = len(logs)
        success = sum(1 for l in logs if l.get('status') == 'success')
        partial = sum(1 for l in logs if l.get('status') == 'partial')
        errors = sum(1 for l in logs if l.get('status') == 'error')
        
        cron_count = sum(1 for l in logs if l.get('sync_type') == 'cron')
        full_count = sum(1 for l in logs if l.get('sync_type') == 'full')
        
        durations = [l.get('duration_seconds', 0) for l in logs if l.get('duration_seconds')]
        avg_duration = round(sum(durations) / len(durations), 2) if durations else 0
        
        return {
            "total_syncs": total,
            "success": success,
            "partial": partial,
            "errors": errors,
            "success_rate": round(success / total * 100, 1) if total > 0 else 0,
            "by_type": {
                "cron": cron_count,
                "full": full_count,
                "other": total - cron_count - full_count
            },
            "avg_duration_seconds": avg_duration
        }
    except:
        return {}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            limit = int(params.get('limit', ['50'])[0])
            sync_type = params.get('type', [None])[0]
            status = params.get('status', [None])[0]
            show_stats = params.get('stats', [''])[0] == '1'
            
            if show_stats:
                result = {
                    "stats": get_stats(),
                    "recent_logs": get_logs(10)
                }
            else:
                result = get_logs(limit, sync_type, status)
            
        except Exception as e:
            result = {"error": str(e)}
        
        body = json.dumps(result, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        pass
