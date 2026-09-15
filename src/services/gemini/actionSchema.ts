import { AIAction, AIActionType } from '../../types';

const VALID_ACTIONS: AIActionType[] = [
  'SEARCH_NEARBY_PANDALS',
  'SEARCH_PANDALS_BY_NAME',
  'SEARCH_PANDALS_BY_AREA',
  'SEARCH_BONEDI_BARI',
  'SEARCH_PLACES',
  'SEARCH_EVENTS',
  'SEARCH_PANDALS',
  'SHOW_NEARBY',
  'SHOW_LOCATION',
  'CREATE_ROUTE',
  'OPTIMIZE_ROUTE',
  'SMART_PUJA_ROUTE',
  'NAVIGATE_TO',
  'UPDATE_ROUTE',
  'SAVE_LOCATION',
  'REMOVE_SAVED_LOCATION',
  'GET_PLACE_DETAILS',
  'GET_EVENT_DETAILS',
  'SHOW_ALERTS',
  'NO_ACTION',
];

export function validateAIAction(rawResponse: string): { text: string; action: AIAction } {
  let cleanText = '';
  let parsedAction: Partial<AIAction> = { type: 'NO_ACTION', parameters: {} };

  try {
    // Try to parse the entire response as JSON
    const data = JSON.parse(rawResponse);
    if (data.action && VALID_ACTIONS.includes(data.action)) {
      parsedAction.type = data.action;
      parsedAction.parameters = data.parameters || {};
      cleanText = data.text || `Executing ${data.action} action.`;
    } else if (VALID_ACTIONS.includes(data.type)) {
      parsedAction.type = data.type;
      parsedAction.parameters = data.parameters || {};
      cleanText = data.content || data.text || `Executing ${data.type} action.`;
    } else {
      // JSON parsed but not a valid action structure
      cleanText = data.text || data.message || rawResponse;
    }
  } catch (e) {
    // Not a direct JSON response, try searching for a JSON block ```json ... ``` or { ... }
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/({[\s\S]*?})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.action && VALID_ACTIONS.includes(data.action)) {
          parsedAction.type = data.action;
          parsedAction.parameters = data.parameters || {};
          cleanText = data.text || `Executing ${data.action} action.`;
        } else if (VALID_ACTIONS.includes(data.type)) {
          parsedAction.type = data.type;
          parsedAction.parameters = data.parameters || {};
          cleanText = data.content || data.text || `Executing ${data.type} action.`;
        } else {
          cleanText = rawResponse;
        }
      } catch (innerError) {
        cleanText = rawResponse;
      }
    } else {
      // Just plain text
      cleanText = rawResponse;
    }
  }

  // Ensure type is 100% valid
  const finalType = VALID_ACTIONS.includes(parsedAction.type as AIActionType)
    ? (parsedAction.type as AIActionType)
    : 'NO_ACTION';

  return {
    text: cleanText,
    action: {
      type: finalType,
      parameters: parsedAction.parameters || {},
    },
  };
}
