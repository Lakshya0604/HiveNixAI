import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
    prompt: Annotation(),
    aiResponse: Annotation(),
    agent: Annotation(),
    domain: Annotation(),
    conversationId: Annotation(),
    searchResults: Annotation(),
    images: Annotation()
})