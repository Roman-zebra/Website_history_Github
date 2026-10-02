import bpy,json,hashlib
from pathlib import Path
folder=Path(__file__).resolve().parents[3].parent/'research-cache/haori-shape-audit-119-004';source=folder.parent/'haori-support-119-003/settled.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));v=bpy.data.objects['Haori_connected'].data.vertices;assert len(v)==956
profiles=[]
for row in [4,5,6,7]:
 for label,ids,sign in [('back',[row*14+i for i in range(14)],-1),('frontL',[126+row*7+i for i in range(7)],1),('frontR',[189+row*7+i for i in range(7)],1)]:
  ys=[v[i].co.y for i in ids];xs=[sign*v[i].co.x for i in ids];assert all(b>a for a,b in zip(ys,ys[1:])),('Folded Y-order',label,row)
  valleys=[0]+[i for i in range(1,len(xs)-1) if xs[i]<xs[i-1] and xs[i]<xs[i+1]]+[len(xs)-1]
  peaks=[]
  for i in range(1,len(xs)-1):
   if not(xs[i]>xs[i-1] and xs[i]>xs[i+1]):continue
   left=max(k for k in valleys if k<i);right=min(k for k in valleys if k>i);t=(ys[i]-ys[left])/(ys[right]-ys[left]);baseline=xs[left]*(1-t)+xs[right]*t;depth=xs[i]-baseline
   peaks.append({'column':i,'brackets':[left,right],'boundaryBracket':left==0 or right==len(xs)-1,'depth':depth,'within10to25mm':.01<=depth<=.025})
  profiles.append({'surface':label,'row':row,'maxYStep':max(b-a for a,b in zip(ys,ys[1:])),'y':ys,'outwardX':xs,'crests':peaks})
hem=[]
for name,base,cols,sign in [('back',0,14,1),('frontL',126,7,-1),('frontR',189,7,-1)]:
 hem.append({'surface':name,'inwardProjectionRow8MinusRow7':[sign*(v[base+8*cols+i].co.x-v[base+7*cols+i].co.x) for i in range(cols)]})
r={'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'profiles':profiles,'hem':hem,'method':json.loads((folder/'brief.json').read_text(encoding='utf-8-sig')),'assetChanged':False,'final119CreasesApproved':False}
(folder/'measurements.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps([{'surface':x['surface'],'row':x['row'],'peaks':x['crests']} for x in profiles]),flush=True)
