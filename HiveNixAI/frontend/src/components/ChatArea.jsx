import { useEffect, useState } from "react";
import Nav from "./Nav";
import ChatList from "./ChatList";
import ChatInput from "./ChatInput";

import { useDispatch, useSelector } from "react-redux";

import getMessages from "../features/getMessages";
import { setMessages } from "../redux/messageSlice";

const ChatArea = () => {

    const [isTyping, setIsTyping] = useState(false);

    const dispatch = useDispatch();

    const { selectedConversation } = useSelector(
        (state) => state.conversation
    );

    useEffect(() => {
        const fetchMessages = async () => {
            // No conversation selected
            if (!selectedConversation?._id) {
                console.log("No selected conversation");

                dispatch(setMessages([]));
                return;
            }
            if (selectedConversation) {
                if (selectedConversation.title == "New Chat") return;
            }


            console.log(
                "Fetching messages for:",
                selectedConversation._id
            );

            try {
                const data = await getMessages(
                    selectedConversation._id
                );

                console.log("Messages API response:", data);

                // Save messages in Redux
                dispatch(setMessages(data));
            } catch (error) {
                console.error(
                    "Failed to fetch messages:",
                    error
                );

                dispatch(setMessages([]));
            }
        };

        fetchMessages();
    }, [selectedConversation?._id, dispatch]);


    return (
        <div className="flex h-full min-w-0 flex-1 flex-col">
            <Nav />

            <ChatList
                isTyping={isTyping}
            />

            <ChatInput />
        </div>
    );
};

export default ChatArea;