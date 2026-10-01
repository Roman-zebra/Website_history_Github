import bpy,json
from pathlib import Path
folder=Path(__file__).resolve().parents[3].parent/'research-cache/haori-support-119-003'
bpy.ops.wm.open_mainfile(filepath=str(folder/'settled.blend'))
v=bpy.data.objects['Haori_connected'].data.vertices
assert len(v)==956
p=lambda i:v[i].co
sags=[]
for name,inner,outer in [('left',[56,154],[341,361]),('right',[69,223],[401,421])]:
 innerZ=sum(p(i).z for i in inner)/2;outerZ=sum(p(i).z for i in outer)/2;sags.append({'sleeve':name,'innerUnderarmZ':innerZ,'outerUndersideZ':outerZ,'additionalSag':innerZ-outerZ,'fractionOf390mmSleeveDepth':(innerZ-outerZ)/.39})
folds=[]
for row in [4,5,6,7]:
 values=[p(126+row*7+i).x for i in range(7)]+[p(189+row*7+i).x for i in range(7)]
 folds.append({'row':row,'frontXPeakToTrough':max(values)-min(values),'frontX':values,'scope':'Sampled garment front row, includes broad body profile; not individual crease amplitude certification'})
collars=[]
for base,frontBase,edge in [(442,126,6),(460,189,0)]:
 for row in [1,2,3,4]:
  seam=p(frontBase+row*7+edge)
  collars.append({'base':base,'row':row,'foldXDepth':max(p(base+row*3+i).x-seam.x for i in range(3)),'scope':'Fold projection toward front; not solid fabric thickness'})
record={'sleeves':sags,'foldRows':folds,'collarRows':collars,'basis':'Saved003 settled solidified geometry, preserved first478 midsurface vertex order; coordinates after80mm support translation','all119DimensionsApproved':False}
(folder/'shape-measurements.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps({'sags':sags,'foldRanges':[x['frontXPeakToTrough'] for x in folds],'collarRange':[min(x['foldXDepth'] for x in collars),max(x['foldXDepth'] for x in collars)]}),flush=True)
