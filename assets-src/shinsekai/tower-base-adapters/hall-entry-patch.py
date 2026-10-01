"""118 transferred repair: clear the existing115 west wing doorway.

Transforms the frozen source in memory. It never changes the author checkout.
The exterior retains its doorway, leaves, reveal, threshold and arch ownership.
"""
import ast
import hashlib

SOURCE_SHA256='be0671adbc225763dd0eb14af945864d1e6b2b43e36ec3744c5bf89c59fede8e'
ENTRY_Y=(7.4,9.8)  # world y -1.2..1.2; cell world offset y=-8.6

def proposed_tree(source_bytes):
    if hashlib.sha256(source_bytes).hexdigest()!=SOURCE_SHA256:
        raise ValueError('Review new source before repairing the hall entrance.')
    source=source_bytes.decode('utf-8')
    tree=ast.parse(source)
    hall=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_hall')
    fragment=ast.get_source_segment(source,hall).replace('\r\n','\n')
    def replace(old,new):
        nonlocal fragment
        if fragment.count(old)!=1:
            raise ValueError('Expected one frozen hall statement: '+old)
        fragment=fragment.replace(old,new)
    replace('wallYZ(c, "plaster", -0.45, L + 0.45, -0.3, H + 0.3, -tw, 0.0)',
            'wallYZ(c, "plaster", -0.45, L + 0.45, -0.3, H + 0.3, -tw, 0.0, holes=[rect_pts(7.4, -0.15, 9.8, 3.25)])')
    replace('''box(c, "sandstone", (0.0, 0.0, 0.0), (0.09, L, 1.15), r=0.006)
        box(c, "sandstone", (0.0, 0.0, 1.15), (0.12, L, 1.21), r=0.006)''',
            '''for ya, yb in ((0.0,7.4),(9.8,L)):
            box(c, "sandstone", (0.0, ya, 0.0), (0.09, yb, 1.15), r=0.006)
            box(c, "sandstone", (0.0, ya, 1.15), (0.12, yb, 1.21), r=0.006)''')
    replace('''x_in = px + sgn * 0.14''',
            '''if px == 0.0 and 7.2 < yp < 10.0:
                    continue
                x_in = px + sgn * 0.14''')
    replace('field(c, M_YZ(0.0), 1, ya, yb, 1.34, H - 0.60, fw=0.05)',
            '''with _hall_omit(c, ya < 9.8 and yb > 7.4):
                field(c, M_YZ(0.0), 1, ya, yb, 1.34, H - 0.60, fw=0.05)''')
    replace('with c.at((0.03, yc_, 0), rz=90):',
            'with _hall_omit(c, 7.0 < yc_ < 10.2 and k != NB // 2), c.at((0.03, 5.35 if k == NB // 2 else yc_, 0), rz=-90 if k == NB // 2 else 90):')
    replace('panel(c, "dirt", 0.0, L, 0.0, 1.1, w=0.0025)',
            '''for ya, yb in ((0.0,7.4),(9.8,L)):
                panel(c, "dirt", ya, yb, 0.0, 1.1, w=0.0025)''')
    revised=ast.parse(fragment).body[0]
    loops=0
    class Benches(ast.NodeTransformer):
        def visit_For(self,node):
            nonlocal loops
            self.generic_visit(node)
            if isinstance(node.iter,ast.Call) and isinstance(node.iter.func,ast.Name) and node.iter.func.id=='range' and len(node.iter.args)==1 and isinstance(node.iter.args[0],ast.Name) and node.iter.args[0].id=='nbn':
                loops+=1
                # Build and discard whole affected benches/papers, preserving
                # every random draw used by later geometry and dream flowers.
                context=ast.parse('with _hall_omit(c, 6.4 < y < 10.8):\n    pass').body[0]
                context.body=node.body[1:]
                node.body=[node.body[0],context]
            return node
    Benches().visit(revised)
    if loops!=1:raise ValueError('Expected one hall bench row')
    helper=ast.parse('''
@contextmanager
def _hall_omit(c, omit):
    start_faces,start_lights=len(c.F),len(c.lights)
    try:
        yield
    finally:
        if omit:
            del c.F[start_faces:]
            del c.lights[start_lights:]
''').body[0]
    index=tree.body.index(hall)
    tree.body[index:index+1]=[helper,revised]
    tree.body=[n for n in tree.body if not(isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='main')]
    return ast.fix_missing_locations(tree),dict(sourceRevision='aa030cd',sourceSHA256=SOURCE_SHA256,
        entryCellY=list(ENTRY_Y),entryWorldY=[-1.2,1.2],entryWorldFloor=.15,
        changes=['segmented west dado','removed two entrance benches and their papers','omitted entrance pilasters/field','relocated existing pendulum clock to cell y5.35 facing into the hall with its pivot','render-only shell opening'],
        exteriorGeometryChanged=False,floorGeometryChanged=False,visualAcceptance=False)
