// A view's first submitted frame may compile shaders for seconds. Start the
// preparation clock AFTER that frame, settle temporal history, then warm the
// same view before enabling a separate cadence measurement. Slow steady frames
// remain measurable; this gate does not filter inconvenient measured samples.
export function createViewPreparation({minFrames=16,warmMs=1500}={}) {
  let revision=0,current=null,result=null;
  return {
    get active(){return current!==null;},
    get result(){return result;},
    begin(){
      result=null;
      current={revision:++revision,frames:0,firstCompleted:null,settledAt:null,lastCompleted:null,firstSubmitMs:null,maxSubmitMs:0,maxIntervalMs:0};
      return revision;
    },
    cancel(){revision++;current=null;result=null;},
    sample(token,completedAt,submitMs){
      if(!current||current.revision!==token)return false;
      const s=current;
      if(s.firstCompleted===null){s.firstCompleted=completedAt;s.firstSubmitMs=submitMs;}
      if(s.lastCompleted!==null)s.maxIntervalMs=Math.max(s.maxIntervalMs,completedAt-s.lastCompleted);
      s.lastCompleted=completedAt;s.frames++;s.maxSubmitMs=Math.max(s.maxSubmitMs,submitMs);
      if(s.frames>=minFrames&&s.settledAt===null)s.settledAt=completedAt;
      if(s.settledAt===null||completedAt-s.settledAt<warmMs)return false;
      result={revision:s.revision,frames:s.frames,settleElapsedMs:s.settledAt-s.firstCompleted,warmElapsedMs:completedAt-s.settledAt,firstSubmitMs:s.firstSubmitMs,maxSubmitMs:s.maxSubmitMs,maxIntervalMs:s.maxIntervalMs};
      current=null;return true;
    }
  };
}
