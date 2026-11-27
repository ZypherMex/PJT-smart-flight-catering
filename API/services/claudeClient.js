const Anthropic = require('@anthropic-ai/sdk');

// On some corporate networks/VPNs, outbound HTTPS is intercepted by an SSL-
// inspection proxy whose certificate Node doesn't trust, causing every
// request to fail with SELF_SIGNED_CERT_IN_CHAIN. The correct fix is
// NODE_EXTRA_CA_CERTS pointing at that proxy's root CA. As an explicit,
// scoped opt-in fallback (never default-on, never global), setting
// ANTHROPIC_ALLOW_INSECURE_TLS=true disables certificate verification for
// just this client's requests.
let fetchOptions;
if (process.env.ANTHROPIC_ALLOW_INSECURE_TLS === 'true') {
  const { Agent } = require('undici');
  console.warn(
    'ANTHROPIC_ALLOW_INSECURE_TLS=true — TLS certificate verification is disabled for Claude API requests. ' +
      'Use only if you understand why (e.g. a corporate SSL-inspection proxy) — never in production.'
  );
  fetchOptions = { dispatcher: new Agent({ connect: { rejectUnauthorized: false } }) };
}

// Reads ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL from env automatically —
// set ANTHROPIC_BASE_URL when routing through an internal AI gateway instead
// of api.anthropic.com directly.
const anthropic = new Anthropic(fetchOptions ? { fetchOptions } : {});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

const SYSTEM_PROMPT = `You are an airline nutrition and menu recommendation engine.

You only recommend meals provided in the availableMenu array.

You never create new menu items.

Your job is to rank available menu items based on:

1. Passenger health conditions
2. Dietary restrictions
3. Cabin class
4. Flight haul duration
5. Passenger meal preferences

Health and safety overrides passenger preferences.

Return only valid JSON.

Never include markdown.

Never recommend menu items not present in availableMenu.

Respond with exactly this JSON shape and nothing else:
{
  "recommendedMeals": [
    { "mealId": <number>, "mealName": "<string>", "score": <0-100 number>, "reason": "<string>" }
  ],
  "summary": "<string>",
  "confidence": <0-100 number>
}
Return at most the top 3 recommended meals, ordered best first.`;

// The prompt asks for bare JSON, but models sometimes wrap it in a markdown code
// fence (```json ... ```) or add a sentence around it. Accept all of those: take
// the fenced block if there is one, otherwise the outermost { ... }.
function extractJson(responseContent) {
  const textBlock = responseContent.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude response contained no text block');

  let text = textBlock.text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.recommendedMeals)) {
      throw new Error('missing the "recommendedMeals" list');
    }
    return parsed;
  } catch (err) {
    throw new Error(`Claude did not return usable JSON: ${err.message}. Raw text: ${textBlock.text.slice(0, 500)}`);
  }
}

// The one real enforcement of "never invent meals": regardless of what the
// prompt asked for, strip out any recommendation whose mealId isn't in the
// exact availableMenu list that was sent this call.
function filterToAvailableMenu(recommendedMeals, availableMenu) {
  const validIds = new Set(availableMenu.map((item) => item.id));
  return (recommendedMeals || []).filter((meal) => validIds.has(meal.mealId));
}

async function getMealRecommendation({ flightClass, haulLength, healthConditions, selectedMeals, availableMenu }) {
  const payload = {
    flightClass,
    haulType: haulLength,
    healthConditions,
    selectedMeals: selectedMeals || [],
    availableMenu,
  };

  // A model reply is not guaranteed to be well-formed, so a reply that still
  // cannot be read after tolerant parsing gets exactly one more attempt. Network
  // and gateway errors are not retried here: they surface straight away.
  const MAX_ATTEMPTS = 2;
  let parsed;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive', display: 'omitted' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });

    try {
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Claude response was truncated (hit max_tokens) before completing the JSON.');
      }
      parsed = extractJson(response.content);
      break;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      console.warn(`Meal recommendation reply unreadable (attempt ${attempt} of ${MAX_ATTEMPTS}), retrying: ${err.message.split('. Raw text')[0]}`);
    }
  }

  const recommendedMeals = filterToAvailableMenu(parsed.recommendedMeals, availableMenu);

  return {
    recommendedMeals,
    summary: parsed.summary || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  };
}

module.exports = { getMealRecommendation, extractJson };
