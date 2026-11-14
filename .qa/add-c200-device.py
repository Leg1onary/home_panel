import json, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
with urllib.request.urlopen(base + 'session', timeout=10) as r:
    proof = json.loads(r.read().decode('utf-8'))['proof']
with urllib.request.urlopen(base + 'profile/export', timeout=10) as r:
    prefs = json.loads(r.read().decode('utf-8'))['preferences']
for d in prefs['devices']:
    if d.get('id') == 'camera-extra-1':
        d['name'] = 'Коридор · Tapo C200'
        d['status'] = 'installed'
        d['note'] = 'TP-Link C200 · коридор · ONVIF-кадры и сенсоры через HA'
        d['room'] = 'yard'
bindings = prefs.get('bindings')
if isinstance(bindings, dict):
    bindings['camera-extra-1'] = {'entityId': 'camera.koridor_c200_mainstream', 'verified': True}
req = urllib.request.Request(base + 'preferences', data=json.dumps(prefs, ensure_ascii=False).encode('utf-8'),
    method='PUT', headers={'Content-Type': 'application/json', 'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print('status:', r.status, json.loads(r.read().decode('utf-8')).get('saved'))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read(400).decode('utf-8'))
