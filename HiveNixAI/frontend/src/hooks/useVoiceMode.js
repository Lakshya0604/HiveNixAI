import { useState, useRef, useEffect, useCallback } from "react";

const VOICE_STATES = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
};

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const isSpeechRecognitionSupported = () => {
  return getSpeechRecognition() !== null;
};

const isSpeechSynthesisSupported = () => {
  return typeof window !== "undefined" && "speechSynthesis" in window;
};

// Auto-detect recognition language from browser locale
const getDefaultRecognitionLang = () => {
  if (typeof window === "undefined") return "en-US";
  const browserLang = navigator.language || navigator.userLanguage || "en-US";
  // Map common browser locales to SpeechRecognition supported codes
  const langMap = {
    "hi": "hi-IN", "hi-IN": "hi-IN",
    "bn": "bn-IN", "bn-IN": "bn-IN", "bn-BD": "bn-IN",
    "ta": "ta-IN", "ta-IN": "ta-IN", "ta-LK": "ta-IN",
    "te": "te-IN", "te-IN": "te-IN",
    "mr": "mr-IN", "mr-IN": "mr-IN",
    "gu": "gu-IN", "gu-IN": "gu-IN",
    "kn": "kn-IN", "kn-IN": "kn-IN",
    "ml": "ml-IN", "ml-IN": "ml-IN",
    "pa": "pa-IN", "pa-IN": "pa-IN", "pa-PK": "pa-IN",
    "ur": "ur-PK", "ur-PK": "ur-PK", "ur-IN": "ur-PK",
    "zh": "zh-CN", "zh-CN": "zh-CN", "zh-TW": "zh-TW",
    "ja": "ja-JP", "ja-JP": "ja-JP",
    "ko": "ko-KR", "ko-KR": "ko-KR",
    "en": "en-US", "en-US": "en-US", "en-GB": "en-GB", "en-IN": "en-IN",
  };
  const shortLang = browserLang.split("-")[0];
  return langMap[browserLang] || langMap[shortLang] || "en-US";
};

// Clean text for TTS: remove emojis, normalize punctuation, handle language
const cleanTextForTTS = (text, language = "en-US") => {
  if (!text) return "";
  
  let cleaned = text;
  
  // Remove emojis and special unicode symbols
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu, "");
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");  // **bold**
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");      // *italic*
  cleaned = cleaned.replace(/`(.*?)`/g, "$1");        // `code`
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");   // code blocks
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [link](url)
  cleaned = cleaned.replace(/^#+\s+/gm, "");          // headers
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, "");    // list items
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");    // numbered lists
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
  
  // Handle punctuation - replace with pauses or remove
  cleaned = cleaned.replace(/[.!?]+/g, ". ");        // Multiple punctuation → single period + space
  cleaned = cleaned.replace(/[,;:]+/g, ", ");        // Multiple commas/semicolons → single comma + space
  cleaned = cleaned.replace(/\s+/g, " ");            // Multiple spaces → single space
  
  // Remove remaining special characters but keep basic punctuation for pauses
  cleaned = cleaned.replace(/[*#@$%^&()\[\]{}|\\/<>=+_~`]/g, "");
  
  // Remove quotes
  cleaned = cleaned.replace(/["'`]/g, "");
  
  // Trim
  cleaned = cleaned.trim();
  
  return cleaned;
};

// Detect language from text (simple heuristic) - for TTS
const detectLanguage = (text) => {
  // Hindi/Devanagari script
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  // Bengali
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  // Marathi (uses Devanagari)
  if (/[\u0900-\u097F]/.test(text)) return "mr-IN";
  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  // Kannada
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";
  // Punjabi (Gurmukhi)
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN";
  // Urdu/Arabic
  if (/[\u0600-\u06FF]/.test(text)) return "ur-PK";
  // Chinese
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";
  // Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja-JP";
  // Korean
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";
  // Default to English
  return "en-US";
};

// Ensure voices are loaded before speaking
const ensureVoicesLoaded = () => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve([]);
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };
      // Fallback timeout
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
    }
  });
};

