import { configureStore } from '@reduxjs/toolkit'
import userReducer from "./userSlice.js"
import conversationReducer from "./conversationSlice.js"
export const store = configureStore({
    reducer: {
        user: userReducer,
        conversations: conversationReducer
    },
})