import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="af-auth-page">
      <div className="af-auth-page__bg">
        <div className="af-auth-page__orb af-auth-page__orb--1" />
        <div className="af-auth-page__orb af-auth-page__orb--2" />
      </div>

      <div className="af-auth-card animate-in">
        <div className="af-auth-card__header">
          <div className="af-auth-card__logo">⚡</div>
          <h1 className="af-auth-card__title">Welcome back</h1>
          <p className="af-auth-card__subtitle">Sign in to AssetFlow</p>
        </div>

        <form onSubmit={handleSubmit} className="af-auth-card__form">
          {error && (
            <div className="af-auth-card__error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="af-auth-card__field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            Sign In
          </Button>

          <p className="af-auth-card__footer-text">
            Don't have an account?{' '}
            <Link to="/signup">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
