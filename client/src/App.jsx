import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import GDArena from './pages/GDArena';
import AnalyticsReport from './pages/AnalyticsReport';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { Sparkles, MessageCircle, Home, LogOut, Users, BarChart2, Settings, ChevronLeft, ChevronRight, UserRound, X, Save } from 'lucide-react';
import bgImage from './assets/bg-mountain.png';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const token = localStorage.getItem('gd_token');
      const user = JSON.parse(localStorage.getItem('gd_user')) || null;
      return token ? user : null;
    } catch {
      return null;
    }
  });
  const [currentPage, setCurrentPage] = useState(() => currentUser ? 'dashboard' : 'login'); // login, signup, dashboard, arena, report
  const [activeSession, setActiveSession] = useState(null);
  const [dashboardSection, setDashboardSection] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gd_user')) || {};
    } catch {
      return {};
    }
  });
  const [settingsDraft, setSettingsDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gd_settings')) || {
        targetIndustry: 'General / Academic',
        preferredDuration: '2 minutes',
        voiceMode: 'Balanced AI voices',
        themePreference: 'Professional light',
        coachingIntensity: 'Balanced',
        requestMode: 'Free-tier balanced'
      };
    } catch {
      return {};
    }
  });

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
    setProfileDraft(user);
    setCurrentPage('dashboard');
  };

  const handleSignOut = () => {
    localStorage.removeItem('gd_user');
    localStorage.removeItem('gd_token');
    setCurrentUser(null);
    setActiveSession(null);
    setCurrentPage('login');
  };

  const handleCompleteSession = (completedSession) => {
    setActiveSession(completedSession);
    setCurrentPage('report');
  };

  const openProfileEditor = () => {
    setIsAccountMenuOpen(false);
    setProfileDraft({
      role: 'Student',
      goal: 'Placement GD preparation',
      experienceLevel: 'Intermediate',
      ...currentUser
    });
    setIsProfileOpen(true);
  };

  const openSettingsEditor = () => {
    setIsAccountMenuOpen(false);
    setSettingsDraft({
      targetIndustry: 'General / Academic',
      preferredDuration: '2 minutes',
      voiceMode: 'Balanced AI voices',
      themePreference: 'Professional light',
      coachingIntensity: 'Balanced',
      requestMode: 'Free-tier balanced',
      ...settingsDraft
    });
    setIsSettingsOpen(true);
  };

  const updateProfileDraft = (field, value) => {
    setProfileDraft(prev => ({ ...prev, [field]: value }));
  };

  const saveProfile = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...currentUser,
      ...profileDraft,
      name: String(profileDraft.name || currentUser?.name || '').trim() || 'User',
      email: String(profileDraft.email || currentUser?.email || '').trim()
    };

    localStorage.setItem('gd_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setIsProfileOpen(false);
  };

  const updateSettingsDraft = (field, value) => {
    setSettingsDraft(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('gd_settings', JSON.stringify(settingsDraft));
    setIsSettingsOpen(false);
  };

  const handleViewReport = async (sessionId) => {
    try {
      const token = localStorage.getItem('gd_token');
      const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
      <div className={`app-sidebar ${isSidebarCollapsed ? 'app-sidebar-collapsed' : ''}`} style={{ backgroundImage: `url(${bgImage})` }}>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="app-sidebar-content">
          <div className="logo" style={{ color: 'white', marginBottom: '38px', cursor: 'pointer' }} onClick={() => goToDashboardSection('overview')}>
            <MessageCircle size={28} />
            {!isSidebarCollapsed && <span>GD Intelligence</span>}
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="sidebar-section-label" style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55, fontWeight: 800, margin: '0 0 8px 4px' }}>
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
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}

            {(currentPage === 'arena' || currentPage === 'report') && (
              <div className="sidebar-active-session" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fb923c', fontWeight: 700, marginTop: '12px', padding: '12px 14px' }}>
                <Users size={20} /> {!isSidebarCollapsed && 'Active Session'}
              </div>
            )}
          </div>
          
          <div 
            className="sidebar-signout"
            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.6, cursor: 'pointer', fontWeight: 500 }} 
            onClick={handleSignOut}
          >
            <LogOut size={20} /> {!isSidebarCollapsed && 'Sign Out'}
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

            {currentUser && (
              <div className="account-menu-wrap">
                <button type="button" className="profile-trigger" onClick={() => setIsAccountMenuOpen(prev => !prev)}>
                  <span>{currentUser.name}</span>
                  <UserRound size={16} />
                </button>
                {isAccountMenuOpen && (
                  <div className="account-menu">
                    <button type="button" onClick={openProfileEditor}>
                      <UserRound size={16} />
                      <span>Edit Profile</span>
                    </button>
                    <button type="button" onClick={openSettingsEditor}>
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {isProfileOpen && (
          <div className="profile-overlay" role="dialog" aria-modal="true" aria-label="Edit profile">
            <form className="profile-panel" onSubmit={saveProfile}>
              <div className="profile-panel-header">
                <div className="profile-avatar-large">
                  {profileDraft.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <span>Edit Profile</span>
                  <h2>{profileDraft.name || 'Your Profile'}</h2>
                  <p>Keep your personal details and preparation goals updated.</p>
                </div>
                <button type="button" className="profile-close" onClick={() => setIsProfileOpen(false)} title="Close profile editor">
                  <X size={18} />
                </button>
              </div>

              <div className="profile-form-grid">
                <label>
                  Full Name
                  <input value={profileDraft.name || ''} onChange={(e) => updateProfileDraft('name', e.target.value)} />
                </label>
                <label>
                  Email
                  <input type="email" value={profileDraft.email || ''} onChange={(e) => updateProfileDraft('email', e.target.value)} />
                </label>
                <label>
                  Current Role
                  <select value={profileDraft.role || 'Student'} onChange={(e) => updateProfileDraft('role', e.target.value)}>
                    <option>Student</option>
                    <option>Job Seeker</option>
                    <option>MBA Aspirant</option>
                    <option>Working Professional</option>
                    <option>Team Lead</option>
                  </select>
                </label>
                <label>
                  Main Goal
                  <select value={profileDraft.goal || 'Placement GD preparation'} onChange={(e) => updateProfileDraft('goal', e.target.value)}>
                    <option>Placement GD preparation</option>
                    <option>MBA admissions</option>
                    <option>Interview communication</option>
                    <option>Leadership practice</option>
                    <option>Public speaking confidence</option>
                  </select>
                </label>
                <label>
                  Experience Level
                  <select value={profileDraft.experienceLevel || 'Intermediate'} onChange={(e) => updateProfileDraft('experienceLevel', e.target.value)}>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </label>
              </div>

              <label className="profile-notes">
                Personal Notes
                <textarea
                  value={profileDraft.notes || ''}
                  onChange={(e) => updateProfileDraft('notes', e.target.value)}
                  placeholder="Example: I want to improve confidence, avoid fillers, and speak with more structure."
                />
              </label>

              <div className="profile-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsProfileOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={16} />
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {isSettingsOpen && (
          <div className="profile-overlay" role="dialog" aria-modal="true" aria-label="Settings">
            <form className="profile-panel" onSubmit={saveSettings}>
              <div className="profile-panel-header">
                <div className="profile-avatar-large">
                  <Settings size={28} />
                </div>
                <div>
                  <span>Platform Settings</span>
                  <h2>Practice Controls</h2>
                  <p>Choose how GD rounds, voices, coaching, and free-tier request behavior should work.</p>
                </div>
                <button type="button" className="profile-close" onClick={() => setIsSettingsOpen(false)} title="Close settings">
                  <X size={18} />
                </button>
              </div>

              <div className="profile-form-grid">
                <label>
                  Target Industry
                  <select value={settingsDraft.targetIndustry || 'General / Academic'} onChange={(e) => updateSettingsDraft('targetIndustry', e.target.value)}>
                    <option>General / Academic</option>
                    <option>Technology</option>
                    <option>Finance</option>
                    <option>Consulting</option>
                    <option>Marketing</option>
                    <option>Operations</option>
                  </select>
                </label>
                <label>
                  Preferred Duration
                  <select value={settingsDraft.preferredDuration || '2 minutes'} onChange={(e) => updateSettingsDraft('preferredDuration', e.target.value)}>
                    <option>2 minutes</option>
                    <option>5 minutes</option>
                    <option>10 minutes</option>
                  </select>
                </label>
                <label>
                  AI Voice Mode
                  <select value={settingsDraft.voiceMode || 'Balanced AI voices'} onChange={(e) => updateSettingsDraft('voiceMode', e.target.value)}>
                    <option>Balanced AI voices</option>
                    <option>More challenging voices</option>
                    <option>Calmer coaching voices</option>
                    <option>Mute by default</option>
                  </select>
                </label>
                <label>
                  Coaching Intensity
                  <select value={settingsDraft.coachingIntensity || 'Balanced'} onChange={(e) => updateSettingsDraft('coachingIntensity', e.target.value)}>
                    <option>Gentle</option>
                    <option>Balanced</option>
                    <option>Strict evaluator</option>
                  </select>
                </label>
                <label>
                  Theme Preference
                  <select value={settingsDraft.themePreference || 'Professional light'} onChange={(e) => updateSettingsDraft('themePreference', e.target.value)}>
                    <option>Professional light</option>
                    <option>High contrast</option>
                    <option>Minimal focus</option>
                  </select>
                </label>
                <label>
                  Gemini Request Mode
                  <select value={settingsDraft.requestMode || 'Free-tier balanced'} onChange={(e) => updateSettingsDraft('requestMode', e.target.value)}>
                    <option>Free-tier balanced</option>
                    <option>Conservative requests</option>
                    <option>More responsive</option>
                  </select>
                </label>
              </div>

              <div className="profile-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={16} />
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        )}

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
      </main>
    </div>
  );
}
