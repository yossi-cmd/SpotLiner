import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAlbum, getArtists, uploadImage, getImageUrl } from '../api';
import styles from './CreateAlbum.module.css';

export default function CreateAlbum() {
  const [name, setName] = useState('');
  const [artistId, setArtistId] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getArtists({ limit: 500 })
      .then((r) => setArtists(r.artists || []))
      .catch(() => setArtists([]));
  }, []);

  const onImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setError('');
    try {
      const path = await uploadImage(file);
      setImagePath(path);
    } catch (err) {
      setError(err.message || 'העלאת תמונה נכשלה');
      setImagePath('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !artistId) {
      setError('נא להזין שם אלבום ולבחור אומן');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const album = await createAlbum(name.trim(), parseInt(artistId, 10), imagePath || null);
      navigate(`/album/${album.id}`);
    } catch (err) {
      setError(err.message || 'יצירת אלבום נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>צור אלבום חדש</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.label}>
          תמונת עטיפה
          <div className={styles.imageRow}>
            <input type="file" accept="image/*" onChange={onImageChange} className={styles.fileInput} />
            {(imagePath || imageFile) && (
              <div className={styles.previewWrap}>
                <img src={imagePath ? getImageUrl(imagePath) : (imageFile ? URL.createObjectURL(imageFile) : '')} alt="" className={styles.preview} />
                <button type="button" className={styles.removeImg} onClick={() => { setImagePath(''); setImageFile(null); }}>הסר</button>
              </div>
            )}
          </div>
        </label>
        <label className={styles.label}>
          אומן *
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className={styles.input}
            required
          >
            <option value="">בחר אומן</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          שם האלבום *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            placeholder="שם האלבום"
            required
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)}>
            ביטול
          </button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'יוצר...' : 'צור אלבום'}
          </button>
        </div>
      </form>
    </div>
  );
}
