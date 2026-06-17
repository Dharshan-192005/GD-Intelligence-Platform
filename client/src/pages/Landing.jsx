import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart2, Bot, BrainCircuit, CheckCircle2, MessageCircle, Mic, ShieldCheck, Target, Users } from 'lucide-react';
import bgImage from '../assets/bg-mountain.png';

const heroSlides = [
  {
    position: 'left center'
  },
  {
    position: 'center center'
  },
  {
    position: 'right center'
  }
];

const landingSections = {
  home: {
    eyebrow: 'Platform Overview',
    title: 'A complete GD preparation workspace',
    text: 'SpeakEdge GD combines AI practice rooms, custom panel members, mini coaching, performance analytics, and a community forum so your preparation is active instead of static.',
    chips: ['AI panel', 'Live coaching', 'Personal history'],
    metrics: [
      ['AI Panel', '6+', 'personality styles'],
      ['Mini Coach', '60s', 'warm-up practice'],
      ['Sync', '100%', 'account based data']
    ]
  },
  practice: {
    eyebrow: 'Practice Room',
    title: 'Speak, type, pause, and improve inside a realistic GD',
    text: 'Start a timed group discussion, use your microphone or text box, receive AI participant replies, and keep notes while the round progresses.',
    chips: ['Voice input', 'Timed rounds', 'Notes popup'],
    metrics: [
      ['Rounds', '2m', '5m and 10m'],
      ['Coach', 'Live', 'response hints'],
      ['Chat', 'Auto', 'scrolling feed']
    ]
  },
  strategy: {
    eyebrow: 'GD Strategy',
    title: 'Prepare strong openings, counters, examples, and summaries',
    text: 'Use quick practice drills to learn how to enter early, disagree politely, support points with evidence, and close the discussion clearly.',
    chips: ['Opening lines', 'Counter moves', 'Evidence bank'],
    metrics: [
      ['Formula', 'PREL', 'point reason example link'],
      ['Focus', '4', 'task checklist'],
      ['Coach', '1:1', 'teacher style guidance']
    ]
  },
  analytics: {
    eyebrow: 'Performance Analytics',
    title: 'Understand your speaking performance from real session history',
    text: 'After every round, review leadership, confidence, communication effectiveness, interruptions, speaking time, pacing, and progress trends.',
    chips: ['Score reports', 'Trend graph', 'Weak-area focus'],
    metrics: [
      ['Reports', 'All', 'saved by account'],
      ['Metrics', '6+', 'tracked signals'],
      ['Focus', 'Next', 'round targets']
    ]
  },
  community: {
    eyebrow: 'Community Forum',
    title: 'Ask GD doubts and learn from other users',
    text: 'Post topic requests, doubts, feature suggestions, and practice tips. Users can comment, mark helpful answers, and keep the discussion useful.',
    chips: ['Posts', 'Comments', 'Helpful votes'],
    metrics: [
      ['Forum', 'Live', 'public doubts'],
      ['Replies', 'Open', 'comment threads'],
      ['Votes', 'Once', 'per user']
    ]
  }
};

const sectionVisuals = {
  home: [
    ['01', 'Create your topic'],
    ['02', 'Choose AI panel'],
    ['03', 'Practice live']
  ],
  practice: [
    ['Start', 'Pick topic and duration'],
    ['Speak', 'Use mic or text response'],
    ['Review', 'Get coaching and notes']
  ],
  strategy: [
    ['Open', 'State a clear stand'],
    ['Build', 'Add reason and example'],
    ['Close', 'Link back to the group']
  ],
  analytics: [
    ['Confidence', 72],
    ['Clarity', 84],
    ['Leadership', 66]
  ],
  community: [
    ['GD Doubt', 'How do I handle an interrupting participant?'],
    ['Topic Request', 'Need current affairs topics for placement GD.'],
    ['Practice Tip', 'Use one example before every conclusion.']
  ]
};

