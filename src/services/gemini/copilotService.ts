export interface CopilotResponse {
  text: string;
  action?: string;
  parameters?: Record<string, any>;
}

/**
 * Reusable typed function to interact with the Eclipse Copilot
 * returning structured action metadata and conversational text.
 */
export async function askEclipseCopilotStructured(
  message: string,
  userLocation?: { lat: number; lng: number }
): Promise<CopilotResponse> {
  let response: Response;
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    console.error('Network error calling /api/ai:', networkError);
    throw new Error('Gemini network/API failure: Unable to connect to server endpoint.');
  }

  if (!response.ok) {
    let errorDetail = `Gemini server/API route failure (HTTP ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorDetail = errJson.error;
      } else if (errJson.text) {
        errorDetail = errJson.text;
      }
    } catch (_) {
      // Non-JSON response
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
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
 * Reusable typed function to interact with the Eclipse Copilot
 * using the existing secure server-side Gemini integration.
 *
 * @param message The message to send to the copilot
 * @returns The text response from Gemini
 */
export async function askEclipseCopilot(message: string): Promise<string> {
  const result = await askEclipseCopilotStructured(message);
  return result.text;
}

