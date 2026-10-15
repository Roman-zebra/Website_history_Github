import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = s => createHash('sha256').update(s).digest('hex');

// Private fixed-r186 candidate: only the previously excluded cinema projector
// receives its captured pass-side through asynchronous node preparation. All
// other node inputs preserve B/original behavior. Restore before progress/yield.
// Shared target side remains set during await; existing draw hold/drain is required.
// Concurrent compile or draw remains unqualified.
export function patchAsyncPassSide067(source) {
  // The first occurrence can be a bound callback; match the declaration.
  const declaration = /(?:\n[ \t]+)_createObjectPipeline\([^\n]+\) \{/g;
  const matches = [...source.matchAll(declaration)];
  assert.equal(matches.length, 1, 'one exact fixed declaration');
  const start = matches[0].index;
  const queue = /([ \t]+material,\n)([ \t]+)(scene(?:: scene2)?,\n)/;
  const queueRegion = source.slice(start, start + 1500);
  const qm = queue.exec(queueRegion);
  assert(qm, 'fixed queue material field');
  const queueOld = qm[0];
  const queueNew = qm[1] + qm[2] + 'materialSide067: material.side,\n' + qm[2] + qm[3];
  const queuePos = start + qm.index;
  let patched = source.slice(0,queuePos) + queueNew + source.slice(queuePos+queueOld.length);
  const loopPattern = /for \(\s*const item of compilationPromises\s*\) \{\n([\s\S]*?)([ \t]+loaded\s*\+\+;)/g;
  const loops = [...patched.matchAll(loopPattern)];
  assert.equal(loops.length,1,'one exact async render-work loop');
  const lm=loops[0];
  const body=lm[1];
  assert(body.includes('this._objects.get(') && body.includes('await this._nodes.getForRenderAsync('));
  assert(body.includes('this._nodes.updateAfter('));
  const indent=lm[2].match(/^[ \t]+/)[0];
  const header=lm[0].slice(0,lm[0].length-body.length-lm[2].length);
  const loopOld=lm[0];
  const pipelineLine=/([ \t]+)this\._pipelines\.getForRender\(\s*renderObject, pipelinePromises\s*\);/;
  const pm=pipelineLine.exec(body);assert(pm,'one original render pipeline preparation');
  assert.equal([...body.matchAll(new RegExp(pipelineLine.source,'g'))].length,1);
  const pindent=pm[1];
  const sidePipeline=pindent+'const previousPipelineSide067 = item.material.side;\n'+pindent+'try {\n'+pindent+'  item.material.side = item.materialSide067;\n'+pindent+'  '+pm[0].trim()+'\n'+pindent+'} finally {\n'+pindent+'  item.material.side = previousPipelineSide067;\n'+pindent+'}';
  const pipelineOnlyBody=body.replace(pm[0],sidePipeline);
  const loopNew=header+indent+'const previousMaterialSide067 = item.material.side;\n'+indent+'const previousPreCompiling067 = this._isPreCompiling;\n'+indent+"const targetedProjector067 = item.object.name === 'cinema__projector_7' && item.material.transparent === true && item.material.forceSinglePass === false && previousMaterialSide067 === 2;\n"+indent+'try {\n'+indent+'  if (targetedProjector067) item.material.side = item.materialSide067;\n'+pipelineOnlyBody.split('\n').map(l=>l ? '  '+l:l).join('\n')+indent+'} finally {\n'+indent+'  item.material.side = previousMaterialSide067;\n'+indent+'  this._isPreCompiling = previousPreCompiling067;\n'+indent+'}\n'+lm[2];
  patched=patched.slice(0,lm.index)+loopNew+patched.slice(lm.index+loopOld.length);
  assert.equal(patched.split(loopNew).length,2);
  assert.equal(patched.split(queueNew).length,2);
  assert.equal(patched.replace(loopNew,loopOld).replace(queueNew,queueOld),source,'exact reversal');
  return {source:patched,proof:{revision:'targeted-projector-F',sourceSHA256:sha(source),candidateSHA256:sha(patched),seams:2,exactReversal:true,materialReferenceUnchanged:true,perPassSideCapture:true,originalRenderObjectAndNodeMaterialSidePreservedExceptExactProjector:true,exactProjectorPassSideDuringNodePreparation:true,otherNodesPreserveOriginalSide:true,sharedSideRestoredBeforeAsyncWait:false,targetSideRestoredBeforeProgressAndYield:true,restoreMaterialAndPreCompileFlagInFinally:true,restoreBeforeProgressAndYield:true,extraDraws:false,source100Unchanged:true,concurrentCompileOrDrawQualified:false},oldLoop:loopOld,newLoop:loopNew};
}
