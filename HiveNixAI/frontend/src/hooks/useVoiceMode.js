import { useState, useRef, useEffect, useCallback } from "react";

const VOICE_STATES = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
};

// ============================================================
// SPEECH RECOGNITION
// ============================================================

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;

  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
};

const isSpeechRecognitionSupported = () => {
  return getSpeechRecognition() !== null;
};

const isSpeechSynthesisSupported = () => {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  );
};

// ============================================================
// DEFAULT RECOGNITION LANGUAGE
// ============================================================

const getDefaultRecognitionLang = () => {
  if (typeof window === "undefined") return "en-IN";

  const browserLang =
    navigator.language ||
    navigator.userLanguage ||
    "en-IN";

  const langMap = {
    hi: "hi-IN",
    "hi-IN": "hi-IN",

    bn: "bn-IN",
    "bn-IN": "bn-IN",
    "bn-BD": "bn-IN",

    ta: "ta-IN",
    "ta-IN": "ta-IN",

    te: "te-IN",
    "te-IN": "te-IN",

    mr: "mr-IN",
    "mr-IN": "mr-IN",

    gu: "gu-IN",
    "gu-IN": "gu-IN",

    kn: "kn-IN",
    "kn-IN": "kn-IN",

    ml: "ml-IN",
    "ml-IN": "ml-IN",

    pa: "pa-IN",
    "pa-IN": "pa-IN",

    ur: "ur-PK",
    "ur-PK": "ur-PK",

    en: "en-IN",
    "en-IN": "en-IN",
    "en-US": "en-US",
    "en-GB": "en-GB",
  };

  const shortLang = browserLang.split("-")[0];

  return (
    langMap[browserLang] ||
    langMap[shortLang] ||
    "en-IN"
  );
};

// ============================================================
// TTS TEXT CLEANING
// ============================================================

const STAGE_DIRECTION_PATTERNS = [
  /\[[^\]]*\]/g,

  /\(\s*(laughs|laughing|smiles|smiling|giggles|chuckles|sighs|gasps|yawns|claps|applause|whispers|thinking|excitedly|happily|angrily|sadly|pause|dramatic|nervously|confused|surprised|shocked|worried|scared|afraid|crying)\s*\)/gi,

  /\*\s*(laughs|laughing|smiles|smiling|giggles|chuckles|sighs|gasps|yawns|claps|applause|whispers|thinking|excitedly|happily|angrily|sadly|pause|dramatic|nervously|confused|surprised|shocked|worried|scared|afraid|crying|lol|rofl|rotf)\s*\*/gi,
];

const MUSIC_SFX_PATTERNS = [
  /\[?\s*(music|background music|soft music|dramatic music|sad music|upbeat music)\s*\]?/gi,

  /\[?\s*(sound effect|sfx|applause|door opens|door closes|whoosh|ding|beep)\s*\]?/gi,
];

const META_INSTRUCTION_PATTERNS = [
  /^say this:\s*/gim,
  /^tell the user:\s*/gim,
  /^assistant:\s*/gim,
  /^user:\s*/gim,
  /^system:\s*/gim,
  /^note:\s*/gim,
  /^important:\s*/gim,
];

const MARKDOWN_PATTERNS = [
  /\*\*\*([^*]+)\*\*\*/g,
  /\*\*([^*]+)\*\*/g,
  /\*([^*]+)\*/g,
  /__([^_]+)__/g,
  /~~([^~]+)~~/g,
  /`([^`]+)`/g,
  /\[([^\]]+)\]\([^)]+\)/g,
];

const URL_PATTERN = /https?:\/\/[^\s)]+/gi;

const DECORATIVE_SYMBOLS =
  /[~`#@$%^&\x5B\x5D{}|\\/<>=+*^_]/g;

const INTERNAL_SPEECH_PATTERNS = [
  /^\s*(?:github data|github mcp|mcp tool used|internal intent|tool name|repository|user)\s*:/i,
  /failed to resolve git reference/i,
  /\b404\s+not found\b/i,
  /\bgithub mcp (?:connection failed|error|result)\b/i,
  /\b(?:internal intent|mcp tool used|tool name|debug log)\b/i,
];

