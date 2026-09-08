#!/usr/bin/env python3
# 一次性 UI 统一：给 Library/Gallery/Topics/Topic 页头铺全宽背景；Home/Library/Gallery/Topics/Topic 挂统一 SiteFooter
import io, sys

FILES = {
 'src/pages/Home.tsx': {
   'footer_old': '''      {/* ============ 页脚 ============ */}
      <footer className="py-12 px-6 lg:px-10 border-t border-darkline bg-ink">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-serif text-paper">诗境 Poetry Realm</p>
          <p className="text-xs text-silver">Powered by poetry-cli · doubao-cli AI 生图 · Vite + React</p>
        </div>
      </footer>''',
   'footer_new': '      <SiteFooter />',
   'import_anchor': "import { useEffect, useMemo, useState } from 'react';",
 },
 'src/pages/Library.tsx': {
   'bg_old': '<section className="relative py-24 px-6 lg:px-10 border-b border-darkline">',
   'bg_new': None,  # 由公共注入
   'bg_img': '/assets/bg/library.jpg',
   'footer_old': '\n    </div>\n  );\n}',
   'footer_new': '\n      <SiteFooter />\n    </div>\n  );\n}',
   'import_anchor': None,
 },
 'src/pages/Gallery.tsx': {
   'bg_old': '<section className="relative py-24 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]">',
   'bg_img': '/assets/bg/gallery.jpg',
   'footer_old': '\n    </div>\n  );\n}',
   'footer_new': '\n      <SiteFooter />\n    </div>\n  );\n}',
   'import_anchor': "import { useEffect, useMemo, useState } from 'react';",
 },
 'src/pages/Topics.tsx': {
   'bg_old': '<section className="relative py-24 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]">',
   'bg_img': '/assets/bg/topics.jpg',
   'footer_old': '\n    </div>\n  );\n}',
   'footer_new': '\n      <SiteFooter />\n    </div>\n  );\n}',
   'import_anchor': "import { useEffect, useState } from 'react';",
 },
 'src/pages/Topic.tsx': {
   'bg_old': '<section className="relative pt-24 pb-10 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]">',
   'bg_img': '/assets/bg/topics.jpg',
   'footer_old': '\n    </div>\n  );\n}',
   'footer_new': '\n      <SiteFooter />\n    </div>\n  );\n}',
   'import_anchor': "import { useEffect, useMemo, useState } from 'react';",
 },
}

def inject_bg(class_str, img):
    if 'style=' in class_str:  # 已注入
        return class_str
    style = " style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.93) 0%, rgba(10,10,11,0.72) 40%, rgba(10,10,11,0.9) 80%, #0a0a0b 100%), url(__IMG__)`, backgroundSize: 'cover', backgroundPosition: 'center' }}".replace('__IMG__', img)
    return class_str.rstrip('>') + style + '>'

for rel, cfg in FILES.items():
    p = rel if rel.startswith('src/') else rel
    # path relative 到脚本执行目录 web-system
    fp = rel if rel.startswith('src/') else rel
    s = open(fp, encoding='utf-8').read()
    changed = []
    # footer
    if cfg.get('footer_old') in s:
        s = s.replace(cfg['footer_old'], cfg['footer_new'], 1)
        changed.append('footer')
    else:
        print(f'[warn] {rel}: footer_old not found')
    # bg
    if cfg.get('bg_old'):
        if cfg['bg_old'] in s:
            s = s.replace(cfg['bg_old'], inject_bg(cfg['bg_old'], cfg['bg_img']), 1)
            changed.append('bg')
        else:
            print(f'[warn] {rel}: bg_old not found')
    # import SiteFooter（Home 无 import_anchor? 需在文件首个 import 后插入）
    anchor = cfg.get('import_anchor')
    imp = "import SiteFooter from '../components/SiteFooter';\n"
    if anchor:
        if imp not in s:
            s = s.replace(anchor, imp + anchor, 1)
            changed.append('import')
    open(fp, 'w', encoding='utf-8').write(s)
    print(f'{rel}: {changed}')