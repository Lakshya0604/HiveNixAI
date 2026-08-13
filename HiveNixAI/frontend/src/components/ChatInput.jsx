import { Send, Paperclip, Mic } from "lucide-react";
import { useState } from "react";
import sendMessage from "../features/sendMessage"
import { useSelector } from "react-redux";

const ChatInput = () => {

    const [value, setValue] = useState("")
    const { selectedConversation } = useSelector(state => state.conversation)
    const handleSendMessage = async () => {
        const prompt = value.trim();

        if (!prompt) return;

        console.log(
            "SELECTED CONVERSATION:",
            selectedConversation
        );
        const payload = {
            prompt: prompt, conversationId: selectedConversation?._id
        }
        const data = await sendMessage(payload)
        console.log(data)

    };

    return (
        <div
            className="shrink-0 border-t border-[#3B2712]/10 bg-gradient-to-t from-[#FFF1D3] via-[#FFFBF2] to-[#FFFDF8] px-5 py-5 backdrop-blur sm:px-10"
        >
            <div className="mx-auto flex max-w-[950px] items-end gap-3 rounded-[22px] border-2 border-[#F3A712]/50 bg-white px-4 py-3 shadow-[0_3px_12px_rgba(222,138,11,0.12)] focus-within:border-[#F3A712] focus-within:ring-2 focus-within:ring-[#F3A712]/20">

                {/* ATTACH */}
                <button
                    type="button"
                    className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-none border-[#3B2712] bg-white text-[#B96B08] transition hover:bg-[#FFF1D3]"
                    aria-label="Attach file"
                >
                    <Paperclip size={22} />
                </button>
                <button className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-none border-[#3B2712] bg-white text-[#B96B08] transition hover:bg-[#FFF1D3]"><Mic /></button>

                {/* TEXTAREA */}
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}

                    rows={3}
                    placeholder="Ask Anything..."
                    className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent py-2.5 text-[18px]  text-[#3B2712] outline-none placeholder:text-[#B8A184]"
                />
                {/* SEND */}
                <button
                    type="submit"
                    disabled={!value.trim()}
                    onClick={handleSendMessage}

                    className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3A712] to-[#DE8A0B] text-white shadow-[0_6px_14px_-4px_rgba(222,138,11,0.6)] transition-all hover:scale-105 hover:shadow-[0_8px_18px_-4px_rgba(222,138,11,0.75)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    aria-label="Send message"
                >
                    <Send
                        size={20}
                        className="-rotate-12"
                    />
                </button>
            </div>
        </div>
    );
};

export default ChatInput;