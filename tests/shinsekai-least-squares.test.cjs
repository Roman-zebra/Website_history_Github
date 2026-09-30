'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {minimise,multiStart,spectrum}=require('../scripts/shinsekai-least-squares.cjs');
const spec=(name,lower=-10,upper=10,scale=1)=>({name,lower,upper,scale});
test('scaled deterministic nonlinear multi-start recovers known parameters',()=>{
  const specs=[spec('a',0.1,4),spec('b',-5000,5000,1000)];
  const result=multiStart(([a,b])=>[a*a-4,(b-1700)/100,a+(b/1000)-3.7],specs,[[0.5,0],[3,3000]]);
  assert.ok(result.best.cost<1e-12);assert.ok(Math.abs(result.best.values[0]-2)<1e-6);assert.ok(Math.abs(result.best.values[1]-1700)<1e-4);
  assert.deepEqual(result.best.values,multiStart(([a,b])=>[a*a-4,(b-1700)/100,a+(b/1000)-3.7],specs,[[0.5,0],[3,3000]]).best.values);
});
test('bounds are enforced and reported rather than mistaken for an interior measurement',()=>{
  const result=minimise(([x])=>[x-7],[spec('x',0,2)],[1]);
  assert.ok(Math.abs(result.values[0]-2)<1e-9);assert.deepEqual(result.boundHits,['x']);assert.ok(result.converged);
  const coupled=minimise(([x,y])=>[x+y-7,2*y-6],[spec('x',0,2),spec('y',0,10)],[1,1]);
  assert.ok(Math.abs(coupled.values[0]-2)<1e-8);assert.ok(Math.abs(coupled.values[1]-3.4)<1e-5);
});
test('Huber working loss resists one large outlier',()=>{
  const result=minimise(([x])=>[x-1,x-1,x-1,x-100],[spec('x',-200,200)],[0],{delta:2});
  assert.ok(Math.abs(result.values[0]-(1+2/3))<1e-5);
});
test('Jacobi singular values identify null and weak parameter directions',()=>{
  const result=spectrum([[1,1,0],[2,2,0],[0,0,1e-9]]);
  assert.equal(result.rank,1);assert.ok(result.converged);assert.ok(Math.abs(result.singularValues[0]-Math.sqrt(10))<1e-9);
  const full=spectrum([[3,0],[0,4]]);assert.deepEqual(full.singularValues,[4,3]);assert.equal(full.rank,2);
});
test('infeasible trial points can be rejected but residual-shape errors fail explicitly',()=>{
  const result=minimise(([x])=>x<=0?null:[Math.log(x)-Math.log(2)],[spec('x',-1,5)],[0.1]);
  assert.ok(Math.abs(result.values[0]-2)<1e-5);
  assert.throws(()=>minimise(()=>[0],[spec('x',0,1)],[2]),/outside bounds/);
  assert.throws(()=>minimise(([x])=>x===0?[0]:[0,1],[spec('x')],[0]),/dimension changed/);
});
