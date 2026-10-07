import { execSync } from "child_process";
import {
    Client,
    StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import redis from "../../../common/redis/redis.js"
import { getModel } from "./llmModel.js"
import { detectQueryTopics, executeUniversalGitHubQuery, hasExplicitQueryTopic } from "./universalGitHub.js"
import { detectConversationDomain } from "./domainRouting.js"

// ============================================================
// GitHub MCP Client
// ============================================================

let githubClient = null
let githubTransport = null
let connectingPromise = null

const GITHUB_MCP_URL =
    process.env.GITHUB_MCP_URL || "https://api.githubcopilot.com/mcp/"

function getGitHubToken() {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN

    if (!token) {
        throw new Error(
            "GITHUB_PERSONAL_ACCESS_TOKEN is missing from .env"
        )
    }

    return token
}

// ------------------------------------------------------------
// Connect to GitHub MCP
// ------------------------------------------------------------

export async function connectGitHubMCP() {
    if (githubClient) {
        return githubClient
    }

    if (connectingPromise) {
        return connectingPromise
    }

    connectingPromise = (async () => {
        try {
            const token = getGitHubToken()

            githubClient = new Client({
                name: "search-agent-github-client",
                version: "1.0.0",
            })

            githubTransport = new StreamableHTTPClientTransport(
                new URL(GITHUB_MCP_URL),
                {
                    requestInit: {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "X-MCP-Toolsets": "context,repos,issues,pull_requests",
                            "X-MCP-Readonly": "true",
                        },
                    },
                }
            )

            await githubClient.connect(githubTransport)

            console.log("✅ GitHub MCP connected")

            return githubClient
        } catch (error) {
            githubClient = null
            githubTransport = null

            console.error(
                "❌ GitHub MCP connection failed:",
                error.message
            )

            throw error
        } finally {
            connectingPromise = null
        }
    })()

    return connectingPromise
}

// ------------------------------------------------------------
// List available GitHub MCP tools
// ------------------------------------------------------------

export async function listGitHubMCPTools() {
    const client = await connectGitHubMCP()

    const result = await client.listTools()

    return result.tools || []
}

// ------------------------------------------------------------
// Call any GitHub MCP tool
// ------------------------------------------------------------

export async function callGitHubMCPTool(toolName, args = {}, _retried = false) {
    const client = await connectGitHubMCP()

    try {
        const result = await client.callTool({
            name: toolName,
            arguments: args,
        })

        return result
    } catch (error) {
        const msg = String(error?.message || "")
        const connectionIssue = /session|closed|terminated|ECONNRESET|fetch failed|socket|502|503/i.test(msg)
        if (connectionIssue && !_retried) {
            console.warn(`GitHub MCP "${toolName}" connection issue (${msg}) — reconnecting once`)
            try { await githubClient?.close() } catch { /* ignore */ }
            githubClient = null
            githubTransport = null
            return callGitHubMCPTool(toolName, args, true)
        }
        console.error(
            `GitHub MCP tool "${toolName}" failed:`,
            msg
        )

        throw error
    }
}

// ------------------------------------------------------------
// Safe text extraction from MCP response
// ------------------------------------------------------------

export function extractMCPText(result) {
    if (!result) {
        return ""
    }

    if (Array.isArray(result.content)) {
        return result.content
            .map((item) => {
                if (item?.type === "text") {
                    return item.text || ""
                }
                if (item?.type === "resource" && item?.resource) {
                    return item.resource.text || ""
                }
                if (item?.type === "resource" && typeof item?.resource === "string") {
                    try {
                        return JSON.parse(item.resource)
                    } catch {
                        return item.resource
                    }
                }
                return ""
            })
            .filter(Boolean)
            .join("\n")
    }

    return JSON.stringify(result)
}

// ============================================================
// GitHub URL / User / Path Extractors (preserved utilities)
// ============================================================

