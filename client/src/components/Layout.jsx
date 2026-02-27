import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Player from './Player';
import MobileNav from './MobileNav';
import { useFavoritesStore } from '../store/favoritesStore';
import { useAuthStore } from '../store/authStore';
import { getConfig, savePushSubscription } from '../api';
import { IconMenu } from './Icons';
import styles from './Layout.module.css';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const clearFavorites = useFavoritesStore((s) => s.clear);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      clearFavorites();
    }
  }, [user, loadFavorites, clearFavorites]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // PoC: Register for push when user is logged in (new track by favorited artist). Can remove later.
  useEffect(() => {
    if (!user || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!config?.vapidPublicKey || cancelled) return;
        if (Notification.permission === 'denied') return;
        let permission = Notification.permission;
        if (permission === 'default') permission = await Notification.requestPermission();
        if (permission !== 'granted' || cancelled) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub && !cancelled) {
          await savePushSubscription(sub.toJSON());
          return;
        }
        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
        });
        if (!cancelled) await savePushSubscription(newSub.toJSON());
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className={styles.layout}>
      <header className={styles.mobileHeader}>
        <button type="button" className={styles.menuBtn} onClick={() => setSidebarOpen(true)} aria-label="פתח תפריט">
          <IconMenu size={24} />
        </button>
        <span className={styles.mobileLogo}>ספוטליינר</span>
      </header>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <MobileNav />
      <Player />
    </div>
  );
}
