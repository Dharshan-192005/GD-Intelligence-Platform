import { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Sparkles, Clock, Users, Calendar, BarChart2, AlertCircle, TrendingUp, Upload, FileText, RefreshCw, Settings, Home } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const SUGGESTED_TOPICS = [
  "AI: A Boon or a Bane for Employment?",
  "Work from Home vs. Office: The Future of Workspace",
  "Social Media: Connecting People or Deepening Loneliness?",
  "Electric Vehicles: The Ultimate Solution to Pollution?"
];

const PARTICIPANTS = [
  { name: 'Sam', role: 'The Dominator', style: 'Aggressive & Assertive', color: '#f43f5e', desc: 'Interrupts frequently, speaks fast, forces other speakers to be bold and stand their ground.' },
  { name: 'Meera', role: 'The Analyst', style: 'Structured & Fact-driven', color: '#06b6d4', desc: 'Provides hard data, studies, and logical flow. Pushes you to use structured points and facts.' },
  { name: 'Leo', role: 'The Harmonizer', style: 'Encouraging & Mediator', color: '#10b981', desc: 'Bridges arguments, encourages quieter speakers, and helps the group build a collective consensus.' },
  { name: 'Kabir', role: 'The Skeptic', style: 'Devil\'s Advocate', color: '#f59e0b', desc: 'Questions foundational assumptions, points out logical fallacies, and demands solid justifications.' }
];

const INDUSTRY_CONTEXTS = [
  "General / Academic",
  "Corporate Strategy",
  "Tech Startup / Agile",
  "MBA Admissions",
  "Creative Agency"
];

const REAL_GD_FEATURES = [
  {
    title: "Turn-Based Live Dialogue",
    description: "AI members wait, respond to the latest point, and avoid duplicate replies.",
    status: "Active",
    icon: Users
  },
  {
    title: "Free-Tier Guard",
    description: "Gemini calls are queued and spaced with a configurable RPM limit.",
    status: "Protected",
    icon: RefreshCw
  },
  {
    title: "Live Quality Coach",
    description: "Relevance, clarity, and next-move feedback update during the round.",
    status: "Realtime",
    icon: Sparkles
  },
  {
    title: "Final Executive Report",
    description: "Full-session transcript analysis runs once after the GD ends.",
    status: "On finish",
    icon: BarChart2
  }
];

