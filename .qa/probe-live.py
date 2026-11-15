import json, urllib.request, sys
base = 'http://192.168.8.182:8090/api/panel/'
def call(path, method='GET', body=None):
    with urllib.request.urlopen(base + 'session', timeout=10) as r:
        proof = json.loads(r.read().decode('utf-8'))['proof']
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(body).encode('utf-8') if body is not None else None,
        headers={'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read(400).decode('utf-8', 'replace')
for p in ['analytics', 'yard-clips?limit=3', 'yard-motion']:
    s, b = call(p)
    print('==', p, '->', s)
    print(json.dumps(b, ensure_ascii=False)[:900] if isinstance(b, (dict, list)) else b)
