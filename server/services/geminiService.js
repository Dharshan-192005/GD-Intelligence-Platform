const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API Key is available
const apiKey = process.env.GEMINI_API_KEY || '';
const hasApiKey = apiKey.trim().length > 0;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_RPM_LIMIT = Math.max(1, Number.parseInt(process.env.GEMINI_RPM_LIMIT || '10', 10));
const GEMINI_MIN_INTERVAL_MS = Math.ceil(60000 / GEMINI_RPM_LIMIT);
const GEMINI_TIMEOUT_MS = Math.max(5000, Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10));
const GEMINI_MAX_QUEUE_WAIT_MS = Math.max(1000, Number.parseInt(process.env.GEMINI_MAX_QUEUE_WAIT_MS || '12000', 10));
const GEMINI_FINAL_MAX_QUEUE_WAIT_MS = Math.max(GEMINI_MAX_QUEUE_WAIT_MS, Number.parseInt(process.env.GEMINI_FINAL_MAX_QUEUE_WAIT_MS || '30000', 10));

let geminiQueue = Promise.resolve();
let lastGeminiRequestAt = 0;
let geminiCooldownUntil = 0;
let recentGeminiCalls = [];
let pendingGeminiRequests = 0;

let genAI = null;
if (hasApiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Google Gemini API service initialized with real LLM.');
  } catch (err) {
    console.error('⚠️ Failed to initialize Google Gemini API SDK:', err.message);
  }
} else {
  console.warn('⚠️ No GEMINI_API_KEY detected. AI participants will use static fallback responses.');
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const pruneRecentCalls = () => {
  const cutoff = Date.now() - 60000;
  recentGeminiCalls = recentGeminiCalls.filter(ts => ts > cutoff);
};

const getRateLimitStatus = () => {
  pruneRecentCalls();
  const now = Date.now();
  const nextAllowedAt = Math.max(lastGeminiRequestAt + GEMINI_MIN_INTERVAL_MS, geminiCooldownUntil);
  return {
    enabled: hasApiKey && Boolean(genAI),
    model: GEMINI_MODEL,
    rpmLimit: GEMINI_RPM_LIMIT,
    callsInLastMinute: recentGeminiCalls.length,
    queued: pendingGeminiRequests,
    nextAllowedInMs: Math.max(0, nextAllowedAt - now)
  };
};

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const runGeminiRequest = async (label, task, options = {}) => {
  if (!hasApiKey || !genAI) return null;

  pendingGeminiRequests += 1;
  const enqueuedAt = Date.now();
  const maxQueueWaitMs = options.maxQueueWaitMs || (
    label === 'final-analysis' ? GEMINI_FINAL_MAX_QUEUE_WAIT_MS : GEMINI_MAX_QUEUE_WAIT_MS
  );

  const queuedTask = geminiQueue.then(async () => {
    const queuedForMs = Date.now() - enqueuedAt;
    if (queuedForMs > maxQueueWaitMs) {
      throw new Error(`Gemini queue busy for ${queuedForMs}ms; falling back locally.`);
    }

    const now = Date.now();
    const nextAllowedAt = Math.max(lastGeminiRequestAt + GEMINI_MIN_INTERVAL_MS, geminiCooldownUntil);
    if (nextAllowedAt > now) {
      const waitMs = nextAllowedAt - now;
      if (queuedForMs + waitMs > maxQueueWaitMs) {
        throw new Error(`Gemini queue wait would exceed ${maxQueueWaitMs}ms; falling back locally.`);
      }
      await wait(waitMs);
    }

    lastGeminiRequestAt = Date.now();
    recentGeminiCalls.push(lastGeminiRequestAt);
    pruneRecentCalls();

    try {
      console.log(`[Gemini Queue] ${label} (${recentGeminiCalls.length}/${GEMINI_RPM_LIMIT} RPM window)`);
      return await withTimeout(task(), GEMINI_TIMEOUT_MS);
    } catch (err) {
      if (err.message && /429|quota|rate|resource exhausted/i.test(err.message)) {
        geminiCooldownUntil = Date.now() + GEMINI_MIN_INTERVAL_MS * 2;
        console.warn(`[Gemini Queue] Rate limit pressure detected. Cooling down for ${GEMINI_MIN_INTERVAL_MS * 2}ms.`);
      }
      throw err;
    }
  }).finally(() => {
    pendingGeminiRequests = Math.max(0, pendingGeminiRequests - 1);
  });

  geminiQueue = queuedTask.catch(() => null);
  return queuedTask;
};

const buildModel = (generationConfig = {}) => genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig
});

