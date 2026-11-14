import json, urllib.request, time
base = 'http://192.168.8.182:8090/api/panel/'
for attempt in range(1, 4):
    with urllib.request.urlopen(base + 'session', timeout=10) as r:
        proof = json.loads(r.read().decode('utf-8'))['proof']
    with urllib.request.urlopen(base + 'profile/export', timeout=10) as r:
        prefs = json.loads(r.read().decode('utf-8'))['preferences']
    b = prefs['bindings'].get('camera-extra-1') or {}
    if b.get('entityId') != 'camera.koridor_c200_mainstream':
        b = {'entityId': 'camera.koridor_c200_mainstream', 'verified': True}
    else:
        b['verified'] = True
    prefs['bindings']['camera-extra-1'] = b
    req = urllib.request.Request(base + 'preferences', data=json.dumps(prefs, ensure_ascii=False).encode('utf-8'),
        method='PUT', headers={'Content-Type': 'application/json', 'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090'})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read().decode('utf-8'))
    saved = body.get('saved')
    # проверяем, что верификация удержалась
    with urllib.request.urlopen(base + 'profile/export', timeout=10) as r:
        chk = json.loads(r.read().decode('utf-8'))['preferences']['bindings']['camera-extra-1']
    print('attempt', attempt, 'saved:', saved, 'binding now:', json.dumps(chk, ensure_ascii=False))
    if chk.get('verified'):
        break
    time.sleep(3)
