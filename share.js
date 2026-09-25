/* Place pages: the browser's own share sheet where there is one (it reaches KakaoTalk, WhatsApp, WeChat and
   whatever else the reader uses), and a copy button. The share links in the same row work without this file. */
for(const row of document.querySelectorAll('.share-row')){
 const url=row.dataset.url,text=row.dataset.text;
 const native=row.querySelector('.share-native');
 if(native&&navigator.share){
  native.hidden=false;
  native.addEventListener('click',()=>{navigator.share({title:text,text,url}).catch(()=>{});});
 }
 const copy=row.querySelector('.share-copy');
 if(copy&&navigator.clipboard){
  const label=copy.textContent;copy.hidden=false;
  copy.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(url);copy.textContent=copy.dataset.done;setTimeout(()=>{copy.textContent=label;},2500);}
   catch(e){window.prompt(label,url);}
  });
 }
}
