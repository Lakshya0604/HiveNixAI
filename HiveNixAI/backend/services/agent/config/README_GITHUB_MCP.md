# GitHub MCP Integration

## Overview

The GitHub MCP integration connects the HiveNixAI agent service to the **GitHub Copilot MCP** endpoint (`https://api.githubcopilot.com/mcp/`). This allows users to query real GitHub data (repositories, files, commits, issues, PRs) in natural language across English, Hindi, and Hinglish.

### Architecture

```
User Query → Router.js (route to "search" agent) → searchAgent.js → isGitHubRequest() → runGitHubQuery() → handleGitHubIntent() → connectGitHubMCP() → GitHub Copilot MCP API
```

1. **Router** (`graph/router.js`) checks if the query is GitHub-related using `isGitHubRequest()` from `githubMcp.js`. If yes, routes to the `search` agent.
2. **SearchAgent** (`agents/searchAgent.js`) calls `runGitHubQuery()`, which:
   - Detects language (English, Hindi, Hinglish)
   - Classifies the intent using an LLM with regex-based fallback
   - Resolves the repository (fuzzy matching + git-remote fallback)
   - Calls the appropriate GitHub MCP tool
   - Saves conversation context to Redis for follow-up queries
   - Truncates response data to `MAX_GH_CHARS = 12000` before passing to the LLM
3. **GitHub MCP Client** (`config/githubMcp.js`) manages the MCP connection, tool calls, and response parsing.

## Environment Variables

| Variable | Description |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT passed as Bearer token to MCP API |
| `GITHUB_MCP_URL` | MCP endpoint URL (default: `https://api.githubcopilot.com/mcp/`) |
| `GITHUB_DEFAULT_OWNER` | Fallback GitHub username (optional) |

## Available MCP Tools (22)

The GitHub Copilot MCP API provides the following tools (read-only):

| Tool Name | Description | Used By |
|---|---|---|
| `get_me` | Returns authenticated user info (`login`, `id`, `name`, etc.) | `getAuthenticatedUser()` |
| `search_repositories` | Search for repositories by keyword query | `LIST_MY_REPOSITORIES`, `LIST_PUBLIC_REPOSITORIES`, `SEARCH_REPOSITORIES`, `listOwnRepoNames()` |
| `get_file_contents` | Fetch file/directory contents by `owner`, `repo`, `path` | `SHOW_FILE`, `EXPLAIN_FILE`, `SHOW_README`, `safeFetchFileContents()`, `fallbackResolveFile()`, `listRepositoryTree()` |
| `search_code` | Search code across GitHub or within a specific repo/user | `SEARCH_CODE`, `runGitHubQueryLegacy()` (default fallback) |
| `list_branches` | List branches in a repository | `LIST_BRANCHES` |
| `list_commits` | List commit history for a repository | `SHOW_COMMITS` |
| `get_commit` | Get details of a specific commit by SHA | `SHOW_COMMIT` |
| `search_commits` | Search commits across GitHub | `SEARCH_COMMITS` |
| `list_issues` | List issues in a repository | `SEARCH_ISSUES` |
| `issue_read` | Get details of a specific issue by number | `SHOW_ISSUE` |
| `list_pull_requests` | List pull requests in a repository | `SEARCH_PR` |
| `pull_request_read` | Get details of a specific PR by number | `SHOW_PR` |
| `search_pull_requests` | Search PRs across GitHub | `SEARCH_PR` |
| `list_releases` | List releases in a repository | `LIST_RELEASES` |
| `get_latest_release` | Get the latest release in a repository | `SHOW_RELEASE` |
| `get_release_by_tag` | Get a specific release by tag | `SHOW_RELEASE` |
| `list_tags` | List tags in a repository | `LIST_TAGS` |
| `get_tag` | Get details of a specific tag | `SHOW_TAG` |
| `issue_read` | Read a specific issue by number | `SHOW_ISSUE` |
| `get_label` | Get a specific label | `SHOW_LABEL` |
| `list_repository_collaborators` | List collaborators of a repository | `LIST_COLLABORATORS` |
| `get_team_members` | Get members of a GitHub team | (internal) |
| `get_teams` | Get teams for an organization | (internal) |
| `list_issue_types` | List issue types for a repository | (internal) |
| `list_issue_fields` | List issue fields for a repository | (internal) |

## Intent Classification (18 Intents)

The `classifyGitHubIntent()` function uses an LLM with a regex-based fallback (`fallbackClassifyIntent()`) to classify queries into 18 intents:

