import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { startAmbientBgm, pauseAmbientBgm } from '../lib/ambientBgm';

/**
 * 环境 BGM 编排：诗词库/画廊/专题/首页默认播放舒缓背景乐；
 * 沉浸诗歌页（/poem/）自管 BGM，这里让位。
 * 浏览器自动播放策略要求首次用户手势后才能出声，
 * 因此首次点击/按键时尝试启动，之后随路由持续。
 */
export default function AmbientBgm() {
  const { pathname } = useLocation();
  const isSelfManaged = pathname.startsWith('/poem/') || pathname.startsWith('/cinema');
  const interacted = useRef(false);

  useEffect(() => {
    if (isSelfManaged) {
      pauseAmbientBgm();
      return;
    }
    if (!interacted.current) return;
    startAmbientBgm();
  }, [pathname, isSelfManaged]);

  useEffect(() => {
    const onGesture = () => {
      if (interacted.current) return;
      interacted.current = true;
      if (!window.location.pathname.startsWith('/poem/')) startAmbientBgm();
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  return null;
}
