// Local-only contour/perimeter comparisons retain cabinet001 and cushion003.
export function resolveCushionContourStudy({revision=null,cushion=false,cabinet=false,perimeter=null}={}){
 if(perimeter!==null&&!['022','040'].includes(perimeter))throw new Error('Invalid cushion perimeter revision');
 if(perimeter!==null&&revision!=='035')throw new Error('Perimeter study requires retained contour004g035');
 if(revision===null)return null;
 if(!['035','065'].includes(revision))throw new Error('Invalid cushion contour revision');
 if(!cushion||!cabinet)throw new Error('Contour study requires retained cushion003 and cabinet001');
 if(perimeter!==null)return {revision,perimeter,round:'upper-cushion-119-005',path:`/study/upper-cushion-119-005/interior-cushion-gap${perimeter}.glb`};
 return {revision,round:'upper-cushion-119-004',path:`/study/upper-cushion-119-004/interior-cushion-g${revision}.glb`};
}
