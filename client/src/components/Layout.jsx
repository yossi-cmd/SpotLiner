import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Player from './Player';
import MobileNav from './MobileNav';
import { useFavoritesStore } from '../store/favoritesStore';
import { useAuthStore } from '../store/authStore';
import { IconMenu } from './Icons';
import styles from './Layout.module.css';

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
