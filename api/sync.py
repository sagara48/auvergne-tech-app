"""
Progilift Sync API - Synchronisation complète vers Supabase
===========================================================
Tables cibles: parc_ascenseurs, parc_pannes, parc_arrets, parc_secteurs, parc_type_planning, parc_sync_logs

Endpoints:
  ?step=0           → Types planning (table référence nb_visites)
  ?step=1           → Arrêts en cours
  ?step=2&sector=X  → Équipements Wsoucont (0-21)
  ?step=2b&sector=X → Wsoucont2: passages, DAT, TXT (0-21)
  ?step=3&period=X  → Pannes (0-6)
  ?step=4           → Mise à jour nb_visites_an
  ?mode=cron        → Sync rapide (arrêts + pannes récentes)
"""

import os
import json
import re
import ssl
import traceback
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
PROGILIFT_CODE = os.environ.get('PROGILIFT_CODE', 'AUVNB1')
WS_URL = "https://ws.progilift.fr/WS_PROGILIFT_20230419_WEB/awws/WS_Progilift_20230419.awws"

# Liste des 22 secteurs
SECTORS = ["1", "2", "3", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "17", "18", "19", "20", "71", "72", "73", "74"]

# Périodes pour les pannes
PERIODS = [
    "2025-10-01T00:00:00",
    "2025-07-01T00:00:00",
    "2025-01-01T00:00:00",
    "2024-01-01T00:00:00",
    "2023-01-01T00:00:00",
    "2022-01-01T00:00:00",
    "2020-01-01T00:00:00"
]

# SSL Context
try:
    ssl_context = ssl.create_default_context()
except:
    ssl_context = ssl._create_unverified_context()

# ============================================================
# UTILITAIRES
# ============================================================

def safe_str(value, max_len=None):
    """Convertit en string sécurisé"""
    if value is None:
        return None
    try:
        s = str(value).strip()
        return s[:max_len] if max_len and s else s if s else None
    except:
        return None

def safe_int(value):
    """Convertit en entier sécurisé"""
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
        # Format Progilift: DD/MM/YYYY ou YYYYMMDD
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
    """Requête HTTP générique"""
    headers = headers or {}
    if data and isinstance(data, (dict, list)):
        data = json.dumps(data).encode('utf-8')
        headers.setdefault('Content-Type', 'application/json')
    elif data and isinstance(data, str):
        data = data.encode('utf-8')
    
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as resp:
            return resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8') if e.fp else str(e)
    except Exception as e:
        return 0, str(e)

# ============================================================
# PROGILIFT API
# ============================================================

def progilift_call(method, params, wsid=None, timeout=60):
    """Appel SOAP à Progilift"""
    wsid_xml = f'<ws:WSID xsi:type="xsd:hexBinary" soap:mustUnderstand="1">{wsid}</ws:WSID>' if wsid else ""
    
    params_xml = ""
    for k, v in params.items():
        params_xml += f"<ws:{k}>{v}</ws:{k}>"
    
    soap = f'''<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:ws="urn:WS_Progilift" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soap:Header>{wsid_xml}</soap:Header>
    <soap:Body>
        <ws:{method}>{params_xml}</ws:{method}>
    </soap:Body>
</soap:Envelope>'''
    
    headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': f'"urn:WS_Progilift/{method}"'
    }
    
    status, body = http_request(WS_URL, 'POST', soap, headers, timeout)
    return body if status == 200 else ""

def get_auth():
    """Authentification Progilift"""
    resp = progilift_call("IdentificationTechnicien", {"sSteCodeWeb": PROGILIFT_CODE}, None, 15)
    if resp:
        m = re.search(r'WSID[^>]*>([A-F0-9]+)<', resp, re.IGNORECASE)
        if m:
            return m.group(1)
    return None

def parse_items(xml, tag):
    """Parse les items XML"""
    items = []
    pattern = f'<{tag}>(.*?)</{tag}>'
    for m in re.finditer(pattern, xml, re.DOTALL | re.IGNORECASE):
        item = {}
        for f in re.finditer(r'<([A-Za-z0-9_]+)>([^<]*)</\1>', m.group(1)):
            item[f.group(1)] = f.group(2).strip() if f.group(2).strip() else None
        if item:
            items.append(item)
    return items

