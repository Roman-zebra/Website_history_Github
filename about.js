'use strict';
/* /about and /supporters: one section per language, picked by the #hash (Japanese without one).
   Other per-language blocks on the page carry data-lang and follow the same choice. */
function showAboutLanguage(){
 const sections=[...document.querySelectorAll('.founder-note')];
 const lang=sections.some(s=>s.id===location.hash.slice(1))?location.hash.slice(1):'ja';
 for(const section of sections)section.hidden=section.id!==lang;
 for(const block of document.querySelectorAll('[data-lang]'))block.hidden=block.dataset.lang!==lang;
 document.documentElement.lang=lang;
 document.title=document.getElementById(lang).querySelector('h2').textContent+' | Japan Time Atlas';
 for(const a of document.querySelectorAll('nav a[lang]')){if(a.lang===lang)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
}
showAboutLanguage();addEventListener('hashchange',showAboutLanguage);
/* Copy link: the clipboard API needs a gesture and can be refused, so the button says what happened. */
for(const b of document.querySelectorAll('.share-copy'))b.addEventListener('click',async()=>{
 const done=b.title;try{await navigator.clipboard.writeText('https://japantimeatlas.com/');b.textContent='\u2713';}
 catch(e){b.textContent='\u2715';}
 setTimeout(()=>{b.textContent='\u29c9';b.title=done;},1600);
});
