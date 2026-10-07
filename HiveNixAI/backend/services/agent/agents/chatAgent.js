import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel, safeLLMCall } from "../config/llmModel.js"
import { getMemory } from "../config/memory.js";
import { filterHistoryByDomain } from "../config/domainRouting.js";
import { estimateTokens, estimateMessageTokens, trimHistoryTokens, isTokenLimitError, extractTokenInfo, MAX_INPUT_TOKENS } from "../utils/tokenHelper.js";
import { truncateText } from "../utils/tokenHelper.js";

const DEBUG = process.env.AI_DEBUG === "true"

export const chatAgent = async (state) => {
    const llm = await getModel("chat")
    const rawHistory = await getMemory(state.conversationId) || []
    const history = filterHistoryByDomain(rawHistory, state.domain || "general")

    const searchContext = state.searchResults
        ? `web Search Results :${JSON.stringify(state.searchResults).slice(0, 2000)}
        Answer the user using only the above search results`
        : ""

    const systemPrompt = `
You are HiveNixAI, a general conversation assistant.
${searchContext || ""}
If searchContext exists:
-use search results to answer
-Do not mention internal tools.

YOUR ROLE:
You handle general conversation, explanations, learning, questions,
greetings, casual conversation, and general knowledge.

YOUR SCOPE (what you DO):
- Answer general knowledge questions
- Explain concepts and ideas in simple language
- Have casual, friendly conversations
- Help with learning and understanding
- Give advice, recommendations, and opinions
- Discuss ideas, philosophy, creativity, and daily life

YOUR BOUNDARIES (what you DO NOT do):
- DO NOT write, debug, fix, or explain code
- DO NOT write code in any programming language
- DO NOT solve programming problems
- DO NOT create PDFs, presentations, or images
- DO NOT search for current events, weather, or real-time data
- If the user asks for any of the above, politely decline and say:
  "I'm a general conversation assistant. For that, please use the
  coding / pdf / ppt / search / image agent instead."

RESPONSE STYLE:
- Be clear, concise, and well-structured
- Use Markdown formatting for readability
- Maintain a friendly, professional, and helpful tone
- Do not be unnecessarily long
- Never be rude, dismissive, or condescending
- If a request is outside your scope, say so clearly and briefly
`

    // Token-based history trimming
    const trimmedHistory = trimHistoryTokens(history, systemPrompt, state.prompt, MAX_INPUT_TOKENS)
    const historyTokens = estimateMessageTokens(history)
    const trimmedTokens = estimateMessageTokens(trimmedHistory)

    const messages = [
        new SystemMessage(systemPrompt)
    ]
    trimmedHistory.forEach(msg => {
        if (msg.role == "user") {
            messages.push(new HumanMessage(msg.content))
        }
        if (msg.role == "assistant") {
            messages.push(new AIMessage(msg.content))
        }
    })
    messages.push(new HumanMessage(state.prompt))

    const systemTokens = estimateTokens(systemPrompt)
    const userTokens = estimateTokens(state.prompt)
    const totalInputTokens = systemTokens + trimmedTokens + userTokens

    if (DEBUG) {
        console.log("[AI REQUEST - chatAgent]")
        console.log(`  model: openai/gpt-oss-120b`)
        console.log(`  message count: ${messages.length}`)
        console.log(`  estimated input tokens: ${totalInputTokens}`)
        console.log(`  system prompt tokens: ${systemTokens}`)
        console.log(`  history tokens (raw): ${historyTokens}`)
        console.log(`  history tokens (trimmed): ${trimmedTokens}`)
        console.log(`  tool context tokens: ${searchContext ? estimateTokens(searchContext) : 0}`)
        console.log(`  user message tokens: ${userTokens}`)
    }

    const response = await safeLLMCall(llm, messages)
    const content = Array.isArray(response.content)
        ? response.content.map(block => block.text || "").join("")
        : response.content

    if (DEBUG) {
        console.log("[AI RESPONSE - chatAgent]")
        console.log(`  status: OK`)
        console.log(`  model: openai/gpt-oss-120b`)
        console.log(`  latency: ${response.response_metadata ? response.response_metadata.latency_ms || "n/a" : "n/a"}ms`)
    }

    return {
        ...state,
        aiResponse: content
    }
}
