import { useEffect, useRef, useState } from 'react';
import { Type, Check } from 'lucide-react';

/**
 * 字体风格切换：10 款中文字体全部随源码内置（src/assets/fonts/*.woff2，GB2312 常用字集子集）。
 * 选择结果写入 <html data-font="key">，由 index.css 的 html[data-font='key'] 驱动 --font-poem。
 */
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
    family: "'LXGW WenKai', 'Kaiti SC', 'KaiTi', 'STKaiti', serif",
  },
  {
    key: 'hei',
    name: '思源黑体',
    eng: 'Noto Sans SC',
    desc: '现代明快 · 中性',
    family: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    key: 'mashan',
    name: '马善政毛笔楷书',
    eng: 'Ma Shan Zheng',
    desc: '毛笔 · 书法',
    family: "'Ma Shan Zheng', 'Kaiti SC', KaiTi, cursive",
  },
  {
    key: 'xiaowei',
    name: '站酷小薇',
    eng: 'ZCOOL XiaoWei',
    desc: '清秀宋 · 纤细',
    family: "'ZCOOL XiaoWei', 'Songti SC', SimSun, serif",
  },
  {
    key: 'kuaile',
    name: '站酷快乐体',
    eng: 'ZCOOL KuaiLe',
    desc: '圆润活泼 · 轻松',
    family: "'ZCOOL KuaiLe', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    key: 'wqyhei',
    name: '文泉驿微米黑',
    eng: 'WQY Micro Hei',
    desc: '开源黑体 · 通用',
    family: "'WQY Micro Hei', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    key: 'wqyzen',
    name: '文泉驿正黑',
    eng: 'WQY Zen Hei',
    desc: '开源黑体 · 饱满',
    family: "'WQY Zen Hei', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    key: 'wqysharp',
    name: '文泉驿点阵正黑',
    eng: 'WQY Zen Hei Sharp',
    desc: '点阵 · 复古屏显',
    family: "'WQY Zen Hei Sharp', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  {
    key: 'droid',
    name: 'Droid Sans Fallback',
    eng: 'Droid Sans Fallback',
    desc: '安卓回退 · 极简',
    family: "'Droid Sans Fallback', 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
        <div className="absolute right-0 top-[calc(100%+12px)] z-[80] w-[19rem] md:w-[24rem] origin-top-right">
          <div className="rounded-xl border border-darkline bg-ink-light shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-4 pt-3.5 pb-1 flex items-baseline justify-between">
              <p className="text-xs tracking-[0.25em] text-gold uppercase">字体风格</p>
              <p className="text-[10px] text-silver/60">点击即应用 · 本机保存</p>
            </div>
            <div className="p-2.5 space-y-1.5 max-h-[70vh] overflow-y-auto">
              {FONTS.map((f) => {
                const isActive = f.key === active;
                return (
                  <button
                    key={f.key}
                    onClick={() => choose(f.key)}
                    title={f.eng}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      isActive
                        ? 'border-gold/70 bg-gold/5'
                        : 'border-darkline hover:border-silver/50 bg-ink/40'
                    }`}
                  >
                    {/* 第一行：字体名 + 说明（原 3 行信息压缩为 2 行） */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-paper font-medium text-[13px] shrink-0">{f.name}</span>
                      <span className="text-[10px] text-silver/65 truncate flex-1 min-w-0">{f.desc}</span>
                      {isActive && <Check size={14} className="text-gold shrink-0" />}
                    </div>
                    {/* 第二行：字体样例 */}
                    <p
                      className="font-serif text-[15px] leading-snug text-paper/85 truncate"
                      style={{ fontFamily: f.family }}
                    >
                      {SAMPLE}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="px-4 pb-3 pt-1 text-[10px] text-silver/50">
              共 {FONTS.length} 款内置字体 · 首次切换按需加载对应字型
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
