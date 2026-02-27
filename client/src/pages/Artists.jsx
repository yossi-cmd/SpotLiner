import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getArtists, getImageUrl } from '../api';
import { useAuthStore } from '../store/authStore';
import styles from './Artists.module.css';

export default function Artists() {
  const canUpload = useAuthStore((s) => s.canUpload());
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getArtists({ limit: 100 })
      .then((r) => { if (!cancelled) setArtists(r.artists || []); })
      .catch(() => { if (!cancelled) setArtists([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className={styles.page}><div className={styles.loading}>טוען...</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.title}>אומנים</h1>
        {canUpload && (
          <Link to="/artists/new" className={styles.createBtn}>צור אומן חדש</Link>
        )}
      </div>
      <div className={styles.grid}>
        {artists.length === 0 ? (
          <p className={styles.empty}>אין אומנים עדיין</p>
        ) : (
          artists.map((a) => (
            <Link key={a.id} to={`/artist/${a.id}`} className={styles.card}>
              {a.image_path ? (
                <img src={getImageUrl(a.image_path)} alt="" className={styles.avatarImg} />
              ) : (
                <div className={styles.avatar}>{a.name.charAt(0).toUpperCase()}</div>
              )}
              <span className={styles.name}>{a.name}</span>
              <span className={styles.count}>{a.track_count || 0} שירים</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