const stripJsonFences = (text) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return cleaned.trim();
};

const getUserContributionQuality = (transcript) => {
  const userText = transcript
    .filter(t => t.speaker === 'User')
    .map(t => t.text || '')
    .join(' ')
    .toLowerCase()
    .replace(/\[interrupted\]/g, ' ')
    .trim();
  const words = userText.match(/[a-z0-9']+/g) || [];
  const uniqueWords = new Set(words);
  const fillerOnlyWords = new Set(['ok', 'okay', 'yes', 'yeah', 'no', 'hmm', 'fine', 'right', 'true']);
  const meaningfulWords = words.filter(word => !fillerOnlyWords.has(word));
  const repeatedLowEffort = words.length > 0 && meaningfulWords.length <= 2 && uniqueWords.size <= 3;

  return {
    userText,
    wordCount: words.length,
    uniqueWordCount: uniqueWords.size,
    meaningfulWordCount: meaningfulWords.length,
    repeatedLowEffort,
    isVeryWeak: words.length < 12 || repeatedLowEffort || meaningfulWords.length < 6
  };
};

const applyQualityCaps = (evaluation, transcript, userMetrics) => {
  const quality = getUserContributionQuality(transcript);
  const speakTime = userMetrics.speakingTime || 0;
  const capped = { ...evaluation };

  if (speakTime === 0 || quality.wordCount === 0) {
    capped.leadershipScore = 0;
    capped.confidenceScore = 0;
    capped.effectivenessScore = 0;
  } else if (quality.repeatedLowEffort) {
    capped.leadershipScore = Math.min(capped.leadershipScore || 0, 12);
    capped.confidenceScore = Math.min(capped.confidenceScore || 0, 18);
    capped.effectivenessScore = Math.min(capped.effectivenessScore || 0, 10);
  } else if (quality.isVeryWeak || speakTime < 10) {
    capped.leadershipScore = Math.min(capped.leadershipScore || 0, 30);
    capped.confidenceScore = Math.min(capped.confidenceScore || 0, 35);
    capped.effectivenessScore = Math.min(capped.effectivenessScore || 0, 32);
  }

  if (quality.isVeryWeak) {
    capped.analysisSummary = `Your contribution was too brief and low-detail to demonstrate strong GD performance. ${capped.analysisSummary || ''}`.trim();
    capped.weaknesses = [
      'Responses were too short or repetitive to show argument quality.',
      ...(Array.isArray(capped.weaknesses) ? capped.weaknesses.slice(0, 2) : [])
    ];
    capped.actionableTips = [
      'Use a complete point with reasoning: claim, because, example, and impact.',
      ...(Array.isArray(capped.actionableTips) ? capped.actionableTips.slice(0, 2) : [])
    ];
    capped.topicRelevance = quality.repeatedLowEffort
      ? 'The user did not add a meaningful topic-related argument.'
      : capped.topicRelevance;
    capped.argumentDepth = quality.repeatedLowEffort
      ? 'No meaningful argument depth was demonstrated; the contribution was mostly acknowledgement.'
      : capped.argumentDepth;
  }

  return capped;
};

/**
 * Generate AI participant argument using real Gemini LLM
 */
const generateParticipantResponse = async (topic, transcript, speakerName, personaPrompt, industryContext = 'General/Academic') => {
  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.95, topP: 0.94, maxOutputTokens: 150 });
      
      const transcriptFormatted = transcript.slice(-8).map(t => `${t.speaker}: ${t.text}`).join('\n');
      const usedIdeas = transcript
        .slice(-10)
        .map(t => `- ${t.text}`)
        .join('\n');
      
      const prompt = `You are participating in a live Group Discussion (GD) round. Your name is ${speakerName}.

INDUSTRY CONTEXT: ${industryContext}
(Adjust your vocabulary, tone, and arguments to perfectly fit this industry context. E.g., if Corporate Strategy, use business terms. If MBA Admissions, be analytical.)

YOUR PERSONA:
${personaPrompt}

DISCUSSION TOPIC: "${topic}"

RECENT CONVERSATION:
${transcriptFormatted || "(The discussion just started. Make an opening statement.)"}

IDEAS ALREADY USED:
${usedIdeas || "- None yet"}

RULES:
- Output ONLY your spoken dialogue. No labels, no "Name:", no quotes around it.
- Keep it 1-3 sentences (30-60 words). This is a fast-paced discussion.
- React to the most recent speaker. If "User" just spoke, respond directly to their point.
- Sound natural and human. No meta-commentary about your role.
- Ask a pointed follow-up only when it makes the discussion feel more realistic.
- Stay on topic: "${topic}". Make substantive points with real reasoning.
- Mention a topic-specific detail or consequence from "${topic}" so the reply cannot fit every topic.
- CRITICAL: DO NOT repeat previous arguments, wording, or generic claims from IDEAS ALREADY USED.
- Your new angle must be different from the last 3 messages. Use one of these moves: example, counterpoint, risk, stakeholder impact, data-like reasoning, implementation challenge, or short summary plus next question.
- Keep your persona visible through tone and word choice.

Your response:`;

      const result = await runGeminiRequest(`participant:${speakerName}`, () => model.generateContent(prompt));
      const response = await result.response;
      let text = response.text().trim();
      
      // Clean up any unwanted prefixes the LLM might add
      const prefixes = [`${speakerName}:`, `${speakerName} :`, `"`, `'`];
      for (const prefix of prefixes) {
        if (text.startsWith(prefix)) {
          text = text.substring(prefix.length).trim();
        }
      }
      // Remove trailing quote if present
      if ((text.endsWith('"') || text.endsWith("'")) && !text.startsWith('"') && !text.startsWith("'")) {
        text = text.substring(0, text.length - 1).trim();
      }
      
      console.log(`[Gemini LLM] ${speakerName}: ${text.substring(0, 80)}...`);
      return text;
    } catch (err) {
      console.error(`[Gemini ERROR] ${speakerName} generation failed:`, err.message);
      // Fall through to fallback
    }
  }

  // FALLBACK — only used when API key is missing or API call fails
  console.warn(`[Fallback] Using static response for ${speakerName}`);
  const lastSpeaker = transcript[transcript.length - 1]?.speaker || 'the group';
  const topicCore = String(topic || 'this issue').replace(/[?.!]+$/, '');
  const pools = {
    aggressive: [
      `I think the group is being too soft on ${topicCore}. Give me one real-world constraint that proves this idea can survive outside theory.`,
      `That sounds acceptable on paper, but ${topicCore} needs sharper accountability. Who owns the failure if this goes wrong?`
    ],
    logical: [
      `For ${topicCore}, I would separate impact into cost, adoption, and long-term risk. Without that structure, we are only trading opinions.`,
      `Let us test ${topicCore} with a measurable lens: who benefits, who pays, and what changes after six months?`
    ],
    emotional: [
      `We should not reduce ${topicCore} to only numbers. The human impact matters, especially for people who have less control over the outcome.`,
      `I understand ${lastSpeaker}'s point, but the lived experience around ${topicCore} can be very different from the policy-level view.`
    ],
    leader: [
      `Let me organize this around ${topicCore}: first impact, second feasibility, third fairness. That will help us reach a balanced conclusion.`,
      `We are touching many angles, so I suggest we use ${topicCore} to compare short-term gains against long-term consequences.`
    ],
    skeptic: [
      `I want to challenge the assumption behind ${topicCore}. What if the expected benefit happens only for a small group and not everyone?`,
      `Before accepting that argument on ${topicCore}, we should ask what hidden cost or unintended consequence we are ignoring.`
    ],
    balanced: [
      `Building on ${lastSpeaker}'s point, ${topicCore} needs both practical execution and fairness. A balanced solution should account for both.`,
      `The stronger view on ${topicCore} may be in the middle: support the opportunity, but define safeguards before scaling it.`
    ]
  };
  const promptLower = `${speakerName} ${personaPrompt}`.toLowerCase();
  const type = promptLower.includes('aggressive') || promptLower.includes('interrupt')
    ? 'aggressive'
    : promptLower.includes('logical') || promptLower.includes('data') || promptLower.includes('technical')
      ? 'logical'
      : promptLower.includes('emotional') || promptLower.includes('empathy')
        ? 'emotional'
        : promptLower.includes('leader') || promptLower.includes('dominant')
          ? 'leader'
          : promptLower.includes('skeptic') || promptLower.includes('challenge')
            ? 'skeptic'
            : 'balanced';
  const pool = pools[type];
  return pool[transcript.length % pool.length];
};

