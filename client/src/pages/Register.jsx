import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import './Login.css';

export default function Register() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { email, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🌿</span>
        </div>
        <h1 className="login-title">Request Access</h1>
        <p className="login-subtitle">Green Cricket Employee Portal</p>

        {success ? (
          <>
            <div className="login-success">
              ✓ Your account has been created and is <strong>pending admin approval</strong>.
              You'll be able to sign in once an admin approves your account in the system.
            </div>
            <p className="login-footer-link" style={{ marginTop: '1.25rem' }}>
              <Link to="/login">← Back to Sign In</Link>
            </p>
          </>
        ) : (
          <>
            <form className="login-form" onSubmit={submit}>
              <div className="login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Password <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(min. 8 characters)</span></label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="confirm">Confirm Password</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <p className="login-error">{error}</p>}

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Submitting…' : 'Request Access'}
              </button>
            </form>

            <p className="login-footer-link">
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
