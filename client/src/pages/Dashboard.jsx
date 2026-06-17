import { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, Clock, Users, Calendar, BarChart2, AlertCircle, TrendingUp, Upload, FileText, RefreshCw, Settings, Target, MessageCircle, Radio, ThumbsUp, ThumbsDown, Send, MessageSquare } from 'lucide-react';
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

const analyzeMiniGdInput = (text = '') => {
  const cleaned = String(text).trim();
  const words = cleaned.toLowerCase().match(/[a-z0-9]+/g) || [];
  const repeatedCharacterRun = /(.)\1{7,}/i.test(cleaned.replace(/\s+/g, ''));
  const longSingleToken = words.some(word => word.length > 24);
  const alphabeticChars = cleaned.match(/[a-z]/gi) || [];
  const uniqueLetters = new Set(alphabeticChars.map(char => char.toLowerCase()));
  const lowLetterVariety = alphabeticChars.length > 18 && uniqueLetters.size <= 3;
  const shortCasualReply = /^(hi|hello|hey|ok|okay|yes|no|hmm|mm|fine|good)[.!?\s]*$/i.test(cleaned);
  const uniqueWords = new Set(words);
  const lowWordDiversity = words.length >= 5 && uniqueWords.size <= Math.max(2, Math.ceil(words.length * 0.35));

  return {
    cleaned,
    words,
    wordCount: words.length,
    isGibberish: !cleaned || shortCasualReply || repeatedCharacterRun || longSingleToken || lowLetterVariety || lowWordDiversity
  };
};

const buildMiniGdLocalTurn = ({ topic, text, member, turnCount }) => {
  const input = analyzeMiniGdInput(text);
  const role = String(member?.role || '').toLowerCase();
  const topicCore = String(topic || 'this topic').replace(/[?.!]+$/, '');
  const hasExample = /example|for instance|such as|case|data|study|because|since|company|report/i.test(text);
  const hasLink = /therefore|so|this shows|as a result|in conclusion|overall|this means/i.test(text);

  if (input.isGibberish) {
    const replies = [
      `I cannot count that as a GD point yet. Give one complete sentence on whether AI helps or harms employment.`,
      `That looks like random or incomplete text. Take a clear stand on ${topicCore} first.`,
      `In a real GD, this would not move the discussion. Say one practical impact of AI on jobs.`
    ];
    return {
      memberReply: replies[turnCount % replies.length],
      coachFeedback: 'This is not a meaningful GD answer yet. Use a clear point with a reason.',
      score: Math.min(8, Math.max(1, input.wordCount)),
      nextPrompt: `Write one proper sentence about ${topicCore}.`
    };
  }

  const aggressive = [
    `Good start, but it is still broad. Name who is affected by AI: freshers, employees, companies, or customers.`,
    `Let me challenge that like a tough evaluator: what proof shows this actually happens in workplaces?`,
    `Make it sharper. Is AI replacing jobs or changing the skills needed for jobs?`
  ];
  const logical = [
    `Let us measure it. Are you arguing about productivity, job loss, reskilling, or hiring quality?`,
    `Separate short-term disruption from long-term opportunity. Which one does your point support?`,
    `Add one example or data point so your argument becomes testable.`
  ];
  const neutral = [
    `Link that directly to ${topicCore}. Add one reason and one example.`,
    `That can work if you complete it with point, reason, example, and conclusion.`,
    `Push it further. How would you respond if another speaker disagrees?`
  ];
  const pool = role.includes('aggressive') || role.includes('dominant') || role.includes('interrupt')
    ? aggressive
    : role.includes('logical') || role.includes('technical') || role.includes('analyst')
      ? logical
      : neutral;
  const score = Math.min(82, Math.round(Math.min(input.wordCount, 55) * 1.2 + (hasExample ? 24 : 0) + (hasLink ? 16 : 0)));

  return {
    memberReply: pool[turnCount % pool.length],
    coachFeedback: hasExample ? 'Good support. Now add a sharper conclusion.' : 'The point is understandable, but it needs one concrete example.',
    score,
    nextPrompt: hasExample ? `Can you conclude your stand on ${topicCore}?` : `Can you give one practical example related to ${topicCore}?`
  };
};

