import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { addFavorite, removeFavorite, getPlaylists, addTrackToPlaylist, getImageUrl } from '../api';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { IconMusic, IconHeart, IconPlus, IconPlaylist, IconClose, IconEdit, IconTrash, IconMoreVertical } from './Icons';
import styles from './TrackRow.module.css';

const TRACK_MENU_CLOSE_ALL = 'trackMenuCloseAll';

export default function TrackRow({ track, index, showAlbum = true, playlistId, onRemoveFromPlaylist, canEditTrack, onEditTrack, onDeleteTrack }) {
  const { setCurrentTrack, setQueue, setQueueIndex, addToQueue, currentTrack, setIsPlaying } = usePlayerStore();
  const { user } = useAuthStore();
  const favoriteIds = useFavoritesStore((s) => s.favoriteIds);
  const addFavoriteId = useFavoritesStore((s) => s.addFavorite);
  const removeFavoriteId = useFavoritesStore((s) => s.removeFavorite);
  const isFavorite = favoriteIds.has(track.id) || favoriteIds.has(Number(track.id));
  const [favLoading, setFavLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [playlists, setPlaylists] = useState([]);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const isActive = currentTrack?.id === track.id;

  useEffect(() => {
    if (!menuOpen || !user) return;
    getPlaylists().then((r) => setPlaylists(r.playlists || [])).catch(() => setPlaylists([]));
  }, [menuOpen, user]);

  useEffect(() => {
    const closeAll = () => setMenuOpen(false);
    window.addEventListener(TRACK_MENU_CLOSE_ALL, closeAll);
    return () => window.removeEventListener(TRACK_MENU_CLOSE_ALL, closeAll);
  }, []);

  const openMenu = (e) => {
    window.dispatchEvent(new CustomEvent(TRACK_MENU_CLOSE_ALL));
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const clickX = e?.clientX ?? rect.left;
      setMenuPosition({ top: rect.bottom + 4, left: clickX });
    }
    setTimeout(() => setMenuOpen(true), 0);
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      window.dispatchEvent(new CustomEvent(TRACK_MENU_CLOSE_ALL));
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPosition({ top: rect.bottom + 4, left: "32px" });
      }
      setTimeout(() => setMenuOpen(true), 0);
    }
  };

  useEffect(() => {
    const close = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const play = () => {
    setQueue([track], 0);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const addToQueueClick = (e) => {
    e.stopPropagation();
    addToQueue(track);
  };

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (!user || favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorite) {
        await removeFavorite(track.id);
        removeFavoriteId(track.id);
      } else {
        await addFavorite(track.id);
        addFavoriteId(track.id);
      }
    } catch {
      // ignore
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <div
      className={`${styles.row} ${isActive ? styles.active : ''} ${!showAlbum ? styles.noAlbum : ''}`}
      onDoubleClick={play}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openMenu(e);
      }}
      role="button"
      tabIndex={0}
      onClick={play}
      onKeyDown={(e) => e.key === 'Enter' && play()}
    >
      <span className={styles.index}>{index != null ? index + 1 : '—'}</span>
      <div className={styles.artwork}>
        {(track.cover_image_path || track.image_path) ? (
          <img
            src={getImageUrl(track.cover_image_path || track.image_path)}
            alt=""
            className={styles.artworkImg}
          />
        ) : (
          isActive ? <IconMusic size={20} /> : ''
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{track.title}</span>
        {track.artist_id ? (
          <Link to={`/artist/${track.artist_id}`} className={styles.artist} onClick={(e) => e.stopPropagation()}>{track.artist || '—'}</Link>
        ) : (
          <span className={styles.artist}>{track.artist || '—'}</span>
        )}
      </div>
      {showAlbum && (
        track.album_id ? (
          <Link to={`/album/${track.album_id}`} className={styles.album} onClick={(e) => e.stopPropagation()}>{track.album || '—'}</Link>
        ) : (
          <span className={styles.album}>{track.album || '—'}</span>
        )
      )}
      <span className={styles.duration}>{formatDuration(track.duration_seconds)}</span>
      <div className={styles.actions}>
        {user && (
          <button type="button" className={styles.actionBtn} onClick={toggleFavorite} title={isFavorite ? 'הסר מאהובים' : 'הוסף לאהובים'}>
            <IconHeart size={18} filled={isFavorite} />
          </button>
        )}
        <button type="button" className={styles.actionBtn} onClick={addToQueueClick} title="הוסף לתור">
          <IconPlus size={18} />
        </button>
        {(canEditTrack && (onEditTrack || onDeleteTrack)) || user || (playlistId && onRemoveFromPlaylist) ? (
          <div className={styles.menuWrap}>
            <button
              ref={triggerRef}
              type="button"
              className={styles.actionBtn}
              onClick={toggleMenu}
              title="עוד אפשרויות"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <IconMoreVertical size={18} />
            </button>
            {menuOpen && createPortal(
              <div
                ref={dropdownRef}
                className={`${styles.menuDropdown} ${styles.menuDropdownPortal}`}
                role="menu"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                {canEditTrack && onEditTrack && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEditTrack(track); }}
                  >
                    <IconEdit size={16} />
                    <span>ערוך שיר</span>
                  </button>
                )}
                {canEditTrack && onDeleteTrack && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteTrack(track); }}
                  >
                    <IconTrash size={16} />
                    <span>מחק שיר</span>
                  </button>
                )}
                {user && (
                  <>
                    {(canEditTrack && (onEditTrack || onDeleteTrack)) && <div className={styles.menuDivider} />}
                    <div className={styles.menuSection}>הוסף לפלייליסט</div>
                    {playlists.length === 0 ? (
                      <div className={styles.menuItemDisabled}>אין פלייליסטים</div>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          className={styles.menuItem}
                          role="menuitem"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await addTrackToPlaylist(pl.id, track.id);
                              setMenuOpen(false);
                            } catch {}
                          }}
                        >
                          <IconPlaylist size={16} />
                          <span>{pl.name}</span>
                        </button>
                      ))
                    )}
                  </>
                )}
                {playlistId && onRemoveFromPlaylist && (
                  <>
                    <div className={styles.menuDivider} />
                    <button
                      type="button"
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRemoveFromPlaylist(track.id); }}
                    >
                      <IconClose size={16} />
                      <span>הסר מפלייליסט</span>
                    </button>
                  </>
                )}
              </div>,
              document.body
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDuration(sec) {
  if (sec == null) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

