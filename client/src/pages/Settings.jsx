import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePWAStore } from '../store/pwaStore';
import { registerPushSubscription, getMyNotifications, resendNotification } from '../api';
import { IconSettings, IconDownload } from '../components/Icons';
import styles from './Settings.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Settings() {
  const installPrompt = usePWAStore((s) => s.installPrompt);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [installMessage, setInstallMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [resendingId, setResendingId] = useState(null);
  const [resendMessage, setResendMessage] = useState('');

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

  useEffect(() => {
    getMyNotifications({ limit: 30 })
      .then((r) => setNotifications(r.notifications || []))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false));
  }, []);

  const handleResend = async (id) => {
    setResendingId(id);
    setResendMessage('');
    try {
      await resendNotification(id);
      setResendMessage('ההתראה נשלחה שוב.');
      setTimeout(() => setResendMessage(''), 3000);
    } catch (err) {
      setResendMessage('שליחה חוזרת נכשלה: ' + (err.message || ''));
    } finally {
      setResendingId(null);
    }
  };

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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ההתראות שנשלחו אליי</h2>
        <p className={styles.desc}>
          רשימת ההתראות שקבלת (שיר חדש לאומן שאהבת). אפשר לשלוח שוב.
        </p>
        {resendMessage && <p className={styles.message}>{resendMessage}</p>}
        {notificationsLoading ? (
          <p className={styles.status}>טוען...</p>
        ) : notifications.length === 0 ? (
          <p className={styles.status}>עדיין לא נשלחו אליך התראות.</p>
        ) : (
          <ul className={styles.notifList}>
            {notifications.map((n) => (
              <li key={n.id} className={styles.notifItem}>
                <div className={styles.notifContent}>
                  <span className={styles.notifText}>
                    {(() => {
                      const uploaderPart = n.uploader_name?.trim()
                        ? `הועלה על ידי ${n.uploader_name.trim()}: ${[n.artist_name, n.track_title].filter(Boolean).join(' – ') || 'שיר חדש'}`
                        : (n.artist_name && n.track_title ? `${n.artist_name}: ${n.track_title}` : n.track_title || n.artist_name || 'התראה');
                      return n.recipient_name?.trim() ? `הי ${n.recipient_name.trim()}, ${uploaderPart}` : uploaderPart;
                    })()}
                  </span>
                  {n.artist_id && (
                    <Link to={`/artist/${n.artist_id}`} className={styles.notifLink}>לאומן</Link>
                  )}
                  <span className={styles.notifDate}>{formatDate(n.sent_at)}</span>
                </div>
                <button
                  type="button"
                  className={styles.resendBtn}
                  onClick={() => handleResend(n.id)}
                  disabled={resendingId !== null}
                  title="שלח שוב"
                >
                  {resendingId === n.id ? 'שולח...' : 'שלח שוב'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
