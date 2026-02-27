import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlaylist, removeTrackFromPlaylist, deletePlaylist } from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import TrackRow from '../components/TrackRow';
import styles from './Playlist.module.css';

export default function Playlist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setCurrentTrack, setQueue } = usePlayerStore();
  const canDelete = user && playlist?.user_id === user.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getPlaylist(id);
        if (!cancelled) setPlaylist(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'שגיאה בטעינת הפלייליסט');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const playAll = () => {
    if (!playlist?.tracks?.length) return;
    setQueue(playlist.tracks);
    setCurrentTrack(playlist.tracks[0]);
    usePlayerStore.getState().setQueueIndex(0);
    usePlayerStore.getState().setIsPlaying(true);
  };

  const handleRemove = async (trackId) => {
    try {
      await removeTrackFromPlaylist(id, trackId);
      setPlaylist((p) => ({
        ...p,
        tracks: p.tracks.filter((t) => t.id !== trackId),
      }));
    } catch {
      // ignore
    }
  };

  const handleDeletePlaylist = async () => {
    if (!window.confirm(`למחוק את הפלייליסט "${playlist.name}"? השירים לא יימחקו.`)) return;
    try {
      await deletePlaylist(id);
      navigate('/library');
    } catch (err) {
      window.alert(err.message || 'מחיקה נכשלה');
    }
  };

  if (loading) return <div className={styles.page}><div className={styles.loading}>טוען...</div></div>;
  if (error || !playlist) return <div className={styles.page}><div className={styles.error}>{error || 'פלייליסט לא נמצא'}</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.artwork} />
        <div className={styles.meta}>
          <span className={styles.type}>פלייליסט</span>
          <h1 className={styles.title}>{playlist.name}</h1>
          <p className={styles.count}>{playlist.tracks?.length ?? 0} שירים</p>
          <div className={styles.headerActions}>
            <button type="button" className={styles.playAllBtn} onClick={playAll} disabled={!playlist.tracks?.length}>
              השמע
            </button>
            {canDelete && (
              <button type="button" className={styles.deleteBtn} onClick={handleDeletePlaylist}>מחק פלייליסט</button>
            )}
          </div>
        </div>
      </div>
      <div className={styles.trackList}>
        {playlist.tracks?.length === 0 ? (
          <p className={styles.empty}>אין שירים בפלייליסט</p>
        ) : (
          playlist.tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              showAlbum={true}
              playlistId={playlist.id}
              onRemoveFromPlaylist={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}
