import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAlbums, getImageUrl } from '../api';
import { useAuthStore } from '../store/authStore';
import styles from './Albums.module.css';

export default function Albums() {
  const canUpload = useAuthStore((s) => s.canUpload());
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAlbums({ limit: 100 })
      .then((r) => { if (!cancelled) setAlbums(r.albums || []); })
      .catch(() => { if (!cancelled) setAlbums([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className={styles.page}><div className={styles.loading}>טוען...</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.title}>אלבומים</h1>
        {canUpload && (
          <Link to="/albums/new" className={styles.createBtn}>צור אלבום חדש</Link>
        )}
      </div>
      <div className={styles.grid}>
        {albums.length === 0 ? (
          <p className={styles.empty}>אין אלבומים עדיין</p>
        ) : (
          albums.map((al) => (
            <Link key={al.id} to={`/album/${al.id}`} className={styles.card}>
              {(al.image_path || al.artist_image_path) ? (
                <img src={getImageUrl(al.image_path || al.artist_image_path)} alt="" className={styles.coverImg} />
              ) : (
                <div className={styles.cover} />
              )}
              <span className={styles.name}>{al.name}</span>
              <span className={styles.artist}>{al.artist_name}</span>
              <span className={styles.count}>{al.track_count || 0} שירים</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
