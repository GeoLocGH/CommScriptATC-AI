

// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { ReadbackFeedback } from "../types";

// --- Audio Decoding/Encoding Helpers ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getApiKey = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable not set");
  }
  return apiKey;
};

// --- Gemini API Service ---

export const generateReadback = async (transcription: string, callsign: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `You are an expert pilot assistant responsible for generating accurate read-backs. 
  Given the following Air Traffic Control instruction, generate the correct, concise, and standard pilot read-back confirmation.
  Include the aircraft callsign '${callsign}' in the read-back.

  ATC Instruction: "${transcription}"

  Pilot Read-back:`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating readback:", error);
    return "Error: Could not generate readback.";
  }
};

export const checkReadbackAccuracy = async (atcInstruction: string, pilotReadback: string): Promise<ReadbackFeedback> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `You are an expert Certified Flight Instructor (CFI) specializing in radio communications. Your task is to provide a detailed analysis of a pilot's read-back of an Air Traffic Control (ATC) instruction.

  **Instructions:**
  1.  **Compare** the pilot's read-back to the original ATC instruction.
  2.  **Determine** if the read-back is 'CORRECT' or 'INCORRECT'.
  3.  **Provide a concise one-sentence summary** of your feedback.
  4.  **If incorrect**, provide detailed feedback explaining each error (missing info, wrong numbers, non-standard phraseology).
  5.  **If incorrect**, provide the 100% correct phraseology for the read-back.
  6.  **If incorrect**, briefly explain common pitfalls that lead to this type of error.
  7.  **If incorrect**, suggest further reading, like a relevant section of the Aeronautical Information Manual (AIM).
  8.  **If correct**, the feedback summary must be "Read-back is correct." and all other feedback fields should be omitted.

  **Original ATC Instruction:**
  "${atcInstruction}"

  **Pilot's Read-back:**
  "${pilotReadback}"
  `;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
        accuracy: { type: Type.STRING, enum: ['CORRECT', 'INCORRECT'] },
        feedbackSummary: { type: Type.STRING, description: 'A one-sentence summary of the feedback.' },
        detailedFeedback: { type: Type.STRING, description: 'A detailed explanation of any errors.' },
        correctPhraseology: { type: Type.STRING, description: 'The 100% correct version of the read-back.' },
        commonPitfalls: { type: Type.STRING, description: 'Common reasons pilots make this kind of error.' },
        furtherReading: { type: Type.STRING, description: 'A suggestion for further study, e.g., "AIM 4-2-3".' }
    },
    required: ['accuracy', 'feedbackSummary'],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 32768 }
      },
    });
    
    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Error checking readback accuracy:", error);
    return {
      accuracy: 'INCORRECT',
      feedbackSummary: 'Could not verify read-back accuracy at this time.',
    };
  }
};


export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // A clear, professional voice
          },
        },
      },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // @ts-ignore
      const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const decodedBytes = decode(base64Audio);
      return await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
    }
    return null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

// Fix: Remove explicit return type Promise<LiveSession> to allow for type inference.
export const connectToLive = (
  onTranscriptionUpdate: (text: string, isFinal: boolean) => void,
  onError: (error: any) => void
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log('Live session opened.'),
            onmessage: (message: LiveServerMessage) => {
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    const isFinal = !!message.serverContent.turnComplete;
                    onTranscriptionUpdate(text, isFinal);
                }
            },
            onerror: (e) => {
                console.error('Live session error:', e);
                onError(e);
            },
            onclose: (e) => {
                console.log('Live session closed.');
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            systemInstruction: 'You are a live transcriber for Air Traffic Control communications. Focus on accurately transcribing spoken instructions for pilots, including callsigns, headings, altitudes, frequencies, and clearances.',
        },
    });
};