// Local-only numbered contour comparisons retain cabinet001 and cushion003.
export function resolveCushionContourStudy({revision=null,cushion=false,cabinet=false}={}){
 if(revision===null)return null;
 if(!['035','065'].includes(revision))throw new Error('Invalid cushion contour revision');
 if(!cushion||!cabinet)throw new Error('Contour study requires retained cushion003 and cabinet001');
 return {revision,round:'upper-cushion-119-004',path:`/study/upper-cushion-119-004/interior-cushion-g${revision}.glb`};
}
