import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Player from './Player';
import { useFavoritesStore } from '../store/favoritesStore';
import { useAuthStore } from '../store/authStore';
import styles from './Layout.module.css';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const clearFavorites = useFavoritesStore((s) => s.clear);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      clearFavorites();
    }
  }, [user, loadFavorites, clearFavorites]);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Player />
    </div>
  );
}
