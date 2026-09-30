/* Deterministic research optimiser. Parameters/scales/bounds are explicit scenario choices. */
'use strict';
const {huber} = require('./shinsekai-camera.cjs');
const norm = values => Math.hypot(...values);
const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
function validate(specs) {
  if (!specs.length || new Set(specs.map(x => x.name)).size !== specs.length) throw new Error('Missing or duplicate parameters');
  for (const s of specs) if (!s.name || ![s.lower,s.upper,s.scale].every(Number.isFinite) || s.upper <= s.lower || s.scale <= 0) throw new Error('Invalid parameter bounds/scales');
}
function evaluator(fn, size) {
  let count = size;
  return x => {
    const r = fn(x);
    if (r === null) return null; // explicit infeasible geometry/camera; programming errors propagate
    if (!Array.isArray(r) || !r.length || !r.every(Number.isFinite)) throw new Error('Residuals must be a finite nonempty array or null');
    if (count === undefined) count = r.length;
    if (r.length !== count) throw new Error('Residual dimension changed');
    return r;
  };
}
function jacobian(evaluate, q, bounds, step = 1e-5) {
  const base = evaluate(q);
  if (!base) throw new Error('Jacobian requested at infeasible point');
  const J = base.map(() => Array(q.length).fill(0));
  for (let k = 0; k < q.length; k++) {
    const hi = q.slice(), lo = q.slice();
    hi[k] = Math.min(bounds[k][1],q[k]+step); lo[k] = Math.max(bounds[k][0],q[k]-step);
    const a = hi[k] > q[k] ? evaluate(hi) : null, b = lo[k] < q[k] ? evaluate(lo) : null;
    if (!a && !b) throw new Error(`No feasible derivative for parameter ${k}`);
    for (let i = 0; i < base.length; i++) J[i][k] = a && b ? (a[i]-b[i])/(hi[k]-lo[k]) : a ? (a[i]-base[i])/(hi[k]-q[k]) : (base[i]-b[i])/(q[k]-lo[k]);
  }
  return J;
}
function solve(matrix, rhs) {
  const n = rhs.length, A = matrix.map((row,i) => [...row,rhs[i]]);
  for (let k=0; k<n; k++) {
    let pivot=k; for(let j=k+1;j<n;j++) if(Math.abs(A[j][k])>Math.abs(A[pivot][k])) pivot=j;
    if(Math.abs(A[pivot][k])<1e-18) throw new Error('Singular linear system');
    [A[k],A[pivot]]=[A[pivot],A[k]];
    for(let j=k+1;j<n;j++) {const f=A[j][k]/A[k][k]; for(let i=k;i<=n;i++) A[j][i]-=f*A[k][i];}
  }
  const x=Array(n).fill(0);
  for(let k=n-1;k>=0;k--) {let value=A[k][n];for(let j=k+1;j<n;j++) value-=A[k][j]*x[j];x[k]=value/A[k][k];}
  return x;
}
function spectrum(matrix, relativeThreshold = 1e-7) {
  // One-sided Jacobi SVD: avoid squaring the condition number through eigenvalues of J'J.
  const n=matrix[0]?.length;
  if(!n || !matrix.every(row=>row.length===n && row.every(Number.isFinite))) throw new Error('Invalid Jacobian matrix');
  if(!(relativeThreshold>0 && relativeThreshold<1)) throw new Error('Invalid rank threshold');
  const columns=Array.from({length:n},(_,j)=>matrix.map(row=>row[j]));
  const V=Array.from({length:n},(_,j)=>Array.from({length:n},(_,i)=>i===j?1:0));
  let converged=false, sweeps=0;
  for(;sweeps<120;sweeps++) {
    let changed=false;
    for(let p=0;p<n;p++) for(let q=p+1;q<n;q++) {
      const a=dot(columns[p],columns[p]), b=dot(columns[q],columns[q]), g=dot(columns[p],columns[q]);
      if(a===0 || b===0 || Math.abs(g)<=1e-12*Math.sqrt(a)*Math.sqrt(b)) continue;
      const tau=(b-a)/(2*g), t=(tau>=0?1:-1)/(Math.abs(tau)+Math.hypot(1,tau)), c=1/Math.hypot(1,t), s=c*t;
      for(const arrays of [columns,V]) {
        const old=arrays[p].slice();
        arrays[p]=old.map((x,i)=>c*x-s*arrays[q][i]);
        arrays[q]=old.map((x,i)=>s*x+c*arrays[q][i]);
      }
      changed=true;
    }
    if(!changed){converged=true;break;}
  }
  const modes=columns.map((column,i)=>({singularValue:norm(column), direction:V[i]})).sort((a,b)=>b.singularValue-a.singularValue);
  const threshold=modes[0].singularValue*relativeThreshold, rank=modes.filter(x=>x.singularValue>threshold).length;
  return {converged,sweeps,rank,parameterCount:n,relativeThreshold,singularValues:modes.map(x=>x.singularValue),weakModes:modes.slice(Math.max(0,n-3))};
}
function minimise(fn, specs, initial, options={}) {
  validate(specs);
  if(initial.length!==specs.length || !initial.every((x,i)=>Number.isFinite(x)&&x>=specs[i].lower&&x<=specs[i].upper)) throw new Error('Initial point outside bounds');
  const {maxIterations=160,delta=2,gradientTolerance=1e-6,stepTolerance=1e-8}=options;
  if(!Number.isInteger(maxIterations)||maxIterations<=0) throw new Error('Invalid iteration limit');
  const bounds=specs.map(s=>[s.lower/s.scale,s.upper/s.scale]);
  const physical=q=>q.map((x,i)=>x*specs[i].scale), evalPhysical=evaluator(fn);
  const evaluate=q=>evalPhysical(physical(q));
  let q=initial.map((x,i)=>x/specs[i].scale), r=evaluate(q);
  if(!r) throw new Error('Initial residual is infeasible');
  const objective=r=>r.reduce((sum,x)=>sum+huber(x,delta),0);
  let cost=objective(r), damping=1e-3, iterations=0, reason='iteration-limit', converged=false;
  for(;iterations<maxIterations;iterations++) {
    const J=jacobian(evaluate,q,bounds), weights=r.map(x=>Math.abs(x)<=delta?1:delta/Math.abs(x));
    const n=q.length, A=Array.from({length:n},()=>Array(n).fill(0)), g=Array(n).fill(0);
    for(let i=0;i<r.length;i++) for(let a=0;a<n;a++) {
      g[a]+=J[i][a]*weights[i]*r[i];
      for(let b=0;b<n;b++) A[a][b]+=J[i][a]*weights[i]*J[i][b];
    }
    const projected=g.map((x,i)=>(q[i]<=bounds[i][0]+1e-10&&x>0)||(q[i]>=bounds[i][1]-1e-10&&x<0)?0:x);
    if(norm(projected)<gradientTolerance){converged=true;reason='projected-gradient';break;}
    const active=g.map((x,i)=>(q[i]<=bounds[i][0]+1e-10&&x>0)||(q[i]>=bounds[i][1]-1e-10&&x<0));
    const damped=A.map((row,i)=>row.map((x,j)=>active[i]||active[j]?(i===j?1:0):x+(i===j?damping*Math.max(1,A[i][i]):0)));
    const step=solve(damped,g.map((x,i)=>active[i]?0:-x)), trial=q.map((x,i)=>Math.max(bounds[i][0],Math.min(bounds[i][1],x+step[i])));
    const candidate=evaluate(trial), nextCost=candidate?objective(candidate):Infinity;
    if(nextCost<cost) {
      const movement=norm(trial.map((x,i)=>x-q[i])), improvement=cost-nextCost;
      q=trial;r=candidate;cost=nextCost;damping=Math.max(1e-12,damping/3);
      if(movement<stepTolerance && improvement<1e-10*(1+cost)){converged=true;reason='small-accepted-step';break;}
    } else {damping*=10;if(damping>1e16){reason='damping-limit';break;}}
  }
  const J=jacobian(evaluate,q,bounds), rank=spectrum(J);
  rank.weakModes=rank.weakModes.map(mode=>({...mode,direction:Object.fromEntries(specs.map((s,i)=>[s.name,mode.direction[i]]))}));
  const values=physical(q), hits=specs.filter((s,i)=>Math.min(values[i]-s.lower,s.upper-values[i])<1e-5*s.scale).map(s=>s.name);
  return {values,cost,converged,reason,iterations,residuals:r,boundHits:hits,diagnostics:rank};
}
function multiStart(fn,specs,initials,options) {
  if(!initials.length) throw new Error('No initialisations');
  const runs=initials.map(initial=>minimise(fn,specs,initial,options));
  const bestIndex=runs.reduce((best,run,i)=>run.cost<runs[best].cost?i:best,0);
  return {best:runs[bestIndex],bestIndex,runs};
}
module.exports={jacobian,spectrum,minimise,multiStart};
