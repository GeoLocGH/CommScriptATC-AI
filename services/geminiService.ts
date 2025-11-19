import { GoogleGenAI, Modality, Type, LiveServerMessage, SchemaType } from "@google/genai";
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
    console.error("API_KEY is missing in process.env");
    throw new Error("API_KEY is missing");
  }
  return apiKey;
};

export async function generateReadback(
  atcText: string, 
  callsign: string, 
  language: LanguageCode = 'en-US',
  history: ConversationEntry[] = []
): Promise<{ primary: string; alternatives: string[], confidence: number }> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const historyText = history.map(h => `${h.speaker}: ${h.text}`).join('\n');

  const prompt = `
    You are an expert airline pilot.
    Task: specific pilot read-back for the following ATC instruction.
    Context History:
    ${historyText}

    Current ATC Instruction: "${atcText}"
    Your Callsign: "${callsign}"
    Language: ${SUPPORTED_LANGUAGES[language]}

    Rules:
    1. STRICTLY follow ICAO/FAA standard phraseology.
    2. Include ONLY the read-back. No conversational filler.
    3. End with the callsign.
    4. If the instruction contains numbers (headings, altitudes, frequencies), they MUST be read back exactly.
    5. If the instruction is a question or traffic advisory, answer appropriately.
    6. Calculate a confidence score (0.0 to 1.0) representing your certainty that this is the correct standard phraseology.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          readback: { type: Type.STRING },
          alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" }
        },
        required: ["readback", "alternatives", "confidence"]
      }
    }
  });

  const json = JSON.parse(response.text || '{}');
  return {
    primary: json.readback || "Say again?",
    alternatives: json.alternatives || [],
    confidence: json.confidence || 0.0
  };
}

export async function checkReadbackAccuracy(
  atcText: string,
  pilotText: string,
  language: LanguageCode = 'en-US',
  history: ConversationEntry[] = [],
  expectedReadback?: string,
  diversityMode: boolean = false
): Promise<ReadbackFeedback> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const historyText = history.map(h => `${h.speaker}: ${h.text}`).join('\n');
  
  // Enhanced diversity instructions
  const diversityInstructions = diversityMode 
    ? `
      CRITICAL DIVERSITY & ACCENT PROTOCOL:
      - Adopt an algorithmic approach to explicitly differentiate between:
        1. Harmless phonetic variations caused by accents (e.g., vowel shifts, "tree" for "three", "niner" for "nine", non-standard cadence).
        2. Safety-critical operational errors (e.g., wrong altitude numbers, incorrect runway, missing hold short instructions).
      - IF the error is Type 1 (accent/phonetic only) -> You MUST mark accuracy as CORRECT.
      - IF the error is Type 2 (operational/safety) -> You MUST mark accuracy as INCORRECT.
      - Your goal is to ensure fair, constructive feedback that embraces language diversity while strictly maintaining flight safety standards.
      ` 
    : `
      - Allow for standard aviation variations (e.g., "tree" for "three").
      - Focus on operational accuracy (numbers, clearances).
      `;

  const prompt = `
    You are a Certified Flight Instructor (CFI) specializing in radio communications.
    Task: Evaluate the accuracy of the pilot's read-back.

    ${diversityInstructions}

    Context History:
    ${historyText}

    ATC Instruction: "${atcText}"
    ${expectedReadback ? `Expected Standard Read-back (Ground Truth): "${expectedReadback}"` : ''}
    Pilot Actual Read-back: "${pilotText}"
    Language: ${SUPPORTED_LANGUAGES[language]}

    Analyze the pilot's read-back for:
    1. **Accuracy**: Did they read back all mandatory elements (altitudes, headings, frequencies, clearances)?
    2. **Phraseology**: Did they use standard ICAO/FAA terminology?
    3. **Callsign**: Did they include their callsign?

    Compare specifically against the "${expectedReadback ? 'Expected Standard Read-back' : 'ATC Instruction'}" to determine correctness.

    Return a JSON object.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accuracy: { type: Type.STRING, enum: ["CORRECT", "INCORRECT"] },
          accuracyScore: { type: Type.NUMBER, description: "Score from 0.0 to 1.0" },
          feedbackSummary: { type: Type.STRING, description: "A concise, spoken-style summary of the feedback for the pilot." },
          detailedFeedback: { type: Type.STRING },
          correctPhraseology: { type: Type.STRING },
          phraseAnalysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["correct", "acceptable_variation", "incorrect"] },
                explanation: { type: Type.STRING }
              }
            }
          },
          commonPitfalls: { type: Type.STRING },
          furtherReading: { type: Type.STRING }
        },
        required: ["accuracy", "accuracyScore", "feedbackSummary", "detailedFeedback", "correctPhraseology", "phraseAnalysis"]
      }
    }
  });

  const json = JSON.parse(response.text || '{}');
  return json as ReadbackFeedback;
}

