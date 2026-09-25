import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import dotenv from "dotenv"
const groq = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apikey: process.env.GROQ_API_KEY,
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,

})

const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    temperature: 0,
    maxRetries: 2,
})

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