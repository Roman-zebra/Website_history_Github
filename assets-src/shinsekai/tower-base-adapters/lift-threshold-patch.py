"""118 transferred repair: omit the low front cage rail across the doorway.

Frozen source executes in memory; every random draw and all gate pivots remain.
The existing underfloor frame, plank floor, brass sill and side/back rails stay.
This is an inferred local candidate, not historical or boarding certification.
"""
import ast
import hashlib

SOURCE_SHA256='be0671adbc225763dd0eb14af945864d1e6b2b43e36ec3744c5bf89c59fede8e'

def proposed_tree(source_bytes):
    if hashlib.sha256(source_bytes).hexdigest()!=SOURCE_SHA256:
        raise ValueError('Source changed: review the new cage before applying this proposal.')
    tree=ast.parse(source_bytes.decode('utf-8'))
    cage=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='cage_car')
    calls=0
    class FrontRail(ast.NodeTransformer):
        def visit_Expr(self,node):
            nonlocal calls
            if ast.unparse(node)=="box(c, 'steel', (-hw, sy * hw - (0.02 if sy > 0 else 0), z0), (hw, sy * hw + (0.0 if sy > 0 else 0.02), z1), r=0.002)":
                calls+=1
                wrapper=ast.parse('with _lift_omit_front_rail(c, z0 == 0.0 and sy == -1):\n    pass').body[0]
                wrapper.body=[node]
                return wrapper
            return node
    FrontRail().visit(cage)
    if calls!=1:raise ValueError('Expected one paired front/back horizontal cage rail call')
    helper=ast.parse('''
@contextmanager
def _lift_omit_front_rail(c, omit):
    start_faces=len(c.F)
    try:
        yield
    finally:
        if omit:
            del c.F[start_faces:]
''').body[0]
    tree.body.insert(tree.body.index(cage),helper)
    tree.body=[n for n in tree.body if not(isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='main')]
    return ast.fix_missing_locations(tree),dict(sourceRevision='aa030cd',sourceSHA256=SOURCE_SHA256,
        changes=['omit the front0..0.14m horizontal cage rail across the existing doorway'],
        retained=['underfloor steel frame','plank floor','brass sill','side/back lower rails','all upper rails','all gate linkages/pivots/clips'],
        historicalStatus='inferred repair to the study; not a measured1912 cage',visualAcceptance=False)
