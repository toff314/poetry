#!/usr/bin/env python3
"""Suno 纯 BGM 单发生成（登录态 captcha + 直连 generate）。

用法: python3 scripts/suno-bgm-gen.py "<title>" "<tags>"
成功输出 'RESULT [...]' 行（含 2 个 clip id）。

排障要点（详见 docs/bgm-library.md 2026-09-09 备忘）：
- 给 captcha 页注入 __session=<刷新JWT> 登录态，hCaptcha invisible 才直接过；
- Chrome --proxy-server 只认 socks5://（socks5h:// 会 ERR_NO_SUPPORTED_PROXIES）；
- 本脚本自带独立 CDP 端口(9255)与整树回收，避免与 CLI 的 9233 冲突。
"""
import sys, json, time, subprocess, urllib.request, os, signal
for k in ('http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY','all_proxy','ALL_PROXY'):
    os.environ.pop(k, None)
os.environ['no_proxy'] = '127.0.0.1,localhost'
os.environ['NO_PROXY'] = '127.0.0.1,localhost'
sys.path.insert(0, '/usr/lib/python3.12/site-packages')
import websocket
from cli_anything.suno.core.session import AuthState, load_proxy
from cli_anything.suno.core.auth import refresh_from_state
from cli_anything.suno.core.client import SunoClient
from cli_anything.suno.core.generate import generate_and_wait

title, tags = sys.argv[1], sys.argv[2]
CDP = 9255
CHROME = '/opt/suno-chrome/chrome/chrome-linux64/chrome'
PROFILE_ROOT = os.path.join(os.path.dirname(__file__), '..', 'data', 'suno-genone-profile')

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

state = AuthState.load()
proxy = load_proxy()
state = refresh_from_state(state, proxy)
jwt = state.jwt

