"""Ground-level photographs for the building panels, chosen from the Wikimedia Commons catalogue
(refphotos/catalog.json; CC BY / CC BY-SA / CC0 / public domain only) and named building by building.

    python photos.py   ->  web/photos/*.jpg (1000 px wide), web/gunkanjima-photos.json, plus spots/pier-photo.jpg

Every entry keeps the photographer, licence, year and the Commons page so the page can credit it.
"""
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
WEB = HERE / 'web'
UA = {'User-Agent': 'japantimeatlas-lab/1.0 (https://japantimeatlas.com)'}

# catalogue index -> the buildings (model names) the photograph is used for
PICKS = {
    275: ['1号棟'], 279: ['2号棟'], 245: ['3号棟'], 172: ['8号棟'], 231: ['12号棟', '22号棟'], 278: ['13号棟', '48号棟'],
    157: ['14号棟'], 271: ['16号棟', '51号棟'], 158: ['17号棟'], 159: ['18号棟', '19号棟'], 161: ['25号棟'],
    268: ['30号棟'], 163: ['31号棟'], 264: ['39号棟'], 165: ['57号棟'], 270: ['59号棟', '60号棟', '61号棟'],
    110: ['65号棟'], 170: ['66号棟'], 178: ['69号棟'], 198: ['端島小中学校'], 229: ['端島小中学校体育館'],
    262: ['貯水槽'], 277: ['仕上工場'], 175: ['ベルトコンベアー'], 227: ['__pier'],
}
NAME = {  # how a building is called in each language for the caption
    'en': lambda n: re.sub(r'^(\d+)号棟$', r'Building \1', n).replace('端島小中学校体育館', 'School gymnasium (Building 71)').replace('端島小中学校', 'Hashima Elementary and Junior High School (Building 70)').replace('貯水槽', 'Water tank').replace('仕上工場', 'Finishing workshop').replace('ベルトコンベアー', 'Belt conveyor'),
    'ja': lambda n: n,
    'ko': lambda n: re.sub(r'^(\d+)号棟$', r'\1호동', n).replace('端島小中学校体育館', '학교 체육관(71호동)').replace('端島小中学校', '하시마 초·중학교(70호동)').replace('貯水槽', '저수조').replace('仕上工場', '마무리 공장').replace('ベルトコンベアー', '벨트 컨베이어'),
    'zh-Hans': lambda n: re.sub(r'^(\d+)号棟$', r'\1号楼', n).replace('端島小中学校体育館', '学校体育馆（71号楼）').replace('端島小中学校', '端岛中小学校（70号楼）').replace('貯水槽', '储水槽').replace('仕上工場', '精整车间').replace('ベルトコンベアー', '传送带'),
    'zh-Hant': lambda n: re.sub(r'^(\d+)号棟$', r'\1號樓', n).replace('端島小中学校体育館', '學校體育館（71號樓）').replace('端島小中学校', '端島中小學校（70號樓）').replace('貯水槽', '儲水槽').replace('仕上工場', '精整車間').replace('ベルトコンベアー', '輸送帶'),
}
SHOT = {'en': '{name}, photographed in {year}', 'ja': '{name}（{year}年撮影）', 'ko': '{name}({year}년 촬영)', 'zh-Hans': '{name}（{year}年拍摄）', 'zh-Hant': '{name}（{year}年拍攝）'}