export function extractGitHubRepo(query) {
    // 1. Full GitHub URL: github.com/owner/repo
    const urlMatch = query.match(
        /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/|$|\s)/i
    )

    if (urlMatch) {
        return `${urlMatch[1]}/${urlMatch[2]}`
    }

    // 2. Bare owner/repo syntax — MUST have higher priority than bare repo name detection.
    //    Handles: "Lakshya0604/TechLearn", "Lakshya0604/TechLearn explain karo",
    //    "show Lakshya0604/TechLearn", "repo Lakshya0604/TechLearn"
    const KNOWN_TLDS = ["com", "org", "net", "io", "dev", "app", "ai", "co", "me", "xyz", "sh", "gg"]
    const falsePositiveWords = ["show", "explain", "dikhao", "samjha", "karo", "see", "view",
        "open", "check", "browse", "find", "search", "get", "fetch", "list", "display",
        "me", "meri", "mere", "my", "ye", "yeh", "is", "iska", "iske", "isme", "in", "of",
        "the", "a", "an", "to", "for", "from", "ka", "ki", "ke", "ko", "ne", "ni", "na",
        "hai", "tha", "thi", "hain", "ho", "he", "was", "were", "is", "are", "am", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "must", "can", "shall"]

    // Pattern: bare owner/repo at start of query or after a verb/keyword
    const bareOwnerRepo = query.match(
        /(?:^|[\s'"`])([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)(?:[\s,;.)'"`]|$)/
    )
    if (bareOwnerRepo) {
        const owner = bareOwnerRepo[1]
        const repo = bareOwnerRepo[2]
        // Guard: owner must not be a common English/Hinglish word
        if (!falsePositiveWords.includes(owner.toLowerCase()) &&
            !KNOWN_TLDS.includes(owner.toLowerCase()) &&
            !/\.[A-Za-z0-9]{1,5}$/.test(repo) &&
            owner.length >= 1 && repo.length >= 1) {
            return `${owner}/${repo}`
        }
    }

    // 3. owner/repo after "repo", "repository", "github repo", "from", "in" keywords
    const afterKeyword = query.match(
        /\b(?:from|in|repo\b|github repo|repository)\s+[`"']?([A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+)[`"']?\b/i
    )

    if (afterKeyword) {
        const candidate = afterKeyword[1]
        if (!/\.[A-Za-z0-9]{1,5}$/.test(candidate.split("/")[1])) {
            return candidate
        }
    }

    // 4. owner/repo when "github", "repo", or "repository" keyword is present anywhere
    if (/\b(?:github|repo|repository)\b/i.test(query)) {
        const match = query.match(
            /\b([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)\b/i
        )
        if (match) {
            const owner = match[1].toLowerCase()
            if (KNOWN_TLDS.includes(owner) || /\.[A-Za-z0-9]{1,5}$/.test(match[2])) {
                return null
            }
            return `${match[1]}/${match[2]}`
        }
    }

    return null
}

export function extractCanonicalRepository(query) {
    const fullName = extractGitHubRepo(query || "")
    if (!fullName) return null
    const separator = fullName.indexOf("/")
    if (separator <= 0 || separator === fullName.length - 1) return null
    const owner = fullName.slice(0, separator)
    const repo = fullName.slice(separator + 1)
    const nonRepositoryWords = new Set(["bug", "bugs", "risk", "risky", "issue", "issues"])
    if (nonRepositoryWords.has(owner.toLowerCase()) || nonRepositoryWords.has(repo.toLowerCase())) return null
    return {
        owner,
        repo,
        fullName,
    }
}

export function extractGitHubUser(query) {
    const userUrlMatch = query.match(/github\.com\/([A-Za-z0-9_.-]+)(?:\?[\s]|$)/i)
    if (userUrlMatch) {
        const potentialUser = userUrlMatch[1]
        if (!potentialUser.includes(".")) return potentialUser
    }

    return null
}

function getGitRemoteInfo() {
    try {
        const remote = execSync("git remote get-url origin", {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout: 5000,
        }).trim()

        const match = remote.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/)
        if (match) {
            return { owner: match[1], repo: match[2], ownerRepo: `${match[1]}/${match[2]}` }
        }
    } catch {
        return null
    }
    return null
}

export function extractPathFromBlobUrl(query) {
    const blobMatch = query.match(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/blob\/(?:[^\/]+\/)?([^\s?#]+)/i)
    if (blobMatch) return blobMatch[1]

    const treeMatch = query.match(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/tree\/(?:[^\/]+\/)?([^\s?#]+)/i)
    if (treeMatch) return treeMatch[1]

    return null
}

export function extractFilePath(query) {
    const blobPath = extractPathFromBlobUrl(query)
    if (blobPath) return blobPath

    const noUrlQuery = query.replace(/https?:\/\/[^\s]+/g, "").trim()

    const pathMatch = noUrlQuery.match(
        /\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.\-]+(?:\.[A-Za-z0-9]+)?)\b/
    )
    if (pathMatch) return pathMatch[1]

    const shortPathMatch = noUrlQuery.match(
        /\b(?:file|path)\s+[`"']?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\-]+(?:\.[A-Za-z0-9]+)?)[`"']?/i
    )
    if (shortPathMatch) return shortPathMatch[1]

    const fileNameMatch = noUrlQuery.match(
        /\b([A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_.-]*)*\.[A-Za-z0-9]{1,5})\b/
    )
    if (fileNameMatch) {
        const candidate = fileNameMatch[1]
        if (candidate.includes("/")) return candidate
        if (!candidate.includes("/") && candidate.split(".").length >= 2) return candidate
    }

    return null
}

// ============================================================
// Language Detection
// ============================================================

const HINDI_SCRIPT_REGEX = /[\u0900-\u097F]/

const HINGLISH_WORDS = [
    "kya", "hai", "tha", "thi", "hathi", "va", "wala", "wali", "walon",
    "se", "ka", "ki", "ke", "ko", "ne", "ni", "na", "toh", "bhi", "kyun",
    "kab", "kaun", "kitne", "kaise", "mein", "par", "ant",
    "dekh", "dekho", "dikhao", "samajh", "samjho", "samjha",
    "batao", "batao", "banao", "banaye", "karo", "karke", "karna",
    "bhai", "bro", "yaar", "pls", "please", "mujhe", "mera", "meri",
    "tum", "tu", "main", "hum", "nu", "aa", "ae", "ho",
    "add", "delete", "update", "search", "fetch", "create",
]

const HINGLISH_REGEX = new RegExp(`\\b(${HINGLISH_WORDS.join("|")})\\b`, "i")

export function detectLanguage(text) {
    if (!text) return "English"

    if (HINDI_SCRIPT_REGEX.test(text)) {
        return "Hindi"
    }

    if (HINGLISH_REGEX.test(text)) {
        return "Hinglish"
    }

    return "English"
}

// ============================================================
// Authenticated User Resolution
// ============================================================

let authenticatedUserCache = null
let authenticatedUserCacheTime = 0
const AUTH_CACHE_TTL = 5 * 60 * 1000

export async function getAuthenticatedUser() {
    const now = Date.now()
    if (authenticatedUserCache && (now - authenticatedUserCacheTime < AUTH_CACHE_TTL)) {
        return authenticatedUserCache
    }

    let owner = process.env.GITHUB_DEFAULT_OWNER || null

    if (!owner) {
        try {
            const me = await callGitHubMCPTool("get_me", {})
            owner = JSON.parse(extractMCPText(me))?.login || null
        } catch {
            owner = null // get_me available nahi ya JSON nahi -> agle fallback par jao
        }
    }

    if (!owner) owner = getGitRemoteInfo()?.owner || null

    if (owner) {
        authenticatedUserCache = owner
        authenticatedUserCacheTime = now
    }
    return owner
}

// ============================================================
// Context Management (Redis-based)
// ============================================================

const GITHUB_CONTEXT_PREFIX = "github:context:"
const CONTEXT_TTL_SEC = 30 * 60

export async function getGitHubContext(conversationId) {
    if (!conversationId) return null
    try {
        const key = `${GITHUB_CONTEXT_PREFIX}${conversationId}`
        const cached = await redis.get(key)
        if (cached) {
            const ctx = JSON.parse(cached)
            if (ctx.domain && ctx.domain !== "github") return null
            // "owner/repo" format nahi hai (jaise sirf username) -> ignore
            if (ctx.selectedRepository && !ctx.selectedRepository.includes("/")) {
                delete ctx.selectedRepository
            }
            if (ctx.selectedRepository) {
                ctx.domain = "github"
                ctx.repository = ctx.selectedRepository
            }
            return ctx
        }
    } catch (err) {
        console.error("GitHub context read error:", err.message)
    }
    return null
}

export async function setGitHubContext(conversationId, context) {
    if (!conversationId) return
    try {
        const key = `${GITHUB_CONTEXT_PREFIX}${conversationId}`
        const scopedContext = {
            ...context,
            domain: "github",
            repository: context?.selectedRepository || context?.repository || null,
            timestamp: Date.now(),
        }
        await redis.set(
            key,
            JSON.stringify(scopedContext),
            "EX",
            CONTEXT_TTL_SEC
        )
    } catch (err) {
        console.error("GitHub context write error:", err.message)
    }
}

export async function clearGitHubContext(conversationId) {
    if (!conversationId) return
    try {
        const key = `${GITHUB_CONTEXT_PREFIX}${conversationId}`
        await redis.del(key)
    } catch (err) {
        console.error("GitHub context clear error:", err.message)
    }
}

// ============================================================
// GitHub Tool Registry
// ============================================================

export const githubTools = {
    listRepositories: (args) => callGitHubMCPTool("search_repositories", args),
    searchRepositories: (args) => callGitHubMCPTool("search_repositories", args),
    getRepositoryTree: (args) => callGitHubMCPTool("get_file_contents", args),
    getFileContents: (args) => callGitHubMCPTool("get_file_contents", args),
    searchCode: (args) => callGitHubMCPTool("search_code", args),
    searchIssues: (args) => callGitHubMCPTool("search_issues", args),
    listIssues: (args) => callGitHubMCPTool("list_issues", args),
    issueRead: (args) => callGitHubMCPTool("issue_read", args),
    searchPullRequests: (args) => callGitHubMCPTool("search_pull_requests", args),
    listPullRequests: (args) => callGitHubMCPTool("list_pull_requests", args),
    pullRequestRead: (args) => callGitHubMCPTool("pull_request_read", args),
    listCommits: (args) => callGitHubMCPTool("list_commits", args),
    getCommit: (args) => callGitHubMCPTool("get_commit", args),
    searchCommits: (args) => callGitHubMCPTool("search_commits", args),
    listBranches: (args) => callGitHubMCPTool("list_branches", args),
    listReleases: (args) => callGitHubMCPTool("list_releases", args),
    getLatestRelease: (args) => callGitHubMCPTool("get_latest_release", args),
    getReleaseByTag: (args) => callGitHubMCPTool("get_release_by_tag", args),
    listTags: (args) => callGitHubMCPTool("list_tags", args),
    getTag: (args) => callGitHubMCPTool("get_tag", args),
    getLabel: (args) => callGitHubMCPTool("get_label", args),
    listRepositoryCollaborators: (args) => callGitHubMCPTool("list_repository_collaborators", args),
}

export const READ_TOOL_SET = new Set([
    "listRepositories", "searchRepositories", "getRepositoryTree", "getFileContents",
    "searchCode", "searchIssues", "listIssues", "issueRead",
    "searchPullRequests", "listPullRequests", "pullRequestRead",
    "listCommits", "getCommit", "searchCommits", "listBranches",
    "listReleases", "getLatestRelease", "getReleaseByTag", "listTags",
    "getTag", "getLabel", "listRepositoryCollaborators",
])

export const WRITE_TOOL_SET = new Set([])

// ============================================================
// Intent Classifier (LLM-based)
// ============================================================

const INTENT_LABELS = [
    "LIST_MY_REPOSITORIES",
    "LIST_PUBLIC_REPOSITORIES",
    "SEARCH_REPOSITORIES",
    "SHOW_REPOSITORY_TREE",
    "SEARCH_CODE",
    "SHOW_FILE",
    "EXPLAIN_FILE",
    "FIND_FILE",
    "SEARCH_ISSUES",
    "SHOW_ISSUE",
    "SEARCH_PR",
    "SHOW_PR",
    "SHOW_PR_DIFF",
    "SHOW_COMMITS",
    "SHOW_COMMIT",
    "LIST_BRANCHES",
    "LIST_RELEASES",
    "GENERIC_GITHUB",
    "UNIVERSAL_GITHUB_QUERY",
]

const WRITE_INTENTS = new Set([
    "CREATE_FILE", "UPDATE_FILE", "DELETE_FILE",
    "CREATE_BRANCH", "CREATE_COMMIT", "CREATE_ISSUE",
    "UPDATE_ISSUE", "CLOSE_ISSUE", "CREATE_PR",
    "UPDATE_PR", "MERGE_PR", "COMMENT_ON_ISSUE",
    "COMMENT_ON_PR",
])

// ============================================================
// FIX 1: Rule-based fast-path intent classifier
// ============================================================

export function ruleIntent(query, owner, context) {
    const lowerQuery = (query || "").toLowerCase().trim()
    const origQuery = query || ""
    const repo = extractCanonicalRepository(origQuery)?.fullName || null
    const path = extractFilePath(origQuery)
    const hasRepo = Boolean(repo)
    const hasPath = Boolean(path)
    const ctxRepo = context?.selectedRepository
    const ghUser = extractGitHubUser(origQuery)

    // Helper: detect bare repo name — extract a potential repository name from the query
    // Works for PascalCase, camelCase, lowercase, kebab-case, snake_case, mixed case
    function detectBareRepoName() {
        if (hasRepo) return null
        if (hasPath) return null
        const urlParts = origQuery.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/|$)/i)
        if (urlParts) return null

        // EXCLUDE patterns that are clearly repo LISTS, not specific repos
        const listIndicators = [
            /show all my/,
            /show all repos?/,
            /show my repos?/,
            /list my repos?/,
            /list all my repos?/,
            /meri saari repos?/,
            /meri sari repos?/,
            /my repos? on github/,
            /my github repos?/,
            /मेरी सारी repositories/,
            /मेरे public repositories/,
        ]
        if (listIndicators.some(p => p.test(origQuery))) return null

        let m
        m = origQuery.match(
            /^\s*(?:open|show|view|browse|explore)\s+(.+?)\s+repo\s+of\s+(?:my\s+)?github\b/i
        )
        if (m) {
            const candidate = m[1].trim().replace(/^(?:this|the)\s+/i, "").replace(/\s+/g, " ")
            if (candidate && !/^(?:all|my|public|private|me)$/i.test(candidate)) return candidate
        }

        // Command-led names may contain spaces; resolution later fuzzy-matches them to owned repos.
        m = origQuery.match(
            /^\s*(?:open|show|view|browse|explore)\s+(.+?)\s+(?:repo|repository)\s*[.!?]*$/i
        )
        if (m) {
            const candidate = m[1].trim().replace(/\s+/g, " ")
            if (!/^(?:all|my|public|private|me|all my|my public)$/i.test(candidate)) return candidate
        }

        // "repository tree of <name>" identifies the repository after the command words.
        m = origQuery.match(
            /\b(?:repository|repo)\s+(?:tree|structure|directory|files?)\s+(?:of|for)\s+([A-Za-z0-9][A-Za-z0-9._-]+)/i
        )
        if (m && !isListRequest(m[1])) return m[1]

        // "show <repo>" pattern
        m = origQuery.match(/\bshow\s+([A-Za-z0-9][A-Za-z0-9._-]+)\b/i)
        if (m && !isListRequest(m[1]) && m[1].toLowerCase() !== "all") {
            // Skip if it looks like a file (has extension)
            if (/\.[a-z0-9]{1,5}$/i.test(m[1])) return null
            return m[1]
        }

        // "<name> repo of my github" or "show <name> repo of my github"
        m = origQuery.match(/\b([A-Za-z0-9][A-Za-z0-9._-]+)\s+repo\s+of\s+(?:my\s+)?github\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "of repo <name>" pattern (e.g., "show last commit of repo khana_khajana")
        m = origQuery.match(/\bof\s+repo(?:s|itories)?\s+([A-Za-z0-9][A-Za-z0-9._-]+)/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "<name> repo dikhao" (Hinglish)
        m = origQuery.match(/([A-Za-z0-9][A-Za-z0-9._-]+)\s+repo\s+dikhao\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "<name> ka repo dikhao" or "<name> ka repo" (Hinglish with ka)
        m = origQuery.match(/\b([A-Za-z0-9][A-Za-z0-9._-]+)\s+ka\s+(?:repo|repository)\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "<name> repo/repository/repos" (MUST come before "<name> dikhao" to avoid "repository" being captured)
        m = origQuery.match(/\b([A-Za-z0-9][A-Za-z0-9._-]+)\s+rep(?:o|os|ository|ositor)\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "show <name> repo" pattern
        m = origQuery.match(/\bshow\s+([A-Za-z0-9][A-Za-z0-9._-]+)\s+repo\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        // "<name> dikhao" (Hinglish) - skip if it looks like a file
        m = origQuery.match(/\b([A-Za-z0-9][A-Za-z0-9._-]+)\s+dikhao\b/i)
        if (m && !isListRequest(m[1])) {
            // Skip if it looks like a file (has extension)
            if (/\.[a-z0-9]{1,5}$/i.test(m[1])) return null
            return m[1]
        }

        // "repo <name>" pattern
        m = origQuery.match(/\brepo(?:s|itories)?\s+(?:of\s+(?:my\s+)?)?([A-Za-z0-9][A-Za-z0-9._-]+)/i)
        if (m && !isListRequest(m[1]) && m[1].length >= 2) {
            if (m[1].toLowerCase() === "my" || m[1].toLowerCase() === "github") return null
            return m[1]
        }

        // "<name> repo" (repo keyword after repo name)
        m = origQuery.match(/\b([A-Za-z0-9][A-Za-z0-9._-]+)\s+repo\b/i)
        if (m && !isListRequest(m[1])) return m[1]

        const repoQuestion = origQuery.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)[.,]?\s+(.+)$/)
        if (repoQuestion && /[a-z][A-Z]|\d|[_-]/.test(repoQuestion[1]) &&
            /\b(explain|describe|overview|architecture|backend|frontend|authentication|auth|login|database|api|endpoint|dependencies|dependency|function|class|component|folder|directory|purpose|bugs?|risk|risky|implementation|flow|structure|tree|files?|dikhao|kya bana|kaise|kaha|samjhao|samjha|batao)\b/i.test(repoQuestion[2])) {
            return repoQuestion[1]
        }
        return null
    }

    // Helper: check if a word indicates a list request (not a specific repo)
    function isListRequest(word) {
        const w = word.toLowerCase()
        const listWords = ["show", "get", "list", "display", "open", "view", "see", "find", "search", "explain", "tell", "give",
            "meri", "my", "all", "public", "private", "latest", "recent", "structure", "tree",
            "frontend", "backend", "repo", "repos", "repository", "repositories",
            "code", "file", "files", "commits", "commit", "branches", "branch",
            "issues", "issue", "releases", "release", "prs", "pr", "last", "history",
            "pull", "request", "requests", "of", "the", "this", "that", "a", "an", "and", "or", "in", "on", "at"]
        return listWords.includes(w)
    }

    const bareRepo = detectBareRepoName()

    // Helper: check for "my repositories" variants (multilingual)
    const MY_REPOS_PATTERNS = [
        // English - "my" + repo(s) with optional "public" in between
        /show all my repos?|show my repos?|my repos?(itories)?|my github repo|my github repos?|list my repos?|dikhao meri repos?|dikhao mere repos?|meri repositories|meri repos?ities|meri repos?|mere repositories|mere repos?ities|mere repos?|my repos? on github/i,
        // English - "my public repositories" variants
        /show all my public repo(?:sitory|sitories|s)?|my public repo(?:sitory|sitories|s)?|meri public repo(?:sitory|sitories|s)?|मेरी public repo(?:sitory|sitories|s)?|मेरे public repo(?:sitory|sitories|s)?/i,
        // Hindi Devanagari
        /मेरी रिपॉजिटरी|मेरे रेपो|मेरे रिपॉ|मेरी रिपॉ|मेरा रेपो|मेरे सारे रेपो|मेरी सारी रिपॉ|मेरी सारी रिपॉजिटरी|दिखाओ मुझे मेरे रेपो|मेरी सारी रिपॉजिटरी दिखाओ|मेरी सारी repositories दिखाओ|मेरे public repositories दिखाओ/i,
    ]
    const isMyRepos = MY_REPOS_PATTERNS.some(p => p.test(origQuery))
    const isPublic = /public/i.test(lowerQuery) && !/private/i.test(lowerQuery)
    const isMeri = isMyRepos || /\b(?:meri|mere|mera)\b|मेरी|मेरे|मेरा/i.test(origQuery)
    const isMyWithPublicRepo = /\bmy\b/i.test(lowerQuery) && /\b(repo(?:s|sitories|sitory)?|repos?)\b/i.test(lowerQuery)

    // 1) LIST_MY_REPOSITORIES / LIST_PUBLIC_REPOSITORIES — universal signals
    if (!hasRepo && !ghUser && !bareRepo) {
        if (isMyRepos || isMyWithPublicRepo) {
            return {
                intent: isPublic ? "LIST_PUBLIC_REPOSITORIES" : "LIST_MY_REPOSITORIES",
                repository: "authenticated_user",
                owner: "authenticated_user",
                path: null,
                searchTerm: null,
            }
        }
        // Broader: "meri sari repositories dikhao", "मेरी सारी repositories दिखाओ"
        if (isMeri && /repos?ities?|रेपो|रिपॉ|रिपॉजिटरी|repos?/i.test(origQuery)) {
            return {
                intent: isPublic ? "LIST_PUBLIC_REPOSITORIES" : "LIST_MY_REPOSITORIES",
                repository: "authenticated_user",
                owner: "authenticated_user",
                path: null,
                searchTerm: null,
            }
        }
    }

    // 2) LIST_PUBLIC_REPOSITORIES — explicit public keyword
    if (!hasRepo && !bareRepo && /\b(public repos?ities?|public repos?|public github repos?)\b/i.test(origQuery)) {
        return {
            intent: "LIST_PUBLIC_REPOSITORIES",
            repository: "authenticated_user",
            owner: "authenticated_user",
            path: null,
            searchTerm: null,
        }
    }

    // 2b) GitHub URL with user only (no repo) — show that user's repos
    if (ghUser && !repo) {
        return {
            intent: "SEARCH_REPOSITORIES",
            repository: null,
            owner: ghUser,
            path: null,
            searchTerm: null,
        }
    }

    // 3) LIST_COMMITS / SHOW_COMMIT — check BEFORE show_repo_tree to avoid misclassifying
    const commitsMatch = /\b(commit|commits|latest commits|last commit|commit history|latest commit)\b/i.test(origQuery) || /कमिट|कमिट्स/i.test(origQuery)
    if (commitsMatch) {
        // Explicit repo name or owner/repo takes priority
        if (hasRepo || bareRepo) {
            return { intent: "SHOW_COMMITS", repository: repo || bareRepo, owner: null, path: null, searchTerm: null }
        }
        // "iske latest commits batao" with context → commits
        if (ctxRepo) {
            return { intent: "SHOW_COMMITS", repository: ctxRepo, owner: null, path: null, searchTerm: null }
        }
        return { intent: "SHOW_COMMITS", repository: null, owner: null, path: null, searchTerm: null }
    }

    // 4) SHOW_REPOSITORY_TREE — repo name + structure/tree/files keywords (multilingual)
    const treeKeywords = /\b(structur|tree|directory|files?|browse|explore|folder|folders?|dikhao|dikha|dikhaye|file structure|directory structure|root director|kaunse files?|kaunse director|file dikhao|director dikhao|structure dikhao|tree dikhao)\b/i.test(lowerQuery)
    const treeKeywordsHi = /संरचना|फ़ाइल|फाइल|डायरेक्टरी|डिरेक्टरी|ट्री|फ़ाइलें|फाइलें|कोड|डिरेक्टरी संरचना|फ़ोल्डर|फ़ोल्डर संरचना|फ़ोल्डर स्ट्रक्चर/i.test(origQuery)
    const isExplainKeyword = /\b(explain|samjha|samajh|explain karo|samjha do|code samjha|समझ|समझा|समझाओ)\b/i.test(origQuery)
    const isGithubUrl = /github\.com\//i.test(origQuery)
    const hasUniversalTopic = hasExplicitQueryTopic(origQuery)
    const isFolderPurposeQuestion = /\b(folder|directory)\b.{0,40}\b(purpose|explain|what|why|kaam)\b|\b(purpose|explain|what|why|kaam)\b.{0,40}\b(folder|directory)\b|फ़ोल्डर.{0,40}(उद्देश्य|काम|समझ)/i.test(origQuery)

    if (hasRepo) {
        if (!isFolderPurposeQuestion && (treeKeywords || treeKeywordsHi || isGithubUrl || /\b(show|dikhao|dikha)\b/i.test(origQuery))) {
            return {
                intent: "SHOW_REPOSITORY_TREE",
                repository: repo,
                owner: null,
                path: null,
                searchTerm: null,
            }
        }
    }

    // 4b) SHOW_REPOSITORY_TREE — bare repo name (PascalCase/camelCase) + structure keywords
    if (bareRepo && !hasRepo) {
        if (!isFolderPurposeQuestion && (treeKeywords || treeKeywordsHi || /\b(show|open|view|browse|explore|dikhao|dikha)\b/i.test(origQuery))) {
            return {
                intent: "SHOW_REPOSITORY_TREE",
                repository: bareRepo,
                owner: null,
                path: null,
                searchTerm: null,
            }
        }
    }

    // 4c) EXPLAIN_FILE first for Hindi "इस file को explain करो" before SHOW_REPOSITORY_TREE context
    if (!hasRepo && ctxRepo && isExplainKeyword) {
        if (/इस file को explain करो|इस फ़ाइल को समझाओ|इस फ़ाइल को explain करो|file को explain|फ़ाइल को समझ|फाइल को explain|फ़ाइल को समझाओ/i.test(origQuery) || /explain.*करो|समझाओ.*फ़ाइल|explain.*फ़ाइल/i.test(origQuery)) {
            const extractedPath = extractFilePath(origQuery)
            return {
                intent: "EXPLAIN_FILE",
                repository: ctxRepo,
                owner: null,
                path: extractedPath || null,
                searchTerm: null,
            }
        }
    }

    // 4d) SHOW_FILE / EXPLAIN_FILE — file path present (check BEFORE context follow-up to avoid tree misclassification)
    if (hasPath) {
        if (/\b(show|open|read|file dikhao|dikhao|file|dikha)\b/i.test(lowerQuery) || /दिखाओ|दिखाओ मुझे|dikhao/i.test(origQuery)) {
            return {
                intent: "SHOW_FILE",
                repository: repo || bareRepo || ctxRepo || null,
                owner: null,
                path: path,
                searchTerm: null,
            }
        }
        if (isExplainKeyword || /explain.*करो|करो.*explain|explain करो/i.test(origQuery)) {
            return {
                intent: "EXPLAIN_FILE",
                repository: repo || bareRepo || ctxRepo || null,
                owner: null,
                path: path,
                searchTerm: null,
            }
        }
    }

    // 5) SHOW_REPOSITORY_TREE — context follow-up (user mentioned current repo context)
    if (!hasRepo && !bareRepo && ctxRepo && !isFolderPurposeQuestion) {
        if (
            treeKeywords || treeKeywordsHi ||
            /(?:isme|iske|ismi|inme|inke|iss repo|is repo|this repo|this one|yeh repo|ye repo|इसमें|इसके|इसे|इसका|इनमें|इसमें)/i.test(origQuery) ||
            /(dikhao|dikha|dikhaye|structur|tree|directory|files?|folder|फ़ाइल|फाइल|डिरेक्टरी|ट्री|संरचना)/i.test(origQuery)
        ) {
            return {
                intent: "SHOW_REPOSITORY_TREE",
                repository: ctxRepo,
                owner: null,
                path: null,
                searchTerm: null,
            }
        }
    }

    // 6) SHOW_FILE — file path present + show/open/read (fallback for no context)
    if (hasPath) {
        if (/\b(show|open|read|file dikhao|dikhao|file|dikha)\b/i.test(lowerQuery) || /दिखाओ|दिखाओ मुझे/i.test(origQuery)) {
            let repoToUse = repo || bareRepo || ctxRepo || null
            return {
                intent: "SHOW_FILE",
                repository: repoToUse,
                owner: null,
                path: path,
                searchTerm: null,
            }
        }
        if (isExplainKeyword) {
            let repoToUse = repo || bareRepo || ctxRepo || null
            return {
                intent: "EXPLAIN_FILE",
                repository: repoToUse,
                owner: null,
                path: path,
                searchTerm: null,
            }
        }
    }

    // 6b) EXPLAIN_FILE — Hindi context "इस file को explain करो" with ctxRepo
    if (!hasPath && ctxRepo && isExplainKeyword && !hasUniversalTopic) {
        const extractedPath = extractFilePath(origQuery)
        return {
            intent: "EXPLAIN_FILE",
            repository: ctxRepo,
            owner: null,
            path: extractedPath || null,
            searchTerm: null,
        }
    }

    // 7) LIST_BRANCHES — branches + current repo context
    if (/branches?\b/i.test(lowerQuery) || /शाखा|शाखाएं/i.test(origQuery)) {
        if (hasRepo) {
            return { intent: "LIST_BRANCHES", repository: repo, owner: null, path: null, searchTerm: null }
        }
        if (ctxRepo) {
            return { intent: "LIST_BRANCHES", repository: ctxRepo, owner: null, path: null, searchTerm: null }
        }
    }

    // 8) LIST_ISSUES — issues
    const isRiskAnalysis = /\b(obvious|possible|potential|risky|risk|implementation)\b|\bwhere\b.{0,20}\bbugs?\b|\bbugs?\b.{0,30}\b(where|kaha|kahan)\b/i.test(origQuery)
    if ((/\b(issue|issues|open issues|bug)\b/i.test(lowerQuery) || /इश्यू|इशू|बग|मुद्दा|मुद्दे/i.test(origQuery)) && !isRiskAnalysis) {
        if (hasRepo) {
            return { intent: "SEARCH_ISSUES", repository: repo, owner: null, path: null, searchTerm: null }
        }
        if (ctxRepo) {
            return { intent: "SEARCH_ISSUES", repository: ctxRepo, owner: null, path: null, searchTerm: null }
        }
        return { intent: "SEARCH_ISSUES", repository: null, owner: null, path: null, searchTerm: null }
    }

    // 9) LIST_PULL_REQUESTS — PRs
    if (/\b(pull requests?|pr|prs)\b/i.test(lowerQuery) || /पुल अनुरेखण|पुल रिक्वेस्ट|पीआर/i.test(origQuery)) {
        if (hasRepo) {
            return { intent: "SEARCH_PR", repository: repo, owner: null, path: null, searchTerm: null }
        }
        if (ctxRepo) {
            return { intent: "SEARCH_PR", repository: ctxRepo, owner: null, path: null, searchTerm: null }
        }
        return { intent: "SEARCH_PR", repository: null, owner: null, path: null, searchTerm: null }
    }

    // 10) LIST_RELEASES — releases
    if (/\b(release|releases|latest release)\b/i.test(lowerQuery) || /रिलीज़|रिलीज|रिलीज़ेज़/i.test(origQuery)) {
        if (hasRepo) {
            return { intent: "LIST_RELEASES", repository: repo, owner: null, path: null, searchTerm: null }
        }
        if (ctxRepo) {
            return { intent: "LIST_RELEASES", repository: ctxRepo, owner: null, path: null, searchTerm: null }
        }
    }

    // 11) SEARCH_CODE — code search (Hinglish, Hindi, English)
    const searchCodePatterns = [
        /search code|find code|code in/i,
        /code dikhao|code dhundho|code dhoondho|code dikhao|code find karo/i,
        /authentication.*code|auth.*code|login.*code/i,
        /कोड ढूंढो|कोड ढूंढ़ो|कोड दिखाओ|खोजें कोड/i,
        /authentication wala code|auth wala code|login wala code/i,
    ]
    if (!hasPath && searchCodePatterns.some(p => p.test(origQuery))) {
        const searchTerm = origQuery.replace(/\b(code|कोड|dikhao|धूंढो|find|search|खोजें|wala)\b/i, "").replace(/authentication/i, "authentication").trim()
        return {
            intent: "SEARCH_CODE",
            repository: hasRepo ? repo : ctxRepo || null,
            owner: null,
            path: null,
            searchTerm: searchTerm || null,
        }
    }

    // 12) SHOW_FILE with context — just a filename mentioned
    if (hasPath && !hasRepo && !ctxRepo) {
        return {
            intent: "SHOW_FILE",
            repository: null,
            owner: null,
            path: path,
            searchTerm: null,
        }
    }

    const isBroadRepositoryQuestion = /\b(explain|describe|overview|what|how|where|why|architecture|flow|authentication|login|database|backend|frontend|ai|api|endpoint|dependencies|dependency|function|class|component|folder|directory|purpose|bugs?|risk|risky|implementation|kya|kaise|kaha|samjha|samjhao|batao|hua|hue)\b|समझाओ|बताओ|कहाँ|कहा|कैसे|क्या|क्यों/i.test(origQuery)
    const selectedRepo = repo || bareRepo || ctxRepo
    if (selectedRepo && isBroadRepositoryQuestion) {
        const explicitRepository = extractCanonicalRepository(origQuery)
        return {
            intent: "UNIVERSAL_GITHUB_QUERY",
            repository: explicitRepository?.fullName || selectedRepo,
            owner: explicitRepository?.owner || null,
            path: null,
            searchTerm: null,
        }
    }

    return null
}

// ============================================================
// Intent Classifier (LLM-based with rule fast-path)
// ============================================================

export async function classifyGitHubIntent(query, conversationId, language, context) {
    const owner = await getAuthenticatedUser()

    // FIX 1: Try deterministic fast-path first
    const fastResult = ruleIntent(query, owner, context)
    if (fastResult) {
        return { ...fastResult, query, language, fallback: false, fastPath: true }
    }

    const llm = await getModel("search")

    const contextStr = context?.selectedRepository
        ? `Currently selected repository: ${context.selectedRepository}`
        : "No repository context yet"

    const prompt = `You are a GitHub intent classifier. Understand the user's request in any language (English, Hindi, Hinglish, or mixed) and classify it.

Available intents:
- LIST_MY_REPOSITORIES: List repos owned by the authenticated user ("my repos", "mere repo dikhao", "meri repositories", "show all my public repositories", "my GitHub", "मेरे रेपो दिखाओ")
- LIST_PUBLIC_REPOSITORIES: List only public repos owned by the authenticated user
- SEARCH_REPOSITORIES: Search for any repositories ("find React repos", "search for machine learning projects")
- SHOW_REPOSITORY_TREE: Show directory structure of a repo ("files in HIVE", "HiveNixAI ki files dikhao", "browse repo", "repository structure", "HiveNixAI ka structure dikhao", "HiveNixAI ke files dikha")
- SEARCH_CODE: Search for code within a repo or across GitHub ("find main.jsx inside HiveNixAI", "where is getMessages used", "search for auth.js")
- SHOW_FILE: Display contents of a file ("show main.jsx", "open this file", "file dikhao", "main.jsx dikhao")
- EXPLAIN_FILE: Explain code in a file ("explain main.jsx", "is file samjha do", "what does this do", "code samjha do", "HiveNixAI ke frontend/src/main.jsx ko explain karo")
- FIND_FILE: Find a file by name in a repo ("find getMessages.js", "where is getMessages", "kahan hai ye file")
- SEARCH_ISSUES: Search for issues ("find bugs", "open issues", "issue dikhao")
- SHOW_ISSUE: Show a specific issue by number
- SEARCH_PR: Search for pull requests ("find PRs", "pull request dikhao")
- SHOW_PR: Show a specific PR
- SHOW_PR_DIFF: Show PR changes/diff
- SHOW_COMMITS: Show commit history ("latest commits", "last commit", "commit history", "isme latest commits batao", "iske latest commits batao")
- SHOW_COMMIT: Show a specific commit
- LIST_BRANCHES: List branches ("all branches", "branches dikhao", "show branches", "iske branches dikhao")
- LIST_RELEASES: List releases ("all releases", "latest releases")
- GENERIC_GITHUB: GitHub-related but doesn't fit a specific intent
- UNIVERSAL_GITHUB_QUERY: Broad repository-level questions about architecture, features, flows, authentication, database, APIs, dependencies, or code behavior

Use an existing specific intent whenever the user asks for a repository list, tree, file, code search, commit, issue, pull request, branch, or release. Use UNIVERSAL_GITHUB_QUERY only for broader repository analysis.

For each classification, extract:
- intent: one of the intents above
- repository: "owner/repo" if specified, "authenticated_user" if referring to own repos, or null
- owner: the owner name if specified, "authenticated_user" if referring to own, or null
- path: file path if specified, or null
- searchTerm: search query if applicable, or null
- visibility: "public", "private", "all" or null
- number: issue/PR number if specified, or null
- repoFromContext: true if repository should be taken from conversation context

IMPORTANT: Preserve repository names, usernames, file paths, and URLs EXACTLY as written.
Do NOT translate or modify technical identifiers like "HiveNixAI", "main.jsx", "Lakshya0604".

Conversation context: ${contextStr}
Authenticated GitHub user: ${owner || "unknown"}

Return ONLY valid JSON. No markdown, no extra text.

User query: ${query}`

    try {
        const response = await llm.invoke(prompt)
        const content = Array.isArray(response.content)
            ? response.content.map(block => block.text || "").join("")
            : response.content

        let parsed
        try {
            parsed = JSON.parse(content)
        } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            }
        }

        if (!parsed || !parsed.intent || !INTENT_LABELS.includes(parsed.intent)) {
            return { ...fallbackClassifyIntent(query, owner, context), query, language, fallback: true }
        }

        const resultObj = { ...parsed, intent: parsed.intent, query, language, fallback: false, fastPath: false }
        const explicitRepository = extractCanonicalRepository(query)
        if (explicitRepository) {
            resultObj.repository = explicitRepository.fullName
            resultObj.owner = explicitRepository.owner
        }

        // If LLM classified as SEARCH_CODE but the search term is meaningless
        // (e.g., "this" or empty from "search this repo [url]"), override to SHOW_REPOSITORY_TREE
        if (resultObj.intent === "SEARCH_CODE") {
            const cleanedSearchTerm = (resultObj.searchTerm || "").trim().toLowerCase()
            const repoUrl = extractGitHubRepo(resultObj.query || "")
            if (
                (!cleanedSearchTerm || cleanedSearchTerm === "this") &&
                repoUrl
            ) {
                resultObj.intent = "SHOW_REPOSITORY_TREE"
                resultObj.searchTerm = null
            }
        }

        return resultObj
    } catch (err) {
        console.error("Intent classification failed:", err.message)
        return { ...fallbackClassifyIntent(query, owner, context), query, language, fallback: true }
    }
}

// ------------------------------------------------------------
// Regex-based fallback intent classification (FIX 6: uses ruleIntent fast-path)
// ------------------------------------------------------------

function fallbackClassifyIntent(query, owner, context) {
    // FIX 6: Use the ruleIntent fast-path as fallback classifier
    const fastResult = ruleIntent(query, owner, context)
    if (fastResult) {
        return fastResult
    }

    const lowerQuery = query.toLowerCase()
    const repo = extractGitHubRepo(query)
    const path = extractFilePath(query)

    if (repo) {
        if (/\bshow\b|\bread\b|\bopen\b/i.test(lowerQuery)) {
            if (path) return { intent: "SHOW_FILE", repository: repo, path, owner: null, searchTerm: null }
        }
        if (/\bexplain\b|\bsamjha\b|\bsamajh\b/i.test(lowerQuery)) {
            if (path) return { intent: "EXPLAIN_FILE", repository: repo, path, owner: null, searchTerm: null }
        }
        if (/\bfind\b|\bsearch\b|\bsearch_code\b|\bcode\b/i.test(lowerQuery)) {
            const searchTerm = lowerQuery
                .replace(/\bfind\b|\bsearch\b/gi, "")
                .replace(repo, "")
                .replace(/https?:\/\/github\.com\//gi, "")
                .replace(/\b(?:in|from|repo|github repo|repository)\b/gi, "")
                .replace(/\s+/g, " ")
                .trim()
            if (searchTerm && !/^this\s*$/i.test(searchTerm)) {
                return { intent: "SEARCH_CODE", repository: repo, path: null, owner: null, searchTerm }
            }
        }
        if (/\bshow\b|\bview\b|\blist\b|\bbrowse\b|\brepo\b|\brepositor\b/i.test(lowerQuery) || /github\.com/.test(query)) {
            return { intent: "SHOW_REPOSITORY_TREE", repository: repo, path: null, owner: null, searchTerm: null }
        }
        return { intent: "SHOW_REPOSITORY_TREE", repository: repo, path: null, owner: null, searchTerm: null }
    }

    // Hindi/Hinglish repository patterns (preserved)
    if (/मेरे रेपो|मेरी रिपॉ|मेरा रेपो|मेरे रेपो दिखाओ|मेरी रिपॉजिटरी|मेरे सारे रेपो|मेरी सारी रिपॉ|मेरे सारे रिपॉजिटरी|मेरी सारी रिपॉजिटरी/i.test(query)) {
        return {
            intent: "LIST_MY_REPOSITORIES",
            repository: "authenticated_user",
            owner: "authenticated_user",
            path: null,
            searchTerm: null,
        }
    }

    // English repository patterns
    if (
        /\bshow all my (public )?repositor/i.test(lowerQuery) ||
        /\bshow all my (public )?repos?\b/i.test(lowerQuery) ||
        /\bmy repos?\b/i.test(lowerQuery) ||
        /\bmy repos?itories\b/i.test(lowerQuery) ||
        /\bmy github repos?\b/i.test(lowerQuery) ||
        /\blist my repos?\b/i.test(lowerQuery) ||
        /\blist all my repos?\b/i.test(lowerQuery) ||
        /\bmy github proj/i.test(lowerQuery) ||
        /\bmeri sari repos?ities?\b/i.test(lowerQuery) ||
        /\bmeri sari repos?\b/i.test(lowerQuery) ||
        /\bmere repo dikhao\b/i.test(lowerQuery) ||
        /\bmere repos dikhao\b/i.test(lowerQuery) ||
        /\bdikhao mere repo\b/i.test(lowerQuery) ||
        /\bsare repo dikhao\b/i.test(lowerQuery) ||
        /\bsaare repo dikhao\b/i.test(lowerQuery) ||
        /\bsari repos dikhao\b/i.test(lowerQuery) ||
        /\bsare repos dikhao\b/i.test(lowerQuery) ||
        /\bshow all my public repos?ities?\b/i.test(lowerQuery) ||
        /\bshow all my public repos?\b/i.test(lowerQuery)
    ) {
        return {
            intent: /public/i.test(lowerQuery) ? "LIST_PUBLIC_REPOSITORIES" : "LIST_MY_REPOSITORIES",
            repository: "authenticated_user",
            owner: "authenticated_user",
            path: null,
            searchTerm: null,
        }
    }

    return { intent: "GENERIC_GITHUB", repository: null, owner: null, path: null, searchTerm: null }
}

// ============================================================
// Helper Functions for Repository Resolution
// ============================================================

function rNorm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[-_.]/g, "")
        .replace(/\s+/g, "")
}

function rTokens(s) {
    const norm = rNorm(s)
    return norm.split(/(?=[A-Z])|(?=\b)/).filter(Boolean)
}

function rLev(a, b) {
    if (a === b) return 0
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length
    const prev = new Array(b.length + 1)
    const curr = new Array(b.length + 1)
    for (let j = 0; j <= b.length; j++) prev[j] = j
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
    }
    return prev[b.length]
}

function repoScore(repoName, candidate) {
    if (!repoName || !candidate) return 1
    const a = rNorm(repoName)
    const b = rNorm(candidate.name)
    if (a === b) return 0
    if (b.includes(a) || a.includes(b)) return 0.1
    const lev = rLev(a, b)
    const maxLen = Math.max(a.length, b.length)
    return maxLen === 0 ? 0 : lev / maxLen
}

async function listOwnRepoNames() {
    const owner = await getAuthenticatedUser()
    if (!owner) return []
    try {
        const result = await callGitHubMCPTool("search_repositories", {
            query: `user:${owner}`,
            perPage: 100,
            page: 1,
        })
        const text = extractMCPText(result)
        let repos = null
        try { repos = JSON.parse(text) } catch { repos = null }

        if (Array.isArray(repos)) {
            return repos.map((r) => r.name)
        }
        if (repos && Array.isArray(repos.items)) {
            return repos.items.map((r) => r.name)
        }
        if (typeof text === "string" && text.includes("full_name")) {
            const matches = text.match(/"full_name"\s*:\s*"[^/"]+[^/"]+"/g)
            if (matches) {
                return matches.map(m => {
                    const m2 = m.match(/"full_name"\s*:\s*"[^/]+\/([^"]+)"/)
                    return m2 ? m2[1] : null
                }).filter(Boolean)
            }
        }
    } catch {
        return []
    }
    return []
}

export async function fuzzyResolveRepoName(repoName, owner) {
    if (!repoName || repoName.includes("/")) return repoName

    const cached = await getGitHubContext("fuzzy:repos:" + (owner || ""))
    let allRepos = []

    if (cached?.repos && cached.repos.length > 0) {
        allRepos = cached.repos
    } else {
        const myRepos = await listOwnRepoNames()
        allRepos = myRepos
        await setGitHubContext("fuzzy:repos:" + (owner || ""), { repos: allRepos })
    }

    if (allRepos.length === 0) return null

    let best = null
    let bestScore = Infinity

    for (const repo of allRepos) {
        const score = repoScore(repoName, { name: repo })
        if (score < bestScore) {
            bestScore = score
            best = repo
        }
    }

    if (best && bestScore < 0.4) {
        return owner ? `${owner}/${best}` : best
    }
    return null
}

export async function repoNotFoundReply(repoName) {
    const owner = await getAuthenticatedUser()
    const suggestions = await listOwnRepoNames()
    const hint = suggestions.length > 0
        ? ` कुछ ऐसे रेपो हैं: ${suggestions.slice(0, 5).join(", ")}`
        : ""
    return `मुझे "${repoName}" नहीं मिला${owner ? ` ${owner} के अपने रेपो में से` : ""}${hint}। कृपया रेपो का सटीक नाम दें या सुनिश्चित करें कि आपने सही GitHub यूज़रनेम पास करवाया है।`
}

// ============================================================
// Repository Resolution
// ============================================================

export async function resolveRepository(intentObj, context) {
    const explicitRepository = extractCanonicalRepository(intentObj.query || "")
    if (explicitRepository) return explicitRepository.fullName

    let repo = intentObj.repository

    if (repo === "authenticated_user" || (!repo && intentObj.owner === "authenticated_user")) {
        const owner = await getAuthenticatedUser()
        if (context?.selectedRepository) {
            return context.selectedRepository
        }
        if (owner) {
            const gitInfo = getGitRemoteInfo()
            if (gitInfo) return gitInfo.ownerRepo
        }
        return null
    }

    if (!repo && context?.selectedRepository) {
        return context.selectedRepository
    }

    if (!repo) {
        const extracted = extractGitHubRepo(intentObj.query || "")
        if (extracted) return extracted

        const authOwner = await getAuthenticatedUser()
        if (authOwner) {
            const gitInfo = getGitRemoteInfo()
            if (gitInfo) return gitInfo.ownerRepo
        }
    }

    if (repo && !repo.includes("/")) {
        const owner = await getAuthenticatedUser()
        const fuzzyResult = await fuzzyResolveRepoName(repo, owner)
        if (fuzzyResult) return fuzzyResult

        if (owner) {
            const gitInfo = getGitRemoteInfo()
            if (gitInfo && gitInfo.repoName === repo) {
                return gitInfo.ownerRepo
            }
            return `${owner}/${repo}`
        }
    }

    return repo
}

export async function resolveOwnerRepo(ownerHint, context) {
    if (ownerHint === "authenticated_user" || ownerHint === "me" || ownerHint === "मेरा" || ownerHint === "मेरी") {
        const owner = await getAuthenticatedUser()
        return owner
    }
    return ownerHint
}

// ============================================================
// Intent Handlers
// ============================================================

export async function handleGitHubIntent(intentObj, conversationId, language) {
    const context = await getGitHubContext(conversationId)
    const owner = await getAuthenticatedUser()

    const logFields = {
        query: intentObj.query || "",
        intent: intentObj.intent,
        language,
        repository: null,
        file: null,
        tool: null,
        opType: "READ",
        result: null,
    }

    switch (intentObj.intent) {
        case "LIST_MY_REPOSITORIES":
        case "LIST_PUBLIC_REPOSITORIES": {
            const resolvedOwner = owner || await resolveOwnerRepo(intentObj.owner, context)
            if (!resolvedOwner) {
                logFields.repository = "authenticated_user"
                logFields.tool = "search_repositories"
                logFields.result = "Could not resolve authenticated user"
                logGitHubRequest(logFields)
                return {
                    type: "github",
                    tool: "search_repositories",
                    user: null,
                    data: "I could not determine your GitHub username. Please specify a username in your request, e.g. 'show repositories for Lakshya0604'.",
                    raw: null,
                }
            }

            const result = await callGitHubMCPTool("search_repositories", {
                query: `user:${resolvedOwner}${intentObj.intent === "LIST_PUBLIC_REPOSITORIES" ? " is:public" : ""}`,
                perPage: 30,
                page: 1,
            })
            const data = extractMCPText(result)

            logFields.repository = resolvedOwner
            logFields.tool = "search_repositories"
            logFields.result = "repositories listed"
            logGitHubRequest(logFields)

            await setGitHubContext(conversationId, {
                ...context,
                selectedOwner: resolvedOwner,
            })

            return {
                type: "github",
                tool: "search_repositories",
                user: resolvedOwner,
                visibility: intentObj.intent === "LIST_PUBLIC_REPOSITORIES" ? "public" : "all",
                data,
                raw: result,
            }
        }

        case "SEARCH_REPOSITORIES": {
            let searchQuery = intentObj.searchTerm || intentObj.query || ""
            const extractedUser = extractGitHubUser(searchQuery)
            if (extractedUser) {
                searchQuery = `user:${extractedUser}`
            } else if (/https?:\/\/github\.com\/[A-Za-z0-9_.-]+/.test(searchQuery)) {
                const urlMatch = searchQuery.match(/github\.com\/([A-Za-z0-9_.-]+)/)
                if (urlMatch) searchQuery = `user:${urlMatch[1]}`
            }
            searchQuery = searchQuery.slice(0, 256)
            const result = await callGitHubMCPTool("search_repositories", {
                query: searchQuery,
                perPage: 10,
                page: 1,
            })
            const data = extractMCPText(result)

            logFields.repository = null
            logFields.tool = "search_repositories"
            logFields.result = "repositories searched"
            logGitHubRequest(logFields)

            return {
                type: "github",
                tool: "search_repositories",
                repository: intentObj.repository,
                data,
                raw: result,
            }
        }

        case "SHOW_REPOSITORY_TREE": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            if (!resolvedRepo) {
                return {
                    type: "github",
                    tool: "get_file_contents",
                    data: "Could not determine which repository to show. Please specify a repository.",
                    raw: null,
                }
            }

            const [rOwner, repoName] = resolvedRepo.split("/")
            const tree = await listRepositoryTree(rOwner, repoName)

            logFields.repository = resolvedRepo
            logFields.tool = "get_file_contents (recursive tree)"
            logFields.result = "tree built"
            logGitHubRequest(logFields)

            await setGitHubContext(conversationId, {
                ...context,
                selectedRepository: resolvedRepo,
            })

            return {
                type: "github",
                tool: "get_file_contents",
                repository: resolvedRepo,
                path: "(recursive tree)",
                data: tree,
                raw: null,
            }
        }

        case "SEARCH_CODE": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const searchTerm = intentObj.searchTerm || intentObj.query

            logFields.repository = resolvedRepo
            logFields.file = null
            logFields.tool = "search_code"
            logFields.opType = "READ"

            if (resolvedRepo) {
                const searchQuery = `${searchTerm} repo:${resolvedRepo}`
                const result = await callGitHubMCPTool("search_code", {
                    query: searchQuery.slice(0, 256),
                    perPage: 10,
                    page: 1,
                })
                let data = extractMCPText(result)

                let parsed = null
                try { parsed = JSON.parse(data) } catch { parsed = null }

                if (parsed && parsed.total_count === 0) {
                    const [rOwner, repoName] = resolvedRepo.split("/")
                    const treeMatches = await findFilesInTree(rOwner, repoName, searchTerm || repoName)

                    if (treeMatches.length > 0) {
                        const fileContents = []
                        for (const fullPath of treeMatches) {
                            try {
                                const fileResult = await callGitHubMCPTool("get_file_contents", {
                                    owner: rOwner, repo: repoName, path: fullPath,
                                })
                                fileContents.push(`**${fullPath}**:\n${extractMCPText(fileResult)}`)
                            } catch (fetchErr) {
                                fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
                            }
                        }
                        data = `**Repository tree search found ${treeMatches.length} matching files:**\n${treeMatches.join("\n")}\n\n${fileContents.join("\n\n---\n\n")}`
                        logFields.result = "tree fallback: files fetched"
                        logGitHubRequest(logFields)
                        return { type: "github", tool: "get_file_contents", repository: resolvedRepo, data, raw: result, fallback: true }
                    }
                }

                logFields.result = "code search results"
                logGitHubRequest(logFields)
                return { type: "github", tool: "search_code", repository: resolvedRepo, data, raw: result }
            } else {
                const result = await callGitHubMCPTool("search_code", {
                    query: searchTerm.slice(0, 256),
                    perPage: 10,
                    page: 1,
                })
                const data = extractMCPText(result)
                logFields.result = "code search results"
                logGitHubRequest(logFields)
                return { type: "github", tool: "search_code", repository: null, data, raw: result }
            }
        }

        case "SHOW_FILE": {
            let resolvedRepo = await resolveRepository(intentObj, context)
            let path = intentObj.path

            if (!resolvedRepo || !path) {
                const fallback = await fallbackResolveFile(intentObj, context, owner)
                logFields.repository = fallback.repository
                logFields.file = fallback.path
                logFields.tool = "get_file_contents"
                logFields.result = fallback.data ? "file fetch attempted" : "failed"
                logGitHubRequest(logFields)
                return fallback
            }

            const result = await safeFetchFileContents(resolvedRepo, path, intentObj, context, owner)
            logFields.repository = resolvedRepo
            logFields.file = path
            logFields.tool = "get_file_contents"
            logFields.result = result.data ? "file fetched" : "failed"
            logGitHubRequest(logFields)

            return result
        }

        case "EXPLAIN_FILE": {
            let resolvedRepo = await resolveRepository(intentObj, context)
            let path = intentObj.path

            const logEntry = { ...logFields }
            logEntry.intent = intentObj.intent
            logEntry.repository = resolvedRepo
            logEntry.file = path
            logEntry.tool = "get_file_contents"
            logEntry.opType = "READ"

            if (!resolvedRepo) {
                logEntry.result = "could not resolve repository"
                logGitHubRequest(logEntry)
                return {
                    type: "github",
                    tool: "get_file_contents",
                    data: await repoNotFoundReply(intentObj.repository || "unknown"),
                    repository: resolvedRepo,
                    raw: null,
                }
            }

            if (!path) {
                const fallback = await fallbackResolveFile(intentObj, context, owner)
                logEntry.repository = fallback.repository
                logEntry.file = fallback.path
                logEntry.tool = "get_file_contents"
                logEntry.result = fallback.data ? "file fetch via fallback" : "failed"
                logGitHubRequest(logEntry)
                return fallback
            }

            const fileResult = await safeFetchFileContents(resolvedRepo, path, intentObj, context, owner)
            logEntry.result = fileResult.data ? "file fetched for explanation" : "failed"
            logGitHubRequest(logEntry)

            return fileResult
        }

        case "FIND_FILE": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const searchTerm = intentObj.searchTerm || intentObj.path || intentObj.query

            if (resolvedRepo) {
                const [rOwner, repoName] = resolvedRepo.split("/")
                logFields.repository = resolvedRepo
                logFields.file = searchTerm
                logFields.tool = "search_code + findFilesInTree"
                logFields.opType = "READ"

                let data = ""
                let raw = null
                let fallback = false

                const result = await safeCallTool("search_code", {
                    query: `${searchTerm} repo:${resolvedRepo}`.slice(0, 256),
                    perPage: 10,
                    page: 1,
                })

                if (result) {
                    let parsed = null
                    try { parsed = JSON.parse(extractMCPText(result)) } catch { parsed = null }
                    if (parsed && parsed.total_count > 0) {
                        data = extractMCPText(result)
                        raw = result
                    }
                }

                if (!data) {
                    const treeMatches = await findFilesInTree(rOwner, repoName, searchTerm)
                    if (treeMatches.length > 0) {
                        const fileContents = []
                        for (const fullPath of treeMatches) {
                            try {
                                const fileResult = await callGitHubMCPTool("get_file_contents", {
                                    owner: rOwner, repo: repoName, path: fullPath,
                                })
                                fileContents.push(`**${fullPath}**:\n${extractMCPText(fileResult)}`)
                            } catch (fetchErr) {
                                fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
                            }
                        }
                        data = `**Found ${treeMatches.length} matching files:**\n${treeMatches.join("\n")}\n\n${fileContents.join("\n\n---\n\n")}`
                        fallback = true
                    }
                }

                logFields.result = data ? "files found" : "no matches"
                logGitHubRequest(logFields)

                return { type: "github", tool: "get_file_contents", repository: resolvedRepo, data, raw, fallback }
            } else {
                const result = await safeCallTool("search_code", {
                    query: searchTerm.slice(0, 256),
                    perPage: 10,
                    page: 1,
                })
                logFields.tool = "search_code"
                logFields.result = "code search"
                logGitHubRequest(logFields)
                return {
                    type: "github",
                    tool: "search_code",
                    repository: null,
                    data: extractMCPText(result),
                    raw: result,
                }
            }
        }

        case "SEARCH_ISSUES": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const searchTerm = intentObj.searchTerm || intentObj.query

            logFields.repository = resolvedRepo
            logFields.tool = "search_issues"
            logFields.opType = "READ"

            const query = resolvedRepo ? `${searchTerm} repo:${resolvedRepo}` : searchTerm
            const result = await callGitHubMCPTool("search_issues", {
                query: query.slice(0, 256),
                perPage: 10,
                page: 1,
            })

            logFields.result = "issues searched"
            logGitHubRequest(logFields)

            return { type: "github", tool: "search_issues", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "SHOW_ISSUE": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const number = intentObj.number

            logFields.repository = resolvedRepo
            logFields.tool = "issue_read"
            logFields.opType = "READ"

            const result = await callGitHubMCPTool("issue_read", {
                owner: resolvedRepo?.split("/")[0],
                repo: resolvedRepo?.split("/")[1],
                issue_number: number,
            })

            logFields.result = "issue fetched"
            logGitHubRequest(logFields)

            return { type: "github", tool: "issue_read", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "SEARCH_PR": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const searchTerm = intentObj.searchTerm || intentObj.query

            logFields.repository = resolvedRepo
            logFields.tool = "search_pull_requests"
            logFields.opType = "READ"

            const query = resolvedRepo ? `${searchTerm} repo:${resolvedRepo}` : searchTerm
            const result = await callGitHubMCPTool("search_pull_requests", {
                query: query.slice(0, 256),
            })

            logFields.result = "PRs searched"
            logGitHubRequest(logFields)

            return { type: "github", tool: "search_pull_requests", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "SHOW_PR":
        case "SHOW_PR_DIFF": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            const number = intentObj.number

            logFields.repository = resolvedRepo
            logFields.tool = "pull_request_read"
            logFields.opType = "READ"

            const result = await callGitHubMCPTool("pull_request_read", {
                owner: resolvedRepo?.split("/")[0],
                repo: resolvedRepo?.split("/")[1],
                pull_number: number,
            })

            logFields.result = "PR fetched"
            logGitHubRequest(logFields)

            return { type: "github", tool: "pull_request_read", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "SHOW_COMMITS":
        case "SHOW_COMMIT": {
            const resolvedRepo = await resolveRepository(intentObj, context)

            logFields.repository = resolvedRepo
            logFields.tool = "list_commits"
            logFields.opType = "READ"

            if (intentObj.commit_sha || intentObj.number) {
                const result = await callGitHubMCPTool("get_commit", {
                    owner: resolvedRepo?.split("/")[0],
                    repo: resolvedRepo?.split("/")[1],
                    ref: intentObj.commit_sha || intentObj.number,
                })
                logFields.tool = "get_commit"
                logFields.result = "commit fetched"
                logGitHubRequest(logFields)
                return { type: "github", tool: "get_commit", repository: resolvedRepo, data: extractMCPText(result), raw: result }
            }

            const result = await callGitHubMCPTool("list_commits", {
                owner: resolvedRepo?.split("/")[0],
                repo: resolvedRepo?.split("/")[1],
                perPage: 30,
                page: 1,
            })
            logFields.result = "commits listed"
            logGitHubRequest(logFields)
            return { type: "github", tool: "list_commits", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "LIST_BRANCHES": {
            const resolvedRepo = await resolveRepository(intentObj, context)

            logFields.repository = resolvedRepo
            logFields.tool = "list_branches"
            logFields.opType = "READ"

            const result = await callGitHubMCPTool("list_branches", {
                owner: resolvedRepo?.split("/")[0],
                repo: resolvedRepo?.split("/")[1],
            })

            logFields.result = "branches listed"
            logGitHubRequest(logFields)

            return { type: "github", tool: "list_branches", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "LIST_RELEASES": {
            const resolvedRepo = await resolveRepository(intentObj, context)

            logFields.repository = resolvedRepo
            logFields.tool = "list_releases"
            logFields.opType = "READ"

            const result = await callGitHubMCPTool("list_releases", {
                owner: resolvedRepo?.split("/")[0],
                repo: resolvedRepo?.split("/")[1],
            })

            logFields.result = "releases listed"
            logGitHubRequest(logFields)

            return { type: "github", tool: "list_releases", repository: resolvedRepo, data: extractMCPText(result), raw: result }
        }

        case "UNIVERSAL_GITHUB_QUERY": {
            const resolvedRepo = await resolveRepository(intentObj, context)
            if (!resolvedRepo || !resolvedRepo.includes("/")) {
                return {
                    type: "github",
                    tool: "universal_github_query",
                    repository: resolvedRepo || null,
                    data: "Could not resolve the repository. Provide an owner/repository name or select a repository first.",
                    raw: null,
                }
            }

            const data = await executeUniversalGitHubQuery(
                intentObj.query,
                resolvedRepo,
                context,
                { callGitHubMCPTool, extractMCPText, listRepositoryTree }
            )
            logFields.repository = resolvedRepo
            logFields.tool = "universal_github_query (bounded read-only retrieval)"
            logFields.result = "targeted repository context built"
            logGitHubRequest(logFields)

            return { type: "github", tool: "universal_github_query", repository: resolvedRepo, data, raw: null }
        }

        default: {
            const fallbackResult = await runGitHubQueryLegacy(intentObj.query, conversationId)
            logFields.repository = fallbackResult.repository || fallbackResult.user
            logFields.tool = fallbackResult.tool
            logFields.result = "fallback (regex-based)"
            logGitHubRequest(logFields)

            if (!fallbackResult.data || fallbackResult.data.includes("Could not determine")) {
                return {
                    type: "github",
                    tool: "error",
                    data: await repoNotFoundReply(extractGitHubRepo(intentObj.query) || "unknown"),
                    raw: null,
                }
            }
            return fallbackResult
        }
    }
}

// ------------------------------------------------------------
// Safe MCP tool call (returns null instead of throwing)
// ------------------------------------------------------------

async function safeCallTool(toolName, args) {
    try {
        return await callGitHubMCPTool(toolName, args)
    } catch {
        return null
    }
}

// ------------------------------------------------------------
// Unified file fetch with resolution + fallback
// ------------------------------------------------------------

function looksLikeResolution(data) {
    if (!data) return false
    return /did you mean|may refer to|multiple matches|not a file|does not exist|not found|no such file|was not found|path not found|no file|resolution|resolved potential matches|ambiguous|is a directory|directory listing|contains these entries/i.test(data)
}

async function safeFetchFileContents(resolvedRepo, path, intentObj, context, owner) {
    const [rOwner, repoName] = resolvedRepo.split("/")
    let result = null

    try {
        result = await callGitHubMCPTool("get_file_contents", { owner: rOwner, repo: repoName, path })
    } catch (err) {
        result = null
    }

    let fetched = await fetchFileContents(rOwner, repoName, path, result)

    if (!fetched.resolvedPaths && looksLikeResolution(fetched.data)) {
        const fileName = path.split("/").pop()
        const treeMatches = await findFilesInTree(rOwner, repoName, fileName)
        if (treeMatches.length > 0) {
            const filteredMatches = treeMatches.filter(m => !m.endsWith("/"))

            const fileContents = []
            for (const fullPath of filteredMatches) {
                try {
                    const fileResult = await callGitHubMCPTool("get_file_contents", {
                        owner: rOwner, repo: repoName, path: fullPath,
                    })
                    fileContents.push(`**${fullPath}**:\n${extractMCPText(fileResult)}`)
                } catch (fetchErr) {
                    fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
                }
            }
            return {
                type: "github",
                tool: "get_file_contents",
                repository: resolvedRepo,
                data: fileContents.join("\n\n---\n\n"),
                raw: null,
            }
        }
    }

    return fetched
}

// ------------------------------------------------------------
// Fallback file resolution for SHOW_FILE when repo/path not fully resolved
// ------------------------------------------------------------

async function fallbackResolveFile(intentObj, context, owner) {
    let resolvedRepo = intentObj.repository || context?.selectedRepository

    if (!resolvedRepo) {
        return {
            type: "github",
            tool: "get_file_contents",
            data: "Could not determine the repository. Please specify a GitHub repository URL.",
            raw: null,
        }
    }

    let path = intentObj.path
    if (!path) path = extractFilePath(intentObj.query || "")

    if (!path) {
        const lowerQuery = intentObj.query?.toLowerCase() || ""
        if (/entry point|entry-point|server\.js|main\.js|app\.js|index\.js|start.*server|backend.*start/i.test(lowerQuery)) {
            const commonEntry = ["index.js", "server.js", "app.js", "main.js"]
            for (const entry of commonEntry) {
                const treeMatches = await findFilesInTree(
                    resolvedRepo.split("/")[0], resolvedRepo.split("/")[1], entry
                )
                if (treeMatches.length > 0) {
                    path = treeMatches[0].replace(/^\//, "")
                    break
                }
            }
        }
    }

    if (!path) {
        return {
            type: "github",
            tool: "get_file_contents",
            repository: resolvedRepo,
            data: "Could not determine the file path from your request. Please specify a file path or repository.",
            raw: null,
        }
    }

    return await safeFetchFileContents(resolvedRepo, path, intentObj, context, owner)
}

// ------------------------------------------------------------
// File contents helpers (preserved)
// ------------------------------------------------------------

export async function fetchFileContents(owner, repoName, path, result) {
    let data = extractMCPText(result)

    const isErrorOrResolution = /did you mean|may refer to|multiple matches|not a file|does not exist|not found|no such file|was not found|path not found|no file|error|resolution|resolved potential matches|ambiguous/i.test(data)

    if (!isErrorOrResolution && !result?.isError) {
        return {
            type: "github",
            tool: "get_file_contents",
            repository: `${owner}/${repoName}`,
            path,
            data,
            raw: result,
        }
    }

    const possiblePaths = extractPathsFromResolution(data)
    if (possiblePaths && possiblePaths.length > 0) {
        console.log("📄 Multiple matches found:", possiblePaths.join(", "))

        const fileContents = []
        for (const fullPath of possiblePaths) {
            console.log("📥 Fetching file contents:", fullPath)
            try {
                const fileResult = await callGitHubMCPTool(
                    "get_file_contents",
                    { owner, repo: repoName, path: fullPath }
                )
                const fileContent = extractMCPText(fileResult)
                fileContents.push(`**${fullPath}**:\n${fileContent}`)
            } catch (fetchErr) {
                fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
            }
        }

        data = fileContents.join("\n\n---\n\n")

        return {
            type: "github",
            tool: "get_file_contents",
            repository: `${owner}/${repoName}`,
            path,
            resolvedPaths: possiblePaths,
            data,
            raw: result,
        }
    }

    return {
        type: "github",
        tool: "get_file_contents",
        repository: `${owner}/${repoName}`,
        path,
        data,
        raw: result,
    }
}

export function extractPathsFromResolution(data) {
    const ext = "(?:js|ts|jsx|tsx|py|java|go|rs|rb|php|cpp|c|h|html|css|json|md|yaml|yml|toml|cfg|ini)"
    const pathPattern = "(?:[A-Za-z0-9_.-]+/)*(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+\\." + ext
    const matches = data.match(new RegExp(`["'\`]${pathPattern}["'\`]`, "gi"))
    if (matches) {
        return matches.map(s => s.replace(/["'\`]/g, ""))
    }
    const jsonStart = data.indexOf("[")
    const jsonEnd = data.lastIndexOf("]")
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = data.slice(jsonStart, jsonEnd + 1)
        try {
            const arr = JSON.parse(jsonStr)
            if (Array.isArray(arr)) {
                const paths = arr.filter(s => typeof s === "string" && s.includes("/")).map(s => s.trim())
                if (paths.length > 0) return paths
            }
        } catch {
            const items = jsonStr.match(/"([^"]+)"/g)
            if (items) {
                const paths = items.map(s => s.slice(1, -1).trim()).filter(s => s.includes("/"))
                if (paths.length > 0) return paths
            }
        }
    }
    const bareMatches = data.match(new RegExp(pathPattern, "gi"))
    if (bareMatches) {
        return bareMatches.map(s => s.trim())
    }
    return null
}

// ------------------------------------------------------------
// Repository tree helpers (preserved)
// ------------------------------------------------------------

const SKIP_DIRS = new Set([
    "node_modules", "dist", "build", "out", ".git", ".github",
    "coverage", ".next", ".nuxt", "target", "vendor",
    ".venv", "venv", "env", "__pycache__", "public",
])

const MAX_TREE_DEPTH = 3
const MAX_TREE_CALLS = 30
let treeCallCount = 0

export async function listRepositoryTree(owner, repo, path = "", maxDepth = MAX_TREE_DEPTH, currentDepth = 0, prefix = "") {
    if (currentDepth > maxDepth) return ""
    treeCallCount = 0

    return _listRepositoryTree(owner, repo, path, maxDepth, currentDepth, prefix, "")
}

async function _listRepositoryTree(owner, repo, path = "", maxDepth = MAX_TREE_DEPTH, currentDepth = 0, prefix = "", accumulated = "") {
    if (currentDepth > maxDepth) return accumulated
    if (treeCallCount >= MAX_TREE_CALLS) return accumulated + "\n[capped: max tree calls reached]\n"

    treeCallCount++

    let treeText = ""

    try {
        const result = await callGitHubMCPTool(
            "get_file_contents",
            { owner, repo, path }
        )

        const text = extractMCPText(result)
        let entries = []

        try {
            const parsed = JSON.parse(text)
            if (Array.isArray(parsed)) {
                entries = parsed
            }
        } catch {
            entries = []
        }

        if (entries.length > 0) {
            for (const entry of entries) {
                const isDir = entry.type === "dir" || entry.type === "directory" || entry.type === "tree"
                const displayName = entry.name || entry.path || "unknown"
                if (isDir && SKIP_DIRS.has(displayName)) continue

                const displayPath = prefix ? `${prefix}/${displayName}` : displayName

                if (isDir) {
                    treeText += `${displayPath}/\n`
                    treeText += await _listRepositoryTree(
                        owner, repo,
                        entry.path || displayPath,
                        maxDepth, currentDepth + 1,
                        displayPath,
                        ""
                    )
                } else {
                    treeText += `${displayPath}\n`
                }
            }
        } else {
            treeText += text + "\n"
        }
    } catch (error) {
        treeText += `[Error listing ${path || "root"}: ${error.message}]\n`
    }

    return treeText
}

export async function findFilesInTree(owner, repo, searchTerm) {
    const tree = await listRepositoryTree(owner, repo)
    if (!tree) return []

    const lines = tree.split("\n").filter(l => l.trim())
    const lowerTerm = (searchTerm || "").toLowerCase()

    const matches = lines
        .filter(line => !line.endsWith("/"))
        .filter(line => {
            const basename = line.split("/").pop().replace(/\/$/, "")
            return basename.toLowerCase().includes(lowerTerm) ||
                line.toLowerCase().includes(lowerTerm)
        })

    return matches
}

// ------------------------------------------------------------
// Structured Logging (Requirement 19)
// ------------------------------------------------------------

function logGitHubRequest(fields) {
    console.log("🐙 GitHub MCP request:", fields.query)
    console.log("🧠 Normalized intent:", fields.intent)
    console.log("🌐 Detected language:", fields.language)
    console.log("📁 Repository:", fields.repository || "none")
    console.log("📄 File:", fields.file || "none")
    console.log("🔧 MCP tool:", fields.tool || "none")
    console.log("✍️ Operation type:", fields.opType || "READ")
    console.log("📥 Result:", fields.result || "unknown")
}

// ============================================================
// FIX 7: Groq 429 error detection and retry-after parsing
// ============================================================

export function isRateLimitError(e) {
    return e?.status === 429 ||
        e?.statusCode === 429 ||
        /rate limit|429|quota|tokens? exceeded|token limit/i.test(
            String(e?.message || "") + String(e?.error?.message || "")
        )
}

export function retryAfterText(e) {
    const possibleHeaders = e?.headers
    let s = null
    if (possibleHeaders) {
        if (typeof possibleHeaders.get === "function") {
            s = Number(possibleHeaders.get("retry-after"))
        } else {
            s = Number(possibleHeaders["retry-after"])
        }
    }
    if (!Number.isFinite(s)) {
        s = Number(e?.error?.retryAfter ?? e?.retryAfter ?? null)
    }
    if (!Number.isFinite(s)) {
        s = 60
    }
    return s >= 90
        ? `${Math.ceil(s / 60)} minute`
        : `${Math.ceil(s)} second`
}

// FIX 7: Strict LLM caller (no fallback string on parse error)
export async function askLLMStrict(llm, promptText) {
    const response = await llm.invoke(promptText)
    const content = Array.isArray(response.content)
        ? response.content.map(b => b.text || "").join("")
        : response.content
    return content?.trim() || ""
}

// ============================================================
// FIX 8: Direct formatter for simple GitHub results (no LLM)
// ============================================================

export function formatGitHubDirect(githubResult, language) {
    if (!githubResult || !githubResult.data) return null

    const data = githubResult.data
    const lang = language || "English"

    try {
        const parsed = JSON.parse(data)

        // Repository list formatting (search_repositories result)
        if (githubResult.tool === "search_repositories") {
            const repos = parsed.items || parsed

            if (Array.isArray(repos)) {
                const lines = repos.map(repo => {
                    const visibility = repo.visibility || "unknown"
                    const lang = repo.language || "unknown"
                    const desc = repo.description ? repo.description.slice(0, 100) : "No description"
                    return `- **${repo.name}** (${visibility}, ${lang}) — ${desc}\n  ${repo.html_url || repo.url || ""}`
                })
                return lines.join("\n")
            }
        }

        // Commit list formatting (list_commits result)
        if (githubResult.tool === "list_commits") {
            if (parsed && typeof parsed === "object" && Array.isArray(parsed)) {
                const lines = parsed.slice(0, 20).map(c => {
                    const sha = (c.sha || c.id || "").slice(0, 7)
                    const msg = c.commit?.message || c.message || ""
                    const date = c.commit?.author?.date || c.date || ""
                    return `- ${sha} — ${msg.split("\n")[0]}\n  ${date}`
                })
                return lines.join("\n")
            }
        }

        // Issue list formatting
        if (githubResult.tool === "list_issues" || githubResult.tool === "search_issues") {
            if (parsed && typeof parsed === "object") {
                const issues = parsed.items || (Array.isArray(parsed) ? parsed : [])
                if (Array.isArray(issues) && issues.length > 0) {
                    const lines = issues.slice(0, 20).map(issue => {
                        const num = issue.number || "?"
                        const title = issue.title || "Untitled"
                        const state = issue.state || "unknown"
                        return `- #${num} — ${title} [${state}]`
                    })
                    return lines.join("\n")
                }
            }
        }

        // PR list formatting
        if (githubResult.tool === "list_pull_requests" || githubResult.tool === "search_pull_requests") {
            if (parsed && typeof parsed === "object") {
                const prs = parsed.items || (Array.isArray(parsed) ? parsed : [])
                if (Array.isArray(prs) && prs.length > 0) {
                    const lines = prs.slice(0, 20).map(pr => {
                        const num = pr.number || "?"
                        const title = pr.title || "Untitled"
                        const state = pr.state || "unknown"
                        return `- #${num} — ${title} [${state}]`
                    })
                    return lines.join("\n")
                }
            }
        }

        // Branch list formatting
        if (githubResult.tool === "list_branches") {
            if (parsed && typeof parsed === "object") {
                const branches = parsed.branches || (Array.isArray(parsed) ? parsed : [])
                if (Array.isArray(branches) && branches.length > 0) {
                    const lines = branches.slice(0, 30).map(b => {
                        const name = b.name || b
                        const commit = b.commit?.sha?.slice(0, 7) || b.commit
                        return `- ${name}${commit ? ` (${commit})` : ""}`
                    })
                    return lines.join("\n")
                }
            }
        }

        // Release list formatting
        if (githubResult.tool === "list_releases") {
            if (Array.isArray(parsed)) {
                const lines = parsed.slice(0, 10).map(r => {
                    const name = r.name || r.tag_name || "Untagged"
                    const tag = r.tag_name || ""
                    return `- ${name} (${tag})`
                })
                return lines.join("\n")
            }
        }

        // Search code results
        if (githubResult.tool === "search_code") {
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
                const lines = parsed.items.slice(0, 10).map(item => {
                    const repo = item.repository?.full_name || ""
                    const path = item.path || ""
                    const name = item.name || ""
                    return `- **${name}** in \`${repo}\`\n  Path: ${path}`
                })
                return lines.join("\n")
            }
        }
    } catch {
        // Not JSON — return raw text
    }

    // If not JSON or doesn't match a known pattern, return the raw data
    // wrapped in a language-appropriate prefix
    const prefixes = {
        English: "GitHub data:",
        Hindi: "GitHub डेटा:",
        Hinglish: "GitHub data:",
    }
    const prefix = prefixes[lang] || "GitHub data:"

    return `${prefix}\n${data}`
}

// Simple direct formatters for multilingual responses
export function formatRepoListDirect(repos, language) {
    if (!Array.isArray(repos)) repos = []
    if (repos.length === 0) {
        const msgs = {
            English: "You don't have any repositories yet.",
            Hindi: "आपके पास अभी तक कोई रिपॉजिटरी नहीं हैं।",
            Hinglish: "Aapke paas abhi tak koi repository nahi hai.",
        }
        return msgs[language] || msgs.English
    }

    const lines = repos.map(repo => {
        const visibility = repo.visibility || "unknown"
        const lang = repo.language || ""
        const desc = repo.description ? repo.description.slice(0, 100) : ""
        const name = repo.name
        const url = repo.html_url || ""

        let visibilityLabel = visibility
        const visLabels = {
            English: { public: "public", private: "private" },
            Hindi: { public: "प्रतिष्ठित", private: " निजी" },
            Hinglish: { public: "public", private: "private" },
        }
        if (visLabels[language]) {
            visibilityLabel = visLabels[language][visibility] || visibility
        }

        let parts = `- **${name}** (${visibilityLabel}`
        if (lang) parts += `, ${lang}`
        parts += ")"
        if (desc) parts += ` — ${desc}`
        if (url) parts += `\n  ${url}`
        return parts
    })

    const header = {
        English: "Here are your repositories:",
        Hindi: "आपकी रिपॉजिटरीज़ यहाँ हैं:",
        Hinglish: "Yeh hain aapki repositories:",
    }
    const hdr = header[language] || header.English

    return `${hdr}\n\n${lines.join("\n")}`
}

export function formatTreeDirect(tree, language) {
    if (!tree) {
        const msgs = {
            English: "No repository structure data available.",
            Hindi: "कोई रिपॉजिटरी संरचना डेटा उपलब्ध नहीं है।",
            Hinglish: "Koi repository structure data available nahi hai.",
        }
        return msgs[language] || msgs.English
    }

    const header = {
        English: "Repository structure:\n```\n",
        Hindi: "रिपॉजिटरी संरचना:\n```\n",
        Hinglish: "Repository structure:\n```\n",
    }
    const hdr = header[language] || header.English
    return `${hdr}${tree}\n${"```"}`
}

export function formatCommitListDirect(commits, language) {
    if (!Array.isArray(commits)) commits = []
    if (commits.length === 0) {
        const msgs = {
            English: "No commits found.",
            Hindi: "कोई कमिट नहीं मिला।",
            Hinglish: "Koi commit nahi mila.",
        }
        return msgs[language] || msgs.English
    }

    const lines = commits.slice(0, 20).map(c => {
        const sha = (c.sha || c.id || "").slice(0, 7)
        const msg = c.commit?.message || c.message || ""
        const date = c.commit?.author?.date || c.date || ""
        return `- ${sha} — ${msg.split("\n")[0]}\n  ${date}`
    })

    const header = {
        English: "Recent commits:",
        Hindi: "हालिया कमिट्स:",
        Hinglish: "Recent commits:",
    }
    const hdr = header[language] || header.English

    return `${hdr}\n\n${lines.join("\n")}`
}

export function formatBranchListDirect(branches, language) {
    if (!Array.isArray(branches)) branches = []
    if (branches.length === 0) {
        const msgs = {
            English: "No branches found.",
            Hindi: "कोई ब्रांच नहीं मिली।",
            Hinglish: "Koi branch nahi mili.",
        }
        return msgs[language] || msgs.English
    }

    const lines = branches.slice(0, 30).map(b => {
        const name = b.name || b
        const commit = b.commit?.sha?.slice(0, 7) || b.commit
        return `- ${name}${commit ? ` (${commit})` : ""}`
    })

    const header = {
        English: "Branches:",
        Hindi: "ब्रांचे:",
        Hinglish: "Branches:",
    }
    const hdr = header[language] || header.English

    return `${hdr}\n\n${lines.join("\n")}`
}

// ============================================================
// isGitHubRequest - updated for natural language
// ============================================================

const GH_STRONG = [
    /\bgithub\b/i,
    /\breposit(s|ories)?\b/i,
    /\brepo\b/i,
    /\brepoz\b/i,
    /\bpull requests?\b/i,
    /\bcommits?\b/i,
    /\bcommit\b/i,
    /\bbranch(es)?\b/i,
    /\bbranches?\b/i,
    /\bissues?\b/i,
    /\brelease(s)?\b/i,
    /\breleases?\b/i,
    /\bfork(ed|ing|s)?\b/i,
    /\bclone(d|ing|s)?\b/i,
    /\bmerge d?r?(equest)?s?\b/i,
    /\breadme\b/i,
    /\bcontributors?\b/i,
    /\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]/i,
    /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/,
    /रेपो|रिपॉ|रिपॉजिटरी|इश्यू|ब्रांच|कमिट|फ़ाइल|फाइल|कोड|गिट|पुल अनुरेखण|रिलीज़|रिलीज|कमिट्स|ब्रांचे|इश्यूज़/i,
    /(?:[\s\/\\]|^)(?:[A-Za-z0-9_.-]+\/)*(?:[A-Za-z0-9_.-]+\.)?(?:js|jsx|ts|tsx|py|java|go|rb|php|cpp|c|h|html|css|json|md|yaml|yml)\b/i,
    /\bshow\b.*\b[A-Z][a-zA-Z0-9-]+\b/i,
    /\bshow\b.*\b[A-Z][a-zA-Z0-9-]+\/[A-Za-z0-9_.-]+\b/i,
    /\bshow\s+[a-z][a-z0-9_-]+\b(?!.*\b(all|my|me|structures?|commits?|repo|repos|repositor)\b)/i,
    /\bfile structure\b/i,
    /\bdirectory structure\b/i,
    /\broot director(y|ies)\b/i,
    /\bshow me files?\b/i,
    /\bsearch code\b/i,
    /\bsearch for code\b/i,
    /\bfind code\b/i,
    /\bcode in\b/i,
    /\bexplain code\b/i,
    /\bdikhao\b/i,
    /\bfile dikhao\b/i,
    /\bmeri sari repos?\b/i,
    /\bmere repo\b/i,
    /\bmere repos\b/i,
    /\bsare repo\b/i,
    /\bsaare repo\b/i,
    /\bsari repos?\b/i,
    /\bshow all my\b/i,
    /\bmy github\b/i,
    /\bmy repos?\b/i,
    /\bmy repos?itories\b/i,
    /\blist my\b/i,
    /\bमेरे रेपो|मेरी रिपॉ|मेरा रेपो|मेरे रेपो दिखाओ|मेरी रिपॉजिटरी|मेरे सारे रेपो|मेरी सारी रिपॉ|मेरे सारे रिपॉजिटरी|मेरी सारी रिपॉजिटरी|मेरे सारे रेपो दिखाओ|मेरी सारी रिपॉजिटरी दिखाओ/i,
]

const GH_FOLLOWUP = [
    /\bcode\b/i,
    /\brepo\b/i,
    /\bfile\b/i,
    /\bexplain\b/i,
    /\bsamjha\b/i,
    /\bsamajh\b/i,
    /\bbranch\b/i,
    /\bcommit\b/i,
    /\bissue\b/i,
    /\brelease\b/i,
    /\bpr\b/i,
    /\b(?:show|open|read|explain|dikhao)\b.*\b[A-Za-z0-9_-]+\.(?:js|jsx|ts|tsx|py|java|go|html|css|json|md)\b/i,
    /\b[A-Za-z0-9_-]+\.(?:js|jsx|ts|tsx|py|java|go|html|css|json|md)\b\s+\b(?:show|open|read|explain|dikhao)\b/i,
    /रेपो|कोड|फ़ाइल|फाइल|गिट|ब्रांच|कमिट|इश्यू|रिलीज/i,
    /\b(iska|isme|iske|ismi|inme|inke|iss repo|is repo|this repo|that repo|this one|yeh repo|ye repo)\b/i,
    /\b(structure|tree|directory|files?)\b/i,
    /\bसंरचना|फ़ाइल|फाइल|डायरेक्टरी|ट्री|संरचना|फ़ाइलें|फाइलें|कोड|डिरेक्टरी/i,
]

const JS_FRAMEWORK_WORDS = /\b(react|vue|svelte|angular|next\.js|nuxt|express|node\.js|django|flask|spring|laravel|ruby|rails)\b/i

export async function isGitHubRequest(query, conversationId) {
    const q = (query || "").trim()
    if (!q) return false

    let decision = detectConversationDomain(q)
    if (decision.domain === "github") return true
    if (!["general", "other"].includes(decision.domain) || !decision.isPotentialFollowUp || !conversationId) return false

    const context = await getGitHubContext(conversationId)
    if (context?.domain !== "github" || !GH_FOLLOWUP.some(pattern => pattern.test(q))) return false

    decision = detectConversationDomain(q, context)
    return decision.domain === "github" && decision.contextInherited
}

// ============================================================
// Legacy runGitHubQuery - preserved as fallback
// ============================================================

export async function runGitHubQueryLegacy(userQuery) {
    const query = (userQuery || "").trim()
    if (!query) {
        return { type: "error", tool: "no_query", data: "No query provided." }
    }

    const repo = extractGitHubRepo(query)
    const githubUser = repo ? null : extractGitHubUser(query)

    console.log("🐙 GitHub MCP request:", query)
    if (repo) console.log("📁 GitHub repository:", repo)

    if (githubUser) {
        console.log("🔎 GitHub MCP tool: search_repositories")
        console.log("👤 GitHub user:", githubUser)

        const result = await callGitHubMCPTool(
            "search_repositories",
            { query: `user:${githubUser}`, perPage: 30, page: 1 }
        )

        return {
            type: "github",
            tool: "search_repositories",
            user: githubUser,
            data: extractMCPText(result),
            raw: result,
        }
    }

    if (/\bshow all my public repositor(y|ies)\b/i.test(query) ||
        /\bshow all my repositor(y|ies)\b/i.test(query) ||
        /\bshow all my repos?\b/i.test(query) ||
        /\bmy repos?\b/i.test(query) ||
        /\bmy repos?itories\b/i.test(query) ||
        /\bmy github repos?\b/i.test(query) ||
        /\blist my repos?\b/i.test(query) ||
        /\blist all my repos?\b/i.test(query) ||
        /\bshow my github\b/i.test(query) ||
        /मेरे रेपो|मेरी रिपॉ|मेरा रेपो|मेरे रेपो दिखाओ|मेरी रिपॉजिटरी|मेरे सारे रेपो|मेरी सारी रिपॉ|मेरे सारे रिपॉजिटरी|मेरी सारी रिपॉजिटरी|मेरे सारे रेपो दिखाओ|मेरी सारी रिपॉजिटरी दिखाओ/i.test(query) ||
        /\bmeri sari repos?ities?\b/i.test(lowerQuery) ||
        /\bmeri sari repos?\b/i.test(lowerQuery)
    ) {
        // FIX 5: Use getAuthenticatedUser() instead of just getGitRemoteInfo()
        const searchUser = await getAuthenticatedUser() || (getGitRemoteInfo()?.owner) || null

        if (searchUser) {
            console.log("🔎 GitHub MCP tool: search_repositories")
            console.log("👤 GitHub user:", searchUser)

            const result = await callGitHubMCPTool(
                "search_repositories",
                { query: `user:${searchUser}`, perPage: 30, page: 1 }
            )

            return {
                type: "github",
                tool: "search_repositories",
                user: searchUser,
                data: extractMCPText(result),
                raw: result,
            }
        }

        return {
            type: "github",
            tool: "search_repositories",
            user: null,
            data: "Could not determine your GitHub username. Please specify a GitHub username in your request.",
            raw: null,
        }
    }

    const isFileOperation = /\b(show|read|open|explain|check|look at)\b/i.test(query)

    if (isFileOperation) {
        let resolvedRepo = repo
        let path = ""

        const blobPath = extractPathFromBlobUrl(query)
        if (blobPath) path = blobPath

        if (!path) path = extractFilePath(query) || ""

        if (path && !resolvedRepo) {
            const gitInfo = getGitRemoteInfo()
            if (gitInfo) {
                resolvedRepo = gitInfo.ownerRepo
                console.log("📁 Resolved repository from git remote:", resolvedRepo)

                const [owner, repoName] = resolvedRepo.split("/")
                const repoNameOnly = gitInfo.repo
                const strippedPath = path.startsWith(repoNameOnly + "/")
                    ? path.slice(repoNameOnly.length + 1)
                    : path

                console.log("🔎 GitHub MCP tool: get_file_contents")
                console.log("📄 File path:", path)
                console.log("📥 Fetching file contents...")

                const attempts = []
                if (strippedPath !== path) attempts.push(strippedPath)
                attempts.push(path)
                const prefixedPath = repoNameOnly + "/" + strippedPath
                if (prefixedPath !== path && strippedPath !== path) attempts.push(prefixedPath)

                for (const attemptPath of attempts) {
                    try {
                        if (attemptPath !== path) {
                            console.log("📄 Retrying with path:", attemptPath)
                        }
                        const result = await callGitHubMCPTool(
                            "get_file_contents",
                            { owner, repo: repoName, path: attemptPath }
                        )
                        return fetchFileContents(owner, repoName, attemptPath, result)
                    } catch (err) {
                        if (attemptPath === attempts[attempts.length - 1]) {
                            return {
                                type: "github",
                                tool: "get_file_contents",
                                repository: resolvedRepo,
                                path,
                                data: `Could not fetch file "${path}" from ${resolvedRepo}: ${err.message}`,
                                raw: null,
                            }
                        }
                    }
                }
            }
        }

        if (resolvedRepo && path) {
            const [owner, repoName] = resolvedRepo.split("/")

            console.log("🔎 GitHub MCP tool: get_file_contents")
            console.log("📄 File path:", path)
            console.log("📥 Fetching file contents...")

            let result
            try {
                result = await callGitHubMCPTool(
                    "get_file_contents",
                    { owner, repo: repoName, path }
                )
            } catch (err) {
                result = null
                console.log("⚠️ get_file_contents threw for path:", path, "—", err.message)
            }

            const fetched = await fetchFileContents(owner, repoName, path, result)

            if (!fetched.resolvedPaths || (fetched.data && /not found|no such file|was not found|ambiguous|multiple matches/i.test(fetched.data))) {
                console.log("🔄 Falling back to findFilesInTree for:", path)
                const fileName = path.split("/").pop()
                const treeMatches = await findFilesInTree(owner, repoName, fileName)
                if (treeMatches.length > 0) {
                    console.log("📄 Found matches in tree:", treeMatches.join(", "))
                    const fileContents = []
                    for (const fullPath of treeMatches) {
                        console.log("📥 Fetching file contents:", fullPath)
                        try {
                            const fileResult = await callGitHubMCPTool(
                                "get_file_contents",
                                { owner, repo: repoName, path: fullPath }
                            )
                            const content = extractMCPText(fileResult)
                            fileContents.push(`**${fullPath}**:\n${content}`)
                        } catch (fetchErr) {
                            fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
                        }
                    }
                    return {
                        type: "github",
                        tool: "get_file_contents",
                        repository: resolvedRepo,
                        data: fileContents.join("\n\n---\n\n"),
                        raw: null,
                    }
                }
            }

            return fetched
        }
    }

    if (
        repo &&
        (
            /\bfind\b.*\bin\b/i.test(query) ||
            /\bsearch\b.*\bin\b/i.test(query) ||
            /\bfind\b.*\b(code|file|function|class|component)\b/i.test(query) ||
            /\bsearch\b.*\b(code|file|function|class|component)\b/i.test(query) ||
            /\bexplain\b.*\b(in |from )/i.test(query)
        )
    ) {
        let searchTerm = query
            .replace(/\bsearch\b|\bfind\b|\bexplain\b/gi, "")
            .replace(repo, "")
            .replace(/https?:\/\/github\.com\//gi, "")
            .replace(/\b(?:in|from|repo|github repo|repository)\b/gi, "")
            .replace(/\s+/g, " ")
            .trim()

        const searchQuery = `${searchTerm} repo:${repo}`

        console.log("🔎 GitHub MCP tool: search_code")
        console.log("📄 Search query:", searchQuery)

        const result = await callGitHubMCPTool(
            "search_code",
            { query: searchQuery.slice(0, 256), perPage: 10, page: 1 }
        )

        let data = extractMCPText(result)

        let parsed = null
        try {
            parsed = JSON.parse(data)
        } catch {
            parsed = null
        }

        if (parsed && parsed.total_count === 0) {
            console.log("📁 search_code returned 0 results, falling back to repository tree path matching")

            const [owner, repoName] = repo.split("/")
            const treeMatches = await findFilesInTree(owner, repoName, searchTerm || repoName)

            if (treeMatches.length > 0) {
                console.log("📄 Found matches in tree:", treeMatches.join(", "))

                const fileContents = []
                for (const fullPath of treeMatches) {
                    console.log("📥 Fetching file contents:", fullPath)
                    try {
                        const fileResult = await callGitHubMCPTool(
                            "get_file_contents",
                            { owner, repo: repoName, path: fullPath }
                        )
                        const content = extractMCPText(fileResult)
                        fileContents.push(`**${fullPath}**:\n${content}`)
                    } catch (fetchErr) {
                        fileContents.push(`**${fullPath}**: Could not fetch: ${fetchErr.message}`)
                    }
                }

                data = `**Repository tree search found ${treeMatches.length} matching files:**\n${treeMatches.join("\n")}\n\n${fileContents.join("\n\n---\n\n")}`

                return {
                    type: "github",
                    tool: "get_file_contents",
                    repository: repo,
                    data,
                    raw: result,
                    fallback: true,
                }
            }
        }

        return {
            type: "github",
            tool: "search_code",
            repository: repo,
            data,
            raw: result,
        }
    }

    if (
        repo &&
        (
            /\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i.test(query) ||
            /\bthis repo\b/i.test(query) ||
            /\bbrowse\b/i.test(query) ||
            /\blist\b.*\brepo\b/i.test(query) ||
            /\bsearch\b.*\brepo\b/i.test(query) ||
            /\bview\b.*\brepo\b/i.test(query) ||
            /\bexplore\b.*\brepo\b/i.test(query) ||
            /\bshow\b.*\brepo\b/i.test(query)
        )
    ) {
        const [rOwner, repoName] = repo.split("/")

        console.log("🔎 GitHub MCP tool: get_file_contents (recursive tree)")
        console.log("📁 Repository:", repo)

        const tree = await listRepositoryTree(rOwner, repoName)
        console.log("🌳 Repository tree built, length:", tree.length)

        return {
            type: "github",
            tool: "get_file_contents",
            repository: repo,
            path: "(recursive tree)",
            data: tree,
            raw: null,
        }
    }

    if (
        /\bfind\b.*\brepositor(y|ies)\b/i.test(query) ||
        /\bsearch\b.*\brepositor(y|ies)\b/i.test(query)
    ) {
        console.log("🔎 GitHub MCP tool: search_repositories")

        const result = await callGitHubMCPTool(
            "search_repositories",
            { query, perPage: 10, page: 1 }
        )

        return {
            type: "github",
            tool: "search_repositories",
            repository: repo,
            data: extractMCPText(result),
            raw: result,
        }
    }

    console.log("🔎 GitHub MCP tool: search_code (default)")

    let searchQuery = query
    if (repo) {
        searchQuery = `${query} repo:${repo}`
    } else if (githubUser) {
        searchQuery = `${query} user:${githubUser}`
    } else {
        // FIX 5: Use authenticated user for unscoped code searches
        const scopeOwner = await getAuthenticatedUser()
        if (scopeOwner) {
            searchQuery = `${query} user:${scopeOwner}`
        }
    }

    const result = await callGitHubMCPTool(
        "search_code",
        { query: searchQuery.slice(0, 256), perPage: 10, page: 1 }
    )

    return {
        type: "github",
        tool: "search_code",
        repository: repo,
        data: extractMCPText(result),
        raw: result,
    }
}

// ============================================================
// Main: runGitHubQuery (intent-classifier-based)
// ============================================================

export async function runGitHubQuery(userQuery, conversationId) {
    const query = userQuery.trim()
    const language = detectLanguage(query)

    const context = conversationId ? await getGitHubContext(conversationId) : null
    const owner = await getAuthenticatedUser()

    const intentObj = await classifyGitHubIntent(query, conversationId, language, {
        ...context,
        query,
        owner,
    })

    const result = await handleGitHubIntent(intentObj, conversationId, language)

    const SAVE_CTX_INTENTS = new Set([
        "SHOW_REPOSITORY_TREE",
        "LIST_MY_REPOSITORIES",
        "SEARCH_REPOSITORIES",
        "SHOW_FILE",
        "EXPLAIN_FILE",
        "FIND_FILE",
        "SEARCH_CODE",
        "SHOW_README",
        "SHOW_COMMITS",
        "SHOW_COMMIT",
        "LIST_BRANCHES",
        "LIST_RELEASES",
        "SEARCH_ISSUES",
        "SHOW_ISSUE",
        "SEARCH_PR",
        "SHOW_PR",
        "SHOW_PR_DIFF",
        "UNIVERSAL_GITHUB_QUERY",
    ])

    if (conversationId && SAVE_CTX_INTENTS.has(intentObj.intent) && result.data && !result.data.includes("Could not determine")) {
        const update = { ...context, lastIntent: intentObj.intent }

        const repo = result.repository || (result.user && `${result.user}`)
        if (repo && repo.includes("/")) {
            update.selectedRepository = repo
            update.selectedOwner = repo.split("/")[0]
            update.selectedRepoName = repo.split("/")[1]
        }

        if (intentObj.repository && intentObj.repository.includes("/")) {
            update.selectedRepository = intentObj.repository
        }

        if (intentObj.path) {
            update.selectedFile = intentObj.path
        }

        await setGitHubContext(conversationId, update)
    }

    return result
}
