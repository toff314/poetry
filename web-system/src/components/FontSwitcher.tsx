import { useEffect, useRef, useState } from 'react';
import { Type, Check } from 'lucide-react';

const FONTS = [
  {
    key: 'serif',
    name: '思源宋体',
    eng: 'Noto Serif SC',
    desc: '雅正印刷感 · 默认',
    family: "'Noto Serif SC', 'Songti SC', SimSun, serif",
  },
  {
    key: 'kai',
    name: '霞鹜文楷',
    eng: 'LXGW WenKai',
    desc: '手写楷体 · 书卷气',
    family: "'LXGW WenKai', 'Kaiti SC', KaiTi, 'STKaiti', serif",
  },
  {
    key: 'hei',
    name: '思源黑体',
    eng: 'Noto Sans SC',
    desc: '现代明快 · 中性',
    family: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
];

const STORE_KEY = 'poetry:font-theme';
const SAMPLE = '秋水共长天一色，落霞与孤鹜齐飞';

export default function FontSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('serif');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY) || 'serif';
    const valid = FONTS.some((f) => f.key === saved) ? saved : 'serif';
    setActive(valid);
    document.documentElement.setAttribute('data-font', valid);
  }, []);

  // 点击外部或 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (key: string) => {
    setActive(key);
    localStorage.setItem(STORE_KEY, key);
    document.documentElement.setAttribute('data-font', key);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-sm font-medium px-1 py-1 transition-colors ${
          open ? 'text-gold' : 'text-silver hover:text-paper'
        }`}
        aria-label="切换字体风格"
        aria-expanded={open}
        title="字体风格"
      >
        <Type size={17} />
        <span className="hidden lg:inline">Aa</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[80] w-80 md:w-96 origin-top-right">
          <div className="rounded-xl border border-darkline bg-ink-light shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-5 pt-4 pb-1 flex items-baseline justify-between">
              <p className="text-xs tracking-[0.25em] text-gold uppercase">字体风格</p>
              <p className="text-[10px] text-silver/60">点击即应用 · 本机保存</p>
            </div>
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {FONTS.map((f) => {
                const isActive = f.key === active;
                return (
                  <button
                    key={f.key}
                    onClick={() => choose(f.key)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isActive
                        ? 'border-gold/70 bg-gold/5'
                        : 'border-darkline hover:border-silver/50 bg-ink/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-baseline gap-2">
                        <span className="text-paper font-medium text-sm">{f.name}</span>
                        <span className="text-[9px] tracking-wider text-silver/60 uppercase">{f.eng}</span>
                      </span>
                      {isActive && <Check size={15} className="text-gold shrink-0" />}
                    </div>
                    <p
                      className="font-serif text-base text-paper/90 leading-relaxed"
                      style={{ fontFamily: f.family }}
                    >
                      {SAMPLE}
                    </p>
                    <p className="text-[11px] text-silver/70 mt-1">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
