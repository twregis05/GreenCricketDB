import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Login.css';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submit(next);
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const submit = async (value) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { pin: value });
      localStorage.setItem('gc_token', data.token);
      navigate('/dashboard');
    } catch {
      setError('Incorrect PIN. Please try again.');
      triggerShake();
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-logo">
          <span className="login-logo-icon">🌿</span>
        </div>
        <h1 className="login-title">Green Cricket</h1>
        <p className="login-subtitle">Employee Portal — Enter your 4-digit PIN</p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="numpad">
          {digits.map((d, idx) => {
            if (d === '') return <div key={idx} className="numpad-spacer" />;
            if (d === '⌫') {
              return (
                <button
                  key={idx}
                  className="numpad-key numpad-back"
                  onClick={handleBackspace}
                  disabled={loading}
                >
                  {d}
                </button>
              );
            }
            return (
              <button
                key={idx}
                className="numpad-key"
                onClick={() => handleDigit(d)}
                disabled={loading || pin.length >= 4}
              >
                {d}
              </button>
            );
          })}
        </div>

        {loading && <p className="login-loading">Verifying…</p>}
      </div>
    </div>
  );
}
