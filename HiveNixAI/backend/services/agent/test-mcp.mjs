import { connectGitHubMCP, callGitHubMCPTool, extractMCPText } from './config/githubMcp.js'

async function test() {
    try {
        const client = await connectGitHubMCP()
        console.log('MCP connected successfully')

        const tools = await client.listTools()
        console.log('Available tools:', tools.tools?.map(t => t.name).join(', '))

        try {
            const me = await callGitHubMCPTool('get_me', {})
            console.log('get_me result:', extractMCPText(me))
        } catch(e) {
            console.log('get_me failed:', e.message)
        }

        try {
            const repos = await callGitHubMCPTool('search_repositories', { query: 'user:Lakshya0604', perPage: 5, page: 1 })
            console.log('search_repositories:', extractMCPText(repos).slice(0, 800))
        } catch(e) {
            console.log('search_repositories failed:', e.message)
        }
    } catch(e) {
        console.error('MCP connection failed:', e.message)
        console.error('Error details:', e.cause || e)
    }
}
test()
