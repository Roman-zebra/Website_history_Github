const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const js = read('explore.js');
const cardCode = js.slice(js.indexOf('const LAB_ITEMS = ['), js.indexOf('\nfunction buildCards(){'));
const names = {
  en: 'Osaka — Shinsekai & Luna Park, 1912',
  ja: '大阪・新世界とルナパーク（1912年）',
  ko: '오사카 신세카이와 루나파크 (1912년)',
  'zh-Hans': '大阪·新世界与露娜乐园（1912年）',
  'zh-Hant': '大阪·新世界與露娜樂園（1912年）',
  th: 'โอซาก้า — ชินเซไกและลูน่าพาร์ค (1912)'
};

function render(lang) {
  const cards = { innerHTML: '' };
  vm.runInNewContext(cardCode + '\nbuildLabCards();', {
    LANG: lang,
    $: () => cards,
    esc: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    cardBadge: () => '',
    landmarkArt: () => ''
  });
  return cards.innerHTML;
}

test('tab 06 renders a second, localized disabled card while Gunkanjima stays linked', () => {
  for (const [lang, name] of Object.entries(names)) {
    const html = render(lang);
    const first = html.indexOf('<a class="card card-lab"');
    const second = html.indexOf('<div class="card card-lab card-lab-soon" role="group" aria-disabled="true">');
    assert.ok(first >= 0 && second > first, `${lang}: card order`);
    assert.ok(html.includes(name.replace(/&/g, '&amp;')), `${lang}: localized title`);
    assert.ok(html.slice(first, second).includes('href="/3d/'), `${lang}: Gunkanjima link`);
    assert.ok(!/href=|tabindex=|onclick=/.test(html.slice(second)), `${lang}: preview cannot be activated`);
    assert.ok(html.slice(second).includes('class="card-cta"'), `${lang}: badge`);
  }
});

test('Thai entry shows the same preview and no Shinsekai page is published', () => {
  const thai = read('th.html');
  const preview = thai.slice(thai.indexOf('class="thai-lab"'), thai.indexOf('</section>', thai.indexOf('class="thai-lab"')));
  assert.ok(preview.includes(names.th));
  assert.ok(preview.includes('aria-disabled="true"'));
  assert.ok(!preview.includes('href="/3d/shinsekai'));
  assert.ok(!read('sitemap.xml').includes('/3d/shinsekai'));
  assert.ok(!fs.existsSync(path.join(root, '3d', 'shinsekai.html')));
});
