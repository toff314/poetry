import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Library from './pages/Library';
import PoemDetail from './pages/PoemDetail';
import FontSwitcher from './components/FontSwitcher';
import Gallery from './pages/Gallery';

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
      <Nav />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/poem/:id" element={<PoemDetail />} />
        </Routes>
      </main>
    </div>
  );
}