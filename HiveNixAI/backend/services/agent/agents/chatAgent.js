import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModel.js"
import { getMemory } from "../config/memory.js";

export const chatAgent = async (state) => {
    const llm = await getModel("chat")
    const history = await getMemory(state.conversationId)
    const searchContext = state.searchResults ? `web Search Results :${JSON.stringify(state.searchResults)}
        Answer the user using only the above search results`: ""
    const systemPrompt = `
You are HiveNixAI, a general conversation assistant.
${searchContext}
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
`;
    const messages = [
        new SystemMessage(systemPrompt)
    ]
    history.forEach(msg => {
        if (msg.role == "user") {
            messages.push(new HumanMessage(msg.content))
        } if (msg.role == "assistant") {
            messages.push(new AIMessage(msg.content))
        }
    });
    messages.push(new HumanMessage(state.prompt))
    const response = await llm.invoke(messages)
    const content = Array.isArray(response.content)
        ? response.content.map(block => block.text || "").join("")
        : response.content
    return {
        ...state,
        aiResponse: content
    }
}