/**
 * Perform detailed AI analysis on GD Session using real Gemini LLM
 */
const analyzeGDSession = async (topic, transcript, userMetrics) => {
  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.25, topP: 0.8, maxOutputTokens: 900 });
      
      const transcriptFormatted = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const prompt = `You are an expert Executive Communications Coach evaluating a Group Discussion.

TOPIC: "${topic}"

USER METRICS:
- Speaking Time: ${userMetrics.speakingTime}s (${userMetrics.speakPercentage}% of discussion)
- Interruptions by User: ${userMetrics.interruptionCount}
- Interrupted by others: ${userMetrics.interruptedCount}
- Pacing: ${userMetrics.pacingWpm} WPM
- Filler Words ('uh','um','like'): ${userMetrics.fillerWordCount}
- Body Language & Visual Presence: ${userMetrics.bodyLanguageScore}/100 (Based on webcam tracking of eye-contact and posture)

FULL TRANSCRIPT:
${transcriptFormatted}

Analyze the "User" participant ONLY. Score them HONESTLY based on what they actually said and did. Do NOT inflate scores. If they barely participated, scores should be low. If their arguments were generic, say so.

Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):
{
  "leadershipScore": <1-100, based on initiative, facilitation, consensus-building>,
  "confidenceScore": <1-100, based on pacing, assertiveness, lack of fillers, and body language score>,
  "effectivenessScore": <1-100, based on argument quality, clarity, persuasion>,
  "analysisSummary": "<3-4 sentence professional assessment of user's GD performance, MUST mention their body language if score is notable>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>"],
  "actionableTips": ["<concrete training tip 1>", "<concrete training tip 2>", "<concrete training tip 3>"],
  "topicRelevance": "<evaluation of how well user stayed on topic and contributed quality ideas>",
  "argumentDepth": "<evaluation of argument structure: did they use evidence, examples, structured logic?>",
  "suggestedPhrases": [
    {
      "original": "<an actual weak phrase the user said in the transcript>",
      "improved": "<a more professional, executive-level way to say it>",
      "reason": "<why the improved version is stronger>"
    }
  ]
}

CRITICAL SCORING RULES:
- If user spoke 0 seconds, ALL scores (leadership, confidence, effectiveness) MUST be 0.
- If user spoke < 10 seconds total (but > 0), leadership ≤ 30, confidence ≤ 30, and effectiveness ≤ 40
- If user had > 5 filler words, confidence should drop by 10-15 points  
- If Body Language score is < 50, confidence should drop significantly
- If user made > 3 interruptions, leadership should drop by 10 points
- If user's arguments were surface-level or generic, effectiveness ≤ 60
- Scores of 90+ should be RARE and only for truly outstanding performance
- Base your evaluation on ACTUAL transcript content, not assumptions`;

      const result = await runGeminiRequest('final-analysis', () => model.generateContent(prompt));
      const response = await result.response;
      const responseText = stripJsonFences(response.text());
      
      const parsed = applyQualityCaps(JSON.parse(responseText), transcript, userMetrics);
      console.log('[Gemini LLM] Analysis complete — Leadership:', parsed.leadershipScore, 'Confidence:', parsed.confidenceScore, 'Effectiveness:', parsed.effectivenessScore);
      return parsed;
    } catch (err) {
      console.error('[Gemini ERROR] Analysis failed:', err.message);
      // Fall through to fallback
    }
  }

  // FALLBACK ANALYTICS — only when API is unavailable
  console.warn('[Fallback] Using computed fallback analytics (no LLM)');
  const speakPct = userMetrics.speakPercentage || 0;
  const fillers = userMetrics.fillerWordCount || 0;
  const interruptions = userMetrics.interruptionCount || 0;
  const wpm = userMetrics.pacingWpm || 0;
  const speakTime = userMetrics.speakingTime || 0;
  const quality = getUserContributionQuality(transcript);

  let confidence = 55;
  if (wpm > 150 || wpm < 90) confidence -= 10;
  if (fillers > 5) confidence -= Math.min(fillers * 3, 25);
  confidence = Math.max(15, Math.min(80, confidence));

  let leadership = 35;
  if (speakPct >= 20 && speakPct <= 35) leadership += 20;
  else if (speakPct > 35) leadership += 5;
  else if (speakPct < 10) leadership -= 20;
  if (interruptions > 3) leadership -= 15;
  if (speakTime < 10) leadership = Math.min(leadership, 30);
  leadership = Math.max(10, Math.min(80, leadership));

  let effectiveness = Math.round((confidence + leadership) / 2);
  if (speakTime < 10) effectiveness = Math.min(effectiveness, 35);
  effectiveness = Math.max(10, Math.min(80, effectiveness));

  // Override if user barely spoke or didn't speak at all
  if (speakTime === 0 || quality.wordCount === 0) {
    confidence = 0;
    leadership = 0;
    effectiveness = 0;
  } else if (speakTime < 10) {
    confidence = Math.min(confidence, 30);
  }
  if (quality.repeatedLowEffort) {
    leadership = Math.min(leadership, 12);
    confidence = Math.min(confidence, 18);
    effectiveness = Math.min(effectiveness, 10);
  } else if (quality.isVeryWeak) {
    leadership = Math.min(leadership, 30);
    confidence = Math.min(confidence, 35);
    effectiveness = Math.min(effectiveness, 32);
  }

  const userPhrases = transcript.filter(t => t.speaker === 'User').map(t => t.text);
  const sample = userPhrases.length > 0 ? userPhrases[0] : "I think this topic is important.";

  return {
    leadershipScore: leadership,
    confidenceScore: confidence,
    effectivenessScore: effectiveness,
    analysisSummary: `[Offline Analysis] You participated for ${speakTime} seconds (${speakPct}% of the discussion). Your pacing was ${wpm} WPM. ${quality.isVeryWeak ? 'Your contribution was too brief or repetitive to show meaningful reasoning, so the score is capped low.' : 'You showed willingness to engage, though there is room for more structured argumentation.'} Connect the backend with Gemini for deeper coaching.`,
    strengths: [
      quality.isVeryWeak ? "Attempted to participate in the discussion." : "Engaged with the discussion topic directly.",
      speakTime > 20 ? "Maintained participation for multiple seconds." : "Kept the contribution brief."
    ],
    weaknesses: [
      quality.isVeryWeak ? "Contribution lacked a clear claim, reasoning, or example." : "Limited engagement with other participants' specific points.",
      speakTime < 15 ? "Insufficient speaking time to demonstrate leadership." : "Arguments could benefit from more structured evidence."
    ],
    actionableTips: [
      "Use the PEEL structure: Point, Explanation, Example, Link back to topic.",
      "Practice replacing filler words with deliberate 1-second pauses.",
      "Actively reference other speakers' points to show engaged listening."
    ],
    topicRelevance: quality.repeatedLowEffort ? "No meaningful topic relevance was demonstrated." : "[Offline] Limited relevance analysis without LLM.",
    argumentDepth: quality.isVeryWeak ? "Very low argument depth; use a claim, reason, example, and conclusion." : "[Offline] Limited argument-depth analysis without LLM.",
    suggestedPhrases: [
      {
        original: sample.length > 60 ? sample.substring(0, 60) + "..." : sample,
        improved: "The structural implications of this issue demand a multi-stakeholder framework that balances innovation with equitable access.",
        reason: "Elevates casual language to structured, professional discourse."
      }
    ]
  };
};

