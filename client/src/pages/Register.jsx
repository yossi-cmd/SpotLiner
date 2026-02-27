import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { register } from '../api';
import styles from './Auth.module.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(email, password, displayName);
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'הרשמה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>ספוטליינר</h1>
        <p className={styles.subtitle}>צור חשבון חדש</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <input
            type="text"
            placeholder="שם לתצוגה"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={styles.input}
            autoComplete="name"
          />
          <input
            type="email"
            placeholder="אימייל"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="סיסמה (לפחות 6 תווים)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'נרשם...' : 'הירשם'}
          </button>
        </form>
        <p className={styles.footer}>
          כבר יש לך חשבון? <Link to="/login">התחבר</Link>
        </p>
      </div>
    </div>
  );
}
