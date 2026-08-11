import { createSlice } from "@reduxjs/toolkit"
const conversationSlice = createSlice({
    name: "coversation",
    initialState: {
        conversations: [],
        selectedConversation: null
    },
    reducers: {
        setConversations: (state, action) => {
            state.conversations = action.payload
        },
        addConversation: (state, action) => {
            state.conversations.unshift(action.payload)
        },
        selectedConversation: (state, action) => {
            state.selectedConversation = action.payload
        }
    }
})

export const { setConversations, addConversation, selectedConversation } = conversationSlice.actions
export default conversationSlice.reducer