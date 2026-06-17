import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import GDArena from './pages/GDArena';
import AnalyticsReport from './pages/AnalyticsReport';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { Sparkles, MessageCircle, LogOut, Users, BarChart2, Settings, ChevronLeft, ChevronRight, UserRound, X, Save, Target } from 'lucide-react';
import bgImage from './assets/bg-mountain.png';
import './App.css';

const DEFAULT_APP_SETTINGS = {
  targetIndustry: 'General / Academic',
  preferredDuration: '2 minutes',
  voiceMode: 'Balanced AI voices',
  themePreference: 'Professional light',
  coachingIntensity: 'Balanced',
  requestMode: 'Free-tier balanced',
  interfaceDensity: 'Comfortable',
  animationMode: 'Smooth animations',
  sidebarMode: 'Expanded sidebar',
  focusMode: 'Balanced workspace',
  chatScrollMode: 'Auto-scroll chat',
  soundEffects: 'On'
};

const getStoredSettings = () => {
  try {
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(localStorage.getItem('gd_settings')) || {}) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

const normalizeSettingToken = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  const [currentPage, setCurrentPage] = useState(() => currentUser ? 'dashboard' : 'landing'); // landing, login, signup, dashboard, arena, report
  const [activeSession, setActiveSession] = useState(null);
  const [dashboardSection, setDashboardSection] = useState('setup');
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
    return getStoredSettings();
  });
  const activeSettings = { ...DEFAULT_APP_SETTINGS, ...settingsDraft };

  const authHeaders = () => {
    const token = localStorage.getItem('gd_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadAccountData = async () => {
    const token = localStorage.getItem('gd_token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5000/api/user-data', {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Could not load account data');
      const data = await res.json();

      const savedUser = JSON.parse(localStorage.getItem('gd_user')) || currentUser || {};
      const mergedUser = { ...savedUser, ...(data.profile || {}) };
      localStorage.setItem('gd_user', JSON.stringify(mergedUser));
      const mergedSettings = { ...DEFAULT_APP_SETTINGS, ...(data.profile?.settings || {}) };
      if (data.profile?.settings) localStorage.setItem('gd_settings', JSON.stringify(mergedSettings));
      if (data.aiPersonas) localStorage.setItem('gd_ai_personas', JSON.stringify(data.aiPersonas));
      if (data.prepState?.checklist) localStorage.setItem('gd_prep_checklist', JSON.stringify(data.prepState.checklist));

      setCurrentUser(mergedUser);
      setProfileDraft(mergedUser);
      if (data.profile?.settings) setSettingsDraft(mergedSettings);
    } catch (error) {
      console.warn('Account sync unavailable, using local cache:', error.message);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const syncTimer = setTimeout(loadAccountData, 0);
      return () => clearTimeout(syncTimer);
    }
    return undefined;
  }, [currentUser?.id]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = normalizeSettingToken(activeSettings.themePreference || DEFAULT_APP_SETTINGS.themePreference);
    root.dataset.density = normalizeSettingToken(activeSettings.interfaceDensity || DEFAULT_APP_SETTINGS.interfaceDensity);
    root.dataset.motion = normalizeSettingToken(activeSettings.animationMode || DEFAULT_APP_SETTINGS.animationMode);
    root.dataset.focus = normalizeSettingToken(activeSettings.focusMode || DEFAULT_APP_SETTINGS.focusMode);
    root.dataset.sound = normalizeSettingToken(activeSettings.soundEffects || DEFAULT_APP_SETTINGS.soundEffects);
    root.dataset.chatScroll = normalizeSettingToken(activeSettings.chatScrollMode || DEFAULT_APP_SETTINGS.chatScrollMode);
  }, [
    activeSettings.themePreference,
    activeSettings.interfaceDensity,
    activeSettings.animationMode,
    activeSettings.focusMode,
    activeSettings.soundEffects,
    activeSettings.chatScrollMode
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeSettings.sidebarMode === 'Collapsed sidebar') setIsSidebarCollapsed(true);
      if (activeSettings.sidebarMode === 'Expanded sidebar') setIsSidebarCollapsed(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeSettings.sidebarMode]);

  const dashboardNavItems = [
    { id: 'setup', label: 'Start a GD', icon: Settings },
    { id: 'prep', label: 'Quick Practice', icon: Target },
    { id: 'innovation', label: 'Ask Community', icon: MessageCircle },
    { id: 'members', label: 'AI Panel', icon: Users },
    { id: 'history', label: 'My Progress', icon: BarChart2 }
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
    setTimeout(loadAccountData, 0);
  };

  const handleSignOut = () => {
    localStorage.removeItem('gd_user');
    localStorage.removeItem('gd_token');
    setCurrentUser(null);
    setActiveSession(null);
    setDashboardSection('setup');
    setCurrentPage('landing');
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
      targetIndustry: 'General / Academic',
      institution: '',
      location: '',
      speakingGoal: '',
      ...currentUser
    });
    setIsProfileOpen(true);
  };

  const openSettingsEditor = () => {
    setIsAccountMenuOpen(false);
    setSettingsDraft({
      ...DEFAULT_APP_SETTINGS,
      ...settingsDraft
    });
    setIsSettingsOpen(true);
  };

  const updateProfileDraft = (field, value) => {
    setProfileDraft(prev => ({ ...prev, [field]: value }));
  };

  const handleProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 750 * 1024) {
      alert('Please choose an image smaller than 750KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateProfileDraft('profilePhoto', reader.result);
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const updatedUser = {
      ...currentUser,
      ...profileDraft,
      name: String(profileDraft.name || currentUser?.name || '').trim() || 'User',
      email: String(profileDraft.email || currentUser?.email || '').trim()
    };

    localStorage.setItem('gd_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    try {
      await fetch('http://localhost:5000/api/user-data/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updatedUser)
      });
    } catch (error) {
      console.warn('Profile saved locally only:', error.message);
    }
    setIsProfileOpen(false);
  };

  const updateSettingsDraft = (field, value) => {
    setSettingsDraft(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    const nextSettings = { ...DEFAULT_APP_SETTINGS, ...settingsDraft };
    setSettingsDraft(nextSettings);
    localStorage.setItem('gd_settings', JSON.stringify(nextSettings));
    try {
      await fetch('http://localhost:5000/api/user-data/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ settings: nextSettings })
      });
    } catch (error) {
      console.warn('Settings saved locally only:', error.message);
    }
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

  if (currentPage === 'landing') {
    return (
      <Landing
        onSignIn={() => setCurrentPage('login')}
        onSignUp={() => setCurrentPage('signup')}
      />
    );
  }

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
          <div className="logo" style={{ color: 'white', marginBottom: '38px', cursor: 'pointer' }} onClick={() => goToDashboardSection('setup')}>
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
                <Users size={20} /> {!isSidebarCollapsed && 'Live Round'}
              </div>
            )}
          </div>
          
          <div 
            className="sidebar-signout"
            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.6, cursor: 'pointer', fontWeight: 500 }} 
            onClick={handleSignOut}
          >
            <LogOut size={20} /> {!isSidebarCollapsed && 'Log Out'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Header */}
        <nav className="navbar" style={{ padding: '20px 40px' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--secondary)' }}>
            {currentPage === 'dashboard' && 'Practice Workspace'}
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
                  <span className="profile-orbit-avatar">
                    {currentUser.profilePhoto ? (
                      <img src={currentUser.profilePhoto} alt={currentUser.name || 'Profile'} />
                    ) : (
                      currentUser.name?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </span>
                  <span className="profile-trigger-copy">
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.role || 'GD learner'}</small>
                  </span>
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
                  {profileDraft.profilePhoto ? (
                    <img src={profileDraft.profilePhoto} alt={profileDraft.name || 'Profile preview'} />
                  ) : (
                    profileDraft.name?.charAt(0)?.toUpperCase() || 'U'
                  )}
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

              <div className="profile-photo-row">
                <label className="profile-photo-upload">
                  Profile Photo
                  <input type="file" accept="image/*" onChange={handleProfilePhotoChange} />
                  <span>Choose image</span>
                </label>
                {profileDraft.profilePhoto && (
                  <button type="button" className="btn-secondary" onClick={() => updateProfileDraft('profilePhoto', '')}>
                    Remove Photo
                  </button>
                )}
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
                <label>
                  Target Industry
                  <select value={profileDraft.targetIndustry || 'General / Academic'} onChange={(e) => updateProfileDraft('targetIndustry', e.target.value)}>
                    <option>General / Academic</option>
                    <option>Technology</option>
                    <option>Finance</option>
                    <option>Consulting</option>
                    <option>Marketing</option>
                    <option>Operations</option>
                  </select>
                </label>
                <label>
                  Institution / Company
                  <input value={profileDraft.institution || ''} onChange={(e) => updateProfileDraft('institution', e.target.value)} />
                </label>
                <label>
                  Location
                  <input value={profileDraft.location || ''} onChange={(e) => updateProfileDraft('location', e.target.value)} />
                </label>
              </div>

              <label className="profile-notes">
                Speaking Goal
                <textarea
                  value={profileDraft.speakingGoal || ''}
                  onChange={(e) => updateProfileDraft('speakingGoal', e.target.value)}
                  placeholder="Example: I want to speak first, use examples, and handle aggressive participants calmly."
                />
              </label>

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
                <label>
                  Interface Density
                  <select value={settingsDraft.interfaceDensity || 'Comfortable'} onChange={(e) => updateSettingsDraft('interfaceDensity', e.target.value)}>
                    <option>Comfortable</option>
                    <option>Compact</option>
                    <option>Spacious</option>
                  </select>
                </label>
                <label>
                  Animation Mode
                  <select value={settingsDraft.animationMode || 'Smooth animations'} onChange={(e) => updateSettingsDraft('animationMode', e.target.value)}>
                    <option>Smooth animations</option>
                    <option>Reduced motion</option>
                  </select>
                </label>
                <label>
                  Sidebar Behavior
                  <select value={settingsDraft.sidebarMode || 'Expanded sidebar'} onChange={(e) => updateSettingsDraft('sidebarMode', e.target.value)}>
                    <option>Expanded sidebar</option>
                    <option>Collapsed sidebar</option>
                    <option>Manual sidebar</option>
                  </select>
                </label>
                <label>
                  Focus Mode
                  <select value={settingsDraft.focusMode || 'Balanced workspace'} onChange={(e) => updateSettingsDraft('focusMode', e.target.value)}>
                    <option>Balanced workspace</option>
                    <option>Calm reading</option>
                    <option>High energy practice</option>
                  </select>
                </label>
                <label>
                  Chat Scrolling
                  <select value={settingsDraft.chatScrollMode || 'Auto-scroll chat'} onChange={(e) => updateSettingsDraft('chatScrollMode', e.target.value)}>
                    <option>Auto-scroll chat</option>
                    <option>Manual chat scroll</option>
                  </select>
                </label>
                <label>
                  Sound Effects
                  <select value={settingsDraft.soundEffects || 'On'} onChange={(e) => updateSettingsDraft('soundEffects', e.target.value)}>
                    <option>On</option>
                    <option>Off</option>
                  </select>
                </label>
              </div>

              <div className="settings-live-preview">
                <span>Live Preview</span>
                <strong>{activeSettings.themePreference} · {activeSettings.interfaceDensity}</strong>
                <p>
                  Theme, spacing, motion, and sidebar behavior update immediately. Round defaults apply when you open Start a GD.
                </p>
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
              currentUser={currentUser}
              appSettings={activeSettings}
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