# ============================================================
# SUPABASE API
# ============================================================

def supabase_headers():
    """Headers Supabase"""
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

def supabase_insert(table, data):
    """Insert dans Supabase"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    headers = supabase_headers()
    headers['Prefer'] = 'return=minimal'
    status, _ = http_request(url, 'POST', data, headers, 15)
    return status in [200, 201]

def supabase_upsert(table, data, on_conflict=None):
    """Upsert dans Supabase avec colonne de conflit optionnelle"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    headers = supabase_headers()
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal'
    status, resp = http_request(url, 'POST', data, headers, 15)
    return status in [200, 201]

def supabase_upsert_with_error(table, data, on_conflict=None):
    """Upsert dans Supabase avec retour d'erreur détaillé"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    headers = supabase_headers()
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal'
    status, resp = http_request(url, 'POST', data, headers, 60)
    if status in [200, 201]:
        return True, None
    else:
        return False, f"HTTP {status}: {resp[:500] if resp else 'No response'}"

def supabase_update(table, key_col, key_val, data):
    """Update dans Supabase"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?{key_col}=eq.{key_val}"
    status, _ = http_request(url, 'PATCH', data, supabase_headers(), 15)
    return status in [200, 204]

def supabase_delete(table, filter_str=None):
    """Delete dans Supabase"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    if filter_str:
        url += f"?{filter_str}"
    else:
        url += "?id=neq.00000000-0000-0000-0000-000000000000"  # Delete all (UUID)
    status, _ = http_request(url, 'DELETE', None, supabase_headers(), 30)
    return status in [200, 204]

def supabase_get(table, select="*", filter_str=None, limit=None):
    """Get depuis Supabase"""
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?select={select}"
    if filter_str:
        url += f"&{filter_str}"
    if limit:
        url += f"&limit={limit}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    status, body = http_request(url, 'GET', None, headers, 30)
    if status == 200:
        return json.loads(body)
    return []

# ============================================================
# STEP 0: Types de planning
# ============================================================

def sync_type_planning():
    """Synchronise la table de référence parc_type_planning depuis Wtypepla"""
    wsid = get_auth()
    if not wsid:
        return {"status": "error", "message": "Auth failed"}
    
    resp = progilift_call("get_Synchro_Wtypepla", {"dhDerniereMajFichier": "2000-01-01T00:00:00"}, wsid, 30)
    
    # Parser les items
    items = parse_items(resp, "tabListeWtypepla")
    if not items:
        items = parse_items(resp, "ST_Wtypepla")
    if not items:
        items = parse_items(resp, "Wtypepla")
    
    if not items:
        return {"status": "error", "message": "No data in Wtypepla response", "response_size": len(resp)}
    
    # Supprimer et recréer
    supabase_delete('parc_type_planning')
    inserted = 0
    
    for item in items:
        code = safe_str(item.get('TYPEPLANNING') or item.get('typeplanning'), 50)
        nb_visites = safe_int(item.get('NB_VISITES') or item.get('nb_visites'))
        libelle = safe_str(item.get('LIBELLEPLAN') or item.get('libelleplan'), 200)
        id_type = safe_int(item.get('IDWTYPEPLA') or item.get('idwtypepla'))
        
        if code:
            if supabase_insert('parc_type_planning', {
                'id_wtypepla': id_type,
                'code': code,
                'nb_visites': nb_visites,
                'libelle': libelle
            }):
                inserted += 1
    
    return {
        "status": "success",
        "step": 0,
        "type_planning_found": len(items),
        "inserted": inserted,
        "next": "?step=1"
    }

# ============================================================
# STEP 1: Arrêts en cours
# ============================================================

def sync_arrets():
    """Synchronise les appareils à l'arrêt dans parc_arrets"""
    wsid = get_auth()
    if not wsid:
        return {"status": "error", "message": "Auth failed"}
    
    resp = progilift_call("get_AppareilsArret", {}, wsid, 30)
    arrets = parse_items(resp, "tabListeArrets")
    
    # Supprimer les anciens arrêts
    supabase_delete('parc_arrets')
    
    # Remettre tous les ascenseurs en_arret = FALSE
    # (on ne peut pas faire un UPDATE global facilement, on le fera dans step 4)
    
    inserted = 0
    wsoucont_ids = []
    
    for a in arrets:
        id_wsoucont = safe_int(a.get('nIDSOUCONT'))
        if not id_wsoucont:
            continue
            
        wsoucont_ids.append(id_wsoucont)
        
        if supabase_insert('parc_arrets', {
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
        }):
            inserted += 1
    
    return {
        "status": "success",
        "step": 1,
        "arrets_found": len(arrets),
        "inserted": inserted,
        "wsoucont_ids": wsoucont_ids,
        "next": "?step=2&sector=0"
    }

