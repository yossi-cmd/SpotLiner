import { useState, useEffect } from 'react';
import { getAdminPushSubscribers, adminSendPush } from '../api';
import { IconSettings } from '../components/Icons';
import styles from './AdminSendPush.module.css';

export default function AdminSendPush() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [form, setForm] = useState({
    title: '',
    body: '',
    url: '/',
    icon: '',
    image: '',
    badge: '',
    tag: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminPushSubscribers()
      .then((r) => setUsers(r.users || []))
      .catch((e) => setError(e.message || 'טעינת המנויים נכשלה'))
      .finally(() => setLoading(false));
  }, []);

  const toggleUser = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!form.title?.trim() || !form.body?.trim()) {
      setError('כותרת וגוף ההודעה חובה');
      return;
    }
    if (selectedIds.size === 0) {
      setError('בחר לפחות משתמש אחד');
      return;
    }
    setSending(true);
    try {
      const r = await adminSendPush({
        title: form.title.trim(),
        body: form.body.trim(),
        url: form.url?.trim() || '/',
        icon: form.icon?.trim() || undefined,
        image: form.image?.trim() || undefined,
        badge: form.badge?.trim() || undefined,
        tag: form.tag?.trim() || undefined,
        userIds: Array.from(selectedIds),
      });
      setResult(r);
    } catch (e) {
      setError(e.message || 'שליחה נכשלה');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <IconSettings size={28} className={styles.titleIcon} />
        שליחת התראות
      </h1>
      <p className={styles.desc}>שליחת הודעת push למשתמשים שמנויים להתראות. ניתן לבחור כמה משתמשים ולמלא את כל שדות ההתראה.</p>

      {loading ? (
        <p className={styles.status}>טוען רשימת מנויים...</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>תוכן ההתראה</h2>
            <label className={styles.label}>
              כותרת *
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={styles.input}
                placeholder="כותרת"
                required
              />
            </label>
            <label className={styles.label}>
              גוף ההודעה *
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className={styles.input}
                placeholder="טקסט ההתראה"
                rows={3}
                required
              />
            </label>
            <label className={styles.label}>
              קישור (URL)
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className={styles.input}
                placeholder="/"
              />
            </label>
            <label className={styles.label}>
              אייקון (URL)
              <input
                type="url"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className={styles.input}
                placeholder="https://..."
              />
            </label>
            <label className={styles.label}>
              תמונה (URL)
              <input
                type="url"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                className={styles.input}
                placeholder="https://..."
              />
            </label>
            <label className={styles.label}>
              Badge (URL)
              <input
                type="url"
                value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                className={styles.input}
                placeholder="https://..."
              />
            </label>
            <label className={styles.label}>
              תג (tag – להחלפת הודעה קודמת)
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                className={styles.input}
                placeholder="עדכון"
              />
            </label>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>נמענים</h2>
            <p className={styles.desc}>משתמשים שמנויים להתראות (כולל מספר מכשירים לכל משתמש).</p>
            {users.length === 0 ? (
              <p className={styles.status}>אין משתמשים מנויים להתראות.</p>
            ) : (
              <>
                <button type="button" onClick={selectAll} className={styles.selectAllBtn}>
                  {selectedIds.size === users.length ? 'בטל בחירה' : 'בחר הכל'}
                </button>
                <ul className={styles.userList}>
                  {users.map((u) => (
                    <li key={u.id} className={styles.userItem}>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className={styles.checkbox}
                        />
                        <span className={styles.userName}>{u.display_name || u.email}</span>
                        {u.display_name && <span className={styles.userEmail}>{u.email}</span>}
                        <span className={styles.userCount}>({u.subscription_count} מכשיר{u.subscription_count > 1 ? 'ים' : ''})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {error && <p className={styles.error}>{error}</p>}
          {result && (
            <p className={styles.result}>
              נשלח: {result.sent}, נכשל: {result.failed}
              {result.errors?.length ? ` — ${result.errors.length} שגיאות` : ''}
            </p>
          )}
          <button type="submit" className={styles.submitBtn} disabled={sending || users.length === 0}>
            {sending ? 'שולח...' : 'שלח התראה'}
          </button>
        </form>
      )}
    </div>
  );
}