def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def main():
    cat = json.loads((HERE / 'refphotos' / 'catalog.json').read_text(encoding='utf-8'))['files']
    (WEB / 'photos').mkdir(exist_ok=True)
    titles = [cat[i]['title'] for i in PICKS]
    info = {}
    for k in range(0, len(titles), 50):
        d = api({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'extmetadata|url|size', 'iiurlwidth': 1000, 'titles': '|'.join(titles[k:k + 50]), 'format': 'json'})
        for p in d['query']['pages'].values():
            info[p['title']] = p['imageinfo'][0]
    out = {}
    pier = None
    for i, names in PICKS.items():
        r = cat[i]
        ii = info[r['title']]
        m = ii.get('extmetadata', {})
        artist = re.sub('<[^>]+>', '', html.unescape(m.get('Artist', {}).get('value', ''))).strip()
        year = (m.get('DateTimeOriginal', {}).get('value', '') or r['date'])[:4]
        if not year.isdigit():
            year = re.search(r'(19|20)\d\d', r['title'] + r['desc'] + r['date']).group(0)
        slug = re.sub(r'[^a-z0-9]+', '-', r['title'][5:].lower()).strip('-')[:48]
        fn = f'photos/{slug}.jpg'
        dst = WEB / fn
        if not dst.exists():
            raw = urllib.request.urlopen(urllib.request.Request(ii['thumburl'], headers=UA), timeout=90).read()
            tmp = WEB / 'photos' / '_tmp'
            tmp.write_bytes(raw)
            im = ImageOps.exif_transpose(Image.open(tmp)).convert('RGB')
            if im.width > 1000:
                im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
            im.save(dst, quality=82, optimize=True, progressive=True)
            tmp.unlink()
        entry = {'file': fn, 'author': artist, 'year': year, 'license': m.get('LicenseShortName', {}).get('value'), 'licenseUrl': m.get('LicenseUrl', {}).get('value'),
                 'page': 'https://commons.wikimedia.org/wiki/' + r['title'].replace(' ', '_'),
                 'note': re.sub('<[^>]+>', '', html.unescape(m.get('ImageDescription', {}).get('value', '')))[:200]}
        for name in names:
            if name == '__pier':
                pier = entry
                continue
            e = dict(entry)
            e['caption'] = {lang: SHOT[lang].format(name=NAME[lang](name), year=year) for lang in SHOT}
            out.setdefault(name, []).append(e)
    (WEB / 'gunkanjima-photos.json').write_text(json.dumps({'source': 'Wikimedia Commons, Category:Hashima (Nagasaki); each entry credits its photographer and licence', 'photos': out}, ensure_ascii=False, indent=1), encoding='utf-8')
    print('buildings with photos', len(out), 'files', len(list((WEB / 'photos').glob('*.jpg'))))
    # the pier spot photograph
    if pier:
        src = WEB / pier['file']
        im = Image.open(src)
        im.save(WEB / 'spots' / 'pier-photo.jpg', quality=82, optimize=True, progressive=True)
        spots = json.loads((WEB.parent.parent / 'jta' / '3d' / 'gunkanjima-spots.json').read_text(encoding='utf-8'))
        spots['photos']['pier'] = {'caption': {'en': 'The opening in the sea wall that leads to the pier, 1992', 'ja': '桟橋へ通じる護岸の開口部（1992年）', 'ko': '잔교로 이어지는 방파제의 개구부(1992년)', 'zh-Hans': '通向栈桥的护岸开口（1992年）', 'zh-Hant': '通向棧橋的護岸開口（1992年）'},
                                 'author': pier['author'], 'year': pier['year'], 'license': pier['license'], 'licenseUrl': pier['licenseUrl'], 'page': pier['page']}
        (WEB.parent.parent / 'jta' / '3d' / 'gunkanjima-spots.json').write_text(json.dumps(spots, ensure_ascii=False, indent=1), encoding='utf-8')
        lab = json.loads((WEB.parent.parent / 'jta' / '3d' / 'gunkanjima-lab.json').read_text(encoding='utf-8'))
        lab['spots']['pier']['images']['photo'] = 'spots/pier-photo.jpg'
        (WEB.parent.parent / 'jta' / '3d' / 'gunkanjima-lab.json').write_text(json.dumps(lab, ensure_ascii=False, indent=1), encoding='utf-8')
        print('pier photo added')


if __name__ == '__main__':
    main()
