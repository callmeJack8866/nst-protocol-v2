import { useState, useEffect } from 'react';
import { useWallet, useFeedProtocol } from '../hooks';

export function FeederPanel() {
  const { isConnected, account, connect } = useWallet();
  const { getFeederInfo } = useFeedProtocol();
  const [feederInfo, setFeederInfo] = useState<any>(null);

  useEffect(() => {
    if (isConnected && account) {
      const loadInfo = async () => {
        try {
          const info = await getFeederInfo();
          setFeederInfo(info);
        } catch (e) { console.error(e); }
      };
      loadInfo();
    }
  }, [isConnected, account, getFeederInfo]);

  const mockRequests = [
    { requestId: 1, underlyingName: 'XAU/USD Spot', underlyingCode: 'XAU', feedType: 'Settlement', status: 'Pending', timeLeft: '42:15', reward: '5.20 USDT' },
    { requestId: 2, underlyingName: 'AAPL/USD Equity', underlyingCode: 'AAPL', feedType: 'Reference', status: 'Pending', timeLeft: '11:05', reward: '3.10 USDT' },
  ];

  if (!isConnected) {
    return (
      <div className="max-w-[1240px] mx-auto px-10 py-40 text-center animate-elite-entry">
        <div className="glass-surface p-28 rounded-[56px] border-dashed border-white/10 flex flex-col items-center">
          <div className="text-8xl mb-14 opacity-10">📡</div>
          <h3 className="text-2xl font-bold text-white mb-6 italic tracking-tighter uppercase">终端离线 Station Offline</h3>
          <p className="text-slate-500 text-lg mb-12 max-w-sm font-medium leading-relaxed">连接您的 Web3 身份以访问去中心化喂价工作台与协议共识网络。</p>
          <button onClick={() => connect()} className="btn-elite-primary px-16 h-16 shadow-2xl">授权连接终端</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pt-16 pb-20 w-full animate-elite-entry">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 mb-24">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_#3b82f6]" />
            <span className="text-label text-blue-400">去中心化预言机节点集群</span>
          </div>
          <h1 className="text-6xl font-extrabold text-white tracking-tighter italic">数据终端 <span className="text-blue-500">Feeder</span></h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
            实时验证并上报全球资产的市场价格信号，确保协议在清算与交割时的公平性与准确性。
          </p>
        </div>

        {feederInfo?.isRegistered ? (
          <div className="bg-blue-500/5 border border-blue-500/15 px-8 py-4 rounded-[28px] flex items-center space-x-5 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_#3b82f6]" />
            <span className="text-[12px] font-black text-blue-400 uppercase tracking-[0.2em]">预言机节点状态: 运行中</span>
          </div>
        ) : (
          <button className="btn-elite-primary bg-blue-600 hover:bg-blue-500 shadow-blue-600/20 h-20 px-12 rounded-[32px] text-xs tracking-widest"> 申请成为喂价节点 </button>
        )}
      </div>

      <div className="space-y-24">
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: '累计数据上报', value: '1,429', color: 'text-white' },
            { label: '全网同步延迟', value: '0.8s', color: 'text-blue-500' },
            { label: '节点激励上限', value: '$840', color: 'text-emerald-400' },
            { label: '系统在线时长', value: '99.9%', color: 'text-white' },
          ].map((stat, i) => (
            <div key={i} className="glass-surface p-8 rounded-[40px] group relative overflow-hidden transition-all hover:bg-white/[0.04]">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <p className="text-label mb-4 opacity-50 uppercase">{stat.label}</p>
              <p className={`text-3xl font-bold tracking-tighter italic ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Technical Data Stream */}
        <div className="space-y-12">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] italic mb-2">待处理数据请求流 ({mockRequests.length})</h2>
            <button className="text-[11px] font-bold text-blue-500 uppercase tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-blue-500/20">强制同步节点数据</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {mockRequests.map((req) => (
              <div key={req.requestId} className="group glass-surface p-10 rounded-[56px] relative overflow-hidden border-white/[0.03]">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">
                  <div className="flex items-center space-x-8">
                    <div className="w-20 h-20 rounded-[32px] bg-slate-950 border border-white/5 flex items-center justify-center text-5xl shadow-inner group-hover:scale-110 transition-transform duration-1000">📡</div>
                    <div>
                      <div className="flex items-center space-x-5 mb-3">
                        <h3 className="text-2xl font-bold text-white italic tracking-tighter">{req.underlyingName}</h3>
                        <p className="text-[10px] font-black text-blue-400 bg-blue-400/5 px-3 py-1 rounded-full tracking-widest border border-blue-400/10 uppercase">{req.feedType === 'Settlement' ? '结算喂价' : '实时参考'}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">请求标识 ID-0x{req.requestId}01 · 安全等级: 机构级</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-16 flex-1 border-l border-white/5 pl-16">
                    <div className="text-right">
                      <p className="text-label mb-2">节点激励奖励</p>
                      <p className="text-2xl font-bold text-emerald-400 italic tracking-tighter">{req.reward}</p>
                    </div>
                    <div className="text-right border-l border-white/5 pl-16">
                      <p className="text-label mb-2">数据存活时间</p>
                      <p className="text-2xl font-bold text-white italic tracking-tighter">{req.timeLeft}</p>
                    </div>
                    <div className="flex items-center justify-end space-x-8 pl-16">
                      <button className="text-slate-600 hover:text-white text-[12px] font-black uppercase transition-all tracking-[0.3em]">忽略</button>
                      <button className="bg-blue-600 hover:bg-blue-500 text-slate-950 px-10 h-16 rounded-[24px] font-black text-[12px] shadow-2xl shadow-blue-600/20 tracking-widest">提交价格信号</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-32" />
    </div>
  );
}
