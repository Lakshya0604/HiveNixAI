import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { useSelector } from "react-redux";
import MessageBubble from "./MessageBubble";

const ChatList = ({ isTyping = false }) => {
    // Dynamic messages from Redux
    const { messages = [] } = useSelector(
        (state) => state.message
    );

    const bottomRef = useRef(null);

    // Auto scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, isTyping]);

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_#FFF1D3,_#FFF8EC_60%)]">

            {/* MESSAGES AREA */}
            <div
                className="relative flex-1 overflow-y-auto px-5 py-8 sm:px-10"
                style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >

                {/* Hide Chrome / Edge scrollbar */}
                <style>
                    {`
                        .chat-scroll::-webkit-scrollbar {
                            display: none;
                        }
                    `}
                </style>

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

                    {/* Dynamic Messages */}
                    {messages.length > 0 ? (
                        <MessageBubble messages={messages} />
                    ) : (
                        <>
                            <div className="flex flex-col min-h-[300px] items-center justify-center">
                                <p className="text-bold text-[25px] text-[#F3A712] gap-10 m-2">
                                    HiveNixAI Multi AI agent
                                </p>
                                <p className="text-sm text-[#8B7355]">
                                    How can i help you ?
                                </p>
                                <div className="mt-2 flex flex-wrap p-4 gap-5">
                                    {["Write a Netflix clone", "Explain Redis", "Build a Navbar"].map((s) => (
                                        <button className="text-[18px] p-2 border-none rounded-full text-white bg-[#F3A712] cursor-pointer">{s}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

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