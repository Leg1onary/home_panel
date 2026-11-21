import json, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
def get(path):
    with urllib.request.urlopen(base + path, timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))
exp = get('profile/export')['preferences']
ok = 0
for room in ('office', 'children', 'bedroom'):
    for kind in ('temperature', 'humidity', 'battery'):
        b = exp['bindings'].get(f'{kind}:{room}', {})
        v = b.get('verified')
        ok += 1 if v else 0
        print(f'{kind}:{room} verified={v}')
print('verified:', ok, '/ 9')
model = get('device-model')
items = model.get('devices') or model.get('groups') or []
for g in items:
    if 'climate' in g.get('id', ''):
        print(g['id'], '|', g.get('name'), '| availability:', g.get('availability'))
