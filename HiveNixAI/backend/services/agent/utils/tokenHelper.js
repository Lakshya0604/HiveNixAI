/**
 * Lightweight token estimation utility for context management.
 * Uses the common 4-characters-per-token heuristic which is accurate
 * enough for Groq/OpenAI token limits (~10-15% error margin).
 */

export const CHARS_PER_TOKEN = 4

/**
 * Estimate the number of tokens in a text string.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
    if (!text) return 0
    if (typeof text !== "string") {
        try {
            text = JSON.stringify(text)
        } catch {
            return 0
        }
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Estimate total tokens across an array of LangChain messages.
 * Adds ~4 tokens overhead per message for role/metadata.
 * @param {Array} messages
 * @returns {number}
 */
export function estimateMessageTokens(messages) {
    if (!Array.isArray(messages)) return 0
    let total = 0
    for (const msg of messages) {
        const content = typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
                ? msg.content.map(b => b.text || "").join("")
                : ""
        total += estimateTokens(content) + 4
    }
    return total
}

/**
 * Maximum input tokens we target to stay safely under the 8000 TPM limit.
 * Leaves room for output tokens and structural overhead.
 */
export const MAX_INPUT_TOKENS = 5500
export const SAFETY_MARGIN = 200
export const MAX_HISTORY_MESSAGES = 10

/**
 * Trim the history messages array so the total token count stays
 * under maxTokens, while keeping the most recent messages.
 * Preserves the latest user message.
 *
 * Also enforces a hard cap on message count as a safety net
 * (in case token estimation is inaccurate).
 */
export function trimHistoryTokens(history, systemPrompt, userPrompt, maxTokens = MAX_INPUT_TOKENS) {
    if (!Array.isArray(history) || history.length === 0) return []

    // Hard cap on message count as safety net
    const capped = history.slice(-MAX_HISTORY_MESSAGES)

    const systemTokens = estimateTokens(systemPrompt || "")
    const userTokens = estimateTokens(userPrompt || "")
    const budget = maxTokens - systemTokens - userTokens - SAFETY_MARGIN
    if (budget <= 0) return []

    const result = []
    let currentTokens = 0
    for (let i = capped.length - 1; i >= 0; i--) {
        const msgTokens = estimateMessageTokens([capped[i]])
        if (currentTokens + msgTokens <= budget) {
            result.unshift(capped[i])
            currentTokens += msgTokens
        } else {
            break
        }
    }
    return result
}

/**
 * Truncate a string to a max character length, preserving whole words.
 */
export function truncateText(text, maxChars = 3000) {
    if (!text) return ""
    if (text.length <= maxChars) return text
    const slice = text.slice(0, maxChars)
    const lastSpace = slice.lastIndexOf(" ")
    if (lastSpace > maxChars * 0.7) {
        return slice.slice(0, lastSpace) + "..."
    }
    return slice + "..."
}

/**
 * Safe error classification for LLM API errors.
 * Returns true for 413 / rate_limit_exceeded / "too large" errors.
 */
export function isTokenLimitError(error) {
    if (!error) return false
    const data = error?.response?.data || error?.data
    if (data?.error?.code === "rate_limit_exceeded" || data?.error?.type === "tokens") {
        return true
    }
    const msg = error?.message || error?.error || ""
    if (typeof msg === "string") {
        if (msg.includes("413") || msg.includes("rate_limit_exceeded") ||
            msg.includes("too large") || msg.includes("tokens")) {
            return true
        }
    }
    if (error?.status === 413 || error?.statusCode === 413) {
        return true
    }
    return false
}

/**
 * Extract safe token information from an LLM error.
 * Never exposes API keys or credentials.
 */
export function extractTokenInfo(error) {
    if (!error) return { limit: null, requested: null }
    const data = error?.response?.data || error?.data
    const apiError = data?.error || data
    const msg = apiError?.message || ""
    const limitMatch = msg.match(/Limit\s+(\d+)/i)
    const requestedMatch = msg.match(/Requested\s+(\d+)/i)
    return {
        limit: limitMatch ? parseInt(limitMatch[1]) : null,
        requested: requestedMatch ? parseInt(requestedMatch[1]) : null,
        provider: "groq",
        model: apiError?.model || "openai/gpt-oss-120b",
        code: apiError?.code || null,
        type: apiError?.type || null,
    }
}
