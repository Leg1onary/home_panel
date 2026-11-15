import json, urllib.request, pathlib, sys
base = 'http://192.168.8.182:8090/api/panel/'
with urllib.request.urlopen(base + 'analytics', timeout=30) as r:
    data = json.loads(r.read().decode('utf-8'))
pathlib.Path(r'C:\Users\ssholokhov\home_panel\.qa\analytics-live.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
print('keys:', list(data.keys()))
print('rooms sample:', json.dumps(data.get('rooms'), ensure_ascii=False)[:200])
