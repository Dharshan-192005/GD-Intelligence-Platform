import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, RefreshCw, AlertTriangle, ArrowRight, ShieldAlert, Camera, CameraOff } from 'lucide-react';
import Webcam from 'react-webcam';
import { io } from 'socket.io-client';

const AI_MEMBERS = [
  { name: 'Sam', role: 'The Dominator', color: '#f43f5e', initialIntro: 'Let me start off by stating that we cannot ignore the direct threats. We must take immediate control of this topic.', prompt: 'You are aggressive, speak fast, and challenge others immediately. You value assertiveness.' },
  { name: 'Meera', role: 'The Analyst', color: '#06b6d4', initialIntro: 'From a statistical perspective, the research shows a substantial structural shift in how this topic impacts modern frameworks.', prompt: 'You are academic, fact-driven, structured, and use bullet points and data. You stay calm.' },
  { name: 'Leo', role: 'The Harmonizer', color: '#10b981', initialIntro: 'It is wonderful to be discussing this. Let\'s remember to hear everyone out and try to find a collaborative balance.', prompt: 'You are encouraging, supportive, bridge opposing ideas, and summarize points to build consensus.' },
  { name: 'Kabir', role: 'The Skeptic', color: '#f59e0b', initialIntro: 'Before we jump to conclusions, I want to challenge the core assumption we are basing this whole premise on.', prompt: 'You play devil\'s advocate, raise doubts, question assertions, and demand logical backing.' }
];

