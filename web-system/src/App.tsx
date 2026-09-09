import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, Music, Music2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Library from './pages/Library';
import PoemDetail from './pages/PoemDetail';
import FontSwitcher from './components/FontSwitcher';
import AmbientBgm from './components/AmbientBgm';
import Gallery from './pages/Gallery';
import Topics from './pages/Topics';
import Topic from './pages/Topic';
import Cinema from './pages/Cinema';
import {
  isAmbientBgmEnabled,
  toggleAmbientBgm,
  subscribeAmbientBgm,
  ambientBgmTitle,
} from './lib/ambientBgm';

/** 环境背景乐开关：默认开，首次用户手势后出声；沉浸页/放映厅让位给页面自管 BGM */
function AmbientBgmToggle() {
  const { pathname } = useLocation();
  const isSelfManaged = pathname.startsWith('/poem/') || pathname.startsWith('/cinema');
  const [on, setOn] = useState(isAmbientBgmEnabled());

  useEffect(() => subscribeAmbientBgm(() => setOn(isAmbientBgmEnabled())), []);

  if (isSelfManaged) return null;
  return (
    <button
      onClick={toggleAmbientBgm}
      className={`p-1.5 rounded-full transition-colors ${on ? 'text-gold' : 'text-silver/50 hover:text-silver'}`}
      title={on ? `关闭背景乐${ambientBgmTitle() ? `（${ambientBgmTitle()}）` : ''}` : '开启背景乐'}
      aria-label="环境背景乐开关"
    >
      {on ? <Music2 size={16} /> : <Music size={16} />}
    </button>
  );
}

// SPA 路由变化时向 Umami 上报 pageview（script.js 首次加载会自行上报初始页）
function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      (window as unknown as { umami?: { track?: () => void } }).umami?.track?.();
    } catch {
      // 统计失败不影响页面
    }
  }, [pathname]);
  return null;
}

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: '首页' },
    { to: '/library', label: '诗词库' },
    { to: '/gallery', label: '沉浸画廊' },
    { to: '/cinema', label: '放映厅' },
    { to: '/topics', label: '专题' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 lg:px-10 bg-ink/80 backdrop-blur-md border-b border-darkline/50">
      <Link to="/" className="flex items-baseline gap-2 group">
        <span className="font-serif text-xl font-semibold text-paper group-hover:text-gold transition-colors">诗境</span>
        <span className="text-[10px] font-medium tracking-[0.2em] text-silver uppercase hidden sm:inline">Poetry Realm</span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-sm font-medium text-silver hover:text-paper transition-colors">
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <AmbientBgmToggle />
        <FontSwitcher />
        <button className="md:hidden text-paper p-1" onClick={() => setOpen(!open)} aria-label="菜单">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-ink-light border-b border-darkline p-6 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-base text-paper hover:text-gold">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-ink">
      <RouteTracker />
      <AmbientBgm />
      <Nav />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/cinema" element={<Cinema />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/topic/:tag" element={<Topic />} />
          <Route path="/poem/:id" element={<PoemDetail />} />
        </Routes>
      </main>
    </div>
  );
}