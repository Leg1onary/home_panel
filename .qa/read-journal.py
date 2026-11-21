import json, urllib.request
d = json.loads(urllib.request.urlopen('http://192.168.8.182:8090/api/panel/health', timeout=20).read().decode('utf-8'))
for item in d.get('journal', [])[:15]:
    print(json.dumps(item, ensure_ascii=False))
