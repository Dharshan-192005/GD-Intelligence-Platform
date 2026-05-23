import { ArrowLeft, Award, Zap, Smile, MessageSquare, Camera, ArrowRight } from 'lucide-react';

const asScore = (value) => Math.max(0, Math.min(100, Number(value) || 0));

// Render a clean circular gauge using SVG
const CircularGauge = ({ score, label, color, icon: Icon }) => {
  const safeScore = asScore(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flat-card" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '20px',
      flex: 1,
      minWidth: '180px'
    }}>
      <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '12px' }}>
        <svg style={{ transform: 'rotate(-90deg)', width: '100px', height: '100px' }}>
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <Icon size={18} style={{ color, marginBottom: '2px' }} />
          <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{safeScore}</span>
        </div>
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
    </div>
  );
};

export default function AnalyticsReport({ session, onBack }) {
  if (!session) {
    return (
      <div className="flat-card" style={{ maxWidth: '600px', margin: '100px auto', padding: '40px', textAlign: 'center' }}>
        <h2>Loading Analytics...</h2>
        <p>Diagnostics analysis could not be retrieved. Please go back and try again.</p>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '20px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const {
    aiEvaluation = {},
    userMetrics = {},
    participationBreakdown = [],
    topic = 'Untitled discussion',
    durationLimit = 0
  } = session;

  const report = {
    leadershipScore: asScore(aiEvaluation.leadershipScore),
    confidenceScore: asScore(aiEvaluation.confidenceScore),
    effectivenessScore: asScore(aiEvaluation.effectivenessScore),
    analysisSummary: aiEvaluation.analysisSummary || 'The coaching report is still being prepared.',
    strengths: Array.isArray(aiEvaluation.strengths) ? aiEvaluation.strengths : [],
    weaknesses: Array.isArray(aiEvaluation.weaknesses) ? aiEvaluation.weaknesses : [],
    actionableTips: Array.isArray(aiEvaluation.actionableTips) ? aiEvaluation.actionableTips : [],
    topicRelevance: aiEvaluation.topicRelevance || 'Topic relevance was not available for this session.',
    argumentDepth: aiEvaluation.argumentDepth || 'Argument depth was not available for this session.',
    suggestedPhrases: Array.isArray(aiEvaluation.suggestedPhrases) ? aiEvaluation.suggestedPhrases : []
  };

  // Determine speaking rate assessment
  const getPacingText = (wpm) => {
    if (wpm > 150) return { label: 'Fast Paced', color: 'var(--accent-red)' };
    if (wpm < 100) return { label: 'Slow/Deliberate', color: 'var(--accent-yellow)' };
    return { label: 'Conversational (Ideal)', color: 'var(--accent-green)' };
  };

  const pacingInfo = getPacingText(userMetrics.pacingWpm || 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Back navigation */}
      <button onClick={onBack} className="btn-secondary" style={{ marginBottom: '25px' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Top Banner Overview */}
      <div className="flat-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 30px',
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <span className="badge badge-success" style={{ marginBottom: '6px', display: 'inline-block' }}>
            Coaching Assessment Completed
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>{topic}</h1>
          <p style={{ fontSize: '0.95rem' }}>Duration practiced: {durationLimit} minutes</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <Award size={36} style={{ color: 'var(--secondary)' }} />
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL COHERENCE</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green)' }}>
              {Math.round((report.leadershipScore + report.confidenceScore + report.effectivenessScore) / 3)}%
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 4 Core Gauges */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <CircularGauge score={report.leadershipScore} label="Leadership presence" color="#c084fc" icon={Award} />
        <CircularGauge score={report.confidenceScore} label="Confidence Index" color="#22d3ee" icon={Zap} />
        <CircularGauge score={report.effectivenessScore} label="Communication Effectiveness" color="#34d399" icon={Smile} />
        <CircularGauge score={userMetrics.bodyLanguageScore || 0} label="Visual Presence" color="#f59e0b" icon={Camera} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '30px', alignItems: 'start', marginBottom: '30px' }}>
        
        {/* Left Column: Qualitative analysis from Coach */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Executive coach review */}
          <div className="flat-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>
              Executive Coach Summary
            </h2>
            <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
              "{report.analysisSummary}"
            </p>
          </div>

          {/* Strengths & Weaknesses Accordion Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Strengths Card */}
            <div className="flat-card" style={{ borderTop: '4px solid var(--accent-green)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '15px' }}>
                Key Strengths
              </h3>
              <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {report.strengths.map((str, idx) => (
                  <li key={idx} style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.4' }}>{str}</li>
                ))}
              </ul>
            </div>

            {/* Areas of Improvement Card */}
            <div className="flat-card" style={{ borderTop: '4px solid var(--accent-red)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '15px' }}>
                Areas for Friction
              </h3>
              <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {report.weaknesses.map((weak, idx) => (
                  <li key={idx} style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.4' }}>{weak}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* Actionable Training Program Panel */}
          <div className="flat-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '15px' }}>
              Actionable Coaching Tips
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {report.actionableTips.map((tip, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {idx + 1}
                  </div>
                  <p style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-main)' }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Topic relevance assessments */}
          <div className="flat-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '15px' }}>
              Topic & Argument Quality Analysis
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '4px' }}>Topic Relevance</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{report.topicRelevance}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '4px' }}>Argument Depth & Structure</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{report.argumentDepth}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Quantitative Speaking Stats & Graphs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Key speech metrics counters */}
          <div className="flat-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '15px' }}>
              Speech Statistics
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SPEAKING TIME</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{userMetrics.speakingTime} seconds</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Share: {userMetrics.speakPercentage}% of debate</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SPEECH PACING</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: pacingInfo.color }}>{userMetrics.pacingWpm} WPM</div>
                <div style={{ fontSize: '0.7rem', color: pacingInfo.color, fontWeight: 600 }}>{pacingInfo.label}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>INTERRUPTIONS MADE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: userMetrics.interruptionCount > 2 ? 'var(--accent-red)' : 'var(--text-main)' }}>
                  {userMetrics.interruptionCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Overlapped other speakers</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>FILLER WORDS COUNT</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: userMetrics.fillerWordCount > 4 ? 'var(--accent-yellow)' : 'var(--text-main)' }}>
                  {userMetrics.fillerWordCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>'uh', 'um', 'like', etc.</div>
              </div>

            </div>
          </div>

          {/* Table participation breakdown horizontal bars (using native SVG) */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>
              Floor Share Breakdown
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {participationBreakdown.map((item, idx) => {
                const color = item.name === 'User' ? 'var(--accent-green)' : 
                              item.name === 'Sam' ? '#f43f5e' :
                              item.name === 'Meera' ? '#06b6d4' :
                              item.name === 'Leo' ? '#10b981' : '#f59e0b';
                
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{item.name === 'User' ? 'You' : item.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{item.speakingTime}s ({item.percentage}%)</span>
                    </div>
                    {/* SVG horizontal bar chart */}
                    <svg width="100%" height="8">
                      <rect width="100%" height="8" rx="4" fill="rgba(255,255,255,0.05)" />
                      <rect width={`${item.percentage}%`} height="8" rx="4" fill={color} />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Suggested phrasing comparison section */}
      {report.suggestedPhrases.length > 0 && (
        <div className="glass-card" style={{ marginTop: '30px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare style={{ color: 'var(--primary)', fill: 'var(--primary)', fillOpacity: 0.2 }} />
            Actionable Phrase Rewrites (Before & After)
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {report.suggestedPhrases.map((phrase, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'stretch' }}>
                  
                  {/* Before (Original) */}
                  <div style={{ padding: '20px', background: 'rgba(244, 63, 94, 0.03)', borderRight: '1px dashed var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        What You Expressed
                      </span>
                    </div>
                    <p style={{ fontSize: '0.95rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>"{phrase.original}"</p>
                  </div>

                  {/* Divider Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', background: 'var(--bg-main)', zIndex: 1, margin: '0 -20px' }}>
                    <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '50%', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <ArrowRight size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                  </div>

                  {/* After (Improved) */}
                  <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.03)', borderLeft: '1px dashed var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Polished Executive Phrase
                      </span>
                    </div>
                    <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>"{phrase.improved}"</p>
                  </div>

                </div>

                {/* Reason / Insight Footer */}
                <div style={{ background: 'rgba(139, 92, 246, 0.03)', padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Zap size={16} style={{ color: 'var(--primary)', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Coaching Insight</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{phrase.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom control */}
      <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '50px' }}>
        <button onClick={onBack} className="btn-primary" style={{ padding: '14px 30px' }}>
          Back to Dashboard
        </button>
      </div>

    </div>
  );
}
