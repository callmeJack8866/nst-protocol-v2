import { useTranslation } from 'react-i18next';
import { useWalletContext } from '../context/WalletContext';

/**
 * FeedEngine 喂价平台跳转引导页
 *
 * 喂价功能已迁移到独立的 FeedEngine 开放平台
 * 本页面为跳转入口，引导用户前往 FeedEngine 前端
 */

// FeedEngine 前端 URL（可通过环境变量配置）
const FEED_ENGINE_URL = import.meta.env.VITE_FEED_ENGINE_URL || 'http://localhost:5173';

export function FeederPanel() {
  const { isConnected, connect } = useWalletContext();
  const { t } = useTranslation();

  /** 打开 FeedEngine 前端 */
  const openFeedEngine = () => {
    window.open(FEED_ENGINE_URL, '_blank', 'noopener,noreferrer');
  };

  if (!isConnected) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center p-12">
        <div className="obsidian-glass p-20 rounded-[64px] border-white/5 text-center relative overflow-hidden grid-bg max-w-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-premium-gold/5 blur-[100px] pointer-events-none" />
          <div className="w-24 h-24 rounded-[36px] bg-premium-gold/10 border border-premium-gold/20 mx-auto mb-10 flex items-center justify-center animate-pulse">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2.5">
              <path d="M2.27 19a10 10 0 0 1 0-14M5.66 17.34a6 6 0 0 1 0-10.68M12 12l0 1M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">{t('feeder.node_link_offline')}</h3>
          <p className="text-white/20 font-bold italic mb-12 max-w-sm mx-auto uppercase text-[10px] tracking-[0.3em] leading-relaxed">{t('feeder.authorize_credentials')}</p>
          <button onClick={() => connect()} className="btn-gold h-16 px-14 rounded-2xl text-[11px] tracking-widest italic font-black shadow-2xl">{t('points.establish_elite_link')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col pb-20 space-y-20">
      {/* Header */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-12">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">FEED ENGINE — 开放喂价平台</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight italic">
            {t('feeder.price')} <span className="text-emerald-500">Engine</span> Portal
          </h1>
          <p className="text-white/40 text-lg max-w-2xl font-bold leading-snug">
            喂价功能已迁移到独立的 FeedEngine 开放平台。FeedEngine 支持完整的 Commit-Reveal 共识、FEED 代币质押、NFT 执照体系和分级奖惩机制。
          </p>
        </div>
      </div>

      {/* 功能介绍卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { emoji: '🔐', label: 'Commit-Reveal 共识', desc: '两阶段密封提交，防止抄袭和操纵', color: 'text-blue-500' },
          { emoji: '🏆', label: 'FEED 代币激励', desc: '喂价即挖矿，70/10/10/10 分配', color: 'text-emerald-500' },
          { emoji: '🎖️', label: 'NFT 执照体系', desc: '铜/银/金/铂/钻五档执照', color: 'text-premium-gold' },
          { emoji: '⚖️', label: '分级奖惩', desc: '偏差检测 + 质押罚没机制', color: 'text-purple-400' },
        ].map((item, i) => (
          <div key={i} className="obsidian-glass p-10 rounded-[48px] group border-white/5 relative overflow-hidden grid-bg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-4xl mb-6">{item.emoji}</div>
            <p className={`text-[11px] font-black uppercase tracking-widest mb-2 italic ${item.color}`}>{item.label}</p>
            <p className="text-white/30 text-sm font-bold">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* 跳转按钮 */}
      <div className="obsidian-glass rounded-[64px] p-16 text-center relative overflow-hidden grid-bg border-emerald-500/20 bg-emerald-500/[0.03]">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-10">
          <div className="w-24 h-24 rounded-[36px] bg-emerald-500/10 border border-emerald-500/30 mx-auto flex items-center justify-center text-5xl shadow-xl">
            🚀
          </div>
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">
            进入 <span className="text-emerald-500">FeedEngine</span> 平台
          </h2>
          <p className="text-white/30 text-sm font-bold max-w-lg mx-auto">
            注册喂价员 → 质押 FEED 代币 → 抢单 → 提交价格 → 获取奖励
          </p>
          <button
            onClick={openFeedEngine}
            className="h-20 px-20 rounded-[32px] bg-emerald-600 text-white font-black text-[13px] tracking-[0.3em] uppercase italic shadow-2xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all duration-300 inline-flex items-center gap-4"
          >
            打开 FEED ENGINE
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </button>
          <p className="text-white/10 text-[10px] font-bold uppercase tracking-[0.3em]">
            {FEED_ENGINE_URL}
          </p>
        </div>
      </div>

      {/* 数据流说明 */}
      <div className="obsidian-glass rounded-[48px] p-12 border-white/5 grid-bg">
        <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.5em] mb-8 italic">NST × FeedEngine 数据流</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
          {[
            { step: '①', text: 'NST 买方发起喂价', icon: '📋' },
            { step: '→', text: '事件广播', icon: '📡' },
            { step: '②', text: 'FeedEngine 接收任务', icon: '⚡' },
            { step: '→', text: '共识回写', icon: '🔄' },
            { step: '③', text: 'NST 价格更新', icon: '✅' },
          ].map((item, i) => (
            <div key={i} className={`text-center ${item.step === '→' ? 'hidden md:block' : ''}`}>
              {item.step === '→' ? (
                <div className="text-white/10 text-3xl">→</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-3xl">{item.icon}</div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{item.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FeederPanel;