const sectionCards = {
  home: [
    ['Custom AI panel', 'Edit personality, pressure, speech style, and opening behavior for every GD participant.', Users],
    ['Live GD room', 'Practice a timed discussion with AI voices, user input, notes, and a discussion feed.', Mic],
    ['Account sync', 'Profile, posts, reports, AI members, and settings stay connected to your login.', ShieldCheck]
  ],
  practice: [
    ['Start faster', 'Choose topic, duration, industry context, and selected AI panel in one setup flow.', Target],
    ['Real interaction', 'AI members respond based on topic, persona, and your latest contribution.', Bot],
    ['Control the round', 'Use start, pause, stop, notes, chat history, and voice controls during practice.', CheckCircle2]
  ],
  strategy: [
    ['Opening practice', 'Build a confident first point before the full GD starts.', Target],
    ['Counter practice', 'Prepare calm responses for aggressive or interrupting participants.', MessageCircle],
    ['Evidence practice', 'Turn weak opinions into examples, cases, numbers, and structured points.', BarChart2]
  ],
  analytics: [
    ['Executive report', 'Review scores after the round with detailed performance feedback.', BarChart2],
    ['History graph', 'Track improvements across completed GD sessions.', Target],
    ['Personal focus', 'Convert weak areas into next-round tasks and prep goals.', CheckCircle2]
  ],
  community: [
    ['Ask doubts', 'Post public GD questions and topic requests for other users to answer.', MessageCircle],
    ['Comment threads', 'Discuss each post through compact social-style replies.', Users],
    ['Helpful votes', 'Mark useful posts without repeatedly increasing counts.', CheckCircle2]
  ]
};

const sectionReading = {
  practice: [
    ['How the practice room works', 'Choose a topic, duration, industry context, and AI panel. Once the round starts, the system behaves like a live GD room where your points matter and the AI participants respond to your latest contribution.'],
    ['What the user should do', 'Speak early, make one complete point, support it with a reason or example, and respond when another participant challenges you. Use notes if you want to remember points while the round is running.'],
    ['Why it is useful', 'The practice room trains timing, clarity, confidence, and response control. It is meant to feel closer to a placement GD than reading static tips.']
  ],
  strategy: [
    ['Opening strategy', 'Start with a clear frame: define the topic, state your direction, and give the group a structure. This makes you sound organized from the beginning.'],
    ['Counter strategy', 'When someone disagrees or interrupts, acknowledge the concern first, then complete your point. Avoid sounding defensive. Calm control is stronger than volume.'],
    ['Evidence strategy', 'Use one real example, company case, statistic, or practical situation. A simple example makes your point more believable than a long opinion.'],
    ['Closing strategy', 'Summarize the strongest shared points, mention both sides if needed, and end with a balanced conclusion.']
  ],
  analytics: [
    ['What gets measured', 'The platform tracks useful GD signals like confidence, leadership presence, communication effectiveness, speaking time, pacing, filler words, and interruptions.'],
    ['How reports help', 'Each completed round becomes a coaching report. Instead of only showing marks, the report explains what improved, what weakened your performance, and what to practice next.'],
    ['How history becomes useful', 'Your progress graph is based on completed sessions, so repeated practice shows whether your confidence, clarity, and leadership are actually improving.']
  ],
  community: [
    ['What to post', 'Ask GD doubts, request topics, share practice tips, or ask for counter lines against difficult participants. Keep posts clear so others can respond usefully.'],
    ['How comments help', 'Comment threads let users discuss one post in detail. A good reply should be practical, polite, and directly useful for GD preparation.'],
    ['How helpful votes work', 'Helpful votes are meant to identify useful suggestions, not inflate numbers. Each user should only be counted once for a helpful mark.']
  ]
};

