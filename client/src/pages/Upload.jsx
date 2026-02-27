import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { uploadTrack, getArtists, getAlbums, uploadImage, getImageUrl, createAlbum, fetchYouTubePlaylist, uploadYouTubeThumbnail, downloadTrackFromYouTube } from '../api';
import styles from './Upload.module.css';

const MODE_SINGLE = 'single';
const MODE_ALBUM = 'album';
const NEW_ALBUM_VALUE = '__new__';

function getTitleFromFileName(name) {
  if (!name) return '';
  const base = name.replace(/\.[^/.]+$/, '').trim();
  return base || name;
}

function getDurationFromFile(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(Math.round(audio.duration) || 0);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

export default function Upload() {
  const [mode, setMode] = useState(MODE_SINGLE);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artistId, setArtistId] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [duration, setDuration] = useState(0);
  const [albumRows, setAlbumRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [downloadYoutubeLoading, setDownloadYoutubeLoading] = useState(false);
  const [downloadYoutubeProgress, setDownloadYoutubeProgress] = useState('');

  useEffect(() => {
    getArtists({ limit: 500 }).then((r) => setArtists(r.artists || [])).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (artistId) {
      getAlbums({ limit: 500 }).then((r) => {
        const byArtist = (r.albums || []).filter((al) => al.artist_id === parseInt(artistId, 10));
        setAlbums(byArtist);
        if (albumId !== NEW_ALBUM_VALUE) setAlbumId('');
      }).catch(() => setAlbums([]));
    } else {
      setAlbums([]);
      setAlbumId('');
    }
  }, [artistId]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError('');
    if (f) {
      setTitle(getTitleFromFileName(f.name));
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        setDuration(Math.round(audio.duration));
      };
      audio.src = URL.createObjectURL(f);
    } else {
      setTitle('');
      setDuration(0);
    }
  };

  const onAlbumFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setError('');
    setAlbumRows((prev) => {
      const emptyIndices = prev.map((r, i) => (r.file ? null : i)).filter((i) => i !== null);
      const next = prev.map((r) => ({ ...r }));
      files.forEach((f, i) => {
        if (emptyIndices[i] !== undefined) {
          next[emptyIndices[i]] = { ...next[emptyIndices[i]], file: f };
        } else {
          next.push({ file: f, title: getTitleFromFileName(f.name) });
        }
      });
      return next.length ? next : files.map((f) => ({ file: f, title: getTitleFromFileName(f.name) }));
    });
    e.target.value = '';
  };

  const rowsWithVideoId = albumRows.filter((r) => r.videoId && !r.file);
  const canDownloadYoutube = rowsWithVideoId.length > 0 && artistId;

  const downloadYouTubeTracks = async () => {
    if (!artistId) {
      setError('נא לבחור אומן');
      return;
    }
    if (rowsWithVideoId.length === 0) {
      setError('אין שירים להוריד (טען פלייליסט YouTube קודם)');
      return;
    }
    const useNewAlbum = albumId === NEW_ALBUM_VALUE;
    if (useNewAlbum && !newAlbumName?.trim()) {
      setError('נא להזין שם לאלבום החדש');
      return;
    }
    setDownloadYoutubeLoading(true);
    setError('');
    setSuccess(false);
    try {
      let resolvedAlbumId = null;
      if (useNewAlbum) {
        const created = await createAlbum(newAlbumName.trim(), parseInt(artistId, 10), imagePath || undefined);
        resolvedAlbumId = created.id;
      } else if (albumId) {
        resolvedAlbumId = parseInt(albumId, 10);
      }
      const aid = parseInt(artistId, 10);
      const trackImagePath = useNewAlbum ? undefined : (imagePath || undefined);
      for (let i = 0; i < rowsWithVideoId.length; i++) {
        setDownloadYoutubeProgress(`מוריד ${i + 1}/${rowsWithVideoId.length}...`);
        await downloadTrackFromYouTube({
          videoId: rowsWithVideoId[i].videoId,
          title: rowsWithVideoId[i].title || '—',
          artist_id: aid,
          album_id: resolvedAlbumId || undefined,
          image_path: trackImagePath,
        });
      }
      setUploadedCount(rowsWithVideoId.length);
      setSuccess(true);
      setDownloadYoutubeProgress('');
      setAlbumRows([]);
      setArtistId('');
      setAlbumId('');
      setNewAlbumName('');
      setImagePath('');
      setImageFile(null);
    } catch (err) {
      setError(err.message || 'הורדה נכשלה');
      setDownloadYoutubeProgress('');
    } finally {
      setDownloadYoutubeLoading(false);
    }
  };

  const loadYouTubePlaylist = async () => {
    const url = youtubePlaylistUrl.trim();
    if (!url) {
      setError('הדבק קישור לפלייליסט YouTube');
      return;
    }
    setYoutubeLoading(true);
    setError('');
    try {
      const data = await fetchYouTubePlaylist(url);
      setAlbumId(NEW_ALBUM_VALUE);
      setNewAlbumName(data.title || 'אלבום');
      if (data.thumbnailUrl) {
        try {
          const path = await uploadYouTubeThumbnail(data.thumbnailUrl);
          setImagePath(path);
          setImageFile(null);
        } catch {
          // keep imagePath empty if thumbnail upload fails
        }
      }
      setAlbumRows((data.items || []).map((it) => ({ file: null, title: it.title || '—', videoId: it.videoId || null })));
    } catch (err) {
      setError(err.message || 'טעינת הפלייליסט נכשלה');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const setAlbumRowTitle = (index, title) => {
    setAlbumRows((prev) => prev.map((r, i) => (i === index ? { ...r, title } : r)));
  };

  const removeAlbumRow = (index) => {
    setAlbumRows((prev) => prev.filter((_, i) => i !== index));
  };

  const onImageChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try {
      const path = await uploadImage(f);
      setImagePath(path);
      setImageFile(f);
    } catch (err) {
      setError(err.message || 'העלאת תמונה נכשלה');
      setImagePath('');
      setImageFile(null);
    }
  };

  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      setError('נא לבחור קובץ ולהזין כותרת');
      return;
    }
    if (!artistId) {
      setError('נא לבחור אומן');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await uploadTrack(file, {
        title: title.trim(),
        artist_id: parseInt(artistId, 10),
        album_id: albumId ? parseInt(albumId, 10) : undefined,
        duration_seconds: duration,
        image_path: imagePath || undefined,
      });
      setSuccess(true);
      setFile(null);
      setTitle('');
      setArtistId('');
      setAlbumId('');
      setImagePath('');
      setImageFile(null);
      setDuration(0);
      e.target.reset();
    } catch (err) {
      setError(err.message || 'העלאה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAlbum = async (e) => {
    e.preventDefault();
    if (!artistId) {
      setError('נא לבחור אומן');
      return;
    }
    if (albumRows.length === 0) {
      setError('נא לבחור קבצי אודיו');
      return;
    }
    const useNewAlbum = albumId === NEW_ALBUM_VALUE;
    if (useNewAlbum && !newAlbumName?.trim()) {
      setError('נא להזין שם לאלבום החדש');
      return;
    }
    const rowsWithFile = albumRows.filter((r) => r.file);
    if (rowsWithFile.length === 0) {
      setError('נא להוסיף קובץ אודיו לכל שיר (או לבחור קבצים)');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      let resolvedAlbumId = null;
      if (useNewAlbum) {
        const created = await createAlbum(newAlbumName.trim(), parseInt(artistId, 10), imagePath || undefined);
        resolvedAlbumId = created.id;
      } else if (albumId) {
        resolvedAlbumId = parseInt(albumId, 10);
      }
      const aid = parseInt(artistId, 10);
      const trackImagePath = useNewAlbum ? undefined : (imagePath || undefined);
      for (let i = 0; i < rowsWithFile.length; i++) {
        const row = rowsWithFile[i];
        const durationSec = await getDurationFromFile(row.file);
        await uploadTrack(row.file, {
          title: (row.title || getTitleFromFileName(row.file.name) || 'ללא כותרת').trim(),
          artist_id: aid,
          album_id: resolvedAlbumId || undefined,
          duration_seconds: durationSec,
          image_path: trackImagePath,
        });
      }
      setUploadedCount(rowsWithFile.length);
      setSuccess(true);
      setAlbumRows([]);
      setArtistId('');
      setAlbumId('');
      setNewAlbumName('');
      setImagePath('');
      setImageFile(null);
    } catch (err) {
      setError(err.message || 'העלאה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === MODE_ALBUM ? handleSubmitAlbum : handleSubmitSingle;
  const isAlbum = mode === MODE_ALBUM;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>העלאת שיר</h1>
      <div className={styles.modeToggle}>
        <button
          type="button"
          className={mode === MODE_SINGLE ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => setMode(MODE_SINGLE)}
        >
          שיר בודד
        </button>
        <button
          type="button"
          className={mode === MODE_ALBUM ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => setMode(MODE_ALBUM)}
        >
          העלאה כאלבום
        </button>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        {success && (
          <div className={styles.success}>
            {isAlbum ? `הועלו ${uploadedCount} שירים בהצלחה.` : 'השיר הועלה בהצלחה.'}
          </div>
        )}
        {artists.length === 0 && !loading && (
          <p className={styles.hint}>
            אין עדיין אומנים. <Link to="/artists/new">צור אומן חדש</Link> ואז חזור להעלות שיר.
          </p>
        )}

        {isAlbum ? (
          <>
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
              אלבום
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className={styles.input}
                disabled={!artistId}
              >
                <option value="">ללא אלבום</option>
                {albums.map((al) => (
                  <option key={al.id} value={al.id}>{al.name}</option>
                ))}
                <option value={NEW_ALBUM_VALUE}>+ אלבום חדש</option>
              </select>
            </label>
            {albumId === NEW_ALBUM_VALUE && (
              <label className={styles.label}>
                שם האלבום החדש *
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  className={styles.input}
                  placeholder="שם האלבום"
                />
              </label>
            )}
            <div className={styles.advancedSection}>
              <div className={styles.advancedHead}>מצב מתקדם: ייבוא מפלייליסט YouTube</div>
              <div className={styles.youtubeRow}>
                <input
                  type="text"
                  value={youtubePlaylistUrl}
                  onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
                  className={styles.input}
                  placeholder="קישור לפלייליסט YouTube (למשל https://www.youtube.com/playlist?list=...)"
                  dir="ltr"
                />
                <button
                  type="button"
                  className={styles.youtubeBtn}
                  onClick={loadYouTubePlaylist}
                  disabled={youtubeLoading}
                >
                  {youtubeLoading ? 'טוען...' : 'טען פלייליסט'}
                </button>
              </div>
              <p className={styles.advancedHint}>
                שם הפלייליסט יהפוך לשם האלבום, התמונה לתמונת האלבום, והסרטונים לרשימת שירים. בחר אומן ואז הורד אודיו מיוטיוב או הוסף קבצים ידנית.
              </p>
              {canDownloadYoutube && (
                <button
                  type="button"
                  className={styles.youtubeDownloadBtn}
                  onClick={downloadYouTubeTracks}
                  disabled={downloadYoutubeLoading}
                >
                  {downloadYoutubeLoading ? downloadYoutubeProgress || 'מוריד...' : `הורד אודיו מיוטיוב (${rowsWithVideoId.length} שירים)`}
                </button>
              )}
            </div>
            <label className={styles.label}>
              תמונת כיסוי
              <div className={styles.imageRow}>
                <input type="file" accept="image/*" onChange={onImageChange} className={styles.fileInput} />
                {(imagePath || imageFile) && (
                  <div className={styles.previewWrap}>
                    <img src={imagePath ? getImageUrl(imagePath) : (imageFile ? URL.createObjectURL(imageFile) : '')} alt="" className={styles.coverPreview} />
                    <button type="button" className={styles.removeImg} onClick={() => { setImagePath(''); setImageFile(null); }}>הסר</button>
                  </div>
                )}
              </div>
            </label>
            <label className={styles.label}>
              קבצי אודיו (ניתן לבחור כמה)
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={onAlbumFilesChange}
                className={styles.fileInput}
              />
            </label>
            {albumRows.length > 0 && (
              <div className={styles.albumRows}>
                <div className={styles.albumRowsHead}>כותרת השירים (הוסף קבצים למטה)</div>
                {albumRows.map((row, i) => (
                  <div key={i} className={styles.albumRow}>
                    <button type="button" className={styles.removeRowBtn} onClick={() => removeAlbumRow(i)} title="הסר">
                      ×
                    </button>
                    <span className={styles.albumRowFile}>{row.file ? row.file.name : '—'}</span>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => setAlbumRowTitle(i, e.target.value)}
                      className={styles.input}
                      placeholder="שם השיר"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label className={styles.label}>
              קובץ אודיו (MP3, M4A, וכו')
              <input type="file" accept="audio/*" onChange={onFileChange} className={styles.fileInput} required />
              {file && <span className={styles.fileName}>{file.name}</span>}
            </label>
            <label className={styles.label}>
              כותרת *
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} required placeholder="שם השיר" />
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
              תמונת כיסוי (אופציונלי)
              <div className={styles.imageRow}>
                <input type="file" accept="image/*" onChange={onImageChange} className={styles.fileInput} />
                {(imagePath || imageFile) && (
                  <div className={styles.previewWrap}>
                    <img src={imagePath ? getImageUrl(imagePath) : (imageFile ? URL.createObjectURL(imageFile) : '')} alt="" className={styles.coverPreview} />
                    <button type="button" className={styles.removeImg} onClick={() => { setImagePath(''); setImageFile(null); }}>הסר</button>
                  </div>
                )}
              </div>
            </label>
            <label className={styles.label}>
              אלבום
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className={styles.input}
                disabled={!artistId}
              >
                <option value="">ללא אלבום</option>
                {albums.map((al) => (
                  <option key={al.id} value={al.id}>{al.name}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <button
          type="submit"
          className={styles.btn}
          disabled={loading || artists.length === 0 || (isAlbum && albumRows.filter((r) => r.file).length === 0)}
        >
          {loading
            ? 'מעלה...'
            : isAlbum
              ? `העלה ${albumRows.filter((r) => r.file).length} שירים`
              : 'העלה שיר'}
        </button>
      </form>
    </div>
  );
}
