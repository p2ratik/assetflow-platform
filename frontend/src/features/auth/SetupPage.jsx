import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import client from '../../api/client';
import './AuthPages.css';

export default function SetupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { setupAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirect away if an admin already exists
  useEffect(() => {
    client.get('/auth/setup/status')
      .then(res => {
        if (!res.data.needs_setup) {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await setupAdmin(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="af-auth-page">
      <div className="af-auth-page__bg">
        <div className="af-auth-page__orb af-auth-page__orb--1" />
        <div className="af-auth-page__orb af-auth-page__orb--2" />
      </div>

      <div className="af-auth-card animate-in">
        <div className="af-auth-card__header">
          <div className="af-auth-card__logo">🏗️</div>
          <h1 className="af-auth-card__title">Platform Setup</h1>
          <p className="af-auth-card__subtitle">
            Create the first administrator account. This can only be done once.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="af-auth-card__form">
          {error && (
            <div className="af-auth-card__error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="af-auth-card__field">
            <label htmlFor="setup-name">Full Name</label>
            <input
              id="setup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Admin Name"
              required
              autoFocus
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="setup-email">Email</label>
            <input
              id="setup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="setup-password">Password</label>
            <input
              id="setup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="setup-confirm">Confirm Password</label>
            <input
              id="setup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            Create Admin &amp; Launch Platform
          </Button>

          <p className="af-auth-card__footer-text">
            Already set up? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
