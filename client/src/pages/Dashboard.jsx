import { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, Clock, Users, Calendar, BarChart2, AlertCircle, TrendingUp, Upload, FileText, RefreshCw, Settings, Home, Target, MessageSquare, CheckCircle2, Mic, Lightbulb, Flame, Brain, Trophy, Radio, ShieldCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const SUGGESTED_TOPICS = [
  "AI: A Boon or a Bane for Employment?",
  "Work from Home vs. Office: The Future of Workspace",
  "Social Media: Connecting People or Deepening Loneliness?",
  "Electric Vehicles: The Ultimate Solution to Pollution?",
  "Should AI tools be allowed in college exams?",
  "Is remote work weakening team culture?",
  "Can India become a global AI talent hub?",
  "Should startups prioritize growth over profitability?",
  "Are influencers more powerful than traditional media?",
  "Does social media improve awareness or reduce attention span?",
  "Should companies hire for skills instead of degrees?",
  "Is climate responsibility more important than economic growth?",
  "Will automation create more jobs than it removes?",
  "Should public speaking be taught in every course?",
  "Are four-day work weeks practical for Indian companies?",
  "Does online learning match classroom learning quality?",
  "Should personal branding matter in placements?",
  "Is entrepreneurship safer than traditional employment?",
  "Can electric vehicles truly reduce urban pollution?",
  "Should governments regulate AI-generated content?",
  "Are internships more valuable than academic marks?",
  "Is emotional intelligence more important than IQ at work?",
  "Should coding be compulsory for all students?"
];

const pickDifferentTopics = (currentTopics = [], count = 6) => {
  const currentSet = new Set(currentTopics);
  const available = SUGGESTED_TOPICS.filter(item => !currentSet.has(item));
  const pool = available.length >= count ? available : SUGGESTED_TOPICS;
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
};

const getTopicCacheKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('gd_user')) || {};
    return `gd_trending_topics_${user.id || user.email || 'guest'}`;
  } catch {
    return 'gd_trending_topics_guest';
  }
};

