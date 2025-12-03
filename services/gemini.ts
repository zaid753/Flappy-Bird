import { GoogleGenAI, Modality } from "@google/genai";

// Audio constants
const AUDIO_SAMPLE_RATE = 24000;

export interface GeneratedAsset {
  data: string; // Base64 or Blob URL
  type: 'image' | 'audio';
}

/**
 * Decodes a base64 string (raw PCM) into an AudioBuffer.
 * Gemini output is typically 24kHz, 1 channel, PCM 16-bit.
 */
export const decodeGeminiAudio = async (base64Audio: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert Int16 PCM to Float32
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length;
  const buffer = audioContext.createBuffer(1, frameCount, AUDIO_SAMPLE_RATE);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Normalize 16-bit signed integer (-32768 to 32767) to float (-1.0 to 1.0)
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
};

export const generateImage = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData && part.inlineData.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateSoundEffect = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Using TTS model as a reliable fallback for sound effects to avoid 404s on experimental audio models.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: {
      parts: [{ text: `Say the word ${prompt} with an excited tone.` }] 
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio generated");
  }

  return base64Audio;
};