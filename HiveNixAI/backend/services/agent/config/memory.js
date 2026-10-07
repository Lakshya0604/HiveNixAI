import redis from "../../../common/redis/redis.js"
import { getMessages } from "../utils/getMessages.js"
import { truncateText } from "../utils/tokenHelper.js"

const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 8000

export const getMemory = async (conversationId) => {
    const key = `messages-${conversationId}`
    const cached = await redis.get(key)
    if (cached) {
        return JSON.parse(cached)
    }

    const messages = await getMessages(conversationId)
    if (!Array.isArray(messages)) return []
    await redis.set(key, JSON.stringify(messages), "EX", 24 * 60 * 60)
    return messages
}

export const addMessage = async (conversationId, role, content, domain = null, repository = null) => {
    const key = `messages-${conversationId}`
    const rawMessages = await redis.get(key)
    const messages = rawMessages ? JSON.parse(rawMessages) : []

    let safeContent = content
    if (typeof safeContent === "string" && safeContent.length > MAX_CONTENT_LENGTH) {
        safeContent = truncateText(safeContent, MAX_CONTENT_LENGTH)
    }

    messages.push({
        role,
        content: safeContent,
        ...(domain ? { domain } : {}),
        ...(repository ? { repository } : {}),
    })

    if (messages.length > MAX_MESSAGES) {
        messages.shift()
    }
    await redis.set(key, JSON.stringify(messages))
}
