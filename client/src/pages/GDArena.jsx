import { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, RefreshCw, ShieldAlert, Camera, CameraOff, Play, Pause, Square, FileText, X } from 'lucide-react';
import Webcam from 'react-webcam';
import { io } from 'socket.io-client';

const AI_MEMBERS = [
  { name: 'Sam', role: 'The Dominator', color: '#f43f5e', initialIntro: 'Let me start off by stating that we cannot ignore the direct threats. We must take immediate control of this topic.', prompt: 'You are aggressive, speak fast, and challenge others immediately. You value assertiveness.' },
  { name: 'Meera', role: 'The Analyst', color: '#06b6d4', initialIntro: 'From a statistical perspective, the research shows a substantial structural shift in how this topic impacts modern frameworks.', prompt: 'You are academic, fact-driven, structured, and use bullet points and data. You stay calm.' },
  { name: 'Leo', role: 'The Harmonizer', color: '#10b981', initialIntro: 'It is wonderful to be discussing this. Let\'s remember to hear everyone out and try to find a collaborative balance.', prompt: 'You are encouraging, supportive, bridge opposing ideas, and summarize points to build consensus.' },
  { name: 'Kabir', role: 'The Skeptic', color: '#f59e0b', initialIntro: 'Before we jump to conclusions, I want to challenge the core assumption we are basing this whole premise on.', prompt: 'You play devil\'s advocate, raise doubts, question assertions, and demand logical backing.' }
];

const normalizeAIMember = (persona, index) => ({
  name: persona.name || `AI ${index + 1}`,
  role: persona.role || 'AI Participant',
  color: persona.color || AI_MEMBERS[index % AI_MEMBERS.length].color,
  initialIntro: persona.initialIntro || persona.desc || AI_MEMBERS[index % AI_MEMBERS.length].initialIntro,
  prompt: persona.prompt || [
    `You are ${persona.name || `AI ${index + 1}`}, a realistic Group Discussion participant.`,
    `Role/personality: ${persona.role || 'AI Participant'}.`,
    `Way of speech: ${persona.style || 'balanced and professional'}.`,
    persona.desc ? `Character description: ${persona.desc}.` : '',
    `Pressure level: ${persona.pressure || 60}/100.`,
    'Stay true to this personality in every reply. Do not become a generic AI speaker.'
  ].filter(Boolean).join('\n'),
  style: persona.style,
  pressure: persona.pressure,
  desc: persona.desc
});

const getConfiguredAIMembers = (sessionPersonas = []) => {
  if (Array.isArray(sessionPersonas) && sessionPersonas.length > 0) {
    return sessionPersonas.map(normalizeAIMember);
  }

  try {
    const savedPersonas = JSON.parse(localStorage.getItem('gd_ai_personas')) || [];
    if (!Array.isArray(savedPersonas) || savedPersonas.length === 0) return AI_MEMBERS;
    return savedPersonas.map(normalizeAIMember);
  } catch {
    return AI_MEMBERS;
  }
};

const VOICE_PROFILES = {
  Sam: {
    rate: 1.14,
    pitch: 0.82,
    voiceHints: ['Microsoft David', 'Google US English', 'Male', 'Daniel']
  },
  Meera: {
    rate: 0.98,
    pitch: 1.12,
    voiceHints: ['Microsoft Zira', 'Google UK English Female', 'Female', 'Samantha']
  },
  Leo: {
    rate: 0.92,
    pitch: 1.04,
    voiceHints: ['Google US English', 'Microsoft Jenny', 'Female', 'Karen']
  },
  Kabir: {
    rate: 1.02,
    pitch: 0.9,
    voiceHints: ['Microsoft Mark', 'Google UK English Male', 'Male', 'Alex']
  },
  'HR Moderator': {
    rate: 0.96,
    pitch: 0.78,
    voiceHints: ['Microsoft David', 'Google UK English Male', 'Male']
  }
};

const selectVoice = (voices, speakerName) => {
  const hints = VOICE_PROFILES[speakerName]?.voiceHints || [];
  return hints
    .map(hint => voices.find(voice => voice.name.includes(hint)))
    .find(Boolean) || voices.find(voice => voice.lang?.startsWith('en')) || voices[0];
};

