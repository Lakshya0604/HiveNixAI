import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";

const ChatList = ({ messages = [], isTyping = false }) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, isTyping]);

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_#FFF1D3,_#FFF8EC_60%)]">

            {/* MESSAGES AREA */}
            <div className="relative px-5 py-8 sm:px-10">

                {/* Background Pattern */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.035]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                30deg,
                                #DE8A0B 12%,
                                transparent 12.5%,
                                transparent 87%,
                                #DE8A0B 87.5%,
                                #DE8A0B
                            ),
                            linear-gradient(
                                150deg,
                                #DE8A0B 12%,
                                transparent 12.5%,
                                transparent 87%,
                                #DE8A0B 87.5%,
                                #DE8A0B
                            )
                        `,
                        backgroundSize: "44px 76px",
                    }}
                    aria-hidden="true"
                />

                {/* Chat Messages */}
                <div className="relative mx-auto flex max-w-[850px] flex-col gap-6">

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-end gap-3 ${msg.role === "user"
                                ? "flex-row-reverse"
                                : ""
                                }`}
                        >

                            {/* AGENT ICON */}
                            {msg.role === "agent" && (
                                <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] shadow-[0_4px_10px_-3px_rgba(222,138,11,0.6)]"
                                    style={{
                                        clipPath:
                                            "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
                                    }}
                                >
                                    <Bot
                                        size={17}
                                        className="text-white"
                                        strokeWidth={2}
                                    />
                                </div>
                            )}

                            {/* MESSAGE BUBBLE */}
                            <div
                                className={`max-w-[78%] rounded-2xl px-5 py-4 text-[17px] leading-relaxed shadow-sm ${msg.role === "user"
                                    ? "rounded-br-md bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-[#FFFDF8] shadow-[0_8px_18px_-8px_rgba(222,138,11,0.65)]"
                                    : "rounded-bl-md border border-[#3B2712]/10 border-l-2 border-l-[#F3A712] bg-white text-[#3B2712]"
                                    }`}
                            >

                                {/* MESSAGE TEXT */}
                                <p className="whitespace-pre-wrap">
                                    {msg.text}
                                </p>

                                {/* TIME */}
                                <p
                                    className={`mt-2 text-[12px] ${msg.role === "user"
                                        ? "text-[#FFFDF8]/75"
                                        : "text-[#B96B08]"
                                        }`}
                                >
                                    {msg.time}
                                </p>

                            </div>
                        </div>
                    ))}

                    {/* TYPING INDICATOR */}
                    {isTyping && (
                        <div className="flex items-end gap-3">

                            {/* Agent Icon */}
                            <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-br from-[#F3A712] to-[#DE8A0B]"
                                style={{
                                    clipPath:
                                        "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
                                }}
                            >
                                <Bot
                                    size={17}
                                    className="text-white"
                                    strokeWidth={2}
                                />
                            </div>

                            {/* Typing Bubble */}
                            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[#3B2712]/10 bg-white px-5 py-4 shadow-sm">

                                <span className="h-2 w-2 animate-bounce rounded-full bg-[#DE8A0B] [animation-delay:-0.3s]" />

                                <span className="h-2 w-2 animate-bounce rounded-full bg-[#DE8A0B] [animation-delay:-0.15s]" />

                                <span className="h-2 w-2 animate-bounce rounded-full bg-[#DE8A0B]" />

                            </div>
                        </div>
                    )}

                    {/* Auto Scroll Target */}
                    <div ref={bottomRef} />

                </div>
            </div>
        </div>
    );
};

export default ChatList;