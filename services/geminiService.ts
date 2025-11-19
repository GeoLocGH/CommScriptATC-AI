// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { ReadbackFeedback, LanguageCode, SUPPORTED_LANGUAGES, PilotVoiceName, AtcVoiceName, ConversationEntry } from "../types";

// --- Audio Decoding/Encoding Helpers ---

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
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

const formatHistoryForPrompt = (history: ConversationEntry[]): string => {
    if (!history || history.length === 0) {
        return "No recent communication history.";
    }
    // Take the last 4 entries to keep the context relevant and the prompt concise
    return history
        .slice(-4)
        .map(entry => `${entry.speaker}: ${entry.text}`)
        .join('\n');
};

// --- Gemini API Service ---

export const generateReadback = async (transcription: string, callsign: string, language: LanguageCode, history: ConversationEntry[]): Promise<{ primary: string, alternatives: string[], confidence: number }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  const prompt = `You are an expert pilot assistant responsible for generating accurate read-backs.
  Given the following Air Traffic Control (ATC) instruction in ${languageName}, your task is to generate the most standard, correct pilot read-back, a few alternatives, and a confidence score.

  **Recent Communication History (for context):**
  ${formatHistoryForPrompt(history)}

  **Instructions:**
  1.  Generate a \`primary\` read-back. This should be the most common, by-the-book phraseology.
  2.  Generate an array of \`alternatives\`. These should be other ways a pilot might correctly respond. If there are no common alternatives, provide an empty array.
  3.  Generate a \`confidence\` score (a number between 0.0 and 1.0) representing your certainty that the primary read-back is the most standard and correct phraseology for the given instruction.
  4.  Both the primary and alternative read-backs must include the aircraft callsign '${callsign}'.
  5.  All responses must be in ${languageName}.

  **Current ATC Instruction:**
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
      confidence: {
        type: Type.NUMBER,
        description: "A score from 0.0 to 1.0 indicating confidence in the primary read-back.",
      }
    },
    required: ['primary', 'alternatives', 'confidence'],
  };

  try {
    const response = await ai.models.generateContent({
      // Fix: Use recommended model for complex text tasks.
      model: 'gemini-3-pro-preview',
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
      confidence: 0,
    };
  }
};

export const extractCallsign = async (transcription: string, language: LanguageCode, history: ConversationEntry[]): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    const prompt = `You are an expert aviation communications analyst. Your task is to analyze the following Air Traffic Control (ATC) transcription in ${languageName} and extract the **AIRCRAFT** callsign with high accuracy.

      **Analysis Guidelines:**
      1.  **Identify the Aircraft Callsign:** Look for any mention of an aircraft callsign. This could be a full callsign, a partial callsign, or an airline identifier.
      2.  **Differentiate from ATC Callsigns:** Your primary task is to find the **AIRCRAFT** callsign. ATC transmissions will contain their own callsign (e.g., 'Boston Tower', 'Logan Ground', 'KBOS Approach'). Do **NOT** extract these. Focus only on the identifier of the aircraft being addressed.
      3.  **Handle Variations:** Be prepared for common variations:
          *   **Mixed Numerics/Phonetics:** The callsign might be spoken with digits instead of phonetic words (e.g., "November 123 Alpha Bravo" instead of "November One Two Three Alpha Bravo").
          *   **Abbreviations:** An established callsign might be abbreviated later in a conversation (e.g., "November Alpha Bravo" for "November-One-Two-Three-Alpha-Bravo"). Use the communication history to identify these.
          *   **Airline Callsigns:** Recognize airline names like "Skywest", "Delta", "United".
      4.  **Standardize the Output:** Regardless of how the callsign is spoken, you **MUST** convert it to the standard ICAO phonetic alphabet format, with words separated by hyphens.
          *   Example Input: "N123AB" -> Output: "November-One-Two-Three-Alpha-Bravo"
          *   Example Input: "Skywest 345" -> Output: "Skywest-Three-Four-Five"
      5.  **Use Context:** Refer to the "Recent Communication History" to resolve ambiguities or confirm partial callsigns. If a callsign was "Skyhawk 123AB" before, and now you hear "Skyhawk 3AB", you can confidently identify it.
      6.  **Return Null if Ambiguous:** If no aircraft callsign is clearly identifiable, or if it is too ambiguous to determine, return null.

      **Recent Communication History (for context):**
      ${formatHistoryForPrompt(history)}

      **Current ATC Transcription:**
      "${transcription}"
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
        // Fix: Use recommended model for complex text tasks.
        model: 'gemini-3-pro-preview',
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

