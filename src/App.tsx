/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import LoginScreen from './components/LoginScreen';
import MainApp from './components/MainApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <MainApp user={user} />
    </ErrorBoundary>
  );
}