export const cleanTextForSpeech = (text) => {
  if (!text) return "";

  let cleaned = String(text);
  const trimmed = cleaned.trim();

  if (/^[{[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "";
    } catch {
      return "";
    }
  }

  cleaned = cleaned.split(/\r?\n/)
    .filter(line => !INTERNAL_SPEECH_PATTERNS.some(pattern => pattern.test(line)))
    .join(" ");
  if (!cleaned.trim()) return "";

  // Remove stage directions
  for (const re of STAGE_DIRECTION_PATTERNS) {
    cleaned = cleaned.replace(re, " ");
  }

  // Remove music / sound effects
  for (const re of MUSIC_SFX_PATTERNS) {
    cleaned = cleaned.replace(re, " ");
  }

  // Remove meta instructions
  for (const re of META_INSTRUCTION_PATTERNS) {
    cleaned = cleaned.replace(re, " ");
  }

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

  // Remove URLs
  cleaned = cleaned.replace(URL_PATTERN, " ");

  // Do not speak repository identifiers or slash-delimited source paths.
  cleaned = cleaned.replace(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\b/g, " ");

  // Markdown
  for (const re of MARKDOWN_PATTERNS) {
    cleaned = cleaned.replace(re, "$1");
  }

  cleaned = cleaned
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");

  // Decorative ASCII symbols
  cleaned = cleaned.replace(DECORATIVE_SYMBOLS, " ");

  // Unicode arrows / mathematical symbols / box symbols
  cleaned = cleaned.replace(
    /[\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u25A0-\u25FF]/g,
    " "
  );

  // Common symbols
  cleaned = cleaned.replace(
    /[✓✔✕✖★☆→←↑↓⇒⇐•◦▪▫■□◆◇]/g,
    " "
  );

  // Emojis
  cleaned = cleaned
    .replace(
      /[\u{1F300}-\u{1FAFF}\uFE00-\uFE0F]/gu,
      " "
    )
    .replace(
      /[\u2600-\u26FF\u2700-\u27BF]/g,
      " "
    );

  // Currency symbols
  cleaned = cleaned.replace(/[₹$€£¥]/g, " ");

  // Excessive punctuation
  cleaned = cleaned.replace(
    /[.!?…]{2,}/g,
    (match) => match[0]
  );

  cleaned = cleaned.replace(
    /[-—]{2,}/g,
    " "
  );

  cleaned = cleaned.replace(
    /[,;:]{2,}/g,
    " "
  );

  // Collapse whitespace
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
};

// ============================================================
// LANGUAGE DETECTION FOR TTS
// ============================================================

export const detectLanguage = (text) => {
  if (!text?.trim()) return "en-IN";

  // Hindi / Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi-IN";
  }

  // Bengali
  if (/[\u0980-\u09FF]/.test(text)) {
    return "bn-IN";
  }

  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(text)) {
    return "gu-IN";
  }

  // Punjabi
  if (/[\u0A00-\u0A7F]/.test(text)) {
    return "pa-IN";
  }

  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "ta-IN";
  }

  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return "te-IN";
  }

  // Kannada
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return "kn-IN";
  }

  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return "ml-IN";
  }

  // Urdu
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ur-PK";
  }

  // Chinese
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh-CN";
  }

  // Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return "ja-JP";
  }

  // Korean
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return "ko-KR";
  }

  const romanHindiWords = new Set([
    "aap", "acha", "achha", "aur", "baar", "batao", "bataiye", "bilkul", "bhi", "chaal", "chahiye",
    "ek", "hai", "hain", "ho", "hua", "hui", "ka", "kaise", "kahani", "kaha", "kahan",
    "kar", "karo", "karna", "kauva", "kawa", "kya", "kyu", "kyun", "mein", "mujhe", "nahi", "nahin",
    "paani", "pani", "dhoonda", "usne",
    "sakti", "sakta", "samjhao", "samjha", "suna", "sunao", "theek", "tum", "tha", "thi",
    "wala", "wali", "yaha", "ye", "yeh",
  ]);
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const hindiWordCount = words.filter(word => romanHindiWords.has(word)).length;
  if (hindiWordCount >= 2 || (hindiWordCount === 1 && words.length <= 3)) {
    return "hi-IN";
  }

  // Technical terms alone do not change the response language.
  return "en-IN";
};

