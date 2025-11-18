// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI } from '@google/genai';
// Fix: Correct React import statement.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppStatus, ConversationEntry, Session, LanguageCode, SUPPORTED_LANGUAGES, VoiceName, AVAILABLE_VOICES } from './types';
import { generateReadback, generateSpeech, connectToLive, checkReadbackAccuracy, extractCallsign } from './services/geminiService';
import * as sessionService from './services/sessionService';
import ControlPanel from './components/ControlPanel';
import ConversationLog from './components/ConversationLog';
import SessionHistory from './components/SessionHistory';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import Onboarding from './components/Onboarding';
import InfoIcon from './components/icons/InfoIcon';
import SettingsIcon from './components/icons/SettingsIcon';
import SettingsModal from './components/SettingsModal';

const ATC_INSTRUCTION_END_TIMEOUT = 5000; // ms of silence to detect end of instruction

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Type for the object sent to Gemini Live API
interface GeminiBlob {
    data: string;
    mimeType: string;
}

// Fix: Infer LiveSession type from connectToLive function since it's not exported.
type LiveSessionPromise = ReturnType<typeof connectToLive>;
type LiveSession = Awaited<LiveSessionPromise>;


const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [conversationLog, setConversationLog] = useState<ConversationEntry[]>([]);
  const [interimTranscription, setInterimTranscription] = useState('');
  const [savedSessions, setSavedSessions] = useState<Session[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [callsign, setCallsign] = useState('November-One-Two-Three-Alpha-Bravo');
  const [language, setLanguage] = useState<LanguageCode>('en-US');
  const [voice, setVoice] = useState<VoiceName>('Puck');
  const [micVolume, setMicVolume] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const conversationLogRef = useRef(conversationLog);
  useEffect(() => {
    conversationLogRef.current = conversationLog;
  }, [conversationLog]);

  const silenceTimerRef = useRef<number | null>(null);
  const sessionPromiseRef = useRef<LiveSessionPromise | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // For Gemini Live (16kHz)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Ref to accumulate all finalized utterances within a single listening session
  const finalizedTranscriptRef = useRef('');
  const lastConfidenceRef = useRef<number | undefined>(undefined);

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null); // For mixing/recording
  const recordingDestinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);


  useEffect(() => {
    setSavedSessions(sessionService.getSavedSessions());
    
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
    const savedVoice = localStorage.getItem('atc-copilot-voice') as VoiceName;
    if (savedVoice && AVAILABLE_VOICES[savedVoice]) {
        setVoice(savedVoice);
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
      if (!isReviewing && conversationLog.length > 0) {
        sessionService.saveInProgressSession(conversationLog);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also save periodically
    const intervalId = setInterval(() => {
      if (!isReviewing && conversationLog.length > 0) {
        sessionService.saveInProgressSession(conversationLog);
      }
    }, 5000); // Save every 5 seconds

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
    };
  }, [conversationLog, isReviewing]);


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
    if (currentLog.length > 0 && !isReviewing) {
        const updatedSessions = sessionService.saveSession(currentLog);
        setSavedSessions(updatedSessions);
    }
  }, [isReviewing]);

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
    
    const detectedCallsign = await extractCallsign(transcription, language, logWithAtc);
    let activeCallsign = callsign;
    if (detectedCallsign && detectedCallsign !== callsign) {
      console.log(`Callsign auto-detected and updated to: ${detectedCallsign}`);
      setCallsign(detectedCallsign);
      localStorage.setItem('atc-copilot-callsign', detectedCallsign);
      activeCallsign = detectedCallsign;
    }
    
    const { primary: readbackText, alternatives } = await generateReadback(transcription, activeCallsign, language, logWithAtc);

    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(transcription, readbackText, language, logWithAtc);

    const pilotEntry: ConversationEntry = { speaker: 'PILOT', text: readbackText, feedback, alternatives };
    setConversationLog(prev => [...prev, pilotEntry]);
    
    if (feedback.accuracy === 'CORRECT') {
      setStatus(AppStatus.SPEAKING);
      const audioBuffer = await generateSpeech(readbackText, voice);
      if (audioBuffer) {
        return new Promise<void>((resolve) => {
            // @ts-ignore
            const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
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
      await processTranscription(transcriptionToProcess, lastConfidenceRef.current);
    }
    
    setStatus(AppStatus.IDLE);
    saveCurrentSession();
  }, [cleanupAudio, processTranscription, saveCurrentSession]);

  const stopListening = useCallback(async () => {
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
         saveCurrentSession();
      }
  }, [cleanupAudio, saveCurrentSession, status]);


  const startListening = useCallback(async () => {
    if (status !== AppStatus.IDLE && status !== AppStatus.ERROR) return;
    
    setConversationLog(prev => (isReviewing ? [] : prev));
    setIsReviewing(false);
    setCurrentSessionId(null);
    setStatus(AppStatus.LISTENING);
    setErrorMessage(null);
    
    finalizedTranscriptRef.current = '';
    setRecordedAudioUrl(null);
    recordedChunksRef.current = [];

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

      const onTranscriptionUpdate = (text: string, isFinal: boolean, confidence?: number) => {
        // Always clear the previous timer when a new chunk arrives.
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
    
        lastConfidenceRef.current = confidence;
    
        // Based on API examples, text chunks are deltas to be appended.
        // The old logic was buggy and replaced text instead of accumulating it.
        if (text) {
          // Add a space if there's existing text.
          const separator = finalizedTranscriptRef.current ? ' ' : '';
          finalizedTranscriptRef.current += separator + text;
        }
        
        // Always show the latest complete transcript in the UI.
        setInterimTranscription(finalizedTranscriptRef.current);
    
        // If the API says the turn is complete (`isFinal`), process immediately.
        if (isFinal) {
          processAndStop();
          return; // Don't start a new silence timer.
        }
        
        // If the turn isn't complete yet, restart the silence timer.
        // This allows capturing multi-sentence instructions with pauses.
        if (finalizedTranscriptRef.current.trim().length > 0) {
          silenceTimerRef.current = window.setTimeout(() => {
            console.log("Silence timer expired. Processing transcription.");
            processAndStop();
          }, ATC_INSTRUCTION_END_TIMEOUT);
        }
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
        stopListening();
      };
      sessionPromiseRef.current = connectToLive(onTranscriptionUpdate, onError, language);
      const geminiMicSource = audioContext.createMediaStreamSource(mediaStreamRef.current);
      
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      // Setup for recording the user's microphone audio for download.
      // @ts-ignore
      recordingContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const recContext = recordingContextRef.current;
      const recordingMicSource = recContext.createMediaStreamSource(mediaStreamRef.current);
      recordingDestinationNodeRef.current = recContext.createMediaStreamDestination();
      recordingMicSource.connect(recordingDestinationNodeRef.current);

      const mimeType = 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(recordingDestinationNodeRef.current.stream, { mimeType });
      mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
          }
      };
      mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
          recordedChunksRef.current = [];
      };
      mediaRecorderRef.current.start();

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
      
      // Connect the simplified audio graph: Mic -> Processor -> Gemini
      geminiMicSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

    } catch (error) {
      console.error("Failed to start microphone:", error);
      setErrorMessage('Could not access microphone. Please check permissions and try again.');
      setStatus(AppStatus.ERROR);
    }
  }, [status, isReviewing, language, processAndStop, stopListening]);

  const handleToggleListening = useCallback(async () => {
    if (status === AppStatus.IDLE || status === AppStatus.ERROR) {
      await startListening();
    } else {
      // User manually stops.
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      // The most up-to-date transcript is in the ref. Commit it before processing.
      await processAndStop();
    }
  }, [status, startListening, processAndStop]);

  const handleRegenerateReadback = useCallback(async () => {
    const originalStatus = status;
    const lastAtcEntryIndex = conversationLog.map(e => e.speaker).lastIndexOf('ATC');
    if (lastAtcEntryIndex === -1) return;

    const lastAtcEntry = conversationLog[lastAtcEntryIndex];
    const historyForRegen = conversationLog.slice(0, lastAtcEntryIndex + 1);
    
    // After regeneration, the state should be idle, as the interaction is complete.
    const returnStatus = AppStatus.IDLE;
    
    setConversationLog(prev => prev.slice(0, lastAtcEntryIndex + 1));
    
    setStatus(AppStatus.THINKING);
    const { primary: readbackText, alternatives } = await generateReadback(lastAtcEntry.text, callsign, language, historyForRegen);
    
    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(lastAtcEntry.text, readbackText, language, historyForRegen);
    
    const pilotEntry = { speaker: 'PILOT' as const, text: readbackText, feedback, alternatives };
    setConversationLog(prev => [...prev, pilotEntry]);
    
    if (feedback.accuracy === 'CORRECT') {
        setStatus(AppStatus.SPEAKING);
        const audioBuffer = await generateSpeech(readbackText, voice);
        if (audioBuffer) {
            // @ts-ignore
            const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const source = playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackContext.destination);

            // Note: Cannot re-record audio during regeneration as the original mic stream is gone.
            source.start();
            source.onended = () => {
                playbackContext.close();
                setStatus(returnStatus);
                saveCurrentSession();
            };
        } else {
            setStatus(returnStatus);
            saveCurrentSession();
        }
    } else {
        setStatus(returnStatus);
        saveCurrentSession();
    }
  }, [conversationLog, callsign, language, status, voice, saveCurrentSession]);
  
  const handleClearTranscription = useCallback(() => {
    if (status !== AppStatus.LISTENING) return;
    setInterimTranscription('');
    finalizedTranscriptRef.current = '';
  }, [status]);

  const handleNewSession = useCallback(() => {
    stopListening();
    setConversationLog([]);
    setIsReviewing(false);
    setCurrentSessionId(null);
    setRecordedAudioUrl(null);
    sessionService.clearInProgressSession();
  }, [stopListening]);

  const handleLoadSession = useCallback((session: Session) => {
    stopListening();
    setConversationLog(session.log);
    setIsReviewing(true);
    setCurrentSessionId(session.id);
    setRecordedAudioUrl(null);
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

  const handleSaveSettings = (newCallsign: string, newLanguage: LanguageCode, newVoice: VoiceName) => {
    setCallsign(newCallsign);
    localStorage.setItem('atc-copilot-callsign', newCallsign);
    setLanguage(newLanguage);
    localStorage.setItem('atc-copilot-language', newLanguage);
    setVoice(newVoice);
    localStorage.setItem('atc-copilot-voice', newVoice);
    setShowSettings(false);
  };


  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const canRegenerate = conversationLog.some(e => e.speaker === 'ATC');
  const isBusy = [AppStatus.THINKING, AppStatus.CHECKING_ACCURACY, AppStatus.SPEAKING].includes(status);
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
        onSave={handleSaveSettings} 
        onClose={() => setShowSettings(false)} 
       />}
      <div className="w-full max-w-3xl mx-auto flex flex-col space-y-6">
        <header className="text-center relative border-b border-gray-700/50 pb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">CommScript ATC</h1>
          <p className="text-gray-400 mt-2">AI-Powered Radio Communication Assistant</p>
          <div className="absolute top-0 right-0 flex space-x-2">
            <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:text-cyan-400 transition-colors"
                aria-label="Open settings"
            >
                <SettingsIcon className="w-6 h-6" />
            </button>
            <button
                onClick={() => setShowOnboarding(true)}
                className="p-2 text-gray-500 hover:text-cyan-400 transition-colors"
                aria-label="Show tutorial"
            >
                <InfoIcon className="w-6 h-6" />
            </button>
          </div>
        </header>
        <main className="flex flex-col flex-grow items-center justify-center space-y-6">
           <ConversationLog log={conversationLog} interimTranscription={interimTranscription} />
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
            <p>Callsign: {callsign.replace(/-/g, ' ')}. For training and simulation purposes only.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;