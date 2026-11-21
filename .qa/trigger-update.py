import json,urllib.request
base='http://192.168.8.182:8090/api/panel/'
proof=json.load(urllib.request.urlopen(base+'session'))['proof']
req=urllib.request.Request(base+'addon-update',method='POST',data=b'{}',headers={'X-Panel-Proof':proof,'Origin':'http://192.168.8.182:8090','Content-Type':'application/json'})
try:
    print(json.load(urllib.request.urlopen(req,timeout=120)))
except Exception as e:
    print('ERROR:',e)
