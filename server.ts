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
const rawModelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const modelName = rawModelName.startsWith('models/') ? rawModelName.substring(7) : rawModelName;

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
  console.log(`Gemini API Initialized securely on server with model: ${modelName}`);
} else {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set. AI features will run in sandbox mode.');
}

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
    "category": "category filter if applicable",
    "locationName": "name of a place",
    "itemId": "id of a pandal/event if applicable",
    "radius": 5000,
    "pandalIds": ["pandal-1", "pandal-2", ...]
  }
}

You support the following validated ACTION_TYPE values. You must select the single most appropriate action based on the user's message:
- SEARCH_PLACES: Search for generic addresses, shops, landmarks, or restaurants. (Parameters: query)
- SEARCH_EVENTS: Search for festivals, concerts, sports, fairs, or local events. (Parameters: query)
- SEARCH_PANDALS: Search specifically for Durga Puja pandals. (Parameters: query)
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

Here is your knowledge of the local area and the database of Kolkata Durga Puja Pandals:
1. Sreebhumi Sporting Club (id: "pandal-1", Theme: Vatican City St. Peter's Basilica, Address: Lake Town, Crowd: EXTREME)
2. Santosh Mitra Square (id: "pandal-2", Theme: The Golden Temple of Amritsar, Address: Bowbazar, Crowd: HEAVY)
3. Maddox Square (id: "pandal-3", Theme: Traditional Sabeki Puja, Address: Ballygunge, Crowd: MODERATE)
4. Ballygunge Cultural Association (id: "pandal-4", Theme: Sustainable Clay and Terracotta, Address: Ballygunge, Crowd: LOW)
5. Chetla Agrani Club (id: "pandal-5", Theme: Inner Peace and Ancient Mantras, Address: Chetla, Crowd: HEAVY)
6. College Square (id: "pandal-6", Theme: Palace of illumination, Address: College Street, Crowd: EXTREME)

Other generic events:
1. Kolkata International Book Fair (id: "event-1", Fair, Location: Salt Lake)
2. KKR vs MI Cricket Match at Eden Gardens (id: "event-2", Sports, Location: Maidan)
3. Kolkata Jazz Fest 2026 (id: "event-3", Concert, Location: Mohor Kunj)
4. Science City Robotics Exhibition (id: "event-4", Exhibition, Location: Science City)
5. Victoria Memorial Hall (id: "event-5", Landmark, Location: Maidan)

If the user asks for a trip plan (e.g. "I have 5 hours tonight. Find 7 Durga Puja pandals. Avoid extreme crowds and minimize travel."), choose appropriate locations, explain your reasoning in the "text" field, and return an 'OPTIMIZE_ROUTE' action containing the pandalIds (e.g., ["pandal-4", "pandal-3", "pandal-5", "pandal-2"]) so the application's TSP routing engine can calculate the actual road geometry and optimize it!

If the user mentions "Take me to Sreebhumi" or "navigate to Santosh Mitra", output 'NAVIGATE_TO' with the correct itemId.
`;

// Secure API endpoint for Gemini
app.post('/api/ai', async (req, res) => {
  const { messages, userLocation } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages body' });
  }

  // Fallback if API key is not configured
  if (!ai) {
    // Generate simulated AI action responses to ensure full app works perfectly in sandbox/preview
    const userMessage = messages[messages.length - 1]?.content || '';
    const lowerMessage = userMessage.toLowerCase();
    
    let mockResponse = {
      text: "I am running in Sandbox Mode because no Gemini API key is active. Here is a simulated response.",
      action: "NO_ACTION",
      parameters: {} as any
    };

    if (lowerMessage.includes('pandal') || lowerMessage.includes('puja')) {
      mockResponse = {
        text: "I've searched for Durga Puja pandals around Kolkata and plotted them on your interactive map.",
        action: "SEARCH_PANDALS",
        parameters: { query: "Durga Puja" }
      };
    } else if (lowerMessage.includes('event')) {
      mockResponse = {
        text: "I've discovered several concerts and fairs in Kolkata! They have been highlighted on the map.",
        action: "SEARCH_EVENTS",
        parameters: { query: "events" }
      };
    } else if (lowerMessage.includes('navigate') || lowerMessage.includes('take me')) {
      mockResponse = {
        text: "Starting live navigation routing to Sreebhumi Sporting Club. Road calculation completed.",
        action: "NAVIGATE_TO",
        parameters: { itemId: "pandal-1", locationName: "Sreebhumi Sporting Club" }
      };
    } else if (lowerMessage.includes('plan') || lowerMessage.includes('route') || lowerMessage.includes('trip')) {
      mockResponse = {
        text: "I have structured an optimized route bypassing extreme crowd zones. We will visit Chetla Agrani, Maddox Square, and Ballygunge Cultural.",
        action: "OPTIMIZE_ROUTE",
        parameters: { pandalIds: ["pandal-5", "pandal-3", "pandal-4"] }
      };
    } else if (lowerMessage.includes('save')) {
      mockResponse = {
        text: "Adding Chetla Agrani Club to your saved places.",
        action: "SAVE_LOCATION",
        parameters: { itemId: "pandal-5" }
      };
    } else if (lowerMessage.includes('near me') || lowerMessage.includes('nearby')) {
      mockResponse = {
        text: "Scanning radius for events, pandals, and parking lots near your current coordinates.",
        action: "SHOW_NEARBY",
        parameters: { radius: 3000 }
      };
    }

    return res.json(mockResponse);
  }

  try {
    // Format messages for @google/genai SDK
    // The last user message contains the message, and we can append user location context
    const lastMessage = messages[messages.length - 1];
    let promptText = lastMessage.content;
    if (userLocation) {
      promptText += `\n\n[Context: The user's current GPS location is Lat: ${userLocation.lat}, Lng: ${userLocation.lng}]`;
    }

    // Call the Google Gen AI SDK
    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

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
        throw new Error('Could not parse Gemini output as JSON: ' + rawText);
      }
    }

    res.json(actionData);
  } catch (error: any) {
    console.error('Gemini API execution error:', error);
    res.status(500).json({
      error: 'Failed to execute Gemini AI model: ' + error.message,
      text: "I encountered an issue processing that request. Let's try again in a moment.",
      action: "NO_ACTION",
      parameters: {},
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
