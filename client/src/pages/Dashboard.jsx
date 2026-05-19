import React, { useState, useEffect } from 'react';
import { Play, Sparkles, BookOpen, Clock, Users, Calendar, BarChart2, AlertCircle } from 'lucide-react';

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

export default function Dashboard({ onStartSession, onViewReport }) {
  const [topic, setTopic] = useState(SUGGESTED_TOPICS[0]);
  const [duration, setDuration] = useState(2); // default 2 minutes for testing
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://localhost:5000/api/sessions/history');
      if (!res.ok) throw new Error('Failed to fetch historical runs.');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.warn('Backend server connection failed on dashboard history fetch:', err.message);
      setError('Could not connect to the backend server. Running in standalone local sandbox mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('http://localhost:5000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, durationLimit: duration })
      });

      if (!res.ok) throw new Error('Failed to initialize session');
      const session = await res.json();
      onStartSession(session);
    } catch (err) {
      console.error(err);
      // Resilient Client Sandbox: Create a mock session directly if backend fails to respond
      const mockSession = {
        _id: 'mock_' + Math.random().toString(36).substring(2, 9),
        topic,
        durationLimit: duration,
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      
      {/* Welcome Banner */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '10px' }}>
          Group Discussion Intelligence Platform
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto' }}>
          Practice competitive group discussions against diverse, interactive AI personas. Get real-time speech analytics, interruption metrics, and executive communication coaching.
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '30px',
          color: 'var(--accent-yellow)'
        }}>
          <AlertCircle size={24} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>Server Status Warning</strong>
            <span style={{ fontSize: '0.9rem' }}>{error} App will proceed using client-side simulation.</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* GD Configurator Form */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Configure Discussion</h2>
          </div>

          <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Topic Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                DISCUSSION TOPIC
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter custom discussion topic..."
                required
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px',
                  color: 'var(--text-main)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'var(--transition-smooth)'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>

            {/* Trending Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                OR SELECT A TRENDING TOPIC:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SUGGESTED_TOPICS.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopic(t)}
                    style={{
                      background: topic === t ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: topic === t ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      color: topic === t ? '#c084fc' : 'var(--text-muted)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                ROUND DURATION
              </label>
              <div style={{ display: 'flex', gap: '15px' }}>
                {[2, 5, 10].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      background: duration === m ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: duration === m ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                      color: duration === m ? '#22d3ee' : 'var(--text-main)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <Clock size={16} />
                    {m} Minutes
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                justifyContent: 'center',
                fontSize: '1.1rem',
                marginTop: '10px'
              }}
            >
              <Play fill="white" size={18} />
              {isSubmitting ? 'Starting...' : 'Enter Virtual GD Round'}
            </button>
          </form>
        </div>

        {/* AI Participants List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '5px' }}>
            <Users style={{ color: 'var(--secondary)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Your AI Group Members</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {PARTICIPANTS.map((p, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  gap: '15px',
                  alignItems: 'start',
                  borderLeft: `4px solid ${p.color}`
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: p.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  boxShadow: `0 0 10px ${p.color}44`
                }}>
                  {p.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{p.name}</h3>
                    <span className="badge" style={{
                      background: `${p.color}15`,
                      color: p.color,
                      border: `1px solid ${p.color}33`,
                      fontSize: '0.7rem'
                    }}>{p.role}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Discussion History */}
      <div style={{ marginTop: '50px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '5px' }}>
          <BarChart2 style={{ color: 'var(--accent-green)' }} />
          <h2 style={{ fontSize: '1.5rem' }}>Your Discussion Intelligence History</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading historical performance...
          </div>
        ) : history.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Calendar size={40} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            <p>No group discussions found. Complete your first practice round above!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            {history.map((h) => {
              const score = h.aiEvaluation ? Math.round((h.aiEvaluation.leadershipScore + h.aiEvaluation.confidenceScore + h.aiEvaluation.effectivenessScore) / 3) : 0;
              return (
                <div
                  key={h._id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    gap: '20px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="badge badge-primary">{h.durationLimit} min round</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(h.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'white' }}>{h.topic}</h3>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    
                    {/* Performance metrics display */}
                    {h.aiEvaluation && (
                      <div style={{ display: 'flex', gap: '15px', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>LEADERSHIP</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc' }}>{h.aiEvaluation.leadershipScore}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONFIDENCE</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22d3ee' }}>{h.aiEvaluation.confidenceScore}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>EFFECTIVE</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{h.aiEvaluation.effectivenessScore}</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL COHERENCE</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: score > 75 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                          {score ? `${score}%` : 'Pending'}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onViewReport(h._id)}
                        className="btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                      >
                        View Coaching
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
