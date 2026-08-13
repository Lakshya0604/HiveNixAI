import axios from "axios"
import { graph } from "../../graph/graph.js"
export const agent = async (req, res) => {
    try {
        const { prompt, conversationId } = req.body
        console.log("REQUEST BODY:", req.body)  // ← add this

        const saveRes = await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role: "user", content: prompt
        })

        const result = await graph.invoke({ prompt, conversationId })
        console.log("GRAPH RESULT:", result)  // ← agar yahan crash hua, toh graph.invoke culprit hai

        const response = result.aiResponse
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role: "assistant", content: response
        })

        return res.status(200).json(response)

    } catch (error) {
        console.error("FULL ERROR:", error.response?.data || error.message)  // ← yeh real reason dikhayega
        return res.status(500).json({ message: `agent error ${error}` })
    }
}