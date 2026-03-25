import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth, logout } from '../lib/firebase';
import { mtrConfig, stationLookup } from '../constants';
import { LogOut, Search, Star, ArrowRight, X, Loader2, MapPin, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import EtaModal from './EtaModal';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const APP_ID = 'default-app-id';
let globalKmbStopsCache: Record<string, string> | null = null;
let globalCtbStopsCache: Record<string, string> | null = null;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface MainAppProps {
  user: User;
}

export default function MainApp({ user }: MainAppProps) {
  const [mode, setMode] = useState<'kmb' | 'ctb' | 'mtr'>('kmb');
  const [darkMode, setDarkMode] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [routeInput, setRouteInput] = useState('');
  
  // Navigation State
  const [view, setView] = useState<'home' | 'directions' | 'stops' | 'nearby'>('home');
  const [directions, setDirections] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  
  // Loading State
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Modal State
  const [modalData, setModalData] = useState<any>(null);

  // Previews
  const [previews, setPreviews] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const path = `artifacts/${APP_ID}/users/${user.uid}/favorites`;
    const favRef = collection(db, path);
    const unsub = onSnapshot(favRef, (snapshot) => {
      const favs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setFavorites(favs.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsub();
  }, [user.uid]);

  // Fetch previews for favorites
  useEffect(() => {
    if (isEditMode || favorites.length === 0) return;
    
    const fetchPreviews = async () => {
      const newPreviews: Record<string, any[]> = {};
      for (const f of favorites) {
        try {
          if (f.type === 'mtr') {
            const res = await fetch(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${f.line}&sta=${f.station}`);
            const data = await res.json();
            const info = data.data[`${f.line}-${f.station}`];
            if (info) {
              const allTrains = [...(info.UP || []), ...(info.DOWN || [])].sort((a, b) => a.ttnt - b.ttnt).slice(0, 2);
              newPreviews[f.id] = allTrains.map(t => ({ dest: stationLookup[t.dest] || t.dest, time: t.ttnt }));
            }
          } else if (f.type === 'ctb') {
            const res = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${f.stopId}/${f.route}`);
            const data = await res.json();
            const targetDir = f.bound === 'inbound' ? 'I' : 'O';
            const etas = data?.data?.filter((e: any) => e.eta && e.dir === targetDir).sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime()).slice(0, 2);
            if (etas) {
              newPreviews[f.id] = etas.map((e: any) => {
                const diff = Math.max(0, Math.floor((new Date(e.eta).getTime() - Date.now()) / 60000));
                return { dest: `往 ${e.dest_tc.substring(0, 3)}`, time: diff };
              });
            }
          } else {
            const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${f.stopId}/${f.route}/${f.serviceType || 1}`);
            const data = await res.json();
            const etas = data?.data?.filter((e: any) => e.eta).sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime()).slice(0, 2);
            if (etas) {
              newPreviews[f.id] = etas.map((e: any) => {
                const diff = Math.max(0, Math.floor((new Date(e.eta).getTime() - Date.now()) / 60000));
                return { dest: `往 ${e.dest_tc.substring(0, 3)}`, time: diff };
              });
            }
          }
        } catch (e) {
          // Ignore preview fetch errors
        }
      }
      setPreviews(newPreviews);
    };

    fetchPreviews();
    const interval = setInterval(fetchPreviews, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [favorites, isEditMode]);

  const toggleFavorite = async (data: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const docId = data.type === 'mtr' ? `mtr_${data.line}_${data.station}` : `${data.type}_${data.route}_${data.stopId}`;
    const path = `artifacts/${APP_ID}/users/${user.uid}/favorites/${docId}`;
    try {
      const favDoc = doc(db, path);
      
      const isFav = favorites.some(f => f.id === docId);
      if (isFav) {
        await deleteDoc(favDoc);
        toast.info('已移除常用路線');
      } else {
        const maxOrder = favorites.length > 0 ? Math.max(...favorites.map(f => f.order || 0)) : 0;
        await setDoc(favDoc, { ...data, timestamp: Date.now(), order: maxOrder + 1 });
        toast.success('已加入常用路線');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const moveFavorite = async (id: string, direction: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const sorted = [...favorites];
    const index = sorted.findIndex(f => f.id === id);
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < sorted.length) {
      const temp = sorted[index];
      sorted[index] = sorted[newIndex];
      sorted[newIndex] = temp;
      
      const path = `artifacts/${APP_ID}/users/${user.uid}/favorites`;
      try {
        const batch = writeBatch(db);
        sorted.forEach((item, i) => {
          const ref = doc(db, path, item.id);
          batch.update(ref, { order: i });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const searchBusRoute = async () => {
    const input = routeInput.trim().toUpperCase();
    if (!input) return;
    
    setLoading(true);
    setStatusMsg(`搜尋 ${input} 號巴士...`);
    setView('home');
    
    try {
      if (mode === 'kmb') {
        const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route`);
        const data = await res.json();
        const matched = data?.data?.filter((r: any) => r.route === input);
        
        if (matched?.length) {
          const grouped: Record<string, any> = {};
          matched.forEach((r: any) => {
            const key = `${r.bound}_${r.dest_tc}`;
            if (!grouped[key] || r.service_type < grouped[key].service_type) {
              grouped[key] = r;
            }
          });
          setDirections(Object.values(grouped));
          setView('directions');
        } else {
          toast.error("搵唔到呢條線");
          setTimeout(() => setLoading(false), 500);
          return;
        }
      } else if (mode === 'ctb') {
        const res = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route/CTB`);
        const data = await res.json();
        const matched = data?.data?.filter((r: any) => r.route === input);
        
        if (matched?.length) {
          const r = matched[0];
          setDirections([
            { ...r, dir: 'outbound', dest_tc: `往 ${r.dest_tc}`, bound: 'outbound' },
            { ...r, dir: 'inbound', dest_tc: `往 ${r.orig_tc}`, bound: 'inbound' }
          ]);
          setView('directions');
        } else {
          toast.error("搵唔到呢條線");
          setTimeout(() => setLoading(false), 500);
          return;
        }
      }
    } catch (e) {
      toast.error("連線失敗，請重試");
      setTimeout(() => setLoading(false), 500);
      return;
    }
    setLoading(false);
  };

  const loadBusStops = async (route: any) => {
    setLoading(true);
    setStatusMsg("載入車站中...");
    setSelectedRoute(route);
    
    try {
      if (mode === 'kmb') {
        const dir = route.bound === 'O' ? 'outbound' : 'inbound';
        const routeStopsRes = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route.route}/${dir}/${route.service_type}`);
        if (!routeStopsRes.ok) throw new Error("Failed to fetch route stops");
        const routeStopsData = await routeStopsRes.json();
        
        if (!globalKmbStopsCache) {
          try {
            const stopsRes = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop`);
            if (stopsRes.ok) {
              const stopsData = await stopsRes.json();
              const map: Record<string, string> = {};
              stopsData?.data?.forEach((s: any) => map[s.stop] = s.name_tc);
              globalKmbStopsCache = map;
            }
          } catch (e) {
            console.warn("Failed to fetch all stops cache", e);
          }
        }
        
        const enrichedStops = await Promise.all((routeStopsData?.data || []).map(async (s: any) => {
          let name = globalKmbStopsCache ? globalKmbStopsCache[s.stop] : null;
          if (!name) {
            try {
              const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop/${s.stop}`);
              if (res.ok) {
                const d = await res.json();
                name = d?.data?.name_tc;
              }
            } catch (e) {
              // ignore
            }
          }
          return { ...s, name_tc: name || "未知車站" };
        }));
        
        setStops(enrichedStops);
        setView('stops');
      } else if (mode === 'ctb') {
        const routeStopsRes = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/${route.route}/${route.dir}`);
        const routeStopsData = await routeStopsRes.json();
        
        if (!globalCtbStopsCache) {
          try {
            const stopsRes = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/stop`);
            if (stopsRes.ok) {
              const stopsData = await stopsRes.json();
              const map: Record<string, string> = {};
              stopsData?.data?.forEach((s: any) => map[s.stop] = s.name_tc);
              globalCtbStopsCache = map;
            }
          } catch (e) {}
        }
        
        const enrichedStops = (routeStopsData?.data || []).map((s: any) => ({
          ...s,
          name_tc: globalCtbStopsCache ? globalCtbStopsCache[s.stop] : "未知車站"
        }));
        
        setStops(enrichedStops);
        setView('stops');
      }
    } catch (e) {
      console.error("loadBusStops error:", e);
      toast.error("載入失敗，請重試");
      setTimeout(() => setLoading(false), 500);
      return;
    }
    setLoading(false);
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findNearbyStops = () => {
    if (!navigator.geolocation) {
      toast.error("你的瀏覽器不支援定位功能");
      return;
    }
    setLoading(true);
    setStatusMsg("定位中...");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        setStatusMsg("搜尋附近車站...");
        const [kmbRes, ctbRes] = await Promise.all([
          fetch('https://data.etabus.gov.hk/v1/transport/kmb/stop'),
          fetch('https://rt.data.gov.hk/v2/transport/citybus/stop')
        ]);
        const kmbData = await kmbRes.json();
        const ctbData = await ctbRes.json();

        let allStops: any[] = [];

        kmbData?.data?.forEach((s: any) => {
          const dist = getDistance(latitude, longitude, parseFloat(s.lat), parseFloat(s.long));
          if (dist < 400) allStops.push({ ...s, company: 'kmb', dist, name_tc: s.name_tc, stopId: s.stop });
        });

        ctbData?.data?.forEach((s: any) => {
          const dist = getDistance(latitude, longitude, parseFloat(s.lat), parseFloat(s.long));
          if (dist < 400) allStops.push({ ...s, company: 'ctb', dist, name_tc: s.name_tc, stopId: s.stop });
        });

        allStops.sort((a, b) => a.dist - b.dist);
        
        const uniqueStops: any[] = [];
        const seen = new Set();
        for (const s of allStops) {
          const key = `${s.company}_${s.name_tc}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueStops.push(s);
          }
        }

        setNearbyStops(uniqueStops.slice(0, 20));
        setView('nearby');
      } catch (e) {
        toast.error("搜尋附近車站失敗");
      }
      setLoading(false);
    }, (err) => {
      toast.error("無法獲取位置，請確保已開啟定位權限");
      setLoading(false);
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const loadMtrStops = (lineCode: string) => {
    const line = mtrConfig.lines.find(l => l.code === lineCode);
    setSelectedLine(line);
    const lineStops = mtrConfig.stations[lineCode as keyof typeof mtrConfig.stations];
    setStops(lineStops.map(s => ({ stop: s.c, name_tc: s.n })));
    setView('stops');
  };

  const openEtaModal = (type: 'kmb' | 'ctb' | 'mtr' | 'stop', stopData: any) => {
    if (type === 'kmb' || type === 'ctb') {
      setModalData({
        type: type,
        route: selectedRoute?.route || stopData.route,
        stopId: stopData.stop || stopData.stopId,
        stopName: stopData.name_tc || stopData.stopName,
        serviceType: selectedRoute?.service_type || stopData.serviceType,
        bound: selectedRoute?.bound || stopData.bound
      });
    } else if (type === 'stop') {
      setModalData({
        type: 'stop',
        company: stopData.company,
        stopId: stopData.stopId,
        stopName: stopData.name_tc,
        color: stopData.company === 'kmb' ? '#ef4444' : '#f59e0b'
      });
    } else {
      setModalData({
        type: 'mtr',
        line: selectedLine?.code || stopData.line,
        lineName: selectedLine?.name || stopData.lineName,
        station: stopData.stop || stopData.station,
        stationName: stopData.name_tc || stopData.stationName,
        color: selectedLine?.color || mtrConfig.lines.find(l => l.code === stopData.line)?.color
      });
    }
  };

  return (
    <div className={cn("pb-24 min-h-screen transition-colors duration-300", darkMode ? "dark bg-slate-950" : "bg-slate-50")}>
      {/* Navbar */}
      <nav className="sticky top-0 z-[60] glass dark:bg-slate-900/60 shadow-sm px-6 py-5 flex justify-between items-center border-b border-white/40 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 p-2.5 rounded-2xl shadow-lg rotate-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-800 dark:text-white leading-none">HK<span className="text-red-500">.ETA</span></h1>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">V8.0 STABLE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-300 active:bg-gray-50 dark:active:bg-slate-700 transition-all"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {favorites.length > 0 && (
            <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              className={cn(
                "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm",
                isEditMode ? "bg-blue-500 border-blue-600 text-white shadow-blue-500/30" : "text-gray-500 dark:text-gray-400"
              )}
            >
              {isEditMode ? '完成排序' : '編輯排序'}
            </button>
          )}
          <button 
            onClick={logout}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-300 active:bg-gray-50 dark:active:bg-slate-700"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-md mx-auto p-5">
        {/* Mode Selector */}
        <div className="relative flex glass dark:bg-slate-900/60 p-1.5 rounded-[2rem] mb-10 shadow-lg border border-white/60 dark:border-slate-700">
          <button 
            onClick={() => { setMode('kmb'); setView('home'); }} 
            className={cn("relative z-10 flex-1 py-4 rounded-[1.5rem] font-black text-xs transition-all", mode === 'kmb' ? 'text-white' : 'text-gray-400 dark:text-gray-500')}
          >
            九巴 KMB
          </button>
          <button 
            onClick={() => { setMode('ctb'); setView('home'); }} 
            className={cn("relative z-10 flex-1 py-4 rounded-[1.5rem] font-black text-xs transition-all", mode === 'ctb' ? 'text-white' : 'text-gray-400 dark:text-gray-500')}
          >
            城巴 CTB
          </button>
          <button 
            onClick={() => { setMode('mtr'); setView('home'); }} 
            className={cn("relative z-10 flex-1 py-4 rounded-[1.5rem] font-black text-xs transition-all", mode === 'mtr' ? 'text-white' : 'text-gray-400 dark:text-gray-500')}
          >
            港鐵 MTR
          </button>
          <div 
            className="absolute top-1.5 bottom-1.5 w-[calc(33.33%-4px)] rounded-[1.5rem] transition-all duration-300 shadow-md"
            style={{ 
              left: mode === 'kmb' ? '6px' : mode === 'ctb' ? 'calc(33.33% + 2px)' : 'calc(66.66% - 2px)', 
              backgroundColor: mode === 'kmb' ? 'var(--color-kmb-red)' : mode === 'ctb' ? '#f59e0b' : 'var(--color-mtr-blue)' 
            }}
          />
        </div>

        {/* Favorites Section */}
        {view === 'home' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="flex justify-between items-center mb-5 px-3">
              <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">常用路線 ⭐</h2>
            </div>
            {favorites.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x relative min-h-[140px]">
                <AnimatePresence>
                  {favorites.map(f => {
                    const isMtr = f.type === 'mtr';
                    const displayTitle = isMtr ? f.lineName : f.route;
                    const cardColor = isMtr ? 'text-blue-500' : 'text-red-500';
                    
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        key={f.id}
                        onClick={() => !isEditMode && openEtaModal(f.type, f)}
                        className={cn(
                          "flex-shrink-0 w-44 bg-white p-5 rounded-[2.5rem] shadow-xl border border-white relative snap-start cursor-pointer flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1",
                          isEditMode ? "ring-4 ring-blue-100 h-[200px]" : "h-[155px]"
                        )}
                      >
                        {isEditMode && (
                          <button 
                            onClick={(e) => toggleFavorite(f, e)}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center font-black shadow-lg border-2 border-white z-10 hover:bg-red-600 active:scale-90 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div>
                          <div className={cn("font-black text-2xl tracking-tighter", cardColor)}>{displayTitle}</div>
                          <div className="text-gray-800 text-[10px] font-black truncate leading-tight mt-1">
                            {f.stationName || f.stopName}
                          </div>
                        </div>

                        {isEditMode ? (
                          <div className="flex gap-2 mt-4">
                            <button onClick={(e) => moveFavorite(f.id, -1, e)} className="flex-1 py-3 bg-slate-50 rounded-2xl border border-gray-100 text-lg active:bg-blue-500 active:text-white transition-all">⬅️</button>
                            <button onClick={(e) => moveFavorite(f.id, 1, e)} className="flex-1 py-3 bg-slate-50 rounded-2xl border border-gray-100 text-lg active:bg-blue-500 active:text-white transition-all">➡️</button>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            {previews[f.id] ? (
                              previews[f.id].length > 0 ? (
                                previews[f.id].map((p, i) => (
                                  <div key={i} className="flex justify-between text-[11px] font-black px-2 py-1 bg-gray-50 rounded-lg mb-1">
                                    <span className="truncate mr-2 text-gray-600">{p.dest}</span>
                                    <span className={isMtr ? "text-blue-500" : "text-red-500"}>{p.time}m</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] font-black text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">沒有班次</div>
                              )
                            ) : (
                              <div className="text-[9px] font-black text-gray-300 uppercase tracking-tighter loading-shimmer px-2 py-1">FETCHING...</div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="bg-white/40 border border-white/60 border-dashed rounded-[2.5rem] p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Star className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-gray-500 font-black text-sm">未有常用路線</p>
                <p className="text-gray-400 text-[10px] font-bold mt-1">搜尋路線並點擊星號加入</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Home Views */}
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {mode === 'kmb' || mode === 'ctb' ? (
                <div className="mb-12">
                  <div className="glass dark:bg-slate-900/60 rounded-[2.5rem] p-3 shadow-xl border border-white/60 dark:border-slate-700 flex items-center gap-3 h-20 box-border">
                    <input 
                      type="text" 
                      value={routeInput}
                      onChange={(e) => setRouteInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchBusRoute()}
                      placeholder="輸入路線 (e.g. 290)" 
                      className="flex-1 min-w-0 bg-transparent font-black text-xl text-gray-700 dark:text-white outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 px-3 uppercase"
                    />
                    <button 
                      onClick={findNearbyStops}
                      className="flex-shrink-0 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all hover:text-blue-500"
                    >
                      <MapPin className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={searchBusRoute}
                      className={cn(
                        "flex-shrink-0 text-white w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-lg active:scale-90 transition-all",
                        mode === 'kmb' ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-amber-500 to-orange-500"
                      )}
                    >
                      <Search className="w-6 h-6" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 mb-12">
                  <h2 className="text-[11px] text-gray-400 font-black px-4 uppercase tracking-[0.3em]">地鐵網絡 MTR</h2>
                  <div className="flex flex-col gap-3">
                    {mtrConfig.lines.map(l => (
                      <button 
                        key={l.code}
                        onClick={() => loadMtrStops(l.code)} 
                        className="bg-white p-4 rounded-[2rem] shadow-sm flex items-center gap-4 active:scale-95 transition-all border border-gray-100 hover:shadow-md"
                      >
                        <div 
                          className="w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-white font-black text-sm shadow-inner" 
                          style={{ backgroundColor: l.color }}
                        >
                          {l.code}
                        </div>
                        <div className="flex-1 text-left">
                          <span className="text-lg font-black text-gray-800 block">{l.name}</span>
                          <span className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">MTR Line</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Directions View (Bus Only) */}
          {!loading && view === 'directions' && (
            <motion.div 
              key="directions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 mb-12"
            >
              <div className="flex items-center justify-between px-4 mb-4">
                <h2 className="text-[11px] text-gray-400 font-black uppercase tracking-widest">請選擇方向</h2>
                <button onClick={() => setView('home')} className="text-xs font-black text-gray-500 bg-white px-3 py-1.5 rounded-lg shadow-sm">返回</button>
              </div>
              {directions.map((r, i) => (
                <button 
                  key={i}
                  onClick={() => loadBusStops(r)} 
                  className="w-full bg-white p-7 rounded-[2.5rem] shadow-lg flex justify-between items-center active:scale-95 group border border-white transition-all"
                >
                  <span className="text-gray-800 text-2xl font-black">{r.dest_tc}</span>
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-inner group-hover:bg-red-500 group-hover:text-white transition-all">
                    <ArrowRight className="w-6 h-6" strokeWidth={3} />
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* Stops View */}
          {!loading && view === 'stops' && (
            <motion.div 
              key="stops"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex justify-between items-center mb-8 px-3">
                <h2 className="font-black text-gray-900 dark:text-white text-2xl tracking-tight">
                  {mode === 'kmb' || mode === 'ctb' ? `${selectedRoute?.route} 往 ${selectedRoute?.dest_tc}` : selectedLine?.name}
                </h2>
                <button 
                  onClick={() => setView(mode === 'kmb' || mode === 'ctb' ? 'directions' : 'home')} 
                  className="bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-300 text-[10px] font-black uppercase px-5 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 active:bg-gray-50 dark:active:bg-slate-700"
                >
                  返回
                </button>
              </div>
              <div className="relative pl-6 space-y-6 text-left mt-4">
                {/* Timeline Line */}
                <div 
                  className="absolute left-[11px] top-8 bottom-8 w-1.5 rounded-full opacity-30"
                  style={{ backgroundColor: mode === 'mtr' ? selectedLine?.color : mode === 'ctb' ? '#f59e0b' : '#ef4444' }}
                />
                
                {stops.map((s, i) => {
                  const docId = mode === 'mtr' ? `mtr_${selectedLine?.code}_${s.stop}` : `${mode}_${selectedRoute?.route}_${s.stop}`;
                  const isFav = favorites.some(f => f.id === docId);
                  
                  const favData = mode === 'mtr' ? {
                    type: 'mtr', line: selectedLine?.code, station: s.stop, stationName: s.name_tc, lineName: selectedLine?.name
                  } : {
                    type: mode, route: selectedRoute?.route, stopId: s.stop, stopName: s.name_tc, bound: selectedRoute?.bound, serviceType: selectedRoute?.service_type
                  };

                  return (
                    <div key={i} className="relative bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-gray-100 dark:border-slate-700 ml-4 hover:shadow-md transition-all">
                      {/* Timeline Dot */}
                      <div 
                        className="absolute -left-[1.8rem] w-4 h-4 rounded-full border-4 border-slate-50 dark:border-slate-950 shadow-sm z-10"
                        style={{ backgroundColor: mode === 'mtr' ? selectedLine?.color : mode === 'ctb' ? '#f59e0b' : '#ef4444' }}
                      />
                      
                      <div className="flex-1 cursor-pointer" onClick={() => openEtaModal(mode, s)}>
                        <span className="font-black text-gray-800 dark:text-gray-100 text-xl">{s.name_tc}</span>
                        {mode === 'mtr' && (
                          <span className="block text-[10px] text-gray-400 font-bold mt-0.5">{s.stop}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => toggleFavorite(favData, e)} 
                          className={cn("active:scale-125 transition-all p-2", isFav ? 'text-yellow-400' : 'text-gray-200 hover:text-gray-300')}
                        >
                          <Star className="w-6 h-6" fill={isFav ? "currentColor" : "none"} strokeWidth={isFav ? 0 : 2} />
                        </button>
                        <button 
                          onClick={() => openEtaModal(mode, s)} 
                          className={cn(
                            "text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg active:scale-90 transition-all",
                            mode === 'kmb' ? 'bg-red-500 shadow-red-500/30' : mode === 'ctb' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-blue-500 shadow-blue-500/30'
                          )}
                          style={mode === 'mtr' ? { backgroundColor: selectedLine?.color, boxShadow: `0 10px 15px -3px ${selectedLine?.color}40` } : {}}
                        >
                          ETA
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Nearby View */}
          {!loading && view === 'nearby' && (
            <motion.div 
              key="nearby"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex justify-between items-center mb-8 px-3">
                <h2 className="font-black text-gray-900 dark:text-white text-2xl tracking-tight">
                  附近車站 (400米內)
                </h2>
                <button 
                  onClick={() => setView('home')} 
                  className="bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-300 text-[10px] font-black uppercase px-5 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 active:bg-gray-50 dark:active:bg-slate-700"
                >
                  返回
                </button>
              </div>
              <div className="space-y-4 text-left">
                {nearbyStops.length > 0 ? nearbyStops.map((s, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-[2.2rem] shadow-sm flex justify-between items-center border border-gray-100 dark:border-slate-700 mb-4 hover:shadow-md transition-all">
                    <div className="flex-1 cursor-pointer" onClick={() => openEtaModal('stop', s)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-md text-white",
                          s.company === 'kmb' ? "bg-red-500" : "bg-amber-500"
                        )}>
                          {s.company === 'kmb' ? '九巴' : '城巴'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">{Math.round(s.dist)}m</span>
                      </div>
                      <span className="font-black text-gray-800 dark:text-gray-100 text-xl">{s.name_tc}</span>
                    </div>
                    <button 
                      onClick={() => openEtaModal('stop', s)} 
                      className={cn(
                        "text-white px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg active:scale-90 transition-all",
                        s.company === 'kmb' ? 'bg-red-500 shadow-red-500/30' : 'bg-amber-500 shadow-amber-500/30'
                      )}
                    >
                      所有路線 ETA
                    </button>
                  </div>
                )) : (
                  <p className="text-center py-10 text-gray-400 font-bold">附近沒有找到車站</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="space-y-4 mb-12"
          >
            <div className="flex items-center justify-between px-4 mb-4">
              <h2 className="text-[11px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {statusMsg}
              </h2>
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full bg-white/60 p-7 rounded-[2.5rem] shadow-sm flex justify-between items-center border border-white/40 animate-pulse">
                <div className="h-8 bg-gray-200 rounded-xl w-1/3"></div>
                <div className="w-12 h-12 rounded-full bg-gray-200"></div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ETA Modal */}
      <AnimatePresence>
        {modalData && (
          <EtaModal 
            data={modalData} 
            onClose={() => setModalData(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
