import { NavLink, useNavigate } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('gc_token');
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
        <span className="nav-logo">🌿</span>
        <span className="nav-title">Green Cricket</span>
      </div>

      <div className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Clients
        </NavLink>
        <NavLink to="/schedule" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Schedule
        </NavLink>
        <NavLink to="/payments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Payments
        </NavLink>
      </div>

      <button className="btn-logout" onClick={logout}>
        Logout
      </button>
    </nav>
  );
}
