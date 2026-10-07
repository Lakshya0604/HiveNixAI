import assert from "node:assert/strict"
import {
    buildUniversalGitHubContext,
    detectQueryTopics,
    executeUniversalGitHubQuery,
    planUniversalGitHubQuery,
} from "./config/universalGitHub.js"

const topicCases = [
    ["login flow samjhao", "authentication"],
    ["database kaha connect hai", "database"],
    ["backend kaise work karta hai", "backend"],
    ["AI kaha use hua hai", "AI"],
    ["API endpoints batao", "API"],
    ["dependencies explain karo", "dependencies"],
    ["function explain karo", "functions"],
    ["folder ka purpose batao", "folders"],
    ["commits dikhao", "commits"],
    ["issues kya hain", "issues"],
    ["PRs batao", "pull_requests"],
]

for (const [query, expectedTopic] of topicCases) {
    assert.ok(detectQueryTopics(query).includes(expectedTopic), `${query} should detect ${expectedTopic}`)
}

const plan = planUniversalGitHubQuery("TechLearn me login flow samjhao", "Lakshya0604/TechLearn")
assert.equal(plan.repository, "Lakshya0604/TechLearn")
assert.equal(plan.maxFiles, 5)
assert.equal(plan.maxCalls, 44)
assert.ok(plan.searches.length <= 3)

const toolCalls = []
const tools = {
    async callGitHubMCPTool(name, args) {
        toolCalls.push({ name, args })
        if (name === "search_code") {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        items: [
                            { path: "backend/controllers/authController.js" },
                            { path: "backend/routes/authRoutes.js" },
                        ],
                    }),
                }],
            }
        }
        if (name === "get_file_contents") {
            return { content: [{ type: "text", text: `content for ${args.path}` }] }
        }
        return { content: [{ type: "text", text: "[]" }] }
    },
    extractMCPText(result) {
        return result.content?.map(item => item.text || "").join("\n") || ""
    },
    async listRepositoryTree(owner, repo, path, maxDepth) {
        toolCalls.push({ name: "listRepositoryTree", args: { owner, repo, path, maxDepth } })
        return "backend/\nbackend/controllers/authController.js\nbackend/routes/authRoutes.js\n"
    },
}

const context = await executeUniversalGitHubQuery(
    "TechLearn me login flow samjhao",
    "Lakshya0604/TechLearn",
    null,
    tools,
)

assert.match(context, /Repository: Lakshya0604\/TechLearn/)
assert.match(context, /FILE: backend\/controllers\/authController\.js\nCONTENT:/)
assert.match(context, /FILE: backend\/routes\/authRoutes\.js\nCONTENT:/)
assert.ok(context.length <= 10000)
assert.ok(toolCalls.length <= 44)
assert.ok(toolCalls.filter(call => call.name === "get_file_contents").length <= 6)
assert.ok(toolCalls.every(call => ["get_file_contents", "search_code", "listRepositoryTree"].includes(call.name)))
assert.ok(toolCalls.some(call => call.name === "search_code" && call.args.query.includes("repo:Lakshya0604/TechLearn")))

const manyFilesContext = buildUniversalGitHubContext({
    query: "explain repository",
    repository: "owner/repo",
    plan: { topics: ["overview"] },
    files: Array.from({ length: 100 }, (_, index) => ({
        path: `src/file-${index}.js`,
        content: "x".repeat(5000),
    })),
})
assert.ok(manyFilesContext.length <= 10000)
assert.ok((manyFilesContext.match(/\nFILE: /g) || []).length <= 5)

console.log(`Universal GitHub planner tests passed (${topicCases.length} topics, bounded mock retrieval, context limits).`)