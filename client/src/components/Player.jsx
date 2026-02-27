import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStreamUrl, recordHistory, getImageUrl } from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { IconSkipPrev, IconPlay, IconPause, IconSkipNext, IconVolume, IconClose } from './Icons';
import styles from './Player.module.css';

export default function Player() {
  const audioRef = useRef(null);
  const queuePanelRef = useRef(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    const close = (e) => {
      if (queueOpen && queuePanelRef.current && !queuePanelRef.current.contains(e.target)) setQueueOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [queueOpen]);
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    progress,
    duration,
    volume,
    setCurrentTrack,
    setQueueIndex,
    setIsPlaying,
    setProgress,
    setDuration,
    setVolume,
    next,
    prev,
    getCurrentFromQueue,
    removeFromQueue,
  } = usePlayerStore();

  const track = currentTrack || getCurrentFromQueue();

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (track) {
      el.src = getStreamUrl(track.id);
      if (isPlaying) el.play().catch(() => {});
      setDuration(track.duration_seconds || 0);
      if (user) recordHistory(track.id).catch(() => {});
    } else {
      el.src = '';
    }
  }, [track?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume]);

  const onTimeUpdate = () => {
    if (audioRef.current) setProgress(audioRef.current.currentTime);
  };

  const onEnded = () => {
    const nextTrack = next();
    if (nextTrack) {
      setCurrentTrack(nextTrack);
    } else {
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current && track) setDuration(audioRef.current.duration);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.right - e.clientX;
    const pct = x / rect.width;
    const t = pct * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setProgress(t);
    }
  };

  if (!track) {
    return (
      <div className={styles.player}>
        <audio ref={audioRef} />
        <div className={styles.empty}>בחר שיר להאזנה</div>
      </div>
    );
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <div className={styles.info}>
        <div className={styles.artwork}>
          {(track.cover_image_path || track.image_path) && (
            <img src={getImageUrl(track.cover_image_path || track.image_path)} alt="" className={styles.artworkImg} />
          )}
        </div>
        <div className={styles.meta}>
          <span className={styles.title}>{track.title}</span>
          {track.artist_id ? (
            <Link to={`/artist/${track.artist_id}`} className={styles.artist} onClick={(e) => e.stopPropagation()}>{track.artist}</Link>
          ) : (
            <span className={styles.artist}>{track.artist}</span>
          )}
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.ctrlBtns}>
          <button type="button" onClick={() => setCurrentTrack(next() || track)} className={styles.ctrlBtn} aria-label="הבא">
            <IconSkipNext size={20} />
          </button>
          <button type="button" onClick={() => setIsPlaying(!isPlaying)} className={styles.playBtn} aria-label={isPlaying ? 'השהה' : 'השמע'}>
            {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
          </button>
          <button type="button" onClick={() => setCurrentTrack(prev() || track)} className={styles.ctrlBtn} aria-label="הקודם">
            <IconSkipPrev size={20} />
          </button>
        </div>
        <div className={styles.progressBtns}>
          <span className={styles.time}>
            {formatTime(progress)}
          </span>
          <div className={styles.progressWrap} onClick={seek}>
            <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
          </div>
          <span className={styles.time}>
            {formatTime(duration || track.duration_seconds)}
          </span>
        </div>
      </div>
      <div className={styles.volumeWrap}>
        <span className={styles.volIcon}><IconVolume size={20} /></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className={styles.volume}
        />
      </div>
      <div className={styles.queueWrap} ref={queuePanelRef}>
        <button type="button" className={styles.queueBtn} onClick={() => setQueueOpen((o) => !o)} title="תור">
          תור ({queue.length})
        </button>
        {queueOpen && (
          <div className={styles.queuePanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.queueHeader}>תור השמעה</div>
            {queue.length === 0 ? (
              <div className={styles.queueEmpty}>התור ריק</div>
            ) : (
              queue.map((t, i) => (
                <div
                  key={`${t.id}-${i}`}
                  className={`${styles.queueItem} ${t.id === track?.id ? styles.queueItemActive : ''}`}
                  onClick={() => {
                    setQueueIndex(i);
                    setCurrentTrack(t);
                    setIsPlaying(true);
                  }}
                >
                  <span className={styles.queueItemIndex}>{i + 1}</span>
                  <div className={styles.queueItemInfo}>
                    <span className={styles.queueItemTitle}>{t.title}</span>
                    {t.artist_id ? (
                      <Link to={`/artist/${t.artist_id}`} className={styles.queueItemArtist} onClick={(e) => e.stopPropagation()}>{t.artist}</Link>
                    ) : (
                      <span className={styles.queueItemArtist}>{t.artist}</span>
                    )}
                  </div>
                  <button type="button" className={styles.queueItemRemove} onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }} aria-label="הסר"><IconClose size={16} /></button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
