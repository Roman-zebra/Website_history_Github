// Reject a contact bake for different garment geometry before loading assets.
export function resolveHaoriContactStudy({gain=null,support=false,foldRevision=null,bakeRevision=null}={}){
 if(gain===null){if(bakeRevision!==null)throw new Error('Contact bake revision requires a comparison gain');return null;}
 if(!support||![0,.6,1].includes(gain))throw new Error('Invalid haori wall contact comparison');
 const revision=bakeRevision??'006';
 if(!['006','009'].includes(revision))throw new Error('Invalid haori contact bake revision');
 if(revision==='009'&&foldRevision!=='008')throw new Error('Contact009 requires exact front fold008 geometry');
 if(revision==='006'&&foldRevision!==null&&gain!==0)throw new Error('Front fold geometry requires its matching contact bake');
 return {gain,bakeRevision:revision,geometryRevision:foldRevision??'003',path:`/study/haori-wall-contact-119-${revision}/wall-contact.png`};
}
