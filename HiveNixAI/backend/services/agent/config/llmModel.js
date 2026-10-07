import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import dotenv from "dotenv"
import { isTokenLimitError, extractTokenInfo } from "../utils/tokenHelper.js"

const groq = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 0,
})

const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    temperature: 0,
    maxRetries: 0,
})

/**
 * Safe LLM caller that handles 413/token-limit errors gracefully.
 * Does NOT retry on 413 - returns a structured error object instead.
 * Retries once only for transient network errors.
 */
export async function safeLLMCall(llm, messages, fallbackPrompt) {
    let lastError = null
    const maxRetries = 1

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (typeof fallbackPrompt === "string") {
                return await llm.invoke(fallbackPrompt)
            }
            return await llm.invoke(messages)
        } catch (error) {
            lastError = error

            // Do NOT retry on 413 token limit errors
            if (isTokenLimitError(error)) {
                const tokenInfo = extractTokenInfo(error)
                if (process.env.AI_DEBUG === "true") {
                    console.log("[AI ERROR - 413 token limit]")
                    console.log(`  status: 413`)
                    console.log(`  provider: ${tokenInfo.provider}`)
                    console.log(`  model: ${tokenInfo.model}`)
                    console.log(`  error code: ${tokenInfo.code}`)
                    console.log(`  error type: ${tokenInfo.type}`)
                    console.log(`  token limit: ${tokenInfo.limit}`)
                    console.log(`  requested: ${tokenInfo.requested}`)
                }
                throw Object.assign(new Error("LLM_REQUEST_TOO_LARGE"), {
                    statusCode: 413,
                    code: "LLM_REQUEST_TOO_LARGE",
                    provider: tokenInfo.provider,
                    model: tokenInfo.model,
                    tokenLimit: tokenInfo.limit,
                    requestedTokens: tokenInfo.requested,
                    originalMessage: error.message,
                })
            }

            // For non-413 errors, retry once
            if (attempt < maxRetries) {
                if (process.env.AI_DEBUG === "true") {
                    console.log("[AI ERROR - retrying]", { attempt: attempt + 1, message: error.message })
                }
                await new Promise(resolve => setTimeout(resolve, 500))
                continue
            }

            // Max retries exhausted - rethrow
            throw error
        }
    }

    throw lastError
}

export const getModel = async (agent) => {
    switch (agent) {
        case "chat":
            return groq;
        case "search":
            return groq;
        case "coding":
            return groq;
        case "pdf":
            return groq;
        case "ppt":
            return groq;
        case "imageGen":
            return groq;
        default:
            return groq;
    }
}
