import { useEffect, useState } from "react";
import Nav from "./Nav";
import ChatList from "./ChatList";
import ChatInput from "./ChatInput";

import { useDispatch, useSelector } from "react-redux";

import getMessages from "../features/getMessages";
import { setMessages } from "../redux/messageSlice";

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
    const [messages, setLocalMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const dispatch = useDispatch();

    // Redux store:
    // store -> conversation -> selectedConversation
    const { selectedConversation } = useSelector(
        (state) => state.conversation
    );

    console.log(
        "SELECTED CONVERSATION:",
        selectedConversation
    );

    useEffect(() => {
        const getMsg = async () => {
            // No conversation selected
            if (!selectedConversation?._id) {
                console.log(
                    "No selected conversation, API not called"
                );
                return;
            }

            console.log(
                "Calling getMessages for:",
                selectedConversation._id
            );

            try {
                const data = await getMessages(
                    selectedConversation._id
                );

                console.log(
                    "Messages API response:",
                    data
                );

                // Redux message state
                dispatch(setMessages(data));

                // Local state used by ChatList
                setLocalMessages(data);

            } catch (error) {
                console.error(
                    "Failed to fetch messages:",
                    error
                );
            }
        };

        getMsg();
    }, [selectedConversation, dispatch]);

    const handleSend = () => {
        const trimmed = input.trim();

        if (!trimmed) return;

        const userMessage = {
            id: Date.now(),
            role: "user",
            text: trimmed,
            time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };

        setLocalMessages((prev) => [
            ...prev,
            userMessage,
        ]);

        setInput("");
        setIsTyping(true);

        setTimeout(() => {
            const agentMessage = {
                id: Date.now() + 1,
                role: "agent",
                text: "Received. Agent pipeline isko process kar raha hai...",
                time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            };

            setLocalMessages((prev) => [
                ...prev,
                agentMessage,
            ]);

            setIsTyping(false);
        }, 900);
    };

    return (
        <div className="flex h-full min-w-0 flex-1 flex-col">
            <Nav />

            <ChatList
                messages={messages}
                isTyping={isTyping}
            />

            <ChatInput
                input={input}
                setInput={setInput}
                handleSend={handleSend}
            />
        </div>
    );
};

export default ChatArea;