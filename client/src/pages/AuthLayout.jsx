import React from 'react';
import bgImage from '../assets/bg-mountain.png';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-container animate-fade-in">
      {/* Left Sidebar */}
      <div 
        className="auth-sidebar"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        <div className="auth-sidebar-content animate-slide-up delay-100">
          <h1 style={{ color: 'white', background: 'none', WebkitTextFillColor: 'white', fontSize: '3.5rem', lineHeight: 1.1 }}>
            {title || (
              <>Welcome<br />Back</>
            )}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '20px', fontSize: '1rem', lineHeight: 1.6 }}>
            {subtitle || "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using"}
          </p>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="auth-form-container">
        <div className="auth-form-wrapper animate-slide-up delay-200">
          {children}
        </div>
      </div>
    </div>
  );
}