export const useVoiceMode = ({
  onTranscript,
  onError,
  autoSpeak = true,
  autoSubmitDelay = 10000, // 10 seconds of silence to auto-submit
  recognitionLang, // Language for speech recognition (optional, auto-detects if not provided)
}) => {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [supportError, setSupportError] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const currentUtteranceRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const processingRef = useRef(false);
  const transcriptReceivedRef = useRef(false);
  const interimTranscriptRef = useRef("");
  const resolvedRecognitionLangRef = useRef(null);

  // Resolve recognition language: use provided, or auto-detect from browser
  useEffect(() => {
    resolvedRecognitionLangRef.current = recognitionLang || getDefaultRecognitionLang();
  }, [recognitionLang]);

  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    const ttsSupported = isSpeechSynthesisSupported();
    
    setIsSupported(supported && ttsSupported);
    
    if (!supported) {
      setSupportError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
    } else if (!ttsSupported) {
      setSupportError("Speech synthesis is not supported in this browser.");
    }

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore cleanup errors
      }
      recognitionRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (currentUtteranceRef.current) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Ignore
      }
      currentUtteranceRef.current = null;
    }

    isListeningRef.current = false;
    isSpeakingRef.current = false;
    processingRef.current = false;
    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";
    setVoiceState(VOICE_STATES.IDLE);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current.onend = null;
      currentUtteranceRef.current = null;
    }
    isSpeakingRef.current = false;
    if (voiceState === VOICE_STATES.SPEAKING) {
      setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
    }
  }, [voiceState, isVoiceModeEnabled]);

  const speak = useCallback(async (text) => {
    if (!isVoiceModeEnabled || !autoSpeak) return;
    if (!isSpeechSynthesisSupported()) return;

    stopSpeaking();

    // Clean text for TTS
    const cleanedText = cleanTextForTTS(text);
    if (!cleanedText) return;

    // Detect language from text for TTS
    const lang = detectLanguage(text);

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = lang;
    utterance.rate = 0.95;  // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;

    // Wait for voices to load and pick best match
    try {
      const voices = await ensureVoicesLoaded();
      const preferredVoice = voices.find(v => v.lang.startsWith(lang.split("-")[0])) || 
                            voices.find(v => v.lang === lang) ||
                            voices.find(v => v.default);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    } catch (e) {
      console.warn("Voice selection failed, using default:", e);
    }

    currentUtteranceRef.current = utterance;
    isSpeakingRef.current = true;
    setVoiceState(VOICE_STATES.SPEAKING);

    utterance.onend = () => {
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      if (isVoiceModeEnabled) {
        setVoiceState(VOICE_STATES.IDLE);
      }
    };

    utterance.onerror = (event) => {
      if (event.error !== "interrupted" && event.error !== "canceled") {
        console.error("Speech synthesis error:", event.error);
      }
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      if (isVoiceModeEnabled) {
        setVoiceState(VOICE_STATES.IDLE);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Failed to start speech synthesis:", e);
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
    }
  }, [isVoiceModeEnabled, autoSpeak, stopSpeaking]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.(supportError || "Voice input not supported");
      return;
    }

    if (isListeningRef.current) return;

    stopSpeaking();

    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      onError?.("Speech recognition not available");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = resolvedRecognitionLangRef.current; // Use resolved language
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    processingRef.current = false;
    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";
    setVoiceState(VOICE_STATES.LISTENING);

    // Auto-submit after silence period if we have interim transcript
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current && !processingRef.current && interimTranscriptRef.current.trim()) {
          console.log("Auto-submitting after silence:", interimTranscriptRef.current.trim());
          isListeningRef.current = false;
          processingRef.current = true;
          transcriptReceivedRef.current = true;
          try {
            recognition.stop();
          } catch (e) {
            // Ignore
          }
          setVoiceState(VOICE_STATES.PROCESSING);
          onTranscript?.(interimTranscriptRef.current.trim());
        } else if (isListeningRef.current && !processingRef.current) {
          // No speech at all - just stop listening
          console.log("No speech detected, stopping recognition");
          try {
            recognition.stop();
          } catch (e) {
            // Ignore
          }
          isListeningRef.current = false;
          setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
        }
      }, autoSubmitDelay);
    };

    // Start initial silence timer
    resetSilenceTimer();

    recognition.onstart = () => {
      console.log("Speech recognition started, lang:", recognition.lang);
      setVoiceState(VOICE_STATES.LISTENING);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update interim transcript ref for auto-submit
      interimTranscriptRef.current = interimTranscript || finalTranscript;
      
      // Reset silence timer on any speech activity
      if (interimTranscriptRef.current.trim()) {
        resetSilenceTimer();
      }

      console.log("Recognition result:", { finalTranscript, interimTranscript, interimRef: interimTranscriptRef.current });
      
      if (finalTranscript && finalTranscript.trim()) {
        transcriptReceivedRef.current = true;
        processingRef.current = true;
        isListeningRef.current = false;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        recognition.stop();
        setVoiceState(VOICE_STATES.PROCESSING);
        onTranscript?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      let errorMessage = "Voice recognition failed";
      switch (event.error) {
        case "no-speech":
          errorMessage = "No speech detected. Please try again.";
          break;
        case "audio-capture":
          errorMessage = "Microphone not accessible. Please check permissions.";
          break;
        case "not-allowed":
          errorMessage = "Microphone permission denied. Please allow microphone access.";
          break;
        case "network":
          errorMessage = "Network error during recognition.";
          break;
        case "aborted":
          errorMessage = "Voice recognition was aborted.";
          break;
        default:
          errorMessage = `Recognition error: ${event.error}`;
      }
      
      processingRef.current = false;
      transcriptReceivedRef.current = false;
      interimTranscriptRef.current = "";
      setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended, transcriptReceived:", transcriptReceivedRef.current);
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      // Only reset to IDLE if we didn't get a final transcript
      if (!transcriptReceivedRef.current) {
        processingRef.current = false;
        setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
      }
      // If we got transcript, stay in PROCESSING until handleUserMessageSent is called
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      processingRef.current = false;
      transcriptReceivedRef.current = false;
      interimTranscriptRef.current = "";
      setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
      onError?.("Failed to start voice recognition");
    }
  }, [isSupported, supportError, isVoiceModeEnabled, voiceState, onTranscript, onError, stopSpeaking, autoSubmitDelay]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      isListeningRef.current = false;
      processingRef.current = false;
      transcriptReceivedRef.current = false;
      interimTranscriptRef.current = "";
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
    }
  }, [isVoiceModeEnabled]);

  const toggleVoiceMode = useCallback((enabled) => {
    const newEnabled = enabled !== undefined ? enabled : !isVoiceModeEnabled;
    setIsVoiceModeEnabled(newEnabled);
    
    if (!newEnabled) {
      stopListening();
      stopSpeaking();
      setVoiceState(VOICE_STATES.IDLE);
    }
  }, [isVoiceModeEnabled, stopListening, stopSpeaking]);

  const handleUserMessageSent = useCallback(() => {
    processingRef.current = false;
    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";
    if (isVoiceModeEnabled && (voiceState === VOICE_STATES.PROCESSING || voiceState === VOICE_STATES.LISTENING)) {
      setVoiceState(VOICE_STATES.IDLE);
    }
  }, [isVoiceModeEnabled, voiceState]);

  const handleAIResponseReceived = useCallback((responseText) => {
    if (isVoiceModeEnabled && responseText && responseText.trim()) {
      speak(responseText);
    }
  }, [isVoiceModeEnabled, speak]);

  const forceResetVoiceState = useCallback(() => {
    processingRef.current = false;
    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceState(isVoiceModeEnabled ? VOICE_STATES.IDLE : VOICE_STATES.IDLE);
  }, [isVoiceModeEnabled]);

  return {
    voiceState,
    isVoiceModeEnabled,
    isSupported,
    supportError,
    startListening,
    stopListening,
    toggleVoiceMode,
    stopSpeaking,
    speak,
    handleUserMessageSent,
    handleAIResponseReceived,
    forceResetVoiceState,
    VOICE_STATES,
  };
};

export default useVoiceMode;