const TOPIC_PATTERNS = [
    ["authentication", /\b(auth(?:entication|orization)?|login|log in|sign[ -]?in|password|session|identity|login flow)\b|लॉग[ -]?इन|प्रमाणीकरण|पासवर्ड/i],
    ["database", /\b(database|db|mongo(?:db|ose)?|mongoose|mysql|postgres(?:ql)?|prisma|sqlite|data store)\b|डेटाबेस|database (?:kaha|kahan|where)|connect(?:ion)? (?:to )?(?:the )?database/i],
    ["backend", /\bbackend\b|back[ -]?end|server[- ]side|बैक[ -]?एंड/i],
    ["frontend", /\bfrontend\b|front[ -]?end|client[- ]side|फ्रंट[ -]?एंड/i],
    ["architecture", /\barchitect(?:ure|ural)?\b|\bdata flow\b|\bsystem design\b|\bhow .* work\b|\bkaise work\b|आर्किटेक्चर|डेटा फ्लो/i],
    ["AI", /\bai\b|artificial intelligence|\bllm\b|\bembedding(?:s)?\b|machine learning|एआई|कृत्रिम बुद्धिमत्ता/i],
    ["API", /\bapi\b|\bendpoint(?:s)?\b|\brest api\b|\bgraphql\b|एपीआई|एंडपॉइंट/i],
    ["dependencies", /\bdependenc(?:y|ies)\b|package\.json|requirements\.txt|\bpackages?\b|\bmodules?\b|निर्भरता/i],
    ["functions", /\bfunctions?\b|\bclasses?\b|\bcomponents?\b|फ़ंक्शन|फंक्शन/i],
    ["folders", /\bfolders?\b|\bdirectories\b|फ़ोल्डर|फोल्डर|डायरेक्टरी/i],
    ["commits", /\bcommits?\b|\bcommit history\b|कमिट/i],
    ["issues", /\bissues?\b|\bbugs?\b|\brisky implementation\b|\bpossible bugs?\b|इश्यू|बग|समस्या/i],
    ["pull_requests", /\bpull requests?\b|\bprs?\b|पुल रिक्वेस्ट|पीआर/i],
]

const TOPIC_SEARCHES = {
    overview: ["README architecture entry point"],
    authentication: ["login authentication authorization session password"],
    database: ["database connection mongoose MongoDB Prisma"],
    backend: ["backend routes controllers middleware server"],
    frontend: ["frontend pages components routes"],
    architecture: ["architecture data flow entry point routes"],
    AI: ["AI LLM model embedding machine learning"],
    API: ["API endpoint router routes controller"],
    dependencies: ["package.json dependencies requirements.txt"],
    functions: ["function class component definition usage"],
    folders: ["folder directory purpose files"],
    issues: ["TODO FIXME bug error validation"],
}

const TOPIC_PATH_HINTS = {
    authentication: ["auth", "login", "session", "user", "token"],
    database: ["db", "database", "model", "schema", "mongo", "config"],
    backend: ["backend", "server", "controller", "route", "middleware", "service"],
    frontend: ["frontend", "page", "component", "route", "src"],
    architecture: ["index", "app", "server", "route", "graph", "agent", "readme"],
    AI: ["ai", "llm", "model", "agent", "embedding", "prompt"],
    API: ["api", "route", "controller", "endpoint", "server"],
    dependencies: ["package.json", "requirements.txt", "pom.xml", "cargo.toml"],
    functions: ["function", "class", "component", "service", "controller"],
    folders: ["folder", "directory", "src", "backend", "frontend"],
    issues: ["todo", "fixme", "error", "test", "spec"],
}

const METADATA_TOPICS = new Set(["commits", "issues", "pull_requests"])
const MAX_UNIVERSAL_CONTEXT_CHARS = 10000
const MAX_FILE_CONTEXT_CHARS = 2400
const MAX_TREE_CONTEXT_CHARS = 2200
const MAX_SEARCH_RESULTS = 5

