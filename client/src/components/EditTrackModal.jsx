import { useState, useEffect } from 'react';
import { updateTrack, getArtists, getAlbums, uploadImage, getImageUrl } from '../api';
import styles from './EditTrackModal.module.css';

export default function EditTrackModal({ track, onClose, onSaved }) {
  const [title, setTitle] = useState(track?.title || '');
  const [artistId, setArtistId] = useState(track?.artist_id || '');
  const [albumId, setAlbumId] = useState(track?.album_id || '');
  const [featuredArtistIds, setFeaturedArtistIds] = useState([]);
  const [imagePath, setImagePath] = useState(undefined);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!track) return;
    setTitle(track.title);
    setArtistId(track.artist_id || '');
    setAlbumId(track.album_id || '');
    setFeaturedArtistIds(Array.isArray(track.featured_artists) ? track.featured_artists.map((a) => a.id) : []);
    setImagePath(undefined);
  }, [track]);

  useEffect(() => {
    getArtists({ limit: 500 }).then((r) => setArtists(r.artists || [])).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (artistId) {
      getAlbums({ limit: 500 }).then((r) => {
        const byArtist = (r.albums || []).filter((al) => al.artist_id === parseInt(artistId, 10));
        setAlbums(byArtist);
      }).catch(() => setAlbums([]));
    } else {
      setAlbums([]);
      setAlbumId('');
    }
  }, [artistId]);

  const onImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = await uploadImage(file);
      setImagePath(path);
    } catch {}
  };

  const displayImagePath = imagePath !== undefined ? imagePath : track?.image_path;
  const displayImageUrl = displayImagePath ? getImageUrl(displayImagePath) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('נא להזין כותרת');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateTrack(track.id, {
        title: title.trim(),
        artist_id: artistId ? parseInt(artistId, 10) : undefined,
        album_id: albumId ? parseInt(albumId, 10) : undefined,
        featured_artist_ids: featuredArtistIds,
        image_path: imagePath,
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'עדכון נכשל');
    } finally {
      setLoading(false);
    }
  };

  if (!track) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>עריכת שיר</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.label}>
            כותרת *
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} required />
          </label>
          <label className={styles.label}>
            אומן
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={styles.input}>
              <option value="">בחר אומן</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            אלבום
            <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} className={styles.input}>
              <option value="">ללא אלבום</option>
              {albums.map((al) => (
                <option key={al.id} value={al.id}>{al.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            אמנים משניים
            <select
              multiple
              size={4}
              value={featuredArtistIds.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => parseInt(o.value, 10));
                setFeaturedArtistIds(selected);
              }}
              className={styles.input}
            >
              {artists
                .filter((a) => a.id !== (artistId ? parseInt(artistId, 10) : null))
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
            <span className={styles.hint}>החזק Ctrl/Cmd לבחירה מרובה</span>
          </label>
          <label className={styles.label}>
            תמונת כיסוי
            <div className={styles.imageRow}>
              <input type="file" accept="image/*" onChange={onImageChange} className={styles.fileInput} />
              {(displayImageUrl || imagePath !== undefined) && (
                <div className={styles.previewWrap}>
                  {displayImageUrl && <img src={displayImageUrl} alt="" className={styles.preview} />}
                  {imagePath === null && <span className={styles.removedLabel}>תמונה הוסרה</span>}
                  {(displayImageUrl || (imagePath && imagePath !== null)) && (
                    <button type="button" className={styles.removeImg} onClick={() => setImagePath(null)}>הסר תמונה</button>
                  )}
                </div>
              )}
            </div>
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>ביטול</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'שומר...' : 'שמור'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
