import React, { useState } from 'react';
import AuthLayout from './AuthLayout';

export default function Login({ onLogin, onNavigateToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && password) {
      onLogin();
    }
  };

  return (
    <AuthLayout title={<>Welcome<br />Back</>}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', color: '#1f2937' }}>Sign in</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            required 
          />
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
            background: '#ea580c', // Orange brand color from the image
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' 
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#c2410c';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#ea580c';
          }}
        >
          Sign in now
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
            style={{ color: '#ea580c', cursor: 'pointer', fontWeight: 600 }}
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
