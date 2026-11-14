import json, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
with urllib.request.urlopen(base + 'session', timeout=10) as r:
    proof = json.loads(r.read().decode('utf-8'))['proof']
for dev in ['camera-yard', 'camera-extra-1']:
    req = urllib.request.Request(base + 'ha/camera',
        data=json.dumps({'id': dev, 'image': True}).encode('utf-8'), method='POST',
        headers={'Content-Type': 'application/json', 'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
            print(dev, '->', r.status, 'bytes', len(data), 'jpeg' if data[:2] == b'\xff\xd8' else 'not-jpeg')
    except urllib.error.HTTPError as e:
        print(dev, '-> HTTP', e.code, e.read(200).decode('utf-8', 'replace'))
