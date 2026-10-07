const GENERAL_CHAT_PATTERNS = [
    /^(?:hello|hi|hey|good morning|good afternoon|good evening|thanks|thank you|haan|han|nahi|nahin|acha|achha|ok|okay|theek hai)\b[\s!.?]*$/i,
    /\b(?:kahani|story|joke|poem|poetry|motivat(?:e|ion)|kauv[ae]|कहानी|चुटकुला|कविता)\b|\b(?:suna|sunao|sunaiye)\b/i,
    /\b(?:kaise ho|kya haal|kya ho raha|kya ho rhe|kya kar rahe ho|what are you doing|how are you|what's up|whats up)\b/i,
]

const WEATHER_PATTERN = /\b(weather|temperature|forecast|humidity|rain|snow|wind|sunny|cloudy|storm|climate|mausam|vedar|weather kaisa)\b|मौसम|बारिश|तापमान/i
const CURRENT_INFO_PATTERN = /\b(news|latest|current|recent|today|breaking|headlines)\b/i
const SPORTS_PATTERN = /\b(score|match|fixture|standings|league|football|soccer|cricket|basketball|tennis|hockey|baseball|ipl|premier league|world cup|fifa|nba|nfl)\b/i
const FINANCE_PATTERN = /\b(stock|ticker|crypto|bitcoin|ethereum|exchange rate|forex|gold price|market cap|share price)\b/i
const CODING_PATTERN = /\b(python|javascript|typescript|java|c\+\+|programming|coding|code|debug|function|class|array|dictionary|list|variable|syntax|algorithm|program)\b|\b(?:backend|frontend)\b.{0,30}\b(?:kya hota|what is|means)\b/i
const GITHUB_TERMS = /\b(github|repositories|repository|repos?|pull requests?|prs?|issues?|commits?|branches?|releases?|readme|github code)\b|रेपो|रिपॉजिटरी|कमिट|इश्यू|पीआर/i
const CODE_SEARCH_OPERATION = /\b(?:search|find)\b.{0,60}\b(?:code|function|class|component)\b/i
const OWNER_REPO_PATTERN = /(?:^|[\s("'`])([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)(?=$|[\s,;.)'"`])/i
const FILE_PATH_PATTERN = /(?:^|[\s("'`])(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx|py|java|go|rb|php|cpp|c|h|html|css|json|md|ya?ml|toml)(?=$|[\s,;.)'"`])/i
const REPOSITORY_QUESTION = /\b(?:explain|describe|overview|architecture|backend|frontend|authentication|auth|login|database|api|endpoint|dependencies|dependency|function|class|component|folder|directory|purpose|bugs?|risk|risky|implementation|flow|kya bana|kaise|kaha|samjhao|samjha|batao)\b/i
const REPOSITORY_STOP_WORDS = new Set([
    "show", "suna", "sunao", "sakti", "ho", "kya", "meri", "mera", "batao", "karo",
    "all", "my", "public", "private", "python", "javascript", "typescript", "java",
    "backend", "frontend", "api", "ai", "ml", "story", "kahani", "joke", "poem",
])

export function normalizeAgentName(value) {
    const agent = String(value || "").trim().toLowerCase()
    if (agent === "image" || agent === "imagegen") return "imageGen"
    return ["chat", "search", "coding", "pdf", "ppt"].includes(agent) ? agent : "chat"
}

function isRepositoryStyleName(value) {
    return /[a-z][A-Z]|\d|[_-]/.test(value)
}

function extractQuestionRepository(query) {
    const firstToken = String(query || "").trim().match(/^([A-Za-z][A-Za-z0-9_-]*)[.,]?\s+(.+)$/)
    if (!firstToken) return null

    const [, name, remainder] = firstToken
    if (!isRepositoryStyleName(name) || REPOSITORY_STOP_WORDS.has(name.toLowerCase())) return null
    return REPOSITORY_QUESTION.test(remainder) ? name : null
}

function extractOperationRepository(query) {
    const match = String(query || "").trim().match(
        /^(?:show|list|search|find|open|view|browse|explore|dikhao)\s+([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\s+(?:repo|repository|tree|structure|commits?|issues?|prs?|pull requests?))?\s*[.!?]*$/i
    )
    if (!match || REPOSITORY_STOP_WORDS.has(match[1].toLowerCase())) return null
    if (["all", "my", "public", "private", "me"].includes(match[1].toLowerCase())) return null
    return match[1]
}

export function isPotentialGitHubFollowUp(query) {
    const text = String(query || "").trim()
    const hasReference = /\b(?:iska|iske|isme|ismein|inme|inke|iss repo|is repo|is repository|is depository|this repo|that repo|this one|it)\b|इसमें|इसके|इसका/i.test(text)
    const hasRepositoryTopic = /\b(?:backend|frontend|authentication|auth|login|database|api|endpoint|dependencies|dependency|architecture|structure|tree|files?|folders?|functions?|code|commits?|issues?|pull requests?|prs?)\b|प्रमाणीकरण|लॉग[ -]?इन/i.test(text)
    const hasExplicitFileFollowUp = /\b(?:show|open|read|explain|dikhao)\b/i.test(text)
        && /\b[A-Za-z0-9_-]+\.(?:js|jsx|ts|tsx|py|java|go|html|css|json|md)\b/i.test(text)
    return hasReference && hasRepositoryTopic || hasExplicitFileFollowUp
}

export function detectConversationDomain(query, conversationContext = null) {
    const text = String(query || "").trim()
    const followUpCandidate = isPotentialGitHubFollowUp(text)
    const githubContext = conversationContext?.domain === "github"
        && Boolean(conversationContext?.selectedRepository || conversationContext?.repository)

    const result = (domain, agent, details = {}) => ({
        domain,
        agent,
        isFollowUp: Boolean(details.contextInherited),
        confidence: details.confidence ?? 0.95,
        githubEvidence: Boolean(details.githubEvidence),
        contextInherited: Boolean(details.contextInherited),
        repository: details.repository || null,
        isPotentialFollowUp: followUpCandidate,
    })

    if (!text) return result("general", "chat", { confidence: 1 })

    if (GENERAL_CHAT_PATTERNS.some(pattern => pattern.test(text))) {
        return result("general", "chat", { confidence: 0.99 })
    }

    if (/\b(?:what time|current time|time now|what's the time|today's date|time in)\b/i.test(text)) {
        return result("web_search", "search", { confidence: 0.98 })
    }
    if (WEATHER_PATTERN.test(text)) return result("weather", "search", { confidence: 0.98 })
    if (SPORTS_PATTERN.test(text)) return result("sports", "search", { confidence: 0.96 })
    if (FINANCE_PATTERN.test(text)) return result("finance", "search", { confidence: 0.96 })
    if (CURRENT_INFO_PATTERN.test(text)) return result("news", "search", { confidence: 0.93 })

    const ownerRepo = text.match(OWNER_REPO_PATTERN)
    const hasGitHubUrl = /(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(text)
    const questionRepository = extractQuestionRepository(text)
    const operationRepository = extractOperationRepository(text)
    const hasGitHubEvidence = hasGitHubUrl
        || Boolean(ownerRepo && !["bug", "bugs", "risk", "risky"].includes(ownerRepo[1].toLowerCase()))
        || GITHUB_TERMS.test(text)
        || CODE_SEARCH_OPERATION.test(text)
        || FILE_PATH_PATTERN.test(text) && Boolean(conversationContext?.selectedRepository)
        || Boolean(questionRepository)
        || Boolean(operationRepository)

    if (hasGitHubEvidence) {
        const repository = ownerRepo
            ? `${ownerRepo[1]}/${ownerRepo[2]}`
            : questionRepository || operationRepository
        return result("github", "search", { githubEvidence: true, repository, confidence: 0.98 })
    }

    if (githubContext && followUpCandidate) {
        return result("github", "search", {
            contextInherited: true,
            repository: conversationContext.selectedRepository || conversationContext.repository,
            confidence: 0.92,
        })
    }

    if (CODING_PATTERN.test(text)) return result("coding", "coding", { confidence: 0.9 })

    return result("other", null, { confidence: 0.65 })
}

export function filterHistoryByDomain(history, targetDomain = "general") {
    if (!Array.isArray(history)) return []

    const filtered = []
    let activeTurnDomain = "general"
    let githubContext = null

    for (const message of history) {
        if (!message || typeof message !== "object") continue
        const role = String(message.role || "").toLowerCase()
        let messageDomain = message.domain || activeTurnDomain

        if (!message.domain && role === "user") {
            const decision = detectConversationDomain(message.content, githubContext)
            messageDomain = decision.domain
            githubContext = decision.domain === "github"
                ? {
                    domain: "github",
                    selectedRepository: decision.repository || githubContext?.selectedRepository || null,
                }
                : null
            activeTurnDomain = messageDomain
        } else if (message.domain) {
            messageDomain = message.domain
            activeTurnDomain = messageDomain
            if (messageDomain === "github") {
                githubContext = {
                    domain: "github",
                    selectedRepository: message.repository || githubContext?.selectedRepository || null,
                }
            } else {
                githubContext = null
            }
        }

        if (messageDomain === targetDomain) filtered.push(message)
    }

    return filtered
}