# ============================================================
# STEP 2: Équipements (Wsoucont)
# ============================================================

def sync_equipements(sector_idx):
    """Synchronise les équipements pour un secteur dans parc_ascenseurs"""
    if sector_idx >= len(SECTORS):
        return {"status": "done", "message": "All sectors completed", "next": "?step=2b&sector=0"}
    
    sector = SECTORS[sector_idx]
    wsid = get_auth()
    if not wsid:
        return {"status": "error", "message": "Auth failed"}
    
    resp = progilift_call("get_Synchro_Wsoucont", {
        "dhDerniereMajFichier": "2000-01-01T00:00:00",
        "sListeSecteursTechnicien": sector
    }, wsid, 120)
    
    items = parse_items(resp, "tabListeWsoucont")
    upserted = 0
    
    for e in items:
        id_wsoucont = safe_int(e.get('IDWSOUCONT'))
        if not id_wsoucont:
            continue
        
        data = {
            'id_wsoucont': id_wsoucont,
            'id_wcontrat': safe_int(e.get('IDWCONTRAT')),
            'secteur': safe_int(e.get('SECTEUR')),
            'code_appareil': safe_str(e.get('ASCENSEUR'), 50),
            'indice': safe_int(e.get('INDICE')),
            'adresse': safe_str(e.get('DES2'), 200),
            'ville': safe_str(e.get('DES3'), 200),
            'code_postal': safe_str(e.get('DES3', '')[:5] if e.get('DES3') else None, 10),
            'localisation': safe_str(e.get('LOCALISATION'), 200),
            'nom_convivial': safe_str(e.get('NOM_CONVIVIAL'), 100),
            'client_ref': safe_str(e.get('REFCLI'), 100),
            'client_ref2': safe_str(e.get('REFCLI2'), 100),
            'client_ref3': safe_str(e.get('REFCLI3'), 100),
            'num_appareil_client': safe_str(e.get('NUMAPPCLI'), 50),
            'genre': safe_int(e.get('GENRE')),
            'type_appareil': safe_str(e.get('TYPE'), 50),
            'marque': safe_str(e.get('DIV1'), 100),
            'modele': safe_str(e.get('DIV2'), 100),
            'num_serie': safe_str(e.get('DIV7'), 100),
            'tel_cabine': safe_str(e.get('TELCABINE'), 50),
            'type_depannage': safe_int(e.get('IDTYPE_DEPANNAGE')),
            'securite': safe_int(e.get('SECURITE')),
            'securite2': safe_int(e.get('SECURITE2')),
            'type_planning': safe_str(e.get('TYPEPLANNING'), 50),
            # Planning mensuel (1 = mois prévu)
            'planning_jan': safe_int(e.get('JAN')) == 1,
            'planning_fev': safe_int(e.get('FEV')) == 1,
            'planning_mar': safe_int(e.get('MAR')) == 1,
            'planning_avr': safe_int(e.get('AVR')) == 1,
            'planning_mai': safe_int(e.get('MAI')) == 1,
            'planning_jun': safe_int(e.get('JUI')) == 1,
            'planning_jul': safe_int(e.get('JUL')) == 1,
            'planning_aou': safe_int(e.get('AOU')) == 1,
            'planning_sep': safe_int(e.get('SEP')) == 1,
            'planning_oct': safe_int(e.get('OCT')) == 1,
            'planning_nov': safe_int(e.get('NOV')) == 1,
            'planning_dec': safe_int(e.get('DEC')) == 1,
            'data_wsoucont': e,
            'synced_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        if supabase_upsert('parc_ascenseurs', data, 'id_wsoucont'):
            upserted += 1
    
    next_sector = sector_idx + 1
    return {
        "status": "success",
        "step": 2,
        "sector": sector,
        "sector_idx": sector_idx,
        "equipements_found": len(items),
        "upserted": upserted,
        "next": f"?step=2&sector={next_sector}" if next_sector < len(SECTORS) else "?step=2b&sector=0"
    }

# ============================================================
# STEP 2b: Passages et données complémentaires (Wsoucont2)
# ============================================================

def sync_passages(sector_idx):
    """Synchronise les passages (Wsoucont2) pour un secteur"""
    if sector_idx >= len(SECTORS):
        return {"status": "done", "message": "All sectors completed", "next": "?step=3&period=0"}
    
    sector = SECTORS[sector_idx]
    wsid = get_auth()
    if not wsid:
        return {"status": "error", "message": "Auth failed"}
    
    resp = progilift_call("get_Synchro_Wsoucont2", {
        "dhDerniereMajFichier": "2000-01-01T00:00:00",
        "sListeSecteursTechnicien": sector
    }, wsid, 120)
    
    items = parse_items(resp, "tabListeWsoucont2")
    updated = 0
    
    for e in items:
        id_wsoucont = safe_int(e.get('IDWSOUCONT'))
        if not id_wsoucont:
            continue
        
        # Convertir les dates de passage (format YYYYMMDD en entier)
        def convert_passage_date(val):
            if not val:
                return None
            try:
                s = str(val)
                if len(s) == 8:
                    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
                return None
            except:
                return None
        
        data = {
            'passage_1': convert_passage_date(e.get('DATEPASS1')),
            'passage_2': convert_passage_date(e.get('DATEPASS2')),
            'passage_3': convert_passage_date(e.get('DATEPASS3')),
            'passage_4': convert_passage_date(e.get('DATEPASS4')),
            'passage_5': convert_passage_date(e.get('DATEPASS5')),
            'dernier_passage': convert_passage_date(e.get('DATEPASS1')),  # Le plus récent
            'data_wsoucont2': e,
            'updated_at': datetime.now().isoformat()
        }
        
        if supabase_update('parc_ascenseurs', 'id_wsoucont', id_wsoucont, data):
            updated += 1
    
    next_sector = sector_idx + 1
    return {
        "status": "success",
        "step": "2b",
        "sector": sector,
        "sector_idx": sector_idx,
        "passages_found": len(items),
        "updated": updated,
        "next": f"?step=2b&sector={next_sector}" if next_sector < len(SECTORS) else "?step=3&period=0"
    }

# ============================================================
# STEP 3: Pannes
# ============================================================

def sync_pannes(period_idx):
    """Synchronise les pannes pour une période dans parc_pannes"""
    if period_idx >= len(PERIODS):
        return {"status": "done", "message": "All periods completed", "next": "?step=4"}
    
    since_date = PERIODS[period_idx]
    wsid = get_auth()
    if not wsid:
        return {"status": "error", "message": "Auth failed"}
    
    resp = progilift_call("get_Synchro_Wpanne", {
        "dhDerniereMajFichier": since_date
    }, wsid, 180)
    
    items = parse_items(resp, "tabListeWpanne")
    upserted = 0
    errors = []
    skipped = 0
    
    # Debug: premier item
    first_item = items[0] if items else None
    first_keys = list(first_item.keys())[:15] if first_item else []
    
    # Préparer les données en batch
    batch = []
    for p in items:
        id_panne = safe_int(p.get('IDWPANNE'))
        if not id_panne:
            skipped += 1
            continue
        
        data = {
            'id_panne': id_panne,
            'id_wsoucont': safe_int(p.get('IDWSOUCONT')),
            'code_appareil': safe_str(p.get('ASCENSEUR'), 50),
            'adresse': safe_str(p.get('ADRES'), 200),
            'code_postal': safe_str(p.get('NUM'), 10),
            'date_appel': safe_date(p.get('DATEAPP')),
            'heure_appel': safe_time(p.get('HEUREAPP')),
            'date_arrivee': safe_date(p.get('DATEARR')),
            'heure_arrivee': safe_time(p.get('HEUREARR')),
            'date_depart': safe_date(p.get('DATEDEP')),
            'heure_depart': safe_time(p.get('HEUREDEP')),
            'motif': safe_str(p.get('MOTIF'), 500),
            'cause': safe_str(p.get('CAUSE'), 500),
            'travaux': safe_str(p.get('TRAVAUX'), 1000),
            'depanneur': safe_str(p.get('DEPANNEUR'), 100),
            'duree_minutes': safe_int(p.get('DUREE')),
            'type_panne': safe_str(p.get('TYPEPANNE'), 100),
            'etat': safe_str(p.get('ETAT'), 50),
            'demandeur': safe_str(p.get('DEMANDEUR'), 100),
            'personnes_bloquees': safe_int(p.get('PERSBLOQ')) or 0,
            'data_wpanne': p,
            'synced_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        batch.append(data)
    
    # Debug: premier batch item
    first_batch = batch[0] if batch else None
    
    # Upsert par batch de 100
    batch_size = 100
    for i in range(0, len(batch), batch_size):
        chunk = batch[i:i+batch_size]
        success, error_msg = supabase_upsert_with_error('parc_pannes', chunk, 'id_panne')
        if success:
            upserted += len(chunk)
        else:
            errors.append(f"Batch {i//batch_size}: {error_msg}")
    
    next_period = period_idx + 1
    result = {
        "status": "success" if not errors else "partial",
        "step": 3,
        "period": since_date,
        "period_idx": period_idx,
        "pannes_found": len(items),
        "valid_batch": len(batch),
        "skipped": skipped,
        "upserted": upserted,
        "debug_keys": first_keys,
        "debug_first_id": first_item.get('IDWPANNE') if first_item else None,
        "next": f"?step=3&period={next_period}" if next_period < len(PERIODS) else "?step=4"
    }
    if errors:
        result["errors"] = errors[:5]
    if first_batch:
        result["debug_sample"] = {k: first_batch[k] for k in ['id_panne', 'code_appareil', 'date_appel'] if k in first_batch}
    return result

# ============================================================
# STEP 4: Mise à jour nb_visites_an et flags en_arret
# ============================================================

def update_nb_visites():
    """Met à jour nb_visites_an dans parc_ascenseurs via parc_type_planning et les flags en_arret"""
    
    # Récupérer la table type_planning
    type_planning = supabase_get('parc_type_planning', 'code,nb_visites')
    if not type_planning:
        return {"status": "error", "message": "parc_type_planning table is empty. Run ?step=0 first."}
    
    type_map = {tp['code']: tp['nb_visites'] for tp in type_planning if tp.get('code')}
    
    # Récupérer les équipements avec typeplanning
    equipements = supabase_get('parc_ascenseurs', 'id_wsoucont,type_planning', 'type_planning=not.is.null')
    
    updated = 0
    for eq in equipements:
        type_planning_code = eq.get('type_planning')
        if type_planning_code and type_planning_code in type_map:
            nb_visites = type_map[type_planning_code]
            if supabase_update('parc_ascenseurs', 'id_wsoucont', eq['id_wsoucont'], {'nb_visites_an': nb_visites}):
                updated += 1
    
    # Mettre à jour les flags en_arret
    # D'abord tout à FALSE
    # Puis TRUE pour ceux qui sont dans parc_arrets
    arrets = supabase_get('parc_arrets', 'id_wsoucont')
    arret_ids = [a['id_wsoucont'] for a in arrets if a.get('id_wsoucont')]
    
    # Reset all to FALSE (on fait un update par batch)
    all_equip = supabase_get('parc_ascenseurs', 'id_wsoucont')
    for eq in all_equip:
        en_arret = eq['id_wsoucont'] in arret_ids
        supabase_update('parc_ascenseurs', 'id_wsoucont', eq['id_wsoucont'], {'en_arret': en_arret})
    
    # Log de synchronisation
    supabase_insert('parc_sync_logs', {
        'sync_date': datetime.now().isoformat(),
        'sync_type': 'full',
        'status': 'success',
        'equipements_count': len(all_equip),
        'pannes_count': 0,  # Non compté ici
        'arrets_count': len(arret_ids),
        'duration_seconds': 0  # Non mesuré ici
    })
    
    return {
        "status": "success",
        "step": 4,
        "type_planning_codes": len(type_map),
        "equipements_with_planning": len(equipements),
        "updated": updated,
        "arrets_flagged": len(arret_ids),
        "message": "nb_visites_an and en_arret flags updated!"
    }

# ============================================================
# CRON: Sync rapide
# ============================================================

def sync_cron():
    """Sync rapide pour cron job (arrêts + pannes récentes)"""
    start = datetime.now()
    results = {}
    
    # Arrêts
    r1 = sync_arrets()
    results['arrets'] = r1.get('inserted', 0)
    
    # Pannes récentes (première période seulement)
    r2 = sync_pannes(0)
    results['pannes'] = r2.get('upserted', 0)
    
    # Mettre à jour les flags en_arret
    arrets = supabase_get('parc_arrets', 'id_wsoucont')
    arret_ids = [a['id_wsoucont'] for a in arrets if a.get('id_wsoucont')]
    
    # On ne met à jour que les flags des ascenseurs concernés
    for id_wsoucont in arret_ids:
        supabase_update('parc_ascenseurs', 'id_wsoucont', id_wsoucont, {'en_arret': True})
    
    duration = (datetime.now() - start).total_seconds()
    
    # Log
    supabase_insert('parc_sync_logs', {
        'sync_date': datetime.now().isoformat(),
        'sync_type': 'cron',
        'status': 'success',
        'equipements_count': 0,
        'pannes_count': results['pannes'],
        'arrets_count': results['arrets'],
        'duration_seconds': round(duration, 2)
    })
    
    return {
        "status": "success",
        "mode": "cron",
        "results": results,
        "duration": round(duration, 2),
        "timestamp": datetime.now().isoformat()
    }

# ============================================================
# HANDLER HTTP (Vercel)
# ============================================================

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._respond()
    
    def do_POST(self):
        self._respond()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def _respond(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            step = params.get('step', [''])[0]
            sector = int(params.get('sector', ['0'])[0])
            period = int(params.get('period', ['0'])[0])
            mode = params.get('mode', [''])[0]
            
            if mode == 'cron':
                result = sync_cron()
            elif step == '0':
                result = sync_type_planning()
            elif step == '1':
                result = sync_arrets()
            elif step == '2':
                result = sync_equipements(sector)
            elif step == '2b':
                result = sync_passages(sector)
            elif step == '3':
                result = sync_pannes(period)
            elif step == '4':
                result = update_nb_visites()
            else:
                result = {
                    "status": "ready",
                    "message": "Progilift Sync API v3 - AuvergneTech",
                    "tables": {
                        "parc_ascenseurs": "Équipements (id_wsoucont unique)",
                        "parc_pannes": "Historique pannes (id_panne unique)",
                        "parc_arrets": "Arrêts en cours (temps réel)",
                        "parc_type_planning": "Référentiel plannings",
                        "parc_secteurs": "Référentiel secteurs",
                        "parc_sync_logs": "Logs synchronisation"
                    },
                    "config": {
                        "sectors": len(SECTORS),
                        "periods": len(PERIODS)
                    },
                    "endpoints": {
                        "step0": "?step=0 → Types planning (référentiel nb_visites)",
                        "step1": "?step=1 → Arrêts en cours",
                        "step2": "?step=2&sector=0..21 → Équipements (Wsoucont)",
                        "step2b": "?step=2b&sector=0..21 → Passages (Wsoucont2)",
                        "step3": "?step=3&period=0..6 → Pannes",
                        "step4": "?step=4 → Mise à jour nb_visites_an + flags en_arret",
                        "cron": "?mode=cron → Sync rapide (arrêts + pannes récentes)"
                    },
                    "full_sync_order": "0 → 1 → 2 (x22) → 2b (x22) → 3 (x7) → 4"
                }
        
        except Exception as e:
            result = {
                "status": "error",
                "message": str(e),
                "trace": traceback.format_exc()[:500]
            }
        
        body = json.dumps(result, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
    
    def log_message(self, format, *args):
        pass
