import { GoogleGenAI } from '@google/genai';

// Singleton Gemini client instance
let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

const MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 30000;

/**
 * Generate text from Gemini with a system instruction and user prompt.
 * Includes timeout handling.
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const ai = getAI();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: systemInstruction
        ? { systemInstruction }
        : undefined,
    });

    return response.text ?? '';
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Gemini] Request timed out after', TIMEOUT_MS, 'ms');
      return 'Error: La solicitud al modelo de IA excedió el tiempo límite.';
    }
    console.error('[Gemini] Error generating text:', error);
    return 'Error: No se pudo generar una respuesta del modelo de IA.';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate structured JSON from Gemini.
 * Returns parsed object or null on failure.
 */
export async function generateJSON<T>(
  prompt: string,
  systemInstruction: string,
  audioBase64?: string
): Promise<T | null> {
  const ai = getAI();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const contentsObj: any[] = [{ text: prompt }];

    if (audioBase64) {
      contentsObj.push({
        inlineData: {
          data: audioBase64,
          mimeType: 'audio/ogg',
        },
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: contentsObj,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '';
    // Clean markdown code blocks if present
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    if (!cleanedText) {
      console.error('[Gemini] Empty response from model');
      return null;
    }

    return JSON.parse(cleanedText) as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Gemini] JSON request timed out after', TIMEOUT_MS, 'ms');
    } else if (error instanceof SyntaxError) {
      console.error('[Gemini] Failed to parse JSON response — model returned invalid JSON');
    } else {
      console.error('[Gemini] Error generating JSON:', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
