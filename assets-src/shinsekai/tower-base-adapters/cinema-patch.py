"""Private109 cinema proposal. Transform the reviewed source AST in memory.

No source overwrite/export; the review driver supplies a separate output path.
Period type references and all assumed dimensions are in cinema-patch.md.
"""
import ast
import hashlib

SOURCE_SHA256='be0671adbc225763dd0eb14af945864d1e6b2b43e36ec3744c5bf89c59fede8e'
BODY_SCALE=1.15
PORT_SHIFT=.1345

def proposed_tree(source_bytes):
    if hashlib.sha256(source_bytes).hexdigest()!=SOURCE_SHA256:
        raise ValueError('Source changed: review the new cinema function before applying this proposal.')
    tree=ast.parse(source_bytes.decode('utf-8'))
    tree.body=[node for node in tree.body if not(isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=='main')]
    projector=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='projector')
    split=next(i for i,n in enumerate(projector.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Tuple) and [getattr(e,'id','') for e in t.elts]==['hx0','hx1'] for t in n.targets))
    # Keep the floor/table fixed; grow the apparatus around its table height.
    # Translate only the apparatus in X to preserve the lens endpoint.
    body=projector.body[split:]
    body.extend(ast.parse('''
with c.grp("var_magazine_housings"):
    for label, ax, az, radius in (("upper", -.40, zt+.92, .235), ("lower", -.40, zt-.05, .175)):
        # Sheet-metal boxes with actual feed slots; open inspection
        # covers show the original reels. Detail and opening angle are inferred.
        y0,y1=.13,.28
        box(c,"iron",(ax-radius,y0,az-radius),(ax-radius+.004,y1,az+radius),r=.0008)
        if label=="lower":
            # The preserved film path enters the receiving case at its right
            # side, below centre. An uninterrupted side wall would cut it.
            for za,zb in ((az-radius,az-.065),(az+.035,az+radius)):
                box(c,"iron",(ax+radius-.004,y0,za),(ax+radius,y1,zb),r=.0008)
        else:
            box(c,"iron",(ax+radius-.004,y0,az-radius),(ax+radius,y1,az+radius),r=.0008)
        box(c,"iron",(ax-radius,y0,az+radius-.004),(ax+radius,y1,az+radius),r=.0008)
        box(c,"iron",(ax-radius,y0,az-radius),(ax+radius,y0+.004,az+radius),r=.0008)
        for xa,xb in (((ax-radius,ax-.05),(ax+.05,ax+radius)) if label=="upper" else ((ax-radius,ax+radius),)):
            box(c,"iron",(xa,y0,az-radius),(xb,y1,az-radius+.004),r=.0008)
        hinge=(ax-radius,y1,az)
        group="anim_magazine_lid_"+label+"_"+tag
        with c.grp(group):
            c.pivots[group]=c.P(hinge)
            with c.at(hinge,rz=105):
                box(c,"iron",(0,0,-radius),(2*radius,.004,radius),r=.0008)
                box(c,"brass_worn",(2*radius-.025,.004,-.014),(2*radius-.012,.009,.014),r=.001)
        with c.at(hinge):
            for zz in (-radius*.6,radius*.6):
                with c.at((0,0,zz)):
                    cyl(c,"brass",.004,.024,8,z0=-.012,ch=.0005)
''').body)
    wrapper=ast.parse('with c.at(m=Matrix.Translation((-.06765,0,zt)) @ Matrix.Diagonal((1.15,1.15,1.15,1)) @ Matrix.Translation((0,0,-zt))):\n    pass').body[0]
    wrapper.body=body
    projector.body=projector.body[:split]+[wrapper]
    projector.body.extend(ast.parse('''
with c.grp("var_projector_worklamp"):
    # A: inferred table-mounted shaded inspection lamp, not an Osaka record.
    tube(c,"iron",(-.82,-.25,zt),(-.82,-.25,zt+1.25),.006,8)
    tube(c,"iron",(-.82,-.25,zt+1.25),(.05,-.25,zt+1.25),.006,8)
    with c.at((.05,-.25,zt+1.12)):
        lathe(c,"paint_dark",[(.10,0),(.075,.035),(.03,.11),(.008,.13)],20,False)
        with c.at((0,0,.012)):
            sphere(c,"bulb",.023,12,8)
    c.light("point","projector_worklamp_"+tag,(.05,-.25,zt+1.12),color=(255,226,188),watt=35,size=.025)
''').body)
    # Extend the rear tabletop/rear legs so the larger lamphouse is supported.
    class TableSupport(ast.NodeTransformer):
        def visit_UnaryOp(self,node):
            if isinstance(node.op,ast.USub) and isinstance(node.operand,ast.Constant):
                if node.operand.value==.75:node.operand.value=.90
                elif node.operand.value==.72:node.operand.value=.82
            return node
    for node in projector.body[:split]:TableSupport().visit(node)
    cinema=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_cinema')
    class PatchCinema(ast.NodeTransformer):
        removed=0
        ports=0
        def visit_With(self,node):
            # Remove only the little fixture containing the green panel.
            for statement in node.body:
                call=statement.value if isinstance(statement,ast.Expr) else None
                if isinstance(call,ast.Call) and isinstance(call.func,ast.Name) and call.func.id=='box' and len(call.args)>1 and isinstance(call.args[1],ast.Constant) and call.args[1].value=='exit_lamp':
                    self.removed+=1
                    return None
            return self.generic_visit(node)
        def visit_Constant(self,node):
            if type(node.value) is float and node.value in (4.85,5.05,4.95,5.12,5.2):
                self.ports+=1
                return ast.copy_location(ast.Constant(node.value+PORT_SHIFT),node)
            return node
    patch=PatchCinema();patch.visit(cinema)
    if patch.removed!=1 or patch.ports!=9:
        raise ValueError(f'Unexpected cinema fixture/port layout: {patch.removed}/{patch.ports}')
    # The full-height foyer partition overlaps the booth wall. Its original
    # door holes alone leave every projection port backed by opaque plaster.
    partitions=0
    for node in ast.walk(cinema):
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='wallYZ' and len(node.args)==8 and isinstance(node.args[1],ast.Constant) and node.args[1].value=='plaster' and isinstance(node.args[7],ast.Name) and node.args[7].id=='BX1':
            holes=next((k.value for k in node.keywords if k.arg=='holes'),None)
            if not isinstance(holes,ast.List) or len(holes.elts)!=2:raise ValueError('Unexpected foyer partition holes.')
            holes.elts.extend(ast.parse('[rect_pts(cx-.38,4.9845,cx-.14,5.1845),rect_pts(cx+.14,4.9845,cx+.38,5.1845),rect_pts(cx+1.4,5.0845,cx+1.7,5.3345)]',mode='eval').body.elts)
            partitions+=1
    if partitions!=1:raise ValueError('Expected one overlapping foyer partition.')
    ast.fix_missing_locations(tree)
    return tree,{'sourceSHA256':SOURCE_SHA256,'sourceRevision':'aa030cd','bodyScale':BODY_SCALE,'portShift':PORT_SHIFT,'greenFixturesRemoved':patch.removed,'portConstantsShifted':patch.ports,'overlappingPartitionsOpened':partitions,'magazineCovers':'static105deg outward open; no runtime articulation claim','feedSlots':'upper bottom / lower right-side; original film ribbon retained','worklamp':'A: inferred35W shaded table lamp; two-sided camera review still required'}
