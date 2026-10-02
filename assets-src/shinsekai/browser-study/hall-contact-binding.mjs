// A floor bake belongs to one immutable four-part normal-room source.
export function assertHallEntryContactBinding(receipt,parts){
 const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(receipt?.sourceDirectory!=='research-cache/hall-entry-stream-121-001'||receipt.sourceUnchanged!==true||receipt.snapshotEqual!==true||receipt.savedSceneReopened!==true||receipt.sourceBrowserGeometryChanged!==false||receipt.mapColourSpace!=='Non-Color'||JSON.stringify(receipt.mapSize)!=='[512,2048]'||!hex(receipt.pngSha256))throw new Error('Invalid entrance contact bake receipt');
 if(!Array.isArray(parts)||parts.length!==4)throw new Error('Incomplete entrance contact source');
 const expected=['core','desk','lamps','furnishings'].map(p=>'cell_hall-'+p+'.glb');
 if(new Set(parts.map(p=>p.file)).size!==4||parts.some(p=>!expected.includes(p.file)))throw new Error('Unexpected entrance contact parts');
 for(const p of parts){const decoded=p.file.replace('.glb','-decoded.glb');if(!hex(p.decodedSha256)||receipt.sourceHashes?.[decoded]!==p.decodedSha256)throw new Error('Stale entrance contact source: '+p.file);}
 if(Object.keys(receipt.sourceHashes).length!==4)throw new Error('Unexpected entrance bake sources');
 return {pngSha256:receipt.pngSha256,sourceDirectory:receipt.sourceDirectory,sourcePartCount:4};
}