export function hasExplicitQueryTopic(query) {
    const text = String(query || "")
    return TOPIC_PATTERNS.some(([, pattern]) => pattern.test(text))
}

export function detectQueryTopics(query) {
    const text = String(query || "")
    const topics = TOPIC_PATTERNS
        .filter(([, pattern]) => pattern.test(text))
        .map(([topic]) => topic)

    if (topics.includes("backend") && !topics.includes("architecture")) {
        topics.push("architecture")
    }

    if (topics.length === 0) {
        topics.push("overview", "architecture")
    } else if (
        topics.length === 1 &&
        /\b(explain|describe|samjha|samjhao|batao|kya bana|what is in|what does)\b|समझाओ|बताओ/i.test(text) &&
        !METADATA_TOPICS.has(topics[0])
    ) {
        topics.push("overview")
    }

    return [...new Set(topics)]
}

export function planUniversalGitHubQuery(query, repo, context = null) {
    const repository = repo || context?.selectedRepository || null
    const topics = detectQueryTopics(query)
    const searches = [...new Set(topics.flatMap(topic => TOPIC_SEARCHES[topic] || []))].slice(0, 3)
    const metadataOnly = topics.every(topic => METADATA_TOPICS.has(topic))
    const fetchTree = !metadataOnly && topics.some(topic =>
        ["overview", "backend", "frontend", "architecture", "API", "dependencies"].includes(topic)
    )

    return {
        repository,
        topics,
        searches,
        files: [],
        fetchReadme: !metadataOnly,
        fetchTree,
        fetchCommits: topics.includes("commits"),
        fetchIssues: topics.includes("issues"),
        fetchPRs: topics.includes("pull_requests"),
        maxFiles: 5,
        maxCalls: 44,
        reason: `Targeted retrieval for ${topics.join(", ")}`,
    }
}

export function buildUniversalGitHubContext({
    query,
    repository,
    plan,
    readme,
    tree,
    searchResults = [],
    files = [],
    commits,
    issues,
    pullRequests,
}) {
    const sections = [
        `Repository: ${repository}`,
        `User question: ${query}`,
        `Detected topics: ${(plan?.topics || []).join(", ")}`,
    ]

    const addSection = (label, value, limit) => {
        if (!value) return
        const remaining = MAX_UNIVERSAL_CONTEXT_CHARS - sections.join("\n\n").length - label.length - 2
        if (remaining <= 0) return
        const content = String(value)
        const clipped = content.length > Math.min(limit, remaining)
            ? `${content.slice(0, Math.min(limit, remaining))}\n...[context limited]...`
            : content
        sections.push(`${label}\n${clipped}`)
    }

    addSection("README", readme, 2000)
    addSection("BOUNDED TREE", tree, MAX_TREE_CONTEXT_CHARS)

    for (const result of searchResults.slice(0, MAX_SEARCH_RESULTS)) {
        addSection(`CODE SEARCH: ${result.query}`, result.data, 1100)
    }

    for (const file of files.slice(0, 5)) {
        addSection(`FILE: ${file.path}\nCONTENT:`, file.content, MAX_FILE_CONTEXT_CHARS)
    }

    addSection("RECENT COMMITS", commits, 1200)
    addSection("OPEN ISSUES", issues, 1000)
    addSection("OPEN PULL REQUESTS", pullRequests, 1000)

    let contextText = sections.join("\n\n")
    if (contextText.length > MAX_UNIVERSAL_CONTEXT_CHARS) {
        const marker = "\n...[context limited]..."
        contextText = `${contextText.slice(0, MAX_UNIVERSAL_CONTEXT_CHARS - marker.length)}${marker}`
    }
    return contextText
}

function parseJson(text) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

function getSearchItems(text) {
    const parsed = parseJson(text)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.items)) return parsed.items
    return []
}

