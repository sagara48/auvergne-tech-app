"""
Progilift Status API - État de la synchronisation
Tables: parc_ascenseurs, parc_pannes, parc_arrets, parc_sync_logs
"""

import os
import json
import ssl
import urllib.request
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

try:
    ssl_context = ssl.create_default_context()
except:
    ssl_context = ssl._create_unverified_context()

def get_count(table, filter_str=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return 0
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
        if filter_str:
            url += f"&{filter_str}"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Prefer': 'count=exact'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as resp:
            content_range = resp.headers.get('content-range', '0/0')
            return int(content_range.split('/')[-1]) if '/' in content_range else 0
    except:
        return 0

def get_last_sync():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        url = f"{SUPABASE_URL}/rest/v1/parc_sync_logs?select=*&order=sync_date.desc&limit=1"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data[0] if data else None
    except:
        return None

def get_arrets_details():
    """Récupère le détail des ascenseurs à l'arrêt"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/parc_arrets?select=code_appareil,adresse,ville,secteur,date_appel,heure_appel,motif&order=date_appel.desc&limit=10"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except:
        return []

def get_stats_by_sector():
    """Stats par secteur"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        # Récupérer les secteurs distincts avec comptage
        url = f"{SUPABASE_URL}/rest/v1/parc_ascenseurs?select=secteur"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15, context=ssl_context) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
            # Compter par secteur
            sectors = {}
            for item in data:
                s = item.get('secteur')
                if s:
                    sectors[s] = sectors.get(s, 0) + 1
            
            return [{"secteur": k, "count": v} for k, v in sorted(sectors.items())]
    except:
        return []

def get_status():
    last_sync = get_last_sync()
    arrets_details = get_arrets_details()
    
    # Compter les pannes des 30 derniers jours
    from datetime import datetime, timedelta
    date_30j = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    return {
        "status": "ok",
        "totals": {
            "ascenseurs": get_count("parc_ascenseurs"),
            "pannes_total": get_count("parc_pannes"),
            "pannes_30j": get_count("parc_pannes", f"date_appel=gte.{date_30j}"),
            "arrets": get_count("parc_arrets"),
            "secteurs": len(get_stats_by_sector())
        },
        "arrets_en_cours": arrets_details,
        "last_sync": {
            "date": last_sync.get('sync_date') if last_sync else None,
            "type": last_sync.get('sync_type') if last_sync else None,
            "status": last_sync.get('status') if last_sync else None,
            "duration": last_sync.get('duration_seconds') if last_sync else None,
            "equipements": last_sync.get('equipements_count') if last_sync else 0,
            "pannes": last_sync.get('pannes_count') if last_sync else 0,
            "arrets": last_sync.get('arrets_count') if last_sync else 0
        } if last_sync else None
    }

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = get_status()
        except Exception as e:
            result = {"status": "error", "message": str(e)}
        
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
