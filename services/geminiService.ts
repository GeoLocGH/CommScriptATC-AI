// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { ReadbackFeedback, LanguageCode, SUPPORTED_LANGUAGES } from "../types";

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

export const generateReadback = async (transcription: string, callsign: string, language: LanguageCode): Promise<{ primary: string, alternatives: string[] }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  const prompt = `You are an expert pilot assistant responsible for generating accurate read-backs.
  Given the following Air Traffic Control (ATC) instruction in ${languageName}, your task is to generate the most standard, correct pilot read-back, as well as a few other common, equally correct alternative phraseologies.

  **Instructions:**
  1.  Generate a \`primary\` read-back. This should be the most common, by-the-book phraseology.
  2.  Generate an array of \`alternatives\`. These should be other ways a pilot might correctly respond. They should be distinct from the primary read-back and from each other. If there are no common alternatives, provide an empty array.
  3.  Both the primary and alternative read-backs must include the aircraft callsign '${callsign}'.
  4.  All responses must be in ${languageName}.

  **ATC Instruction:**
  "${transcription}"
  `;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      primary: {
        type: Type.STRING,
        description: "The most standard, correct pilot read-back.",
      },
      alternatives: {
        type: Type.ARRAY,
        description: "An array of other common, correct alternative phraseologies.",
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ['primary', 'alternatives'],
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
    console.error("Error generating readback:", error);
    // Fallback in case of error
    return {
      primary: "Error: Could not generate readback.",
      alternatives: [],
    };
  }
};

export const extractCallsign = async (transcription: string, language: LanguageCode): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    const prompt = `
      Analyze the following Air Traffic Control (ATC) transcription in ${languageName}.
      Your task is to identify and extract the full aircraft callsign.
      - The callsign should be returned in phonetic alphabet format, with words separated by hyphens (e.g., "November-One-Two-Three-Alpha-Bravo", "Skywest-Three-Four-Five").
      - If a clear aircraft callsign is present, extract it.
      - If no callsign is mentioned, or if it's ambiguous, return null.
  
      ATC Transcription: "${transcription}"
    `;
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
          callsign: { 
              type: Type.STRING, 
              description: 'The extracted callsign in hyphenated phonetic format, or null if not found.',
          }
      },
      required: ['callsign'],
    };
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.0,
        },
      });
      
      const result = JSON.parse(response.text);
      // The schema returns a JSON object like {"callsign": null} or {"callsign": "..."}
      return result.callsign; 
    } catch (error) {
      console.error("Error extracting callsign:", error);
      return null; // Return null on error to avoid breaking the flow
    }
  };

export const checkReadbackAccuracy = async (atcInstruction: string, pilotReadback: string, language: LanguageCode): Promise<ReadbackFeedback> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  const prompt = `You are an expert Certified Flight Instructor (CFI) specializing in radio communications. Your task is to provide a detailed, "fuzzy" analysis of a pilot's read-back of an Air Traffic Control (ATC) instruction, focusing on semantic and numerical correctness rather than a strict word-for-word match. Both the instruction and the read-back are in ${languageName}.

  **Primary Goal:**
  Determine if the read-back is operationally 'CORRECT' or 'INCORRECT'. A read-back is only 'CORRECT' if all critical information is repeated accurately.

  **Analysis Guidelines:**
  1.  **Strict on Critical Data:** Altitudes, headings, frequencies, squawk codes, clearances (e.g., "cleared for takeoff"), and runway numbers MUST be read back precisely. Any deviation, omission, or addition of these critical elements makes the entire read-back 'INCORRECT'.
  2.  **Tolerate Minor Variations:** Accept minor, safe deviations that do not change the core instruction. This includes:
      *   Benign fillers ('uh', 'okay', 'roger').
      *   Reordering of non-sequential instructions (e.g., "climb and maintain" vs. "maintain and climb").
      *   Substituting words with safe synonyms (e.g., "report on final" vs. "call me on final").
      *   Omitting conversational pleasantries (e.g., "good day").
  3.  **Phrase-by-Phrase Analysis:** Break down the pilot's read-back into its core semantic components (e.g., callsign, action, altitude, frequency). For each component, categorize its status and provide a brief explanation if it's not perfect.
      *   \`correct\`: The component is a perfect or near-perfect match of the instruction.
      *   \`acceptable_variation\`: The component is not a word-for-word match but is operationally correct and safe (e.g., includes a filler word).
      *   \`incorrect\`: The component contains a significant error (wrong number, wrong command) or is missing.

  **Output Requirements:**
  - Provide a 'CORRECT' or 'INCORRECT' \`accuracy\` rating.
  - Provide a concise \`feedbackSummary\`.
  - If the \`accuracy\` is 'INCORRECT', you **MUST** provide actionable \`detailedFeedback\`, the complete \`correctPhraseology\`, a list of \`commonPitfalls\` that lead to such errors (e.g., auditory confusion, memory load), and a specific \`furtherReading\` reference (e.g., a relevant section of the Aeronautical Information Manual or equivalent document for the given language). These fields are critical for user learning and are not optional.
  - **ALWAYS** provide a \`phraseAnalysis\` array breaking down the pilot's read-back.

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
        phraseAnalysis: {
            type: Type.ARRAY,
            description: "A breakdown of the pilot's read-back.",
            items: {
                type: Type.OBJECT,
                properties: {
                    phrase: { type: Type.STRING, description: "A segment of the pilot's read-back." },
                    status: { type: Type.STRING, enum: ['correct', 'acceptable_variation', 'incorrect'] },
                    explanation: { type: Type.STRING, description: "A brief explanation for 'incorrect' or 'acceptable_variation' statuses." }
                },
                required: ['phrase', 'status']
            }
        },
        commonPitfalls: { type: Type.STRING, description: 'Common reasons pilots make this kind of error.' },
        furtherReading: { type: Type.STRING, description: 'A suggestion for further study, e.g., "AIM 4-2-3".' }
    },
    required: ['accuracy', 'feedbackSummary', 'phraseAnalysis'],
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
      phraseAnalysis: [],
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
  onTranscriptionUpdate: (text: string, isFinal: boolean, confidence?: number) => void,
  onError: (error: any) => void,
  language: LanguageCode
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log('Live session opened.'),
            onmessage: (message: LiveServerMessage) => {
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    const confidence = message.serverContent.inputTranscription.confidence;
                    const isFinal = !!message.serverContent.turnComplete;
                    onTranscriptionUpdate(text, isFinal, confidence);
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
            inputAudioTranscription: { languageCodes: [language] },
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
        },
    });
};