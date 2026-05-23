import { useState } from 'react';
import AuthLayout from './AuthLayout';

export default function Signup({ onSignup, onNavigateToLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);
      const res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Could not create account.');
      }
      if (!data.token || !data.user) {
        throw new Error('Account created but the server did not return a valid session token.');
      }

      localStorage.setItem('gd_user', JSON.stringify(data.user));
      localStorage.setItem('gd_token', data.token);
      onSignup(data.user);
    } catch (err) {
      setError(err.message || 'Could not create account. Please check the backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout 
      title={<>Join Us<br />Today</>}
      subtitle="Start your journey with the AI-Powered Group Discussion Platform. Enhance your communication skills with real-time feedback."
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', color: '#1f2937' }}>Sign up</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error && (
          <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.22)', color: '#b91c1c', borderRadius: '8px', padding: '10px 12px', fontSize: '0.86rem' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px', fontWeight: 500 }}>
            Full Name
          </label>
          <input 
            type="text" 
            className="input-field" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px', fontWeight: 500 }}>
            Email Address
          </label>
          <input 
            type="email" 
            className="input-field" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '8px', fontWeight: 500 }}>
            Password
          </label>
          <input 
            type="password" 
            className="input-field" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required 
          />
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
          {isSubmitting ? 'Creating...' : 'Create Account'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <span 
            onClick={onNavigateToLogin} 
            style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            Sign in
          </span>
        </div>
      </form>

      <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '0.75rem', color: '#9ca3af' }}>
        By creating an account you agree to our<br/>
        <a href="#" style={{ color: '#6b7280' }}>Terms of Service</a> and <a href="#" style={{ color: '#6b7280' }}>Privacy Policy</a>
      </div>
    </AuthLayout>
  );
}
