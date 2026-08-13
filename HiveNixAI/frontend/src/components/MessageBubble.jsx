import React from "react";
import { Bot } from "lucide-react";

const MessageBubble = ({ messages = [] }) => {
    return (
        <>
            {messages.map((msg) => (
                <div
                    key={msg._id || msg.id}
                    className={`flex items-end gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""
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
                            <Bot size={17} className="text-white" strokeWidth={2} />
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
                            {msg.content}
                        </p>

                        {/* TIME */}
                        {msg.time && (
                            <p
                                className={`mt-2 text-[12px] ${msg.role === "user"
                                        ? "text-[#FFFDF8]/75"
                                        : "text-[#B96B08]"
                                    }`}
                            >
                                {msg.time}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </>
    );
};

export default MessageBubble;