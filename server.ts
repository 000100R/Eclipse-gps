import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI securely on the server
const apiKey = process.env.GEMINI_API_KEY;
const rawModelName = process.env.GEMINI_MODEL || '';
// If rawModelName starts with 'AQ.', it is an internal or tuned model ID not supported by standard generateContent
const cleanModel = rawModelName.startsWith('AQ.') ? '' : rawModelName.replace(/^models\//, '');

// Official active models list ordered by active quota availability
const CANDIDATE_MODELS = Array.from(
  new Set([
    ...(cleanModel ? [cleanModel] : []),
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ])
);

// Quota exhaustion and high-demand cooldown cache to avoid repeated failed calls
const modelCooldowns = new Map<string, number>();

function isModelCoolingDown(model: string): boolean {
  const until = modelCooldowns.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    modelCooldowns.delete(model);
    return false;
  }
  return true;
}

function markModelCoolingDown(model: string, reason: string, seconds = 45) {
  modelCooldowns.set(model, Date.now() + seconds * 1000);
  console.warn(`[Gemini API] Model ${model} cooling down (${reason}). Cooldown: ${seconds}s.`);
}

function markModelExhausted(model: string, retryDelaySeconds = 60) {
  markModelCoolingDown(model, 'quota_exhausted', retryDelaySeconds);
}

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log(`Gemini API Initialized securely on server. Candidates: ${CANDIDATE_MODELS.join(', ')}`);
} else {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set.');
}

/**
 * Safe error classifier ensuring useful debug feedback without exposing secrets
 */
function classifyGeminiError(error: any): { message: string; type: string; status: number } {
  if (!apiKey) {
    return {
      message: 'Gemini API key missing: GEMINI_API_KEY environment variable is not configured.',
      type: 'MISSING_API_KEY',
      status: 500,
    };
  }

  const status = error?.status || error?.code;
  const msg = (error?.message || String(error || '')).toLowerCase();

  if (status === 401 || msg.includes('api_key_invalid') || msg.includes('invalid api key') || msg.includes('unauthenticated')) {
    return {
      message: 'Gemini authentication failed: The provided API key is invalid.',
      type: 'INVALID_API_KEY',
      status: 401,
    };
  }

  if (status === 403 || msg.includes('permission_denied') || msg.includes('permission denied')) {
    return {
      message: 'Gemini permission denied: API key lacks authorization or project access.',
      type: 'API_KEY_NOT_AUTHORIZED',
      status: 403,
    };
  }

  if (msg.includes('billing')) {
    return {
      message: 'Billing required: Google Cloud project requires billing enabled.',
      type: 'BILLING_REQUIRED',
      status: 402,
    };
  }

  if (status === 404 || msg.includes('not_found') || msg.includes('not found') || msg.includes('no longer available')) {
    return {
      message: 'Gemini model not found: The configured model is not available.',
      type: 'MODEL_NOT_FOUND',
      status: 404,
    };
  }

  if (status === 429 || msg.includes('resource_exhausted') || msg.includes('quota')) {
    return {
      message: 'Gemini quota exceeded: API resource limit reached.',
      type: 'QUOTA_EXCEEDED',
      status: 429,
    };
  }

  if (status === 503 || msg.includes('high demand') || msg.includes('unavailable')) {
    return {
      message: 'Gemini model high demand (503): Model experiencing temporary high demand.',
      type: 'RATE_LIMITED',
      status: 503,
    };
  }

  if (status === 400 || msg.includes('invalid_argument') || msg.includes('malformed')) {
    return {
      message: 'Invalid request: Bad parameters or malformed content structure.',
      type: 'INVALID_REQUEST',
      status: 400,
    };
  }

  if (msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('enotfound') || msg.includes('network')) {
    return {
      message: 'Gemini network failure: Unable to reach Google AI servers.',
      type: 'NETWORK_ERROR',
      status: 502,
    };
  }

  return {
    message: `Gemini server/API route failure: ${error?.message || 'Internal server error'}`,
    type: 'SERVER_ROUTE_ERROR',
    status: typeof status === 'number' && status >= 400 && status < 600 ? status : 500,
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Temporary Minimal Gemini API Health Check Endpoint (STEP 2)
app.get('/api/ai/health', async (req, res) => {
  const envKeyDetected = !!process.env.GEMINI_API_KEY;
  const keyLength = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0;
  let keyType = 'UNKNOWN';
  if (process.env.GEMINI_API_KEY?.startsWith('AIzaSy')) {
    keyType = 'STANDARD';
  } else if (process.env.GEMINI_API_KEY?.startsWith('AQ.')) {
    keyType = 'AUTH';
  }

  if (!envKeyDetected || !ai) {
    const errorInfo = classifyGeminiError(new Error('GEMINI_API_KEY is not set'));
    return res.status(500).json({
      test: 'FAIL',
      errorCategory: 'MISSING_API_KEY',
      httpStatus: 500,
      apiKeyDetected: false,
      apiKeyType: keyType,
      apiKeyLength: 0,
      sdk: '@google/genai',
      model: CANDIDATE_MODELS[0] || 'gemini-3.8-flash',
      result: errorInfo.message,
    });
  }

  const candidateList = [
    ...CANDIDATE_MODELS.filter((m) => !isModelCoolingDown(m)),
    ...CANDIDATE_MODELS.filter((m) => isModelCoolingDown(m)),
  ];

  let lastHealthError: any = null;
  let responseText = '';
  let modelUsed = candidateList[0] || 'gemini-3.8-flash';
  let durationMs = 0;

  for (const candidate of candidateList) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const startTime = Date.now();
        const response = await ai.models.generateContent({
          model: candidate,
          contents: 'Reply with exactly: ECLIPSE_GEMINI_OK',
        });
        durationMs = Date.now() - startTime;
        responseText = (response.text || '').trim();
        modelUsed = candidate;
        break;
      } catch (err: any) {
        lastHealthError = err;
        const status = err?.status || err?.code;
        const errMsg = (err?.message || '').toLowerCase();
        if (status === 429 || errMsg.includes('resource_exhausted') || errMsg.includes('quota')) {
          let delaySec = 60;
          try {
            const match = err?.message?.match(/retry in ([0-9.]+)s/i) || err?.message?.match(/retryDelay":"([0-9]+)s/i);
            if (match) delaySec = Math.max(30, Math.ceil(parseFloat(match[1])));
          } catch (_) {}
          markModelCoolingDown(candidate, 'quota_exhausted', delaySec);
          break;
        }
        if (status === 503 || errMsg.includes('high demand') || errMsg.includes('unavailable')) {
          if (attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          } else {
            markModelCoolingDown(candidate, 'high_demand_503', 30);
            break;
          }
        }
        break;
      }
    }
    if (responseText) break;
  }

  if (!responseText) {
    const classified = classifyGeminiError(lastHealthError);
    return res.status(classified.status).json({
      test: 'FAIL',
      errorCategory: classified.type,
      httpStatus: classified.status,
      apiKeyDetected: true,
      apiKeyType: keyType,
      apiKeyLength: keyLength,
      sdk: '@google/genai',
      model: modelUsed,
      result: classified.message,
    });
  }

  return res.json({
    test: 'PASS',
    apiKeyDetected: true,
    apiKeyType: keyType,
    apiKeyLength: keyLength,
    sdk: '@google/genai',
    model: modelUsed,
    httpStatus: 200,
    durationMs,
    rawResponse: responseText,
    result: responseText.includes('ECLIPSE_GEMINI_OK')
      ? 'Gemini connection verified and active.'
      : `Gemini responded: "${responseText}"`,
  });
});