const scoreLocalContribution = (transcript, userMetrics) => {
  const userText = transcript
    .filter(t => t.speaker === 'User')
    .map(t => t.text || '')
    .join(' ')
    .toLowerCase()
    .replace(/\[interrupted\]/g, ' ')
    .trim();
  const words = userText.match(/[a-z0-9']+/g) || [];
  const uniqueWords = new Set(words);
  const lowValueWords = new Set(['ok', 'okay', 'yes', 'yeah', 'no', 'hmm', 'fine', 'right', 'true']);
  const meaningfulWords = words.filter(word => !lowValueWords.has(word));
  const repeatedLowEffort = words.length > 0 && meaningfulWords.length <= 2 && uniqueWords.size <= 3;
  const isVeryWeak = words.length < 12 || repeatedLowEffort || meaningfulWords.length < 6;

  if (userMetrics.speakingTime === 0 || words.length === 0) {
    return { leadership: 0, confidence: 0, effectiveness: 0, isVeryWeak, repeatedLowEffort };
  }

  if (repeatedLowEffort) {
    return { leadership: 12, confidence: 18, effectiveness: 10, isVeryWeak, repeatedLowEffort };
  }

  if (isVeryWeak || userMetrics.speakingTime < 10) {
    return { leadership: 28, confidence: 32, effectiveness: 25, isVeryWeak, repeatedLowEffort };
  }

  const pacingPenalty = userMetrics.pacingWpm < 90 || userMetrics.pacingWpm > 160 ? 10 : 0;
  const interruptionPenalty = Math.min(userMetrics.interruptionCount * 4, 16);
  const fillerPenalty = Math.min(userMetrics.fillerWordCount * 3, 18);

  return {
    leadership: Math.max(35, Math.min(82, 58 + userMetrics.speakPercentage / 3 - interruptionPenalty)),
    confidence: Math.max(35, Math.min(84, 68 - pacingPenalty - fillerPenalty)),
    effectiveness: Math.max(32, Math.min(86, 55 + Math.min(meaningfulWords.length, 40) / 2)),
    isVeryWeak,
    repeatedLowEffort
  };
};

const buildLocalAIReply = (topic, aiMember, transcript) => {
  const topicCore = String(topic || 'this topic').replace(/[?.!]+$/, '');
  const lastTurn = transcript[transcript.length - 1];
  const lastSpeaker = lastTurn?.speaker || 'the group';
  const personaText = `${aiMember?.role || ''} ${aiMember?.style || ''} ${aiMember?.prompt || ''}`.toLowerCase();
  const turnIndex = transcript.length;
  const topicAngles = [
    `who benefits most from ${topicCore}`,
    `what practical risk appears when ${topicCore} is implemented`,
    `how ${topicCore} affects students, workers, or organizations differently`,
    `whether ${topicCore} works in real life, not just in theory`,
    `what safeguard would make ${topicCore} fairer`
  ];
  const angle = topicAngles[turnIndex % topicAngles.length];

  if (personaText.includes('aggressive') || personaText.includes('interrupt')) {
    return `I want to push back on ${lastSpeaker}'s point. The real question is ${angle}, and nobody has answered that directly yet.`;
  }
  if (personaText.includes('logical') || personaText.includes('technical') || personaText.includes('data')) {
    return `For ${topicCore}, I would use a measurable lens: cost, adoption, and long-term impact. That helps us judge ${angle} instead of staying generic.`;
  }
  if (personaText.includes('emotional') || personaText.includes('empathy')) {
    return `We should also look at the human side of ${topicCore}. The debate changes when we ask ${angle} for people who are directly affected.`;
  }
  if (personaText.includes('leader') || personaText.includes('dominant')) {
    return `Let me structure the discussion around ${topicCore}: impact first, feasibility second, and fairness third. That will keep us from repeating the same point.`;
  }
  if (personaText.includes('silent') || personaText.includes('observer')) {
    return `I have been listening, and the missing angle is ${angle}. A short summary before moving ahead would make the discussion stronger.`;
  }
  if (personaText.includes('skeptic') || personaText.includes('challenge')) {
    return `I am not fully convinced yet. On ${topicCore}, what if the expected benefit fails because we ignored ${angle}?`;
  }

  return `Building on ${lastSpeaker}'s point, ${topicCore} needs a balanced view. We should discuss ${angle} before reaching a conclusion.`;
};

const pickWeightedAIMember = (members) => {
  const weighted = members.flatMap(member => {
    const personaText = `${member.role || ''} ${member.style || ''} ${member.prompt || ''}`.toLowerCase();
    const pressure = Number(member.pressure) || 55;
    let weight = Math.max(1, Math.round(pressure / 25));

    if (personaText.includes('dominant') || personaText.includes('aggressive') || personaText.includes('interrupt')) weight += 2;
    if (personaText.includes('silent') || personaText.includes('observer') || personaText.includes('nervous')) weight = Math.max(1, weight - 2);

    return Array.from({ length: weight }, () => member);
  });

  return weighted[Math.floor(Math.random() * weighted.length)] || members[0];
};

export default function GDArena({ session, onComplete }) {
  const currentSession = session || {
    _id: 'missing_session',
    topic: 'Untitled discussion',
    durationLimit: 2,
    numParticipants: 4,
    industryContext: 'General / Academic'
  };
  const activeAIMembers = useMemo(
    () => getConfiguredAIMembers(currentSession.aiPersonas).slice(0, currentSession.numParticipants || 4),
    [currentSession.aiPersonas, currentSession.numParticipants]
  );
  const [timeLeft, setTimeLeft] = useState(Number(currentSession.durationLimit || 2) * 60);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('System');
  const [activeSpeechText, setActiveSpeechText] = useState('');
  const [discussionState, setDiscussionState] = useState('idle'); // idle, ongoing, paused, analyzing
  const [isMuted, setIsMuted] = useState(false); // AI Speech Synthesis toggle
  const [isMicActive, setIsMicActive] = useState(false);
  const [interruptionAlert, setInterruptionAlert] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  // Real-time quantitative calculations
  const [userSpeakingTime, setUserSpeakingTime] = useState(0);
  const [userInterruptionCount, setUserInterruptionCount] = useState(0);
  const [userInterruptedCount] = useState(0);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);
  const [aiSpeakingTimes, setAiSpeakingTimes] = useState({ Sam: 0, Meera: 0, Leo: 0, Kabir: 0 });
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [bodyLanguageScore, setBodyLanguageScore] = useState(85);
  const [aiRateStatus, setAiRateStatus] = useState(null);
  const [speechVoices, setSpeechVoices] = useState([]);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isNotesDocked, setIsNotesDocked] = useState(false);
  const [roundNotes, setRoundNotes] = useState(() => currentSession.roundNotes || localStorage.getItem(`gd_round_notes_${currentSession._id}`) || '');
  const [summaryText, setSummaryText] = useState('');

  const authHeaders = () => {
    const token = localStorage.getItem('gd_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Web Speech references
  const recognitionRef = useRef(null);
  const userSpeakingTimerRef = useRef(null);
  const activeAITimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const conversationEndTriggeredRef = useRef(false);
  const autoSpeechQueueRef = useRef(null);
  const trackingTimerRef = useRef(null);
  const socketRef = useRef(null);
  const aiResponseInFlightRef = useRef(false);
  const hasRoundStartedRef = useRef(false);
  const lastModerationTurnRef = useRef(0);
  const latestRoundRef = useRef({});
  const submitSpeechRef = useRef(null);
  const discussionStateRef = useRef('idle');

  // Auto scroll transcript panel
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    // Scroll transcript
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    latestRoundRef.current = {
      transcript,
      userSpeakingTime,
      userInterruptionCount,
      userInterruptedCount,
      fillerWordsCount,
      aiSpeakingTimes,
      isVideoActive,
      bodyLanguageScore,
      activeAIMembers
    };
  }, [
    transcript,
    userSpeakingTime,
    userInterruptionCount,
    userInterruptedCount,
    fillerWordsCount,
    aiSpeakingTimes,
    isVideoActive,
    bodyLanguageScore,
    activeAIMembers
  ]);

  useEffect(() => {
    const notesTimer = setTimeout(() => {
      setRoundNotes(currentSession.roundNotes || localStorage.getItem(`gd_round_notes_${currentSession._id}`) || '');
    }, 0);
    return () => clearTimeout(notesTimer);
  }, [currentSession._id, currentSession.roundNotes]);

  useEffect(() => {
    submitSpeechRef.current = handleUserSpeechSubmitted;
  });

  useEffect(() => {
    discussionStateRef.current = discussionState;
  }, [discussionState]);

  useEffect(() => {
    const loadVoices = () => {
      setSpeechVoices(window.speechSynthesis?.getVoices?.() || []);
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearInterval(countdownTimerRef.current);
      clearInterval(userSpeakingTimerRef.current);
      clearInterval(activeAITimerRef.current);
      clearTimeout(autoSpeechQueueRef.current);
      clearInterval(trackingTimerRef.current);
      aiResponseInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/sessions/ai/status', {
          headers: authHeaders()
        });
        if (res.ok) {
          setAiRateStatus(await res.json());
        }
      } catch {
        setAiRateStatus(null);
      }
    };

    fetchAIStatus();
    const statusTimer = setInterval(fetchAIStatus, 15000);
    return () => clearInterval(statusTimer);
  }, []);

  // Socket.io initialization
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join-room', currentSession._id);

    socketRef.current.on('receive-message', (message) => {
      setTranscript(prev => {
        // Prevent duplicate local messages if echoed
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socketRef.current.on('sync-state', (state) => {
      if (state.activeSpeaker) setActiveSpeaker(state.activeSpeaker);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [currentSession._id]);

  // Initialize Speech Synthesis and Recognition
  useEffect(() => {
    // Initialize Web Speech API for transcribing
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsMicActive(true);
        console.log('Voice recognition started...');
      };

      rec.onend = () => {
        setIsMicActive(false);
        console.log('Voice recognition stopped.');
      };

      rec.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const text = event.results[lastResultIndex][0].transcript.trim();
        if (text) {
          submitSpeechRef.current?.(text);
        }
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        setIsMicActive(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Countdown clock: only runs while the GD is actively ongoing.
  useEffect(() => {
    clearInterval(countdownTimerRef.current);

    if (discussionState !== 'ongoing') return undefined;

    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          if (!conversationEndTriggeredRef.current) {
            handleEndDiscussion();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimerRef.current);
  }, [discussionState]);

  // Speaking time counters
  useEffect(() => {
    if (discussionState === 'ongoing') {
      if (activeSpeaker === 'User') {
        clearInterval(activeAITimerRef.current);
        userSpeakingTimerRef.current = setInterval(() => {
          setUserSpeakingTime(prev => prev + 1);
        }, 1000);
      } else if (activeAIMembers.some(ai => ai.name === activeSpeaker)) {
        clearInterval(userSpeakingTimerRef.current);
        activeAITimerRef.current = setInterval(() => {
          setAiSpeakingTimes(prev => ({
            ...prev,
            [activeSpeaker]: prev[activeSpeaker] + 1
          }));
        }, 1000);
      } else {
        clearInterval(userSpeakingTimerRef.current);
        clearInterval(activeAITimerRef.current);
      }
    } else {
      clearInterval(userSpeakingTimerRef.current);
      clearInterval(activeAITimerRef.current);
    }
    
    return () => {
      clearInterval(userSpeakingTimerRef.current);
      clearInterval(activeAITimerRef.current);
    };
  }, [activeSpeaker, discussionState]);

  // AI Orchestration Engine: Speaks when silent
  useEffect(() => {
    if (discussionState === 'ongoing' && activeSpeaker === 'System') {
      // If the discussion floor is back to 'System' (idle), let an AI pick up the thread after a small delay
      clearTimeout(autoSpeechQueueRef.current);
      const quotaDelay = aiRateStatus?.enabled
        ? Math.max(0, aiRateStatus.nextAllowedInMs || 0)
        : 0;
      const turnDelay = Math.max(4000, quotaDelay + 800);

      autoSpeechQueueRef.current = setTimeout(() => {
        triggerNextAISpeaker();
      }, turnDelay);
    }
  }, [activeSpeaker, discussionState, aiRateStatus]);

  // Simulated Webcam Tracking Loop
  useEffect(() => {
    if (discussionState === 'ongoing' && isVideoActive) {
      trackingTimerRef.current = setInterval(() => {
        // Randomly adjust body language score to simulate tracking eye contact and posture
        setBodyLanguageScore(prev => {
          const shift = Math.random() > 0.3 ? 2 : -3;
          return Math.max(10, Math.min(100, prev + shift));
        });
      }, 5000);
    } else {
      clearInterval(trackingTimerRef.current);
    }
    return () => clearInterval(trackingTimerRef.current);
  }, [discussionState, isVideoActive]);

  // Append entry to transcript
  function appendTranscript(speaker, text, isInterrupted = false, isRemote = false) {
    const newMessage = {
      id: Date.now() + Math.random(),
      speaker,
      text,
      timestamp: new Date(),
      isInterrupted
    };
    
    setTranscript(prev => [...prev, newMessage]);

    if (!isRemote && socketRef.current) {
      socketRef.current.emit('send-message', { roomId: currentSession._id, message: newMessage });
    }
  };

  // Synchronize Active Speaker via Socket
  function setAndSyncActiveSpeaker(speaker) {
    setActiveSpeaker(speaker);
    if (speaker === 'System') setActiveSpeechText('');
    if (socketRef.current) {
      socketRef.current.emit('sync-state', { roomId: currentSession._id, state: { activeSpeaker: speaker } });
    }
  };

  // Speaks text via Browser SpeechSynthesis
  function speakOutLoud(speakerName, text, onEndCallback) {
    window.speechSynthesis.cancel(); // cancel any active speaking

    if (isMuted) {
      // Standalone simulator: trigger completion instantly
      setTimeout(onEndCallback, 3000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const profile = VOICE_PROFILES[speakerName] || VOICE_PROFILES.Kabir;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = 1;
    
    // Choose appropriate voice profiles
    const voices = speechVoices.length ? speechVoices : window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      utterance.voice = selectVoice(voices, speakerName);
    }

    utterance.onend = () => {
      onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e.error);
      onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Triggers an AI member's dialogue turn
  function triggerAISpeech(aiName, rawText) {
    setAndSyncActiveSpeaker(aiName);
    setActiveSpeechText(rawText);
    appendTranscript(aiName, rawText);
    
    speakOutLoud(aiName, rawText, () => {
      // Revert floor to System (idle status) after speech concludes
      setAndSyncActiveSpeaker('System');
    });
  };

  // Selects which AI participant speaks next based on current transcript context
  async function triggerNextAISpeaker() {
    if (discussionStateRef.current !== 'ongoing') return;
    if (aiResponseInFlightRef.current) return;

    aiResponseInFlightRef.current = true;
    const currentTranscript = latestRoundRef.current.transcript || transcript;
    
    // MODERATION CHECK: Evaluate drift every 4 turns
    if (currentTranscript.length >= 6 && currentTranscript.length - lastModerationTurnRef.current >= 6) {
      try {
        lastModerationTurnRef.current = currentTranscript.length;
        const res = await fetch(`http://localhost:5000/api/sessions/moderate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ topic: currentSession.topic, transcript: currentTranscript })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.intervention) {
            // HR Moderator intervenes
            triggerAISpeech('HR Moderator', data.intervention);
            aiResponseInFlightRef.current = false;
            return; // Stop the regular AI from speaking this turn
          }
        }
      } catch (err) {
        console.error('Moderation check failed:', err);
      }
    }

    // Pick next AI speaker. Avoid the one who spoke last.
    const lastSpeeches = currentTranscript.slice(-3);
    const lastAIs = lastSpeeches.map(s => s.speaker).filter(s => s !== 'User' && s !== 'System');
    
    let availableAIs = activeAIMembers.filter(ai => !lastAIs.includes(ai.name));
    if (availableAIs.length === 0) availableAIs = activeAIMembers;
    
    const nextAI = pickWeightedAIMember(availableAIs);

    setAndSyncActiveSpeaker(`${nextAI.name} (Formulating...)`);
    
    try {
      const res = await fetch('http://localhost:5000/api/sessions/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          topic: currentSession.topic,
          transcript: currentTranscript.map(t => ({ speaker: t.speaker, text: t.text })),
          speakerName: nextAI.name,
          personaPrompt: nextAI.prompt,
          industryContext: currentSession.industryContext
        })
      });

      if (!res.ok) throw new Error('AI API generation error');
      const data = await res.json();
      
      // Make sure we didn't transition state during loading
      if (discussionStateRef.current === 'ongoing') {
        triggerAISpeech(nextAI.name, data.text);
        if (data.rateLimit) setAiRateStatus(data.rateLimit);
      }
    } catch {
      console.warn('Offline response generation fallback for', nextAI.name);
      if (discussionStateRef.current === 'ongoing') {
        triggerAISpeech(nextAI.name, buildLocalAIReply(currentSession.topic, nextAI, currentTranscript));
      }
    } finally {
      aiResponseInFlightRef.current = false;
    }
  };

  // Interruption Logic: trigger when user speaks
  function checkInterruption() {
    // If an AI participant is actively speaking when user starts talking, cancel TTS and log Interruption!
    if (window.speechSynthesis.speaking && activeAIMembers.some(ai => ai.name === activeSpeaker)) {
      window.speechSynthesis.cancel();
      setUserInterruptionCount(prev => prev + 1);
      
      // Update last transcript entry to show it was interrupted
      setTranscript(prev => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1].isInterrupted = true;
        copy[copy.length - 1].text += '... [Interrupted]';
        return copy;
      });

      setInterruptionAlert(true);
      setTimeout(() => setInterruptionAlert(false), 2000);
      return true;
    }
    return false;
  };

  // Handles User Speech Submission (from Mic STT or Chat Text Box)
  function handleUserSpeechSubmitted(text) {
    if (discussionStateRef.current !== 'ongoing') return;
    
    // Check if user interrupted someone
    const didInterrupt = checkInterruption();
    
    // Check for filler words in User speech
    const fillers = ['uh', 'um', 'like', 'actually', 'basically', 'you know'];
    const textLower = text.toLowerCase();
    let detectedFillers = 0;
    fillers.forEach(f => {
      const occurrences = (textLower.match(new RegExp(`\\b${f}\\b`, 'g')) || []).length;
      detectedFillers += occurrences;
    });
    if (detectedFillers > 0) {
      setFillerWordsCount(prev => prev + detectedFillers);
    }

    appendTranscript('User', text, didInterrupt);
    setActiveSpeaker('User');
    setActiveSpeechText(text);

    // Give user the floor for a short silence detection
    clearTimeout(autoSpeechQueueRef.current);
    autoSpeechQueueRef.current = setTimeout(() => {
      setActiveSpeaker('System'); // Floor returns to system idle, trigger next AI
      setActiveSpeechText('');
    }, 3500);
  };

  // Controls user microphone speech recognition
  function toggleMic() {
    if (discussionStateRef.current !== 'ongoing') return;

    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your browser or microphone is blocked. Please use the visual Text Fallback Box below to type your arguments.');
      return;
    }

    if (isMicActive) {
      recognitionRef.current.stop();
      setIsMicActive(false);
    } else {
      // Reset active speaking synthesis before activating mic
      checkInterruption();
      recognitionRef.current.start();
    }
  };

  // Submits text fallback message
  function handleTextSubmit(e) {
    e.preventDefault();
    if (!textInput.trim()) return;
    if (discussionStateRef.current !== 'ongoing') return;
    handleUserSpeechSubmitted(textInput.trim());
    setTextInput('');
  };

  function handleStartRound() {
    if (discussionState === 'ongoing' || discussionState === 'analyzing') return;

    clearTimeout(autoSpeechQueueRef.current);
    window.speechSynthesis.cancel();

    if (!hasRoundStartedRef.current) {
      hasRoundStartedRef.current = true;
      appendTranscript('System', `The Group Discussion round is starting. Topic: "${currentSession.topic}". Duration: ${currentSession.durationLimit} minutes.`);
      setActiveSpeechText('');
      setAndSyncActiveSpeaker('System');

      autoSpeechQueueRef.current = setTimeout(() => {
        if (discussionStateRef.current !== 'ongoing') return;
        const firstSpeaker = activeAIMembers[Math.floor(Math.random() * activeAIMembers.length)] || activeAIMembers[0];
        if (firstSpeaker) triggerAISpeech(firstSpeaker.name, firstSpeaker.initialIntro);
      }, 900);
    }

    setDiscussionState('ongoing');
  }

  function handlePauseRound() {
    if (discussionState !== 'ongoing') return;

    clearTimeout(autoSpeechQueueRef.current);
    clearInterval(countdownTimerRef.current);
    window.speechSynthesis.cancel();
    recognitionRef.current?.stop?.();
    aiResponseInFlightRef.current = false;
    setActiveSpeechText('');
    setAndSyncActiveSpeaker('Paused');
    setDiscussionState('paused');
  }

  function handleStopRound() {
    handleEndDiscussion();
  }

  function handleToggleMute() {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (nextMuted) {
        window.speechSynthesis.cancel();
        if (activeAIMembers.some(ai => ai.name === activeSpeaker)) {
          setAndSyncActiveSpeaker('System');
        }
      }
      return nextMuted;
    });
  };

  // Triggered when GD finishes
  async function handleEndDiscussion({ skipSummary = false, summaryText: finalSummaryText = '' } = {}) {
    if (conversationEndTriggeredRef.current) return;

    window.speechSynthesis.cancel();
    clearInterval(countdownTimerRef.current);
    clearInterval(userSpeakingTimerRef.current);
    clearInterval(activeAITimerRef.current);
    clearTimeout(autoSpeechQueueRef.current);

    if (!skipSummary && discussionStateRef.current !== 'summarizing') {
      recognitionRef.current?.stop?.();
      setAndSyncActiveSpeaker('Summary');
      setActiveSpeechText('');
      setDiscussionState('summarizing');
      return;
    }

    conversationEndTriggeredRef.current = true;
    setDiscussionState('analyzing');

    const latest = latestRoundRef.current || {};
    let finalTranscript = latest.transcript || transcript;
    if (finalSummaryText.trim()) {
      finalTranscript = [
        ...finalTranscript,
        {
          id: Date.now() + Math.random(),
          speaker: 'User',
          text: `[Summary] ${finalSummaryText.trim()}`,
          timestamp: new Date(),
          isInterrupted: false
        }
      ];
    }
    const finalUserSpeakingTime = latest.userSpeakingTime ?? userSpeakingTime;
    const finalUserInterruptionCount = latest.userInterruptionCount ?? userInterruptionCount;
    const finalUserInterruptedCount = latest.userInterruptedCount ?? userInterruptedCount;
    const finalFillerWordsCount = latest.fillerWordsCount ?? fillerWordsCount;
    const finalAiSpeakingTimes = latest.aiSpeakingTimes || aiSpeakingTimes;
    const finalIsVideoActive = latest.isVideoActive ?? isVideoActive;
    const finalBodyLanguageScore = latest.bodyLanguageScore ?? bodyLanguageScore;
    const finalActiveAIMembers = latest.activeAIMembers || activeAIMembers;

    // Calculate final metrics from the latest refs so timer/mic callbacks do not close over stale state.
    const totalSpeaks = finalUserSpeakingTime + Object.values(finalAiSpeakingTimes).reduce((a, b) => a + b, 0);
    const userPct = totalSpeaks > 0 ? Math.round((finalUserSpeakingTime / totalSpeaks) * 100) : 0;
    
    // Estimate WPM based on transcript word count / speaking time
    const userWords = finalTranscript
      .filter(t => t.speaker === 'User')
      .map(t => t.text.split(' ').length)
      .reduce((a, b) => a + b, 0);
    const pacingWpm = finalUserSpeakingTime > 0 ? Math.round((userWords / finalUserSpeakingTime) * 60) : 0;

    const userMetrics = {
      speakingTime: finalUserSpeakingTime,
      speakPercentage: userPct,
      interruptionCount: finalUserInterruptionCount,
      interruptedCount: finalUserInterruptedCount,
      pacingWpm: pacingWpm || 120, // ideal default in case they typed
      fillerWordCount: finalFillerWordsCount,
      bodyLanguageScore: finalIsVideoActive ? finalBodyLanguageScore : 0
    };

    // Calculate dynamic breakdowns
    const activeNames = finalActiveAIMembers.map(a => a.name);
    let aiTotal = 0;
    activeNames.forEach(n => aiTotal += (finalAiSpeakingTimes[n] || 0));
    const totalTimes = finalUserSpeakingTime + aiTotal || 1;
    
    const participationBreakdown = [
      { name: 'User', speakingTime: finalUserSpeakingTime, percentage: Math.round((finalUserSpeakingTime / totalTimes) * 100) }
    ];
    activeNames.forEach(n => {
      participationBreakdown.push({
        name: n,
        speakingTime: finalAiSpeakingTimes[n] || 0,
        percentage: Math.round(((finalAiSpeakingTimes[n] || 0) / totalTimes) * 100)
      });
    });

    try {
      // Save session details and generate coaching diagnostics on the backend
      const res = await fetch(`http://localhost:5000/api/sessions/${currentSession._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          transcript: finalTranscript.map(t => ({ speaker: t.speaker, text: t.text, isInterrupted: t.isInterrupted })),
          userMetrics,
          participationBreakdown,
          roundNotes
        })
      });

      if (!res.ok) throw new Error('Analysis processing failed');
      const completedSession = await res.json();
      onComplete(completedSession);
    } catch (err) {
      console.warn('Backend completion failed, rendering custom sandbox metrics...', err.message);
      
      // Fallback sandbox: mock local analytics generation in 3s
      setTimeout(() => {
        const localScore = scoreLocalContribution(finalTranscript, userMetrics);
        onComplete({
          _id: currentSession._id,
          topic: currentSession.topic,
          durationLimit: currentSession.durationLimit,
          createdAt: new Date(),
          transcript: finalTranscript,
          roundNotes,
          userMetrics,
          participationBreakdown,
          aiEvaluation: {
            leadershipScore: Math.round(localScore.leadership),
            confidenceScore: Math.round(localScore.confidence),
            effectivenessScore: Math.round(localScore.effectiveness),
            analysisSummary: localScore.isVeryWeak
              ? "This local fallback assessment capped the score because the contribution was too brief or repetitive to demonstrate meaningful GD performance. A strong answer needs a claim, reasoning, example, and a link back to the topic."
              : "This local fallback assessment reviewed your speaking time, pacing, interruptions, and visible structure. Connect the backend to Gemini for deeper semantic coaching.",
            strengths: localScore.isVeryWeak ? ["Attempted to participate in the discussion."] : ["Participated with enough detail for basic scoring.", "Maintained topic engagement."],
            weaknesses: localScore.isVeryWeak ? ["Contribution lacked a clear claim, reason, example, or conclusion.", "Very short responses cannot demonstrate leadership or argument depth."] : ["Arguments could include more concrete evidence.", "Transitions between points can be sharper."],
            actionableTips: ["Use CRPE: Claim, Reason, Proof, Effect.", "Avoid one-word acknowledgements; add a complete argument.", "Reference another speaker before adding your own point."],
            topicRelevance: localScore.repeatedLowEffort ? "No meaningful topic relevance was demonstrated." : "Local analysis found basic topic participation.",
            argumentDepth: localScore.isVeryWeak ? "Very low argument depth; the response was mostly acknowledgement." : "Moderate depth. Add examples, data, or real-world consequences.",
            suggestedPhrases: [
              {
                original: finalTranscript.find(t => t.speaker === 'User')?.text || "ok",
                improved: "I believe AI will reshape employment because routine tasks may be automated, but it can also create new roles if workers receive structured reskilling support.",
                reason: "Turns a weak acknowledgement into a clear claim with reasoning and balance."
              }
            ]
          }
        });
      }, 3500);
    }
  };

  // Helper for formatting time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  const getSpeakerColor = (speaker) => {
    if (speaker === 'User') return '#10b981';
    if (speaker === 'System') return '#64748b';
    if (speaker === 'HR Moderator') return '#8b5cf6';
    return activeAIMembers.find(member => member.name === speaker)?.color || 'var(--primary)';
  };
  const getMessageTime = (timestamp) => {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const liveTip = activeSpeaker === 'User'
    ? 'You have the floor. Keep it crisp: point, reason, example, link.'
    : activeAIMembers.some(ai => ai.name === activeSpeaker)
      ? `Listen to ${activeSpeaker}'s point, then respond with agreement, counter, or example.`
      : discussionState === 'summarizing'
        ? 'Summarize both sides and end with a clear final view.'
        : 'Start the round, then use notes and prompt chips to shape your answers.';

  if (discussionState === 'summarizing') {
    return (
      <div className="summary-round-shell">
        <div className="flat-card summary-round-card">
          <span className="badge badge-primary">Summary Round</span>
          <h1>Close the GD with a 30-second summary</h1>
          <p>Summarize the strongest points, mention both sides, and end with your final position. This improves leadership scoring.</p>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder="Example: The group discussed both opportunity and risk. I believe the best path is..."
          />
          <div className="summary-round-actions">
            <button type="button" className="btn-secondary" onClick={() => handleEndDiscussion({ skipSummary: true })}>
              Skip Summary
            </button>
            <button type="button" className="btn-primary" onClick={() => handleEndDiscussion({ skipSummary: true, summaryText })}>
              <FileText size={16} />
              Evaluate With Summary
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (discussionState === 'analyzing') {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '100px auto',
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }} className="flat-card">
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <RefreshCw size={80} className="spinning-icon" style={{
            color: 'var(--primary)',
            animation: 'spin 2s linear infinite'
          }} />
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Analyzing Group Discussion...</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Our AI executive communication coach is processing the full discussion transcript, calculating pacing indices, assessing leadership behaviors, and running diagnostic metrics.
        </p>
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '999px',
          height: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: 'linear-gradient(to right, var(--primary), var(--secondary))',
            height: '100%',
            width: '70%',
            borderRadius: '999px',
            animation: 'grow 3s ease-out forwards'
          }} />
          <style>{`
            @keyframes grow { from { width: 0%; } to { width: 95%; } }
          `}</style>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Invoking Gemini Intelligent Insights
        </span>
      </div>
    );
  }

  function updateRoundNotes(value) {
    setRoundNotes(value);
    localStorage.setItem(`gd_round_notes_${currentSession._id}`, value);
  }

  return (
    <div className="arena-shell">
      
      {/* Interruption Overlay alert */}
      {interruptionAlert && (
        <div style={{
          position: 'fixed',
          top: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(244, 63, 94, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontWeight: 700,
          boxShadow: '0 8px 30px rgba(244, 63, 94, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          animation: 'pulseInterrupted 1.5s infinite'
        }}>
          <ShieldAlert size={20} />
          <span>INTERRUPTION DETECTED! AI Silenced.</span>
        </div>
      )}

      {isNotesOpen && (
        <div className={`round-notes-overlay ${isNotesDocked ? 'is-docked' : ''}`} role="dialog" aria-modal={!isNotesDocked} aria-label="GD notes">
          <div className="round-notes-panel">
            <div className="round-notes-header">
              <div>
                <span><FileText size={15} /> GD Notes</span>
                <h2>Note your points during the round</h2>
              </div>
              <div className="round-notes-header-actions">
                <button type="button" onClick={() => setIsNotesDocked(prev => !prev)} title={isNotesDocked ? 'Undock notes' : 'Dock notes'}>
                  {isNotesDocked ? 'Popup' : 'Dock'}
                </button>
                <button type="button" onClick={() => setIsNotesOpen(false)} title="Close notes">
                  <X size={18} />
                </button>
              </div>
            </div>
            <textarea
              value={roundNotes}
              onChange={(e) => updateRoundNotes(e.target.value)}
              placeholder="Write quick points, examples, counter-arguments, or summary lines here..."
            />
            <div className="round-notes-footer">
              <span>Saved with this GD session after evaluation</span>
              <button type="button" className="btn-primary" onClick={() => setIsNotesOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Info Panel */}
      <div className="flat-card arena-header">
        <div style={{ flex: 1 }}>
          <span className="badge badge-primary" style={{ marginBottom: '4px', display: 'inline-block' }}>
            {discussionState === 'idle' && 'Ready to Start'}
            {discussionState === 'ongoing' && 'Live Discussion'}
            {discussionState === 'paused' && 'Paused'}
          </span>
          <h2>{currentSession.topic}</h2>
        </div>
        
        <div className="arena-controls">
          <div className="gd-top-controls">
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartRound}
              disabled={discussionState === 'ongoing' || discussionState === 'analyzing' || timeLeft <= 0}
            >
              <Play size={16} fill="white" />
              <span>{discussionState === 'paused' ? 'Resume' : 'Start'}</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePauseRound}
              disabled={discussionState !== 'ongoing'}
            >
              <Pause size={16} />
              <span>Pause</span>
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleStopRound}
              disabled={discussionState === 'idle' || discussionState === 'analyzing'}
            >
              <Square size={15} fill="white" />
              <span>Stop</span>
            </button>
          </div>
          
          {/* Webcam Toggle */}
          <button
            onClick={() => setIsNotesOpen(true)}
            className="btn-secondary"
            style={{
              padding: '10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              border: 'none',
              height: '44px'
            }}
            title="Open GD notes"
          >
            <FileText size={18} />
            <span>Notes</span>
          </button>

          {/* Webcam Toggle */}
          <button
            onClick={() => setIsVideoActive(!isVideoActive)}
            className="btn-secondary"
            style={{
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              width: '44px',
              height: '44px'
            }}
            title={isVideoActive ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoActive ? <Camera size={20} style={{ color: 'var(--accent-green)' }} /> : <CameraOff size={20} style={{ color: 'var(--accent-red)' }} />}
          </button>

          {/* TTS Audio Speaker Mute */}
          <button
            onClick={handleToggleMute}
            className="btn-secondary"
            style={{
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              width: '44px',
              height: '44px'
            }}
            title={isMuted ? "Unmute AI speech synthesis" : "Mute AI speech synthesis"}
          >
            {isMuted ? <VolumeX size={20} style={{ color: 'var(--accent-red)' }} /> : <Volume2 size={20} style={{ color: 'var(--accent-green)' }} />}
          </button>

          {/* Time Countdown clock */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '6px 14px',
            textAlign: 'center',
            minWidth: '90px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIME REMAINING</div>
            <div style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: timeLeft < 30 ? 'var(--accent-red)' : 'var(--text-main)',
              fontFamily: 'monospace'
            }}>{formatTime(timeLeft)}</div>
          </div>
        </div>
      </div>

      <div className="arena-console-grid">
        
        {/* Arena round table simulator visual */}
        <div className="flat-card arena-stage-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          minHeight: '620px',
          position: 'relative'
        }}>
          
          <div className="modern-gd-panel">
            <div className="speaker-spotlight">
              <div>
                <span className="arena-card-label">Active Speaker</span>
                <h3>{activeSpeaker === 'System' ? 'Waiting for the round to start' : activeSpeaker}</h3>
                <p>
                  {activeSpeechText || (discussionState === 'idle'
                    ? 'Press Start to begin the discussion.'
                    : discussionState === 'paused'
                      ? 'Round is paused. Resume when you are ready.'
                      : 'The floor is open for the next contribution.')}
                </p>
              </div>
              <div className={`speaker-orb ${activeSpeaker === 'User' ? 'is-user' : ''} ${discussionState === 'ongoing' && activeSpeaker !== 'System' ? 'is-echoing' : ''}`}>
                {activeSpeaker === 'User' && isVideoActive ? (
                  <Webcam audio={false} mirrored={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  activeSpeaker === 'System' || activeSpeaker === 'Paused' ? 'GD' : activeSpeaker.charAt(0)
                )}
              </div>
            </div>

            <div className="modern-members-grid">
              {[
                { name: 'User', label: 'You', role: 'Participant', color: '#10b981' },
                ...activeAIMembers.map(member => ({
                  name: member.name,
                  label: member.name,
                  role: member.role,
                  color: member.color
                }))
              ].map(member => {
                const isUserMember = member.name === 'User';
                const isActive = activeSpeaker === member.name || (isUserMember && activeSpeaker === 'User');
                return (
                  <div
                    key={member.name}
                    className={`modern-member-card ${isActive ? 'is-active is-echoing' : ''} ${isUserMember ? 'is-user-card' : ''}`}
                    style={{ '--member-color': member.color }}
                  >
                    <div className="modern-member-avatar">
                      {member.name === 'User' && isVideoActive ? (
                        <Webcam audio={false} mirrored={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        member.label.charAt(0)
                      )}
                    </div>
                    <div>
                      <strong>{member.label}</strong>
                      <span>{member.role}</span>
                    </div>
                    {isUserMember ? (
                      <button
                        type="button"
                        className={`member-mic-button ${isMicActive ? 'is-listening' : ''}`}
                        onClick={toggleMic}
                        disabled={discussionState !== 'ongoing'}
                        title={isMicActive ? 'Stop microphone' : 'Start microphone'}
                      >
                        {isMicActive ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                    ) : (
                      <small>{isActive ? 'Speaking' : 'Ready'}</small>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="arena-live-tip-card">
            <div>
              <span>Live Tip</span>
              <p>{liveTip}</p>
            </div>
            <button type="button" onClick={() => setIsNotesOpen(true)}>
              <FileText size={15} />
              Note
            </button>
          </div>

          {/* Real-time speech input panel */}
          <div style={{
            marginTop: '30px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}>
            {/* Visualizer voice waves when speaking */}
            {activeSpeaker === 'User' && (
              <div style={{
                display: 'flex',
                gap: '4px',
                height: '24px',
                alignItems: 'center'
              }}>
                {[1, 2, 3, 4, 5, 6, 7].map(w => (
                  <div key={w} style={{
                    width: '3px',
                    height: '100%',
                    background: 'var(--accent-green)',
                    borderRadius: '2px',
                    animation: `audioWave 0.6s ease-in-out infinite alternate`,
                    animationDelay: `${w * 0.1}s`
                  }} />
                ))}
              </div>
            )}

            {/* Mic and Speech status */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
              <button
                onClick={toggleMic}
                disabled={discussionState !== 'ongoing'}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isMicActive ? 'linear-gradient(135deg, var(--accent-red) 0%, #e11d48 100%)' : 'linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: discussionState === 'ongoing' ? 'pointer' : 'not-allowed',
                  opacity: discussionState === 'ongoing' ? 1 : 0.55,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isMicActive ? '0 0 20px rgba(244,63,94,0.4)' : '0 4px 15px rgba(139,92,246,0.3)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {isMicActive ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {isMicActive ? (
                    <strong style={{ color: 'var(--accent-red)' }}>Microphone Active - Speak Now!</strong>
                  ) : discussionState === 'idle' ? (
                    <span>Press Start GD to begin the timed round.</span>
                  ) : discussionState === 'paused' ? (
                    <span>Round paused. Press Resume GD to continue.</span>
                  ) : (
                    <span>Click Mic to speak, or use the Text Box below to participate.</span>
                  )}
                </div>
                
                {activeAIMembers.some(ai => ai.name === activeSpeaker) && !isMicActive && (
                  <button
                    onClick={() => {
                      checkInterruption();
                      const inputEl = document.getElementById('text-fallback-input');
                      if (inputEl) inputEl.focus();
                    }}
                    style={{
                      marginTop: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--accent-red)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      justifyContent: 'center'
                    }}
                  >
                    <ShieldAlert size={14} />
                    Interrupt Active Speaker
                  </button>
                )}
              </div>
            </div>

            {/* Text Input Fallback (Very important for headless subagent testing & compatibility) */}
            <form onSubmit={handleTextSubmit} style={{
              width: '90%',
              display: 'flex',
              gap: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '6px 12px'
            }}>
              <input
                id="text-fallback-input"
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={discussionState !== 'ongoing'}
                placeholder="Type your arguments here to participate without microphone..."
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem'
                }}
              />
              <button type="submit" style={{
                background: 'none',
                border: 'none',
                color: 'var(--secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>

        <div className="arena-middle-scroll-divider" aria-hidden="true">
          <span />
        </div>

        {/* Live Conversation Transcript Feed */}
        <div className="arena-side-stack">
          <div className="flat-card arena-feed-card">
          <div className="arena-chat-header">
            <div>
              <span>GD Chatbox</span>
              <h2>Live Discussion Feed</h2>
            </div>
            <FileText size={20} />
          </div>
          
          <div className="arena-chat-scroll">
            {transcript.length === 0 && (
              <div className="arena-chat-empty">
                <div className="arena-topic-card">
                  <span>Current Topic</span>
                  <h3>{currentSession.topic}</h3>
                  <p>{currentSession.industryContext || 'General / Academic'} • {currentSession.durationLimit} minute round</p>
                </div>

                <div className="arena-tip-grid">
                  <div>
                    <strong>Open Strong</strong>
                    <p>Start with a clear view: “I would frame this around impact, risk, and opportunity.”</p>
                  </div>
                  <div>
                    <strong>Use Evidence</strong>
                    <p>Add one example, number, or real situation before concluding.</p>
                  </div>
                  <div>
                    <strong>Interact</strong>
                    <p>Refer to another speaker before adding your point.</p>
                  </div>
                </div>

                <div className="arena-prompt-chips">
                  {[
                    'I agree, but the implementation risk is...',
                    'A practical example is...',
                    'To summarize the group so far...'
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTextInput(chip)}
                      disabled={discussionState !== 'ongoing'}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {transcript.map((t, idx) => {
              const isUser = t.speaker === 'User';
              const isSystem = t.speaker === 'System';
              const isHR = t.speaker === 'HR Moderator';
              
              if (isSystem) {
                return (
                  <div key={`${t.id || t.timestamp || idx}-system`} style={{
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)'
                  }}>
                    {t.text}
                  </div>
                );
              }

              if (isHR) {
                return (
                  <div key={`${t.id || t.timestamp || idx}-hr`} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    margin: '15px 0',
                    width: '100%'
                  }}>
                    <div style={{
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      borderRadius: '8px',
                      padding: '12px 18px',
                      maxWidth: '85%',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#a78bfa', fontWeight: 800, marginBottom: '6px', fontSize: '0.8rem' }}>
                        <ShieldAlert size={16} /> HR MODERATOR
                      </div>
                      <div style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 500, fontStyle: 'italic' }}>
                        "{t.text}"
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={t.id || t.timestamp || idx}
                  className={`arena-message-row ${isUser ? 'is-user' : ''}`}
                >
                  <div className="arena-message-avatar" style={{ '--speaker-color': getSpeakerColor(t.speaker) }}>
                    {t.speaker.charAt(0)}
                  </div>
                  <div className="arena-message-stack">
                    <div className="arena-message-meta" style={{ color: getSpeakerColor(t.speaker) }}>
                      <span>{t.speaker}</span>
                      <em>{getMessageTime(t.timestamp)}</em>
                      {t.isInterrupted && <b>Interruption</b>}
                    </div>
                    <div
                      className="arena-message-bubble"
                      style={{
                        '--speaker-color': getSpeakerColor(t.speaker),
                        color: t.isInterrupted ? 'var(--text-muted)' : 'var(--text-main)'
                      }}
                    >
                      {t.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>

          <div className="arena-chat-footer">
            <div>Interruptions count: <strong style={{ color: 'var(--accent-red)' }}>{userInterruptionCount}</strong></div>
            <div>Filler words count: <strong style={{ color: 'var(--accent-yellow)' }}>{fillerWordsCount}</strong></div>
          </div>
        </div>
        </div>

      </div>

    </div>
  );
}
