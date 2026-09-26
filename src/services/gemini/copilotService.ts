export interface CopilotResponse {
  text: string;
  action?: string;
  parameters?: Record<string, any>;
}

/**
 * Resolves the Copilot API endpoint with support for runtime/environment overrides.
 */
function resolveCopilotEndpoint(): string {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const customEndpoint = win.__COPILOT_API_URL__ || win.VITE_COPILOT_API_URL || win.VITE_API_URL;
    if (typeof customEndpoint === 'string' && customEndpoint.trim()) {
      return customEndpoint.trim();
    }
  }

  const envEndpoint = (
    import.meta.env.VITE_COPILOT_API_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).trim();

  if (envEndpoint) {
    return envEndpoint.endsWith('/') ? `${envEndpoint}api/ai` : `${envEndpoint}/api/ai`;
  }

  return '/api/ai';
}

/**
 * Reusable typed function to interact with the উমা এলো Copilot
 * returning structured action metadata and conversational text.
 */
export async function askEclipseCopilotStructured(
  message: string,
  userLocation?: { lat: number; lng: number }
): Promise<CopilotResponse> {
  const endpoint = resolveCopilotEndpoint();
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        userLocation,
      }),
    });
  } catch (networkError: any) {
    console.error(`Network error calling Copilot endpoint (${endpoint}):`, networkError);
    throw new Error('Copilot network failure: Unable to reach the AI server endpoint. Please verify your network connection.');
  }

  // 1. Inspect Content-Type and HTTP status before attempting JSON parsing
  const rawContentType = response.headers.get('content-type') || '';
  const isJson = rawContentType.toLowerCase().includes('application/json');

  if (!response.ok) {
    let errorDetail = `Copilot server route failure (HTTP ${response.status})`;

    if (isJson) {
      try {
        const errJson = await response.json();
        if (errJson.error) {
          errorDetail = errJson.error;
        } else if (errJson.text) {
          errorDetail = errJson.text;
        }
      } catch (_) {
        // Fallback to generic message if parsing fails
      }
    } else {
      // Non-JSON response (e.g. HTML error page or reverse proxy 404/502/503)
      try {
        const textBody = await response.text();
        if (textBody.trim().startsWith('<') || rawContentType.toLowerCase().includes('text/html')) {
          errorDetail = `Copilot server returned an unexpected HTML page (HTTP ${response.status}). The server-side AI endpoint is unreachable or misconfigured.`;
        } else if (textBody.trim().length > 0) {
          errorDetail = `Copilot server error (HTTP ${response.status}): ${textBody.slice(0, 120)}`;
        }
      } catch (_) {}
    }

    throw new Error(errorDetail);
  }

  // 2. Validate Content-Type for successful HTTP responses (catches 200 OK SPA HTML fallback in local APK WebView)
  if (!isJson) {
    let textPreview = '';
    try {
      textPreview = await response.text();
    } catch (_) {}

    const isHtml = textPreview.trim().startsWith('<') || rawContentType.toLowerCase().includes('text/html');
    if (isHtml) {
      throw new Error(
        'Copilot server returned an unexpected HTML response instead of JSON. The backend AI endpoint is unavailable in this environment (e.g. local APK WebView without server proxy).'
      );
    }

    throw new Error(
      `Copilot server returned an unexpected content type (${rawContentType || 'non-JSON'}). Expected application/json.`
    );
  }

  // 3. Safely parse JSON
  let data: any;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error('Copilot server returned an invalid JSON response payload.');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    text: data.text || 'No response text received from copilot.',
    action: data.action,
    parameters: data.parameters,
  };
}

/**
 * Reusable typed function to interact with the উমা এলো Copilot
 * using the existing secure server-side Gemini integration.
 *
 * @param message The message to send to the copilot
 * @returns The text response from Gemini
 */
export async function askEclipseCopilot(message: string): Promise<string> {
  const result = await askEclipseCopilotStructured(message);
  return result.text;
}