export default function Landing({ onSignIn, onSignUp }) {
  const [activeNav, setActiveNav] = useState('home');
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSlideResetting, setIsSlideResetting] = useState(false);
  const activeContent = landingSections[activeNav];
  const cards = useMemo(() => sectionCards[activeNav] || sectionCards.home, [activeNav]);
  const visualItems = sectionVisuals[activeNav] || sectionVisuals.home;
  const readingItems = sectionReading[activeNav] || [];
  const displaySlides = useMemo(() => [...heroSlides, heroSlides[0]], []);

  useEffect(() => {
    if (activeNav !== 'home') return undefined;
    const timer = setInterval(() => {
      setActiveSlide(prev => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeNav]);

  const selectNav = (section) => {
    if (section === 'home') setActiveSlide(prev => prev % heroSlides.length);
    setActiveNav(section);
  };

  const handleSlideTransitionEnd = () => {
    if (activeSlide !== heroSlides.length) return;
    setIsSlideResetting(true);
    setActiveSlide(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsSlideResetting(false));
    });
  };

  const selectSlide = (index) => {
    setIsSlideResetting(false);
    setActiveSlide(index);
  };

  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <button type="button" className="landing-brand" onClick={onSignUp}>
          <BrainCircuit size={30} />
          <span>SpeakEdge GD</span>
        </button>
        <div className="landing-nav-links" aria-label="Landing navigation">
          {Object.keys(landingSections).map((section) => (
            <button
              key={section}
              type="button"
              className={activeNav === section ? 'is-active' : ''}
              onClick={() => selectNav(section)}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>
        <div className="landing-nav-actions">
          <button type="button" className="landing-ghost" onClick={onSignIn}>Sign in</button>
          <button type="button" className="landing-solid" onClick={onSignUp}>Join free</button>
        </div>
      </nav>

      {activeNav === 'home' ? (
        <section className={`landing-hero landing-hero-slide-${activeSlide}`}>
          <div
            className={`landing-hero-bg-track ${isSlideResetting ? 'no-transition' : ''}`}
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            onTransitionEnd={handleSlideTransitionEnd}
          >
            {displaySlides.map((slide, index) => (
              <div
                key={`${slide.position}-${index}`}
                className={`landing-hero-bg landing-hero-bg-${index}`}
                style={{ backgroundImage: `url(${bgImage})`, backgroundPosition: slide.position }}
              />
            ))}
          </div>
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
            <div className="landing-slider-dots" aria-label="Hero slides">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.position}
                  type="button"
                  className={activeSlide % heroSlides.length === index ? 'is-active' : ''}
                  onClick={() => selectSlide(index)}
                  aria-label={`Show slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className={`landing-content-hero landing-content-${activeNav}`}>
          <span className="landing-kicker">{activeContent.eyebrow}</span>
          <h1>{activeContent.title}</h1>
          <p>{activeContent.text}</p>
          <div className="landing-mini-features">
            {activeContent.chips.map((chip) => (
              <span key={chip}><CheckCircle2 size={17} /> {chip}</span>
            ))}
          </div>
        </section>
      )}

      <section className={`landing-overview landing-section-${activeNav}`} key={activeNav}>
        <div className="landing-speed-copy">
          <span className="landing-kicker">{activeContent.eyebrow}</span>
          <h2>{activeContent.title}</h2>
          <p>{activeContent.text}</p>
          <div className="landing-mini-features">
            {activeContent.chips.map((chip) => (
              <span key={chip}><CheckCircle2 size={17} /> {chip}</span>
            ))}
          </div>
        </div>

        {activeNav === 'analytics' ? (
          <div className="landing-analytics-panel">
            {visualItems.map(([label, value]) => (
              <div className="landing-analytics-row" key={label}>
                <div><strong>{label}</strong><span>{value}%</span></div>
                <i style={{ width: `${value}%` }} />
              </div>
            ))}
          </div>
        ) : activeNav === 'community' ? (
          <div className="landing-community-panel">
            {visualItems.map(([tag, text]) => (
              <article key={text}>
                <span>{tag}</span>
                <p>{text}</p>
                <small>Helpful replies open inside the forum</small>
              </article>
            ))}
          </div>
        ) : activeNav === 'strategy' ? (
          <div className="landing-playbook-panel">
            {visualItems.map(([label, text], index) => (
              <div key={label}>
                <b>{index + 1}</b>
                <strong>{label}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
        ) : activeNav === 'practice' ? (
          <div className="landing-timeline-panel">
            {visualItems.map(([label, text]) => (
              <div key={label}>
                <span>{label}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="landing-metric-board">
            {activeContent.metrics.map(([label, value, caption]) => (
              <div className="landing-metric-card" key={label}>
                <strong>{label}</strong>
                <b>{value}</b>
                <span>{caption}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`landing-feature-strip landing-feature-${activeNav}`}>
        {cards.map(([title, text, Icon]) => (
          <article key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      {activeNav === 'practice' && (
        <section className="landing-practice-manual">
          <div>
            <span>Practice manual</span>
            <h2>Use the room like a real GD, not a chat window</h2>
          </div>
          <div className="landing-practice-steps">
            {readingItems.map(([title, text], index) => (
              <article key={title}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeNav === 'strategy' && (
        <section className="landing-strategy-board">
          <h2>GD response playbook</h2>
          <div>
            {readingItems.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeNav === 'analytics' && (
        <section className="landing-analytics-brief">
          <aside>
            <span>Report logic</span>
            <h2>Results should explain behavior, not just show marks.</h2>
          </aside>
          <div>
            {readingItems.map(([title, text]) => (
              <article key={title}>
                <CheckCircle2 size={20} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeNav === 'community' && (
        <section className="landing-community-guide">
          <div className="landing-community-window">
            {readingItems.map(([title, text]) => (
              <article key={title}>
                <span>{title}</span>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="landing-community-note">
            <h2>Forum should feel practical</h2>
            <p>Posts, replies, and helpful votes are designed for real GD doubts, topic requests, and peer suggestions.</p>
          </div>
        </section>
      )}

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