export default function GDArena({ session, onComplete }) {
  const activeAIMembers = AI_MEMBERS.slice(0, session.numParticipants || 4);
  const [timeLeft, setTimeLeft] = useState(session.durationLimit * 60);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('System');
  const [discussionState, setDiscussionState] = useState('starting'); // starting, ongoing, finished, analyzing
  const [isMuted, setIsMuted] = useState(false); // AI Speech Synthesis toggle
  const [isMicActive, setIsMicActive] = useState(false);
  const [interruptionAlert, setInterruptionAlert] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  // Real-time quantitative calculations
  const [userSpeakingTime, setUserSpeakingTime] = useState(0);
  const [userInterruptionCount, setUserInterruptionCount] = useState(0);
  const [userInterruptedCount, setUserInterruptedCount] = useState(0);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);
  const [aiSpeakingTimes, setAiSpeakingTimes] = useState({ Sam: 0, Meera: 0, Leo: 0, Kabir: 0 });
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [bodyLanguageScore, setBodyLanguageScore] = useState(85);

  // Web Speech references
  const recognitionRef = useRef(null);
  const userSpeakingTimerRef = useRef(null);
  const activeAITimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const conversationEndTriggeredRef = useRef(false);
  const autoSpeechQueueRef = useRef(null);
  const trackingTimerRef = useRef(null);
  const socketRef = useRef(null);

  // Auto scroll transcript panel
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    // Scroll transcript
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearInterval(countdownTimerRef.current);
      clearInterval(userSpeakingTimerRef.current);
      clearInterval(activeAITimerRef.current);
      clearTimeout(autoSpeechQueueRef.current);
      clearInterval(trackingTimerRef.current);
    };
  }, []);

  // Socket.io initialization
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join-room', session._id);

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
  }, [session._id]);

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
          handleUserSpeechSubmitted(text);
        }
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        setIsMicActive(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Discussion Round Orchestrator State Machine
  useEffect(() => {
    if (discussionState === 'starting') {
      // Add initial System welcome transcript
      appendTranscript('System', `The Group Discussion round is starting. Topic: "${session.topic}". Duration: ${session.durationLimit} minutes.`);
      
      // Countdown Timer
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

      // Start the discussion with an AI introducing
      autoSpeechQueueRef.current = setTimeout(() => {
        setDiscussionState('ongoing');
        // Let an active AI initiate the discussion
        const firstSpeaker = activeAIMembers[Math.floor(Math.random() * activeAIMembers.length)];
        triggerAISpeech(firstSpeaker.name, firstSpeaker.initialIntro);
      }, 3000);
    }
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
      autoSpeechQueueRef.current = setTimeout(() => {
        triggerNextAISpeaker();
      }, 4000);
    }
  }, [activeSpeaker, discussionState]);

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
  const appendTranscript = (speaker, text, isInterrupted = false, isRemote = false) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      speaker,
      text,
      timestamp: new Date(),
      isInterrupted
    };
    
    setTranscript(prev => [...prev, newMessage]);

    if (!isRemote && socketRef.current) {
      socketRef.current.emit('send-message', { roomId: session._id, message: newMessage });
    }
  };

  // Synchronize Active Speaker via Socket
  const setAndSyncActiveSpeaker = (speaker) => {
    setActiveSpeaker(speaker);
    if (socketRef.current) {
      socketRef.current.emit('sync-state', { roomId: session._id, state: { activeSpeaker: speaker } });
    }
  };

  // Speaks text via Browser SpeechSynthesis
  const speakOutLoud = (speakerName, text, onEndCallback) => {
    window.speechSynthesis.cancel(); // cancel any active speaking

    if (isMuted) {
      // Standalone simulator: trigger completion instantly
      setTimeout(onEndCallback, 3000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose appropriate voice profiles
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (speakerName === 'Sam') {
        utterance.voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Male')) || voices[0];
        utterance.rate = 1.15; // fast speaker
        utterance.pitch = 0.9;
      } else if (speakerName === 'Meera') {
        utterance.voice = voices.find(v => v.name.includes('Google UK English Female') || v.name.includes('Female')) || voices[0];
        utterance.rate = 1.0; 
        utterance.pitch = 1.05;
      } else if (speakerName === 'Leo') {
        utterance.voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Female')) || voices[0];
        utterance.rate = 0.95; // calm, deliberate
        utterance.pitch = 1.1;
      } else if (speakerName === 'HR Moderator') {
        utterance.voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Male')) || voices[0];
        utterance.rate = 1.0;
        utterance.pitch = 0.8; // Authoritative
      } else { // Kabir
        utterance.voice = voices.find(v => v.name.includes('Male')) || voices[0];
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
      }
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
  const triggerAISpeech = (aiName, rawText) => {
    setAndSyncActiveSpeaker(aiName);
    appendTranscript(aiName, rawText);
    
    speakOutLoud(aiName, rawText, () => {
      // Revert floor to System (idle status) after speech concludes
      setAndSyncActiveSpeaker('System');
    });
  };

  // Selects which AI participant speaks next based on current transcript context
  const triggerNextAISpeaker = async () => {
    if (discussionState !== 'ongoing') return;
    
    // MODERATION CHECK: Evaluate drift every 4 turns
    if (transcript.length > 0 && transcript.length % 4 === 0) {
      try {
        const res = await fetch(`http://localhost:5000/api/sessions/moderate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: session.topic, transcript })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.intervention) {
            // HR Moderator intervenes
            triggerAISpeech('HR Moderator', data.intervention);
            return; // Stop the regular AI from speaking this turn
          }
        }
      } catch (err) {
        console.error('Moderation check failed:', err);
      }
    }

    // Pick next AI speaker. Avoid the one who spoke last.
    const lastSpeeches = transcript.slice(-3);
    const lastAIs = lastSpeeches.map(s => s.speaker).filter(s => s !== 'User' && s !== 'System');
    
    let availableAIs = activeAIMembers.filter(ai => !lastAIs.includes(ai.name));
    if (availableAIs.length === 0) availableAIs = activeAIMembers;
    
    // Select based on persona traits (e.g. Dominator has a higher probability to hijack)
    let nextAI = availableAIs[Math.floor(Math.random() * availableAIs.length)];
    const roll = Math.random();
    if (roll < 0.35 && !lastAIs.includes('Sam') && activeAIMembers.some(a => a.name === 'Sam')) {
      nextAI = activeAIMembers[0]; // Sam (Dominator) chimes in more frequently
    }

    setAndSyncActiveSpeaker(`${nextAI.name} (Formulating...)`);
    
    try {
      const res = await fetch('http://localhost:5000/api/sessions/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: session.topic,
          transcript: transcript.map(t => ({ speaker: t.speaker, text: t.text })),
          speakerName: nextAI.name,
          personaPrompt: nextAI.prompt,
          industryContext: session.industryContext
        })
      });

      if (!res.ok) throw new Error('AI API generation error');
      const data = await res.json();
      
      // Make sure we didn't transition state during loading
      if (discussionState === 'ongoing') {
        triggerAISpeech(nextAI.name, data.text);
      }
    } catch (err) {
      console.warn('Offline response generation fallback for', nextAI.name);
      // fallback local content
      if (discussionState === 'ongoing') {
        const fallbacks = [
          "I think we need to look at the structural facts of this situation rather than emotional arguments.",
          "Absolutely, I completely agree with that perspective. However, let's also account for implementation limits.",
          "That perspective is completely detached from the realistic market numbers we are witnessing today!"
        ];
        const randomPhrase = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        triggerAISpeech(nextAI.name, randomPhrase);
      }
    }
  };

  // Interruption Logic: trigger when user speaks
  const checkInterruption = () => {
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
  const handleUserSpeechSubmitted = (text) => {
    if (discussionState !== 'ongoing') return;
    
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

    // Give user the floor for a short silence detection
    clearTimeout(autoSpeechQueueRef.current);
    autoSpeechQueueRef.current = setTimeout(() => {
      setActiveSpeaker('System'); // Floor returns to system idle, trigger next AI
    }, 3500);
  };

  // Controls user microphone speech recognition
  const toggleMic = () => {
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
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleUserSpeechSubmitted(textInput.trim());
    setTextInput('');
  };

  // Triggered when GD finishes
  const handleEndDiscussion = async () => {
    if (conversationEndTriggeredRef.current) return;
    conversationEndTriggeredRef.current = true;

    window.speechSynthesis.cancel();
    setDiscussionState('analyzing');
    clearInterval(countdownTimerRef.current);
    clearInterval(userSpeakingTimerRef.current);
    clearInterval(activeAITimerRef.current);
    clearTimeout(autoSpeechQueueRef.current);

    // Calculate final metrics
    const totalDiscussionTime = session.durationLimit * 60 - timeLeft || 1;
    const totalSpeaks = userSpeakingTime + Object.values(aiSpeakingTimes).reduce((a, b) => a + b, 0);
    const userPct = totalSpeaks > 0 ? Math.round((userSpeakingTime / totalSpeaks) * 100) : 0;
    
    // Estimate WPM based on transcript word count / speaking time
    const userWords = transcript
      .filter(t => t.speaker === 'User')
      .map(t => t.text.split(' ').length)
      .reduce((a, b) => a + b, 0);
    const pacingWpm = userSpeakingTime > 0 ? Math.round((userWords / userSpeakingTime) * 60) : 0;

    const userMetrics = {
      speakingTime: userSpeakingTime,
      speakPercentage: userPct,
      interruptionCount: userInterruptionCount,
      interruptedCount: userInterruptedCount,
      pacingWpm: pacingWpm || 120, // ideal default in case they typed
      fillerWordCount: fillerWordsCount,
      bodyLanguageScore: isVideoActive ? bodyLanguageScore : 0
    };

    // Calculate dynamic breakdowns
    const activeNames = activeAIMembers.map(a => a.name);
    let aiTotal = 0;
    activeNames.forEach(n => aiTotal += (aiSpeakingTimes[n] || 0));
    const totalTimes = userSpeakingTime + aiTotal || 1;
    
    const participationBreakdown = [
      { name: 'User', speakingTime: userSpeakingTime, percentage: Math.round((userSpeakingTime / totalTimes) * 100) }
    ];
    activeNames.forEach(n => {
      participationBreakdown.push({
        name: n,
        speakingTime: aiSpeakingTimes[n] || 0,
        percentage: Math.round(((aiSpeakingTimes[n] || 0) / totalTimes) * 100)
      });
    });

    try {
      // Save session details and generate coaching diagnostics on the backend
      const res = await fetch(`http://localhost:5000/api/sessions/${session._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.map(t => ({ speaker: t.speaker, text: t.text, isInterrupted: t.isInterrupted })),
          userMetrics,
          participationBreakdown
        })
      });

      if (!res.ok) throw new Error('Analysis processing failed');
      const completedSession = await res.json();
      onComplete(completedSession);
    } catch (err) {
      console.warn('Backend completion failed, rendering custom sandbox metrics...', err.message);
      
      // Fallback sandbox: mock local analytics generation in 3s
      setTimeout(() => {
        // Mock a finished session structured data
        const mockScore = Math.max(50, Math.min(95, 75 - (fillerWordsCount * 2) + (userSpeakingTime > 30 ? 10 : -10)));
        onComplete({
          _id: session._id,
          topic: session.topic,
          durationLimit: session.durationLimit,
          createdAt: new Date(),
          transcript: transcript,
          userMetrics,
          participationBreakdown,
          aiEvaluation: {
            leadershipScore: Math.round(mockScore * 0.9),
            confidenceScore: Math.round(mockScore * 0.95),
            effectivenessScore: Math.round(mockScore),
            analysisSummary: "This is a detailed local sandbox assessment. You demonstrated strong engagement and presented clear logical statements during the discussion. Practicing structuring your arguments in a standard executive flow and keeping your speech pacing measured will help elevate your effectiveness.",
            strengths: ["Highly logical argument structure.", "Active engagement in challenging opposing views."],
            weaknesses: ["Occasional stuttering and high pacing during critical transitions.", "Missed summarizing mutual agreements."],
            actionableTips: ["Aim to speak at a slower, measured speed of 120 WPM.", "Leverage transitions to bridge ideas."],
            topicRelevance: "Your arguments stayed directly relevant to the core issues.",
            argumentDepth: "Moderate depth. Aim to introduce structured statistics or real-world precedents.",
            suggestedPhrases: [
              {
                original: "I think this is a serious threat for workers.",
                improved: "Frictional unemployment represents a structural market shock that requires institutionalized retraining frameworks.",
                reason: "Replaces general anxiety language with technical market terms."
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
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

      {/* Header Info Panel */}
      <div className="flat-card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        marginBottom: '25px',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1 }}>
          <span className="badge badge-primary" style={{ marginBottom: '4px', display: 'inline-block' }}>
            Live Discussion
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{session.topic}</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          
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
            onClick={() => setIsMuted(!isMuted)}
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
            padding: '8px 16px',
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

          <button onClick={handleEndDiscussion} className="btn-danger">
            End & Evaluate
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Arena round table simulator visual */}
        <div className="flat-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '440px',
          position: 'relative'
        }}>
          
          <h3 style={{
            position: 'absolute',
            top: '20px',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1.5px'
          }}>
            GD Round Table Sandbox
          </h3>

          {/* Circular Round Table Arrangement */}
          <div style={{
            position: 'relative',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13,16,27,0.8) 0%, rgba(6,7,10,0.5) 100%)',
            border: '8px solid rgba(255,255,255,0.03)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 0 0 30px rgba(139,92,246,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '40px 0'
          }}>
            
            {/* Table center topic card */}
            <div style={{
              textAlign: 'center',
              padding: '20px',
              maxWidth: '180px',
              zIndex: 5
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontWeight: 800,
                letterSpacing: '1px',
                marginBottom: '4px'
              }}>ACTIVE SPEAKER</div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: activeSpeaker.includes('User') ? 'var(--accent-green)' : activeSpeaker === 'System' ? 'var(--text-muted)' : 'var(--primary)',
                background: 'rgba(255,255,255,0.03)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'inline-block',
                textTransform: 'uppercase'
              }}>{activeSpeaker.split(' ')[0]}</div>
            </div>

            {/* AVATAR: USER (At the bottom) */}
            <div style={{
              position: 'absolute',
              bottom: '-45px',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isVideoActive ? 'transparent' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.4rem',
                border: '3px solid #06070a',
                boxShadow: activeSpeaker === 'User' ? '0 0 20px var(--accent-green)' : 'none',
                animation: activeSpeaker === 'User' ? 'pulseSpeaking 1.5s infinite' : 'none',
                transition: 'var(--transition-smooth)',
                overflow: 'hidden'
              }}>
                {isVideoActive ? (
                  <Webcam
                    audio={false}
                    mirrored={true}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  "U"
                )}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent-green)' }}>You</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{userSpeakingTime}s spoke</div>
            </div>

            {/* AVATARS: AI MEMBERS arrangement (around the table) */}
            
            {/* Sam (Top Left) */}
            {activeAIMembers.some(a => a.name === 'Sam') && (
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '-25px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#f43f5e',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.3rem',
                border: '3px solid #06070a',
                boxShadow: activeSpeaker === 'Sam' ? '0 0 20px #f43f5e' : 'none',
                animation: activeSpeaker === 'Sam' ? 'pulseSpeaking 1.5s infinite' : 'none',
                transition: 'var(--transition-smooth)'
              }}>
                S
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: '#f43f5e' }}>Sam</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{aiSpeakingTimes.Sam}s spoke</div>
            </div>
            )}

            {/* Meera (Top Right) */}
            {activeAIMembers.some(a => a.name === 'Meera') && (
            <div style={{
              position: 'absolute',
              top: '-15px',
              right: '-25px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#06b6d4',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.3rem',
                border: '3px solid #06070a',
                boxShadow: activeSpeaker === 'Meera' ? '0 0 20px #06b6d4' : 'none',
                animation: activeSpeaker === 'Meera' ? 'pulseSpeaking 1.5s infinite' : 'none',
                transition: 'var(--transition-smooth)'
              }}>
                M
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: '#06b6d4' }}>Meera</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{aiSpeakingTimes.Meera}s spoke</div>
            </div>
            )}

            {/* Leo (Middle Left) */}
            {activeAIMembers.some(a => a.name === 'Leo') && (
            <div style={{
              position: 'absolute',
              top: '110px',
              left: '-45px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.3rem',
                border: '3px solid #06070a',
                boxShadow: activeSpeaker === 'Leo' ? '0 0 20px #10b981' : 'none',
                animation: activeSpeaker === 'Leo' ? 'pulseSpeaking 1.5s infinite' : 'none',
                transition: 'var(--transition-smooth)'
              }}>
                L
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>Leo</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{aiSpeakingTimes.Leo}s spoke</div>
            </div>
            )}

            {/* Kabir (Middle Right) */}
            {activeAIMembers.some(a => a.name === 'Kabir') && (
            <div style={{
              position: 'absolute',
              top: '110px',
              right: '-45px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#f59e0b',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.3rem',
                border: '3px solid #06070a',
                boxShadow: activeSpeaker === 'Kabir' ? '0 0 20px #f59e0b' : 'none',
                animation: activeSpeaker === 'Kabir' ? 'pulseSpeaking 1.5s infinite' : 'none',
                transition: 'var(--transition-smooth)'
              }}>
                K
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: '#f59e0b' }}>Kabir</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{aiSpeakingTimes.Kabir}s spoke</div>
            </div>
            )}

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
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isMicActive ? 'linear-gradient(135deg, var(--accent-red) 0%, #e11d48 100%)' : 'linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
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

        {/* Live Conversation Transcript Feed */}
        <div className="flat-card" style={{
          height: '610px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '15px' }}>Live Discussion Feed</h2>
          
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '6px',
            marginBottom: '15px'
          }}>
            {transcript.map((t, idx) => {
              const isUser = t.speaker === 'User';
              const isSystem = t.speaker === 'System';
              const isHR = t.speaker === 'HR Moderator';
              const ai = activeAIMembers.find(member => member.name === t.speaker);
              
              if (isSystem) {
                return (
                  <div key={idx} style={{
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
                  <div key={idx} style={{
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
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    alignSelf: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: isUser ? 'var(--accent-green)' : ai?.color || 'var(--primary)',
                    fontWeight: 700,
                    marginBottom: '3px'
                  }}>
                    <span>{t.speaker}</span>
                    {t.isInterrupted && (
                      <span style={{
                        background: 'rgba(244,63,94,0.15)',
                        color: '#fb7185',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 600
                      }}>Interruption</span>
                    )}
                  </div>
                  <div style={{
                    background: isUser ? 'rgba(16, 185, 129, 0.12)' : `${ai?.color || 'rgba(139,92,246,0.1)'}15`,
                    border: `1px solid ${isUser ? 'rgba(16, 185, 129, 0.2)' : `${ai?.color || 'rgba(139,92,246,0.2)'}33`}`,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    color: t.isInterrupted ? 'var(--text-muted)' : 'var(--text-main)'
                  }}>
                    {t.text}
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>

          <div style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <div>Interruptions count: <strong style={{ color: 'var(--accent-red)' }}>{userInterruptionCount}</strong></div>
            <div>Filler words count: <strong style={{ color: 'var(--accent-yellow)' }}>{fillerWordsCount}</strong></div>
          </div>
        </div>

      </div>

    </div>
  );
}