// Strict Action Definition System Instruction
const SYSTEM_INSTRUCTION = `
You are Eclipse AI, the intelligent co-pilot for Eclipse GPS - a cutting-edge real-time location intelligence and navigation platform.
Your job is to assist the user with map navigation, event discovery, Durga Puja pandal tours, and trip planning.

You must NEVER respond with plain conversational text. You MUST ALWAYS respond with a structured JSON object.
Do not wrap your JSON in arbitrary markdown blocks unless you output standard JSON strings.
The JSON object must strictly follow this structure:
{
  "text": "A friendly, helpful conversational response explaining your action, recommendations, or answers.",
  "action": "ACTION_TYPE",
  "parameters": {
    "query": "search term if applicable",
    "name": "name of pandal or place if applicable",
    "area": "area or neighborhood if applicable",
    "category": "category filter if applicable",
    "locationName": "name of a place",
    "itemId": "id of a pandal/event if applicable",
    "radius": 5000,
    "pandalIds": ["pandal-1", "pandal-2", ...],
    "bonediBariIds": ["bonedi-sovabazar-rajbari", "bonedi-chhatu-babu-latu-babu", ...],
    "isTour": false
  }
}

You support the following validated ACTION_TYPE values. You must select the single most appropriate action based on the user's message:
- SEARCH_METRO: Use when the user asks about Kolkata Metro stations or discovering Durga Pujas / Bonedi Baris from a Metro station, e.g. "Shyambazar Metro to nearby pandals", "pandals near Shyambazar Metro", "Bonedi Bari near Kalighat Metro", "what can I visit from Rabindra Sadan Metro?", "Puja from Metro", "Show metro stations". (Parameters: query, stationName, line)
- SEARCH_BONEDI_BARI: Use when the user asks about Kolkata's heritage aristocrat houses (Bonedi Bari Durga Pujas), e.g. "show Bonedi Bari near me", "Bonedi Bari near Shyambazar Metro", "plan a Bonedi Bari tour", "Show Sovabazar Rajbari", "Heritage pujas in North Kolkata". (Parameters: query, area, nearMetro, isTour, bonediBariIds)
- VIEW_PUJA_CALENDAR: Use when the user asks about the festival timeline, ritual dates, astronomical timings, or asks questions like "What's happening today?", "What can I visit on Ashtami?", "What's happening on Dashami?", "When is Sandhi Puja?", "Pushpanjali timings", "Kumari Puja", "Sindoor Khela", "Visarjan", or "Durga Puja schedule". (Parameters: query, day, year)
- QUERY_CROWD_INTELLIGENCE: Use when the user asks about crowd density, footfall levels, queue times, or finding low-crowd pandals, e.g. "Which pandals are less crowded right now?", "Where can I find lower crowds nearby?", "How crowded is College Square?", "Is Maddox Square crowded?", "Find pandals with short wait times". (Parameters: pandalName, query, crowdPreference)
- QUERY_TRAFFIC_INTELLIGENCE: Use when the user asks about traffic conditions, police road advisories, delays, or arterial congestion, e.g. "Is traffic heavy near Bagbazar?", "How is traffic on EM Bypass?", "Traffic near Rash Behari Avenue", "What roads are congested right now?". (Parameters: corridorName, area, query)
- SMART_VISIT_RECOMMENDATION: Use when the user asks whether they should visit a pandal now or later, or asks for the best time to visit based on combined crowd and traffic conditions, e.g. "Should I go to College Square now or later?", "When should I visit Maddox Square?", "Is it a good time to go to Sreebhumi?". (Parameters: pandalName, query)
- SEARCH_NEARBY_PANDALS: Use when the user asks for pandals around them, e.g. "Find nearby pandals", "Show pandals near me", "What pandals are around me?", "Show all nearby Durga Puja pandals". (Parameters: radius: 5000, category: "pandal")
- SEARCH_PANDALS_BY_NAME: Use when the user searches for a specific pandal by name, e.g. "Find Maddox Square", "Show Maddox Square on the map", "Show Deshapriya Park", "Find Sreebhumi". (Parameters: name, query)
- SEARCH_PANDALS_BY_AREA: Use when the user asks for pandals in a specific neighborhood or zone, e.g. "Find pandals near Salt Lake", "Show pandals around Ballygunge", "Show all pandals around South Kolkata", "Pandals in Behala". (Parameters: area, query)
- SEARCH_PLACES: Search for generic addresses, shops, landmarks, or restaurants. (Parameters: query)
- SEARCH_EVENTS: Search for festivals, concerts, sports, fairs, or local events. (Parameters: query)
- SEARCH_PANDALS: Search generally for Durga Puja pandals. (Parameters: query)
- SHOW_NEARBY: Show points of interest, events, or places near the user. (Parameters: radius, category)
- SHOW_LOCATION: Fly to or display a specific place on the map. (Parameters: itemId, locationName)
- CREATE_ROUTE: Create a direct route. (Parameters: origin, destination, waypoints)
- OPTIMIZE_ROUTE: Plan and optimize a multi-stop route through selected pandals/events. (Parameters: pandalIds, bonediBariIds)
- SMART_PUJA_ROUTE: Use when the user asks to plan a Puja night route, tour, or hopping itinerary, or asks queries like:
  * "Plan my Puja night for 5 hours" (availableTimeMinutes: 300)
  * "Give me a route from Shyambazar Metro covering the best nearby pandals" (startLocationQuery: "Shyambazar Metro")
  * "I want minimum walking" (priority: "LESS_WALKING", transportMode: "METRO" or "MIXED")
  * "Add two Bonedi Baris" (addBonediBarisCount: 2)
  * "Remove the most crowded stop" (removeMostCrowded: true)
  * "Can I finish this route before 10 PM?" (checkFinishBeforeTime: "22:00")
  (Parameters: availableTimeMinutes, transportMode, priority, startLocationQuery, pandalIds, bonediBariIds, addBonediBarisCount, removeMostCrowded, checkFinishBeforeTime, query)
- NAVIGATE_TO: Turn on navigation mode to a destination. (Parameters: itemId, locationName)
- SAVE_LOCATION: Save a place or pandal to the saved list. (Parameters: itemId)
- REMOVE_SAVED_LOCATION: Remove a location from the saved list. (Parameters: itemId)
- GET_PLACE_DETAILS: Inspect details of a place. (Parameters: itemId)
- GET_EVENT_DETAILS: Inspect details of an event or pandal. (Parameters: itemId)
- SHOW_ALERTS: View active warnings or crowd alerts. (Parameters: query)
- NO_ACTION: When the user asks a general informational question or makes chit-chat that doesn't trigger map adjustments. (Parameters: query)

IMPORTANT DIRECTIVE FOR METRO PUJA GUIDE & BONEDI BARI DISCOVERY:
You determine user intent and select the appropriate action. You must NEVER fabricate metro station names, pandal names, fake coordinates, or hallucinated addresses.
The application's high-precision Metro Intelligence Provider, Bonedi Bari Intelligence Provider, and Pandal Discovery Engine will execute the actual search against verified Kolkata Metro stations and curated Durga Puja locations, compute genuine walking routes and distances, and display interactive cards.
In your "text" field, provide a polite, informative response highlighting verified connections.

Here is your knowledge of Kolkata's authentic, verified Bonedi Bari Heritage Houses:
1. Sovabazar Rajbari (ID: bonedi-sovabazar-rajbari | Sovabazar, Raja Nabakrishna Deb Family, since 1757, Lord Clive historic link, Natmandir courtyard, nearest metro: Shobhabazar Sutanuti)
2. Sabarna Roy Choudhury Bari (ID: bonedi-sabarna-roy-choudhury | Barisha, since 1610 - oldest in Kolkata, Aatchala mandap, Lal-Rong idol, nearest metro: Behala Chowrasta / Taratala)
3. Chhatu Babu & Latu Babu Bari (ID: bonedi-chhatu-babu-latu-babu | Beadon Street, Ramdulal Dey Family, since 1770, silver chalchitra & Jaya-Bijaya attendants, nearest metro: Girish Park)
4. Pathuriaghata Khelat Ghosh Bari (ID: bonedi-pathuriaghata-khelat-ghosh | Pathuriaghata, Khelat Ghosh Family, since 1846, Italian marble courtyard & Belgian chandeliers, nearest metro: MG Road)
5. Darjipara Mitra Bari (ID: bonedi-darjipara-mitra-bari | Nilmani Mitra Street, Mitra Family, since 1807, classical colonnade & winged lion, nearest metro: Shobhabazar Sutanuti)
6. Jorasanko Shib Krishna Daw Bari (ID: bonedi-jorasanko-shib-krishna-daw | Jorasanko, Daw Family, since 1840, exquisite gold & silver jewelry with gemstones, nearest metro: Girish Park)
7. Thanthania Dutta Bari (ID: bonedi-thanthania-dutta-bari | College Street / Bidhan Sarani, Dutta Family, since 1855, serene weaponless Har-Parvati idol, nearest metro: MG Road)
8. Rani Rashmoni Bari (ID: bonedi-rani-rashmoni-bari | Janbazar / SN Banerjee Rd, Rani Rashmoni Family, since 1790, visited by Sri Ramakrishna Paramahamsa, nearest metro: Esplanade)
9. Bhawanipur Mallick Bari (ID: bonedi-bhawanipur-mallick-bari | Padmapukur Road, Mallick Family / Ranjit & Koel Mallick, consecrated 1925, sacred conch & Sindoor Khela, nearest metro: Netaji Bhavan)
10. Bhukailash Rajbari (ID: bonedi-bhukailash-rajbari | Kidderpore, Maharaja Joy Narayan Ghoshal Family, since 1782, twin monolithic basalt Shiva temples, nearest metro: Netaji Bhavan / Kidderpore)
11. Balaram Dey Street Dutta Bari (ID: bonedi-balaram-dey-dutta-bari | Girish Park, Shyamal Dhon Dutta Family, since 1882, pure silver throne & shoulder immersion, nearest metro: Girish Park)
12. Posta Rajbari (ID: bonedi-posta-rajbari | Rabindra Sarani, Posta, Raja Sukhamay Roy Family, since 1800, red-brick arches, nearest metro: Shobhabazar Sutanuti)

When the user asks to "plan a Bonedi Bari tour":
Output action "SEARCH_BONEDI_BARI" with "isTour": true and include bonediBariIds, e.g. ["bonedi-sovabazar-rajbari", "bonedi-chhatu-babu-latu-babu", "bonedi-pathuriaghata-khelat-ghosh", "bonedi-jorasanko-shib-krishna-daw"]. Explain the heritage route clearly in your text response.

Here is your knowledge of prominent Kolkata Durga Puja Pandals:
1. Maddox Square (Ballygunge, Traditional Sabeki Puja, open park gathering)
2. Deshapriya Park (Rash Behari Avenue, Kalighat, colossal thematic installations)
3. Sreebhumi Sporting Club (Lake Town, Royal monument replicas, gold ornaments)
4. Santosh Mitra Square (Bowbazar, Golden Temple & 3D light architecture)
5. Ballygunge Cultural Association (Ballygunge, Rural Bengal terracotta craft)
6. Chetla Agrani Club (Chetla / Alipore, handcrafted wooden art & forest retreat)
7. College Square (College Street, Illuminated palace on the lake)
8. Ekdalia Evergreen Club (Gariahat, Gothic cathedral & European chandeliers)
9. Tridhara Sammilani (Manoharpukur / Kalighat, contemporary thought art)
10. Suruchi Sangha (New Alipore, Indian regional folk cultures)
11. Mudiali Club (Kalighat / Tollygunge, Dokra brass folk metalcraft)
12. Singhi Park (Gariahat, classical stone temple sculptures)
13. Bagbazar Sarbojanin (North Kolkata, historic heritage Sabeki tradition)
14. FD Block & BJ Block (Salt Lake, grand futuristic and village art pavilions)
15. Behala Notun Dal & Barisha Club (Behala, cutting-edge art and social sculptures)
16. Kumartuli Park (Kumartuli, tribute to the traditional clay sculptors of Bengal)

If the user asks for a trip plan (e.g. "I have 5 hours tonight. Find 7 Durga Puja pandals. Avoid extreme crowds and minimize travel."), choose appropriate locations, explain your reasoning in the "text" field, and return an 'OPTIMIZE_ROUTE' action containing the pandalIds so the application's TSP routing engine can calculate the actual road geometry and optimize it!

If the user mentions "Take me to Maddox Square" or "navigate to Sreebhumi", output 'NAVIGATE_TO' with the locationName.

IMPORTANT DIRECTIVE FOR DURGA PUJA CALENDAR & FESTIVAL INTELLIGENCE:
You are equipped with Kolkata's authentic, verified Durga Puja Festival Calendar based strictly on Bengal Panjika (Bisuddhasiddhanta and Gupta Press traditions) and Kolkata Police city guidelines. You MUST NEVER hallucinate dates or ritual timings.
Verified Bengal Festival Calendar (Active Year 2026):
- Mahalaya (মহালয়া ও পিতৃ তর্পণ): Oct 10, 2026 (04:00 AM – 11:00 AM) — Dawn radio broadcast of Mahishasuramardini (Birendra Krishna Bhadra); holy Tarpan at Hooghly River ghats (Babughat, Bagbazar Ghat, Ahiritola).
- Maha Shashthi (মহা ষষ্ঠী বোধন): Oct 16, 2026 (07:30 AM – 08:30 PM) — Kalparambha at sunrise; Bilva Nimantran and Bodhon under Bilva tree; Adhibas rituals marking formal beginning.
- Maha Saptami (মহা সপ্তমী নবপত্রিকা): Oct 17, 2026 (06:00 AM – 01:00 PM) — Dawn river bath of Kola Bou (Nabapatrika tied with sacred herbs) at Hooghly ghats; morning Pushpanjali (09:30 AM – 11:30 AM).
- Maha Ashtami (মহা অষ্টমী পুষ্পাঞ্জলি): Oct 18, 2026 (08:30 AM – 12:30 PM) — Devotees fast in traditional attire to offer lotus and bael-leaf Pushpanjali. Recommended pandals: Maddox Square, Ballygunge Cultural, Sovabazar Rajbari.
- Kumari Puja (কুমারী পূজা): Oct 18, 2026 (09:00 AM – 11:45 AM) — Young girl worshiped as Devi embodiment at Belur Math sanctum and Sovabazar Rajbari.
- Sandhi Puja (সন্ধিপূজা): Oct 18, 2026 (06:15 PM – 07:03 PM) — Exact 48-minute astronomical juncture of Ashtami and Navami; offering of 108 blue lotuses and 108 earthen lamps; antique cannon fired at Sovabazar Rajbari.
- Maha Navami (মহা নবমী ধুনুচি নাচ): Oct 19, 2026 (06:30 PM – 11:00 PM) — Twilight Maha Aarti and ecstatic Dhunuchi Naach with rhythmic dhak beats. Recommended: Maddox Square, Sreebhumi, Santosh Mitra Square.
- Bijoya Dashami (বিজয়া দশমী ও সিঁদুর খেলা): Oct 20, 2026 (10:00 AM – 02:00 PM) — Married women perform Devi Baran, feed sweets, and play Sindoor Khela at pandals (famous at Bagbazar Sarbojanin, Sovabazar Rajbari).
- Dashami Visarjan (বিসর্জন): Oct 20, 2026 (03:00 PM – 11:59 PM) — Water immersion processions at Hooghly river ghats (Babughat, Bagbazar Ghat, Baje Kadamtala).
- Red Road Mega Carnival (রেড রোড কার্নিভাল): Oct 23, 2026 (04:30 PM – 10:00 PM) — UNESCO cultural showcase with 100+ grand puja floats.

How to handle specific festival inquiries:
1. "What's happening today?":
   Detail the verified today's festival status from the Bengal Panjika timeline. Return action 'VIEW_PUJA_CALENDAR' with parameters: { day: 'TODAY', year: 2026 }.
2. "What can I visit on Ashtami?":
   Detail morning Pushpanjali (08:30 AM), Kumari Puja (09:00 AM at Belur Math & Sovabazar Rajbari), and the 48-minute Sandhi Puja (06:15 PM – 07:03 PM with 108 lotuses/lamps). Recommend Maddox Square, Ballygunge Cultural, and Sovabazar Rajbari. Return action 'VIEW_PUJA_CALENDAR' with parameters: { day: 'ASHTAMI', year: 2026 }.
3. "Which pandals are best for tonight?":
   Recommend pandals renowned for spectacular evening illumination, twilight ambiance, and cultural Aarti (e.g., Ekdalia Evergreen, Sreebhumi Sporting Club, Santosh Mitra Square, College Square, and Maddox Square). Return action 'SEARCH_NEARBY_PANDALS' or 'OPTIMIZE_ROUTE'.
4. "What's happening on Dashami?":
   Detail morning Devi Baran & Sindoor Khela (10:00 AM – 02:00 PM, especially at Bagbazar Sarbojanin & Sovabazar Rajbari) and afternoon/evening Ghat Visarjan immersions at Babughat and Bagbazar Ghat. Return action 'VIEW_PUJA_CALENDAR' with parameters: { day: 'DASHAMI', year: 2026 }.
`;

