import json, pathlib, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
with urllib.request.urlopen(base + 'session', timeout=10) as r:
    proof = json.loads(r.read().decode('utf-8'))['proof']
export = json.loads(pathlib.Path(r'C:\Users\ssholokhov\home_panel\.qa\profile_export.json').read_text(encoding='utf-8-sig'))
prefs = export['preferences']
prefs['guardEntity'] = 'input_boolean.okhrana'
req = urllib.request.Request(base + 'preferences', data=json.dumps(prefs, ensure_ascii=False).encode('utf-8'),
    method='PUT', headers={'Content-Type': 'application/json', 'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090'})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print('status:', r.status)
        print(r.read(300).decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read(400).decode('utf-8'))
