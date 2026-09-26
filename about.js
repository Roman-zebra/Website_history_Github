'use strict';
/* The about and support pages each hold one section per language; the #hash picks which one shows. */
function showAboutLanguage(){
 const sections=[...document.querySelectorAll('main>section[lang]')];
 const lang=sections.some(s=>s.id===location.hash.slice(1))?location.hash.slice(1):'ja';
 for(const section of sections)section.hidden=section.id!==lang;
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
