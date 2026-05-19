import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import GDArena from './pages/GDArena';
import AnalyticsReport from './pages/AnalyticsReport';
import { Sparkles, MessageCircle } from 'lucide-react';
import './App.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // dashboard, arena, report
  const [activeSession, setActiveSession] = useState(null);

  const handleStartSession = (session) => {
    setActiveSession(session);
    setCurrentPage('arena');
  };

  const handleCompleteSession = (completedSession) => {
    setActiveSession(completedSession);
    setCurrentPage('report');
  };

  const handleViewReport = async (sessionId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load session details');
      const data = await res.json();
      setActiveSession(data);
      setCurrentPage('report');
    } catch (err) {
      console.warn('Standalone Mode: Loading local fallback for report', sessionId);
      alert('Could not connect to the backend server to retrieve this specific report.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Global Navigation Header */}
      <nav className="navbar">
        <div className="logo" onClick={() => setCurrentPage('dashboard')} style={{ cursor: 'pointer' }}>
          <MessageCircle size={28} style={{ stroke: 'url(#violet-cyan-grad)', fill: 'rgba(139, 92, 246, 0.1)' }} />
          {/* SVG gradient definition for the Lucide stroke icon */}
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <linearGradient id="violet-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </svg>
          <span>GD Intelligence Platform</span>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {currentPage === 'arena' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--accent-red)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontWeight: 600
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-red)',
                display: 'inline-block',
                boxShadow: '0 0 8px var(--accent-red)',
                animation: 'pulseSpeaking 1s infinite'
              }} />
              SIMULATOR ROUND ACTIVE
            </div>
          )}

          {currentPage === 'report' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--accent-green)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontWeight: 600
            }}>
              <Sparkles size={14} />
              COACH EVALUATION SHOWN
            </div>
          )}

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Practice Mode
          </div>
        </div>
      </nav>

      {/* Dynamic Page Router Container */}
      <main style={{ flex: 1 }}>
        {currentPage === 'dashboard' && (
          <Dashboard
            onStartSession={handleStartSession}
            onViewReport={handleViewReport}
          />
        )}
        
        {currentPage === 'arena' && (
          <GDArena
            session={activeSession}
            onComplete={handleCompleteSession}
          />
        )}
        
        {currentPage === 'report' && (
          <AnalyticsReport
            session={activeSession}
            onBack={() => setCurrentPage('dashboard')}
          />
        )}
      </main>

      {/* Footer bar */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'rgba(6,7,10,0.5)'
      }}>
        © 2026 AI-Powered Group Discussion Intelligence Platform • Built using React + Node Express + Gemini AI
      </footer>

    </div>
  );
}