/**
 * Resilient Intent Fallback Engine
 * Activated if upstream Gemini models experience temporary 503 high demand or API rate limits.
 * Ensures the user's Durga Puja navigation, heritage discovery, and pandal tours continue seamlessly.
 */
function generateFallbackIntent(promptText: string, userLocation?: { lat: number; lng: number }): { text: string; action: string; parameters: any } {
  const p = (promptText || '').toLowerCase();

  // -1. Durga Puja Festival Calendar & Ritual Queries
  if (p.includes('what can i visit on ashtami') || (p.includes('ashtami') && (p.includes('visit') || p.includes('plan') || p.includes('what') || p.includes('ritual')))) {
    return {
      text: "On Maha Ashtami (Oct 18, 2026):\n• Morning Pushpanjali (08:30 AM – 12:30 PM): Devotees offer lotus and bael leaves in traditional attire (best at Maddox Square & Ballygunge Cultural).\n• Kumari Puja (09:00 AM – 11:45 AM): Celebrated at Belur Math and Sovabazar Rajbari.\n• Sandhi Puja (06:15 PM – 07:03 PM): The sacred 48-minute astronomical juncture with 108 blue lotuses and 108 lamps, marked by cannon fire at Sovabazar Rajbari.",
      action: "VIEW_PUJA_CALENDAR",
      parameters: { day: "ASHTAMI", year: 2026, query: promptText },
    };
  }

  if (p.includes('what\'s happening on dashami') || p.includes('whats happening on dashami') || (p.includes('dashami') && (p.includes('happen') || p.includes('what') || p.includes('sindoor') || p.includes('visarjan')))) {
    return {
      text: "On Bijoya Dashami (Oct 20, 2026):\n• Devi Baran & Sindoor Khela (10:00 AM – 02:00 PM): Married women offer sweets, betel leaves, and vermilion to Ma Durga (most iconic at Bagbazar Sarbojanin and Sovabazar Rajbari).\n• Ghat Visarjan (03:00 PM – Midnight): Immersion processions with dhak beats across Hooghly river ghats (Babughat, Bagbazar Ghat, Baje Kadamtala).\n• Subho Bijoya greetings and sweets exchange begin post-immersion.",
      action: "VIEW_PUJA_CALENDAR",
      parameters: { day: "DASHAMI", year: 2026, query: promptText },
    };
  }

  if (p.includes('what\'s happening today') || p.includes('whats happening today') || p.includes('happening today') || p.includes('puja today') || p.includes('events today')) {
    return {
      text: "Here is today's verified Durga Puja festival schedule according to Bengal Panjika traditions, including ritual phases, Pushpanjali windows, and immersion or cultural timelines.",
      action: "VIEW_PUJA_CALENDAR",
      parameters: { day: "TODAY", year: 2026, query: promptText },
    };
  }

  if (p.includes('best for tonight') || p.includes('pandals for tonight') || p.includes('tonight') && p.includes('pandal')) {
    return {
      text: "For tonight's pandal hopping, these top-rated locations offer mesmerizing evening illumination and twilight cultural celebrations:\n1. Sreebhumi Sporting Club (spectacular architectural lighting)\n2. Ekdalia Evergreen (authentic chandeliers & German illumination)\n3. Santosh Mitra Square (grand themed light installations)\n4. College Square (mesmerizing water reflections on the tank)\n5. Maddox Square (lively evening cultural gathering)",
      action: "SEARCH_NEARBY_PANDALS",
      parameters: { radius: 6000, category: "pandal", query: promptText },
    };
  }

  if (p.includes('sandhi puja') || p.includes('sandhi time') || p.includes('sandhipuja')) {
    return {
      text: "Sandhi Puja takes place at the exact 48-minute astronomical juncture between Maha Ashtami and Maha Navami (Oct 18, 2026, 06:15 PM – 07:03 PM). It features the lighting of 108 earthen lamps, 108 blue lotuses, and the historic cannon-firing tradition at Sovabazar Rajbari.",
      action: "VIEW_PUJA_CALENDAR",
      parameters: { day: "SANDHI_PUJA", year: 2026, query: promptText },
    };
  }

  if (p.includes('puja calendar') || p.includes('festival calendar') || p.includes('puja schedule') || p.includes('festival schedule') || p.includes('durga puja dates') || p.includes('panjika')) {
    return {
      text: "Opening Eclipse's verified Durga Puja Festival Calendar with Bengal Panjika dates, ritual timings, and locations for 2024–2026.",
      action: "VIEW_PUJA_CALENDAR",
      parameters: { year: 2026, query: promptText },
    };
  }

  // 0. Metro Puja Guide queries
  if (p.includes('metro')) {
    const stationNames = [
      'shyambazar', 'shobhabazar', 'sovabazar', 'girish park', 'mg road', 'central',
      'chandni chowk', 'esplanade', 'park street', 'maidan', 'rabindra sadan',
      'netaji bhavan', 'jatin das park', 'kalighat', 'rabindra sarobar',
      'mahanayak uttam kumar', 'netaji', 'masterda surya sen', 'gitanjali',
      'kavi nazrul', 'shahid khudiram', 'kavi subhash', 'dakshineswar', 'baranagar',
      'noapara', 'dum dum', 'belgachia', 'howrah', 'sealdah', 'phoolbagan', 'salt lake stadium',
      'bengal chemical', 'city centre', 'central park', 'karunamoyee', 'salt lake sector v',
      'joka', 'thakurpukur', 'sakherbazar', 'behala chowrasta', 'behala bazar', 'taratala', 'majerhat'
    ];
    let matchedStation = '';
    for (const name of stationNames) {
      if (p.includes(name)) {
        matchedStation = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }
    return {
      text: matchedStation
        ? `Here are verified Durga Puja pandals and heritage Bonedi Baris accessible from ${matchedStation} Metro station, with walking routes and nearest gates.`
        : "Here is the Eclipse Metro Puja Guide showing Kolkata Metro stations connected to nearby Durga Puja pandals and heritage Bonedi Baris.",
      action: "SEARCH_METRO",
      parameters: { query: promptText, stationName: matchedStation || undefined },
    };
  }

  // 1. Heritage & Bonedi Bari queries
  if (
    p.includes('bonedi') ||
    p.includes('rajbari') ||
    p.includes('aristocrat') ||
    p.includes('heritage house') ||
    p.includes('sovabazar') ||
    p.includes('sabarna') ||
    p.includes('chhatu babu') ||
    p.includes('khelat ghosh') ||
    p.includes('jorasanko') ||
    p.includes('zamindar')
  ) {
    const isTour = p.includes('tour') || p.includes('plan') || p.includes('itinerary') || p.includes('route');
    return {
      text: isTour
        ? "I've planned a verified Bonedi Bari Heritage Tour covering Kolkata's historic aristocratic houses (Sovabazar Rajbari, Chhatu Babu & Latu Babu, Pathuriaghata Khelat Ghosh, and Jorasanko Shib Krishna Daw). Loading itinerary on your map!"
        : "Here are Kolkata's verified Bonedi Bari heritage houses. You can examine their founding centuries, nearest metro stations, and navigate directly on the map!",
      action: "SEARCH_BONEDI_BARI",
      parameters: { isTour, query: promptText },
    };
  }

  // 2. Navigation commands
  if (p.includes('navigate to') || p.includes('take me to') || p.includes('drive to') || p.includes('walk to') || p.includes('route to')) {
    const match = promptText.match(/(?:navigate to|take me to|drive to|walk to|route to)\s+([^.,?!]+)/i);
    const destination = match ? match[1].trim() : 'destination';
    return {
      text: `Routing directly to ${destination}. Initializing live navigation on your map!`,
      action: "NAVIGATE_TO",
      parameters: { locationName: destination },
    };
  }

  // 3. Traffic & Crowd Alerts
  if (p.includes('alert') || p.includes('traffic') || p.includes('crowd') || p.includes('congestion') || p.includes('jam') || p.includes('warning')) {
    return {
      text: "Displaying real-time Kolkata crowd density and police traffic advisories across the puja zones.",
      action: "SHOW_ALERTS",
      parameters: {},
    };
  }

  // 4. Tour planning & Smart Puja Route Planner (Phase 13.8)
  if (
    p.includes('plan') ||
    p.includes('route') ||
    p.includes('tour') ||
    p.includes('itinerary') ||
    p.includes('hop') ||
    p.includes('hours') ||
    p.includes('walking') ||
    p.includes('crowded stop') ||
    p.includes('finish before')
  ) {
    // Check for specific intent modifiers
    let availableTimeMinutes = 240; // 4h default
    const hourMatch = p.match(/(\d+)\s*(?:hours|hour|hrs|hr)/);
    if (hourMatch) {
      availableTimeMinutes = parseInt(hourMatch[1], 10) * 60;
    }

    let transportMode = 'MIXED';
    if (p.includes('metro')) transportMode = 'METRO';
    if (p.includes('walk') && !p.includes('minimum walking') && !p.includes('less walking')) transportMode = 'WALK';
    if (p.includes('drive') || p.includes('car')) transportMode = 'DRIVE';

    let priority = 'MORE_PLACES';
    if (p.includes('minimum walking') || p.includes('less walking') || p.includes('least walking')) {
      priority = 'LESS_WALKING';
      transportMode = 'METRO';
    } else if (p.includes('less traffic') || p.includes('avoid traffic')) {
      priority = 'LESS_TRAFFIC';
    } else if (p.includes('less crowd') || p.includes('avoid crowd')) {
      priority = 'LESS_CROWD';
    }

    let startLocationQuery = undefined;
    if (p.includes('shyambazar')) startLocationQuery = 'Shyambazar Metro';
    else if (p.includes('kalighat')) startLocationQuery = 'Kalighat Metro';
    else if (p.includes('esplanade')) startLocationQuery = 'Esplanade Metro';
    else if (p.includes('shobhabazar') || p.includes('sovabazar')) startLocationQuery = 'Shobhabazar Sutanuti Metro';

    const addBonediBarisCount = p.includes('bonedi bari') ? (p.includes('two') || p.includes('2') ? 2 : 1) : 0;
    const removeMostCrowded = p.includes('remove') && (p.includes('crowd') || p.includes('crowded'));
    
    let checkFinishBeforeTime = undefined;
    const timeMatch = p.match(/(?:before|by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) checkFinishBeforeTime = timeMatch[1];

    let pandalIds: string[] = [];
    if (startLocationQuery?.includes('Shyambazar')) {
      pandalIds = ['pandal-bagbazar', 'pandal-kumartuli-park', 'pandal-ahiritola', 'pandal-hatibagan'];
    } else if (priority === 'LESS_WALKING') {
      pandalIds = ['pandal-maddox', 'pandal-ballygunge-cultural', 'pandal-tridhara-sammilani'];
    } else {
      pandalIds = ['pandal-maddox', 'pandal-ballygunge-cultural', 'pandal-ekdalia-evergreen', 'pandal-tridhara-sammilani', 'pandal-deshapriya'];
    }

    return {
      text: `Optimizing your Smart Puja Route with authentic Eclipse intelligence (${Math.round(availableTimeMinutes / 60)}h window, ${transportMode} mode, prioritizing ${priority.replace('_', ' ')}). Loading route schedule and live corridor status on your map!`,
      action: "SMART_PUJA_ROUTE",
      parameters: {
        availableTimeMinutes,
        transportMode,
        priority,
        startLocationQuery,
        pandalIds,
        addBonediBarisCount,
        removeMostCrowded,
        checkFinishBeforeTime,
        query: promptText,
      },
    };
  }

  // 5. Specific famous pandals
  const famousPandals = [
    { name: 'Maddox Square', keys: ['maddox'] },
    { name: 'Sreebhumi Sporting Club', keys: ['sreebhumi'] },
    { name: 'Santosh Mitra Square', keys: ['santosh mitra'] },
    { name: 'Deshapriya Park', keys: ['deshapriya'] },
    { name: 'College Square', keys: ['college square'] },
    { name: 'Ekdalia Evergreen', keys: ['ekdalia'] },
    { name: 'Tridhara Sammilani', keys: ['tridhara'] },
    { name: 'Bagbazar Sarbojanin', keys: ['bagbazar'] },
    { name: 'Kumartuli Park', keys: ['kumartuli'] },
  ];

  for (const fp of famousPandals) {
    if (fp.keys.some(k => p.includes(k))) {
      return {
        text: `Found ${fp.name}. Highlighting this renowned puja pandal on your map with live intelligence.`,
        action: "SEARCH_PANDALS_BY_NAME",
        parameters: { name: fp.name },
      };
    }
  }

  // 6. Default pandal discovery
  return {
    text: "Here are prominent Durga Puja pandals near your location, including live crowd alerts and metro connectivity.",
    action: "SEARCH_NEARBY_PANDALS",
    parameters: { radius: 5000, category: "pandal" },
  };
}

// --- IN-MEMORY PLACES SEARCH CACHE (API Cost Control & Performance) ---
interface PlacesCacheEntry {
  timestamp: number;
  places: any[];
}
const placesSearchCache = new Map<string, PlacesCacheEntry>();
const placesDetailsCache = new Map<string, any>();
const PLACES_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

function getPlacesCache(key: string): any[] | null {
  const entry = placesSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PLACES_CACHE_TTL_MS) {
    placesSearchCache.delete(key);
    return null;
  }
  return entry.places;
}

function setPlacesCache(key: string, places: any[]): void {
  // Cap cache size to avoid unbounded memory growth
  if (placesSearchCache.size > 200) {
    const oldestKey = placesSearchCache.keys().next().value;
    if (oldestKey) placesSearchCache.delete(oldestKey);
  }
  placesSearchCache.set(key, { timestamp: Date.now(), places });

  // Also cache individual place items by id
  for (const place of places) {
    if (place.id) {
      placesDetailsCache.set(place.id, place);
    }
  }
}

// Secure endpoint for Google Places API (New) Text Search Proxy
app.post('/api/places/search', async (req, res) => {
  const { query, location, radius, bounds, strictRestriction } = req.body;
  const gApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!gApiKey) {
    return res.json({ places: [], status: 'NO_API_KEY' });
  }

  // Generate cache key
  const locKey = location ? `${location.lat.toFixed(3)}_${location.lng.toFixed(3)}_${radius || 5000}` : 'noloc';
  const boundsKey = bounds ? `${bounds.north.toFixed(3)}_${bounds.south.toFixed(3)}_${bounds.east.toFixed(3)}_${bounds.west.toFixed(3)}` : 'nobounds';
  const cacheKey = `text_${(query || 'default').toLowerCase().trim()}_${locKey}_${boundsKey}_${!!strictRestriction}`;

  const cached = getPlacesCache(cacheKey);
  if (cached) {
    return res.json({ places: cached, status: 'OK', cached: true });
  }

  try {
    const placesUrl = 'https://places.googleapis.com/v1/places:searchText';
    const requestBody: any = {
      textQuery: query || 'Durga Puja pandal',
      maxResultCount: 20,
    };

    if (bounds && typeof bounds.north === 'number' && typeof bounds.south === 'number') {
      requestBody.locationRestriction = {
        rectangle: {
          low: {
            latitude: bounds.south,
            longitude: bounds.west,
          },
          high: {
            latitude: bounds.north,
            longitude: bounds.east,
          },
        },
      };
    } else if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      const circleObj = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: Math.min(20000, Math.max(500, radius || 3000.0)),
        },
      };

      if (strictRestriction) {
        requestBody.locationRestriction = circleObj;
      } else {
        requestBody.locationBias = circleObj;
      }
    }

    const gResponse = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': gApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.photos,places.businessStatus',
        'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      },
      body: JSON.stringify(requestBody),
    });

    if (!gResponse.ok) {
      console.warn(`[Places API] Google Places search returned status ${gResponse.status}`);
      return res.json({ places: [], status: `ERROR_${gResponse.status}` });
    }

    const data = await gResponse.json();
    const places = data.places || [];
    setPlacesCache(cacheKey, places);

    return res.json({ places, status: 'OK', cached: false });
  } catch (err: any) {
    console.warn('[Places API] Search proxy error:', err.message);
    return res.json({ places: [], status: 'NETWORK_ERROR' });
  }
});

// Secure endpoint for Google Places API (New) Nearby Search Proxy
app.post('/api/places/nearby', async (req, res) => {
  const { location, radius, includedTypes } = req.body;
  const gApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!gApiKey) {
    return res.json({ places: [], status: 'NO_API_KEY' });
  }

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ error: 'Valid location { lat, lng } is required for nearby search' });
  }

  const types = Array.isArray(includedTypes) && includedTypes.length > 0
    ? includedTypes
    : ['place_of_worship', 'tourist_attraction', 'cultural_landmark', 'community_center', 'event_venue'];

  const cacheKey = `nearby_${location.lat.toFixed(3)}_${location.lng.toFixed(3)}_${radius || 2000}_${types.join(',')}`;
  const cached = getPlacesCache(cacheKey);
  if (cached) {
    return res.json({ places: cached, status: 'OK', cached: true });
  }

  try {
    const placesUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const requestBody = {
      includedTypes: types,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: Math.min(20000, Math.max(500, radius || 2000.0)),
        },
      },
      maxResultCount: 20,
    };

    const gResponse = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': gApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.photos,places.businessStatus',
        'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      },
      body: JSON.stringify(requestBody),
    });

    if (!gResponse.ok) {
      console.warn(`[Places API] Google Places nearby search returned status ${gResponse.status}`);
      return res.json({ places: [], status: `ERROR_${gResponse.status}` });
    }

    const data = await gResponse.json();
    const places = data.places || [];
    setPlacesCache(cacheKey, places);

    return res.json({ places, status: 'OK', cached: false });
  } catch (err: any) {
    console.warn('[Places API] Nearby proxy error:', err.message);
    return res.json({ places: [], status: 'NETWORK_ERROR' });
  }
});

