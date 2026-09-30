"""Optional runtime flower derivative; authored anchors and RNG sequence retained."""
import bmesh
from mathutils import Matrix

def install(upper):
    state={'anchors':[], 'removedTriangles':0}
    original=upper.chrysanthemum
    basis=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
    def replacement(n,c,d,R,col,rng,petals=10,rings=3,mat='petal',core=(214,168,60)):
        if n.extras.get('dreamObject')!='flowers':
            return original(n,c,d,R,col,rng,petals,rings,mat,core)
        before=set(n.bm.faces)
        local=n.M[-1]@Matrix.Translation(c)@upper.orient(d)@Matrix.Diagonal((R,R,R,1))
        gltf=basis@local@basis.inverted()
        # Invoke the author before removing only its newly generated blossom.
        # Skipping the call would change RNG and move later flowers/vines.
        result=original(n,c,d,R,col,rng,petals,rings,mat,core)
        added=[f for f in n.bm.faces if f not in before]
        triangles=sum(len(f.verts)-2 for f in added)
        state['anchors'].append({'group':n.name,'matrix':[gltf[row][column] for column in range(4) for row in range(4)],
                                'colour':list(col),'core':list(core),'originalTriangles':triangles})
        state['removedTriangles']+=triangles
        bmesh.ops.delete(n.bm,geom=added,context='FACES')
        return result
    upper.chrysanthemum=replacement
    return state
