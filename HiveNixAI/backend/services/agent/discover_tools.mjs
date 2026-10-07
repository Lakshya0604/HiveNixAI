import { listGitHubMCPTools } from "./config/githubMcp.js"
import dotenv from "dotenv"
dotenv.config({ path: ".env" })

const tools = await listGitHubMCPTools()
for (const tool of tools) {
    console.log(JSON.stringify({ name: tool.name, description: (tool.description || "").slice(0, 100) }))
}
process.exit(0)
