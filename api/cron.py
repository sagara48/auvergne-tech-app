"""
Endpoint Cron pour Vercel - Sync rapide toutes les heures
Synchronise: Arrêts + Pannes récentes
Tables: parc_arrets, parc_pannes, parc_ascenseurs (flag en_arret), parc_sync_logs
"""

import os
import json
import re
import ssl
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
PROGILIFT_CODE = os.environ.get('PROGILIFT_CODE', 'AUVNB1')
WS_URL = "https://ws.progilift.fr/WS_PROGILIFT_20230419_WEB/awws/WS_Progilift_20230419.awws"

try:
    ssl_context = ssl.create_default_context()
except:
    ssl_context = ssl._create_unverified_context()

def safe_str(value, max_len=None):
    if value is None:
        return None
    try:
        s = str(value).strip()
        return s[:max_len] if max_len and s else s if s else None
    except:
        return None

def safe_int(value):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except:
        return None

def safe_date(value):
    """Convertit en date ISO (YYYY-MM-DD)"""
    if not value:
        return None
    try:
        s = str(value).strip()
        if '/' in s:
            parts = s.split('/')
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        elif len(s) == 8 and s.isdigit():
            return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
        return s if len(s) == 10 and '-' in s else None
    except:
        return None

def safe_time(value):
    """Convertit en time (HH:MM:SS)"""
    if not value:
        return None
    try:
        s = str(value).strip()
        if ':' in s:
            parts = s.split(':')
            if len(parts) >= 2:
                return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"
        return None
    except:
        return None

def http_request(url, method='GET', data=None, headers=None, timeout=30):
    try:
        if data and isinstance(data, (dict, list)):
            data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as resp:
            return resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as e:
        return 0, str(e)

def supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

def supabase_upsert(table, data, on_conflict=None):
    if not SUPABASE_URL or not data:
        return False
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    headers = supabase_headers()
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal'
    status, _ = http_request(url, 'POST', data, headers, 30)
    return status in [200, 201, 204]

def supabase_insert(table, data):
    if not SUPABASE_URL or not data:
        return False
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    headers = supabase_headers()
    status, _ = http_request(url, 'POST', data, headers, 30)
    return status in [200, 201, 204]

def supabase_delete(table):
    if not SUPABASE_URL:
        return False
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?id=neq.00000000-0000-0000-0000-000000000000"
    status, _ = http_request(url, 'DELETE', None, supabase_headers(), 30)
    return status in [200, 204]

def supabase_update(table, key_col, key_val, data):
    if not SUPABASE_URL:
        return False
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?{key_col}=eq.{key_val}"
    status, _ = http_request(url, 'PATCH', data, supabase_headers(), 15)
    return status in [200, 204]

def supabase_get(table, select="*", filter_str=None):
    if not SUPABASE_URL:
        return []
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?select={select}"
    if filter_str:
        url += f"&{filter_str}"
    headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}
    status, body = http_request(url, 'GET', None, headers, 30)
    if status == 200:
        return json.loads(body)
    return []

def progilift_call(method, params, wsid=None, timeout=30):
    params_xml = ""
    if params:
        for k, v in params.items():
            if v is not None:
                v_esc = str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                params_xml += f"<ws:{k}>{v_esc}</ws:{k}>"
    
    wsid_xml = f'<ws:WSID xsi:type="xsd:hexBinary" soap:mustUnderstand="1">{wsid}</ws:WSID>' if wsid else ""
    
    soap = f'''<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="urn:WS_Progilift" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soap:Header>{wsid_xml}</soap:Header><soap:Body><ws:{method}>{params_xml}</ws:{method}></soap:Body></soap:Envelope>'''
    
    headers = {'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': f'"urn:WS_Progilift/{method}"'}
    status, body = http_request(WS_URL, 'POST', soap.encode('utf-8'), headers, timeout)
    
    return body if status == 200 and body and "Fault" not in body else None

def parse_items(xml, tag):
    items = []
    if not xml:
        return items
    for m in re.finditer(f'<{tag}>(.*?)</{tag}>', xml, re.DOTALL):
        item = {}
        for f in re.finditer(r'<([A-Za-z0-9_]+)>([^<]*)</\1>', m.group(1)):
            val = f.group(2).strip()
            item[f.group(1)] = int(val) if val and val.lstrip('-').isdigit() else (val if val else None)
        if item:
            items.append(item)
    return items

