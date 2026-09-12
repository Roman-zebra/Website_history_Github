'use strict';
function showAboutLanguage(){
 const sections=[...document.querySelectorAll('.founder-note')];
 const lang=sections.some(s=>s.id===location.hash.slice(1))?location.hash.slice(1):'ja';
 for(const section of sections)section.hidden=section.id!==lang;
 document.documentElement.lang=lang;
 document.title=document.getElementById(lang).querySelector('h2').textContent+' | Japan Time Atlas';
 for(const a of document.querySelectorAll('nav a[lang]')){if(a.lang===lang)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
}
showAboutLanguage();addEventListener('hashchange',showAboutLanguage);
