/**
 * Reusable typed function to interact with the Eclipse Copilot
 * using the existing secure server-side Gemini integration.
 *
 * @param message The message to send to the copilot
 * @returns The text response from Gemini
 */
export async function askEclipseCopilot(message: string): Promise<string> {
  try {
    const response = await fetch('/api/ai', {
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const data = await response.json();
    return data.text || 'No response text received from copilot.';
  } catch (error: any) {
    console.error('Error in askEclipseCopilot:', error);
    return `Failed to connect with Eclipse Copilot. (Error: ${error.message || error})`;
  }
}
