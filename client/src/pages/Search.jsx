import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { search } from '../api';
import { usePlayerStore } from '../store/playerStore';
import TrackRow from '../components/TrackRow';
import { IconSearch } from '../components/Icons';
import styles from './Search.module.css';

export default function Search() {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setCurrentTrack, setQueue } = usePlayerStore();

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setTracks([]);
      setArtists([]);
      setAlbums([]);
      return;
    }
    setLoading(true);
    try {
      const res = await search(q);
      setTracks(res.tracks || []);
      setArtists(res.artists || []);
      setAlbums(res.albums || []);
    } catch {
      setTracks([]);
      setArtists([]);
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') doSearch();
  };

  const playAll = () => {
    if (!tracks.length) return;
    setQueue(tracks);
    setCurrentTrack(tracks[0]);
    usePlayerStore.getState().setQueueIndex(0);
    usePlayerStore.getState().setIsPlaying(true);
  };

  const hasResults = tracks.length > 0 || artists.length > 0 || albums.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}><IconSearch size={22} /></span>
        <input
          type="search"
          placeholder="חיפוש שירים, אומנים, אלבומים..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className={styles.input}
        />
        <button type="button" className={styles.searchBtn} onClick={doSearch}>
          חפש
        </button>
      </div>

      {loading && <div className={styles.loading}>טוען...</div>}

      {!loading && hasResults && (
        <>
          {artists.length > 0 && (
            <section className={styles.section}>
              <h2>אומנים</h2>
              <div className={styles.cardList}>
                {artists.map((a) => (
                  <Link key={a.id} to={`/artist/${a.id}`} className={styles.card}>
                    <div className={styles.cardAvatar}>{a.name?.charAt(0).toUpperCase()}</div>
                    <span className={styles.cardTitle}>{a.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {albums.length > 0 && (
            <section className={styles.section}>
              <h2>אלבומים</h2>
              <div className={styles.cardList}>
                {albums.map((al) => (
                  <Link key={al.id} to={`/album/${al.id}`} className={styles.card}>
                    <div className={styles.cardCover} />
                    <span className={styles.cardTitle}>{al.name}</span>
                    <span className={styles.cardSub}>{al.artist_name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tracks.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>שירים</h2>
                <button type="button" className={styles.playAllBtn} onClick={playAll}>
                  השמע הכול
                </button>
              </div>
              <div className={styles.trackList}>
                {tracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} showAlbum={true} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {!loading && query.trim() && !hasResults && (
        <p className={styles.empty}>לא נמצאו תוצאות</p>
      )}
    </div>
  );
}