export default function Dashboard({ onStartSession, onViewReport, activeSection = 'overview', onChangeSection }) {
  const [topic, setTopic] = useState(SUGGESTED_TOPICS[0]);
  const [industryContext, setIndustryContext] = useState(INDUSTRY_CONTEXTS[0]);
  const [duration, setDuration] = useState(2);
  const [numParticipants, setNumParticipants] = useState(4);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeTopics, setResumeTopics] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem('gd_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const activeParticipants = useMemo(() => PARTICIPANTS.slice(0, numParticipants), [numParticipants]);
  const completedRuns = history.filter((item) => item.aiEvaluation);
  const latestScore = completedRuns.length
    ? Math.round(completedRuns.reduce((total, item) => {
        return total + item.aiEvaluation.leadershipScore + item.aiEvaluation.confidenceScore + item.aiEvaluation.effectivenessScore;
      }, 0) / (completedRuns.length * 3))
    : 0;

  async function fetchHistory() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://localhost:5000/api/sessions/history', {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch historical runs.');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.warn('Backend server connection failed on dashboard history fetch:', err.message);
      setError('Could not connect to the backend server. Running in standalone local sandbox mode.');
    } finally {
      setLoading(false);
    }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append('resume', file);

      const res = await fetch('http://localhost:5000/api/topics/from-resume', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });

      if (!res.ok) throw new Error('Failed to generate topics from resume');
      const data = await res.json();
      setResumeTopics(data.topics);
      if (data.topics && data.topics.length > 0) setTopic(data.topics[0]);
    } catch (err) {
      console.error('Resume upload error:', err);
      setUploadError('Failed to generate AI topics from resume.');
      const mockTopics = [
        "Analyzing Your Core Competencies Against Market Trends",
        "Strategic Pivots: Bridging Your Past Experience to Future Tech",
        "Leadership & Execution: A Discussion on Your Career Trajectory"
      ];
      setResumeTopics(mockTopics);
      setTopic(mockTopics[0]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('http://localhost:5000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ topic, durationLimit: duration, industryContext, numParticipants })
      });

      if (!res.ok) throw new Error('Failed to initialize session');
      const session = await res.json();
      onStartSession(session);
    } catch (err) {
      console.error(err);
      const mockSession = {
        _id: 'mock_' + Math.random().toString(36).substring(2, 9),
        topic,
        industryContext,
        durationLimit: duration,
        numParticipants,
        createdAt: new Date(),
        transcript: [],
        userMetrics: { speakingTime: 0, speakPercentage: 0, interruptionCount: 0, interruptedCount: 0, pacingWpm: 0, fillerWordCount: 0 },
        participationBreakdown: [],
        aiEvaluation: null,
        isCompleted: false
      };
      onStartSession(mockSession);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title, description, action }) => (
    <div className="dashboard-section-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 800, marginBottom: '6px' }}>
          <Icon size={22} />
          <span style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Dashboard Feature</span>
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );

  const renderTopicButtons = (items, type) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {items.map((item, idx) => {
        const isSelected = topic === item;
        const selectedColor = type === 'resume' ? 'var(--accent-green)' : 'var(--primary)';

        return (
          <button
            key={`${type}-${idx}`}
            type="button"
            onClick={() => setTopic(item)}
            style={{
              background: isSelected ? `${selectedColor}15` : '#ffffff',
              border: isSelected ? `1px solid ${selectedColor}` : '1px solid var(--border-color)',
              color: isSelected ? selectedColor : 'var(--text-muted)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
              textAlign: 'left'
            }}
          >
            {type === 'resume' && <FileText size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />}
            {item}
          </button>
        );
      })}
    </div>
  );

  const renderSetup = () => (
    <>
      <div className="setup-studio-hero">
        <div>
          <div className="setup-eyebrow"><Settings size={18} /> Practice Builder</div>
          <h1>Design your GD round</h1>
          <p>Shape the topic, choose the room pressure, and launch a timed AI panel discussion.</p>
        </div>
        <div className="setup-hero-stat">
          <span>{numParticipants}</span>
          <small>AI voices</small>
        </div>
      </div>

      <form onSubmit={handleStart} className="setup-studio-grid">
        <aside className="setup-rail">
          <div className="setup-step setup-step-active">
            <span>01</span>
            <div><strong>Topic</strong><small>{topic ? 'Selected' : 'Required'}</small></div>
          </div>
          <div className="setup-step">
            <span>02</span>
            <div><strong>Context</strong><small>{industryContext}</small></div>
          </div>
          <div className="setup-step">
            <span>03</span>
            <div><strong>Room</strong><small>{numParticipants} members · {duration} min</small></div>
          </div>

          <div className="setup-rail-note">
            <Sparkles size={18} />
            <p>Resume topics and live coaching use guarded Gemini calls to stay within free-tier limits.</p>
          </div>
        </aside>

        <section className="setup-topic-board">
          <div className="setup-panel-header">
            <div>
              <h2>Topic Workspace</h2>
              <p>Start from a current prompt or write your own discussion statement.</p>
            </div>
          </div>

          <div className="setup-field">
            <label>Discussion Topic</label>
            <div className="setup-topic-input">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter custom discussion topic..."
                required
              />
              <Sparkles size={20} />
            </div>
          </div>

          <div className="setup-field">
            <label>Trending Topics</label>
            <div className="setup-topic-list">
              {SUGGESTED_TOPICS.map((item, idx) => (
                <button
                  key={`sug-${idx}`}
                  type="button"
                  onClick={() => setTopic(item)}
                  className={`setup-topic-choice ${topic === item ? 'setup-topic-choice-active' : ''}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-resume-strip">
            <div>
              <strong><Sparkles size={15} /> AI topics from resume</strong>
              <p>Upload PDF/TXT to generate role-specific discussion topics.</p>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="btn-secondary">
              {isUploading ? <><span className="spinning-icon"><RefreshCw size={14} /></span> Analyzing...</> : <><Upload size={14} /> Upload</>}
            </button>
            <input type="file" accept=".pdf,.txt" ref={fileInputRef} style={{ display: 'none' }} onChange={handleResumeUpload} />
          </div>

          {uploadError && <div className="setup-error">{uploadError}</div>}
          {resumeTopics.length > 0 && (
            <div className="setup-field">
              <label>Resume Suggestions</label>
              {renderTopicButtons(resumeTopics, 'resume')}
            </div>
          )}
        </section>

        <aside className="setup-launch-dock">
          <div className="setup-panel-header">
            <div>
              <h2>Round Settings</h2>
              <p>Tune the challenge level before launch.</p>
            </div>
          </div>

          <div className="setup-field">
            <label>Industry Context</label>
            <select className="input-field" value={industryContext} onChange={(e) => setIndustryContext(e.target.value)}>
              {INDUSTRY_CONTEXTS.map((ctx) => <option key={ctx} value={ctx}>{ctx}</option>)}
            </select>
          </div>

          <div className="setup-field">
            <label>AI Participants</label>
            <div className="setup-segmented">
              {[2, 3, 4].map((num) => (
                <button key={num} type="button" onClick={() => setNumParticipants(num)} className={numParticipants === num ? 'is-active' : ''}>
                  <Users size={16} /> {num}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-field">
            <label>Duration</label>
            <div className="setup-segmented">
              {[2, 5, 10].map((m) => (
                <button key={m} type="button" onClick={() => setDuration(m)} className={duration === m ? 'is-active' : ''}>
                  <Clock size={16} /> {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="setup-preview-card">
            <span>Current brief</span>
            <h3>{topic}</h3>
            <div>
              <small>{industryContext}</small>
              <small>{numParticipants} AI · {duration} min</small>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary setup-launch-button">
            <Play fill="white" size={18} />
            {isSubmitting ? 'Starting...' : 'Enter Virtual GD Round'}
          </button>
        </aside>
      </form>
    </>
  );

  const renderMembers = () => (
    <>
      <SectionHeader
        icon={Users}
        title="AI Group Members"
        description="Review the personas that will challenge your structure, pace, confidence, and conflict handling."
        action={<button className="btn-primary" type="button" onClick={() => onChangeSection?.('setup')}><Settings size={16} /> Configure Round</button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {activeParticipants.map((participant) => (
          <div key={participant.name} className="flat-card" style={{ borderLeft: `4px solid ${participant.color}` }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: participant.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
                boxShadow: `0 0 12px ${participant.color}44`
              }}>
                {participant.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <h3>{participant.name}</h3>
                  <span className="badge" style={{ background: `${participant.color}15`, color: participant.color, border: `1px solid ${participant.color}33`, fontSize: '0.68rem' }}>{participant.role}</span>
                </div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{participant.desc}</p>
                <div style={{ marginTop: '14px', color: participant.color, fontWeight: 700, fontSize: '0.84rem' }}>{participant.style}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderHistory = () => (
    <>
      <SectionHeader
        icon={BarChart2}
        title="Discussion Intelligence History"
        description="Track previous rounds, coaching scores, and performance trends from completed sessions."
        action={<button className="btn-secondary" type="button" onClick={fetchHistory}><RefreshCw size={16} /> Refresh</button>}
      />

      {loading ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading historical performance...</div>
      ) : history.length === 0 ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Calendar size={40} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
          <p>No group discussions found. Complete your first practice round from Setup GD.</p>
        </div>
      ) : (
        <>
          <div className="flat-card" style={{ marginBottom: '24px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <TrendingUp style={{ color: 'var(--primary)' }} size={20} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Performance Over Time</h3>
            </div>
            <div style={{ height: '260px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...history].reverse().filter((h) => h.aiEvaluation).map((h, i) => ({
                  name: `S${i + 1}`,
                  Leadership: h.aiEvaluation.leadershipScore,
                  Confidence: h.aiEvaluation.confidenceScore,
                  Effectiveness: h.aiEvaluation.effectivenessScore
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Leadership" stroke="#c084fc" strokeWidth={3} dot={{ r: 4, fill: '#c084fc', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Confidence" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Effectiveness" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {history.map((item) => {
              const score = item.aiEvaluation
                ? Math.round((item.aiEvaluation.leadershipScore + item.aiEvaluation.confidenceScore + item.aiEvaluation.effectivenessScore) / 3)
                : 0;

              return (
                <div key={item._id} className="flat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="badge badge-primary">{item.durationLimit} min round</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>{item.topic}</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>OVERALL</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: score > 75 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                        {score ? `${score}%` : 'Pending'}
                      </div>
                    </div>
                    <button onClick={() => onViewReport(item._id)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '8px' }}>
                      View Coaching
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  const renderOverview = () => (
    <>
      <div className="dashboard-hero">
        <h1>Group Discussion Intelligence Platform</h1>
        <p>
          Practice competitive group discussions against diverse AI personas, then review speech analytics,
          interruption patterns, and executive communication coaching.
        </p>
      </div>

      <div className="feature-grid">
        <button className="flat-card feature-card-button" type="button" onClick={() => onChangeSection?.('setup')}>
          <Settings color="var(--primary)" />
          <h3>Setup GD</h3>
          <p>Create a topic, choose context, set duration, and start the round.</p>
        </button>
        <button className="flat-card feature-card-button" type="button" onClick={() => onChangeSection?.('members')}>
          <Users color="var(--secondary)" />
          <h3>AI Members</h3>
          <p>See the different discussion personalities before you enter.</p>
        </button>
        <button className="flat-card feature-card-button" type="button" onClick={() => onChangeSection?.('history')}>
          <BarChart2 color="var(--accent-green)" />
          <h3>History</h3>
          <p>Open past sessions and review coaching reports.</p>
        </button>
        <div className="flat-card feature-card-button" style={{ cursor: 'default' }}>
          <Home color="var(--accent-yellow)" />
          <h3>{history.length || 0} Sessions</h3>
          <p>{latestScore ? `${latestScore}% average coaching score` : 'No completed scores yet'}</p>
        </div>
      </div>

      <div className="professional-band">
        <div className="flat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Sparkles color="var(--primary)" />
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Real GD Toolkit</h2>
              <p style={{ fontSize: '0.9rem' }}>Built to feel live while keeping API calls controlled.</p>
            </div>
          </div>

          <div className="toolkit-list">
            {REAL_GD_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="toolkit-row">
                  <div className="toolkit-icon"><Icon size={18} /></div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{feature.title}</h3>
                    <p style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>{feature.description}</p>
                  </div>
                  <span className="badge badge-success" style={{ whiteSpace: 'nowrap' }}>{feature.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Clock color="var(--accent-blue)" />
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Quota Strategy</h2>
              <p style={{ fontSize: '0.9rem' }}>Designed for Gemini free-tier discipline.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                <span>Default request ceiling</span>
                <span>10 RPM</span>
              </div>
              <div className="quota-meter" style={{ '--meter-width': '67%' }}><span /></div>
            </div>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
              Live coaching is throttled, moderation checks every few turns, and the full report is generated only once at the end.
            </p>
            <button className="btn-primary" type="button" onClick={() => onChangeSection?.('setup')} style={{ width: '100%' }}>
              <Play size={16} fill="white" /> Start Structured Practice
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="dashboard-shell">
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          color: 'var(--accent-yellow)'
        }}>
          <AlertCircle size={24} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>Server Status Warning</strong>
            <span style={{ fontSize: '0.9rem' }}>{error} App will proceed using client-side simulation.</span>
          </div>
        </div>
      )}

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'setup' && renderSetup()}
      {activeSection === 'members' && renderMembers()}
      {activeSection === 'history' && renderHistory()}
    </div>
  );
}
