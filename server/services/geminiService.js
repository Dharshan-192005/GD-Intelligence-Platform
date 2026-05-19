const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API Key is available
const apiKey = process.env.GEMINI_API_KEY || '';
const hasApiKey = apiKey.trim().length > 0;

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

/**
 * Generate AI participant argument using real Gemini LLM
 */
const generateParticipantResponse = async (topic, transcript, speakerName, personaPrompt) => {
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const transcriptFormatted = transcript.slice(-10).map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const prompt = `You are participating in a live Group Discussion (GD) round. Your name is ${speakerName}.

YOUR PERSONA:
${personaPrompt}

DISCUSSION TOPIC: "${topic}"

RECENT CONVERSATION:
${transcriptFormatted || "(The discussion just started. Make an opening statement.)"}

RULES:
- Output ONLY your spoken dialogue. No labels, no "Name:", no quotes around it.
- Keep it 1-3 sentences (30-60 words). This is a fast-paced discussion.
- React to the most recent speaker. If "User" just spoke, respond directly to their point.
- Sound natural and human. No meta-commentary about your role.
- Stay on topic: "${topic}". Make substantive points with real reasoning.

Your response:`;

      const result = await model.generateContent(prompt);
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
  const fallbacks = {
    Sam: [
      "We need to stop dancing around the real issue here. The impact is immediate and severe, and half-measures won't cut it.",
      "I completely disagree with that assessment. The ground reality is far more complex than what's being presented.",
      "If we don't act decisively now, we'll be having this same conversation a year from now with worse outcomes."
    ],
    Meera: [
      "Let me bring some data to this discussion. Research consistently shows that structured approaches yield 40% better outcomes in situations like these.",
      "The statistics paint a nuanced picture. We need to separate correlation from causation before drawing conclusions.",
      "From an analytical standpoint, the key variable here is implementation timeline. Historical data suggests a phased approach works best."
    ],
    Leo: [
      "I appreciate the diverse perspectives here. Both sides raise valid concerns. Perhaps we can find a middle ground that addresses the core issues.",
      "That's an excellent point. Building on what was said, I think the real opportunity lies in collaborative solutions.",
      "Let's make sure everyone gets heard. The strongest solutions come from synthesizing different viewpoints."
    ],
    Kabir: [
      "Hold on, are we sure we're even asking the right question? The underlying assumption here might be flawed.",
      "That argument sounds compelling on the surface, but what happens when you stress-test it against edge cases?",
      "I want to push back on that. Who actually benefits from this framing, and are we ignoring the hidden costs?"
    ]
  };
  const pool = fallbacks[speakerName] || fallbacks.Sam;
  const idx = Math.min(transcript.length % pool.length, pool.length - 1);
  return pool[idx];
};

/**
 * Perform detailed AI analysis on GD Session using real Gemini LLM
 */
const analyzeGDSession = async (topic, transcript, userMetrics) => {
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const transcriptFormatted = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const prompt = `You are an expert Executive Communications Coach evaluating a Group Discussion.

TOPIC: "${topic}"

USER METRICS:
- Speaking Time: ${userMetrics.speakingTime}s (${userMetrics.speakPercentage}% of discussion)
- Interruptions by User: ${userMetrics.interruptionCount}
- Interrupted by others: ${userMetrics.interruptedCount}
- Pacing: ${userMetrics.pacingWpm} WPM
- Filler Words ('uh','um','like'): ${userMetrics.fillerWordCount}

FULL TRANSCRIPT:
${transcriptFormatted}

Analyze the "User" participant ONLY. Score them HONESTLY based on what they actually said and did. Do NOT inflate scores. If they barely participated, scores should be low. If their arguments were generic, say so.

Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):
{
  "leadershipScore": <1-100, based on initiative, facilitation, consensus-building>,
  "confidenceScore": <1-100, based on pacing, assertiveness, lack of fillers>,
  "effectivenessScore": <1-100, based on argument quality, clarity, persuasion>,
  "analysisSummary": "<3-4 sentence professional assessment of user's GD performance>",
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
- If user made > 3 interruptions, leadership should drop by 10 points
- If user's arguments were surface-level or generic, effectiveness ≤ 60
- Scores of 90+ should be RARE and only for truly outstanding performance
- Base your evaluation on ACTUAL transcript content, not assumptions`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let responseText = response.text().trim();
      
      // Strip markdown code fences if Gemini wraps the JSON
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(responseText);
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

  let confidence = 65;
  if (wpm > 150 || wpm < 90) confidence -= 10;
  if (fillers > 5) confidence -= Math.min(fillers * 3, 25);
  confidence = Math.max(25, Math.min(90, confidence));

  let leadership = 45;
  if (speakPct >= 20 && speakPct <= 35) leadership += 20;
  else if (speakPct > 35) leadership += 5;
  else if (speakPct < 10) leadership -= 20;
  if (interruptions > 3) leadership -= 15;
  if (speakTime < 10) leadership = Math.min(leadership, 30);
  leadership = Math.max(20, Math.min(85, leadership));

  let effectiveness = Math.round((confidence + leadership) / 2);
  if (speakTime < 10) effectiveness = Math.min(effectiveness, 35);
  effectiveness = Math.max(20, Math.min(85, effectiveness));

  // Override if user barely spoke or didn't speak at all
  if (speakTime === 0) {
    confidence = 0;
    leadership = 0;
    effectiveness = 0;
  } else if (speakTime < 10) {
    confidence = Math.min(confidence, 30);
  }

  const userPhrases = transcript.filter(t => t.speaker === 'User').map(t => t.text);
  const sample = userPhrases.length > 0 ? userPhrases[0] : "I think this topic is important.";

  return {
    leadershipScore: leadership,
    confidenceScore: confidence,
    effectivenessScore: effectiveness,
    analysisSummary: `[Offline Analysis] You participated for ${speakTime} seconds (${speakPct}% of the discussion). Your pacing was ${wpm} WPM. ${speakTime < 15 ? 'Your participation was minimal, which significantly limits leadership assessment.' : 'You showed willingness to engage, though there is room for more structured argumentation.'} Connect to the internet and add a Gemini API key for real AI-powered coaching.`,
    strengths: [
      speakTime > 20 ? "Consistent participation throughout the discussion." : "Showed restraint and listened before speaking.",
      "Engaged with the discussion topic directly."
    ],
    weaknesses: [
      fillers > 4 ? "Heavy use of filler words weakening perceived confidence." : "Limited engagement with other participants' specific points.",
      speakTime < 15 ? "Insufficient speaking time to demonstrate leadership." : "Arguments could benefit from more structured evidence."
    ],
    actionableTips: [
      "Use the PEEL structure: Point, Explanation, Example, Link back to topic.",
      "Practice replacing filler words with deliberate 1-second pauses.",
      "Actively reference other speakers' points to show engaged listening."
    ],
    topicRelevance: "[Offline] Unable to deeply analyze topic relevance without LLM. Add GEMINI_API_KEY for real analysis.",
    argumentDepth: "[Offline] Unable to evaluate argument depth without LLM. Add GEMINI_API_KEY for real analysis.",
    suggestedPhrases: [
      {
        original: sample.length > 60 ? sample.substring(0, 60) + "..." : sample,
        improved: "The structural implications of this issue demand a multi-stakeholder framework that balances innovation with equitable access.",
        reason: "Elevates casual language to structured, professional discourse."
      }
    ]
  };
};

module.exports = {
  generateParticipantResponse,
  analyzeGDSession
};
