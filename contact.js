'use strict';
const ADDRESS='contact@japantimeatlas.com';
const mailto=(subject,body)=>'mailto:'+ADDRESS+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);

function showContactLanguage(){
 const sections=[...document.querySelectorAll('.contact-section')];
 const lang=sections.some(s=>s.id===location.hash.slice(1))?location.hash.slice(1):'ja';
 for(const section of sections)section.hidden=section.id!==lang;
 document.documentElement.lang=lang;
 document.title=document.getElementById(lang).querySelector('h2').textContent+' | Japan Time Atlas';
 for(const a of document.querySelectorAll('nav a[lang]')){if(a.lang===lang)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
}
showContactLanguage();addEventListener('hashchange',showContactLanguage);

/* The clipboard can be refused, so the button says what happened and, for a message, leaves the text selectable. */
async function copyText(text,button,box){
 const label=button.textContent;
 try{await navigator.clipboard.writeText(text);button.textContent=button.dataset.done;}
 catch(e){button.textContent=button.dataset.failed;if(box){box.hidden=false;box.focus();box.select();}}
 setTimeout(()=>{button.textContent=label;},2000);
}
for(const b of document.querySelectorAll('.copy-address'))b.addEventListener('click',()=>copyText(ADDRESS,b));
for(const a of document.querySelectorAll('a.enquiry'))a.href=mailto(a.dataset.subject,a.dataset.body);

/* Nothing is sent from this page: the form only writes an email for the visitor's own mail app. */
for(const form of document.querySelectorAll('.request-form')){
 const box=form.querySelector('.request-copy'),copyButton=form.querySelector('.copy-request'),status=form.querySelector('.form-status');
 const labelOf=field=>form.querySelector('label[for="'+field.id+'"]').textContent.trim();
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const place=form.elements.place,note=form.elements.note;
  const wants=[...form.querySelectorAll('input[name="want"]:checked')].map(i=>i.value);
  const subject=form.dataset.subject+': '+place.value.trim();
  const body=[labelOf(place)+': '+place.value.trim(),form.querySelector('legend').textContent.trim()+': '+(wants.join(', ')||'-'),labelOf(note)+':',note.value.trim()].join('\n')+'\n';
  box.value='To: '+ADDRESS+'\nSubject: '+subject+'\n\n'+body;
  box.hidden=false;copyButton.hidden=false;status.textContent=form.dataset.opened;
  location.href=mailto(subject,body);
 });
 copyButton.addEventListener('click',()=>copyText(box.value,copyButton,box));
}
