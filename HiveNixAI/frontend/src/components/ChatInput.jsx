import { Send, Paperclip, Mic, Zap, MessageSquare, Code2, FileText, Presentation, Globe, ImageIcon, MicOff, ToggleRight, ToggleLeft, Square, Volume2, VolumeX } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import sendMessage from "../features/sendMessage"
import { useDispatch, useSelector } from "react-redux";
import { setMessages, addMessage } from "../redux/messageSlice";
import { addConversation, setConveTitle, setselectedConversation, } from "../redux/conversationSlice";
import { updateConversation } from "../features/updateConversation";
import { createConversation } from "../features/createConversation";
import { useVoiceMode } from "../hooks/useVoiceMode";

const ChatInput = () => {

    const [value, setValue] = useState("")
    const [selectedAgent, setSelectedAgent] = useState("auto")
    const [showVoiceError, setShowVoiceError] = useState(null)
    const [recognitionLang, setRecognitionLang] = useState(undefined) // undefined = auto-detect
    const dispatch = useDispatch();                          
    const { selectedConversation } = useSelector(state => state.conversation)

    // Voice Mode Hook
    const {
        voiceState,
        isVoiceModeEnabled,
        isSupported,
        supportError,
        startListening,
        stopListening,
        toggleVoiceMode,
        stopSpeaking,
        handleUserMessageSent,
        handleAIResponseReceived,
        forceResetVoiceState,
        VOICE_STATES,
    } = useVoiceMode({
        onTranscript: (transcript) => {
            console.log("onTranscript received:", transcript);
            setValue(transcript);
            handleUserMessageSent();
            handleSendMessage();
        },
        onError: (error) => {
            setShowVoiceError(error);
            setTimeout(() => setShowVoiceError(null), 5000);
        },
        autoSpeak: true,
        autoSubmitDelay: 10000, // 10 seconds silence auto-submit
        recognitionLang, // undefined = auto-detect from browser
    });

    const isListening = voiceState === VOICE_STATES.LISTENING;
    const isProcessing = voiceState === VOICE_STATES.PROCESSING;
    const isSpeaking = voiceState === VOICE_STATES.SPEAKING;
    const isIdle = voiceState === VOICE_STATES.IDLE;

    // Handle AI response auto-speak when messages are added
    const { messages } = useSelector(state => state.message);
    const lastMessageRef = useRef(null);
    
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === "assistant" && lastMsg !== lastMessageRef.current) {
                lastMessageRef.current = lastMsg;
                if (lastMsg.content) {
                    handleAIResponseReceived(lastMsg.content);
                }
            }
        }
    }, [messages, handleAIResponseReceived]);

    const handleSendMessage = async () => {
        const prompt = value.trim();

        if (!prompt) return;

        console.log(
            "SELECTED CONVERSATION:",
            selectedConversation
        );
        let conversation = selectedConversation
        if (!conversation) {
            const conv = await createConversation()
            dispatch(setselectedConversation(conv))
            dispatch(addConversation(conv))
            conversation = conv

        }
        if (conversation.title == "New Chat") {
            await updateConversation({ id: conversation?._id, title: value.trim() })
            dispatch(setConveTitle({ conversationId: conversation._id, title: prompt.slice(0, 40) }))
        }
        const payload = {
            prompt: prompt, conversationId: conversation?._id, agent: selectedAgent.toLowerCase()
        }
        dispatch(addMessage({
            role: "user",
            content: prompt
        }));

        setValue("")
        
        // Timeout to reset voice state if API takes too long
        const apiTimeout = setTimeout(() => {
            handleUserMessageSent();
        }, 30000);

        try {
            const data = await sendMessage(payload)
            console.log(data)
            clearTimeout(apiTimeout);

            dispatch(addMessage({
                conversationId: conversation._id,
                role: "assistant",
                content: data.answer, images: data.images
            }));

        } catch (error) {
            console.error("SEND MESSAGE FAILED:", error)
            clearTimeout(apiTimeout);
            handleUserMessageSent();
        }
    };
    const agents = [
        {
            id: "auto",
            icon: Zap,
            label: "auto"
        },
        {
            id: "chat",
            icon: MessageSquare,
            label: "chat"
        },
        {
            id: "coding",
            icon: Code2,
            label: "coding"
        },
        {
            id: "pdf",
            icon: FileText,
            label: "pdf"
        },
        {
            id: "ppt",
            icon: Presentation,
            label: "ppt"
        },
        {
            id: "search",
            icon: Globe,
            label: "search"
        },
        {
            id: "image",
            icon: ImageIcon,
            label: "image"
        }
    ]
    return (
        <div
            className="shrink-0 border-t border-[#3B2712]/10 bg-gradient-to-t from-[#FFF1D3] via-[#FFFBF2] to-[#FFFDF8] px-3 py-4 backdrop-blur sm:px-6 md:px-8 lg:px-10"
        >
            <div className="mx-auto w-full max-w-[950px]">
                {/* MAIN INPUT BOX */}
                <div className="rounded-[24px] border-2 border-[#F3A712]/50 bg-white shadow-[0_4px_16px_rgba(222,138,11,0.12)] focus-within:border-[#F3A712] focus-within:ring-2 focus-within:ring-[#F3A712]/25 transition-all duration-200">

                    {/* AGENT SELECTOR - inside the box, top row */}
                    <div className="flex items-center gap-2 overflow-x-auto border-b border-[#F3A712]/15 px-3 py-2.5 sm:px-4 scrollbar-hide">
                        <span className="mr-1 hidden shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#B96B08] sm:block">
                            Agent
                        </span>
                        {agents.map((agent) => {
                            const Icon = agent.icon;
                            const isActive = selectedAgent == agent.label;
                            return (
                                <button
                                    onClick={() => setSelectedAgent(agent.label)}
                                    key={agent.id}
                                    type="button"
                                    className={`
                                        group flex shrink-0 items-center gap-1.5
                                        rounded-lg px-2.5 py-1
                                        text-xs font-medium transition-all duration-200
                                        sm:px-3 sm:py-1.5 sm:text-sm
                                        ${isActive
                                            ? "bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-white shadow-sm"
                                            : "text-[#6F4A20] hover:bg-[#FFF1D3] hover:text-[#B96B08]"
                                        }
                                    cursor-pointer`}
                                    title={agent.label}
                                >
                                    <span
                                        className={`
                                            flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-200
                                            ${isActive
                                                ? "bg-white/25 text-white"
                                                : "bg-[#FFF1D3] text-[#C87808] group-hover:bg-[#F3A712] group-hover:text-white"
                                            }
                                        `}
                                    >
                                        <Icon size={15} strokeWidth={2} />
                                    </span>
                                    <span className="whitespace-nowrap">{agent.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* INPUT ROW - bottom row */}
                    <div className="flex items-end gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">

                        {/* ATTACH */}
                        <button
                            type="button"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-none bg-[#FFF7E7] text-[#B96B08] transition hover:bg-[#FFF1D3] sm:h-11 sm:w-11"
                            aria-label="Attach file"
                        >
                            <Paperclip size={22} />
                        </button>

                        {/* VOICE MODE CONTROLS */}
                        {isSupported ? (
                            <>
                                {/* VOICE MODE TOGGLE */}
                                <button
                                    type="button"
                                    onClick={() => toggleVoiceMode()}
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-none transition sm:h-11 sm:w-11 ${
                                        isVoiceModeEnabled
                                            ? "bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-white shadow-[0_4px_12px_-2px_rgba(222,138,11,0.5)]"
                                            : "bg-[#FFF7E7] text-[#B96B08] hover:bg-[#FFF1D3]"
                                    }`}
                                    aria-label={isVoiceModeEnabled ? "Disable Voice Mode" : "Enable Voice Mode"}
                                    title={isVoiceModeEnabled ? "Voice Mode ON - Click to disable" : "Voice Mode OFF - Click to enable"}
                                >
                                    {isVoiceModeEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>

                                {/* LANGUAGE SELECTOR - only show when voice mode is enabled */}
                                {isVoiceModeEnabled && (
                                    <select
                                        value={recognitionLang || "auto"}
                                        onChange={(e) => setRecognitionLang(e.target.value === "auto" ? undefined : e.target.value)}
                                        className="flex h-10 w-auto min-w-[130px] shrink-0 items-center px-2 py-1 rounded-xl border-none bg-[#FFF7E7] text-[#B96B08] text-sm font-medium transition hover:bg-[#FFF1D3] sm:h-11"
                                        aria-label="Speech recognition language"
                                        title="Select language for voice input (Auto = detect from browser)"
                                    >
                                        <option value="auto">🌐 Auto-detect</option>
                                        <option value="en-US">English (US)</option>
                                        <option value="hi-IN">Hindi (हिन्दी)</option>
                                        <option value="bn-IN">Bengali (বাংলা)</option>
                                        <option value="ta-IN">Tamil (தமிழ்)</option>
                                        <option value="te-IN">Telugu (తెలుగు)</option>
                                        <option value="mr-IN">Marathi (मराठी)</option>
                                        <option value="gu-IN">Gujarati (ગુજરાતી)</option>
                                        <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                                        <option value="ml-IN">Malayalam (മലയാളം)</option>
                                        <option value="pa-IN">Punjabi (ਪੰਜਾਬੀ)</option>
                                        <option value="ur-PK">Urdu (اردو)</option>
                                    </select>
                                )}

                                {/* MICROPHONE BUTTON - only show when voice mode is enabled */}
                                {isVoiceModeEnabled && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isListening) {
                                                stopListening();
                                            } else if (isProcessing || isSpeaking) {
                                                // Cancel processing/speaking and reset
                                                forceResetVoiceState();
                                            } else {
                                                startListening();
                                            }
                                        }}
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-none transition sm:h-11 sm:w-11 ${
                                            isListening
                                                ? "bg-red-500 text-white animate-pulse shadow-[0_0_0_2px_rgba(239,68,68,0.4)]"
                                                : isProcessing
                                                ? "bg-amber-500 text-white animate-pulse"
                                                : isSpeaking
                                                ? "bg-green-500 text-white animate-pulse"
                                                : "bg-[#FFF7E7] text-[#B96B08] hover:bg-[#FFF1D3]"
                                        }`}
                                        aria-label={isListening ? "Stop listening" : isProcessing ? "Cancel processing" : isSpeaking ? "Cancel speaking" : "Start voice input"}
                                        title={isListening ? "Listening... Click to stop" : isProcessing ? "Processing... Click to cancel" : isSpeaking ? "AI Speaking... Click to cancel" : "Click to speak"}
                                    >
                                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                    </button>
                                )}

                                {/* STOP SPEAKING BUTTON - only show when AI is speaking */}
                                {isVoiceModeEnabled && isSpeaking && (
                                    <button
                                        type="button"
                                        onClick={stopSpeaking}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-none bg-red-500 text-white transition hover:bg-red-600 sm:h-11 sm:w-11"
                                        aria-label="Stop speaking"
                                        title="Stop AI speech"
                                    >
                                        <VolumeX size={20} />
                                    </button>
                                )}
                            </>
                        ) : (
                            /* UNSUPPORTED BROWSER MESSAGE */
                            <button
                                type="button"
                                disabled
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-none bg-gray-100 text-gray-400 cursor-not-allowed sm:h-11 sm:w-11"
                                title={supportError || "Voice input not supported in this browser"}
                            >
                                <MicOff size={20} />
                            </button>
                        )}

                        {/* TEXTAREA */}
                        <textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder={isListening ? "Listening..." : isProcessing ? "Processing..." : "Ask Anything..."}
                            rows={1}
                            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[16px] text-[#3B2712] outline-none placeholder:text-[#B8A184] sm:text-[18px]"
                        />
                        {/* SEND */}
                        <button
                            type="submit"
                            disabled={!value.trim()}
                            onClick={handleSendMessage}

                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-white shadow-[0_6px_14px_-4px_rgba(222,138,11,0.6)] transition-all hover:scale-105 hover:shadow-[0_8px_18px_-4px_rgba(222,138,11,0.75)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:h-11 sm:w-11"
                            aria-label="Send message"
                        >
                            <Send
                                size={20}
                                className="-rotate-12"
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* VOICE MODE STATUS INDICATORS */}
            {(isVoiceModeEnabled && (isListening || isProcessing || isSpeaking)) && (
                <div className="mt-2 mx-auto w-full max-w-[950px] px-3 sm:px-4">
                    <div className="flex items-center gap-2 text-sm text-[#6F4A20] bg-[#FFFDF8] border border-[#F3A712]/30 rounded-xl px-3 py-2">
                        {isListening && (
                            <>
                                <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                <span className="font-medium">Listening...</span>
                            </>
                        )}
                        {isProcessing && (
                            <>
                                <span className="flex h-2 w-2 animate-bounce rounded-full bg-amber-500" />
                                <span className="font-medium">Processing...</span>
                            </>
                        )}
                        {isSpeaking && (
                            <>
                                <span className="flex h-2 w-2 animate-bounce [animation-delay:100ms] rounded-full bg-green-500" />
                                <span className="flex h-2 w-2 animate-bounce [animation-delay:200ms] rounded-full bg-green-500" />
                                <span className="flex h-2 w-2 animate-bounce [animation-delay:300ms] rounded-full bg-green-500" />
                                <span className="font-medium ml-1">Speaking...</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* VOICE ERROR MESSAGE */}
            {showVoiceError && (
                <div className="mt-2 mx-auto w-full max-w-[950px] px-3 sm:px-4">
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <span className="flex-shrink-0">⚠</span>
                        <span>{showVoiceError}</span>
                    </div>
                </div>
            )}

            {/* UNSUPPORTED BROWSER NOTICE */}
            {!isSupported && !isVoiceModeEnabled && (
                <div className="mt-2 mx-auto w-full max-w-[950px] px-3 sm:px-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                        <span className="flex-shrink-0">ℹ</span>
                        <span>{supportError || "Voice input is not supported in this browser. Please use Chrome, Edge, or Safari for voice features."}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInput;