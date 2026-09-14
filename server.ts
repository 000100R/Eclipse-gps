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
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
  ])
);

// Quota exhaustion cooldown cache to avoid repeated failed calls on exhausted models
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

function markModelExhausted(model: string, retryDelaySeconds = 60) {
  modelCooldowns.set(model, Date.now() + retryDelaySeconds * 1000);
  console.warn(`[Gemini API] Model ${model} quota exhausted. Cooldown set for ${retryDelaySeconds}s.`);
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
        markModelExhausted(candidate, delaySec);
      }
    }
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
    "pandalIds": ["pandal-1", "pandal-2", ...]
  }
}

You support the following validated ACTION_TYPE values. You must select the single most appropriate action based on the user's message:
- SEARCH_NEARBY_PANDALS: Use when the user asks for pandals around them, e.g. "Find nearby pandals", "Show pandals near me", "What pandals are around me?", "Show all nearby Durga Puja pandals". (Parameters: radius: 5000, category: "pandal")
- SEARCH_PANDALS_BY_NAME: Use when the user searches for a specific pandal by name, e.g. "Find Maddox Square", "Show Maddox Square on the map", "Show Deshapriya Park", "Find Sreebhumi". (Parameters: name, query)
- SEARCH_PANDALS_BY_AREA: Use when the user asks for pandals in a specific neighborhood or zone, e.g. "Find pandals near Salt Lake", "Show pandals around Ballygunge", "Show all pandals around South Kolkata", "Pandals in Behala". (Parameters: area, query)
- SEARCH_PLACES: Search for generic addresses, shops, landmarks, or restaurants. (Parameters: query)
- SEARCH_EVENTS: Search for festivals, concerts, sports, fairs, or local events. (Parameters: query)
- SEARCH_PANDALS: Search generally for Durga Puja pandals. (Parameters: query)
- SHOW_NEARBY: Show points of interest, events, or places near the user. (Parameters: radius, category)
- SHOW_LOCATION: Fly to or display a specific place on the map. (Parameters: itemId, locationName)
- CREATE_ROUTE: Create a direct route. (Parameters: origin, destination, waypoints)
- OPTIMIZE_ROUTE: Plan and optimize a multi-stop route through selected pandals/events. (Parameters: pandalIds)
- NAVIGATE_TO: Turn on navigation mode to a destination. (Parameters: itemId, locationName)
- SAVE_LOCATION: Save a place or pandal to the saved list. (Parameters: itemId)
- REMOVE_SAVED_LOCATION: Remove a location from the saved list. (Parameters: itemId)
- GET_PLACE_DETAILS: Inspect details of a place. (Parameters: itemId)
- GET_EVENT_DETAILS: Inspect details of an event or pandal. (Parameters: itemId)
- SHOW_ALERTS: View active warnings or crowd alerts. (Parameters: query)
- NO_ACTION: When the user asks a general informational question or makes chit-chat that doesn't trigger map adjustments. (Parameters: query)

IMPORTANT DIRECTIVE FOR PANDAL DISCOVERY:
You determine user intent and select the appropriate action. You must NEVER fabricate pandal names, fake coordinates, or hallucinated addresses.
The application's high-precision Pandal Discovery Engine, Google Places integration, and verified Kolkata database will execute the actual search, verify coordinates, render markers on the map, and display interactive cards.
In your "text" field, provide a polite, natural confirmation of the search you are executing.

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
`;

// Secure endpoint for Google Places API (New) Search Proxy
app.post('/api/places/search', async (req, res) => {
  const { query, location, radius } = req.body;
  const gApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!gApiKey) {
    return res.json({ places: [], status: 'NO_API_KEY' });
  }

  try {
    const placesUrl = 'https://places.googleapis.com/v1/places:searchText';
    const requestBody: any = {
      textQuery: query || 'Durga Puja pandal',
    };

    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius || 5000.0,
        },
      };
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
    return res.json({ places: data.places || [], status: 'OK' });
  } catch (err: any) {
    console.warn('[Places API] Search proxy error:', err.message);
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
            markModelExhausted(candidate, delaySec);
            // Immediately break out to next candidate model without wasting retry attempts
            break;
          }

          console.warn(`[Gemini API] Attempt ${attempt} on model ${candidate} failed: ${err?.message || err}`);
          if (isHighDemand && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          } else {
            break;
          }
        }
      }

      if (response) {
        break;
      }
    }

    if (!response) {
      throw lastError || new Error('All candidate Gemini models failed to respond.');
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
