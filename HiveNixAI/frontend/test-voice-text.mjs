import assert from "node:assert/strict"
import { cleanTextForSpeech, detectLanguage } from "./src/hooks/useVoiceMode.js"

const story = cleanTextForSpeech("Bilkul! Ek baar ek kauva tha. Usne paani dhoonda।")
assert.match(story, /Bilkul!/)
assert.match(story, /kauva tha\./)
assert.match(story, /dhoonda।/)

const markdown = cleanTextForSpeech("## Kahani\n\n- **Pehla** kadam.\n- `doosra` kadam.")
assert.match(markdown, /Kahani/)
assert.match(markdown, /Pehla kadam/)
assert.match(markdown, /doosra kadam/)
assert.doesNotMatch(markdown, /\$1|[#*`]/)

assert.doesNotMatch(cleanTextForSpeech("Read https://github.com/Lakshya0604/TechLearn now."), /https?:|Lakshya0604\/TechLearn/)
assert.doesNotMatch(cleanTextForSpeech("The repository Lakshya0604/TechLearn is available."), /Lakshya0604\/TechLearn/)
assert.equal(cleanTextForSpeech('{"tool":"get_file_contents","error":"404 Not Found"}'), "")
assert.equal(cleanTextForSpeech("GitHub MCP connection failed. 404 Not Found."), "")
assert.equal(cleanTextForSpeech("GitHub data: failed to resolve git reference"), "")

assert.equal(detectLanguage("मुझे एक कहानी सुनाओ"), "hi-IN")
assert.equal(detectLanguage("mujhe ek kahani suna do"), "hi-IN")
assert.equal(detectLanguage("mujhe backend samjhao"), "hi-IN")
assert.equal(detectLanguage("GitHub ka backend explain karo"), "hi-IN")
assert.equal(detectLanguage("Bilkul! Ek baar ek kauva tha."), "hi-IN")
assert.equal(detectLanguage("tell me a story"), "en-IN")
assert.equal(detectLanguage("Explain the login flow"), "en-IN")

console.log("Voice text tests passed (sanitization, final-response language, Hinglish).")