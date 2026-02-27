import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getPlaylists, getFavorites, getHistory, createPlaylist } from '../api';
import { uniqueTracksById } from '../utils/tracks';
import { usePlayerStore } from '../store/playerStore';
import TrackRow from '../components/TrackRow';
import styles from './Library.module.css';

const TABS = [
  { id: 'playlists', label: 'פלייליסטים', path: '/library' },
  { id: 'favorites', label: 'אהובים', path: '/library/favorites' },
  { id: 'history', label: 'היסטוריה', path: '/library/history' },
];

export default function Library() {
  const location = useLocation();
  const [playlists, setPlaylists] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentTrack, setQueue } = usePlayerStore();
  const navigate = useNavigate();
  const tab = location.pathname === '/library/favorites' ? 'favorites' : location.pathname === '/library/history' ? 'history' : 'playlists';

  const handleCreatePlaylist = async () => {
    const name = window.prompt('שם הפלייליסט:');
    if (!name?.trim()) return;
    try {
      const pl = await createPlaylist(name.trim());
      navigate(`/playlist/${pl.id}`);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pl, fav, his] = await Promise.all([
          getPlaylists().catch(() => ({ playlists: [] })),
          getFavorites().catch(() => ({ tracks: [] })),
          getHistory().catch(() => ({ tracks: [] })),
        ]);
        if (!cancelled) {
          setPlaylists(pl.playlists || []);
          setFavorites(fav.tracks || []);
          setHistory(uniqueTracksById(his.tracks || []));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const playAll = (list) => {
    if (!list.length) return;
    setQueue(list);
    setCurrentTrack(list[0]);
    usePlayerStore.getState().setQueueIndex(0);
    usePlayerStore.getState().setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>טוען...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>הספרייה שלי</h1>
      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <NavLink key={t.id} to={t.path} className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)} end={t.path === '/library'}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.content}>
        {tab === 'playlists' && <LibraryPlaylists playlists={playlists} onCreatePlaylist={handleCreatePlaylist} />}
        {tab === 'favorites' && <LibraryFavorites tracks={favorites} playAll={playAll} />}
        {tab === 'history' && <LibraryHistory tracks={history} playAll={playAll} />}
      </div>
    </div>
  );
}

function LibraryPlaylists({ playlists, onCreatePlaylist }) {
  return (
    <section className={styles.section} data-tab="playlists">
      <div className={styles.sectionHead}>
        <h2>פלייליסטים</h2>
        <button type="button" className={styles.playAllBtn} onClick={onCreatePlaylist}>
          צור פלייליסט
        </button>
      </div>
      {playlists.length === 0 ? (
        <p className={styles.empty}>אין פלייליסטים. צור פלייליסט חדש מעמוד פלייליסט.</p>
      ) : (
        <div className={styles.playlistGrid}>
          {playlists.map((pl) => (
            <NavLink key={pl.id} to={`/playlist/${pl.id}`} className={styles.playlistCard}>
              <div className={styles.playlistArt} />
              <span className={styles.playlistName}>{pl.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </section>
  );
}

function LibraryFavorites({ tracks, playAll }) {
  return (
    <section className={styles.section} data-tab="favorites">
      <div className={styles.sectionHead}>
        <h2>שירים שאוהבים</h2>
        {tracks.length > 0 && (
          <button type="button" className={styles.playAllBtn} onClick={() => playAll(tracks)}>
            השמע הכול
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className={styles.empty}>אין שירים באהובים</p>
      ) : (
        <div className={styles.trackList}>
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} showAlbum={true} />
          ))}
        </div>
      )}
    </section>
  );
}

function LibraryHistory({ tracks, playAll }) {
  return (
    <section className={styles.section} data-tab="history">
      <div className={styles.sectionHead}>
        <h2>השמעה לאחרונה</h2>
        {tracks.length > 0 && (
          <button type="button" className={styles.playAllBtn} onClick={() => playAll(tracks)}>
            השמע הכול
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className={styles.empty}>אין היסטוריית השמעה</p>
      ) : (
        <div className={styles.trackList}>
          {tracks.map((track, i) => (
            <TrackRow key={`${track.id}-${i}`} track={track} index={i} showAlbum={true} />
          ))}
        </div>
      )}
    </section>
  );
}
