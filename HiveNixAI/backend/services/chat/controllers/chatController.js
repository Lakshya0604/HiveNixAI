import Conversation from "../model/conversationModel.js"
import Message from "../model/messageModel.js"

export const createConversation = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        const conversation = await Conversation.create({
            userId: userId
        })
        return res.status(200).json(conversation)
    } catch (error) {
        return res.status(500).json({ message: `creating conversation error ${error}` })
    }
}

export const getConversations = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        const conversations = await Conversation.find({
            userId: userId
        }).sort({ updatedAt: -1 })
        return res.status(200).json(conversations)
    } catch (error) {
        return res.status(500).json({ message: `get conversations error ${error}` })
    }
}

export const updateConversations = async (req, res) => {
    try {
        const { id, title } = req.body
        // Line changed: findByIdAndUpdate needs an update OBJECT, not a raw string.
        // Passing `title` directly was overwriting the doc incorrectly.
        const conversations = await Conversation.findByIdAndUpdate(
            id,
            { title },      // wrapped in object
            { new: true }   // returns updated doc instead of old one
        )
        return res.status(200).json(conversations)
    } catch (error) {
        return res.status(500).json({ message: `update conversations error ${error}` })
    }
}

export const saveMessage = async (req, res) => {
    try {
        // Fixed typos: convrsationId -> conversationId, contend -> content
        const { conversationId, role, content } = req.body

        // Fixed: comma operator only checked the last condition.
        // Now all three are properly checked with ||
        if (!conversationId || !role || !content) {
            return res.status(400).json({ message: "conversationId, role and content are all required" })
        }

        const message = await Message.create({
            conversationId,
            content,
            role
        })
        return res.status(200).json(message)
    } catch (error) {
        return res.status(500).json({ message: `create message error ${error}` })
    }
}

export const getMessages = async (req, res) => {
    try {
        // Fixed: conversationId wasn't declared before this check.
        // It comes from the route param, e.g. router.get('/:conversationId', getMessages)
        const { conversationId } = req.params

        if (!conversationId) {
            return res.status(400).json({ message: "conversationId param is required" })
        }

        const messages = await Message.find({
            conversationId: conversationId
        })
        return res.status(200).json(messages)
    } catch (error) {
        return res.status(500).json({ message: `get messages error ${error}` })
    }
}