function normalizePath(path) {
    if (typeof path !== "string") return null
    const normalized = path.replace(/^\.\//, "").replace(/^\//, "")
    if (!normalized || normalized.split("/").some(part => part === "..")) return null
    return normalized
}

export async function executeUniversalGitHubQuery(query, repo, context, tools) {
    const plan = planUniversalGitHubQuery(query, repo, context)
    if (!plan.repository || !plan.repository.includes("/")) {
        return "Could not resolve a GitHub repository for this question."
    }

    const [owner, repositoryName] = plan.repository.split("/", 2)
    let calls = 0
    const callTool = async (name, args) => {
        if (calls >= plan.maxCalls) return null
        calls += 1
        try {
            return await tools.callGitHubMCPTool(name, args)
        } catch {
            return null
        }
    }

    let readme = ""
    let tree = ""
    let commits = ""
    let issues = ""
    let pullRequests = ""
    const searchResults = []
    const candidates = []
    const files = []

    if (plan.fetchReadme) {
        const result = await callTool("get_file_contents", {
            owner,
            repo: repositoryName,
            path: "README.md",
        })
        if (result) readme = tools.extractMCPText(result).slice(0, 2000)
    }

    if (plan.fetchTree && calls + 30 <= plan.maxCalls) {
        try {
            tree = await tools.listRepositoryTree(owner, repositoryName, "", 1)
            calls += 30
            for (const path of String(tree || "").split("\n")) {
                if (path && !path.trimEnd().endsWith("/")) candidates.push(path.trim())
            }
        } catch {
            calls += 30
        }
    }

    for (const search of plan.searches) {
        const result = await callTool("search_code", {
            query: `${search} repo:${plan.repository}`.slice(0, 256),
            perPage: MAX_SEARCH_RESULTS,
            page: 1,
        })
        if (!result) continue
        const text = tools.extractMCPText(result)
        const items = getSearchItems(text)
        const summary = items.slice(0, MAX_SEARCH_RESULTS).map(item => {
            const path = normalizePath(item.path)
            if (path) candidates.push(path)
            return `${path || item.name || "match"}${item.html_url ? ` (${item.html_url})` : ""}`
        }).join("\n")
        searchResults.push({ query: search, data: summary || text.slice(0, 1000) })
    }

    if (plan.fetchCommits) {
        const result = await callTool("list_commits", { owner, repo: repositoryName, perPage: 5, page: 1 })
        if (result) commits = tools.extractMCPText(result).slice(0, 1200)
    }
    if (plan.fetchIssues) {
        const result = await callTool("search_issues", {
            query: `repo:${plan.repository} is:open`, perPage: 5, page: 1,
        })
        if (result) issues = tools.extractMCPText(result).slice(0, 1000)
    }
    if (plan.fetchPRs) {
        const result = await callTool("search_pull_requests", {
            query: `repo:${plan.repository} is:open`,
        })
        if (result) pullRequests = tools.extractMCPText(result).slice(0, 1000)
    }

    const uniqueCandidates = [...new Set(candidates.map(normalizePath).filter(Boolean))]
        .filter(path => !/^README(?:\.md)?$/i.test(path))
    const hints = plan.topics.flatMap(topic => TOPIC_PATH_HINTS[topic] || [])
    uniqueCandidates.sort((left, right) => {
        const score = path => hints.reduce((total, hint) => total + (path.toLowerCase().includes(hint) ? 1 : 0), 0)
        return score(right) - score(left)
    })
    plan.files = uniqueCandidates.slice(0, plan.maxFiles)

    for (const path of plan.files) {
        if (calls >= plan.maxCalls || files.length >= plan.maxFiles) break
        const result = await callTool("get_file_contents", { owner, repo: repositoryName, path })
        if (!result) continue
        const content = tools.extractMCPText(result)
        if (content) files.push({ path, content: content.slice(0, MAX_FILE_CONTEXT_CHARS) })
    }

    return buildUniversalGitHubContext({
        query,
        repository: plan.repository,
        plan,
        readme,
        tree,
        searchResults,
        files,
        commits,
        issues,
        pullRequests,
    })
}