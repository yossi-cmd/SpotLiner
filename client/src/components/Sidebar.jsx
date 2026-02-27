import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { sendTestPush } from '../api';
import { IconHome, IconSearch, IconLibrary, IconUpload, IconUser, IconDisc, IconClose, IconSettings } from './Icons';
import styles from './Sidebar.module.css';

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout, canUpload } = useAuthStore();
  const navigate = useNavigate();
  const [pushTesting, setPushTesting] = useState(false);

  const handlePushTest = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPushTesting(true);
    try {
      const r = await sendTestPush();
      if (r.sent) window.alert('התראת בדיקה נשלחה. בדוק במכשיר.');
      else window.alert('שליחה נכשלה: ' + (r.error || 'לא ידוע'));
    } catch (err) {
      window.alert('שגיאה: ' + (err.message || 'לא ידוע'));
    } finally {
      setPushTesting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose?.();
  };

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <>
      <div className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`} aria-label="תפריט צד">
      <div className={styles.logoRow}>
        <NavLink to="/" className={styles.logo} onClick={handleNavClick}>
          <span className={styles.logoIcon}>S</span>
          <span>ספוטליינר</span>
        </NavLink>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="סגור תפריט">
          <IconClose size={24} />
        </button>
      </div>
      <nav className={styles.nav}>
        <NavLink to="/" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} end onClick={handleNavClick}>
          <span className={styles.icon}><IconHome className={styles.iconSvg} /></span>
          <span>דף הבית</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
          <span className={styles.icon}><IconSearch className={styles.iconSvg} /></span>
          <span>חיפוש</span>
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
          <span className={styles.icon}><IconLibrary className={styles.iconSvg} /></span>
          <span>הספרייה שלי</span>
        </NavLink>
        <NavLink to="/artists" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
          <span className={styles.icon}><IconUser className={styles.iconSvg} /></span>
          <span>אומנים</span>
        </NavLink>
        <NavLink to="/albums" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
          <span className={styles.icon}><IconDisc className={styles.iconSvg} /></span>
          <span>אלבומים</span>
        </NavLink>
        {canUpload() && (
          <NavLink to="/upload" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
            <span className={styles.icon}><IconUpload className={styles.iconSvg} /></span>
            <span>העלאת שיר</span>
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} onClick={handleNavClick}>
          <span className={styles.icon}><IconSettings className={styles.iconSvg} /></span>
          <span>הגדרות</span>
        </NavLink>
      </nav>
      <div className={styles.user}>
        {user ? (
          <>
            <span className={styles.userName}>{user.displayName || user.email}</span>
            <button type="button" onClick={handlePushTest} className={styles.logoutBtn} disabled={pushTesting} title="שלח התראת בדיקה">
              {pushTesting ? 'שולח...' : 'בדיקת התראות'}
            </button>
            <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
              יציאה
            </button>
          </>
        ) : null}
      </div>
      </aside>
    </>
  );
}
