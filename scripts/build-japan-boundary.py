"""Build the compact Japan land and map mask from amay077/JapanPrefGeoJson.

Usage: python scripts/build-japan-boundary.py /path/to/japan.geojson
The input derives from Data of Japan prefecture boundaries (public domain).
"""
import json
import sys
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.ops import unary_union

root = Path(__file__).resolve().parent.parent
source = json.loads(Path(sys.argv[1]).read_text())
parts = []
for feature in source['features']:
    geometry = shape(feature['geometry'])
    for polygon in getattr(geometry, 'geoms', [geometry]):
        # The source includes Russian-administered Kuril islands. They are
        # excluded from this visitor map, including its search index.
        if polygon.centroid.x > 145.6 and polygon.centroid.y > 43.35:
            continue
        # The same prefecture dataset includes Liancourt Rocks (Dokdo),
        # administered by South Korea. Keep them off this visitor map.
        if 131.7 < polygon.centroid.x < 132.1 and 37.1 < polygon.centroid.y < 37.4:
            continue
        parts.append(polygon)

# Small Japanese islands and offshore facilities missing from the source's
# simplified prefecture outlines. These local patches remain far from borders.
for lat, lon in [(40.56, 141.535), (35.464, 139.874), (33.064, 130.226),
                 (26.15, 127.85), (34.575, 138.94)]:
    parts.append(Point(lon, lat).buffer(0.005))

land = unary_union(parts).buffer(0.02).simplify(0.002, preserve_topology=True)
visible = unary_union(parts).buffer(0.09).simplify(0.008, preserve_topology=True)

def rings(geometry):
    polygons = getattr(geometry, 'geoms', [geometry])
    result = []
    for polygon in polygons:
        coords = [[round(lat, 5), round(lon, 5)] for lon, lat in polygon.exterior.coords]
        result.append([[round(v, 5) for v in polygon.bounds], coords])
    return result

data = json.dumps({'land': rings(land), 'visible': rings(visible)}, separators=(',', ':'))
template = '''/* Japan prefecture outlines: Data of Japan / amay077 JapanPrefGeoJson, public domain.
   Land includes a small coastal tolerance; the visual outline also retains nearby sea. */
(function(root){
  const polygons = DATA;
  function contains(lat, lon){
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
    for(const [[west,south,east,north],ring] of polygons.land){
      if(lon<west||lon>east||lat<south||lat>north)continue;
      let inside=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const a=ring[i],b=ring[j];
        if((a[0]>lat)!==(b[0]>lat) && lon<(b[1]-a[1])*(lat-a[0])/(b[0]-a[0])+a[1])inside=!inside;
      }
      if(inside)return true;
    }
    return false;
  }
  const api={contains,visible:polygons.visible};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JapanBoundary=api;
})(typeof self==='object'?self:globalThis);
'''
(root / 'japan-boundary.js').write_text(template.replace('DATA', data))
print(f'Wrote japan-boundary.js ({len(data)//1024} KiB, {len(rings(land))} land and {len(rings(visible))} visible polygons)')
