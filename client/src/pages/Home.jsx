import { useState, useEffect } from 'react';
import { getTracks, getHistory, deleteTrack } from '../api';
import { uniqueTracksById } from '../utils/tracks';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import TrackRow from '../components/TrackRow';
import EditTrackModal from '../components/EditTrackModal';
import styles from './Home.module.css';

export default function Home() {
  const { user } = useAuthStore();
  const [tracks, setTracks] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackToEdit, setTrackToEdit] = useState(null);
  const { setCurrentTrack, setQueue, currentTrack } = usePlayerStore();
  const canEditTrack = (track) => user && (user.role === 'admin' || track.uploaded_by === user.id);

  const handleDeleteTrack = async (track) => {
    if (!window.confirm(`למחוק את השיר "${track.title}"? פעולה זו לא ניתנת לביטול.`)) return;
    try {
      await deleteTrack(track.id);
      setTracks((list) => list.filter((t) => t.id !== track.id));
      setRecent((list) => list.filter((t) => t.id !== track.id));
      if (currentTrack?.id === track.id) {
        setQueue([]);
        setCurrentTrack(null);
      }
    } catch (err) {
      window.alert(err.message || 'מחיקה נכשלה');
    }
  };

  const refreshTracks = () => {
    getTracks({ limit: 20 }).then((r) => setTracks(r.tracks || []));
    if (user) getHistory().then((h) => setRecent(uniqueTracksById(h.tracks || []).slice(0, 10)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tRes, hRes] = await Promise.all([
          getTracks({ limit: 20 }),
          user ? getHistory().catch(() => ({ tracks: [] })) : Promise.resolve({ tracks: [] }),
        ]);
        if (!cancelled) {
          setTracks(tRes.tracks || []);
          setRecent(uniqueTracksById(hRes.tracks || []).slice(0, 10));
        }
      } catch {
        if (!cancelled) setTracks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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
      <div className={styles.hero}>
        <h1>ברוך הבא לספוטליינר</h1>
        <p>האזן למוזיקה שמועלית על ידי הקהילה</p>
      </div>

      {user && recent.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>השמעה לאחרונה</h2>
            <button type="button" className={styles.playAllBtn} onClick={() => playAll(recent)}>
              השמע הכול
            </button>
          </div>
          <div className={styles.trackList}>
            {recent.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} showAlbum={true} canEditTrack={canEditTrack(track)} onEditTrack={setTrackToEdit} onDeleteTrack={handleDeleteTrack} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>מוזיקה אחרונה שהועלתה</h2>
          <button type="button" className={styles.playAllBtn} onClick={() => playAll(tracks)}>
            השמע הכול
          </button>
        </div>
        <div className={styles.trackList}>
          {tracks.length === 0 ? (
            <p className={styles.empty}>עדיין אין שירים. מנהל יכול להעלות מוזיקה.</p>
          ) : (
            tracks.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} showAlbum={true} canEditTrack={canEditTrack(track)} onEditTrack={setTrackToEdit} onDeleteTrack={handleDeleteTrack} />
            ))
          )}
        </div>
      </section>
      {trackToEdit && (
        <EditTrackModal
          track={trackToEdit}
          onClose={() => setTrackToEdit(null)}
          onSaved={() => { setTrackToEdit(null); refreshTracks(); }}
        />
      )}
    </div>
  );
}
