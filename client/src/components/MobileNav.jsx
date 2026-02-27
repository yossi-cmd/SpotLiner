import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { IconHome, IconSearch, IconLibrary, IconUser, IconDisc, IconUpload } from './Icons';
import styles from './MobileNav.module.css';

export default function MobileNav() {
  const canUpload = useAuthStore((s) => s.canUpload());

  return (
    <nav className={styles.nav} role="navigation" aria-label="ניווט ראשי">
      <NavLink to="/" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} end>
        <IconHome size={22} className={styles.icon} />
        <span>דף הבית</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
        <IconSearch size={22} className={styles.icon} />
        <span>חיפוש</span>
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
        <IconLibrary size={22} className={styles.icon} />
        <span>ספרייה</span>
      </NavLink>
      <NavLink to="/artists" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
        <IconUser size={22} className={styles.icon} />
        <span>אומנים</span>
      </NavLink>
      <NavLink to="/albums" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
        <IconDisc size={22} className={styles.icon} />
        <span>אלבומים</span>
      </NavLink>
      {canUpload && (
        <NavLink to="/upload" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
          <IconUpload size={22} className={styles.icon} />
          <span>העלאה</span>
        </NavLink>
      )}
    </nav>
  );
}
