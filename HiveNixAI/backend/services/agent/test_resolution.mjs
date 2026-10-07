const data = `Resolved potential matches in the repository tree (resolved refs: {"Ref":"refs/heads/main","SHA":"0c164b0ca2121e7af6c890bc234c59230d370088"}, matching files: ["HiveNixAI/backend/services/agent/utils/getMessages.js", "HiveNixAI/frontend/src/features/getMessages.js"]).`

const isErrorOrResolution = /did you mean|may refer to|multiple matches|not a file|does not exist|not found|no such file|was not found|path not found|no file|error|resolution|resolved potential matches|ambiguous/i.test(data)
console.log("isErrorOrResolution:", isErrorOrResolution)

const ext = "(?:js|ts|jsx|tsx|py|java|go|rs|rb|php|cpp|c|h|html|css|json|md|yaml|yml|toml|cfg|ini)"
const pathPattern = "(?:[A-Za-z0-9_.-]+/)*(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+\\." + ext

const matches = data.match(new RegExp(`["'\`]${pathPattern}["'\`]`, "gi"))
console.log("backtick/quoted matches:", matches)

const jsonStart = data.indexOf("[")
const jsonEnd = data.lastIndexOf("]")
console.log("jsonStart:", jsonStart, "jsonEnd:", jsonEnd)
if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const jsonStr = data.slice(jsonStart, jsonEnd + 1)
    console.log("jsonStr:", jsonStr)
    try {
        const arr = JSON.parse(jsonStr)
        console.log("parsed:", arr)
        const paths = arr.filter(s => typeof s === "string" && s.includes("/")).map(s => s.trim())
        console.log("extracted paths:", paths)
    } catch (e) {
        console.log("JSON parse failed:", e.message)
    }
}
