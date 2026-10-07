import assert from "node:assert/strict"
import "dotenv/config"
import { detectConversationDomain, filterHistoryByDomain, normalizeAgentName } from "./config/domainRouting.js"
import {
    clearGitHubContext,
    isGitHubRequest,
    setGitHubContext,
} from "./config/githubMcp.js"
import { router } from "./graph/router.js"

const githubContext = {
    domain: "github",
    selectedRepository: "Lakshya0604/TechLearn",
}

assert.equal(normalizeAgentName("imageGen"), "imageGen")
assert.equal(normalizeAgentName("image"), "imageGen")
assert.equal(normalizeAgentName("pdf"), "pdf")
assert.equal(normalizeAgentName("ppt"), "ppt")
assert.equal(normalizeAgentName("unknown-agent"), "chat")

const cases = [
    ["hello", "general", "chat"],
    ["kya tum mujhe ek kauve ki kahani suna sakti ho", "general", "chat"],
    ["ek kahani suna do", "general", "chat"],
    ["kya ho rhe ho", "general", "chat"],
    ["mujhe ek joke sunao", "general", "chat"],
    ["Suna", "general", "chat"],
    ["Show Suna", "general", "chat"],
    ["mujhe Python samjhao", "coding", "coding"],
    ["search authentication code", "github", "search"],
    ["create a PDF report", "other", null],
    ["meri public repositories dikhao", "github", "search"],
    ["show all my public repositories", "github", "search"],
    ["show repository tree of HiveNixAI", "github", "search"],
    ["Lakshya0604/TechLearn explain karo", "github", "search"],
    ["TechLearn me login flow samjhao", "github", "search"],
    ["TechLearn me authentication kaise work karta hai?", "github", "search"],
    ["TechLearn me database kaha hai?", "github", "search"],
    ["TechLearn ke API endpoints batao", "github", "search"],
    ["https://github.com/Lakshya0604/HiveNixAI", "github", "search"],
    ["show commits of HiveNixAI", "github", "search"],
    ["show issues of HiveNixAI", "github", "search"],
]

for (const [query, expectedDomain, expectedAgent] of cases) {
    const result = detectConversationDomain(query)
    assert.equal(result.domain, expectedDomain, `${query} domain`)
    assert.equal(result.agent, expectedAgent, `${query} agent`)
}

const contextCases = [
    ["iska backend samjhao", "github", true],
    ["kya tum mujhe ek kauve ki kahani suna sakti ho", "general", false],
    ["weather kaisa hai?", "weather", false],
    ["Python mein dictionary kya hoti hai?", "coding", false],
    ["kya ho rhe ho?", "general", false],
    ["isme authentication kaise hua?", "github", true],
    ["is depository ki sari files dikha do mere ko", "github", true],
]

for (const [query, expectedDomain, expectedInherited] of contextCases) {
    const result = detectConversationDomain(query, githubContext)
    assert.equal(result.domain, expectedDomain, `${query} with GitHub context`)
    assert.equal(result.contextInherited, expectedInherited, `${query} context inheritance`)
}

assert.equal(
    detectConversationDomain("iska backend samjhao", { domain: "weather", repository: "Lakshya0604/TechLearn" }).domain,
    "other",
    "a repository field under a different domain must not be inherited",
)

const taggedHistory = [
    { role: "user", content: "TechLearn explain karo", domain: "github", repository: "Lakshya0604/TechLearn" },
    { role: "assistant", content: "Repository architecture...", domain: "github", repository: "Lakshya0604/TechLearn" },
    { role: "user", content: "kya tum ek kahani suna sakti ho", domain: "general" },
    { role: "assistant", content: "Bilkul, ek kahani...", domain: "general" },
]
assert.deepEqual(filterHistoryByDomain(taggedHistory, "general").map(message => message.role), ["user", "assistant"])
assert.deepEqual(filterHistoryByDomain(taggedHistory, "github").map(message => message.role), ["user", "assistant"])

const legacyHistory = [
    { role: "user", content: "TechLearn explain karo" },
    { role: "assistant", content: "Repository architecture..." },
    { role: "user", content: "kya tum ek kahani suna sakti ho" },
    { role: "assistant", content: "Bilkul, ek kahani..." },
    { role: "user", content: "kya ho rhe ho" },
    { role: "assistant", content: "Main yahin hoon." },
]
assert.deepEqual(filterHistoryByDomain(legacyHistory, "general").map(message => message.content), [
    "kya tum ek kahani suna sakti ho",
    "Bilkul, ek kahani...",
    "kya ho rhe ho",
    "Main yahin hoon.",
])

const contextId = "domain-routing-github-isolation-test"
await setGitHubContext(contextId, githubContext)
for (const query of [
    "hello",
    "kya tum mujhe ek kauve ki kahani suna sakti ho",
    "ek kahani suna do",
    "kya ho rhe ho",
    "mujhe ek joke sunao",
    "mujhe Python samjhao",
    "weather kaisa hai?",
]) {
    assert.equal(await isGitHubRequest(query, contextId), false, `${query} must not call GitHub MCP`)
}
for (const query of [
    "TechLearn explain karo",
    "iska backend samjhao",
    "isme authentication kaise hua?",
    "is depository ki sari files dikha do mere ko",
]) {
    assert.equal(await isGitHubRequest(query, contextId), true, `${query} should use GitHub`)
}
await clearGitHubContext(contextId)

const routerContextId = "domain-routing-router-matrix-test"
await setGitHubContext(routerContextId, githubContext)
const routerCases = [
    ["hello", "chat"],
    ["kya tum mujhe ek kauve ki kahani suna sakti ho", "chat"],
    ["kya ho rhe ho", "chat"],
    ["mujhe ek joke sunao", "chat"],
    ["Show Suna", "chat"],
    ["mujhe Python samjhao", "coding"],
    ["weather kaisa hai?", "search"],
    ["TechLearn explain karo", "search"],
    ["iska backend samjhao", "search"],
]
try {
    for (const [prompt, expectedAgent] of routerCases) {
        const routed = await router({ prompt, conversationId: routerContextId, agent: "auto" })
        assert.equal(routed.agent, expectedAgent, `${prompt} router agent`)
    }
    assert.equal((await router({ prompt: "", conversationId: routerContextId, agent: "image" })).agent, "imageGen")
    assert.equal((await router({ prompt: "", conversationId: routerContextId, agent: "pdf" })).agent, "pdf")
    assert.equal((await router({ prompt: "", conversationId: routerContextId, agent: "ppt" })).agent, "ppt")
} finally {
    await clearGitHubContext(routerContextId)
}

console.log(`Domain-routing tests passed (${cases.length} current-message cases, ${contextCases.length} context cases, ${routerCases.length} router cases).`)
process.exit(0)