/**
 * Generate GD topics based on resume
 */
const generateResumeTopics = async (resumeText) => {
  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.45, maxOutputTokens: 180 });
      
      const prompt = `You are an expert career coach and corporate recruiter. 
Read the following resume text and generate 3 custom Group Discussion (GD) topics that would be perfectly suited to test this candidate's domain knowledge, strategic thinking, and industry awareness based on their background.

RESUME TEXT:
${resumeText.substring(0, 3000)}

Return ONLY a JSON array of 3 strings (the 3 topics). No markdown fences, no other text.
Example: ["Topic 1", "Topic 2", "Topic 3"]`;

      const result = await runGeminiRequest('resume-topics', () => model.generateContent(prompt));
      const response = await result.response;
      const text = stripJsonFences(response.text());
      
      const topics = JSON.parse(text);
      return Array.isArray(topics) ? topics.slice(0, 3) : [topics.toString()];
    } catch (err) {
      console.error('[Gemini ERROR] Resume topics generation failed:', err.message);
    }
  }

  // Fallback
  return [
    "The Future of Work: Adapting to AI in Your Target Industry",
    "Balancing Short-term Profits vs. Long-term Sustainable Growth",
    "How Remote Work Impacts Team Dynamics and Innovation"
  ];
};

const generateTrendingTopics = async (industryContext = 'General / Academic', avoidTopics = []) => {
  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.8, maxOutputTokens: 360 });
      const avoidText = Array.isArray(avoidTopics) && avoidTopics.length
        ? `\nAVOID REPEATING THESE TOPICS:\n${avoidTopics.slice(0, 12).map(topic => `- ${topic}`).join('\n')}\n`
        : '';
      const prompt = `Generate 6 fresh, high-interest Group Discussion topics for students and job candidates.

CONTEXT: ${industryContext}
CURRENT DATE: ${new Date().toISOString().slice(0, 10)}
${avoidText}

Prefer topics connected to current public discussion areas such as AI, hiring, remote work, education, climate, startups, social media, ethics, technology policy, leadership, and workplace culture.

Rules:
- Make topics debate-friendly, specific, and suitable for a 2-10 minute GD.
- Do not repeat or lightly reword the avoided topics.
- Make each refresh feel new by changing subject areas.
- Do not include explanations.
- Return ONLY a JSON array of 6 strings.`;

      const result = await runGeminiRequest('trending-topics', () => model.generateContent(prompt), {
        maxQueueWaitMs: 20000
      });
      const response = await result.response;
      const topics = JSON.parse(stripJsonFences(response.text()));
      if (Array.isArray(topics) && topics.length > 0) return topics.slice(0, 6);
    } catch (err) {
      console.error('[Gemini ERROR] Trending topics generation failed:', err.message);
    }
  }

  return [
    'Should AI copilots be allowed in campus placements and interviews?',
    'Is skill-based hiring finally replacing degree-based hiring?',
    'Will remote work remain a privilege or become a normal workplace model?',
    'Should social media platforms verify AI-generated content?',
    'Can climate goals and economic growth be balanced in developing countries?',
    'Are startups putting too much pressure on young employees?',
    'Should colleges grade students on teamwork and communication?',
    'Can India build ethical AI without slowing innovation?',
    'Are creator careers becoming more realistic than corporate jobs?',
    'Should companies disclose when customer support is handled by AI?',
    'Is hustle culture damaging young professionals?',
    'Should government jobs adapt faster to digital skills?'
  ].filter(topic => !avoidTopics.includes(topic)).slice(0, 6);
};