// Secure API endpoint for Gemini
app.post('/api/ai', async (req, res) => {
  const { messages, userLocation } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages body' });
  }

  // Check if API key / AI client is available
  if (!apiKey || !ai) {
    const classified = classifyGeminiError(new Error('GEMINI_API_KEY is not set'));
    return res.status(classified.status).json({
      error: classified.message,
      errorType: classified.type,
      status: classified.status,
    });
  }

  try {
    // Format messages for @google/genai SDK
    // The last user message contains the message, and we can append user location context
    const lastMessage = messages[messages.length - 1];
    let promptText = lastMessage.content;
    if (userLocation) {
      promptText += `\n\n[Context: The user's current GPS location is Lat: ${userLocation.lat}, Lng: ${userLocation.lng}]`;
    }

    // Call the Google Gen AI SDK with candidate models, prioritizing non-cooling models
    let response: any = null;
    let successfulModel = '';
    let lastError: any = null;

    const candidateList = [
      ...CANDIDATE_MODELS.filter((m) => !isModelCoolingDown(m)),
      ...CANDIDATE_MODELS.filter((m) => isModelCoolingDown(m)),
    ];

    for (const candidate of candidateList) {
      const isCooling = isModelCoolingDown(candidate);
      const maxAttempts = isCooling ? 1 : 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: candidate,
            contents: promptText,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
            },
          });
          successfulModel = candidate;
          break;
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code;
          const errMsg = (err?.message || '').toLowerCase();
          const isQuotaExhausted = status === 429 || errMsg.includes('resource_exhausted') || errMsg.includes('quota');
          const isHighDemand = status === 503 || errMsg.includes('high demand') || errMsg.includes('unavailable');

          if (isQuotaExhausted) {
            let delaySec = 60;
            try {
              const match = err?.message?.match(/retry in ([0-9.]+)s/i) || err?.message?.match(/retryDelay":"([0-9]+)s/i);
              if (match) delaySec = Math.max(30, Math.ceil(parseFloat(match[1])));
            } catch (_) {}
            markModelCoolingDown(candidate, 'quota_exhausted', delaySec);
            // Immediately break out to next candidate model without wasting retry attempts
            break;
          }

          if (isHighDemand) {
            console.warn(`[Gemini API] Model ${candidate} experiencing high demand (503) on attempt ${attempt}/${maxAttempts}.`);
            if (attempt < maxAttempts) {
              const jitter = 400 + Math.floor(Math.random() * 300);
              await new Promise((resolve) => setTimeout(resolve, jitter));
              continue;
            } else {
              markModelCoolingDown(candidate, 'high_demand_503', 30);
              break;
            }
          }

          console.warn(`[Gemini API] Attempt ${attempt} on model ${candidate} failed: ${err?.message || err}`);
          break;
        }
      }

      if (response) {
        break;
      }
    }

    if (!response) {
      console.warn('[Gemini API] All AI models currently unavailable due to high demand/rate limit. Activating resilient local intent fallback.');
      const fallbackData = generateFallbackIntent(promptText, userLocation);
      return res.json(fallbackData);
    }

    const rawText = response.text || '';
    
    // Parse the JSON response
    let actionData;
    try {
      actionData = JSON.parse(rawText.trim());
    } catch (parseErr) {
      // In case formatting slips up, fall back to extracting JSON using regex
      const jsonMatch = rawText.match(/({[\s\S]*?})/);
      if (jsonMatch) {
        actionData = JSON.parse(jsonMatch[1]);
      } else {
        actionData = {
          text: rawText.replace(/```json/g, '').replace(/```/g, '').trim(),
          action: "NO_ACTION",
          parameters: {}
        };
      }
    }

    res.json(actionData);
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error(`[Gemini API Route Error] [${classified.type}] ${classified.message}`);
    res.status(classified.status).json({
      error: classified.message,
      errorType: classified.type,
      status: classified.status,
    });
  }
});

