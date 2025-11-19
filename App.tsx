// Fix: Remove LiveSession from import as it is not an exported member.
// FIX: Import Blob as GeminiBlob for use in media streaming.
import { GoogleGenAI, Blob as GeminiBlob } from '@google/genai';
// Fix: Correct React import statement.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppStatus, ConversationEntry, Session, LanguageCode, SUPPORTED_LANGUAGES, PilotVoiceName, AVAILABLE_PILOT_VOICES, AtcVoiceName, AVAILABLE_ATC_VOICES, TrainingScenario, PlaybackSpeed, AVAILABLE_PLAYBACK_SPEEDS } from './types';
import { generateReadback, generateSpeech, connectToLive, checkReadbackAccuracy, extractCallsign, decodeAudioData } from './services/geminiService';
import * as sessionService from './services/sessionService';
import * as trainingScenarioService from './services/trainingScenarioService';
import ControlPanel from './components/ControlPanel';
import ConversationLog from './components/ConversationLog';
import SessionHistory from './components/SessionHistory';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import Onboarding from './components/Onboarding';
import InfoIcon from './components/icons/InfoIcon';
import SettingsIcon from './components/icons/SettingsIcon';
import SettingsModal from './components/SettingsModal';
import TrainingModeBar from './components/TrainingModeBar';
import CustomScenarioModal from './components/CustomScenarioModal';
import GraduationCapIcon from './components/icons/GraduationCapIcon';
import CallsignConfirmationBanner from './components/CallsignConfirmationBanner';
import PhoneticAlphabetGuide from './components/PhoneticAlphabetGuide';
import BookIcon from './components/icons/BookIcon';


// FIX: Corrected loop condition from 'i = 0' to 'i < len' and added a return statement.
// Fix: Added btoa() to correctly base64-encode the audio data.
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Converts an AudioBuffer to a WAV file Blob.
 * @param buffer The AudioBuffer to convert.
 * @returns A Blob representing the WAV file.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let pos = 0;

    // Helper function to write a 16-bit unsigned integer.
    const setUint16 = (data: number) => {
        view.setUint16(pos, data, true);
        pos += 2;
    };

    // Helper function to write a 32-bit unsigned integer.
    const setUint32 = (data: number) => {
        view.setUint32(pos, data, true);
        pos += 4;
    };

    // Write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // Write fmt chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // chunk size
    setUint16(1); // format = 1 (PCM)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample

    // Write data chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Get PCM data from channels
    for (i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Interleave channels and convert to 16-bit PCM
    let offset = 0;
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
}


