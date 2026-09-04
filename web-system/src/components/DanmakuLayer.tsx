import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, MessageSquarePlus, RefreshCw, Send, X } from 'lucide-react';
import { getDanmaku, postDanmaku } from '../lib/api';
import type { DanmakuItem } from '../lib/api';
import { randomPoeticName } from '../lib/poetic-name';

/** 弹幕轨道（垂直位置，vh）——避开顶部标题与底部控件 */
const LANES = [10, 17, 24, 31, 38, 45, 52, 59];
const POLL_MS = 8000;

interface Flying {
  key: string;
  nickname: string;
  content: string;
  lane: number;
  dur: number;
  fontSize: number;
  createdAt: number;
  self?: boolean;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DanmakuLayer({ poemId }: { poemId: string }) {
  const [enabled, setEnabled] = useState(true);
  const [flying, setFlying] = useState<Flying[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);

  const [nickname, setNickname] = useState<string>(() => randomPoeticName());
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const queueRef = useRef<DanmakuItem[]>([]);
  const nextIdRef = useRef(0);
  const busyUntilRef = useRef<number[]>(LANES.map(() => 0));
  const seqRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const poemIdRef = useRef(poemId);
  poemIdRef.current = poemId;
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeFlying = useCallback((key: string) => {
    setFlying((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const spawn = useCallback(() => {
    if (!enabledRef.current) return;
    const q = queueRef.current;
    if (q.length === 0) return;
    const now = Date.now();
    const lane = LANES.findIndex((_, i) => busyUntilRef.current[i] <= now);
    if (lane < 0) return;
    const item = q[0];
    q.shift();
    q.push(item); // 循环回放历史，新弹幕追加在队尾自然接续
    const dur = 9 + Math.random() * 5;
    const fontSize = 13 + Math.round(Math.random() * 4);
    busyUntilRef.current[lane] = now + dur * 1000;
    const key = `${item.id}-${seqRef.current++}`;
    setFlying((prev) => [
      ...prev.slice(-20),
      {
        key,
        nickname: item.nickname,
        content: item.content,
        lane,
        dur,
        fontSize,
        createdAt: item.createdAt,
      },
    ]);
  }, []);

  // 首次载入历史 + 定时增量轮询
  useEffect(() => {
    let disposed = false;
    queueRef.current = [];
    nextIdRef.current = 0;
    getDanmaku(poemId, 0, 60)
      .then((res) => {
        if (disposed) return;
        const items = res?.data?.items || [];
        queueRef.current = items;
        nextIdRef.current = res?.data?.nextId || 0;
      })
      .catch(() => {});

    const poll = setInterval(async () => {
      try {
        const res = await getDanmaku(poemId, nextIdRef.current, 50);
        if (disposed || !res?.data?.items?.length) return;
        const items = res.data.items;
        queueRef.current = queueRef.current.concat(items).slice(-200);
        nextIdRef.current = res.data.nextId;
      } catch {
        // 静默
      }
    }, POLL_MS);

    return () => {
      disposed = true;
      clearInterval(poll);
    };
  }, [poemId]);

  // 播放节拍器
  useEffect(() => {
    const t = setInterval(spawn, 260);
    return () => clearInterval(t);
  }, [spawn]);

  // 关闭弹幕时立即清屏
  useEffect(() => {
    if (!enabled) setFlying([]);
  }, [enabled]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2600);
  };

  const rollNickname = () => {
    const next = randomPoeticName();
    setNickname(next);
    showNotice(`为你取名「${next}」`);
  };

  const send = async () => {
    const nick = nickname.trim();
    const text = content.trim();
    if (!nick) {
      setNickname(randomPoeticName());
      showNotice('昵称空，已自动取诗意名，再点发送即可');
      return;
    }
    if (!text) {
      showNotice('先写下想说的话');
      return;
    }
    setSending(true);
    try {
      const res = await postDanmaku(poemIdRef.current, { nickname: nick, content: text });
      const item = res?.data?.item;
      if (!item) throw new Error('no item');
      if (item.id > nextIdRef.current) nextIdRef.current = item.id;
      queueRef.current.unshift(item);
      showNotice(`已发送 · ${fmtTime(item.createdAt)} · ${nick}`);
      setContent('');
    } catch (e) {
      showNotice(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  if (!poemId) return null;

  return (
    <>
      {/* 弹幕飞屏层：不拦截鼠标 */}
      {enabled && (
        <div className="fixed inset-0 z-30 overflow-hidden pointer-events-none" aria-hidden="true">
          {flying.map((f) => (
            <div
              key={f.key}
              className="danmaku-item"
              style={{ top: `${LANES[f.lane]}vh`, animationDuration: `${f.dur}s` }}
              onAnimationEnd={() => removeFlying(f.key)}
              title={`${f.nickname} · ${fmtTime(f.createdAt)}`}
            >
              <span
                className="inline-flex items-baseline gap-1.5 rounded-full bg-black/50 border border-white/10 px-3 py-1 text-paper/95 backdrop-blur-[2px]"
                style={{ fontSize: f.fontSize }}
              >
                <span className="text-gold/90 font-medium">{f.nickname}</span>
                <span className="opacity-90">：{f.content}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 右下控制组 */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {notice && (
          <p className="text-xs text-paper/90 bg-ink-light/90 border border-darkline px-3 py-1.5 rounded-full max-w-[240px] text-right">
            {notice}
          </p>
        )}

        {composerOpen && (
          <div className="w-[min(320px,calc(100vw-3rem))] bg-ink-light/95 border border-darkline rounded-xl p-3 space-y-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={16}
                placeholder="你的昵称（可手动输入）"
                className="flex-1 min-w-0 bg-ink border border-darkline rounded-lg px-3 py-2 text-sm text-paper placeholder-silver/50 focus:border-gold focus:outline-none"
              />
              <button
                onClick={rollNickname}
                title="随机诗意取名"
                className="shrink-0 p-2 rounded-lg border border-darkline text-gold hover:border-gold/60 transition-colors"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => setComposerOpen(false)}
                className="shrink-0 p-2 rounded-lg text-silver hover:text-paper transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
                }}
                maxLength={120}
                placeholder="留一句诗评、感悟…（Enter 发送）"
                className="flex-1 min-w-0 bg-ink border border-darkline rounded-lg px-3 py-2 text-sm text-paper placeholder-silver/50 focus:border-gold focus:outline-none"
              />
              <button
                onClick={send}
                disabled={sending}
                className="shrink-0 inline-flex items-center gap-1.5 bg-gold text-ink px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60 transition-colors"
              >
                {sending ? '…' : <Send size={14} />}
                发送
              </button>
            </div>
            <p className="text-[10px] text-silver/60">昵称与内容为其他访客可见；请勿发敏感信息。</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-darkline bg-ink-light/90 backdrop-blur-md px-3.5 py-2 text-xs text-paper hover:border-gold/50 transition-colors"
            title="写一条弹幕留言"
          >
            <MessageSquarePlus size={14} />
            留言
          </button>
          <button
            onClick={() => setEnabled((v) => !v)}
            aria-pressed={enabled}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-md transition-colors ${
              enabled
                ? 'bg-gold/15 text-gold border-gold/50 hover:bg-gold/25'
                : 'bg-ink-light/90 text-silver/70 border-darkline hover:border-silver'
            }`}
            title={enabled ? '关闭弹幕' : '开启弹幕'}
          >
            <MessageCircle size={14} />
            弹幕 {enabled ? '开' : '关'}
          </button>
        </div>
      </div>
    </>
  );
}
