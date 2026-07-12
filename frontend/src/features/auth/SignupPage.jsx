import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import './AuthPages.css';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Try again.');
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
          <h1 className="af-auth-card__title">Create account</h1>
          <p className="af-auth-card__subtitle">Join AssetFlow as an employee</p>
        </div>

        <form onSubmit={handleSubmit} className="af-auth-card__form">
          {error && (
            <div className="af-auth-card__error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="af-auth-card__field">
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              autoFocus
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div className="af-auth-card__field">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            Create Account
          </Button>

          <p className="af-auth-card__footer-text">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
