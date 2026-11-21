import json, urllib.request
base = 'http://192.168.8.182:8090/api/panel/'
def call(path, method='GET', body=None):
    with urllib.request.urlopen(base + 'session', timeout=10) as r:
        proof = json.loads(r.read().decode('utf-8'))['proof']
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None,
        headers={'X-Panel-Proof': proof, 'Origin': 'http://192.168.8.182:8090', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))
prefs = call('profile/export')['preferences']
ROOMS = {
    'office': ('Кабинет', 'sensor.kabinet_datchik_temperatury_temperatura', 'sensor.kabinet_datchik_temperatury_vlazhnost', 'sensor.kabinet_datchik_temperatury_uroven_zariada'),
    'children': ('Детская', 'sensor.detskaia_datchik_temperatury_temperatura', 'sensor.detskaia_datchik_temperatury_vlazhnost', 'sensor.detskaia_datchik_temperatury_uroven_zariada'),
    'bedroom': ('Спальня', 'sensor.spalnia_datchik_temperatury_temperatura', 'sensor.spalnia_datchik_temperatury_vlazhnost', 'sensor.spalnia_datchik_temperatury_uroven_zariada'),
}
byId = {d['id']: d for d in prefs['devices']}
for room, (label, tEnt, hEnt, bEnt) in ROOMS.items():
    for kind, ent in (('temperature', tEnt), ('humidity', hEnt)):
        did = f'{kind}:{room}'
        if did not in byId:
            dev = {'id': did, 'type': kind, 'room': room, 'name': f'{kind.capitalize()} · {label}',
                   'status': 'installed', 'note': 'Miaomiaoce T2 · Yandex.Station · по выгрузке HA', 'masterOff': False}
            prefs['devices'].append(dev); byId[did] = dev
    bid = f'battery:{room}'
    if bid not in byId:
        dev = {'id': bid, 'type': 'battery', 'room': room, 'name': f'Батарейка · {label}',
               'status': 'installed', 'note': 'Miaomiaoce T2 · по выгрузке HA', 'masterOff': False}
        prefs['devices'].append(dev); byId[bid] = dev
    prefs['bindings'][f'temperature:{room}'] = {'entityId': tEnt, 'verified': True}
    prefs['bindings'][f'humidity:{room}'] = {'entityId': hEnt, 'verified': True}
    prefs['bindings'][f'battery:{room}'] = {'entityId': bEnt, 'verified': True}
model = prefs.get('deviceModel') or {'version': 1, 'groups': []}
have = {g['id'] for g in model['groups']}
for room, (label, *_rest) in ROOMS.items():
    gid = f'unit-climate-{room}'
    if gid not in have:
        model['groups'].append({'id': gid, 'name': f'Датчик климата · {label}', 'room': room,
                                'members': [f'temperature:{room}', f'humidity:{room}', f'battery:{room}'],
                                'visual': {'mode': 'room'}})
prefs['deviceModel'] = model
# Фаза 1: очищаем привязки, чтобы сервер увидел «изменение сущности» и
# провёл проверку заново (он верифицирует только изменённые entityId).
cleared = dict(prefs)
for room in ROOMS:
    for kind in ('temperature', 'humidity', 'battery'):
        cleared['bindings'][f'{kind}:{room}'] = {'entityId': '', 'verified': False}
call('preferences', 'PUT', cleared)
# Фаза 2: ставим реальные сущности с verified=true.
result = call('preferences', 'PUT', prefs)
print('saved:', result.get('saved'))
print('rejected:', result.get('rejected'))
print('offline:', result.get('offline'))
rep = result.get('report') or result.get('rejected')
print('report:', json.dumps(rep, ensure_ascii=False)[:800] if rep else 'none')
msg = result.get('message')
print('message:', msg)