const PERSONA_TEMPLATES = [
  {
    name: 'Aarav',
    role: 'Aggressive Speaker',
    style: 'Fast, direct, challenging',
    color: '#f43f5e',
    desc: 'Challenges weak logic immediately and pushes others to justify every claim.',
    pressure: 90,
    prompt: 'You are an aggressive GD participant. Speak fast, challenge weak points, interrupt occasionally, and demand practical proof.',
    initialIntro: 'I want to challenge the basic assumption here before everyone agrees too quickly.'
  },
  {
    name: 'Nisha',
    role: 'Silent Observer',
    style: 'Brief, thoughtful, selective',
    color: '#64748b',
    desc: 'Speaks rarely but gives sharp summary points when the discussion loses direction.',
    pressure: 35,
    prompt: 'You are a silent observer. Speak less often, but when you speak, summarize clearly and add one thoughtful insight.',
    initialIntro: 'I have been listening, and I think one important angle is being missed.'
  },
  {
    name: 'Rohan',
    role: 'Dominant Leader',
    style: 'Confident, directive, organized',
    color: '#7c3aed',
    desc: 'Takes control of flow, assigns direction, and tries to lead the room.',
    pressure: 84,
    prompt: 'You are a dominant leader. Guide the discussion, organize points, and confidently push the group toward a conclusion.',
    initialIntro: 'Let me structure this discussion into causes, impact, and possible solutions.'
  },
  {
    name: 'Meera',
    role: 'Logical Thinker',
    style: 'Data-backed, structured, calm',
    color: '#06b6d4',
    desc: 'Asks for evidence, compares pros and cons, and prefers clear reasoning.',
    pressure: 76,
    prompt: 'You are a logical thinker. Use evidence, ask for data, compare tradeoffs, and keep the discussion structured.',
    initialIntro: 'From a logical perspective, we should separate opinion from measurable impact.'
  },
  {
    name: 'Isha',
    role: 'Emotional Speaker',
    style: 'Expressive, people-focused, persuasive',
    color: '#ec4899',
    desc: 'Uses human impact, values, and emotional examples to influence the discussion.',
    pressure: 62,
    prompt: 'You are an emotional speaker. Use human stories, values, empathy, and persuasive emotional framing.',
    initialIntro: 'Beyond the numbers, we should consider how this affects real people.'
  },
  {
    name: 'Kabir',
    role: 'Interrupting Participant',
    style: 'Impatient, skeptical, sharp',
    color: '#f59e0b',
    desc: 'Cuts in often, questions assumptions, and forces the user to hold the floor.',
    pressure: 88,
    prompt: 'You interrupt often, question assumptions, and force other speakers to defend their point quickly.',
    initialIntro: 'Wait, I do not think that assumption is strong enough to build the whole argument on.'
  },
  {
    name: 'Priya',
    role: 'HR-Type Participant',
    style: 'Balanced, behavioral, evaluator',
    color: '#10b981',
    desc: 'Looks for teamwork, clarity, confidence, and professional maturity.',
    pressure: 68,
    prompt: 'You behave like an HR evaluator in the GD. Ask balanced follow-ups about teamwork, clarity, and practical maturity.',
    initialIntro: 'I would like to see how we balance individual opinions with group consensus.'
  },
  {
    name: 'Dev',
    role: 'Technical Expert',
    style: 'Precise, analytical, domain-heavy',
    color: '#2563eb',
    desc: 'Explains technical angles and expects specific, accurate reasoning.',
    pressure: 72,
    prompt: 'You are a technical expert. Use precise terms, domain logic, and ask for technically accurate explanations.',
    initialIntro: 'Technically, the feasibility depends on implementation quality and long-term scalability.'
  }
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

const INNOVATION_FEATURES = [
  { title: 'Debate Heatmap', group: 'Analytics', status: 'Ready Next', icon: BarChart2, desc: 'Visualize dominance, silence, interruptions, and topic drift after every GD.', action: 'history', primary: 'View History', secondary: 'Open coaching reports to inspect participation and scores.', steps: ['Complete a GD round.', 'Open the latest report.', 'Compare speaking share, interruptions, and scores.'] },
  { title: 'AI Resume-to-GD Mode', group: 'Preparation', status: 'Active', icon: FileText, desc: 'Generate custom GD topics from resume skills, projects, and target roles.', action: 'resume', primary: 'Upload Resume', secondary: 'Jump to Setup GD and use the resume upload strip.', steps: ['Open Setup GD.', 'Upload a PDF/TXT resume.', 'Select the generated topic and start.'] },
  { title: 'Role-Based GD Rooms', group: 'Practice Modes', status: 'New', icon: Users, desc: 'Switch between placement GD, MBA admission, HR panel, corporate meeting, and startup pitch rooms.', action: 'role', primary: 'Use Role Room', secondary: 'Sets topic/context for a placement-style GD.', topic: 'Campus placements should test practical skills more than academic scores.', context: 'MBA Admissions', participants: 4, duration: 5, steps: ['Choose a room scenario.', 'Start with realistic pressure.', 'Review performance by role expectation.'] },
  { title: 'Real-Time Argument Score', group: 'Live Coaching', status: 'Ready Next', icon: Radio, desc: 'Score clarity, relevance, evidence, confidence, and structure while the user speaks.', action: 'setup', primary: 'Start Scored Round', secondary: 'Use the live session and final report for scoring.', steps: ['Start a round.', 'Speak with PEEL structure.', 'Review score and rewrites at the end.'] },
  { title: 'Filler Word Trainer', group: 'Live Coaching', status: 'Active', icon: Mic, desc: 'Track filler words and repeated weak replies with replacement speaking habits.', action: 'filler', primary: 'Train Fillers', secondary: 'Starts a focused round where filler count matters.', topic: 'Should public speaking be taught as a core professional skill?', context: 'General / Academic', participants: 3, duration: 2, steps: ['Speak slowly.', 'Replace fillers with pauses.', 'Check filler count after the round.'] },
  { title: 'Opening Line Generator', group: 'Preparation', status: 'Active', icon: MessageSquare, desc: 'Create confident opening lines for any topic before the timer starts.', action: 'prep', primary: 'Build Opening', secondary: 'Open Prep Coach for starter statements.', steps: ['Pick an opening line.', 'Adapt it to your topic.', 'Use it within first 20 seconds.'] },
  { title: 'Counter-Argument Coach', group: 'Live Coaching', status: 'Ready Next', icon: Brain, desc: 'Suggest polite disagreement lines and stronger challenge phrases.', action: 'counter', primary: 'Practice Counter', secondary: 'Sets a topic that encourages balanced disagreement.', topic: 'Remote work improves productivity more than office collaboration.', context: 'Corporate Strategy', participants: 4, duration: 5, steps: ['Listen to one AI point.', 'Disagree politely.', 'Use evidence before conclusion.'] },
  { title: 'Summary Round', group: 'Practice Modes', status: 'High Impact', icon: CheckCircle2, desc: 'Ask the user to summarize the GD in 30 seconds for leadership scoring.', action: 'summary', primary: 'Practice Summary', secondary: 'Opens Prep Coach with summary targets.', steps: ['Track 2 strong points.', 'Name both sides briefly.', 'End with a clear conclusion.'] },
  { title: 'Persona Difficulty Levels', group: 'Practice Modes', status: 'New', icon: Flame, desc: 'Easy, medium, and hard AI members with more pressure in hard mode.', action: 'difficulty', primary: 'Hard Mode Setup', secondary: 'Uses 4 AI participants for a more challenging room.', topic: 'AI regulation is necessary even if it slows innovation.', context: 'Corporate Strategy', participants: 4, duration: 5, steps: ['Use 4 AI members.', 'Expect stronger pushback.', 'Defend points with examples.'] },
  { title: 'Confidence Replay', group: 'Analytics', status: 'Ready Next', icon: RefreshCw, desc: 'Replay transcript weak lines and rewrite them into stronger professional responses.', action: 'history', primary: 'Open Replay Source', secondary: 'Use past reports to review weak phrases.', steps: ['Open a completed report.', 'Check suggested phrase rewrites.', 'Repeat improved version aloud.'] },
  { title: 'GD Battle Mode', group: 'Practice Modes', status: 'New', icon: Trophy, desc: 'Competitive timed challenge against AI members for leadership and clarity scores.', action: 'battle', primary: 'Start Battle Setup', secondary: 'Uses a short high-pressure timed round.', topic: 'Leaders are made through experience, not born with talent.', context: 'MBA Admissions', participants: 4, duration: 2, steps: ['Start fast.', 'Make two strong points.', 'Avoid interruptions and fillers.'] },
  { title: 'Daily GD Challenge', group: 'Growth', status: 'New', icon: Calendar, desc: 'One topic per day with streaks, badges, and progress tracking.', action: 'daily', primary: 'Use Today Topic', secondary: 'Loads a daily challenge topic into Setup.', topic: 'Can India become a global AI talent hub in the next decade?', context: 'General / Academic', participants: 4, duration: 5, steps: ['Use today’s topic.', 'Complete one round.', 'Check history for progress.'] },
  { title: 'Interview Follow-up Mode', group: 'Growth', status: 'Ready Next', icon: Sparkles, desc: 'AI asks HR-style follow-up questions based on GD performance.', action: 'interview', primary: 'Interview Setup', secondary: 'Starts a GD topic likely to produce HR follow-ups.', topic: 'Work ethic matters more than technical skill in early careers.', context: 'MBA Admissions', participants: 3, duration: 5, steps: ['Finish the GD.', 'Review weaknesses.', 'Prepare HR-style answers.'] },
  { title: 'Voice Emotion Analysis', group: 'Analytics', status: 'Research', icon: Radio, desc: 'Detect hesitant, rushed, flat, or confident delivery patterns.', action: 'voice', primary: 'Voice Practice', secondary: 'Starts a short voice-focused round.', topic: 'Confidence can be built through repeated uncomfortable conversations.', context: 'General / Academic', participants: 2, duration: 2, steps: ['Use microphone.', 'Maintain steady pace.', 'Review pacing and fillers.'] },
  { title: 'Personal Improvement Plan', group: 'Growth', status: 'High Impact', icon: ShieldCheck, desc: 'Weekly plan from history: pacing, confidence, evidence usage, and filler control.', action: 'history', primary: 'Build From History', secondary: 'Use completed sessions to identify next focus.', steps: ['Complete 3 rounds.', 'Compare scores.', 'Choose one target for next week.'] }
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
  const [activeInnovation, setActiveInnovation] = useState(INNOVATION_FEATURES[0].title);
  const [prepChecklist, setPrepChecklist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gd_prep_checklist')) || {};
    } catch {
      return {};
    }
  });
  const [miniGdState, setMiniGdState] = useState('idle');
  const [miniGdTimeLeft, setMiniGdTimeLeft] = useState(60);
  const [miniGdDuration, setMiniGdDuration] = useState(60);
  const [miniGdInput, setMiniGdInput] = useState('');
  const [miniGdTurns, setMiniGdTurns] = useState([]);
  const [miniGdMemberIndex, setMiniGdMemberIndex] = useState(0);
  const [miniGdThinking, setMiniGdThinking] = useState(false);
  const [aiPersonas, setAiPersonas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gd_ai_personas')) || PERSONA_TEMPLATES.slice(0, 4);
    } catch {
      return PERSONA_TEMPLATES.slice(0, 4);
    }
  });
  const [activePersonaIndex, setActivePersonaIndex] = useState(0);
  const [trendingTopics, setTrendingTopics] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(getTopicCacheKey())) || SUGGESTED_TOPICS.slice(0, 6);
    } catch {
      return SUGGESTED_TOPICS.slice(0, 6);
    }
  });
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const miniGdEndRef = useRef(null);
  const miniGdFeedRef = useRef(null);
  const miniGdRoundIdRef = useRef(0);
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem('gd_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchHistory();
    fetchUserScopedData();
    loadInitialTrendingTopics();
  }, []);

  useEffect(() => {
    if (miniGdState !== 'running' || miniGdDuration === 'unlimited') return undefined;

    const timer = setInterval(() => {
      setMiniGdTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setMiniGdState('finished');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [miniGdState, miniGdDuration]);

  useEffect(() => {
    if (miniGdFeedRef.current) {
      window.requestAnimationFrame(() => {
        miniGdFeedRef.current?.scrollTo({
          top: miniGdFeedRef.current.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }, [miniGdTurns, miniGdThinking]);

  const activeEditablePersona = aiPersonas[activePersonaIndex] || aiPersonas[0] || PERSONA_TEMPLATES[0];

  const fetchUserScopedData = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/user-data', {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Could not load user data');
      const data = await res.json();
      if (Array.isArray(data.aiPersonas) && data.aiPersonas.length > 0) {
        setAiPersonas(data.aiPersonas);
        localStorage.setItem('gd_ai_personas', JSON.stringify(data.aiPersonas));
      }
      if (data.prepState?.checklist) {
        const checklist = data.prepState.checklist;
        setPrepChecklist(checklist);
        localStorage.setItem('gd_prep_checklist', JSON.stringify(checklist));
      }
      if (Array.isArray(data.resumeTopics)) {
        const topics = data.resumeTopics.flatMap((item) => item.topics || []);
        if (topics.length > 0) setResumeTopics(topics);
      }
    } catch (error) {
      console.warn('Dashboard sync unavailable, using local cache:', error.message);
    }
  };

  function loadInitialTrendingTopics() {
    try {
      const cachedTopics = JSON.parse(localStorage.getItem(getTopicCacheKey())) || [];
      if (cachedTopics.length > 0) {
        setTrendingTopics(cachedTopics);
        return;
      }
    } catch {
      // Continue to first-load generation.
    }

    fetchTrendingTopics({ forceRefresh: false });
  }

  async function fetchTrendingTopics({ forceRefresh = true } = {}) {
    try {
      setIsLoadingTopics(true);
      const query = encodeURIComponent(industryContext || 'General / Academic');
      const currentTopics = forceRefresh ? trendingTopics : [];
      const avoid = encodeURIComponent(currentTopics.join('|'));
      const nonce = Date.now();
      const res = await fetch(`http://localhost:5000/api/topics/trending?industryContext=${query}&avoid=${avoid}&refresh=${nonce}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to load trending topics');
      const data = await res.json();
      if (Array.isArray(data.topics) && data.topics.length > 0) {
        const uniqueTopics = [...new Set(data.topics)].filter(item => !currentTopics.includes(item));
        const nextTopics = uniqueTopics.length >= 4 ? uniqueTopics.slice(0, 6) : pickDifferentTopics(currentTopics);
        setTrendingTopics(nextTopics);
        localStorage.setItem(getTopicCacheKey(), JSON.stringify(nextTopics));
      }
    } catch (error) {
      console.warn('Trending topics fallback used:', error.message);
      const nextTopics = pickDifferentTopics(forceRefresh ? trendingTopics : []);
      setTrendingTopics(nextTopics);
      localStorage.setItem(getTopicCacheKey(), JSON.stringify(nextTopics));
    } finally {
      setIsLoadingTopics(false);
    }
  }

  const savePersonas = async (nextPersonas) => {
    setAiPersonas(nextPersonas);
    localStorage.setItem('gd_ai_personas', JSON.stringify(nextPersonas));
    try {
      await fetch('http://localhost:5000/api/user-data/ai-personas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ personas: nextPersonas })
      });
    } catch (error) {
      console.warn('AI personas saved locally only:', error.message);
    }
  };

  const updatePersona = (field, value) => {
    const nextPersonas = aiPersonas.map((persona, index) => (
      index === activePersonaIndex ? { ...persona, [field]: value } : persona
    ));
    savePersonas(nextPersonas);
  };

  const applyPersonaTemplate = (template) => {
    const nextPersonas = aiPersonas.map((persona, index) => (
      index === activePersonaIndex ? { ...template, color: persona.color || template.color } : persona
    ));
    savePersonas(nextPersonas);
  };

  const addPersonaSlot = () => {
    const template = PERSONA_TEMPLATES[aiPersonas.length % PERSONA_TEMPLATES.length];
    const nextPersonas = [...aiPersonas, { ...template, name: `${template.name} ${aiPersonas.length + 1}` }];
    savePersonas(nextPersonas);
    setActivePersonaIndex(nextPersonas.length - 1);
  };

  const resetPersonas = () => {
    const resetList = PERSONA_TEMPLATES.slice(0, 4);
    savePersonas(resetList);
    setActivePersonaIndex(0);
  };

  const completedRuns = history.filter((item) => item.aiEvaluation);
  const latestRun = completedRuns[0] || null;
  const latestScore = completedRuns.length
    ? Math.round(completedRuns.reduce((total, item) => {
        return total + item.aiEvaluation.leadershipScore + item.aiEvaluation.confidenceScore + item.aiEvaluation.effectivenessScore;
      }, 0) / (completedRuns.length * 3))
    : 0;
  const averageDimension = (field) => completedRuns.length
    ? Math.round(completedRuns.reduce((total, item) => total + (item.aiEvaluation?.[field] || 0), 0) / completedRuns.length)
    : 0;
  const performanceDimensions = [
    { key: 'leadershipScore', label: 'Leadership', value: averageDimension('leadershipScore') },
    { key: 'confidenceScore', label: 'Confidence', value: averageDimension('confidenceScore') },
    { key: 'effectivenessScore', label: 'Effectiveness', value: averageDimension('effectivenessScore') }
  ];
  const weakestDimension = completedRuns.length
    ? [...performanceDimensions].sort((a, b) => a.value - b.value)[0]
    : null;
  const strongestDimension = completedRuns.length
    ? [...performanceDimensions].sort((a, b) => b.value - a.value)[0]
    : null;
  const historyChartData = [...completedRuns].reverse().map((item, index) => {
    const evaluation = item.aiEvaluation || {};
    const leadership = evaluation.leadershipScore || 0;
    const confidence = evaluation.confidenceScore || 0;
    const effectiveness = evaluation.effectivenessScore || 0;

    return {
      label: `Round ${index + 1}`,
      shortLabel: `R${index + 1}`,
      topic: item.topic,
      date: new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Overall: Math.round((leadership + confidence + effectiveness) / 3),
      Leadership: leadership,
      Confidence: confidence,
      Effectiveness: effectiveness
    };
  });
  const firstChartPoint = historyChartData[0] || null;
  const latestChartPoint = historyChartData[historyChartData.length - 1] || null;
  const trendDelta = latestChartPoint && firstChartPoint ? latestChartPoint.Overall - firstChartPoint.Overall : 0;
  const bestRound = historyChartData.length
    ? [...historyChartData].sort((a, b) => b.Overall - a.Overall)[0]
    : null;
  const latestMetrics = latestRun?.userMetrics || {};
  const latestEvaluation = latestRun?.aiEvaluation || {};
  const latestWeaknesses = latestEvaluation.weaknesses || [];
  const latestTips = latestEvaluation.actionableTips || [];
  const prepFocusItems = completedRuns.length ? [
    latestMetrics.speakingTime < 15
      ? 'Speak for at least 20 seconds with one complete argument.'
      : 'Keep speaking share balanced while adding one new point.',
    (latestMetrics.fillerWordCount || 0) > 2
      ? `Reduce fillers from ${latestMetrics.fillerWordCount} to 1 or less.`
      : 'Use deliberate pauses instead of filler words.',
    weakestDimension?.key === 'effectivenessScore'
      ? 'Add one example, data point, or real situation before concluding.'
      : weakestDimension?.key === 'leadershipScore'
        ? 'Reference another speaker and guide the group toward a conclusion.'
        : 'Use a calm pace and confident opening sentence.',
    latestWeaknesses[0] || latestTips[0] || 'Summarize before adding a new angle.'
  ] : [
    'Speak within the first 20 seconds.',
    'Add one example or data point.',
    'Reference another speaker before adding your point.',
    'Avoid repeated fillers like ok, yeah, like.'
  ];
  const prepCompletedCount = prepFocusItems.filter(item => prepChecklist[item]).length;
  const checklistProgress = Math.round((prepCompletedCount / prepFocusItems.length) * 100);
  const prepProgress = completedRuns.length
    ? Math.round((latestScore * 0.65) + (checklistProgress * 0.35))
    : checklistProgress;
  const readinessMessage = completedRuns.length
    ? `Based on your latest ${completedRuns.length} completed round${completedRuns.length > 1 ? 's' : ''}, your weakest area is ${weakestDimension?.label || 'structure'}.`
    : 'Complete one GD round to unlock performance-based readiness and targets.';

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
      formData.append('industryContext', industryContext);

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

  const applyInnovationFeature = (feature) => {
    if (feature.topic) setTopic(feature.topic);
    if (feature.context) setIndustryContext(feature.context);
    if (feature.participants) setNumParticipants(feature.participants);
    if (feature.duration) setDuration(feature.duration);

    if (feature.action === 'prep' || feature.action === 'summary') {
      onChangeSection?.('prep');
      return;
    }

    if (feature.action === 'history') {
      onChangeSection?.('history');
      return;
    }

    if (feature.action === 'resume') {
      onChangeSection?.('setup');
      setTimeout(() => fileInputRef.current?.click(), 100);
      return;
    }

    onChangeSection?.('setup');
  };

  const miniGdMember = aiPersonas[miniGdMemberIndex] || aiPersonas[0] || PERSONA_TEMPLATES[0];
  const visibleMiniGdTurns = miniGdTurns.filter(turn => turn.speaker !== 'Coach');
  const miniGdUserTurns = miniGdTurns.filter(turn => turn.speaker === 'You');
  const latestMiniCoachTurn = [...miniGdTurns].reverse().find(turn => turn.speaker === 'Coach');
  const latestMiniScore = Number(latestMiniCoachTurn?.text?.match(/score:\s*(\d+)/i)?.[1]);
  const miniGdWordCount = miniGdUserTurns.reduce((total, turn) => total + turn.text.split(/\s+/).filter(Boolean).length, 0);
  const miniGdExampleCount = miniGdUserTurns.filter(turn => /example|for instance|such as|case|data|study|because|since|survey|report|company|real/i.test(turn.text)).length;
  const miniGdFillerCount = miniGdUserTurns.reduce((total, turn) => {
    const matches = turn.text.toLowerCase().match(/\b(ok|okay|yeah|like|um|uh)\b/g);
    return total + (matches?.length || 0);
  }, 0);
  const miniGdFinalScore = Number.isFinite(latestMiniScore)
    ? latestMiniScore
    : Math.min(100, Math.round((miniGdWordCount * 1.1) + (miniGdExampleCount * 18) - (miniGdFillerCount * 6)));
  const miniGdResultFocus = miniGdUserTurns.length === 0
    ? 'Start with one complete answer before the timer ends.'
    : miniGdExampleCount === 0
      ? 'Add one practical example or data point to make your GD answer credible.'
      : miniGdFillerCount > 1
        ? 'Reduce fillers and keep your answer crisp.'
        : 'Good structure. Finish with a stronger conclusion that links back to the topic.';
  const miniGdClockLabel = miniGdDuration === 'unlimited'
    ? 'Unlimited'
    : `${Math.floor(miniGdTimeLeft / 60)}:${String(miniGdTimeLeft % 60).padStart(2, '0')}`;

  const startMiniGd = () => {
    miniGdRoundIdRef.current += 1;
    setMiniGdTimeLeft(miniGdDuration === 'unlimited' ? 0 : miniGdDuration);
    setMiniGdInput('');
    setMiniGdThinking(false);
    setMiniGdTurns([
      {
        speaker: 'Coach',
        text: `Mini GD started. Topic: ${topic}. You are speaking with ${miniGdMember.name}, ${miniGdMember.role}. Give one clear point with reason and example.`
      },
      {
        speaker: miniGdMember.name,
        text: miniGdMember.initialIntro || `I want to hear your first clear view on ${topic}.`
      }
    ]);
    setMiniGdState('running');
  };

  const endMiniGd = () => {
    miniGdRoundIdRef.current += 1;
    setMiniGdThinking(false);
    setMiniGdInput('');
    setMiniGdState('finished');
  };

  const submitMiniGdTurn = async (e) => {
    e.preventDefault();
    const text = miniGdInput.trim();
    if (!text || miniGdThinking) return;

    const roundId = miniGdRoundIdRef.current;
    setMiniGdInput('');
    setMiniGdThinking(true);
    const nextTurns = [...miniGdTurns, { speaker: 'You', text }];
    setMiniGdTurns(nextTurns);

    try {
      const res = await fetch('http://localhost:5000/api/sessions/mini-gd-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          topic,
          industryContext,
          transcript: nextTurns,
          userText: text,
          member: miniGdMember
        })
      });

      if (!res.ok) throw new Error('Mini GD LLM request failed');
      const data = await res.json();
      if (roundId !== miniGdRoundIdRef.current) return;
      setMiniGdTurns(prev => [
        ...prev,
        { speaker: miniGdMember.name, text: data.memberReply },
        { speaker: 'Coach', text: `${data.coachFeedback} Quick score: ${data.score}/100. ${data.nextPrompt}` }
      ]);
    } catch (error) {
      console.warn('Mini GD fallback used:', error.message);
      if (roundId !== miniGdRoundIdRef.current) return;
      const words = text.split(/\s+/).filter(Boolean);
      const hasExample = /example|for instance|such as|case|data|study|because|since/i.test(text);
      const score = Math.min(100, Math.round(Math.min(words.length, 45) * 1.3 + (hasExample ? 20 : 0)));
      setMiniGdTurns(prev => [
        ...prev,
        {
          speaker: miniGdMember.name,
          text: `${miniGdMember.name}: Connect that more directly to ${topic}. What practical example proves your point?`
        },
        {
          speaker: 'Coach',
          text: `${hasExample ? 'Good support. Add a sharper conclusion.' : 'Add one example or data point.'} Quick score: ${score}/100.`
        }
      ]);
    } finally {
      if (roundId === miniGdRoundIdRef.current) {
        setMiniGdThinking(false);
      }
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
            <div className="setup-refresh-label">
              <label>AI Trending Topics</label>
              <button type="button" onClick={() => fetchTrendingTopics({ forceRefresh: true })} disabled={isLoadingTopics}>
                <RefreshCw size={13} className={isLoadingTopics ? 'spinning-icon' : ''} />
                {isLoadingTopics ? 'Generating' : 'Refresh'}
              </button>
            </div>
            <div className="setup-topic-list">
              {trendingTopics.map((item) => (
                <button
                  key={item}
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
        title="AI Personality Builder"
        description="Create the exact panel members you want in the GD. Edit their character, pressure level, opening line, and speaking behavior."
        action={<button className="btn-primary" type="button" onClick={() => onChangeSection?.('setup')}><Settings size={16} /> Use In Round</button>}
      />
      <div className="persona-builder">
        <aside className="persona-builder-roster">
          <div className="persona-roster-header">
            <span>Editable AI Panel</span>
            <strong>{aiPersonas.length} custom personalities</strong>
          </div>
          {aiPersonas.map((persona, index) => (
            <button
              key={`${persona.name}-${index}`}
              type="button"
              className={`persona-roster-card ${index === activePersonaIndex ? 'is-active' : ''}`}
              style={{ '--persona-color': persona.color }}
              onClick={() => setActivePersonaIndex(index)}
            >
              <span className="persona-avatar">{persona.name?.charAt(0) || 'A'}</span>
              <span>
                <strong>{persona.name}</strong>
                <small>{persona.role}</small>
              </span>
              <em>{persona.pressure}</em>
            </button>
          ))}
          <div className="persona-builder-actions">
            <button type="button" className="btn-secondary" onClick={addPersonaSlot}>Add Member</button>
            <button type="button" className="btn-secondary" onClick={resetPersonas}>Reset</button>
          </div>
        </aside>

        <section className="persona-editor-card" style={{ '--persona-color': activeEditablePersona.color }}>
          <div className="persona-editor-hero">
            <div>
              <span>Personality Controls</span>
              <h2>{activeEditablePersona.name || 'AI Member'} speaks as {activeEditablePersona.role}</h2>
              <p>{activeEditablePersona.desc}</p>
            </div>
            <div className="persona-editor-avatar">{activeEditablePersona.name?.charAt(0) || 'A'}</div>
          </div>

          <div className="persona-template-strip">
            {PERSONA_TEMPLATES.map((template) => (
              <button key={template.role} type="button" onClick={() => applyPersonaTemplate(template)}>
                {template.role}
              </button>
            ))}
          </div>

          <div className="persona-form-grid">
            <label>
              Member Name
              <input value={activeEditablePersona.name} onChange={(event) => updatePersona('name', event.target.value)} />
            </label>
            <label>
              Personality Type
              <input value={activeEditablePersona.role} onChange={(event) => updatePersona('role', event.target.value)} />
            </label>
            <label>
              Way of Speech
              <input value={activeEditablePersona.style} onChange={(event) => updatePersona('style', event.target.value)} />
            </label>
            <label>
              Theme Color
              <input type="color" value={activeEditablePersona.color} onChange={(event) => updatePersona('color', event.target.value)} />
            </label>
            <label>
              Pressure Level: {activeEditablePersona.pressure}
              <input
                type="range"
                min="0"
                max="100"
                value={activeEditablePersona.pressure}
                onChange={(event) => updatePersona('pressure', Number(event.target.value))}
              />
            </label>
            <label>
              Short Description
              <input value={activeEditablePersona.desc} onChange={(event) => updatePersona('desc', event.target.value)} />
            </label>
            <label className="persona-wide-field">
              Opening Line
              <textarea value={activeEditablePersona.initialIntro} onChange={(event) => updatePersona('initialIntro', event.target.value)} />
            </label>
            <label className="persona-wide-field">
              AI Behavior Prompt
              <textarea value={activeEditablePersona.prompt} onChange={(event) => updatePersona('prompt', event.target.value)} />
            </label>
          </div>
        </section>

        <aside className="persona-preview-card" style={{ '--persona-color': activeEditablePersona.color }}>
          <div className="persona-panel-title">
            <Sparkles size={18} />
            <h3>Live Preview</h3>
          </div>
          <div className="persona-preview-bubble">
            <strong>{activeEditablePersona.name}</strong>
            <span>{activeEditablePersona.role}</span>
            <p>{activeEditablePersona.initialIntro}</p>
          </div>
          <div className="persona-preview-stats">
            <div>
              <span>Pressure</span>
              <strong>{activeEditablePersona.pressure}/100</strong>
            </div>
            <div>
              <span>Speech</span>
              <strong>{activeEditablePersona.style}</strong>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={() => onChangeSection?.('setup')}>
            <Play size={16} fill="white" />
            Use These Members
          </button>
        </aside>
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
          <div className="flat-card history-chart-card">
            <div className="history-chart-header">
              <div>
                <div className="history-chart-title">
                  <TrendingUp size={20} />
                  <h3>Performance Over Time</h3>
                </div>
                <p>Each point is one completed GD round saved to your account. Hover a round to see the topic and date.</p>
              </div>
              <span className={`history-trend-pill ${trendDelta >= 0 ? 'positive' : 'negative'}`}>
                {trendDelta >= 0 ? '+' : ''}{trendDelta} overall
              </span>
            </div>

            <div className="history-insight-grid">
              <div className="history-insight-card">
                <span>Latest score</span>
                <strong>{latestChartPoint ? `${latestChartPoint.Overall}%` : 'Pending'}</strong>
                <small>{latestChartPoint?.topic || 'Complete one scored round'}</small>
              </div>
              <div className="history-insight-card">
                <span>Best round</span>
                <strong>{bestRound ? `${bestRound.Overall}%` : 'Pending'}</strong>
                <small>{bestRound ? `${bestRound.label} - ${bestRound.topic}` : 'No scored report yet'}</small>
              </div>
              <div className="history-insight-card">
                <span>Strongest area</span>
                <strong>{strongestDimension ? `${strongestDimension.label}` : 'Pending'}</strong>
                <small>{strongestDimension ? `${strongestDimension.value}% average` : 'Finish a round to unlock this'}</small>
              </div>
              <div className="history-insight-card focus">
                <span>Next focus</span>
                <strong>{weakestDimension ? weakestDimension.label : 'Start scoring'}</strong>
                <small>{weakestDimension ? `${weakestDimension.value}% average - improve this first` : 'Your coaching report will set this automatically'}</small>
              </div>
            </div>

            {historyChartData.length ? (
              <div className="history-chart-shell">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyChartData} margin={{ top: 12, right: 24, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="4 6" stroke="rgba(102, 112, 133, 0.18)" vertical={false} />
                    <XAxis dataKey="shortLabel" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, name]}
                      labelFormatter={(label, payload) => {
                        const point = payload?.[0]?.payload;
                        return point ? `${point.label} - ${point.date} - ${point.topic}` : label;
                      }}
                      contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: 'var(--shadow-soft)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                    <Line type="linear" dataKey="Overall" stroke="#0f766e" strokeWidth={4} dot={{ r: 5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                    <Line type="linear" dataKey="Leadership" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#a855f7', strokeWidth: 0 }} />
                    <Line type="linear" dataKey="Confidence" stroke="#0891b2" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#0891b2', strokeWidth: 0 }} />
                    <Line type="linear" dataKey="Effectiveness" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="history-empty-chart">Complete one evaluated GD round to generate your personal performance graph.</div>
            )}
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
            <TrendingUp color="var(--accent-blue)" />
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Your Performance Snapshot</h2>
              <p style={{ fontSize: '0.9rem' }}>
                {completedRuns.length ? 'Calculated from completed GD reports.' : 'Complete a round to generate personal analytics.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                <span>Average coaching score</span>
                <span>{latestScore ? `${latestScore}%` : 'No data'}</span>
              </div>
              <div className="quota-meter" style={{ '--meter-width': `${latestScore || 8}%` }}><span /></div>
            </div>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
              {completedRuns.length
                ? `Strongest area: ${strongestDimension?.label} (${strongestDimension?.value}%). Next focus: ${weakestDimension?.label} (${weakestDimension?.value}%).`
                : 'Your first completed GD will unlock personalized strengths, weak areas, and next-round targets.'}
            </p>
            <button className="btn-primary" type="button" onClick={() => onChangeSection?.(completedRuns.length ? 'prep' : 'setup')} style={{ width: '100%' }}>
              <Play size={16} fill="white" /> {completedRuns.length ? 'Open Personal Prep' : 'Start First Round'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderPrepCoach = () => (
    <>
      <SectionHeader
        icon={Target}
        title="Prep Coach"
        description="Build a quick speaking plan before entering the GD: opening line, structure, evidence, and delivery targets."
        action={<button className="btn-primary" type="button" onClick={() => onChangeSection?.('setup')}><Play size={16} fill="white" /> Start Round</button>}
      />

      <div className="prep-learning-hero flat-card">
        <div>
          <span><Target size={16} /> Learning Progress</span>
          <h2>{prepProgress}% ready for the next round</h2>
          <p>{readinessMessage}</p>
          <div className="prep-progress-bar"><i style={{ width: `${prepProgress}%` }} /></div>
        </div>
        <div className="prep-streak-card">
          <strong>{prepCompletedCount}/{prepFocusItems.length}</strong>
          <small>{completedRuns.length ? 'performance tasks done' : 'focus tasks done'}</small>
        </div>
      </div>

      <div className="flat-card mini-gd-lab">
        <div className="mini-gd-header">
          <div>
            <span><Radio size={16} /> Working Mini GD</span>
            <h2>Practice a live GD response</h2>
            <p>Start a small GD simulation, reply to the prompt, and get instant coaching before entering the full arena.</p>
          </div>
          <div className={`mini-gd-clock ${miniGdDuration === 'unlimited' ? 'is-unlimited' : ''}`}>{miniGdClockLabel}</div>
        </div>

        <div className="mini-gd-body">
          <div className="mini-gd-chat-panel">
            <div className="mini-gd-feed" ref={miniGdFeedRef}>
              {(visibleMiniGdTurns.length ? visibleMiniGdTurns : [
                { speaker: 'System', text: 'Press Start Mini GD to begin a quick practice simulation.' }
              ]).map((turn, idx) => (
              <div key={`${turn.speaker}-${idx}`} className={`mini-gd-message ${turn.speaker === 'You' ? 'is-user' : ''}`}>
                <strong>{turn.speaker}</strong>
                <p>{turn.text}</p>
              </div>
              ))}
              {miniGdThinking && (
                <div className="mini-gd-message">
                  <strong>{miniGdMember.name}</strong>
                  <p>Thinking about your point...</p>
                </div>
              )}
              <div ref={miniGdEndRef} />
            </div>

            <form className="mini-gd-input-row" onSubmit={submitMiniGdTurn}>
              <input
                value={miniGdInput}
                onChange={(e) => setMiniGdInput(e.target.value)}
                disabled={miniGdState !== 'running' || miniGdThinking}
                placeholder={miniGdState === 'running' ? `Reply to ${miniGdMember.name}...` : 'Start Mini GD to unlock response box'}
              />
              <button type="submit" className="btn-secondary" disabled={miniGdState !== 'running' || miniGdThinking || !miniGdInput.trim()}>
                {miniGdThinking ? 'Thinking' : 'Send'}
              </button>
            </form>
          </div>

          <div className="mini-gd-side">
            <div className="mini-gd-coach-card">
              <strong>Practice Member</strong>
              <select
                value={miniGdMemberIndex}
                onChange={(e) => setMiniGdMemberIndex(Number(e.target.value))}
                disabled={miniGdState === 'running'}
              >
                {aiPersonas.map((persona, index) => (
                  <option key={`${persona.name}-${index}`} value={index}>
                    {persona.name} - {persona.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="mini-gd-coach-card">
              <strong>Practice Time</strong>
              <select
                value={miniGdDuration}
                onChange={(e) => {
                  const value = e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value);
                  setMiniGdDuration(value);
                  setMiniGdTimeLeft(value === 'unlimited' ? 0 : value);
                }}
                disabled={miniGdState === 'running'}
              >
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value="unlimited">Unlimited practice</option>
              </select>
            </div>
            <div className="mini-gd-action-stack">
              <button type="button" className="btn-primary" onClick={startMiniGd}>
                <Play size={16} fill="white" />
                {miniGdState === 'running' ? 'Restart Mini GD' : 'Start Mini GD'}
              </button>
              {miniGdState === 'running' && (
                <button type="button" className="btn-danger mini-gd-end-button" onClick={endMiniGd}>
                  End Mini GD
                </button>
              )}
            </div>
            <div className="mini-gd-status-card">
              <span>Status</span>
              <strong>{miniGdState === 'finished' ? 'Completed' : miniGdState === 'running' ? 'Live practice' : 'Ready'}</strong>
              <small>{miniGdState === 'running' ? 'Only new messages scroll inside the chat.' : 'Choose a member and start when ready.'}</small>
            </div>
          </div>
        </div>

        {miniGdState === 'finished' && (
          <div className="mini-gd-result">
            <div>
              <span>Mini GD Result</span>
              <h3>{miniGdFinalScore}/100</h3>
              <p>{latestMiniCoachTurn?.text?.replace(/Quick score:\s*\d+\/100\.?/i, '').trim() || miniGdResultFocus}</p>
            </div>
            <div className="mini-gd-result-metrics">
              <small><strong>{miniGdUserTurns.length}</strong> replies</small>
              <small><strong>{miniGdWordCount}</strong> words</small>
              <small><strong>{miniGdExampleCount}</strong> examples</small>
              <small><strong>{miniGdFillerCount}</strong> fillers</small>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderInnovationLab = () => (
    (() => {
      const selectedFeature = INNOVATION_FEATURES.find(feature => feature.title === activeInnovation) || INNOVATION_FEATURES[0];
      const SelectedIcon = selectedFeature.icon;

      return (
    <>
      <SectionHeader
        icon={Lightbulb}
        title="Innovation Lab"
        description="A complete feature board for the GD platform: live coaching, analytics, practice modes, and long-term growth tools."
        action={<button className="btn-primary" type="button" onClick={() => onChangeSection?.('prep')}><Target size={16} /> Prep Coach</button>}
      />

      <div className="innovation-hero flat-card">
        <div>
          <span><Sparkles size={16} /> Product Roadmap</span>
          <h2>All advanced GD features in one place</h2>
          <p>Use this lab as the feature center. Active modules are already connected; ready-next modules are staged for the next implementation pass.</p>
        </div>
        <strong>{INNOVATION_FEATURES.length}</strong>
      </div>

      <div className="innovation-action-board flat-card">
        <div className="innovation-action-main">
          <div className="innovation-icon"><SelectedIcon size={22} /></div>
          <div>
            <span>{selectedFeature.group}</span>
            <h2>{selectedFeature.title}</h2>
            <p>{selectedFeature.secondary}</p>
          </div>
        </div>
        <div className="innovation-action-steps">
          {selectedFeature.steps.map((step, idx) => (
            <div key={step}>
              <strong>{idx + 1}</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={() => applyInnovationFeature(selectedFeature)}>
          <Play size={16} fill="white" />
          {selectedFeature.primary}
        </button>
      </div>

      <div className="innovation-grid">
        {INNOVATION_FEATURES.map((feature) => {
          const Icon = feature.icon;
          const isSelected = feature.title === selectedFeature.title;
          return (
            <button
              key={feature.title}
              type="button"
              className={`flat-card innovation-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => setActiveInnovation(feature.title)}
            >
              <div className="innovation-card-top">
                <div className="innovation-icon"><Icon size={20} /></div>
                <span className={`innovation-status ${feature.status.replace(/\s+/g, '-').toLowerCase()}`}>{feature.status}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
              <small>{feature.group}</small>
            </button>
          );
        })}
      </div>
    </>
      );
    })()
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
      {activeSection === 'prep' && renderPrepCoach()}
      {activeSection === 'innovation' && renderInnovationLab()}
      {activeSection === 'members' && renderMembers()}
      {activeSection === 'history' && renderHistory()}
    </div>
  );
}
