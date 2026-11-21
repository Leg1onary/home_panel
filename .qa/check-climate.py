import json, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
def get(path):
    with urllib.request.urlopen(base + path, timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))
exp = get('profile/export')['preferences']
for room in ('office', 'children', 'bedroom'):
    for kind in ('temperature', 'humidity', 'battery'):
        b = exp['bindings'].get(f'{kind}:{room}')
        print(f'{kind}:{room} -> {b}')
model = get('device-model')
climates = [g for g in model['groups'] if g['id'].startswith('unit-climate-')]
for g in climates:
    print(g['id'], g['name'], 'availability:', g['availability'])
