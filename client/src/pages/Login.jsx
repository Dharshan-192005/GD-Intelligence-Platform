import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AuthLayout from './AuthLayout';

export default function Login({ onLogin, onNavigateToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Could not sign in.');
      }
      if (!data.token || !data.user) {
        throw new Error('Sign in succeeded but the server did not return a valid session token.');
      }

      localStorage.setItem('gd_user', JSON.stringify(data.user));
      localStorage.setItem('gd_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Could not sign in. Please check the backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={<>Welcome<br />Back</>}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', color: '#1f2937' }}>Sign in</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error && (
          <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.22)', color: '#b91c1c', borderRadius: '8px', padding: '10px 12px', fontSize: '0.86rem' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px', fontWeight: 500 }}>
            Email Address
          </label>
          <input 
            type="email" 
            className="input-field" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            autoComplete="email"
            required 
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px', fontWeight: 500 }}>
            Password
          </label>
          <div className="password-input-wrap">
            <input 
              type={showPassword ? 'text' : 'password'} 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required 
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="remember" style={{ cursor: 'pointer' }} />
          <label htmlFor="remember" style={{ fontSize: '0.85rem', color: '#4b5563', cursor: 'pointer' }}>
            Remember Me
          </label>
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          style={{ 
            marginTop: '8px', 
            background: 'var(--primary)',
            boxShadow: '0 4px 12px rgba(15, 118, 110, 0.22)' 
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#115e59';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--primary)';
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in now'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <a href="#" style={{ color: '#4b5563', fontSize: '0.85rem', textDecoration: 'none' }}>
            Lost your password?
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: '#6b7280' }}>
          Don't have an account?{' '}
          <span 
            onClick={onNavigateToSignup} 
            style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            Sign up
          </span>
        </div>
      </form>

      <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '0.75rem', color: '#9ca3af' }}>
        By clicking on "Sign in now" you agree to<br/>
        <a href="#" style={{ color: '#6b7280' }}>Terms of Service</a> | <a href="#" style={{ color: '#6b7280' }}>Privacy Policy</a>
      </div>
    </AuthLayout>
  );
}
