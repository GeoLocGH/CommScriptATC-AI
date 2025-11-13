

// Fix: Remove LiveSession from import as it is not an exported member.
import { GoogleGenAI, Blob } from '@google/genai';
// Fix: Correct React import statement.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppStatus, ConversationEntry, Session } from './types';
import { generateReadback, generateSpeech, connectToLive, checkReadbackAccuracy } from './services/geminiService';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [callsign, setCallsign] = useState('November-One-Two-Three-Alpha-Bravo');
  const [micVolume, setMicVolume] = useState(0);
  
  const sessionPromiseRef = useRef<LiveSessionPromise | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const fullTranscriptionRef = useRef('');

  useEffect(() => {
    setSavedSessions(sessionService.getSavedSessions());
    
    const savedCallsign = localStorage.getItem('atc-copilot-callsign');
    if (savedCallsign) {
      setCallsign(savedCallsign);
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
  }, []);

  const stopListening = useCallback(async () => {
      if (conversationLog.length > 0 && !isReviewing) {
          const updatedSessions = sessionService.saveSession(conversationLog);
          setSavedSessions(updatedSessions);
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


  const processTranscription = useCallback(async (transcription: string) => {
    setStatus(AppStatus.THINKING);
    setConversationLog(prev => [...prev, { speaker: 'ATC', text: transcription }]);
    
    const readbackText = await generateReadback(transcription, callsign);

    setStatus(AppStatus.CHECKING_ACCURACY);
    const feedback = await checkReadbackAccuracy(transcription, readbackText);

    setConversationLog(prev => [...prev, { speaker: 'PILOT', text: readbackText, feedback }]);
    
    setStatus(AppStatus.SPEAKING);
    const audioBuffer = await generateSpeech(readbackText);

    if (audioBuffer) {
      // @ts-ignore
      const playbackContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContext.destination);
      source.start();
      source.onended = () => {
        playbackContext.close();
        setStatus(AppStatus.LISTENING); 
      };
    } else {
      setStatus(AppStatus.LISTENING);
    }
  }, [callsign]);


  const startListening = useCallback(async () => {
    if (status !== AppStatus.IDLE) return;
    
    setConversationLog(prev => (isReviewing ? [] : prev));
    setIsReviewing(false);
    setCurrentSessionId(null);
    setStatus(AppStatus.LISTENING);
    fullTranscriptionRef.current = '';

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      // @ts-ignore
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

      const onTranscriptionUpdate = (text: string, isFinal: boolean) => {
          if(isFinal) {
              fullTranscriptionRef.current += ` ${text}`;
              setInterimTranscription('');
              if (fullTranscriptionRef.current.trim().length > 0) {
                processTranscription(fullTranscriptionRef.current.trim());
              }
              fullTranscriptionRef.current = '';
          } else {
              setInterimTranscription(fullTranscriptionRef.current + text);
          }
      };

      const onError = (error: any) => {
        console.error("Live connection error", error);
        if (error.message && (error.message.includes("Requested entity was not found") || error.message.includes("Network error"))) {
            console.log("API key issue detected, resetting key state.");
            setIsApiKeyReady(false);
        }
        setStatus(AppStatus.ERROR);
        stopListening();
      };

      sessionPromiseRef.current = connectToLive(onTranscriptionUpdate, onError);
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      mediaStreamSourceRef.current = source;
      
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        
        // --- Calculate Volume ---
        let sum = 0.0;
        for (let i = 0; i < inputData.length; ++i) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        // Use rAF to throttle state updates for performance
        requestAnimationFrame(() => {
            setMicVolume(rms);
        });

        // --- Prepare and Send Audio Blob ---
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        const pcmBlob: Blob = {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        }
        if(sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        }
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);

    } catch (error) {
      console.error("Failed to start microphone:", error);
      setStatus(AppStatus.ERROR);
    }
  }, [status, stopListening, processTranscription, isReviewing]);

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
  }, [stopListening]);

  const handleLoadSession = useCallback((session: Session) => {
    stopListening();
    setConversationLog(session.log);
    setIsReviewing(true);
    setCurrentSessionId(session.id);
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

  const handleSelectKey = useCallback(async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    // Optimistically set the key as ready. If it fails, the onError handler will catch it.
    setIsApiKeyReady(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    setShowOnboarding(false);
  };

  const handleSaveSettings = (newCallsign: string) => {
    setCallsign(newCallsign);
    localStorage.setItem('atc-copilot-callsign', newCallsign);
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
             <ApiKeyPrompt onSelectKey={handleSelectKey} />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      {showSettings && <SettingsModal currentCallsign={callsign} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
      <div className="w-full max-w-3xl mx-auto flex flex-col space-y-6">
        <header className="text-center relative">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">Pilot's ATC Co-pilot</h1>
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