// --- ECLIPSE FRIENDS REAL-TIME GROUP API ---

interface GroupMember {
  userId: string;
  displayName: string;
  avatar: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  lastUpdated: number;
  sharingEnabled: boolean;
  status: 'ACTIVE' | 'LOCATION STALE' | 'LOCATION PAUSED' | 'OFFLINE';
}

interface Group {
  id: string;
  name: string;
  createdAt: number;
  members: GroupMember[];
  meetingPoint?: { lat: number; lng: number; name?: string };
}

const groupsDb = new Map<string, Group>();

// Helper to generate a friendly invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = 'PUJA-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create Group
app.post('/api/groups', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  
  const id = generateInviteCode();
  const newGroup: Group = {
    id,
    name,
    createdAt: Date.now(),
    members: []
  };
  groupsDb.set(id, newGroup);
  console.log(`Group created: ${id} - ${name}`);
  res.status(201).json(newGroup);
});

// Get Group
app.get('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const group = groupsDb.get(id.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group session not found' });
  res.json(group);
});

// Update/Rename Group & Meeting Point
app.put('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const { name, meetingPoint } = req.body;
  const group = groupsDb.get(id.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group session not found' });

  if (name) group.name = name;
  if (meetingPoint) group.meetingPoint = meetingPoint;

  groupsDb.set(group.id, group);
  res.json(group);
});

