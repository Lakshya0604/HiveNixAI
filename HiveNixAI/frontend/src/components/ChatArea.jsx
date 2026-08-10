import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, Paperclip } from "lucide-react";

const INITIAL_MESSAGES = [
    {
        id: 1,
        role: "agent",
        text: "Hi Lakshya, HiveNixAI agent yahan hai. Bata, kya build karna hai aaj?",
        time: "10:02 AM",
    },
    {
        id: 2,
        role: "user",
        text: "Gateway service ka health check route add karo.",
        time: "10:03 AM",
    },
    {
        id: 3,
        role: "agent",
        text: "Theek hai — /health route add kar raha hoon jo gateway aur downstream services dono ka status return karega.",
        time: "10:03 AM",
    },
];

const ChatArea = () => {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = (e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        const userMsg = {
            id: Date.now(),
            role: "user",
            text: trimmed,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // placeholder response — apne actual agent API call se replace karna
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "agent",
                    text: "Received. Agent pipeline isko process kar raha hai...",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
            ]);
            setIsTyping(false);
        }, 900);
    };

    return (
        // pehli line change:
        <div className="flex h-full flex-1 flex-col bg-[radial-gradient(circle_at_top,_#FFF1D3,_#FFF8EC_60%)]">
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-[#3B2712]/10 bg-gradient-to-r from-[#FFFDF8] via-[#FFFBF2] to-[#FFF1D3] px-5 py-3.5 backdrop-blur">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(30deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B),linear-gradient(150deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B)] [background-size:44px_76px]"
                    aria-hidden="true"
                />
                <div className="relative flex items-center gap-3">
                    <div
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] via-[#EA9A0E] to-[#DE8A0B] shadow-[0_6px_16px_-6px_rgba(222,138,11,0.6)] ring-2 ring-[#FFF1D3]"
                        style={{ clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }}
                    >
                        <Bot size={17} className="text-[#FFFDF8]" strokeWidth={2.25} />
                    </div>
                    <div>
                        <p className="bg-gradient-to-r from-[#B96B08] to-[#3B2712] bg-clip-text text-sm font-semibold text-transparent">
                            Agent Router
                        </p>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4CAF50] shadow-[0_0_6px_rgba(76,175,80,0.7)]" />
                            <span className="text-[11px] text-[#8A6A42]">Online · free</span>
                        </div>
                    </div>
                </div>
                <span className="relative hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F3A712]/15 to-[#DE8A0B]/15 px-3 py-1 text-[11px] font-medium text-[#B96B08] ring-1 ring-[#F3A712]/25 sm:flex">
                    <Sparkles size={12} />
                    Day 5 build
                </span>
            </div>

            {/* Messages */}
            <div className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(30deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B),linear-gradient(150deg,#DE8A0B_12%,transparent_12.5%,transparent_87%,#DE8A0B_87.5%,#DE8A0B)] [background-size:44px_76px]"
                    aria-hidden="true"
                />
                <div className="relative mx-auto flex max-w-2xl flex-col gap-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""
                                }`}
                        >
                            {msg.role === "agent" && (
                                <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] shadow-[0_4px_10px_-3px_rgba(222,138,11,0.6)]"
                                    style={{ clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }}
                                >
                                    <Bot size={13} className="text-[#FFFDF8]" />
                                </div>
                            )}
                            <div
                                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm ${msg.role === "user"
                                    ? "rounded-br-md bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-[#FFFDF8] shadow-[0_8px_18px_-8px_rgba(222,138,11,0.65)]"
                                    : "rounded-bl-md border border-[#3B2712]/10 border-l-2 border-l-[#F3A712] bg-white text-[#3B2712]"
                                    }`}
                            >
                                <p>{msg.text}</p>
                                <p
                                    className={`mt-1 text-[10px] ${msg.role === "user" ? "text-[#FFFDF8]/75" : "text-[#B96B08]"
                                        }`}
                                >
                                    {msg.time}
                                </p>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex items-end gap-2.5">
                            <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B]"
                                style={{ clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }}
                            >
                                <Bot size={13} className="text-[#FFFDF8]" />
                            </div>
                            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#3B2712]/10 bg-white px-4 py-3">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#DE8A0B] [animation-delay:-0.3s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#DE8A0B] [animation-delay:-0.15s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#DE8A0B]" />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input */}
            <form
                onSubmit={handleSend}
                className="border-t border-[#3B2712]/10 bg-gradient-to-t from-[#FFF1D3] via-[#FFFBF2] to-[#FFFDF8] px-4 py-4 backdrop-blur sm:px-8"
            >
                <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-[#3B2712]/10 bg-white px-3 py-2 shadow-sm focus-within:border-[#F3A712]/60 focus-within:ring-2 focus-within:ring-[#F3A712]/20">
                    <button
                        type="button"
                        className="mb-1 shrink-0 rounded-lg p-1.5 text-[#B96B08] hover:bg-[#FFF1D3]"
                        aria-label="Attach file"
                    >
                        <Paperclip size={17} />
                    </button>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        rows={1}
                        placeholder="Agent ko message likho..."
                        className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-[#3B2712] placeholder:text-[#8A6A42]/60 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-[#FFFDF8] shadow-[0_6px_14px_-4px_rgba(222,138,11,0.6)] transition-all hover:shadow-[0_8px_18px_-4px_rgba(222,138,11,0.75)] disabled:opacity-40 disabled:shadow-none"
                        aria-label="Send message"
                    >
                        <Send size={15} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatArea;