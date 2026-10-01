const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
/* Approved SNS bird artwork; pre-rendered sizes keep cloud builds dependency-free. */
const root=path.resolve(__dirname,'..'),source=path.join(root,'assets-src','brand','jta-bird');
fs.mkdirSync(path.join(root,'icons'),{recursive:true});
for(const size of [32,96,180,192,512]){
 const png=fs.readFileSync(path.join(source,size+'.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 fs.writeFileSync(path.join(root,'icons','atlas-'+size+'.png'),png);
}
// Embed the raster so the SVG favicon never needs an external image request.
const mark=fs.readFileSync(path.join(source,'96.png')).toString('base64');
fs.writeFileSync(path.join(root,'icons','atlas.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${mark}"/></svg>`);
console.log('Built approved JTA bird icons (32–512px).');
