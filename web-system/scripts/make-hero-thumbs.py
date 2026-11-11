#!/usr/bin/env python3
"""为沉浸画廊封面批量生成缩略图：public/generated/<id>/hero.jpg → hero-thumb.jpg

画廊卡片用 640px 宽缩略图（约 60-100KB），避免 5-8MB 原图拖垮列表页。
幂等：缩略图已存在且不比源图旧时跳过。新诗生成后由 generate-ai.mjs /
generate-original-art.mjs 自动调用（传 id）；也可手动全量重跑（不传参数）。
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'generated'
MAX_W = 640
QUALITY = 72


def iter_heroes() -> list[Path]:
    if len(sys.argv) > 1:
        return [ROOT / poem_id / 'hero.jpg' for poem_id in sys.argv[1:]]
    return sorted(ROOT.glob('*/hero.jpg'))


def main() -> None:
    made = skipped = failed = 0
    for hero in iter_heroes():
        thumb = hero.with_name('hero-thumb.jpg')
        try:
            if thumb.exists() and thumb.stat().st_mtime >= hero.stat().st_mtime:
                skipped += 1
                continue
            im = Image.open(hero).convert('RGB')
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            im.save(thumb, 'JPEG', quality=QUALITY, progressive=True, optimize=True)
            made += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f'FAIL {hero}: {e}', file=sys.stderr)
    print(f'done: made={made} skipped={skipped} failed={failed}')


if __name__ == '__main__':
    main()
