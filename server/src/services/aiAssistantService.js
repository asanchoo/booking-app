import { createHash } from 'crypto';
import { database } from '../db/database.js';
import { runDemoAssistant } from './aiDemoEngine.js';
import { runOpenAiAssistant } from './openAiAssistant.js';
import { runGeminiAssistant } from './geminiAssistant.js';

export function getAiRuntimeStatus() {
  const configuredProvider = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  const canUseGemini = Boolean(process.env.GEMINI_API_KEY) && ['auto', 'gemini'].includes(configuredProvider);
  const canUseOpenAi = Boolean(process.env.OPENAI_API_KEY) && ['auto', 'openai'].includes(configuredProvider);
  const provider = canUseGemini ? 'gemini' : (canUseOpenAi ? 'openai' : 'fallback');
  return {
    provider,
    model: provider === 'gemini'
      ? (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite')
      : (provider === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-5.4-mini') : 'guided-booking'),
  };
}

export function makeSafetyIdentifier(value) {
  return createHash('sha256').update(String(value || 'anonymous')).digest('hex');
}

export async function getExternalAiRequestsToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const row = await database.one(`
    SELECT COUNT(*) AS count
    FROM ai_interactions
    WHERE provider IN ('gemini', 'openai') AND created_at >= ?
  `, [startOfDay.toISOString()]);
  return Number(row?.count || 0);
}

async function saveInteraction({ provider, toolsUsed, success, latencyMs }) {
  await database.run(`
    INSERT INTO ai_interactions (provider, tools_used, success, latency_ms)
    VALUES (?, ?, ?, ?)
  `, [provider, JSON.stringify(toolsUsed || []), success ? 1 : 0, Math.max(0, Math.round(latencyMs))]);
}

export async function runAiAssistant({ messages, clientIdentifier, forceDemo = false }) {
  const startedAt = performance.now();
  const runtime = getAiRuntimeStatus();
  let provider = forceDemo ? 'fallback' : runtime.provider;
  let fallback = false;
  let result;

  try {
    result = provider === 'gemini'
      ? await runGeminiAssistant({ messages })
      : (provider === 'openai'
        ? await runOpenAiAssistant({ messages, safetyIdentifier: makeSafetyIdentifier(clientIdentifier) })
        : await runDemoAssistant({ messages }));
  } catch (error) {
    if (!['openai', 'gemini'].includes(provider)) throw error;
    provider = 'fallback';
    fallback = true;
    result = await runDemoAssistant({ messages });
    console.warn(`${runtime.provider} assistant unavailable, guided fallback enabled:`, error.message);
  }

  await saveInteraction({ provider, toolsUsed: result.toolsUsed, success: true, latencyMs: performance.now() - startedAt });
  return { ...result, provider, fallback };
}
