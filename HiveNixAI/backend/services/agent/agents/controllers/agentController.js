import axios from "axios"
import { graph } from "../../graph/graph.js"
import { addMessage } from "../../config/memory.js"
import redis from "../../../../common/redis/redis.js"
export const agent = async (req, res) => {
    try {
        const { prompt, conversationId, agent } = req.body
        await redis.del(`messages-${conversationId}`)


        const saveRes = await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role: "user", content: prompt
        })

        const result = await graph.invoke({ prompt, conversationId, agent })
        console.log("GRAPH RESULT:", result)

        const response = result.aiResponse
        // When the agent returns images but no text (image-only request),
        // use a placeholder so the chat service doesn't reject empty content.
        const safeResponse = (response == null || response === "")
            ? (result.images && result.images.length > 0
                ? "Here are the images:"
                : "I couldn't find any results.")
            : response
        await addMessage(conversationId, "user", prompt)
        console.log("REQUEST BODY:", req.body)
        await addMessage(conversationId, "assistant", safeResponse)
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role: "assistant", content: safeResponse, images: result.images
        })

        return res.status(200).json({
            answer: safeResponse,
            images: result.images
        })

    } catch (error) {
        console.error("FULL ERROR:", error.response?.data || error.message)  // ← yeh real reason dikhayega
        return res.status(500).json({ message: `agent error ${error}` })
    }
}