def run_cron_sync():
    """Sync rapide pour le cron horaire"""
    start = datetime.now()
    stats = {"arrets": 0, "pannes": 0, "errors": []}
    
    # Auth
    resp = progilift_call("IdentificationTechnicien", {"sSteCodeWeb": PROGILIFT_CODE}, None, 30)
    if not resp:
        return {"status": "error", "message": "Auth failed"}
    
    m = re.search(r'WSID[^>]*>([A-F0-9]+)<', resp, re.IGNORECASE)
    if not m:
        return {"status": "error", "message": "No WSID"}
    wsid = m.group(1)
    
    # 1. Arrêts - Vider et recréer
    try:
        resp = progilift_call("get_AppareilsArret", {}, wsid, 30)
        arrets = parse_items(resp, "tabListeArrets")
        
        # Supprimer les anciens
        supabase_delete('parc_arrets')
        
        # Collecter les IDs pour le flag en_arret
        arret_ids = []
        
        for a in arrets:
            id_wsoucont = safe_int(a.get('nIDSOUCONT'))
            if id_wsoucont:
                arret_ids.append(id_wsoucont)
                supabase_insert('parc_arrets', {
                    'id_wsoucont': id_wsoucont,
                    'id_panne': safe_int(a.get('nClepanne')),
                    'code_appareil': safe_str(a.get('sAscenseur'), 50),
                    'adresse': safe_str(a.get('sAdresse'), 200),
                    'ville': safe_str(a.get('sVille'), 200),
                    'secteur': safe_int(a.get('nSecteur')),
                    'date_appel': safe_date(a.get('sDateAppel')),
                    'heure_appel': safe_time(a.get('sHeureAppel')),
                    'motif': safe_str(a.get('sMotifAppel'), 500),
                    'demandeur': safe_str(a.get('sDemandeur'), 100),
                    'synced_at': datetime.now().isoformat()
                })
        
        stats["arrets"] = len(arrets)
        
        # Mettre à jour les flags en_arret dans parc_ascenseurs
        # D'abord récupérer tous les ascenseurs actuellement marqués en_arret
        current_arrets = supabase_get('parc_ascenseurs', 'id_wsoucont', 'en_arret=eq.true')
        current_arret_ids = [a['id_wsoucont'] for a in current_arrets]
        
        # Remettre à FALSE ceux qui ne sont plus en arrêt
        for id_ws in current_arret_ids:
            if id_ws not in arret_ids:
                supabase_update('parc_ascenseurs', 'id_wsoucont', id_ws, {'en_arret': False})
        
        # Mettre à TRUE les nouveaux arrêts
        for id_ws in arret_ids:
            supabase_update('parc_ascenseurs', 'id_wsoucont', id_ws, {'en_arret': True})
                
    except Exception as e:
        stats["errors"].append(f"Arrets: {e}")
    
    # 2. Pannes récentes (30 derniers jours)
    try:
        date_30j = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")
        
        resp = progilift_call("get_Synchro_Wpanne", {"dhDerniereMajFichier": date_30j}, wsid, 60)
        items = parse_items(resp, "tabListeWpanne")
        
        pannes_list = []
        for p in items:
            # L'ID unique est P0CLEUNIK, pas IDWPANNE
            pid = safe_int(p.get('P0CLEUNIK'))
            if pid:
                pannes_list.append({
                    'id_panne': pid,
                    'id_wsoucont': safe_int(p.get('IDWSOUCONT')),
                    'code_appareil': safe_str(p.get('ASCENSEUR'), 50),
                    'adresse': safe_str(p.get('LOCAL_'), 200),
                    'code_postal': safe_str(p.get('NUM'), 10),
                    'date_appel': safe_date(p.get('APPEL') or p.get('DATE')),
                    'heure_appel': safe_time(p.get('HEUREAPP')),
                    'date_arrivee': safe_date(p.get('DATEARR')),
                    'heure_arrivee': safe_time(p.get('HEUREARR')),
                    'date_depart': safe_date(p.get('DATEDEP')),
                    'heure_depart': safe_time(p.get('HEUREDEP')),
                    'motif': safe_str(p.get('PANNES'), 500),
                    'cause': safe_str(p.get('CAUSE'), 500),
                    'travaux': safe_str(p.get('TRAVAUX'), 1000),
                    'depanneur': safe_str(p.get('DEPANNEUR'), 100),
                    'duree_minutes': safe_int(p.get('DUREE') or p.get('NOMBRE')),
                    'type_panne': safe_str(p.get('ENSEMBLE'), 100),
                    'etat': safe_str(p.get('ETAT'), 50),
                    'demandeur': safe_str(p.get('DEMANDEUR'), 100),
                    'personnes_bloquees': safe_int(p.get('PERSBLOQ')) or 0,
                    'data_wpanne': p,
                    'synced_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                })
        
        # Upsert par batch de 50
        for i in range(0, len(pannes_list), 50):
            supabase_upsert('parc_pannes', pannes_list[i:i+50], 'id_panne')
        
        stats["pannes"] = len(pannes_list)
        
    except Exception as e:
        stats["errors"].append(f"Pannes: {e}")
    
    duration = (datetime.now() - start).total_seconds()
    
    # Log
    supabase_insert('parc_sync_logs', {
        'sync_date': datetime.now().isoformat(),
        'sync_type': 'cron',
        'status': 'success' if not stats["errors"] else 'partial',
        'equipements_count': 0,
        'pannes_count': stats["pannes"],
        'arrets_count': stats["arrets"],
        'duration_seconds': round(duration, 2),
        'error_message': '; '.join(stats["errors"])[:500] if stats["errors"] else None
    })
    
    return {
        "status": "success" if not stats["errors"] else "partial",
        "mode": "cron",
        "stats": stats,
        "duration": round(duration, 2),
        "timestamp": datetime.now().isoformat()
    }

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._respond()
    
    def do_POST(self):
        self._respond()
    
    def _respond(self):
        try:
            result = run_cron_sync()
        except Exception as e:
            result = {"status": "error", "message": str(e)}
        
        body = json.dumps(result).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
    
    def log_message(self, format, *args):
        pass
