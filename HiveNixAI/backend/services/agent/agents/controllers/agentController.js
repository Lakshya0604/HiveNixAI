import axios from "axios"
import { graph } from "../../graph/graph.js"
import { addMessage } from "../../config/memory.js"
import { clearGitHubContext } from "../../config/githubMcp.js"
import { isTokenLimitError, extractTokenInfo } from "../../utils/tokenHelper.js"

export const agent = async (req, res) => {
    const MAX_RETRIES = 1
    let attempt = 0

    while (attempt <= MAX_RETRIES) {
        try {
            const { prompt, conversationId, agent } = req.body

            // NOTE: Do NOT clear Redis here. Clearing forces getMemory to
            // re-fetch ALL messages from MongoDB (no limit), which causes
            // 413 token-limit errors. Redis already holds the last 20 messages
            // via addMessage(), which is the correct trimmed history.

            const saveRes = await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
                conversationId, role: "user", content: prompt
            })

            const result = await graph.invoke({ prompt, conversationId, agent })

            const response = result.aiResponse
            // When the agent returns images but no text (image-only request),
            // use a placeholder so the chat service doesn't reject empty content.
            const safeResponse = (response == null || response === "")
                ? (result.images && result.images.length > 0
                    ? "Here are the images:"
                    : "I couldn't find any results.")
                : response

            const githubRepository = result.searchResults?.github?.repository || null
            const messageDomain = githubRepository
                ? "github"
                : result.domain || (agent === "auto" ? "general" : agent)

            if (messageDomain !== "github") {
                await clearGitHubContext(conversationId)
            }

            await addMessage(conversationId, "user", prompt, messageDomain, githubRepository)

            await addMessage(conversationId, "assistant", safeResponse, messageDomain, githubRepository)

            await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
                conversationId, role: "assistant", content: safeResponse, images: result.images
            })

            return res.status(200).json({
                success: true,
                answer: safeResponse,
                images: result.images
            })

        } catch (error) {
            // Handle 413 token limit errors - return structured error, do NOT retry
            if (isTokenLimitError(error)) {
                const tokenInfo = extractTokenInfo(error)
                console.error("[API ERROR] 413 LLM_REQUEST_TOO_LARGE", {
                    status: 413,
                    provider: tokenInfo.provider,
                    model: tokenInfo.model,
                    code: tokenInfo.code,
                    type: tokenInfo.type,
                    tokenLimit: tokenInfo.limit,
                    requested: tokenInfo.requested,
                })
                return res.status(413).json({
                    success: false,
                    error: {
                        code: "LLM_REQUEST_TOO_LARGE",
                        status: 413,
                        provider: tokenInfo.provider,
                        model: tokenInfo.model,
                        message: "AI request is too large.",
                        details: "Conversation context exceeded the configured token budget. Please try starting a new conversation or sending a shorter message.",
                    },
                    data: error?.response?.data || {},
                })
            }

            // Retry once for transient errors (network timeouts, 429, etc.)
            if (attempt < MAX_RETRIES) {
                const isTransient = !error?.response || [429, 500, 502, 503, 504].includes(error?.response?.status)
                if (isTransient) {
                    console.log("[API RECOVERY] Retrying request after transient error...")
                    attempt++
                    await new Promise(resolve => setTimeout(resolve, 800))
                    continue
                }
            }

            // Non-retryable or final attempt - return generic 500
            const safeMsg = error?.response?.data?.message || error.message || "Unknown error"
            console.error("FULL ERROR:", error?.response?.data || error.message)
            return res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    status: 500,
                    provider: "groq",
                    message: "An internal error occurred.",
                    details: safeMsg,
                }
            })
        }
    }
}
