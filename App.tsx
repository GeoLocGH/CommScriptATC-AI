// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI } from '@google/genai';
// Fix: Correct React import statement.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppStatus, ConversationEntry, Session, LanguageCode, SUPPORTED_LANGUAGES } from './types';
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
  const [micVolume, setMicVolume] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const sessionPromiseRef = useRef<LiveSessionPromise | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // For Gemini Live (16kHz)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fullTranscriptionRef = useRef('');
  const lastConfidenceRef = useRef<number | undefined>(undefined);

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null); // For mixing/recording
  const recordingDestinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);


  useEffect(() => {
    setSavedSessions(sessionService.getSavedSessions());
    
    const savedCallsign = localStorage.getItem('atc-copilot-callsign');
    if (savedCallsign) {
      setCallsign(savedCallsign);
    }
    const savedLanguage = localStorage.getItem('atc-copilot-language') as LanguageCode;
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
        setLanguage(savedLanguage);
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

  const stopListening = useCallback(async () => {
      if (conversationLog.length > 0 && !isReviewing) {
          const updatedSessions = sessionService.saveSession(conversationLog);
          setSavedSessions(updatedSessions);
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop(); // This will trigger onstop and set the URL
      }

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
      setStatus(AppStatus.IDLE);
      setInterimTranscription('');
      fullTranscriptionRef.current = '';
      setMicVolume(0);
  }, [cleanupAudio, conversationLog, isReviewing]);


  const processTranscription = useCallback(async (transcription: string, confidence?: number) => {
    setStatus(AppStatus.THINKING);
    setConversationLog(prev => [...prev, { speaker: 'ATC', text: transcription, confidence }]);
    
    // Automatically detect and update callsign
    const detectedCallsign = await extractCallsign(transcription, language);
    let activeCallsign = callsign;

    if (detectedCallsign && detectedCallsign !== callsign) {
      console.log(`Callsign auto-detected and updated to: ${detectedCallsign}`);
      setCallsign(detectedCallsign);
      localStorage.setItem('atc-copilot-callsign', detectedCallsign);
      activeCallsign = detectedCallsign;
    }
    
    const { primary: readbackText, alternatives } = await generateReadback(transcription, activeCallsign, language);

    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(transcription, readbackText, language);

    setConversationLog(prev => [...prev, { speaker: 'PILOT', text: readbackText, feedback, alternatives }]);
    
    if (feedback.accuracy === 'CORRECT') {
      setStatus(AppStatus.SPEAKING);
      const audioBuffer = await generateSpeech(readbackText);

      if (audioBuffer) {
        // @ts-ignore
        const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const source = playbackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackContext.destination);

        // --- Pipe audio to the recording context as well ---
        const recContext = recordingContextRef.current;
        const recDest = recordingDestinationNodeRef.current;
        if (recContext && recDest) {
            const ttsStreamDest = playbackContext.createMediaStreamDestination();
            source.connect(ttsStreamDest);
            const ttsRecordingSource = recContext.createMediaStreamSource(ttsStreamDest.stream);
            ttsRecordingSource.connect(recDest);
        }
        // --- End recording pipe ---

        source.start();
        source.onended = () => {
          playbackContext.close();
          setStatus(AppStatus.LISTENING); 
        };
      } else {
        setStatus(AppStatus.LISTENING);
      }
    } else {
      // If the generated readback is deemed incorrect by the accuracy check,
      // do not speak it. Immediately return to the listening state.
      setStatus(AppStatus.LISTENING);
    }
  }, [callsign, language]);


  const startListening = useCallback(async () => {
    if (status !== AppStatus.IDLE) return;
    
    setConversationLog(prev => (isReviewing ? [] : prev));
    setIsReviewing(false);
    setCurrentSessionId(null);
    setStatus(AppStatus.LISTENING);
    setErrorMessage(null);
    fullTranscriptionRef.current = '';
    setRecordedAudioUrl(null); // Clear previous recording
    recordedChunksRef.current = [];

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      // --- Gemini Live Setup (16kHz context) ---
      // @ts-ignore
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audioContext = audioContextRef.current;

      const onTranscriptionUpdate = (text: string, isFinal: boolean, confidence?: number) => {
        lastConfidenceRef.current = confidence;
        
        // The API sends the full cumulative transcription in the `text` field.
        // We update our ref with the latest text. An empty text can be received.
        if (text) {
            fullTranscriptionRef.current = text;
        }
        
        if (isFinal) {
            // When the turn is complete, process the final transcription from the ref.
            setInterimTranscription('');
            if (fullTranscriptionRef.current.trim().length > 0) {
              processTranscription(fullTranscriptionRef.current.trim(), lastConfidenceRef.current);
            }
            // Reset for the next turn.
            fullTranscriptionRef.current = '';
            lastConfidenceRef.current = undefined;
        } else {
            // For interim results, just update the display with the latest full text.
            setInterimTranscription(fullTranscriptionRef.current);
        }
      };
      const onError = (error: any) => {
        console.error("Live connection error", error);
        let userMessage = 'An unexpected error occurred. Please try again.';

        // Specific check for API key issues.
        if (error.message && (
            error.message.includes("API key not valid") ||
            error.message.includes("permission to access") ||
            error.message.includes("Requested entity was not found") ||
            // This error can also indicate a problem with the key's permissions/project setup.
            error.message.includes("Request contains an invalid argument")
        )) {
            userMessage = 'Your API key may be invalid or lack necessary permissions. Please select a different key.';
            console.log("API key issue detected, resetting key state.", error.message);
            setIsApiKeyReady(false); // This will bring up the API key prompt.
        } else if (error.message && error.message.includes("Network error")) {
            userMessage = 'A network error occurred. Please check your connection and try again.';
        }
        setErrorMessage(userMessage);
        setStatus(AppStatus.ERROR);
        stopListening();
      };
      sessionPromiseRef.current = connectToLive(onTranscriptionUpdate, onError, language);
      const geminiMicSource = audioContext.createMediaStreamSource(mediaStreamRef.current);
      
      // --- Noise Reduction Setup for Gemini ---
      const noiseGate = audioContext.createDynamicsCompressor();
      noiseGate.threshold.setValueAtTime(-50, audioContext.currentTime);
      noiseGate.knee.setValueAtTime(40, audioContext.currentTime);
      noiseGate.ratio.setValueAtTime(12, audioContext.currentTime);
      noiseGate.attack.setValueAtTime(0, audioContext.currentTime);
      noiseGate.release.setValueAtTime(0.25, audioContext.currentTime);

      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      // --- Session Recording Setup (separate context) ---
      // @ts-ignore
      recordingContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const recContext = recordingContextRef.current;
      const recordingMicSource = recContext.createMediaStreamSource(mediaStreamRef.current);
      recordingDestinationNodeRef.current = recContext.createMediaStreamDestination();
      
      // --- Noise Reduction for Recording ---
      const recordingNoiseGate = recContext.createDynamicsCompressor();
      recordingNoiseGate.threshold.setValueAtTime(-50, recContext.currentTime);
      recordingNoiseGate.knee.setValueAtTime(40, recContext.currentTime);
      recordingNoiseGate.ratio.setValueAtTime(12, recContext.currentTime);
      recordingNoiseGate.attack.setValueAtTime(0, recContext.currentTime);
      recordingNoiseGate.release.setValueAtTime(0.25, recContext.currentTime);
      
      recordingMicSource.connect(recordingNoiseGate);
      recordingNoiseGate.connect(recordingDestinationNodeRef.current);

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
      // --- End Recording Setup ---


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
      
      // Connect the audio graph for Gemini: Mic -> Noise Gate -> Script Processor -> Destination
      geminiMicSource.connect(noiseGate);
      noiseGate.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

    } catch (error) {
      console.error("Failed to start microphone:", error);
      setStatus(AppStatus.ERROR);
    }
  }, [status, stopListening, processTranscription, isReviewing, callsign, language]);

  const handleToggleListening = useCallback(() => {
    if (status === AppStatus.IDLE || status === AppStatus.ERROR) {
      startListening();
    } else {
      stopListening();
    }
  }, [status, startListening, stopListening]);
  
  const handleNewSession = useCallback(() => {
    stopListening();
    setConversationLog([]);
    setIsReviewing(false);
    setCurrentSessionId(null);
    setRecordedAudioUrl(null);
  }, [stopListening]);

  const handleLoadSession = useCallback((session: Session) => {
    stopListening();
    setConversationLog(session.log);
    setIsReviewing(true);
    setCurrentSessionId(session.id);
    setRecordedAudioUrl(null);
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
            console.warn("API key not found in environment for verification.");
            return false;
        }
        const ai = new GoogleGenAI({ apiKey });
        // A simple, fast, and cheap request to verify the key and its permissions.
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

  const handleSaveSettings = (newCallsign: string, newLanguage: LanguageCode) => {
    setCallsign(newCallsign);
    localStorage.setItem('atc-copilot-callsign', newCallsign);
    setLanguage(newLanguage);
    localStorage.setItem('atc-copilot-language', newLanguage);
    setShowSettings(false);
  };


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

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
