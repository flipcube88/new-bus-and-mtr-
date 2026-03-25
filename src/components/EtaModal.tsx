import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { stationLookup } from '../constants';

interface EtaModalProps {
  data: any;
  onClose: () => void;
}

export default function EtaModal({ data, onClose }: EtaModalProps) {
  const [loading, setLoading] = useState(true);
  const [etas, setEtas] = useState<any>(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const fetchEta = async () => {
      setLoading(true);
      setError(false);
      try {
        if (data.type === 'mtr') {
          const res = await fetch(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${data.line}&sta=${data.station}`);
          const json = await res.json();
          if (json.status === 1 && json.data[`${data.line}-${data.station}`]) {
            setEtas(json.data[`${data.line}-${data.station}`]);
          } else {
            setEtas({});
          }
        } else if (data.type === 'kmb' || data.type === 'bus') {
          const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${data.stopId}/${data.route}/${data.serviceType || 1}`);
          const json = await res.json();
          const targetDir = data.bound === 'inbound' ? 'I' : data.bound === 'outbound' ? 'O' : data.bound;
          const validEtas = json?.data?.filter((e: any) => e.eta && (!targetDir || e.dir === targetDir)).sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
          const uniqueEtas = validEtas?.filter((e: any, i: number, arr: any[]) => i === 0 || e.eta !== arr[i-1].eta);
          setEtas((uniqueEtas || []).slice(0, 3));
        } else if (data.type === 'ctb') {
          const res = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${data.stopId}/${data.route}`);
          const json = await res.json();
          const targetDir = data.bound === 'inbound' ? 'I' : data.bound === 'outbound' ? 'O' : data.bound;
          const validEtas = json?.data?.filter((e: any) => e.eta && (!targetDir || e.dir === targetDir)).sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
          const uniqueEtas = validEtas?.filter((e: any, i: number, arr: any[]) => i === 0 || e.eta !== arr[i-1].eta);
          setEtas((uniqueEtas || []).slice(0, 3));
        } else if (data.type === 'stop') {
          const url = data.company === 'kmb' 
            ? `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${data.stopId}`
            : `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${data.stopId}`;
          const res = await fetch(url);
          const json = await res.json();
          const validEtas = json?.data?.filter((e: any) => e.eta).sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
          
          const grouped: Record<string, any[]> = {};
          validEtas?.forEach((e: any) => {
            const key = `${e.route}_${e.dest_tc}`;
            if (!grouped[key]) grouped[key] = [];
            if (grouped[key].length < 3) grouped[key].push(e);
          });
          setEtas({ isGrouped: true, groups: grouped });
        }
        setLastUpdated(new Date());
      } catch (e) {
        setError(true);
      }
      setLoading(false);
    };

    fetchEta();
    const interval = setInterval(fetchEta, 10000); // Auto refresh every 10s when open to minimize gap
    return () => clearInterval(interval);
  }, [data]);

  const headerBg = data.type === 'mtr' 
    ? `linear-gradient(135deg, ${data.color || '#3b82f6'}, #1e293b)`
    : data.type === 'ctb' || (data.type === 'stop' && data.company === 'ctb')
    ? 'linear-gradient(135deg, #f59e0b, #b45309)'
    : 'linear-gradient(135deg, #ef4444, #be123c)';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[3.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
        
        <div className="p-10 text-white relative transition-colors duration-500" style={{ background: headerBg }}>
          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/20 active:scale-90 transition-all"
          >
            <X className="w-6 h-6" strokeWidth={3} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-white/30 px-5 py-2 rounded-xl text-xs font-black tracking-widest uppercase">
              {data.type === 'mtr' ? data.lineName : data.type === 'stop' ? (data.company === 'kmb' ? '九巴 KMB' : '城巴 CTB') : `${data.type.toUpperCase()} ${data.route}`}
            </span>
            <span className="text-[9px] font-black bg-black/20 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})} 更新
            </span>
          </div>
          <h3 className="text-3xl font-black leading-tight mb-2">{data.stationName || data.stopName}</h3>
          {data.type === 'mtr' && (
            <p className="text-[10px] font-bold text-white/70 bg-black/10 inline-block px-3 py-1.5 rounded-lg">
              ⚠️ 港鐵開放數據 API 會有約 10-30 秒延遲，可能與月台顯示屏略有不同
            </p>
          )}
        </div>

        <div className="p-8 pb-12 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
          {loading && !etas ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between items-center p-7 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 mb-4 animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded-xl w-24"></div>
                  <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-xl w-16"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-center py-20 text-red-500 font-bold">載入失敗，請檢查網絡</p>
          ) : etas.isGrouped ? (
            <>
              {Object.keys(etas.groups).length > 0 ? (
                Object.entries(etas.groups).map(([key, routeEtas]: any) => (
                  <div key={key} className="mb-6">
                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 px-2">
                      {routeEtas[0].route} 往 {routeEtas[0].dest_tc}
                    </h4>
                    {routeEtas.map((t: any, i: number) => {
                      const diff = Math.max(0, Math.floor((new Date(t.eta).getTime() - Date.now()) / 60000));
                      return (
                        <div key={i} className="flex justify-between items-center p-5 bg-white dark:bg-slate-800 rounded-[2rem] mb-3 border border-gray-100 dark:border-slate-700 shadow-sm">
                          <div>
                            <div className="font-black text-gray-800 dark:text-gray-100 text-lg">
                              {new Date(t.eta).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </div>
                            {t.rmk_tc && (
                              <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                {t.rmk_tc}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-3xl" style={{ color: data.color || '#ef4444' }}>
                              {diff === 0 ? "到站" : diff}
                            </span>
                            {diff !== 0 && <span className="text-gray-400 text-xs font-black ml-1">分</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="text-center py-20 text-gray-400 font-bold">目前沒有班次數據</p>
              )}
            </>
          ) : data.type === 'mtr' ? (
            <>
              {['UP', 'DOWN'].map(dir => (
                etas[dir] && etas[dir].length > 0 && (
                  <div key={dir} className="mb-6">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color || '#3b82f6' }}></div>
                      <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        往 {etas[dir][0] ? (stationLookup[etas[dir][0].dest] || etas[dir][0].dest) : (dir === 'UP' ? '上行' : '下行')}方向
                      </h4>
                    </div>
                    {etas[dir].map((t: any, i: number) => {
                      const destName = stationLookup[t.dest] || t.dest;
                      return (
                        <div key={i} className="flex justify-between items-center p-5 bg-white dark:bg-slate-800 rounded-[2rem] mb-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                          <div>
                            <div className="font-black text-gray-800 dark:text-gray-100 text-lg">
                              {t.time.split(' ')[1].substring(0, 5)} 
                            </div>
                            <div className="text-gray-400 font-bold text-[10px] mt-0.5">
                              終點站: {destName} {t.plat ? `• 月台 ${t.plat}` : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-3xl" style={{ color: data.color || '#3b82f6' }}>
                              {t.ttnt == 0 ? "到站" : t.ttnt}
                            </span>
                            {t.ttnt != 0 && <span className="text-gray-400 text-xs font-black ml-1">分</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))}
              {(!etas.UP && !etas.DOWN) && (
                <p className="text-center py-20 text-gray-400 font-bold">目前沒有班次數據</p>
              )}
            </>
          ) : (
            <>
              {etas.length > 0 ? (
                etas.map((e: any, i: number) => {
                  const diff = Math.max(0, Math.floor((new Date(e.eta).getTime() - Date.now()) / 60000));
                  return (
                    <div key={i} className="flex justify-between items-center p-7 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 mb-4">
                      <div>
                        <div className="text-gray-800 dark:text-gray-100 font-black text-2xl">
                          {new Date(e.eta).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </div>
                        {e.rmk_tc && (
                          <div className="text-[10px] font-bold text-gray-400 mt-1">
                            {e.rmk_tc}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-red-500 font-black text-4xl">{diff === 0 ? "到站" : diff}</span>
                        <span className="text-red-400 text-xs font-black ml-1">{diff === 0 ? "" : "分"}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-20 text-gray-400 font-bold">目前沒有班次數據</p>
              )}
            </>
          )}
        </div>

        <div className="p-8 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
          <button 
            onClick={onClose} 
            className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-[2rem] font-black text-sm shadow-xl active:scale-95 transition-all"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
