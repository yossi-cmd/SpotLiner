import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArtist, uploadImage, getImageUrl } from '../api';
import styles from './CreateArtist.module.css';

export default function CreateArtist() {
  const [name, setName] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
    if (!name.trim()) {
      setError('נא להזין שם אומן');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const artist = await createArtist(name.trim(), imagePath || null);
      navigate(`/artist/${artist.id}`);
    } catch (err) {
      setError(err.message || 'יצירת אומן נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>צור אומן חדש</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.label}>
          תמונה ראשית
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
          שם האומן *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            placeholder="שם האומן"
            required
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)}>
            ביטול
          </button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'יוצר...' : 'צור אומן'}
          </button>
        </div>
      </form>
    </div>
  );
}
