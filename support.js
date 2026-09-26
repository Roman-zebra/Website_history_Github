'use strict';
const COPY={
 ja:{title:'このサイトを支えてくれた方々',intro:'Japan Time Atlasの調査や制作を支えてくださり、ありがとうございます。',donate:'寄付する',notice:'<strong>掲載名について</strong>下のKo-fiフォームの「表示名 / Your name」欄に、このページへ載せたい名前を入力してください。支援を公開のまま完了すると、その表示名をこのページに自動掲載することに同意したものとして扱います。メールアドレス、寄付額、メッセージは掲載しません。掲載を望まない場合は、Ko-fiで「非公開メッセージ」を選んでください。',fallback:'フォームが表示されない場合は、<a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">Ko-fiの寄付ページ</a>を開いてください。',supporters:'サポーター',loading:'読み込んでいます…',empty:'まだ掲載されたサポーターはいません。',error:'サポーター一覧を読み込めませんでした。',back:'地図に戻る',about:'このサイトについて'},
 en:{title:'The people supporting this site',intro:'Thank you for supporting the research and work behind Japan Time Atlas.',donate:'Make a contribution',notice:'<strong>Name shown on this page</strong>Enter the name you want published in the Ko-fi “Your name” field below. By completing a public contribution, you consent to that display name being added to this page automatically. Your email address, contribution amount and message are never published. Choose “Private message” on Ko-fi if you do not want your name listed.',fallback:'If the form does not appear, open the <a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">Ko-fi contribution page</a>.',supporters:'Supporters',loading:'Loading…',empty:'No supporter names have been published yet.',error:'The supporter list could not be loaded.',back:'Back to the map',about:'About this site'},
 ko:{title:'이 사이트를 응원해 주신 분들',intro:'Japan Time Atlas의 조사와 제작을 응원해 주셔서 감사합니다.',donate:'후원하기',notice:'<strong>이 페이지에 표시될 이름</strong>아래 Ko-fi 양식의 “Your name” 칸에 이 페이지에 올릴 이름을 입력해 주세요. 공개 후원을 완료하면 해당 표시 이름이 이 페이지에 자동으로 게시되는 것에 동의한 것으로 간주합니다. 이메일 주소, 후원 금액, 메시지는 공개하지 않습니다. 이름 공개를 원하지 않으면 Ko-fi에서 “Private message”를 선택해 주세요.',fallback:'양식이 보이지 않으면 <a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">Ko-fi 후원 페이지</a>를 열어 주세요.',supporters:'후원자',loading:'불러오는 중…',empty:'아직 공개된 후원자 이름이 없습니다.',error:'후원자 목록을 불러오지 못했습니다.',back:'지도로 돌아가기',about:'이 사이트에 대하여'},
 'zh-Hans':{title:'支持本站的人们',intro:'感谢您支持 Japan Time Atlas 的调查与制作。',donate:'捐助本站',notice:'<strong>本页显示的姓名</strong>请在下方 Ko-fi 表单的“Your name”栏中填写希望在本页公开的姓名。以公开方式完成捐助，即表示您同意该显示名自动刊登在本页。我们不会公开邮箱地址、捐助金额或留言。如不希望显示姓名，请在 Ko-fi 中选择“Private message”。',fallback:'如果表单没有显示，请打开 <a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">Ko-fi 捐助页面</a>。',supporters:'支持者',loading:'正在加载…',empty:'目前还没有公开的支持者姓名。',error:'无法加载支持者名单。',back:'返回地图',about:'关于本站'},
 'zh-Hant':{title:'支持本站的人們',intro:'感謝您支持 Japan Time Atlas 的調查與製作。',donate:'捐助本站',notice:'<strong>本頁顯示的姓名</strong>請在下方 Ko-fi 表單的「Your name」欄填寫希望刊登在本頁的姓名。以公開方式完成捐助，即表示您同意該顯示名稱自動刊登在本頁。我們不會公開電子郵件、捐助金額或留言。如不希望顯示姓名，請在 Ko-fi 選擇「Private message」。',fallback:'如果表單未顯示，請開啟 <a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">Ko-fi 捐助頁面</a>。',supporters:'支持者',loading:'載入中…',empty:'目前還沒有公開的支持者姓名。',error:'無法載入支持者名單。',back:'返回地圖',about:'關於本站'},
 th:{title:'ผู้ที่สนับสนุนเว็บไซต์นี้',intro:'ขอบคุณที่สนับสนุนการค้นคว้าและการสร้าง Japan Time Atlas',donate:'สนับสนุน',notice:'<strong>ชื่อที่จะแสดงในหน้านี้</strong>กรอกชื่อที่ต้องการเผยแพร่ในช่อง “Your name” ของแบบฟอร์ม Ko-fi ด้านล่าง เมื่อสนับสนุนแบบสาธารณะ ถือว่าคุณยินยอมให้ชื่อนั้นแสดงในหน้านี้โดยอัตโนมัติ เราจะไม่เผยแพร่อีเมล จำนวนเงิน หรือข้อความ หากไม่ต้องการแสดงชื่อ ให้เลือก “Private message” บน Ko-fi',fallback:'หากแบบฟอร์มไม่แสดง ให้เปิด <a href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">หน้าสนับสนุน Ko-fi</a>',supporters:'ผู้สนับสนุน',loading:'กำลังโหลด…',empty:'ยังไม่มีรายชื่อผู้สนับสนุนที่เผยแพร่',error:'ไม่สามารถโหลดรายชื่อผู้สนับสนุนได้',back:'กลับไปที่แผนที่',about:'เกี่ยวกับเว็บไซต์นี้'}
};
const UI=Object.fromEntries(['pageTitle','intro','donateTitle','publishNotice','fallback','supportersTitle','supporterStatus','supporterList','backLink','aboutLink'].map(id=>[id,document.getElementById(id)]));