const stripMiniGdSpeakerPrefix = (text = '') => (
  String(text).replace(/^\s*(aarav|sam|meera|leo|kabir|coach|teacher)\s*:\s*/i, '').trim()
);

const getPersonaKey = (persona, index) => persona?._id || `${persona?.name || 'persona'}-${index}`;

const buildSessionPersona = (persona = {}, index = 0) => {
  const name = persona.name || `AI ${index + 1}`;
  const role = persona.role || 'AI Participant';
  const style = persona.style || 'Balanced and professional';
  const desc = persona.desc || '';
  const pressure = Math.max(0, Math.min(100, Number(persona.pressure) || 60));
  const initialIntro = persona.initialIntro || desc || `I will contribute as ${role}.`;
  const customPrompt = persona.prompt || '';

  return {
    name,
    role,
    color: persona.color || '#0f766e',
    style,
    pressure,
    desc,
    initialIntro,
    prompt: [
      `You are ${name}, a realistic Group Discussion participant.`,
      `Role/personality: ${role}.`,
      `Way of speech: ${style}.`,
      desc ? `Character description: ${desc}.` : '',
      `Pressure level: ${pressure}/100. Higher pressure means more assertive, challenging, and frequent participation.`,
      initialIntro ? `Opening behavior: ${initialIntro}` : '',
      customPrompt ? `Additional behavior instructions: ${customPrompt}` : '',
      'Stay true to this personality in every reply. Do not become a generic AI speaker.'
    ].filter(Boolean).join('\n')
  };
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

export default function Dashboard({ onStartSession, onViewReport, activeSection = 'setup', onChangeSection, currentUser, appSettings = {} }) {
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
  const [forumPosts, setForumPosts] = useState([]);
  const [forumCategory, setForumCategory] = useState('All');
  const [forumDraft, setForumDraft] = useState({ title: '', body: '', category: 'GD Doubt', tags: '' });
  const [forumError, setForumError] = useState('');
  const [isForumSubmitting, setIsForumSubmitting] = useState(false);
  const [isForumComposerOpen, setIsForumComposerOpen] = useState(false);
  const [expandedForumPost, setExpandedForumPost] = useState(null);
  const [forumReplyDrafts, setForumReplyDrafts] = useState({});
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
  const [selectedPersonaKeys, setSelectedPersonaKeys] = useState([]);
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
    const timer = setTimeout(() => {
      if (appSettings.targetIndustry && INDUSTRY_CONTEXTS.includes(appSettings.targetIndustry)) {
        setIndustryContext(appSettings.targetIndustry);
      }

      const minutes = Number(String(appSettings.preferredDuration || '').match(/\d+/)?.[0]);
      if ([2, 5, 10].includes(minutes)) {
        setDuration(minutes);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [appSettings.targetIndustry, appSettings.preferredDuration]);

  useEffect(() => {
    if (activeSection === 'innovation') {
      fetchForumPosts();
    }
  }, [activeSection, forumCategory]);

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

  const fetchForumPosts = async () => {
    try {
      setForumError('');
      const query = forumCategory && forumCategory !== 'All' ? `?category=${encodeURIComponent(forumCategory)}` : '';
      const res = await fetch(`http://localhost:5000/api/forum/posts${query}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Could not load community posts');
      const posts = await res.json();
      setForumPosts(posts);
    } catch (error) {
      console.warn('Forum sync unavailable:', error.message);
      setForumError('Community forum is offline. Start the backend to sync public posts.');
    }
  };

  const submitForumPost = async (event) => {
    event.preventDefault();
    const body = forumDraft.body.trim();
    const title = forumDraft.title.trim() || body.split(/\s+/).slice(0, 10).join(' ');
    if (!body) return;

    try {
      setIsForumSubmitting(true);
      setForumError('');
      const res = await fetch('http://localhost:5000/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...forumDraft, title, body })
      });
      if (!res.ok) throw new Error('Could not create post');
      const saved = await res.json();
      setForumPosts(prev => [saved, ...prev]);
      setForumDraft({ title: '', body: '', category: 'GD Doubt', tags: '' });
      setIsForumComposerOpen(false);
    } catch (error) {
      console.warn('Forum post failed:', error.message);
      setForumError('Could not post your question. Please check the backend connection.');
    } finally {
      setIsForumSubmitting(false);
    }
  };

  const voteForumPost = async (postId, reaction = 'like') => {
    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reaction })
      });
      if (!res.ok) throw new Error('Vote failed');
      const updated = await res.json();
      setForumPosts(prev => prev.map(post => post._id === updated._id ? updated : post));
    } catch (error) {
      console.warn('Forum vote failed:', error.message);
    }
  };

  const replyForumPost = async (postId) => {
    const text = (forumReplyDrafts[postId] || '').trim();
    if (!text) return;

    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('Comment failed');
      const updated = await res.json();
      setForumPosts(prev => prev.map(post => post._id === updated._id ? updated : post));
      setForumReplyDrafts(prev => ({ ...prev, [postId]: '' }));
      setExpandedForumPost(postId);
    } catch (error) {
      console.warn('Forum comment failed:', error.message);
    }
  };

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

  const validSelectedPersonaKeys = selectedPersonaKeys.filter(key => (
    aiPersonas.some((persona, index) => getPersonaKey(persona, index) === key)
  ));
  const effectiveSelectedPersonaKeys = validSelectedPersonaKeys.length
    ? validSelectedPersonaKeys
    : aiPersonas.slice(0, numParticipants).map(getPersonaKey);
  const selectedSetupPersonas = effectiveSelectedPersonaKeys
    .map(key => aiPersonas.find((persona, index) => getPersonaKey(persona, index) === key))
    .filter(Boolean);
  const selectedSessionPersonas = (selectedSetupPersonas.length ? selectedSetupPersonas : aiPersonas.slice(0, numParticipants))
    .map(buildSessionPersona);

  const selectParticipantCount = (count) => {
    const nextCount = Math.min(count, aiPersonas.length || count);
    setNumParticipants(nextCount);
    setSelectedPersonaKeys(aiPersonas.slice(0, nextCount).map(getPersonaKey));
  };

  const toggleSetupPersona = (persona, index) => {
    const key = getPersonaKey(persona, index);
    const currentKeys = effectiveSelectedPersonaKeys;
    const isSelected = currentKeys.includes(key);
    const next = isSelected ? currentKeys.filter(item => item !== key) : [...currentKeys, key];
    const capped = next.slice(0, 4);
    setSelectedPersonaKeys(capped);
    setNumParticipants(Math.max(1, capped.length));
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (selectedSessionPersonas.length === 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('http://localhost:5000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          topic,
          durationLimit: duration,
          industryContext,
          numParticipants: selectedSessionPersonas.length,
          aiPersonas: selectedSessionPersonas
        })
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
        numParticipants: selectedSessionPersonas.length,
        aiPersonas: selectedSessionPersonas,
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

  const miniGdMember = aiPersonas[miniGdMemberIndex] || aiPersonas[0] || PERSONA_TEMPLATES[0];
  const visibleMiniGdTurns = miniGdTurns.filter(turn => turn.speaker !== 'CoachNote');
  const miniGdUserTurns = miniGdTurns.filter(turn => turn.speaker === 'You');
  const latestMiniCoachTurn = [...miniGdTurns].reverse().find(turn => turn.speaker === 'CoachNote');
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
        text: `Mini GD started. Topic: ${topic}. I will act as your teacher and guide your answer step by step. Start with one clear point, one reason, and one example.`
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
    const turnCount = miniGdTurns.length;
    setMiniGdInput('');
    setMiniGdThinking(true);
    const nextTurns = [...miniGdTurns, { speaker: 'You', text }];
    setMiniGdTurns(nextTurns);

    try {
      const startedAt = Date.now();
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
      const remainingDelay = Math.max(0, 900 - (Date.now() - startedAt));
      if (remainingDelay) {
        await new Promise(resolve => setTimeout(resolve, remainingDelay));
      }
      if (roundId !== miniGdRoundIdRef.current) return;
      setMiniGdTurns(prev => [
        ...prev,
        { speaker: 'Coach', text: stripMiniGdSpeakerPrefix(data.memberReply) },
        { speaker: 'CoachNote', text: `${data.coachFeedback} Quick score: ${data.score}/100. ${data.nextPrompt}` }
      ]);
    } catch (error) {
      console.warn('Mini GD fallback used:', error.message);
      if (roundId !== miniGdRoundIdRef.current) return;
      const fallback = buildMiniGdLocalTurn({ topic, text, member: miniGdMember, turnCount });
      await new Promise(resolve => setTimeout(resolve, 700));
      if (roundId !== miniGdRoundIdRef.current) return;
      setMiniGdTurns(prev => [
        ...prev,
        { speaker: 'Coach', text: stripMiniGdSpeakerPrefix(fallback.memberReply) },
        { speaker: 'CoachNote', text: `${fallback.coachFeedback} Quick score: ${fallback.score}/100. ${fallback.nextPrompt}` }
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
          <span>{selectedSessionPersonas.length || numParticipants}</span>
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
            <div><strong>Room</strong><small>{selectedSessionPersonas.length || numParticipants} members · {duration} min</small></div>
          </div>

          <div className="setup-rail-note">
            <Sparkles size={18} />
            <p>{appSettings.requestMode || 'Free-tier balanced'} keeps Gemini calls controlled while the round stays interactive.</p>
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
            <p>{appSettings.coachingIntensity || 'Balanced'} coaching with {appSettings.voiceMode || 'balanced AI voices'}.</p>
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
                <button key={num} type="button" onClick={() => selectParticipantCount(num)} className={numParticipants === num ? 'is-active' : ''}>
                  <Users size={16} /> {num}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-field">
            <div className="setup-refresh-label">
              <label>Select AI Panel</label>
              <button type="button" onClick={() => onChangeSection?.('members')}>
                <Settings size={13} />
                Edit members
              </button>
            </div>
            <div className="setup-persona-picker">
              {aiPersonas.map((persona, index) => {
                const key = getPersonaKey(persona, index);
                const isSelected = effectiveSelectedPersonaKeys.includes(key);

                return (
                  <button
                    key={key}
                    type="button"
                    className={`setup-persona-choice ${isSelected ? 'is-selected' : ''}`}
                    style={{ '--persona-color': persona.color || '#0f766e' }}
                    onClick={() => toggleSetupPersona(persona, index)}
                  >
                    <span>{persona.name?.charAt(0) || 'A'}</span>
                    <strong>{persona.name || `AI ${index + 1}`}</strong>
                    <small>{persona.role || 'AI Participant'}</small>
                  </button>
                );
              })}
            </div>
            <p className="setup-persona-note">
              Selected members use their edited speech style, pressure, description, opening line, and behavior prompt in the live round.
            </p>
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
              <small>{selectedSessionPersonas.length} AI · {duration} min</small>
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
        <p>No group discussions found. Complete your first practice round from Start a GD.</p>
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
                  <strong>Coach</strong>
                  <p>Reviewing your point...</p>
                </div>
              )}
              <div ref={miniGdEndRef} />
            </div>

            <form className="mini-gd-input-row" onSubmit={submitMiniGdTurn}>
              <input
                value={miniGdInput}
                onChange={(e) => setMiniGdInput(e.target.value)}
                disabled={miniGdState !== 'running' || miniGdThinking}
                placeholder={miniGdState === 'running' ? 'Type your GD answer for the coach...' : 'Start Mini GD to unlock response box'}
              />
              <button type="submit" className="btn-secondary" disabled={miniGdState !== 'running' || miniGdThinking || !miniGdInput.trim()}>
                {miniGdThinking ? 'Thinking' : 'Send'}
              </button>
            </form>
          </div>

          <div className="mini-gd-side">
            <div className="mini-gd-coach-card">
              <strong>Coaching Style</strong>
              <select
                value={miniGdMemberIndex}
                onChange={(e) => setMiniGdMemberIndex(Number(e.target.value))}
                disabled={miniGdState === 'running'}
              >
                {aiPersonas.map((persona, index) => (
                  <option key={`${persona.name}-${index}`} value={index}>
                    {persona.role}
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

  const renderInnovationLab = () => {
    let forumUser;
    try {
      forumUser = currentUser || JSON.parse(localStorage.getItem('gd_user') || '{}');
    } catch {
      forumUser = {};
    }
    const forumUserName = forumUser.name || 'GD Learner';
    const forumUserPhoto = forumUser.profilePhoto || '';
    const userPostCount = forumPosts.filter(post => post.authorName === forumUserName).length;

    return (
    <>
      <SectionHeader
        icon={MessageCircle}
        title="Community Forum"
        description="Ask public GD doubts, request topics, share feature suggestions, and learn from other users."
        action={<button className="btn-primary" type="button" onClick={fetchForumPosts}><RefreshCw size={16} /> Refresh</button>}
      />

      <div className="community-layout community-template-layout">
        <aside className="community-left-rail">
          <div className="community-profile-card">
            <div className="community-profile-cover" />
            <div className="community-profile-avatar">
              {forumUserPhoto ? <img src={forumUserPhoto} alt={forumUserName} /> : forumUserName.charAt(0).toUpperCase()}
            </div>
            <h2>{forumUserName}</h2>
            <p>{forumUser.role || 'Community Member'}</p>
            <div className="community-profile-stat">
              <span>Posts</span>
              <strong>{userPostCount}</strong>
            </div>
            <div className="community-profile-stat">
              <span>Sessions</span>
              <strong>{history.length || 0}</strong>
            </div>
            <button type="button" onClick={() => onChangeSection?.('history')}>View Progress</button>
          </div>

          <div className="community-side-card">
            <div className="community-side-head">
              <strong>Suggestions</strong>
              <span>+</span>
            </div>
            {[
              ['Ask for counter lines', 'I need stronger counter points for a GD topic. Please suggest practical lines and examples.'],
              ['Request trending topics', 'Please suggest current GD topics that are useful for placement practice.'],
              ['Share a GD tip', 'Here is one practice tip that helped me improve in group discussion rounds:']
            ].map(([item, body]) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setForumDraft(prev => ({ ...prev, title: item, body }));
                  setIsForumComposerOpen(true);
                }}
              >
                <span>{item.charAt(0)}</span>
                <small>{item}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="community-center-column">
          <div className="flat-card community-thread-toolbar">
            <div>
              <span>Forum Discussions</span>
              <strong>Posts and comments</strong>
            </div>
            <button type="button" className="btn-primary" onClick={() => setIsForumComposerOpen(true)}>
              <Send size={16} />
              New Post
            </button>
          </div>

          <section className="flat-card community-feed">
            <div className="community-filter-row">
              {['All', 'GD Doubt', 'Topic Request', 'Feature Suggestion', 'Practice Tip'].map(category => (
                <button
                  key={category}
                  type="button"
                  className={forumCategory === category ? 'is-active' : ''}
                  onClick={() => setForumCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="community-post-list">
              {forumPosts.length === 0 ? (
                <div className="community-empty">
                  <MessageCircle size={34} />
                  <strong>No community posts yet</strong>
                  <span>Start with the first GD doubt or feature suggestion.</span>
                </div>
              ) : forumPosts.map(post => (
                <article key={post._id} className="community-post-card">
                  <div>
                    <div className="community-post-meta">
                      <span className="community-author-avatar">
                        {post.authorPhoto ? <img src={post.authorPhoto} alt={post.authorName || 'Author'} /> : (post.authorName || 'C').charAt(0).toUpperCase()}
                      </span>
                      <span>{post.category}</span>
                      <small>{post.authorName || 'Community Member'} - {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.body}</p>
                    {post.tags?.length > 0 && (
                      <div className="community-tags">
                        {post.tags.map(tag => <em key={tag}>{tag}</em>)}
                      </div>
                    )}
                    <div className="community-post-actions">
                      <button
                        type="button"
                        className={post.isLiked ? 'is-active' : ''}
                        onClick={() => voteForumPost(post._id, 'like')}
                      >
                        <ThumbsUp size={16} />
                        Helpful ({post.votes || 0})
                      </button>
                      <button
                        type="button"
                        className={post.isDisliked ? 'is-active dislike' : ''}
                        onClick={() => voteForumPost(post._id, 'dislike')}
                      >
                        <ThumbsDown size={16} />
                        Dislike ({post.dislikes || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedForumPost(expandedForumPost === post._id ? null : post._id)}
                      >
                        <MessageSquare size={16} />
                        Comments ({post.replies?.length || 0})
                      </button>
                    </div>

                    {expandedForumPost === post._id && (
                      <div className="community-comments">
                        <div className="community-comment-list">
                          {post.replies?.length > 0 ? post.replies.map(reply => (
                            <div key={reply._id || reply.createdAt} className="community-comment">
                              <div className="community-comment-avatar">
                                {reply.authorPhoto ? <img src={reply.authorPhoto} alt={reply.authorName || 'Comment author'} /> : (reply.authorName || 'C').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{reply.authorName || 'Community Member'}</strong>
                                <small>{new Date(reply.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                                <p>{reply.text}</p>
                              </div>
                            </div>
                          )) : (
                            <div className="community-comment-empty">No comments yet. Add the first helpful reply.</div>
                          )}
                        </div>
                        <div className="community-comment-box">
                          <input
                            value={forumReplyDrafts[post._id] || ''}
                            onChange={(e) => setForumReplyDrafts(prev => ({ ...prev, [post._id]: e.target.value }))}
                            placeholder="Write a comment or suggestion..."
                          />
                          <button
                            type="button"
                            onClick={() => replyForumPost(post._id)}
                            disabled={!(forumReplyDrafts[post._id] || '').trim()}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

      </div>

      {isForumComposerOpen && (
        <div className="community-modal-backdrop" role="presentation" onMouseDown={() => setIsForumComposerOpen(false)}>
          <form className="community-post-modal" onSubmit={submitForumPost} onMouseDown={(e) => e.stopPropagation()}>
            <div className="community-post-modal-head">
              <div>
                <span>New Discussion</span>
                <h2>Post to Community Forum</h2>
                <p>Write one clear doubt, suggestion, or topic request. It will appear as a wide discussion card.</p>
              </div>
              <button type="button" onClick={() => setIsForumComposerOpen(false)} aria-label="Close post modal">Close</button>
            </div>
            <input
              value={forumDraft.title}
              onChange={(e) => setForumDraft(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Optional title. Example: How do I handle an aggressive participant?"
              maxLength={140}
            />
            <textarea
              value={forumDraft.body}
              onChange={(e) => setForumDraft(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Write your full post here. Add context, what happened, and what kind of suggestion you need..."
              maxLength={2000}
            />
            <div className="community-compose-row">
              <select value={forumDraft.category} onChange={(e) => setForumDraft(prev => ({ ...prev, category: e.target.value }))}>
                <option>GD Doubt</option>
                <option>Topic Request</option>
                <option>Feature Suggestion</option>
                <option>Practice Tip</option>
              </select>
              <input
                value={forumDraft.tags}
                onChange={(e) => setForumDraft(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="tags: placement, AI, confidence"
              />
            </div>
            {forumError && <div className="community-error">{forumError}</div>}
            <div className="community-post-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsForumComposerOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isForumSubmitting || !forumDraft.body.trim()}>
                <Send size={16} />
                {isForumSubmitting ? 'Posting...' : 'Post Discussion'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
    );
  };

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

      {activeSection === 'setup' && renderSetup()}
      {activeSection === 'prep' && renderPrepCoach()}
      {activeSection === 'innovation' && renderInnovationLab()}
      {activeSection === 'members' && renderMembers()}
      {activeSection === 'history' && renderHistory()}
    </div>
  );
}
