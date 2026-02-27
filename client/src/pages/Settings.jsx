import { useState } from 'react';
import { usePWAStore } from '../store/pwaStore';
import { registerPushSubscription } from '../api';
import { IconSettings, IconDownload } from '../components/Icons';
import styles from './Settings.module.css';

export default function Settings() {
  const installPrompt = usePWAStore((s) => s.installPrompt);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [installMessage, setInstallMessage] = useState('');

  const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window;
  const notificationPermission = hasNotificationSupport ? Notification.permission : 'unsupported';

  const handleEnableNotifications = async () => {
    if (!hasNotificationSupport) return;
    setNotifyLoading(true);
    setNotifyMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPushSubscription();
        setNotifyMessage('ההתראות הופעלו בהצלחה.');
      } else if (permission === 'denied') {
        setNotifyMessage('אישור ההתראות נחסם. אפשר לפתוח בהגדרות הדפדפן.');
      } else {
        setNotifyMessage('לא אושר. נסה שוב ולחץ "אפשר" בחלון שמופיע.');
      }
    } catch (err) {
      setNotifyMessage('שגיאה: ' + (err.message || 'לא ידוע'));
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleInstallPWA = async () => {
    if (!installPrompt) {
      setInstallMessage('ההתקנה תופיע כשהדפדפן יציע אותה (למשל במובייל או בדסקטופ).');
      return;
    }
    setInstallMessage('');
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallMessage('האפליקציה מותקנת.');
    usePWAStore.getState().clearInstallPrompt();
  };

  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <IconSettings size={28} className={styles.titleIcon} />
        הגדרות
      </h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>התראות</h2>
        <p className={styles.desc}>
          קבל התראה כשעולה שיר חדש לאומן שאחד משיריו באהובים שלך.
        </p>
        {hasNotificationSupport ? (
          <>
            <p className={styles.status}>
              סטטוס: <strong>{notificationPermission === 'granted' ? 'מופעל' : notificationPermission === 'denied' ? 'חסום' : 'לא נבחר'}</strong>
            </p>
            <button
              type="button"
              className={styles.btn}
              onClick={handleEnableNotifications}
              disabled={notifyLoading || notificationPermission === 'granted'}
            >
              {notifyLoading ? 'מפעיל...' : notificationPermission === 'granted' ? 'התראות מופעלות' : 'אשר התראות'}
            </button>
            {notifyMessage && <p className={styles.message}>{notifyMessage}</p>}
          </>
        ) : (
          <p className={styles.status}>הדפדפן לא תומך בהתראות.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>התקנת אפליקציה</h2>
        <p className={styles.desc}>
          התקן את ספוטליינר במכשיר כדי להאזין בנוחות ולקבל התראות.
        </p>
        {isStandalone ? (
          <p className={styles.status}>האפליקציה מותקנת.</p>
        ) : (
          <>
            <button
              type="button"
              className={styles.btn}
              onClick={handleInstallPWA}
            >
              <IconDownload size={20} className={styles.btnIcon} />
              התקן אפליקציה
            </button>
            {installMessage && <p className={styles.message}>{installMessage}</p>}
          </>
        )}
      </section>
    </div>
  );
}