profile = os.path.join(PROFILE_ROOT, str(os.getpid()))
proc = subprocess.Popen([
    'xvfb-run', '-a', CHROME, '--no-sandbox',
    '--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={CDP}',
    '--remote-allow-origins=*', f'--user-data-dir={profile}',
    '--no-first-run', '--disable-dev-shm-usage', '--window-size=1280,900',
    '--window-position=-32000,-32000',
    '--proxy-server=socks5://127.0.0.1:1080', 'about:blank',
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)

ws = None
try:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    tabs = None
    for _ in range(40):
        try:
            tabs = json.loads(opener.open(f'http://127.0.0.1:{CDP}/json/list', timeout=2).read())
            if tabs: break
        except Exception:
            time.sleep(1)
    if not tabs:
        raise RuntimeError('CDP not up')
    page = next(t for t in tabs if t['type'] == 'page')
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=60, http_proxy_host=None, http_proxy_port=None)
    mid = [0]
    def call(method, params=None, timeout=60):
        mid[0] += 1
        my = mid[0]
        ws.send(json.dumps({'id': my, 'method': method, 'params': params or {}}))
        t0 = time.time()
        while time.time() - t0 < timeout:
            try: m = json.loads(ws.recv())
            except websocket.WebSocketTimeoutException: continue
            if m.get('id') == my: return m
        raise TimeoutError(method)
    def ev(expr, timeout=60, await_promise=False):
        r = call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': await_promise}, timeout)
        return r.get('result', {}).get('result', {}).get('value')

    call('Page.enable')
    call('Network.enable')
    cookies = [
        {'name': '__client', 'value': state.clerk_client_cookie, 'domain': '.suno.com', 'path': '/', 'secure': True, 'httpOnly': True},
        {'name': '__session', 'value': jwt, 'domain': '.suno.com', 'path': '/', 'secure': True, 'httpOnly': True},
        {'name': 'ajs_anonymous_id', 'value': state.device_id or '', 'domain': '.suno.com', 'path': '/'},
    ]
    call('Network.setCookies', {'cookies': [c for c in cookies if c['value']]})
    SCRIPT = ('https://hcaptcha-endpoint-prod.suno.com/1/api.js?onload=hCaptchaOnLoad&render=explicit&sentry=false'
              '&assethost=https%3A%2F%2Fhcaptcha-assets-prod.suno.com&imghost=https%3A%2F%2Fhcaptcha-imgs-prod.suno.com'
              '&reportapi=https%3A%2F%2Fhcaptcha-reportapi-prod.suno.com&endpoint=https%3A%2F%2Fhcaptcha-endpoint-prod.suno.com')
    call('Page.addScriptToEvaluateOnNewDocument', {'source': f"""
(function(){{
  var s=document.createElement('script');
  s.src={json.dumps(SCRIPT)};
  s.async=false;
  var go=function(){{if(!document.querySelector('script[src*="hcaptcha-endpoint"]')){{document.head.appendChild(s);}}}};
  if(document.readyState==='loading'){{document.addEventListener('DOMContentLoaded',go);}}else{{go();}}
}})();"""})
    call('Page.navigate', {'url': 'https://suno.com/'})
    ready = False
    for k in range(30):
        time.sleep(5)
        try:
            if ev("typeof hcaptcha === 'object' && typeof hcaptcha.render === 'function'", 20):
                ready = True
                break
        except Exception as e:
            log(f'poll err {e}')
        if k in (10, 20):
            ev(f"""(function(){{if(!document.querySelector('script[src*="hcaptcha-endpoint"]')){{var s=document.createElement('script');s.src={json.dumps(SCRIPT)};document.head.appendChild(s);}}}})(); 'reinject'""", 20)
            log('re-injected hcaptcha script')
    if not ready:
        raise RuntimeError('hcaptcha not ready after 150s')
    log('hcaptcha ready')
    token = None
    for att in range(2):
        token = ev("""
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(div);
    try {
      const id = hcaptcha.render(div, {
        sitekey: 'd65453de-3f1a-4aac-9366-a0f06e52b2ce',
        size: 'invisible', sentry: false,
        endpoint: 'https://hcaptcha-endpoint-prod.suno.com',
        assethost: 'https://hcaptcha-assets-prod.suno.com',
        imghost: 'https://hcaptcha-imgs-prod.suno.com',
        reportapi: 'https://hcaptcha-reportapi-prod.suno.com',
      });
      const r = await hcaptcha.execute(id, {async: true});
      if (r && r.response) return r.response;
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('challenge-expired') || attempt === 2) return 'ERR:' + msg;
    } finally {
      try { div.remove(); } catch (_) {}
    }
    await sleep(1500 * (attempt + 1));
  }
  return '';
})()
""", timeout=170, await_promise=True)
        if token and not str(token).startswith('ERR:') and token != '':
            break
        log(f'execute attempt {att+1}: {str(token)[:120]}')
        time.sleep(5)
    if not token or str(token).startswith('ERR:'):
        raise RuntimeError(f'captcha failed: {str(token)[:200]}')
    log(f'captcha token len={len(token)}')
finally:
    try:
        if ws: ws.close()
    except Exception: pass
    proc.terminate()
    try: proc.wait(timeout=5)
    except Exception: pass
    try: os.killpg(proc.pid, signal.SIGKILL)
    except Exception: pass
    try: subprocess.run(['rm', '-rf', profile], capture_output=True, timeout=30)
    except Exception: pass

client = SunoClient(state, proxy=proxy)
clips = generate_and_wait(
    client, title=title, tags=tags,
    lyrics=None, lyrics_file=None, describe=None,
    instrumental=True, negative_tags='', captcha_token=token, create_mode='custom',
    model=os.environ.get('SUNO_MODEL', 'chirp-auk-turbo'),
)
print('RESULT ' + json.dumps([{'id': c.get('id'), 'status': c.get('status'), 'title': c.get('title')} for c in clips], ensure_ascii=False), flush=True)