/**
 * Moderate discussion to check for off-topic drift
 */
const moderateDiscussion = async (topic, transcript) => {
  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.15, maxOutputTokens: 80 });
      
      const transcriptFormatted = transcript.slice(-6).map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const prompt = `You are an HR Moderator observing a Group Discussion.
TOPIC: "${topic}"

RECENT CONVERSATION:
${transcriptFormatted || "(No conversation yet)"}

TASK:
Determine if the recent conversation is drifting completely off-topic from "${topic}". 
- If it is strictly ON TOPIC, return exactly "OK".
- If it is OFF TOPIC, act as an HR Moderator and provide a 1-sentence polite but firm verbal intervention to steer the group back. Example: "Let's bring our focus back to the core topic..."

Return ONLY the text "OK" or the intervention sentence. No other text.`;

      const result = await runGeminiRequest('moderation', () => model.generateContent(prompt));
      const response = await result.response;
      let text = response.text().trim();
      
      // Clean quotes
      if (text.startsWith('"') && text.endsWith('"')) text = text.substring(1, text.length - 1);
      
      if (text.toUpperCase() === "OK") {
        return null;
      }
      
      console.log(`[Gemini LLM - HR Moderator Intervention] ${text}`);
      return text;
    } catch (err) {
      console.error('[Gemini ERROR] Moderation failed:', err.message);
    }
  }
  return null; // fallback: don't intervene if no AI or error
};

