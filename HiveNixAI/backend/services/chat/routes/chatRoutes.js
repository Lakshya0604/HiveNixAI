import express from "express"
import { createConversation, getConversations, getMessages, saveMessage, updateConversations } from "../controllers/chatController.js"
const router = express.Router()

router.get("/create-conversation", createConversation)
router.get("/get-conversation", getConversations)
router.post("/update-conversation", updateConversations)
router.post("save-message", saveMessage)
router.get("get-message/:conversationId", getMessages)

export default router