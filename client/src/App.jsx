import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import GDArena from './pages/GDArena';
import AnalyticsReport from './pages/AnalyticsReport';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { Sparkles, MessageCircle, Home, LogOut, Users, BarChart2, Settings } from 'lucide-react';
import bgImage from './assets/bg-mountain.png';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gd_user')) || null;
    } catch {
      return null;
    }
  });
  const [currentPage, setCurrentPage] = useState(() => currentUser ? 'dashboard' : 'login'); // login, signup, dashboard, arena, report
  const [activeSession, setActiveSession] = useState(null);
  const [dashboardSection, setDashboardSection] = useState('overview');

  const dashboardNavItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'setup', label: 'Setup GD', icon: Settings },
    { id: 'members', label: 'AI Members', icon: Users },
    { id: 'history', label: 'History', icon: BarChart2 }
  ];

  const goToDashboardSection = (section) => {
    setDashboardSection(section);
    setCurrentPage('dashboard');
  };

  const handleStartSession = (session) => {
    setActiveSession(session);
    setCurrentPage('arena');
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };

  const handleSignOut = () => {
    localStorage.removeItem('gd_user');
    setCurrentUser(null);
    setActiveSession(null);
    setCurrentPage('login');
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
    } catch {
      console.warn('Standalone Mode: Loading local fallback for report', sessionId);
      alert('Could not connect to the backend server to retrieve this specific report.');
    }
  };

  const isAuthPage = currentPage === 'login' || currentPage === 'signup';

  if (isAuthPage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1 }}>
          {currentPage === 'login' && (
            <Login 
              onLogin={handleAuthSuccess} 
              onNavigateToSignup={() => setCurrentPage('signup')} 
            />
          )}

          {currentPage === 'signup' && (
            <Signup 
              onSignup={handleAuthSuccess} 
              onNavigateToLogin={() => setCurrentPage('login')} 
            />
          )}
        </main>
      </div>
    );
  }

  // Split-Screen App Shell for Logged In Pages
  return (
    <div className="app-layout">
      {/* App Sidebar */}
      <div className="app-sidebar" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="app-sidebar-content">
          <div className="logo" style={{ color: 'white', marginBottom: '38px', cursor: 'pointer' }} onClick={() => goToDashboardSection('overview')}>
            <MessageCircle size={28} />
            <span>GD Intelligence</span>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55, fontWeight: 800, margin: '0 0 8px 4px' }}>
              Features
            </div>

            {dashboardNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === 'dashboard' && dashboardSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => goToDashboardSection(item.id)}
                  className={`sidebar-option ${isActive ? 'sidebar-option-active' : ''}`}
                  type="button"
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {(currentPage === 'arena' || currentPage === 'report') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fb923c', fontWeight: 700, marginTop: '12px', padding: '12px 14px' }}>
                <Users size={20} /> Active Session
              </div>
            )}
          </div>
          
          <div 
            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.6, cursor: 'pointer', fontWeight: 500 }} 
            onClick={handleSignOut}
          >
            <LogOut size={20} /> Sign Out
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Header */}
        <nav className="navbar" style={{ padding: '20px 40px' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--secondary)' }}>
            {currentPage === 'dashboard' && 'Welcome Back'}
            {currentPage === 'arena' && 'GD Simulation Arena'}
            {currentPage === 'report' && 'Executive Coaching Report'}
          </h2>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {currentPage === 'arena' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--accent-red)',
                background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', padding: '6px 12px', fontWeight: 600
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)', display: 'inline-block', animation: 'pulseSpeaking 1s infinite' }} />
                SIMULATOR ROUND ACTIVE
              </div>
            )}

            {currentPage === 'report' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--accent-green)',
                background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', padding: '6px 12px', fontWeight: 600
              }}>
                <Sparkles size={14} /> COACH EVALUATION
              </div>
            )}

            {currentUser && currentPage === 'dashboard' && (
              <span className="badge badge-success">{currentUser.name}</span>
            )}
          </div>
        </nav>

        {/* Dynamic Pages */}
        <div style={{ padding: '40px', flex: 1 }}>
          {currentPage === 'dashboard' && (
            <Dashboard
              onStartSession={handleStartSession}
              onViewReport={handleViewReport}
              activeSection={dashboardSection}
              onChangeSection={setDashboardSection}
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
        </div>
        
        <footer style={{
          textAlign: 'center', padding: '20px', fontSize: '0.8rem', color: 'var(--text-muted)'
        }}>
          © 2026 AI-Powered Group Discussion Intelligence Platform
        </footer>
      </main>
    </div>
  );
}