const App: React.FC = () => {
  // FIX: Declare all state variables and refs that were missing.
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [conversationLog, setConversationLog] = useState<ConversationEntry[]>([]);
  const [interimTranscription, setInterimTranscription] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const [callsign, setCallsign] = useState('November-One-Two-Three-Alpha-Bravo');
  const [language, setLanguage] = useState<LanguageCode>('en-US');
  const [voice, setVoice] = useState<PilotVoiceName>('Puck');
  const [atcVoice, setAtcVoice] = useState<AtcVoiceName>('Fenrir');
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>('1.0');
  const [accuracyThreshold, setAccuracyThreshold] = useState(90);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<Session[]>(sessionService.getSavedSessions());
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<TrainingScenario | null>(null);
  const [allScenarios, setAllScenarios] = useState<TrainingScenario[]>(trainingScenarioService.getScenarios());
  const [detectedCallsign, setDetectedCallsign] = useState<string | null>(null);
  const [showPhoneticGuide, setShowPhoneticGuide] = useState(false);
  const [squawkCodeInput, setSquawkCodeInput] = useState('');

  // Using `any` for LiveSession as it is not an exported member of the SDK.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const finalizedTranscriptRef = useRef('');
  const lastConfidenceRef = useRef<number | undefined>(undefined);
  const conversationLogRef = useRef<ConversationEntry[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const recordingDestinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Keep conversationLogRef in sync with conversationLog state
  useEffect(() => {
    conversationLogRef.current = conversationLog;
  }, [conversationLog]);


  // Initial load
  useEffect(() => {
    const inProgressLog = sessionService.loadInProgressSession();
    if (inProgressLog && inProgressLog.length > 0) {
        setConversationLog(inProgressLog);
    }
    
    const savedCallsign = localStorage.getItem('atc-copilot-callsign');
    if (savedCallsign) {
      setCallsign(savedCallsign);
    }
    const savedLanguage = localStorage.getItem('atc-copilot-language') as LanguageCode;
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
        setLanguage(savedLanguage);
    }
    const savedVoice = localStorage.getItem('atc-copilot-voice') as PilotVoiceName;
    if (savedVoice && AVAILABLE_PILOT_VOICES[savedVoice]) {
        setVoice(savedVoice);
    }
    const savedAtcVoice = localStorage.getItem('atc-copilot-atc-voice') as AtcVoiceName;
    if (savedAtcVoice && AVAILABLE_ATC_VOICES[savedAtcVoice]) {
        setAtcVoice(savedAtcVoice);
    }
    const savedPlaybackSpeed = localStorage.getItem('atc-copilot-playback-speed') as PlaybackSpeed;
    if (savedPlaybackSpeed && AVAILABLE_PLAYBACK_SPEEDS[savedPlaybackSpeed]) {
        setPlaybackSpeed(savedPlaybackSpeed);
    }
    const savedAccuracyThreshold = localStorage.getItem('atc-copilot-accuracy-threshold');
    if (savedAccuracyThreshold) {
        setAccuracyThreshold(parseInt(savedAccuracyThreshold, 10));
    }

    const checkApiKey = async () => {
        // @ts-ignore
        if (await window.aistudio.hasSelectedApiKey()) {
            setIsApiKeyReady(true);
        }
    };
    checkApiKey();

    const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
    if (!hasCompleted) {
        setShowOnboarding(true);
    }
  }, []);
  
  // Autosave conversation log
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isReviewing && !isTrainingMode && conversationLog.length > 0) {
        sessionService.saveInProgressSession(conversationLog);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also save periodically
    const intervalId = setInterval(() => {
      if (!isReviewing && !isTrainingMode && conversationLog.length > 0) {
        sessionService.saveInProgressSession(conversationLog);
      }
    }, 5000); // Save every 5 seconds

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
    };
  }, [conversationLog, isReviewing, isTrainingMode]);


  const cleanupAudio = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (recordingContextRef.current && recordingContextRef.current.state !== 'closed') {
        recordingContextRef.current.close();
        recordingContextRef.current = null;
    }
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current = null;
    }

  }, []);

  const saveCurrentSession = useCallback(() => {
    const currentLog = conversationLogRef.current;
    if (currentLog.length > 0 && !isReviewing && !isTrainingMode) {
        const updatedSessions = sessionService.saveSession(currentLog);
        setSavedSessions(updatedSessions);
    }
  }, [isReviewing, isTrainingMode]);

  const processUserReadback = useCallback(async (userTranscription: string) => {
    if (!currentScenario) return;

    setStatus(AppStatus.THINKING);

    const userEntry: ConversationEntry = {
      speaker: 'PILOT',
      text: userTranscription,
      confidence: lastConfidenceRef.current,
    };
    
    const feedback = await checkReadbackAccuracy(
      currentScenario.atcInstruction,
      userTranscription,
      language,
      conversationLogRef.current, // Pass current history
      currentScenario.expectedReadback
    );

    userEntry.feedback = feedback;
    setConversationLog(prev => [...prev, userEntry]);

    setStatus(AppStatus.IDLE);
    // After feedback, the training turn is over. The user can retry or exit.
  }, [currentScenario, language]);

  const processTranscription = useCallback(async (transcription: string, confidence?: number) => {
    setStatus(AppStatus.THINKING);
    const atcEntry: ConversationEntry = { speaker: 'ATC', text: transcription, confidence };

    const getUpdatedLogWithAtc = new Promise<ConversationEntry[]>(resolve => {
        setConversationLog(prevLog => {
            const newLog = [...prevLog, atcEntry];
            resolve(newLog);
            return newLog;
        });
    });

    const logWithAtc = await getUpdatedLogWithAtc;
    
    const detected = await extractCallsign(transcription, language, logWithAtc);
    let activeCallsign = callsign;
    if (detected && detected !== callsign) {
      setDetectedCallsign(detected); // Show banner
      activeCallsign = detected; // Use for this read-back immediately
    }
    
    const { primary: readbackText, alternatives, confidence: readbackConfidence } = await generateReadback(transcription, activeCallsign, language, logWithAtc);

    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(transcription, readbackText, language, logWithAtc);

    const pilotEntry: ConversationEntry = { speaker: 'PILOT', text: readbackText, feedback, alternatives, confidence: readbackConfidence };
    setConversationLog(prev => [...prev, pilotEntry]);
    
    if (feedback.accuracy === 'CORRECT') {
      setStatus(AppStatus.SPEAKING);
      const audioBytes = await generateSpeech(readbackText, voice);
      if (audioBytes) {
        return new Promise<void>(async (resolve) => {
            // @ts-ignore
            const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(audioBytes, playbackContext, 24000, 1);
            const source = playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackContext.destination);

            const recContext = recordingContextRef.current;
            const recDest = recordingDestinationNodeRef.current;
            if (recContext && recDest) {
                const ttsStreamDest = playbackContext.createMediaStreamDestination();
                source.connect(ttsStreamDest);
                const ttsRecordingSource = recContext.createMediaStreamSource(ttsStreamDest.stream);
                ttsRecordingSource.connect(recDest);
            }

            source.start();
            source.onended = () => {
              playbackContext.close();
              resolve();
            };
        });
      }
    }
  }, [callsign, language, voice]);

  const processAndStop = useCallback(async () => {
    const transcriptionToProcess = finalizedTranscriptRef.current.trim();

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      } finally {
        sessionPromiseRef.current = null;
      }
    }
    cleanupAudio();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setInterimTranscription('');
    setMicVolume(0);

    if (transcriptionToProcess) {
      if (isTrainingMode) {
        await processUserReadback(transcriptionToProcess);
      } else {
        await processTranscription(transcriptionToProcess, lastConfidenceRef.current);
      }
    }
    
    // In training mode, stay IDLE to allow another attempt.
    // In normal mode, finish the session.
    if (!isTrainingMode) {
      setStatus(AppStatus.IDLE);
      saveCurrentSession();
    } else {
      setStatus(AppStatus.IDLE);
    }
  }, [cleanupAudio, processTranscription, saveCurrentSession, isTrainingMode, processUserReadback]);

  const stopListening = useCallback(async (saveSession: boolean = true) => {
      if (sessionPromiseRef.current) {
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) {
            console.error("Error closing session:", e);
        } finally {
            sessionPromiseRef.current = null;
        }
      }
      cleanupAudio();
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      setInterimTranscription('');
      finalizedTranscriptRef.current = '';
      setMicVolume(0);

      if (status !== AppStatus.IDLE) {
         setStatus(AppStatus.IDLE);
         if (saveSession && !isTrainingMode) {
            saveCurrentSession();
         }
      }
  }, [cleanupAudio, saveCurrentSession, status, isTrainingMode]);


  const startListening = useCallback(async () => {
    if (status !== AppStatus.IDLE && status !== AppStatus.ERROR) return;
    
    if (!isTrainingMode) {
      setConversationLog(prev => (isReviewing ? [] : prev));
      setIsReviewing(false);
      setCurrentSessionId(null);
    }

    setStatus(AppStatus.LISTENING);
    setErrorMessage(null);
    
    finalizedTranscriptRef.current = '';
    
    if (!isTrainingMode) {
      setRecordedAudioUrl(null);
      recordedChunksRef.current = [];
    }

    try {
      const audioConstraints = {
        audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
        },
      };
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(audioConstraints);

      // @ts-ignore
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audioContext = audioContextRef.current;

      const onInterimTranscription = (accumulatedText: string, confidence?: number) => {
        setInterimTranscription(accumulatedText);
        finalizedTranscriptRef.current = accumulatedText;
        lastConfidenceRef.current = confidence;
      };

      const onFinalTranscription = (finalText: string, confidence?: number) => {
        finalizedTranscriptRef.current = finalText;
        lastConfidenceRef.current = confidence;
        processAndStop();
      };

      const onError = (error: any) => {
        console.error("Live connection error", error);
        let userMessage = 'An unexpected error occurred. Please try again.';

        if (error.message && (
            error.message.includes("API key not valid") ||
            error.message.includes("permission to access") ||
            error.message.includes("Requested entity was not found") ||
            error.message.includes("Request contains an invalid argument")
        )) {
            userMessage = 'Your API key may be invalid or lack necessary permissions. Please select a different key.';
            setIsApiKeyReady(false);
        } else if (error.message && error.message.includes("Network error")) {
            userMessage = 'A network error occurred. Please check your connection and try again.';
        }
        setErrorMessage(userMessage);
        setStatus(AppStatus.ERROR);
        stopListening(false);
      };

      sessionPromiseRef.current = connectToLive(onInterimTranscription, onFinalTranscription, onError, language, isTrainingMode ? 'pilot' : 'atc');
      const geminiMicSource = audioContext.createMediaStreamSource(mediaStreamRef.current);
      
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      if (!isTrainingMode) {
        // @ts-ignore
        recordingContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        const recContext = recordingContextRef.current;
        const recordingMicSource = recContext.createMediaStreamSource(mediaStreamRef.current);
        recordingDestinationNodeRef.current = recContext.createMediaStreamDestination();
        recordingMicSource.connect(recordingDestinationNodeRef.current);
        
        // Use a browser-supported MIME type like 'audio/webm'. The conversion to WAV happens on stop.
        const mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
             console.error(`${mimeType} is not supported on this browser.`);
             // Handle cases where even webm is not supported, though this is rare.
             return;
        }

        mediaRecorderRef.current = new MediaRecorder(recordingDestinationNodeRef.current.stream, { mimeType });
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };
        mediaRecorderRef.current.onstop = async () => {
            const webmBlob = new Blob(recordedChunksRef.current, { type: mimeType });
            recordedChunksRef.current = [];

            try {
                const arrayBuffer = await webmBlob.arrayBuffer();
                // Ensure the context for decoding exists and is in a running state.
                const decodeContext = recordingContextRef.current && recordingContextRef.current.state !== 'closed'
                    // @ts-ignore
                    ? recordingContextRef.current : new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
                const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
                const wavBlob = audioBufferToWav(audioBuffer);
                const url = URL.createObjectURL(wavBlob);
                setRecordedAudioUrl(url);
            } catch (e) {
                console.error("Error converting audio to WAV:", e);
                // Fallback: offer the webm file if conversion fails
                const url = URL.createObjectURL(webmBlob);
                setRecordedAudioUrl(url);
                alert("Could not convert audio to WAV, providing raw WEBM file instead. The downloaded file will have a .wav extension but may need to be renamed to .webm to play correctly.");
            }
        };
        mediaRecorderRef.current.start();
      }

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        
        let sum = 0.0;
        for (let i = 0; i < inputData.length; ++i) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        requestAnimationFrame(() => {
            setMicVolume(rms);
        });

        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        const pcmBlob: GeminiBlob = {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        }
        if(sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        }
      };
      
      geminiMicSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

    } catch (error) {
      console.error("Failed to start microphone:", error);
      setErrorMessage('Could not access microphone. Please check permissions and try again.');
      setStatus(AppStatus.ERROR);
    }
  }, [status, isReviewing, language, processAndStop, stopListening, isTrainingMode]);

  const handleToggleListening = useCallback(async () => {
    if (status === AppStatus.IDLE || status === AppStatus.ERROR) {
      await startListening();
    } else {
      await processAndStop();
    }
  }, [status, startListening, processAndStop]);

  const handleRegenerateReadback = useCallback(async () => {
    const lastAtcEntryIndex = conversationLog.map(e => e.speaker).lastIndexOf('ATC');
    if (lastAtcEntryIndex === -1) return;

    const lastAtcEntry = conversationLog[lastAtcEntryIndex];
    const historyForRegen = conversationLog.slice(0, lastAtcEntryIndex + 1);
    
    setConversationLog(prev => prev.slice(0, lastAtcEntryIndex + 1));
    
    setStatus(AppStatus.THINKING);
    const { primary: readbackText, alternatives, confidence: readbackConfidence } = await generateReadback(lastAtcEntry.text, callsign, language, historyForRegen);
    
    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(lastAtcEntry.text, readbackText, language, historyForRegen);
    
    const pilotEntry = { speaker: 'PILOT' as const, text: readbackText, feedback, alternatives, confidence: readbackConfidence };
    setConversationLog(prev => [...prev, pilotEntry]);
    
    if (feedback.accuracy === 'CORRECT') {
        setStatus(AppStatus.SPEAKING);
        const audioBytes = await generateSpeech(readbackText, voice);
        if (audioBytes) {
            // @ts-ignore
            const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(audioBytes, playbackContext, 24000, 1);
            const source = playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackContext.destination);
            source.start();
            source.onended = () => {
                playbackContext.close();
                setStatus(AppStatus.IDLE);
                saveCurrentSession();
            };
        } else {
            setStatus(AppStatus.IDLE);
            saveCurrentSession();
        }
    } else {
        setStatus(AppStatus.IDLE);
        saveCurrentSession();
    }
  }, [conversationLog, callsign, language, voice, saveCurrentSession]);
  
  const handleClearTranscription = useCallback(() => {
    if (status !== AppStatus.LISTENING) return;
    setInterimTranscription('');
    finalizedTranscriptRef.current = '';
  }, [status]);

  const handleNewSession = useCallback(() => {
    stopListening(false);
    setConversationLog([]);
    setIsReviewing(false);
    setCurrentSessionId(null);
    setRecordedAudioUrl(null);
    setIsTrainingMode(false);
    setCurrentScenario(null);
    sessionService.clearInProgressSession();
  }, [stopListening]);

  const handleLoadSession = useCallback((session: Session) => {
    stopListening(false);
    setConversationLog(session.log);
    setIsReviewing(true);
    setCurrentSessionId(session.id);
    setRecordedAudioUrl(null);
    setIsTrainingMode(false);
    setCurrentScenario(null);
    sessionService.clearInProgressSession();
  }, [stopListening]);
  
  const handleDeleteSession = useCallback((sessionId: number) => {
    const updatedSessions = sessionService.deleteSession(sessionId);
    setSavedSessions(updatedSessions);
    if (currentSessionId === sessionId) {
        handleNewSession();
    }
  }, [currentSessionId, handleNewSession]);

  const handleClearAllSessions = useCallback(() => {
    const updatedSessions = sessionService.clearAllSessions();
    setSavedSessions(updatedSessions);
    handleNewSession();
  }, [handleNewSession]);

  const checkApiKeyValidity = async (): Promise<boolean> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return false;
        }
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ping',
        });
        return true;
    } catch (error) {
        console.error("API key validation failed:", error);
        return false;
    }
  };

  const handleSelectKey = useCallback(async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setIsVerifyingKey(true);
    const isValid = await checkApiKeyValidity();
    setIsApiKeyReady(isValid);
    setIsVerifyingKey(false);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    setShowOnboarding(false);
  };

  const handleSaveSettings = (newCallsign: string, newLanguage: LanguageCode, newVoice: PilotVoiceName, newAtcVoice: AtcVoiceName, newPlaybackSpeed: PlaybackSpeed, newAccuracyThreshold: number) => {
    setCallsign(newCallsign);
    localStorage.setItem('atc-copilot-callsign', newCallsign);
    setLanguage(newLanguage);
    localStorage.setItem('atc-copilot-language', newLanguage);
    setVoice(newVoice);
    localStorage.setItem('atc-copilot-voice', newVoice);
    setAtcVoice(newAtcVoice);
    localStorage.setItem('atc-copilot-atc-voice', newAtcVoice);
    setPlaybackSpeed(newPlaybackSpeed);
    localStorage.setItem('atc-copilot-playback-speed', newPlaybackSpeed);
    setAccuracyThreshold(newAccuracyThreshold);
    localStorage.setItem('atc-copilot-accuracy-threshold', newAccuracyThreshold.toString());
    setShowSettings(false);
  };
  
  // --- Training Mode Functions ---
  const handleScenarioSelected = useCallback(async (scenario: TrainingScenario) => {
    handleNewSession();
    setIsTrainingMode(true);
    setCurrentScenario(scenario);
    setShowTrainingModal(false);
    setStatus(AppStatus.SPEAKING);

    const atcEntry: ConversationEntry = { speaker: 'ATC', text: scenario.atcInstruction };
    setConversationLog([atcEntry]);
    
    const audioBytes = await generateSpeech(scenario.atcInstruction, atcVoice);
    if (audioBytes) {
        // @ts-ignore
        const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(audioBytes, playbackContext, 24000, 1);
        const source = playbackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = parseFloat(playbackSpeed);
        source.connect(playbackContext.destination);
        source.start();
        source.onended = () => {
          playbackContext.close();
          setStatus(AppStatus.IDLE); // Ready for user to speak
        };
    } else {
        setStatus(AppStatus.IDLE);
    }
  }, [handleNewSession, playbackSpeed, atcVoice]);

  const handleExitTraining = useCallback(() => {
    stopListening(false);
    setIsTrainingMode(false);
    setCurrentScenario(null);
    setConversationLog([]);
  }, [stopListening]);
  
  const handleCreateScenario = useCallback((scenario: Omit<TrainingScenario, 'id' | 'isCustom'>) => {
    const updated = trainingScenarioService.saveCustomScenario(scenario);
    setAllScenarios(updated);
  }, []);

  const handleDeleteScenario = useCallback((scenarioId: string) => {
    const updated = trainingScenarioService.deleteCustomScenario(scenarioId);
    setAllScenarios(updated);
  }, []);

  const handleImportScenarios = useCallback((scenariosToImport: any[]) => {
    const result = trainingScenarioService.importCustomScenarios(scenariosToImport);
    if (result.count > 0) {
        setAllScenarios(trainingScenarioService.getScenarios());
    }
    return result;
  }, []);

  const handleConfirmCallsign = useCallback(() => {
    if (detectedCallsign) {
      setCallsign(detectedCallsign);
      localStorage.setItem('atc-copilot-callsign', detectedCallsign);
      setDetectedCallsign(null);
    }
  }, [detectedCallsign]);

  const handleIgnoreCallsign = useCallback(() => {
    setDetectedCallsign(null);
  }, []);

  const handleSquawkSubmit = useCallback(async () => {
    if (squawkCodeInput.length !== 4 || !/^[0-7]{4}$/.test(squawkCodeInput)) {
        alert("Please enter a valid 4-digit squawk code using digits 0-7.");
        return;
    }

    setStatus(AppStatus.THINKING);

    const atcInstruction = `Squawk ${squawkCodeInput}.`;
    const atcEntry: ConversationEntry = { speaker: 'ATC', text: atcInstruction };

    const logWithAtc = [...conversationLogRef.current, atcEntry];
    setConversationLog(logWithAtc);

    try {
        const { primary: readbackText, alternatives, confidence: readbackConfidence } = await generateReadback(atcInstruction, callsign, language, logWithAtc);

        const pilotEntry: ConversationEntry = { speaker: 'PILOT', text: readbackText, alternatives, confidence: readbackConfidence };
        setConversationLog(prev => [...prev, pilotEntry]);
        
        setStatus(AppStatus.SPEAKING);
        const audioBytes = await generateSpeech(readbackText, voice);
        if (audioBytes) {
             // @ts-ignore
            const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(audioBytes, playbackContext, 24000, 1);
            const source = playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackContext.destination);
            source.start();
            source.onended = () => {
                playbackContext.close();
                setStatus(AppStatus.IDLE);
            };
        } else {
            setStatus(AppStatus.IDLE);
        }
    } catch (e) {
        console.error("Error during squawk submission:", e);
        setErrorMessage("Failed to process squawk code.");
        setStatus(AppStatus.ERROR);
    } finally {
        setSquawkCodeInput(''); // Clear the input after submission
    }
  }, [squawkCodeInput, callsign, language, voice]);


  useEffect(() => {
    return () => {
      stopListening(false);
    };
  }, [stopListening]);

  const canRegenerate = conversationLog.some(e => e.speaker === 'ATC');
  const isBusy = status !== AppStatus.IDLE && status !== AppStatus.ERROR;
  const isRegenerateDisabled = !canRegenerate || isBusy;

  if (!isApiKeyReady) {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
             <ApiKeyPrompt onSelectKey={handleSelectKey} isVerifying={isVerifyingKey} />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      {showSettings && <SettingsModal 
        currentCallsign={callsign} 
        currentLanguage={language}
        currentVoice={voice}
        currentAtcVoice={atcVoice}
        currentPlaybackSpeed={playbackSpeed}
        currentAccuracyThreshold={accuracyThreshold}
        onSave={handleSaveSettings} 
        onClose={() => setShowSettings(false)} 
       />}
      {showTrainingModal && <CustomScenarioModal 
        scenarios={allScenarios}
        onSelect={handleScenarioSelected}
        onClose={() => setShowTrainingModal(false)}
        onCreate={handleCreateScenario}
        onDelete={handleDeleteScenario}
        onImport={handleImportScenarios}
      />}
       {showPhoneticGuide && <PhoneticAlphabetGuide onClose={() => setShowPhoneticGuide(false)} />}
      <div className="w-full max-w-3xl mx-auto flex flex-col space-y-6">
        <header className="text-center relative border-b border-gray-700/50 pb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">CommScript ATC</h1>
          <p className="text-gray-400 mt-2">AI-Powered Radio Communication Assistant</p>
          <div className="absolute top-0 right-0 flex space-x-2">
            <button
                onClick={() => setShowTrainingModal(true)}
                className="p-2 text-gray-500 hover:text-cyan-400 transition-colors"
                aria-label="Open training scenarios"
                title="Open training scenarios"
            >
                <GraduationCapIcon className="w-6 h-6" />
            </button>
            <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:text-cyan-400 transition-colors"
                aria-label="Open settings"
                title="Open settings"
            >
                <SettingsIcon className="w-6 h-6" />
            </button>
            <button
                onClick={() => setShowOnboarding(true)}
                className="p-2 text-gray-500 hover:text-cyan-400 transition-colors"
                aria-label="Show tutorial"
                title="Show tutorial"
            >
                <InfoIcon className="w-6 h-6" />
            </button>
          </div>
        </header>
        <main className="flex flex-col flex-grow items-center justify-center space-y-6">
           {isTrainingMode && currentScenario && <TrainingModeBar scenario={currentScenario} onExit={handleExitTraining} />}
           {detectedCallsign && <CallsignConfirmationBanner callsign={detectedCallsign} onConfirm={handleConfirmCallsign} onIgnore={handleIgnoreCallsign} />}
           <ConversationLog log={conversationLog} interimTranscription={interimTranscription} accuracyThreshold={accuracyThreshold} />
           <ControlPanel 
             status={status} 
             onToggleListening={handleToggleListening}
             onRegenerateReadback={handleRegenerateReadback}
             onClearTranscription={handleClearTranscription}
             isRegenerateDisabled={isRegenerateDisabled}
             micVolume={status === AppStatus.LISTENING ? micVolume : 0}
             recordedAudioUrl={recordedAudioUrl}
             callsign={callsign}
             errorMessage={errorMessage}
             isTrainingMode={isTrainingMode}
             currentScenario={currentScenario}
             squawkCode={squawkCodeInput}
             onSquawkCodeChange={setSquawkCodeInput}
             onSquawkSubmit={handleSquawkSubmit}
             isSquawkDisabled={isBusy}
            />
           <SessionHistory 
             sessions={savedSessions} 
             currentSessionId={currentSessionId}
             onLoadSession={handleLoadSession}
             onDeleteSession={handleDeleteSession}
             onClearAll={handleClearAllSessions}
             onNewSession={handleNewSession}
            />
        </main>
        <footer className="text-center text-gray-600 text-sm">
            <div className="flex items-center justify-center space-x-4">
              <p>Callsign: {callsign.replace(/-/g, ' ')}.</p>
              <button onClick={() => setShowPhoneticGuide(true)} className="flex items-center space-x-1 text-cyan-500 hover:underline" title="Show Phonetic Alphabet Guide">
                  <BookIcon className="w-4 h-4" />
                  <span>Phonetic Alphabet</span>
              </button>
            </div>
            <p className="mt-1">For training and simulation purposes only.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;