const analyzeLiveTurn = async (topic, transcript, userMetrics = {}) => {
  const userTurns = transcript.filter(t => t.speaker === 'User');
  const latestUserTurn = userTurns[userTurns.length - 1]?.text || '';
  const fallback = {
    summary: latestUserTurn
      ? 'Live metrics updated. Add one clearer example or data point in your next turn.'
      : 'Waiting for your first contribution.',
    relevanceScore: latestUserTurn ? 70 : 0,
    clarityScore: latestUserTurn && latestUserTurn.split(/\s+/).length > 12 ? 72 : 55,
    nextMove: 'Respond directly to the last speaker, then link your point back to the topic.',
    rateLimit: getRateLimitStatus()
  };

  if (hasApiKey && genAI && latestUserTurn) {
    try {
      const model = buildModel({ temperature: 0.2, maxOutputTokens: 220 });
      const transcriptFormatted = transcript.slice(-8).map(t => `${t.speaker}: ${t.text}`).join('\n');
      const prompt = `You are a real-time GD coach. Analyze only the User's recent contribution.

TOPIC: "${topic}"
RECENT TRANSCRIPT:
${transcriptFormatted}

USER METRICS:
- Speaking Time: ${userMetrics.speakingTime || 0}s
- Speak Share: ${userMetrics.speakPercentage || 0}%
- Interruptions: ${userMetrics.interruptionCount || 0}
- Fillers: ${userMetrics.fillerWordCount || 0}
- Pacing: ${userMetrics.pacingWpm || 0} WPM

Return ONLY raw JSON:
{
  "summary": "<one short sentence about the latest user contribution>",
  "relevanceScore": <0-100>,
  "clarityScore": <0-100>,
  "nextMove": "<one concise suggestion for the user's next turn>"
}`;

      const result = await runGeminiRequest('live-analysis', () => model.generateContent(prompt));
      const response = await result.response;
      const parsed = JSON.parse(stripJsonFences(response.text()));
      return { ...fallback, ...parsed, rateLimit: getRateLimitStatus() };
    } catch (err) {
      console.error('[Gemini ERROR] Live analysis failed:', err.message);
    }
  }

  return fallback;
};

