import React, { useState } from 'react';
import AuthLayout from './AuthLayout';

export default function Signup({ onSignup, onNavigateToLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && email && password) {
      onSignup();
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
            required 
          />
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          style={{ 
            marginTop: '8px', 
            background: '#ea580c', 
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' 
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#c2410c';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#ea580c';
          }}
        >
          Create Account
        </button>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <span 
            onClick={onNavigateToLogin} 
            style={{ color: '#ea580c', cursor: 'pointer', fontWeight: 600 }}
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