// ============================================================
// SPLIT RESPONSE INTO LANGUAGE CHUNKS
// ============================================================

const splitTextByLanguage = (text) => {
  if (!text?.trim()) return [];

  const sentences =
    text.match(/[^.!?।]+[.!?।]?/g) || [text];

  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({
      text: sentence,
      lang: detectLanguage(sentence),
    }));
};

// ============================================================
// VOICE LOADING
// ============================================================

const ensureVoicesLoaded = () => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve([]);
      return;
    }

    const voices =
      window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    let resolved = false;

    const finish = () => {
      if (resolved) return;

      resolved = true;

      window.speechSynthesis.onvoiceschanged = null;

      resolve(
        window.speechSynthesis.getVoices()
      );
    };

    window.speechSynthesis.onvoiceschanged = finish;

    setTimeout(finish, 1000);
  });
};

// ============================================================
// FIND BEST VOICE
// ============================================================

const findBestVoice = (voices, lang) => {
  if (!voices?.length) return null;

  const languagePrefix =
    lang.split("-")[0].toLowerCase();

  // Exact match
  let voice = voices.find(
    (v) =>
      v.lang?.toLowerCase() ===
      lang.toLowerCase()
  );

  if (voice) return voice;

  // Same language
  voice = voices.find(
    (v) =>
      v.lang
        ?.toLowerCase()
        .startsWith(languagePrefix)
  );

  if (voice) return voice;

  // English fallback ONLY for English
  if (languagePrefix === "en") {
    voice =
      voices.find(
        (v) =>
          v.lang
            ?.toLowerCase()
            .startsWith("en")
      ) || null;

    if (voice) return voice;
  }

  // IMPORTANT:
  // Do NOT use English voice for Hindi.
  return null;
};

// ============================================================
// HOOK
// ============================================================