const runMiniGdTurn = async ({ topic, transcript = [], userText, member = {}, industryContext = 'General / Academic' }) => {
  const memberName = member.name || 'Meera';
  const memberRole = member.role || 'Logical Thinker';
  const personaPrompt = member.prompt || `You are ${memberRole}. Respond naturally in a short GD practice.`;
  const transcriptFormatted = transcript.slice(-8).map(t => `${t.speaker}: ${t.text}`).join('\n');
  const wordCount = String(userText || '').split(/\s+/).filter(Boolean).length;
  const hasExample = /example|for instance|such as|case|data|study|because|since|recently|in my experience/i.test(userText || '');
  const hasLink = /therefore|so|this shows|as a result|in conclusion|overall|this means/i.test(userText || '');
  const fallbackScore = Math.min(100, Math.round(Math.min(wordCount, 45) * 1.25 + (hasExample ? 22 : 0) + (hasLink ? 18 : 0)));

  if (hasApiKey && genAI) {
    try {
      const model = buildModel({ temperature: 0.75, topP: 0.9, maxOutputTokens: 420 });
      const prompt = `You are running a 60-second mini Group Discussion practice.

TOPIC: "${topic}"
INDUSTRY CONTEXT: ${industryContext}

AI MEMBER:
Name: ${memberName}
Role: ${memberRole}
Persona: ${personaPrompt}

RECENT MINI GD:
${transcriptFormatted || '(No prior turns)'}

USER JUST SAID:
"${userText}"

Return ONLY raw JSON:
{
  "memberReply": "<${memberName}'s natural 1-2 sentence reply that directly reacts to the user's point and adds one new topic-specific angle>",
  "coachFeedback": "<one concise coaching sentence about the user's answer quality>",
  "score": <0-100>,
  "nextPrompt": "<one short follow-up question ${memberName} asks the user>"
}

Rules:
- Do not repeat old generic lines.
- The member reply must mention a specific issue from the topic.
- Coach feedback must be honest. If the user says only "hi", "ok", or a very short phrase, score below 15.
- Keep everything short enough for quick mini practice.`;

      const result = await runGeminiRequest('mini-gd-turn', () => model.generateContent(prompt), {
        maxQueueWaitMs: 16000
      });
      const response = await result.response;
      const parsed = JSON.parse(stripJsonFences(response.text()));
      return {
        memberReply: parsed.memberReply || `${memberName}: Let us connect that more clearly to ${topic}.`,
        coachFeedback: parsed.coachFeedback || 'Add a clearer reason and example.',
        score: Math.max(0, Math.min(100, Number(parsed.score) || fallbackScore)),
        nextPrompt: parsed.nextPrompt || 'Can you add one concrete example?'
      };
    } catch (err) {
      console.error('[Gemini ERROR] Mini GD turn failed:', err.message);
    }
  }

  const topicCore = String(topic || 'this topic').replace(/[?.!]+$/, '');
  return {
    memberReply: `${memberName}: Your point needs to connect more directly to ${topicCore}. I would ask whether this works in real life and who is affected most.`,
    coachFeedback: hasExample
      ? 'Good, you added support. Now make the final link to the topic sharper.'
      : 'Add one concrete example or data point so it sounds like a real GD answer.',
    score: fallbackScore,
    nextPrompt: `Can you give one practical example related to ${topicCore}?`
  };
};

module.exports = {
  generateParticipantResponse,
  analyzeGDSession,
  generateResumeTopics,
  generateTrendingTopics,
  moderateDiscussion,
  analyzeLiveTurn,
  runMiniGdTurn,
  getRateLimitStatus
};
