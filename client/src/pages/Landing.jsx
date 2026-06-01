import { useNavigate } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="hero-overlay" />
        <nav className="landing-nav">
          <div className="nav-brand">
            <span className="brand-icon">🌿</span>
            <span className="brand-name">Green Cricket</span>
          </div>
          <button className="btn-login-nav" onClick={() => navigate('/login')}>
            Employee Login
          </button>
        </nav>

        <div className="hero-content">
          <h1 className="hero-title">Green Cricket Landscaping</h1>
          <p className="hero-tagline">
            Professional lawn care &amp; landscaping services — keeping your property
            beautiful all season long.
          </p>
          <button className="btn-cta" onClick={() => navigate('/login')}>
            Access Dashboard
          </button>
        </div>

        <div className="hero-scroll-hint">
          <span>↓</span>
        </div>
      </header>

      <section className="features-section">
        <h2 className="section-title">Everything in One Place</h2>
        <p className="section-subtitle">
          Manage clients, schedules, and payments from a single employee dashboard.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">👤</div>
            <h3>Client Directory</h3>
            <p>
              Store and manage every client's contact info, address, and special notes.
              Import existing data via CSV in seconds.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>Lawn Schedule</h3>
            <p>
              Visual weekly calendar organized by route. Set cutting frequency and
              export any view to PDF.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3>Payment Tracking</h3>
            <p>
              Log Zelle, check, and credit payments. Track invoice status, amounts
              due, and payment history per client.
            </p>
          </div>
        </div>
      </section>

      <section className="routes-section">
        <div className="routes-inner">
          <div className="routes-text">
            <h2>Two Routes, One Dashboard</h2>
            <p>
              Green Cricket operates two separate service routes. The schedule page
              keeps them clearly separated so you always know who goes where — and
              when.
            </p>
            <button className="btn-secondary" onClick={() => navigate('/login')}>
              Get Started
            </button>
          </div>
          <div className="routes-visual">
            <div className="route-badge route-1">Route 1</div>
            <div className="route-badge route-2">Route 2</div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="brand-icon">🌿</span>
          <span>Green Cricket Landscaping</span>
        </div>
        <p className="footer-copy">© 2025 Green Cricket Landscaping. Internal use only.</p>
      </footer>
    </div>
  );
}