export async function extractCallsign(
  text: string, 
  language: LanguageCode,
  history: ConversationEntry[] = []
): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const historyText = history.map(h => `${h.speaker}: ${h.text}`).join('\n');

  const prompt = `
    Extract the *aircraft* callsign from the text below.
    Text: "${text}"
    History:
    ${historyText}
    Language: ${SUPPORTED_LANGUAGES[language]}

    Rules:
    1. Identify the target aircraft callsign (e.g., "November 123 Alpha Bravo", "United 454", "Speedbird 10").
    2. Convert it to standard alphanumeric format (e.g., "N123AB", "UAL454", "BAW10").
    3. IGNORE ATC facility callsigns (e.g., "Boston Tower", "Logan Ground", "New York Approach", "Center").
    4. If NO aircraft callsign is found, or if the text only contains ATC facility names, return null.
    5. Be smart about abbreviations if context allows.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          callsign: { type: Type.STRING, nullable: true }
        }
      }
    }
  });

  const json = JSON.parse(response.text || '{}');
  return json.callsign;
}

export async function generateSpeech(text: string, voice: PilotVoiceName | AtcVoiceName): Promise<Uint8Array | null> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
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
        console.error("TTS generation failed:", error);
        return null;
    }
}

export async function connectToLive(
    onInterim: (text: string, confidence?: number) => void,
    onFinal: (text: string, confidence?: number) => void,
    onError: (error: any) => void,
    languageCode: LanguageCode,
    mode: 'atc' | 'pilot' = 'atc',
    diversityMode: boolean = false
): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const aviationContext = `
      You are an expert Aviation Transcriber with advanced predictive text capabilities.
      Domain: Air Traffic Control (ATC) and Pilot Communications.
      
      CORE OBJECTIVE: Output complete, coherent, and grammatically correct aviation phrases.
      
      Advanced Processing Rules:
      1. **Smart Reconstruction**: actively guess and complete cut-off words based on aviation context (e.g., "al...tude" -> "altitude", "u...ted" -> "United").
      2. **Word Integrity**: NEVER output broken words or fragmented syllables with spaces (e.g., correct "land ing" to "landing", "t ax i" to "taxi").
      3. **Phrase Continuity**: Ensure the transcribed text flows logically as a standard ATC command or read-back.
      
      Knowledge Base:
      - ICAO Phonetics: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliett, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo, Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu.
      - Aviation Numbers: "Tree" (3), "Fife" (5), "Niner" (9), "Thousand", "Hundred".
      - Critical Jargon: Squawk, Ident, ILS, VOR, Hold Short, Cleared, Runway, Taxi, Flight Level, Altimeter, Approach, Center, Tower, Ground, Localizer, Radial, Vectors, Direct.
      
      Standard Instructions:
      - Accurately transcribe all numbers (altitudes, headings, frequencies, squawk codes).
      - Recognize standard callsign formats (N-numbers, Airline callsigns).
      - Ignore background cockpit noise or static.
      ${diversityMode ? '- DIVERSITY MODE ACTIVE: Apply logic to normalize diverse accents and non-native pronunciations. Focus on extracting the semantic aviation intent over strict phonetic matching.' : ''}
      ${mode === 'pilot' ? '- Focus on pilot read-back phraseology (e.g., "Roger", "Wilco", repeating instructions).' : '- Focus on ATC instruction phraseology (e.g., "Cleared to", "Turn left", "Contact").'}
    `;

    const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            systemInstruction: `${aviationContext}\nLanguage: ${SUPPORTED_LANGUAGES[languageCode]}`,
        },
        callbacks: {
            onopen: () => {
                console.log("Live session connected");
            },
            onmessage: (message: LiveServerMessage) => {
                if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
                     // Handle text if model generates it (rare in this config but possible)
                }
                
                if (message.serverContent?.turnComplete) {
                   // Turn complete. Use the accumulated buffer as final.
                   // Note: In a real streaming app, we might rely on the inputAudioTranscription final flag,
                   // but here we trigger 'final' logic when the turn is done.
                }
                
                // Check for transcriptions
                const transcription = message.serverContent?.inputAudioTranscription;
                if (transcription) {
                    const text = transcription.text;
                    // Note: The API doesn't give a strict 'isFinal' flag for every packet, 
                    // but we can treat updates as interim until turnComplete or a pause logic in App.tsx.
                    // However, usually we just get a stream of text.
                    // We pass it as interim. App.tsx handles finalization via 'turnComplete' logic or manual stop.
                    if (text) {
                        onInterim(text, 0.9); // Confidence placeholder
                        if (transcription.isFinal) {
                            onFinal(text, 0.9);
                        }
                    }
                }
            },
            onerror: (error: any) => {
                onError(error);
            },
            onclose: () => {
                console.log("Live session closed");
            },
        },
    });
    
    return session;
}