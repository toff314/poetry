/** 站点统一页脚：备案号 + 关于我们（跳 askfount.com） */
export default function SiteFooter() {
  return (
    <footer className="py-10 px-6 lg:px-10 border-t border-darkline bg-ink mt-16">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-xs text-silver/70">
          诗境 Poetry Realm · 沉浸式诗词 Web
          <span className="hidden sm:inline text-silver/40"> ｜ Powered by poetry-cli · doubao-cli AI 生图 · Vite + React</span>
        </p>
        <div className="flex items-center gap-4 text-xs">
          <a
            href="https://www.askfount.com/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-silver hover:text-gold transition-colors"
          >
            关于我们
          </a>
          <span className="text-silver/40">|</span>
          <a
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-silver/60 hover:text-gold transition-colors"
          >
            京ICP备2026033375号
          </a>
        </div>
      </div>
    </footer>
  );
}