// Join Group
app.post('/api/groups/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId, displayName, avatar, latitude, longitude, heading, speed, accuracy, sharingEnabled } = req.body;
  
  if (!userId || !displayName) {
    return res.status(400).json({ error: 'userId and displayName are required' });
  }

  const group = groupsDb.get(id.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group session not found' });

  // Check if member already in group
  const existingIdx = group.members.findIndex(m => m.userId === userId);
  const newMember: GroupMember = {
    userId,
    displayName,
    avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100',
    latitude: latitude || 22.5697,
    longitude: longitude || 88.3639,
    heading: heading || 0,
    speed: speed || 0,
    accuracy: accuracy || 10,
    lastUpdated: Date.now(),
    sharingEnabled: !!sharingEnabled,
    status: sharingEnabled ? 'ACTIVE' : 'LOCATION PAUSED'
  };

  if (existingIdx >= 0) {
    group.members[existingIdx] = newMember;
  } else {
    group.members.push(newMember);
  }

  groupsDb.set(group.id, group);
  res.json(group);
});

// Leave Group
app.post('/api/groups/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const group = groupsDb.get(id.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group session not found' });

  group.members = group.members.filter(m => m.userId !== userId);
  groupsDb.set(group.id, group);
  res.json(group);
});

// Delete/End Group
app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const deleted = groupsDb.delete(id.toUpperCase());
  if (!deleted) return res.status(404).json({ error: 'Group session not found' });
  res.json({ success: true, message: 'Group session ended successfully' });
});

// Update Member Telemetry
app.post('/api/groups/:id/telemetry', (req, res) => {
  const { id } = req.params;
  const { userId, latitude, longitude, heading, speed, accuracy, sharingEnabled, status } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const group = groupsDb.get(id.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group session not found' });

  const member = group.members.find(m => m.userId === userId);
  if (!member) {
    return res.status(404).json({ error: 'User is not a member of this group' });
  }

  member.sharingEnabled = sharingEnabled !== undefined ? sharingEnabled : member.sharingEnabled;
  if (member.sharingEnabled) {
    if (latitude !== undefined) member.latitude = latitude;
    if (longitude !== undefined) member.longitude = longitude;
    if (heading !== undefined) member.heading = heading;
    if (speed !== undefined) member.speed = speed;
    if (accuracy !== undefined) member.accuracy = accuracy;
    member.status = status || 'ACTIVE';
    member.lastUpdated = Date.now();
  } else {
    member.status = 'LOCATION PAUSED';
  }

  groupsDb.set(group.id, group);
  res.json(group);
});

// Configure Vite and static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted for development.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static handler mounted.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eclipse GPS custom server is actively running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
