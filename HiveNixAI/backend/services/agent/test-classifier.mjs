import "dotenv/config"
import {
    clearGitHubContext,
    extractCanonicalRepository,
    isGitHubRequest,
    resolveRepository,
    ruleIntent,
    setGitHubContext,
} from './config/githubMcp.js'

const testCases = [
    // A. Repository listing
    { query: "show all my repositories", expected: "LIST_MY_REPOSITORIES" },
    { query: "show my public repositories", expected: "LIST_PUBLIC_REPOSITORIES" },
    { query: "meri sari repositories dikhao", expected: "LIST_MY_REPOSITORIES" },
    { query: "meri public repositories dikhao", expected: "LIST_PUBLIC_REPOSITORIES" },
    { query: "मेरी सारी repositories दिखाओ", expected: "LIST_MY_REPOSITORIES" },
    { query: "मेरे public repositories दिखाओ", expected: "LIST_PUBLIC_REPOSITORIES" },

    // B. Repository structure
    { query: "show HiveNixAI structure", expected: "SHOW_REPOSITORY_TREE" },
    { query: "HiveNixAI ka structure dikhao", expected: "SHOW_REPOSITORY_TREE" },
    { query: "HiveNixAI ka folder structure batao", expected: "SHOW_REPOSITORY_TREE" },
    { query: "इस repo का structure दिखाओ", expected: "SHOW_REPOSITORY_TREE", ctx: "Lakshya0604/HiveNixAI" },

    // C. Context follow-up
    { query: "isme frontend dikhao", expected: "SHOW_REPOSITORY_TREE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "iske latest commits batao", expected: "SHOW_COMMITS", ctx: "Lakshya0604/HiveNixAI" },
    { query: "iska structure dikhao", expected: "SHOW_REPOSITORY_TREE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "इसमें frontend दिखाओ", expected: "SHOW_REPOSITORY_TREE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "इसके latest commits बताओ", expected: "SHOW_COMMITS", ctx: "Lakshya0604/HiveNixAI" },

    // D. File/code
    { query: "explain HiveNixAI/frontend/src/main.jsx", expected: "EXPLAIN_FILE" },
    { query: "show main.jsx", expected: "SHOW_FILE" },
    { query: "authentication wala code dikhao", expected: "SEARCH_CODE" },
    { query: "इस file को explain करो", expected: "EXPLAIN_FILE", ctx: "Lakshya0604/HiveNixAI" },

    // E. GitHub URLs
    { query: "https://github.com/Lakshya0604", expected: "SEARCH_REPOSITORIES" },
    { query: "https://github.com/Lakshya0604/HiveNixAI", expected: "SHOW_REPOSITORY_TREE" },

    // F. New tests from API bugs
    { query: "show HiveNixAI", expected: "SHOW_REPOSITORY_TREE" },
    { query: "show HiveNixAI repo of my github", expected: "SHOW_REPOSITORY_TREE" },
    { query: "HiveNixAI dikhao", expected: "SHOW_REPOSITORY_TREE" },
    { query: "show dummy", expected: "SHOW_REPOSITORY_TREE" },
    { query: "show khana_khajana", expected: "SHOW_REPOSITORY_TREE" },
    { query: "show portfolio-website", expected: "SHOW_REPOSITORY_TREE" },
    { query: "show dummy repo", expected: "SHOW_REPOSITORY_TREE" },
    { query: "dummy repository dikhao", expected: "SHOW_REPOSITORY_TREE" },
    { query: "khana_khajana repo dikhao", expected: "SHOW_REPOSITORY_TREE" },
    { query: "main.jsx dikhao", expected: "SHOW_FILE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "main.jsx explain karo", expected: "EXPLAIN_FILE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "frontend/src/main.jsx dikhao", expected: "SHOW_FILE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "src/main.jsx explain karo", expected: "EXPLAIN_FILE", ctx: "Lakshya0604/HiveNixAI" },
    { query: "show last commit of repo khana_khajana", expected: "SHOW_COMMITS" },
    { query: "show all repo of my github", expected: "LIST_MY_REPOSITORIES" },
    { query: "Show repository tree of HiveNixAI", expected: "SHOW_REPOSITORY_TREE", expectedRepository: "HiveNixAI" },
    { query: "Show all my public repositories", expected: "LIST_PUBLIC_REPOSITORIES", expectedRepository: "authenticated_user" },
    { query: "open portfolio website repository", expected: "SHOW_REPOSITORY_TREE", expectedRepository: "portfolio website" },
    { query: "open tech learn repository", expected: "SHOW_REPOSITORY_TREE", expectedRepository: "tech learn" },
    { query: "open this truth-seeker-ai repo of my github", expected: "SHOW_REPOSITORY_TREE", expectedRepository: "truth-seeker-ai" },
    { query: "repository ki sari files dikhao", expected: "SHOW_REPOSITORY_TREE", expectedRepository: "Lakshya0604/TechLearn", ctx: "Lakshya0604/TechLearn" },
    { query: "Lakshya0604/TechLearn explain karo", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "Lakshya0604/TechLearn" },
    { query: "Lakshya0604/HiveNixAI explain karo", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "Lakshya0604/HiveNixAI" },
    { query: "TechLearn explain karo", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me kya bana hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn ka backend kaise work karta hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me login flow samjhao", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me database kaha connect hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn ke API endpoints batao", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me AI kaha use hua hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn ki dependencies explain karo", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me is function ko explain karo", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn ke folder ka purpose kya hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn ka architecture samjhao", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me obvious bugs/risky implementation kaha ho sakti hai?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "TechLearn me possible bugs kaha hain?", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "TechLearn" },
    { query: "iska backend samjhao", expected: "UNIVERSAL_GITHUB_QUERY", expectedRepository: "Lakshya0604/TechLearn", ctx: "Lakshya0604/TechLearn" },
    { query: "search authentication code", expected: "SEARCH_CODE" },
    { query: "show commits", expected: "SHOW_COMMITS" },
    { query: "show issues", expected: "SEARCH_ISSUES" },
    { query: "show pull requests", expected: "SEARCH_PR" },
]

const nonGithubTests = ["React", "Node.js", "frontend", "JavaScript", "explain this code"]

console.log("=== GitHub Intent Classification Tests ===\n")

let passed = 0
let failed = 0

for (const tc of testCases) {
    const context = tc.ctx ? { selectedRepository: tc.ctx } : null
    const result = ruleIntent(tc.query, "Lakshya0604", context)
    const actual = result?.intent || "null"
    const actualRepo = result?.repository || "none"
    const repositoryMatches = tc.expectedRepository === undefined || actualRepo === tc.expectedRepository
    const status = actual === tc.expected && repositoryMatches ? "PASS" : "FAIL"

    if (status === "PASS") passed++
    else failed++

    console.log(`[${status}] "${tc.query}" → ${actual} (repo: ${actualRepo})`)
    if (status === "FAIL") {
        console.log(`  Expected: ${tc.expected}`)
        if (!repositoryMatches) console.log(`  Expected repository: ${tc.expectedRepository}`)
    }
}

console.log("\n=== Explicit owner/repo precedence tests ===\n")
for (const query of ["Lakshya0604/TechLearn explain karo", "Lakshya0604/HiveNixAI explain karo"]) {
    const expected = query.includes("TechLearn") ? "Lakshya0604/TechLearn" : "Lakshya0604/HiveNixAI"
    const explicit = extractCanonicalRepository(query)
    const resolved = await resolveRepository({ query, repository: "Lakshya0604" }, null)
    const status = explicit?.fullName === expected && explicit.owner === "Lakshya0604" && explicit.repo === expected.split("/")[1] && resolved === expected
    if (status) passed++
    else failed++
    console.log(`[${status ? "PASS" : "FAIL"}] "${query}" → ${resolved}`)
}

const universalContextId = "classifier-universal-followup-test"
await setGitHubContext(universalContextId, { selectedRepository: "Lakshya0604/TechLearn" })
const followUpRouted = await isGitHubRequest("iska backend samjhao", universalContextId)
await clearGitHubContext(universalContextId)
if (followUpRouted) passed++
else failed++
console.log(`[${followUpRouted ? "PASS" : "FAIL"}] follow-up uses selected GitHub repository context`)

console.log("\n=== Non-GitHub false-positive tests ===\n")
for (const q of nonGithubTests) {
    const result = await isGitHubRequest(q, null)
    const status = !result ? "PASS" : "FAIL"
    if (status === "PASS") passed++
    else failed++
    console.log(`[${status}] "${q}" - GitHub=${result}`)
}

console.log("\n=== isGitHubRequest tests for GitHub queries ===")
const ghTests = [
    "show dummy",
    "show khana_khajana",
    "show HiveNixAI",
    "main.jsx dikhao",
    "main.jsx explain karo",
    "show all repo of my github",
]
const githubContextTestId = "classifier-github-file-followups"
await setGitHubContext(githubContextTestId, { selectedRepository: "Lakshya0604/HiveNixAI" })
for (const q of ghTests) {
    const result = await isGitHubRequest(q, githubContextTestId)
    console.log(`[${result ? "PASS" : "FAIL"}] "${q}" - GitHub=${result}`)
    if (result) passed++
    else failed++
}
await clearGitHubContext(githubContextTestId)

setTimeout(() => {
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
    process.exit(failed > 0 ? 1 : 0)
}, 2000)