export const checkReadbackAccuracy = async (
  atcInstruction: string,
  pilotReadback: string,
  language: LanguageCode,
  history: ConversationEntry[],
  expectedReadback?: string
): Promise<ReadbackFeedback> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  
  const mainTaskPrompt = expectedReadback
    ? `Your task is to provide a detailed analysis comparing the "Pilot's Read-back" to the "Expected Read-back". The "Original ATC Instruction" is provided for context.`
    : `Your task is to provide a detailed, "fuzzy" analysis of a pilot's read-back of an Air Traffic Control (ATC) instruction, focusing on semantic and numerical correctness rather than a strict word-for-word match.`;
  
  const expectedReadbackSection = expectedReadback 
    ? `**Expected Read-back (Ground Truth):**
"${expectedReadback}"
` 
    : '';

  const prompt = `You are an expert Certified Flight Instructor (CFI) specializing in radio communications. ${mainTaskPrompt} Both are in ${languageName}.

  **Primary Goal:**
  Determine if the read-back is operationally 'CORRECT' or 'INCORRECT'. A read-back is only 'CORRECT' if all critical information from the ATC instruction is repeated accurately, as reflected in the expected read-back. Use the conversation history to understand the context.

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
  4.  **Calculate Accuracy Score:** Provide a numerical \`accuracyScore\` from 0.0 to 1.0. This score should reflect the overall semantic and numerical correctness. It is NOT a simple word match percentage. A read-back with a wrong altitude must have a low score, even if all other words are correct.

  **Recent Communication History (for context):**
  ${formatHistoryForPrompt(history)}

  **Output Requirements:**
  - Provide a 'CORRECT' or 'INCORRECT' \`accuracy\` rating.
  - Provide a numerical \`accuracyScore\` from 0.0 to 1.0.
  - Provide a concise \`feedbackSummary\`.
  - If the \`accuracy\` is 'INCORRECT', you **MUST** provide actionable \`detailedFeedback\`, the complete \`correctPhraseology\` (which should be the provided "Expected Read-back" if available), a list of \`commonPitfalls\` that lead to such errors, and a specific \`furtherReading\` reference. These fields are critical for user learning and are not optional.
  - **ALWAYS** provide a \`phraseAnalysis\` array.

  **Original ATC Instruction:**
  "${atcInstruction}"
  
  ${expectedReadbackSection}

  **Pilot's Read-back:**
  "${pilotReadback}"
  `;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
        accuracy: { type: Type.STRING, enum: ['CORRECT', 'INCORRECT'] },
        accuracyScore: { type: Type.NUMBER, description: "A numerical score from 0.0 to 1.0 for the read-back's correctness." },
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
    required: ['accuracy', 'accuracyScore', 'feedbackSummary', 'phraseAnalysis'],
  };

  try {
    const response = await ai.models.generateContent({
      // Fix: Use recommended model for complex text tasks.
      model: 'gemini-3-pro-preview',
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
      accuracyScore: 0,
      feedbackSummary: 'Could not verify read-back accuracy at this time.',
      phraseAnalysis: [],
    };
  }
};


export const generateSpeech = async (text: string, voiceName: PilotVoiceName | AtcVoiceName): Promise<Uint8Array | null> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return decode(base64Audio);
    }
    return null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

// Fix: Remove explicit return type Promise<LiveSession> to allow for type inference.
export const connectToLive = (
  onInterimTranscription: (text: string, confidence?: number) => void,
  onFinalTranscription: (text: string, confidence?: number) => void,
  onError: (error: any) => void,
  language: LanguageCode,
  mode: 'atc' | 'pilot' = 'atc'
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    const systemInstruction = mode === 'atc'
        ? `You are an expert Air Traffic Control radio transcriber. Your sole function is to accurately transcribe ATC communications in ${languageName}. Do not generate conversational responses. Your transcription must be as precise as possible, capturing the specialized language of aviation.

**Key Transcription Guidelines:**
1.  **Numbers are Critical:** Transcribe all numbers with extreme accuracy, as they represent altitudes, headings, frequencies, and squawk codes.
2.  **Phonetic Alphabet:** Recognize and correctly spell out the full ICAO phonetic alphabet (e.g., Alpha, Bravo, Charlie, Delta, Echo...).
3.  **Aviation Number Pronunciation:** Correctly interpret and transcribe non-standard number pronunciations:
    *   "tree" for "three"
    *   "fife" for "five"
    *   "niner" for "nine"
    *   "one hundred" for altitudes like "one zero zero".
4.  **Common Aviation Jargon & Acronyms:** Be prepared to transcribe the following terms and more:
    *   "squawk", "ident", "standby"
    *   "SID" (Standard Instrument Departure), "STAR" (Standard Terminal Arrival Route)
    *   "VFR" (Visual Flight Rules), "IFR" (Instrument Flight Rules)
    *   "cleared for the option", "cleared direct", "cleared ILS approach"
    *   "report", "say again", "read back"
    *   "flight level", "maintain", "descend", "climb"
    *   "QNH", "altimeter", "transition level"
    *   "holding short", "line up and wait", "cleared for takeoff/landing"
    *   "go around", "vectors", "resume own navigation"
    *   "traffic", "runway incursion"
    *   "Roger", "Wilco", "Affirm", "Negative"

Do not add any commentary. Only provide the clean transcription.`
        : `You are an expert pilot radio transcriber. Your sole function is to accurately transcribe a pilot's read-back of an ATC instruction in ${languageName}. Do not generate conversational responses. Pay close attention to aviation-specific phraseology, especially the pilot's callsign and the precise repetition of clearances, altitudes, and headings.`;

    let accumulatedText = '';
    let lastConfidence: number | undefined;

    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log('Live session opened.'),
            onmessage: (message: LiveServerMessage) => {
                if (message.serverContent?.inputTranscription) {
                    const textChunk = message.serverContent.inputTranscription.text;
                    const confidence = message.serverContent.inputTranscription.confidence;
                    
                    if (textChunk) {
                        const separator = accumulatedText ? ' ' : '';
                        accumulatedText += separator + textChunk;
                        lastConfidence = confidence;
                        onInterimTranscription(accumulatedText, confidence);
                    }
                }
                
                if (message.serverContent?.turnComplete) {
                    onFinalTranscription(accumulatedText, lastConfidence);
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
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: systemInstruction,
        },
    });
};