import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { IconHome, IconSearch, IconLibrary, IconUpload, IconUser, IconDisc } from './Icons';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { user, logout, canUpload } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={styles.sidebar}>
      <NavLink to="/" className={styles.logo}>
        <span className={styles.logoIcon}>S</span>
        <span>ספוטליינר</span>
      </NavLink>
      <nav className={styles.nav}>
        <NavLink to="/" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} end>
          <span className={styles.icon}><IconHome className={styles.iconSvg} /></span>
          <span>דף הבית</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
          <span className={styles.icon}><IconSearch className={styles.iconSvg} /></span>
          <span>חיפוש</span>
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
          <span className={styles.icon}><IconLibrary className={styles.iconSvg} /></span>
          <span>הספרייה שלי</span>
        </NavLink>
        <NavLink to="/artists" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
          <span className={styles.icon}><IconUser className={styles.iconSvg} /></span>
          <span>אומנים</span>
        </NavLink>
        <NavLink to="/albums" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
          <span className={styles.icon}><IconDisc className={styles.iconSvg} /></span>
          <span>אלבומים</span>
        </NavLink>
        {canUpload() && (
          <NavLink to="/upload" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
            <span className={styles.icon}><IconUpload className={styles.iconSvg} /></span>
            <span>העלאת שיר</span>
          </NavLink>
        )}
      </nav>
      <div className={styles.user}>
        {user ? (
          <>
            <span className={styles.userName}>{user.displayName || user.email}</span>
            <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
              יציאה
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
