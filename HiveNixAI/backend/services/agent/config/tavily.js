import { TavilySearch } from "@langchain/tavily"

// General search tool — used for factual/encyclopedia queries
// (who is, what is, history, definitions, etc.)
export const searchTool = new TavilySearch({
    maxResults: 8,
    topic: "general",
    includeImages: true,
    searchDepth: "advanced",
})