| Intent | Description | Example Queries |
|---|---|---|
| `LIST_MY_REPOSITORIES` | List authenticated user's repos | "show all my repositories", "मेरे रेपो दिखाओ" |
| `LIST_PUBLIC_REPOSITORIES` | List public repos for a user | "show all my public repositories" |
| `SEARCH_REPOSITORIES` | Search repos by keyword | "find React repos", "search for machine learning projects" |
| `SHOW_REPOSITORY_TREE` | Show directory structure | "show me the file structure of HiveNixAI", "browse repo" |
| `SEARCH_CODE` | Search code in repo/GitHub | "find getMessages", "where is auth.js used" |
| `SHOW_FILE` | Display file contents | "show package.json", "open index.js" |
| `EXPLAIN_FILE` | Explain code in a file | "explain getMessages", "is file samjha do" |
| `FIND_FILE` | Find file by name in repo | "find getMessages.js", "where is config file" |
| `SEARCH_ISSUES` | Search for issues | "find bugs", "open issues" |
| `SHOW_ISSUE` | Show specific issue | "show issue #123" |
| `SEARCH_PR` | Search for PRs | "find PRs", "pull request dikhao" |
| `SHOW_PR` | Show specific PR | "show PR #45" |
| `SHOW_PR_DIFF` | Show PR diff/changes | "show changes in PR #45" |
| `SHOW_COMMITS` | Show commit history | "latest commits", "last commit" |
| `SHOW_COMMIT` | Show specific commit | "show commit abc123" |
| `LIST_BRANCHES` | List branches | "all branches", "branches dikhao" |
| `LIST_RELEASES` | List releases | "show releases" |
| `GENERIC_GITHUB` | GitHub query that doesn't fit other intents | (fallback to `runGitHubQueryLegacy`) |

## Key Functions

### Connection & Tool Call
- **`connectGitHubMCP()`** — Establishes/maintains singleton MCP client connection with `context,repos,issues,pull_requests` toolsets
- **`callGitHubMCPTool(toolName, args, _retried)`** — Calls MCP tool with auto-reconnect on connection failure (one retry)
- **`listGitHubMCPTools()`** — Lists all available MCP tools (used for debugging/inspection)

### User & Repository Resolution
- **`getAuthenticatedUser()`** — Returns GitHub username from: `GITHUB_DEFAULT_OWNER` env → `get_me` MCP tool → `getGitRemoteInfo()?.owner`. Cached for 5 minutes.
- **`resolveRepository(intentObj, context)`** — Resolves repo `owner/name` from: explicit extraction → git remote fallback → fuzzy matching
- **`fuzzyResolveRepoName(repoName, owner)`** — Fuzzy-matches repo name against user's repos using Levenshtein distance (`rLev`) with threshold 0.4
- **`listOwnRepoNames()`** — Fetches user's repo names via `search_repositories` (`user:${owner}` query), cached in Redis

### Context Management
- **`getGitHubContext(conversationId)`** — Retrieves conversation context from Redis (TTL 30 min). Rejects invalid repos (no `/`).
- **`setGitHubContext(conversationId, context)`** — Saves context with 30-min TTL

### Language Detection
- **`detectLanguage(text)`** — Detects "English", "Hindi" (Devanagari script), or "Hinglish" (Roman Hindi words like "kya", "hai", "bhai")

### File Operations
- **`safeFetchFileContents(resolvedRepo, path, ...)`** — Fetches file contents with tree-search fallback when resolution fails
- **`fallbackResolveFile(intentObj, context, owner)`** — Fallback for when repo/path not fully resolved; tries common entry points (index.js, server.js, app.js, main.js)
- **`listRepositoryTree(owner, repo, path, maxDepth)`** — Recursively lists repo tree (max depth 3, max 30 MCP calls, skips `node_modules`, `.git`, `dist`, etc.)
- **`findFilesInTree(owner, repo, searchTerm)`** — Finds files by name in repo tree (file-only results)

### Request Detection
- **`isGitHubRequest(query, conversationId)`** — Determines if a query is GitHub-related:
  - `GH_STRONG`: "github", "repo", "pull request", "commit", "branch", "issue", Hindi text, file extensions, "file structure", "search code", etc.
  - `GH_FOLLOWUP`: "code", "repo", Hindi file/repo terms (only with existing context)
  - `JS_FRAMEWORK_WORDS` filter: Excludes "react", "vue", "angular", "express", "django", etc. to reduce false positives

### Main Query Handler
- **`runGitHubQuery(userQuery, conversationId)`** — Main entry point for GitHub queries. Classifies intent, resolves repo, calls handler, saves context conditionally.

## MCP Tool Registry

The `githubTools` object maps logical operation names to actual MCP tool calls:

| Logical Name | MCP Tool |
|---|---|
| `listRepositories` | `search_repositories` |
| `searchRepositories` | `search_repositories` |
| `getRepositoryTree` | `get_file_contents` |
| `getFileContents` | `get_file_contents` |
| `searchCode` | `search_code` |
| `searchIssues` | `search_issues` |
| `listIssues` | `list_issues` |
| `issueRead` | `issue_read` |
| `searchPullRequests` | `search_pull_requests` |
| `listPullRequests` | `list_pull_requests` |
| `pullRequestRead` | `pull_request_read` |
| `listCommits` | `list_commits` |
| `getCommit` | `get_commit` |
| `searchCommits` | `search_commits` |
| `listBranches` | `list_branches` |
| `listReleases` | `list_releases` |
| `getLatestRelease` | `get_latest_release` |
| `getReleaseByTag` | `get_release_by_tag` |
| `listTags` | `list_tags` |
| `getTag` | `get_tag` |
| `getLabel` | `get_label` |
| `listRepositoryCollaborators` | `list_repository_collaborators` |