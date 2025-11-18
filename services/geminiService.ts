
// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { ReadbackFeedback, LanguageCode, SUPPORTED_LANGUAGES, VoiceName, ConversationEntry, TrainingScenario } from "../types";

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

const readbackFeedbackSchema = {
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

// --- Gemini API Service ---

export const generateReadback = async (transcription: string, callsign: string, language: LanguageCode, history: ConversationEntry[]): Promise<{ primary: string, alternatives: string[] }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  const prompt = `You are an expert pilot assistant responsible for generating accurate read-backs.
  Given the following Air Traffic Control (ATC) instruction in ${languageName}, your task is to generate the most standard, correct pilot read-back, as well as a few other common, equally correct alternative phraseologies.

  **Recent Communication History (for context):**
  ${formatHistoryForPrompt(history)}

  **Instructions:**
  1.  Generate a \`primary\` read-back. This should be the most common, by-the-book phraseology.
  2.  Generate an array of \`alternatives\`. These should be other ways a pilot might correctly respond. They should be distinct from the primary read-back and from each other. If there are no common alternatives, provide an empty array.
  3.  Both the primary and alternative read-backs must include the aircraft callsign '${callsign}'.
  4.  All responses must be in ${languageName}.

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

export const extractCallsign = async (transcription: string, language: LanguageCode, history: ConversationEntry[]): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    const prompt = `You are an expert aviation communications analyst. Your task is to analyze the following Air Traffic Control (ATC) transcription in ${languageName} and extract the aircraft callsign with high accuracy.

      **Analysis Guidelines:**
      1.  **Identify the Callsign:** Look for any mention of an aircraft callsign. This could be a full callsign, a partial callsign, or an airline identifier.
      2.  **Handle Variations:** Be prepared for common variations:
          *   **Mixed Numerics/Phonetics:** The callsign might be spoken with digits instead of phonetic words (e.g., "November 123 Alpha Bravo" instead of "November One Two Three Alpha Bravo").
          *   **Abbreviations:** An established callsign might be abbreviated later in a conversation (e.g., "November Alpha Bravo" for "November-One-Two-Three-Alpha-Bravo"). Use the communication history to identify these.
          *   **Airline Callsigns:** Recognize airline names like "Skywest", "Delta", "United".
      3.  **Standardize the Output:** Regardless of how the callsign is spoken, you **MUST** convert it to the standard ICAO phonetic alphabet format, with words separated by hyphens.
          *   Example Input: "N123AB" -> Output: "November-One-Two-Three-Alpha-Bravo"
          *   Example Input: "Skywest 345" -> Output: "Skywest-Three-Four-Five"
      4.  **Use Context:** Refer to the "Recent Communication History" to resolve ambiguities or confirm partial callsigns. If a callsign was "Skyhawk 123AB" before, and now you hear "Skyhawk 3AB", you can confidently identify it.
      5.  **Return Null if Ambiguous:** If no callsign is clearly identifiable, or if it is too ambiguous to determine, return null.

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

export const checkReadbackAccuracy = async (atcInstruction: string, pilotReadback: string, language: LanguageCode, history: ConversationEntry[]): Promise<ReadbackFeedback> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const languageName = SUPPORTED_LANGUAGES[language];
  const prompt = `You are an expert Certified Flight Instructor (CFI) specializing in radio communications. Your task is to provide a detailed, "fuzzy" analysis of a pilot's read-back of an Air Traffic Control (ATC) instruction, focusing on semantic and numerical correctness rather than a strict word-for-word match. Both the instruction and the read-back are in ${languageName}.

  **Primary Goal:**
  Determine if the read-back is operationally 'CORRECT' or 'INCORRECT'. A read-back is only 'CORRECT' if all critical information is repeated accurately. Use the conversation history to understand the context.

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

  **Recent Communication History (for context):**
  ${formatHistoryForPrompt(history)}

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
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: readbackFeedbackSchema,
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

export const checkTrainingReadbackAccuracy = async (atcInstruction: string, pilotReadback: string, expectedReadback: string, language: LanguageCode, history: ConversationEntry[]): Promise<ReadbackFeedback> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    const prompt = `You are an expert Certified Flight Instructor (CFI) specializing in radio communications. Your task is to provide a detailed comparison between a pilot's read-back and the "school solution" (the expected correct read-back) for a given Air Traffic Control (ATC) instruction. Both are in ${languageName}.

    **Primary Goal:**
    Determine if the pilot's read-back is operationally 'CORRECT' or 'INCORRECT' by comparing it to the expected read-back.

    **Analysis Guidelines:**
    1.  **Direct Comparison:** Your main task is to compare the "Pilot's Read-back" against the "Expected Correct Read-back".
    2.  **Identify Deviations:** Note any differences in critical information (altitudes, headings, frequencies, clearances, runways) and phraseology.
    3.  **Provide Specific Feedback:** When generating feedback, be very specific about the errors. Instead of saying "the altitude was wrong," say "You said 'five thousand,' but the expected read-back was 'climb and maintain five thousand.' The phrase 'climb and maintain' is critical for confirming the instruction."
    4.  **Phrase-by-Phrase Analysis:** Break down the pilot's read-back into components. For each component, categorize its status ('correct', 'acceptable_variation', 'incorrect') by comparing it to the corresponding part of the expected read-back. Provide a clear explanation for any 'incorrect' status, referencing the expected phrase.

    **Recent Communication History (for context):**
    ${formatHistoryForPrompt(history)}

    **Original ATC Instruction:**
    "${atcInstruction}"

    **Expected Correct Read-back (School Solution):**
    "${expectedReadback}"

    **Pilot's Read-back (User's Attempt):**
    "${pilotReadback}"

    **Output Requirements:**
    - Provide a 'CORRECT' or 'INCORRECT' \`accuracy\` rating.
    - Provide a concise \`feedbackSummary\` that directly compares the user's attempt to the expected read-back.
    - If 'INCORRECT', provide actionable \`detailedFeedback\` explaining the specific errors by referencing the expected read-back.
    - **ALWAYS** provide a \`phraseAnalysis\` array.
    - The \`correctPhraseology\` field should contain the "Expected Correct Read-back" if the user's attempt was incorrect.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: readbackFeedbackSchema,
          thinkingConfig: { thinkingBudget: 32768 }
        },
      });
      
      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error("Error checking training readback accuracy:", error);
      return {
        accuracy: 'INCORRECT',
        feedbackSummary: 'Could not verify read-back accuracy at this time.',
        phraseAnalysis: [],
      };
    }
  };

export const generateSpeech = async (text: string, voiceName: VoiceName): Promise<AudioBuffer | null> => {
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

export const generateCustomScenario = async (scenarioType: string, language: LanguageCode): Promise<Omit<TrainingScenario, 'key' | 'isCustom'>> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
    
    const prompt = `
      You are an expert aviation training scenario designer. Your task is to create a realistic and challenging training scenario for a pilot based on the requested type.

      The scenario must include:
      1. A short, descriptive \`name\`.
      2. A complete \`atcInstruction\` from the Air Traffic Controller.
      3. The most standard and correct \`expectedReadback\` from the pilot.

      **IMPORTANT RULES:**
      - Both the instruction and the read-back MUST use the placeholder \`{callsign}\` where the aircraft's callsign should be.
      - The language of the output must be ${languageName}.
      - The scenario should be diverse and not a simple variation of common examples.
      - The name should be concise and in English, regardless of the target language.

      **Requested Scenario Type:** ${scenarioType}

      **Example Scenario Types & Guidance:**
      - **IFR Clearance:** A full instrument flight rules clearance from clearance delivery, including route, altitude, frequency, and squawk.
      - **VFR Clearance:** Instructions for a VFR departure through controlled airspace (e.g., Class C or B).
      - **Traffic Pattern:** An instruction for a VFR aircraft entering the traffic pattern. This could include instructions to enter on a 45-degree downwind, report a specific position (e.g., midfield downwind), or sequence behind other traffic.
      - **Non-Towered Airport Communications:** A scenario at an airport without a control tower (on CTAF). This should involve a pilot making a position report and self-announcing their intentions (e.g., "entering 45 for downwind runway 22").
      - **Mountain Flying Procedures:** An advisory or instruction specific to mountain flying. This could involve warnings about turbulence, recommended routing through a mountain pass, or a reminder about high terrain.
      - **Emergency "MAYDAY":** An ATC response to a pilot's 'MAYDAY' call (e.g., engine failure). The instruction should be what ATC tells the pilot to do *next*.
      - **Critical MAYDAY:** A scenario for a severe, time-sensitive in-flight emergency that has been declared with "MAYDAY". This could involve an onboard fire, structural failure, or complete loss of controls. The ATC instruction must be direct, providing immediate vectors to the nearest suitable runway and any critical assistance information.
      - **Approach & Diversion:** Instructions for an instrument approach, followed by a mid-approach change or diversion to an alternate airport due to weather or runway closure.
      - **Mixed Instructions:** A single transmission containing multiple, unrelated instructions (e.g., heading change, altimeter setting, traffic advisory).
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "A short, descriptive name for the scenario in English." },
            atcInstruction: { type: Type.STRING, description: "The full ATC instruction, including the {callsign} placeholder." },
            expectedReadback: { type: Type.STRING, description: "The correct pilot read-back, including the {callsign} placeholder." },
        },
        required: ['name', 'atcInstruction', 'expectedReadback'],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        const result = JSON.parse(response.text);
        return result;
    } catch (error) {
        console.error("Error generating custom scenario:", error);
        return {
            name: "Generation Error",
            atcInstruction: "Could not generate an instruction. Please try again.",
            expectedReadback: "Error.",
        };
    }
};


// Fix: Remove explicit return type Promise<LiveSession> to allow for type inference.
export const connectToLive = (
  onTranscriptionUpdate: (text: string, isFinal: boolean, confidence?: number) => void,
  onError: (error: any) => void,
  language: LanguageCode
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const languageName = SUPPORTED_LANGUAGES[language];
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
            inputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: `You are an expert Air Traffic Control radio transcriber. Your sole function is to accurately transcribe ATC communications in ${languageName}. Do not generate conversational responses.`,
        },
    });
};