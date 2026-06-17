import { ArrowRight, BarChart2, Bot, MessageCircle, Mic, ShieldCheck, Sparkles, Users } from 'lucide-react';
import bgImage from '../assets/bg-mountain.png';

export default function Landing({ onSignIn, onSignUp }) {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <button type="button" className="landing-brand" onClick={onSignUp}>
          <MessageCircle size={28} />
          <span>GD Intelligence</span>
        </button>
        <div className="landing-nav-links" aria-label="Landing navigation">
          <a href="#home">Home</a>
          <a href="#practice">Practice</a>
          <a href="#strategy">Strategy</a>
          <a href="#analytics">Analytics</a>
          <a href="#community">Community</a>
        </div>
        <div className="landing-nav-actions">
          <button type="button" className="landing-ghost" onClick={onSignIn}>Sign in</button>
          <button type="button" className="landing-solid" onClick={onSignUp}>Join free</button>
        </div>
      </nav>

      <section id="home" className="landing-hero" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="landing-hero-content">
          <h1>Build Your Group Discussion Confidence</h1>
          <p>
            Practice with AI panel members, receive instant coaching, and improve your speaking structure
            before placement, MBA, and interview group discussions.
          </p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-primary" onClick={onSignUp}>
              Start Practice
            </button>
          </div>
          <div className="landing-slider-dots" aria-hidden="true">
            <span className="is-active" />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section id="practice" className="landing-overview">
        <div className="landing-speed-copy">
          <span className="landing-eyebrow"><Sparkles size={16} /> AI GD Training</span>
          <h2>Realistic practice, faster improvement</h2>
          <p>
            GD Intelligence gives you a guided practice workspace with custom AI participants,
            live response coaching, personal progress tracking, and a community forum for doubts.
            The experience is designed for students who want practical speaking improvement,
            not just static tips.
          </p>
          <div className="landing-mini-features">
            <span><Users size={17} /> Custom panel</span>
            <span><Mic size={17} /> Voice practice</span>
            <span><ShieldCheck size={17} /> Account sync</span>
          </div>
        </div>

        <div id="analytics" className="landing-metric-board">
          <div className="landing-metric-card">
            <strong>AI Panel</strong>
            <b>6+</b>
            <span>personality styles</span>
          </div>
          <div className="landing-metric-card">
            <strong>Live Coach</strong>
            <b>60s</b>
            <span>mini practice mode</span>
          </div>
          <div className="landing-metric-card">
            <strong>Progress</strong>
            <b>100%</b>
            <span>user specific history</span>
          </div>
        </div>
      </section>

      <section id="strategy" className="landing-feature-strip">
        <article>
          <Bot />
          <h3>Personal AI members</h3>
          <p>Edit personality, pressure, speech style, and opening behavior for every GD participant.</p>
        </article>
        <article>
          <BarChart2 />
          <h3>Performance analytics</h3>
          <p>Review confidence, leadership, clarity, filler words, interruptions, and progress history.</p>
        </article>
        <article id="community">
          <MessageCircle />
          <h3>Community forum</h3>
          <p>Post GD doubts, comment on answers, and collect helpful suggestions from other users.</p>
        </article>
      </section>

      <section className="landing-bottom-band">
          <div>
            <h3>Ready to enter your first GD room?</h3>
            <p>Your profile, practice data, forum posts, custom AI panel, and reports stay synced to your account.</p>
          </div>
          <button type="button" className="landing-primary" onClick={onSignUp}>
            Create free account <ArrowRight size={18} />
          </button>
      </section>
    </main>
  );
}
