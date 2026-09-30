"""Original room dressing for shared Claude102, generic1912 assumptions.
Reuses the blind build's objects/materials. No competing kit is imported.
"""
import math,random

def decorate(box,beam,cylinder,mesh,ball,materials,root,set_zone):
    wood=materials['oiled dark timber'];brass=materials['aged brass']
    paper=materials['unprinted washi'];cloth=materials['blue green canvas']
    ceramic=materials['cream ceramic'];rng=random.Random(1021912)
    set_zone('interior')
    # Timber divisions dress plaster bays below2m² without inventing new openings.
    for x in [-2.72,2.72]:
        for y in [.8,2.2,3.6,5.0,6.4,7.8,8.6]:
            for z,h in [(1.48,2.8),(4.55,2.65)]:box('interior timber bay post',(x,y,z),(.055,.085,h),wood,.007)
        for z in [.96,2.02,4.15,5.26]:box('interior horizontal wall rail',(x,4.5,z),(.06,8.45,.055),wood,.004)
    for x in [-2.4,-1.2,0,1.2,2.4]:
        for z,h in [(1.48,2.8),(4.55,2.65)]:box('rear wall bay post',(x,8.72,z),(.075,.055,h),wood,.007)
    for z in [.96,2.02,4.15,5.26]:box('rear wall timber course',(0,8.72,z),(5.4,.055,.055),wood,.004)
    set_zone('ceiling')
    for z in [2.92,5.80]:
        for x in [-1.8,-.6,.6,1.8]:box('long ceiling rib',(x,4.5,z),(.065,8.3,.09),wood,.005)
        for y in [.8,2.3,3.8,5.3,6.8,8.3]:box('ceiling cross rib',(0,y,z),(5.4,.065,.09),wood,.005)
    set_zone('interior')
    # A practical-light row recedes along each room; small bulbs/shades, no modern fittings.
    for top in [2.90,5.78]:
        for y in [1.6,4.4,7.25]:
            beam('pendant cord',(-.6,y,top),(-.6,y,top-.30),.006,wood,6)
            cylinder('small brass pendant shade',(-.6,y,top-.31),.13,.025,brass,16)
            ball('visible warm pendant bulb',(-.6,y,top-.40),.055,paper)
    # Hero: an abacus by the unfinished ledger. Generic mechanism, no text/logo.
    cx,cy,z=-.92,2.63,.99
    for y in [cy-.14,cy+.14]:box('abacus end rail',(cx,y,z),(.47,.035,.03),wood,.004)
    for x in [cx-.235,cx+.235]:box('abacus side rail',(x,cy,z),(.03,.30,.03),wood,.004)
    for i in range(7):
        x=cx-.18+i*.06;beam('abacus rod',(x,cy-.125,z),(x,cy+.125,z),.006,brass,6)
        for j in range(5):ball('abacus bead',(x,cy-.10+j*.044,z+.014),.018,wood)
    # Asymmetric crockery clusters, not another regular grid.
    for x,y,z0,count in [(-2.3,3.9,1.46,6),(-2.3,5.0,.96,7),(-1.45,2.61,.94,5),(-1.25,2.1,3.60,5)]:
        for j in range(count):
            X=x+rng.uniform(-.20,.20);Y=y+rng.uniform(-.20,.20)
            cylinder('clustered ceramic bowl',(X,Y,z0+.035),rng.uniform(.035,.065),.07,ceramic,12)
    # Wall detail implies use without legible period advertisements.
    for y,z in [(1.8,1.75),(6.4,1.78),(2.6,4.82),(6.8,4.83)]:
        box('small wall print backing',(-2.68,y,z),(.04,.43,.53),wood,.008)
        box('unprinted paper panel',(-2.65,y,z),(.016,.36,.46),paper)
        for j in range(3):beam('abstract ink stroke',(-2.636,y-.13+j*.11,z-.11),(-2.636,y-.10+j*.10,z+.12),.008,wood,6)
    for y in [1.2,6.0,8.2]:
        cylinder('wall coat peg',(2.67,y,1.75),.027,.09,wood,8,(0,math.pi/2,0))
    # Ceiling hooks, a loose folded towel, scattered order slips and a tilted cup.
    for y in [2.4,6.4]:beam('ceiling hanger',(2.3,y,2.95),(2.3,y,2.81),.008,brass,6)
    for i in range(3):
        slip=box('unfilled order slip',(-1.6+i*.105,2.39+rng.uniform(-.06,.04),.987),(.12,.16,.006),paper)
        slip.rotation_euler.z=rng.uniform(-.5,.5)
    cup=cylinder('cup left askew',(-1.94,2.8,1.005),.05,.12,ceramic,16);cup.rotation_euler.y=.28
    box('folded towel on peg',(2.68,6.0,1.53),(.07,.24,.34),cloth,.006)
    # Thin curtain strips beside shoji leave the existing window/room view readable.
    for x in [-2.23,-.67,.67,2.23]:
        verts=[]
        for row in range(5):
            for col in range(4):
                X=x+(col/3-.5)*.22;Z=3.8+row/4*1.76
                verts.append((X,.66+.04*math.cos(col*math.pi),Z))
        faces=[]
        for row in range(4):
            for col in range(3):
                k=row*4+col;faces.append((k,k+1,k+5,k+4))
        mesh('soft unmarked window curtain',verts,faces,paper)
    root['roomBrief']='Unfinished order: ledger/abacus, crockery unpacked, tea left out; generic invented shop-house'
    root['detailSources']='A:all room fixtures/dimensions assumed; Claude102 shared dressing method, not a historic floor plan'
