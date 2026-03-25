import { useState } from 'react';
import { loginWithGoogle } from '../lib/firebase';
import { Bus, Train, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('登入已取消');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('請在 Firebase Console 啟用 Google 登入');
      } else {
        setError(`登入失敗: ${err.message || err.code || '未知錯誤'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

      <div className="glass w-full max-w-md p-10 rounded-[3rem] shadow-2xl border border-white/60 relative z-10 text-center">
        <div className="flex justify-center gap-4 mb-8">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 p-4 rounded-3xl shadow-lg rotate-[-6deg]">
            <Bus className="w-10 h-10 text-white" />
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-3xl shadow-lg rotate-[6deg]">
            <Train className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-gray-800 mb-2">
          HK<span className="text-red-500">.ETA</span>
        </h1>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-10">
          香仔交通報時器 V8.0
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 flex items-center gap-3 text-sm font-bold text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              使用 Google 登入
            </>
          )}
        </button>

        <p className="mt-8 text-xs text-gray-400 font-bold">
          登入即代表您同意同步您的收藏路線至雲端
        </p>
      </div>
    </div>
  );
}
