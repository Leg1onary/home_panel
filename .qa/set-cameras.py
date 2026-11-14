import json, pathlib, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
with urllib.request.urlopen(base + 'session', timeout=10) as r:
    proof = json.loads(r.read().decode('utf-8'))['proof']
exp_url = base + 'profile/export'
with urllib.request.urlopen(exp_url, timeout=10) as r:
    export = json.loads(r.read().decode('utf-8'))
prefs = export['preferences']
prefs['guardEntity'] = prefs.get('guardEntity') or 'input_boolean.okhrana'
cams = prefs.get('yardCameras')
if not isinstance(cams, list):
    cams = [cams] if cams else []
cams = [dict(c) for c in cams if isinstance(c, dict)]
# 1) двор: актуальный хост
yard = next((c for c in cams if 'C320' in (c.get('name') or '') or 'Двор' in (c.get('name') or '')), None)
if yard is None:
    yard = cams[0] if cams else {}
    if not cams: cams.append(yard)
yard.update({'name': 'Двор', 'host': '192.168.8.210', 'port': 2020, 'user': 'Mytapo_1', 'enabled': True})
yard.setdefault('pass', '')
# 2) коридор C200: новая камера
cor = next((c for c in cams if c.get('host') == '192.168.8.211'), None)
if cor is None:
    cor = {}
    cams.append(cor)
cor.update({'name': 'Коридор', 'host': '192.168.8.211', 'port': 2020, 'user': 'Mytapo_2', 'pass': 'Mkzsqa12', 'enabled': True})
prefs['yardCameras'] = cams
req = urllib.request.Request(base + 'preferences', data=json.dumps(prefs, ensure_ascii=False).encode('utf-8'),
    method='PUT', headers={'Content-Type': 'application/json', 'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read().decode('utf-8'))
        print('status:', r.status, 'saved:', body.get('saved'))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read(400).decode('utf-8'))