export const useVoiceMode = ({
  onTranscript,
  onError,
  autoSpeak = true,
  autoSubmitDelay = 10000,
  recognitionLang,
}) => {
  const [voiceState, setVoiceState] =
    useState(VOICE_STATES.IDLE);

  const [isVoiceModeEnabled, setIsVoiceModeEnabled] =
    useState(false);

  const [isSupported, setIsSupported] =
    useState(false);

  const [supportError, setSupportError] =
    useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  const currentUtteranceRef = useRef(null);
  const isSpeakingRef = useRef(false);

  const silenceTimerRef = useRef(null);
  const processingRef = useRef(false);

  const transcriptReceivedRef = useRef(false);
  const interimTranscriptRef = useRef("");

  const resolvedRecognitionLangRef =
    useRef(null);

  // ==========================================================
  // RESOLVE RECOGNITION LANGUAGE
  // ==========================================================

  useEffect(() => {
    resolvedRecognitionLangRef.current =
      recognitionLang ||
      getDefaultRecognitionLang();
  }, [recognitionLang]);

  // ==========================================================
  // CHECK SUPPORT
  // ==========================================================

  useEffect(() => {
    const supported =
      isSpeechRecognitionSupported();

    const ttsSupported =
      isSpeechSynthesisSupported();

    if (!supported) {
      setSupportError(
        "Speech recognition is not supported in this browser. Please use Chrome or Edge."
      );
    } else if (!ttsSupported) {
      setSupportError(
        "Speech synthesis is not supported in this browser."
      );
    }

    setIsSupported(
      supported && ttsSupported
    );

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { }
      }

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );
      }

      if (
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ==========================================================
  // CLEANUP
  // ==========================================================

  const doCleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;

        recognitionRef.current.stop();
      } catch { }

      recognitionRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(
        silenceTimerRef.current
      );

      silenceTimerRef.current = null;
    }

    if (
      typeof window !== "undefined" &&
      window.speechSynthesis
    ) {
      try {
        window.speechSynthesis.cancel();
      } catch { }
    }

    currentUtteranceRef.current = null;

    isListeningRef.current = false;
    isSpeakingRef.current = false;
    processingRef.current = false;

    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";

    setVoiceState(VOICE_STATES.IDLE);
  }, []);

  // ==========================================================
  // STOP SPEAKING
  // ==========================================================

  const stopSpeaking = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.speechSynthesis
    ) {
      try {
        window.speechSynthesis.cancel();
      } catch { }
    }

    if (currentUtteranceRef.current) {
      currentUtteranceRef.current.onend = null;
      currentUtteranceRef.current.onerror = null;
      currentUtteranceRef.current = null;
    }

    isSpeakingRef.current = false;

    if (isVoiceModeEnabled) {
      setVoiceState(VOICE_STATES.IDLE);
    }
  }, [isVoiceModeEnabled]);

  // ==========================================================
  // TEXT TO SPEECH
  // ==========================================================

  const speak = useCallback(
    async (text) => {
      if (!isVoiceModeEnabled || !autoSpeak) {
        return;
      }

      if (!isSpeechSynthesisSupported()) {
        return;
      }

      stopSpeaking();

      const cleanedText =
        cleanTextForSpeech(text);

      if (!cleanedText) {
        console.warn(
          "TTS: Nothing to speak after cleaning"
        );
        return;
      }

      console.log(
        "TTS cleaned text:",
        cleanedText
      );

      const voices =
        await ensureVoicesLoaded();

      if (!voices.length) {
        console.warn(
          "TTS: No voices available"
        );
        return;
      }

      console.log(
        "Available voices:",
        voices.map((v) => ({
          name: v.name,
          lang: v.lang,
        }))
      );

      const chunks =
        splitTextByLanguage(cleanedText);

      if (!chunks.length) return;

      isSpeakingRef.current = true;

      setVoiceState(
        VOICE_STATES.SPEAKING
      );

      const speakChunk = (index) => {
        if (
          index >= chunks.length ||
          !isVoiceModeEnabled
        ) {
          isSpeakingRef.current = false;

          currentUtteranceRef.current = null;

          if (isVoiceModeEnabled) {
            setVoiceState(
              VOICE_STATES.IDLE
            );
          }

          return;
        }

        const {
          text: chunkText,
          lang,
        } = chunks[index];

        const utterance =
          new SpeechSynthesisUtterance(
            chunkText
          );

        utterance.lang = lang;

        const voice =
          findBestVoice(
            voices,
            lang
          );

        if (voice) {
          utterance.voice = voice;

          console.log(
            "TTS voice selected:",
            {
              text: chunkText,
              requestedLanguage: lang,
              voice: voice.name,
              voiceLanguage: voice.lang,
            }
          );
        } else {
          console.warn(
            "No matching voice:",
            {
              requestedLanguage: lang,
              text: chunkText,
            }
          );
        }

        // Natural speed
        utterance.rate =
          lang === "hi-IN"
            ? 0.95
            : 1.0;

        utterance.pitch = 1;
        utterance.volume = 1;

        currentUtteranceRef.current =
          utterance;

        utterance.onend = () => {
          if (
            currentUtteranceRef.current !==
            utterance
          ) {
            return;
          }

          currentUtteranceRef.current =
            null;

          // Small gap between chunks
          setTimeout(() => {
            speakChunk(index + 1);
          }, 50);
        };

        utterance.onerror = (event) => {
          if (
            event.error !==
            "interrupted" &&
            event.error !==
            "canceled"
          ) {
            console.error(
              "Speech synthesis error:",
              event.error
            );
          }

          currentUtteranceRef.current =
            null;

          // Continue with next chunk
          setTimeout(() => {
            speakChunk(index + 1);
          }, 50);
        };

        try {
          window.speechSynthesis.speak(
            utterance
          );
        } catch (error) {
          console.error(
            "Failed to start speech:",
            error
          );

          currentUtteranceRef.current =
            null;

          speakChunk(index + 1);
        }
      };

      speakChunk(0);
    },
    [
      isVoiceModeEnabled,
      autoSpeak,
      stopSpeaking,
    ]
  );

  // ==========================================================
  // START LISTENING
  // ==========================================================

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.(
        supportError ||
        "Voice input not supported"
      );

      return;
    }

    if (isListeningRef.current) {
      return;
    }

    stopSpeaking();

    const Recognition =
      getSpeechRecognition();

    if (!Recognition) {
      onError?.(
        "Speech recognition not available"
      );

      return;
    }

    const recognition =
      new Recognition();

    recognition.continuous = false;
    recognition.interimResults = true;

    /*
     * Use the selected/default language.
     *
     * For best English + Hinglish recognition,
     * default is en-IN.
     *
     * If recognitionLang is explicitly supplied,
     * that language will be used.
     */
    recognition.lang =
      resolvedRecognitionLangRef.current ||
      "en-IN";

    recognition.maxAlternatives = 3;

    recognitionRef.current =
      recognition;

    isListeningRef.current = true;
    processingRef.current = false;
    transcriptReceivedRef.current = false;
    interimTranscriptRef.current = "";

    setVoiceState(
      VOICE_STATES.LISTENING
    );

    // ========================================================
    // SILENCE TIMER
    // ========================================================

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );
      }

      silenceTimerRef.current =
        setTimeout(() => {
          if (
            isListeningRef.current &&
            !processingRef.current &&
            interimTranscriptRef.current.trim()
          ) {
            const transcript =
              interimTranscriptRef.current.trim();

            console.log(
              "Auto submitting transcript:",
              transcript
            );

            isListeningRef.current =
              false;

            processingRef.current =
              true;

            transcriptReceivedRef.current =
              true;

            try {
              recognition.stop();
            } catch { }

            setVoiceState(
              VOICE_STATES.PROCESSING
            );

            onTranscript?.(transcript);
          } else if (
            isListeningRef.current &&
            !processingRef.current
          ) {
            try {
              recognition.stop();
            } catch { }

            isListeningRef.current =
              false;

            setVoiceState(
              VOICE_STATES.IDLE
            );
          }
        }, autoSubmitDelay);
    };

    resetSilenceTimer();

    // ========================================================
    // ON START
    // ========================================================

    recognition.onstart = () => {
      console.log(
        "Speech recognition started",
        {
          language: recognition.lang,
        }
      );

      setVoiceState(
        VOICE_STATES.LISTENING
      );
    };

    // ========================================================
    // ON RESULT
    // ========================================================

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0]
            .transcript;

        if (
          event.results[i].isFinal
        ) {
          finalTranscript +=
            transcript;
        } else {
          interimTranscript +=
            transcript;
        }
      }

      const currentTranscript =
        (
          finalTranscript ||
          interimTranscript
        ).trim();

      interimTranscriptRef.current =
        currentTranscript;

      if (currentTranscript) {
        resetSilenceTimer();
      }

      console.log(
        "Speech recognition result:",
        {
          finalTranscript,
          interimTranscript,
          currentTranscript,
          language: recognition.lang,
        }
      );

      // ======================================================
      // FINAL RESULT
      // ======================================================

      if (
        finalTranscript &&
        finalTranscript.trim()
      ) {
        transcriptReceivedRef.current =
          true;

        processingRef.current =
          true;

        isListeningRef.current =
          false;

        if (silenceTimerRef.current) {
          clearTimeout(
            silenceTimerRef.current
          );

          silenceTimerRef.current =
            null;
        }

        try {
          recognition.stop();
        } catch { }

        setVoiceState(
          VOICE_STATES.PROCESSING
        );

        onTranscript?.(
          finalTranscript.trim()
        );
      }
    };

    // ========================================================
    // ON ERROR
    // ========================================================

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      isListeningRef.current =
        false;

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );

        silenceTimerRef.current =
          null;
      }

      let errorMessage =
        "Voice recognition failed";

      switch (event.error) {
        case "no-speech":
          errorMessage =
            "No speech detected. Please try again.";
          break;

        case "audio-capture":
          errorMessage =
            "Microphone not accessible. Please check microphone permissions.";
          break;

        case "not-allowed":
          errorMessage =
            "Microphone permission denied. Please allow microphone access.";
          break;

        case "network":
          errorMessage =
            "Network error during speech recognition.";
          break;

        case "aborted":
          errorMessage =
            "Voice recognition was aborted.";
          break;

        case "language-not-supported":
          errorMessage =
            `Language ${recognition.lang} is not supported by this browser.`;
          break;

        default:
          errorMessage =
            `Recognition error: ${event.error}`;
      }

      processingRef.current = false;
      transcriptReceivedRef.current =
        false;
      interimTranscriptRef.current =
        "";

      setVoiceState(
        VOICE_STATES.IDLE
      );

      onError?.(errorMessage);
    };

    // ========================================================
    // ON END
    // ========================================================

    recognition.onend = () => {
      console.log(
        "Speech recognition ended",
        {
          transcriptReceived:
            transcriptReceivedRef.current,
        }
      );

      isListeningRef.current =
        false;

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );

        silenceTimerRef.current =
          null;
      }

      if (
        !transcriptReceivedRef.current
      ) {
        processingRef.current =
          false;

        setVoiceState(
          VOICE_STATES.IDLE
        );
      }
    };

    // ========================================================
    // START
    // ========================================================

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "Failed to start recognition:",
        error
      );

      isListeningRef.current =
        false;

      processingRef.current =
        false;

      transcriptReceivedRef.current =
        false;

      interimTranscriptRef.current =
        "";

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );

        silenceTimerRef.current =
          null;
      }

      setVoiceState(
        VOICE_STATES.IDLE
      );

      onError?.(
        "Failed to start voice recognition"
      );
    }
  }, [
    isSupported,
    supportError,
    stopSpeaking,
    onTranscript,
    onError,
    autoSubmitDelay,
  ]);

  // ==========================================================
  // STOP LISTENING
  // ==========================================================

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { }
    }

    recognitionRef.current = null;

    isListeningRef.current =
      false;

    processingRef.current =
      false;

    transcriptReceivedRef.current =
      false;

    interimTranscriptRef.current =
      "";

    if (silenceTimerRef.current) {
      clearTimeout(
        silenceTimerRef.current
      );

      silenceTimerRef.current =
        null;
    }

    setVoiceState(
      VOICE_STATES.IDLE
    );
  }, []);

  // ==========================================================
  // TOGGLE VOICE MODE
  // ==========================================================

  const toggleVoiceMode =
    useCallback(
      (enabled) => {
        const newEnabled =
          enabled !== undefined
            ? enabled
            : !isVoiceModeEnabled;

        setIsVoiceModeEnabled(
          newEnabled
        );

        if (!newEnabled) {
          stopListening();
          stopSpeaking();

          setVoiceState(
            VOICE_STATES.IDLE
          );
        }
      },
      [
        isVoiceModeEnabled,
        stopListening,
        stopSpeaking,
      ]
    );

  // ==========================================================
  // USER MESSAGE SENT
  // ==========================================================

  const handleUserMessageSent =
    useCallback(() => {
      processingRef.current =
        false;

      transcriptReceivedRef.current =
        false;

      interimTranscriptRef.current =
        "";

      if (
        isVoiceModeEnabled &&
        (
          voiceState ===
          VOICE_STATES.PROCESSING ||
          voiceState ===
          VOICE_STATES.LISTENING
        )
      ) {
        setVoiceState(
          VOICE_STATES.IDLE
        );
      }
    }, [
      isVoiceModeEnabled,
      voiceState,
    ]);

  // ==========================================================
  // AI RESPONSE RECEIVED
  // ==========================================================

  const handleAIResponseReceived =
    useCallback(
      (responseText) => {
        if (
          isVoiceModeEnabled &&
          responseText &&
          responseText.trim()
        ) {
          speak(responseText);
        }
      },
      [
        isVoiceModeEnabled,
        speak,
      ]
    );

  // ==========================================================
  // FORCE RESET
  // ==========================================================

  const forceResetVoiceState =
    useCallback(() => {
      processingRef.current =
        false;

      transcriptReceivedRef.current =
        false;

      interimTranscriptRef.current =
        "";

      isListeningRef.current =
        false;

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current
        );

        silenceTimerRef.current =
          null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { }

        recognitionRef.current =
          null;
      }

      if (
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        try {
          window.speechSynthesis.cancel();
        } catch { }
      }

      currentUtteranceRef.current =
        null;

      isSpeakingRef.current =
        false;

      setVoiceState(
        VOICE_STATES.IDLE
      );
    }, []);

  // ==========================================================
  // RETURN
  // ==========================================================

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