function selectedLanguage(){
 const hash=decodeURIComponent(location.hash.slice(1));
 if(COPY[hash])return hash;
 const preferred=(navigator.language||'ja').toLowerCase();
 if(preferred.startsWith('ko'))return 'ko';
 if(preferred.startsWith('zh-tw')||preferred.startsWith('zh-hk')||preferred.includes('hant'))return 'zh-Hant';
 if(preferred.startsWith('zh'))return 'zh-Hans';
 if(preferred.startsWith('th'))return 'th';
 if(preferred.startsWith('en'))return 'en';
 return 'ja';
}

function showLanguage(){
 const lang=selectedLanguage(),copy=COPY[lang];
 document.documentElement.lang=lang;
 document.title=copy.title+' | Japan Time Atlas';
 UI.pageTitle.textContent=copy.title;UI.intro.textContent=copy.intro;UI.donateTitle.textContent=copy.donate;
 UI.publishNotice.innerHTML=copy.notice;UI.fallback.innerHTML=copy.fallback;UI.supportersTitle.textContent=copy.supporters;
 if(UI.supporterStatus.dataset.state==='empty')UI.supporterStatus.textContent=copy.empty;
 else if(UI.supporterStatus.dataset.state==='error')UI.supporterStatus.textContent=copy.error;
 else if(UI.supporterStatus.dataset.state!=='loaded')UI.supporterStatus.textContent=copy.loading;
 UI.backLink.textContent=copy.back;UI.backLink.href='/?lang='+encodeURIComponent(lang)+'#map';
 UI.aboutLink.textContent=copy.about;UI.aboutLink.href='/about#'+encodeURIComponent(lang);
 for(const link of document.querySelectorAll('nav a[lang]'))link.toggleAttribute('aria-current',link.lang===lang);
}

async function loadSupporters(){
 const lang=selectedLanguage(),copy=COPY[lang];
 try{
  const response=await fetch('/api/supporters',{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('supporters '+response.status);
  const body=await response.json(),supporters=Array.isArray(body.supporters)?body.supporters:[];
  UI.supporterList.replaceChildren(...supporters.map(s=>{const item=document.createElement('li');item.textContent=String(s.name||'');return item;}));
  UI.supporterStatus.dataset.state=supporters.length?'loaded':'empty';
  UI.supporterStatus.textContent=supporters.length?'':copy.empty;
 }catch(error){UI.supporterStatus.dataset.state='error';UI.supporterStatus.textContent=copy.error;}
}

showLanguage();
addEventListener('hashchange',showLanguage);
loadSupporters();
