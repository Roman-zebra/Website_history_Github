// Local accounting only. This program never contacts TRIPO or launches generation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const DAY=86400000;
export function tokyoDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
const ordinal=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid date');return Date.parse(date+'T00:00:00Z')/DAY;};
export function allowance(policy,ledger,date){
  const start=ordinal(policy.periodStart),end=ordinal(policy.periodEndExclusive),today=ordinal(date);
  if(end<=start)throw new Error('Invalid budget period');
  const latest=ledger.observations.at(-1),first=ledger.observations[0];
  const spent=ledger.observations.slice(1).reduce((total,o,i)=>total+Math.max(0,ledger.observations[i].balance-o.balance),0);
  const pending=ledger.reservations.reduce((n,r)=>n+r.cost,0);
  const elapsed=Math.max(0,Math.min(end-start,today-start+1));
  const pacedCeiling=Math.floor(policy.spendCeiling*elapsed/(end-start));
  const reasons=[];
  if(today<start||today>=end)reasons.push('outside budget period; confirm next cycle before spending');
  if(!latest||latest.date!==date)reasons.push('today account balance not observed');
  if(ledger.observations.some((o,i)=>i&&o.balance>ledger.observations[i-1].balance))reasons.push('balance increase: reconcile grant/reset before spending');
  if(!Number.isFinite(first?.balance)||!Number.isFinite(latest?.balance))reasons.push('unknown balance');
  const remaining=Math.max(0,Math.floor(Math.min(pacedCeiling-spent-pending,policy.spendCeiling-spent-pending,(latest?.balance??0)-policy.reserveFloor-pending)));
  return {date,spent,pending,balance:latest?.balance??null,remaining:reasons.length?0:remaining,monthlyCeiling:policy.spendCeiling,pacedCeiling,reserveFloor:policy.reserveFloor,daysRemaining:Math.max(0,end-today),reasons};
}
export function canReserve(policy,ledger,{date,cost,target,brief}){
  const state=allowance(policy,ledger,date),reasons=[...state.reasons];
  if(!Number.isSafeInteger(cost)||cost<=0)reasons.push('exact visible cost must be a positive integer');
  if(!policy.eligibleTargets.includes(target))reasons.push('target is not a major-building priority');
  if(!brief||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(brief))reasons.push('scoped brief id required');
  if(ledger.attempts.filter(a=>a.brief===brief).length>=policy.maxAttemptsPerBrief)reasons.push('attempt limit reached; revise locally');
  if(cost>state.remaining)reasons.push('operation exceeds paced allowance or reserve floor');
  return {...state,allowed:reasons.length===0,reasons};
}
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const policy=JSON.parse(fs.readFileSync(path.join(repo,'docs/shinsekai/tripo-policy.json'),'utf8'));
    const file=path.resolve(repo,policy.observationFile);
    const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,observations:[],reservations:[],attempts:[]};
    const [command='status',...args]=process.argv.slice(2),opts={};
    for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw new Error('Options need values');opts[args[i].slice(2)]=args[i+1];}
    const date=tokyoDate();
    function observe(){const balance=Number(opts.balance);if(opts.balance===undefined||!Number.isSafeInteger(balance)||balance<0||!opts.source)throw new Error('observe/finish require --balance and --source from visible UI');ledger.observations.push({date,at:new Date().toISOString(),balance,source:opts.source});}
    if(command==='observe')observe();
    else if(command==='reserve'){
      const proposal={date,cost:Number(opts.cost),target:opts.target,brief:opts.brief};
      const check=canReserve(policy,ledger,proposal);if(!check.allowed){console.log(JSON.stringify(check,null,2));process.exitCode=2;}else{const id=crypto.randomUUID();ledger.reservations.push({...proposal,id});ledger.attempts.push({...proposal,id});console.log(JSON.stringify({reserved:id,cost:proposal.cost}));}
    }else if(command==='finish'){
      const index=ledger.reservations.findIndex(r=>r.id===opts.id);if(index<0)throw new Error('Unknown reservation');
      observe();ledger.reservations.splice(index,1); // Settle only after an actual account re-read.
    }else if(command!=='status')throw new Error('Use status, observe, reserve, or finish');
    if(command!=='status'&&!process.exitCode){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(ledger,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
    console.log(JSON.stringify(allowance(policy,ledger,date),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
