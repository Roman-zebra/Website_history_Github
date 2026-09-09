// Minimal model of explore.js loadMonumentIndex() + the PROPOSED fix.
let MON_INDEX = [], idxLoading = null;
function loadMonumentIndex(){
  if (idxLoading) return idxLoading;               // line 600: memoised FOREVER, incl. failure
  idxLoading = Promise.reject(new Error('offline'))// SW returns Response.error() when offline
    .then(r => r.ok ? r.json() : [])
    .then(rows => { MON_INDEX = rows.map(x=>x); })
    .catch(() => { MON_INDEX = []; });             // line 603: MON_INDEX stays []
  return idxLoading;
}
let hits = 0, yielded = false;
setTimeout(() => { yielded = true; }, 0);          // can the event loop ever run again?
function drawDetail(){                             // the PROPOSED replacement for line 886
  if (++hits > 200000){ console.log('drawDetail re-entered', hits, 'times; macrotask ran?', yielded); process.exit(0); }
  if (!MON_INDEX.length){ loadMonumentIndex().then(drawDetail); }
  else { /* draw stones */ }
}
drawDetail();
