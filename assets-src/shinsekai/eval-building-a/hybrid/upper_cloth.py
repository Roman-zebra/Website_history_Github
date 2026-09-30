"""Original cloth detail adapter; frozen Claude arrangement and RNG stay intact."""
import math
import bpy
import numpy as np
from mathutils import Vector

TARGETS={'UD_CoatRail_Haori','UD_DryingPole_Cloths','UD_ClothBolt_Spread'}

def wrinkle_image(size=256):
    # Original periodic 12cm height field: soft fine creases and a woven relief.
    v,u=np.mgrid[0:size,0:size]/size
    tau=math.tau
    h=.00022*np.sin(tau*(3*u+.5*np.sin(tau*v)))
    h+=.00013*np.sin(tau*(2*v+.3*np.sin(tau*u)))
    h+=.000018*np.cos(tau*32*u)*np.cos(tau*32*v)
    dx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*size/(2*.12)
    dy=(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*size/(2*.12)
    xyz=np.stack((-dx,-dy,np.ones_like(h)),axis=-1)
    xyz/=np.linalg.norm(xyz,axis=-1,keepdims=True)
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=xyz*.5+.5
    image=bpy.data.images.new('Original cloth fine wrinkles and weave',width=size,height=size,alpha=False)
    image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.ravel());image.pack()
    return image

def install(upper):
    original=upper.fquad
    state={'panels':[],'addedTriangles':0,'maximumThickness':.003,'normalTileMetres':.12}
    material=upper.MATS['cloth'].copy();material.name='Original cloth with fine wrinkle normal'
    tree=material.node_tree;bs=next(n for n in tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=tree.nodes.new('ShaderNodeTexImage');tex.image=wrinkle_image();tex.extension='REPEAT'
    normal=tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7
    normal.uv_map='UVMap';tree.links.new(tex.outputs['Color'],normal.inputs['Color']);tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    def replacement(n,org,U,V,want,mat,col=None,nu=1,nv=1,disp=None,tile=.5,normalize_uv=True):
        chosen=n.name in TARGETS and mat=='cloth' and nu>1 and nv>1
        before=set(n.bm.faces) if chosen else None
        result=original(n,org,U,V,want,material if chosen else mat,col,nu,nv,disp,tile,normalize_uv)
        if not chosen:return result
        faces=[f for f in n.bm.faces if f not in before];front=set(faces)
        vertices={v for f in faces for v in f.verts};back={}
        inverse=n.M[-1].inverted();direction=(n.M[-1].to_3x3()@Vector(want)).normalized()
        vv=Vector(V);origin=Vector(org);length=vv.length
        for v in vertices:
            t=max(0,min(1,(inverse@v.co-origin).dot(vv)/(length*length)))
            hem=max(0,1-(1-t)*length/.008)
            thickness=.0012+.0018*hem
            back[v]=n.bm.verts.new(v.co-direction*thickness)
        boundary=[(loop,f) for f in faces for loop in f.loops if sum(x in front for x in loop.edge.link_faces)==1]
        for f in faces:
            loops=list(f.loops)[::-1];new=n.bm.faces.new([back[l.vert] for l in loops]);new.material_index=f.material_index;new.smooth=f.smooth
            for a,b in zip(new.loops,loops):a[n.uvl].uv=b[n.uvl].uv;a[n.col]=b[n.col]
        for loop,f in boundary:
            following=loop.link_loop_next
            new=n.bm.faces.new([following.vert,loop.vert,back[loop.vert],back[following.vert]])
            new.material_index=f.material_index;new.smooth=False
            for a,b in zip(new.loops,[following,loop,loop,following]):a[n.uvl].uv=b[n.uvl].uv;a[n.col]=b[n.col]
            # Give the edge its own non-degenerate metric UV rectangle.
            edgeLength=(following.vert.co-loop.vert.co).length/tile
            for a,uv in zip(new.loops,[(edgeLength,0),(0,0),(0,.003/tile),(edgeLength,.003/tile)]):a[n.uvl].uv=uv
        triangles=sum(len(f.verts)-2 for f in faces)+2*len(boundary)
        state['panels'].append({'node':n.name,'frontTriangles':sum(len(f.verts)-2 for f in faces),'addedTriangles':triangles,'boundaryEdges':len(boundary),'frontPositionsPreserved':True})
        state['addedTriangles']+=triangles
        n.extras['clothDetail']='A: invented 1.2mm cloth body / 3mm folded lower edge and original fine wrinkle normal; authored front and arrangement retained'
        return result
    upper.fquad=replacement
    return state
