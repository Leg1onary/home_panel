import json,io,os
root=r'C:\Users\ssholokhov\home_panel'
for rel,key in [(r'home_panel\config.json','version'),(r'development\addon\home-panel\manifest.json','version'),(r'development\package.json','version')]:
    p=os.path.join(root,rel)
    with io.open(p,'r',encoding='utf-8') as f: d=json.load(f)
    d[key]='3.9.13'
    with io.open(p,'w',encoding='utf-8') as f:
        json.dump(d,f,ensure_ascii=False,indent=2)
        f.write('\n')
    print(rel,'->',d[key])
