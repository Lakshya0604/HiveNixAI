import { getModel } from "../config/llmModel.js"
export const router = async (state) => {
    const llm = await getModel("router");

    const prompt = `
You are an agent router.

Your job is to analyze the user's query and decide which agent
should handle the request.

Available agents:

chat:
General conversation,
explanations,
learning,
questions,
greetings,
casual conversation,
general knowledge.

search:
Current events,
latest information,
recent news,
real-time information,
current prices,
weather,
sports,
information that requires internet or up-to-date data.

coding:
Programming,
writing code,
debugging,
fixing errors,
explaining code,
React,
Node.js,
Express,
MongoDB,
MERN,
JavaScript,
TypeScript,
Python,
Java,
C++,
APIs,
Git,
GitHub,
software development.

pdf:
Create PDF,
generate PDF,
PDF reports,
PDF documents,
PDF resume,
PDF assignment,
PDF documentation.

ppt:
Create PowerPoint,
generate PPT,
presentation,
slides,
PPTX,
seminar presentation,
college presentation,
project presentation.

imageGen:
Generate image,
create image,
image generation,
image editing,
edit image,
modify image,
enhance image,
transform image,
create logo,
create poster,
create banner,
create thumbnail,
create diagram,
create illustration,
visual design,
image transformation,
generate artwork.

Rules:

1. Choose ONLY ONE agent.

2. If the user is having a normal conversation,
   choose chat.

3. If the user needs current, latest, recent, or real-time
   information, choose search.

4. If the user asks anything related to programming,
   coding, debugging, software development, or code,
   choose coding.

5. If the user asks to create or generate a PDF,
   choose pdf.

6. If the user asks to create a PowerPoint presentation
   or slides, choose ppt.

7. If the user asks to generate, create, edit, modify,
   transform, enhance, or design an image,
   choose imageGen.

8. If the user asks for a logo, poster, banner, thumbnail,
   diagram, illustration, artwork, or other visual content,
   choose imageGen.

9. If the user provides an image and asks to edit,
   transform, enhance, modify, or redesign it,
   choose imageGen.

10. If the user's request does not match any specialized
    agent, choose chat.

11. Do not answer the user's question.

12. Your only task is to select the correct agent.

13. Return ONLY one word.

The only valid outputs are:

chat
search
coding
pdf
ppt
imageGen

User Query:

${state.prompt}
`;

    const response = await llm.invoke(prompt);
    console.log(prompt)

    return {
        ...state,
        agent: response.content.trim().toLowerCase()
    };
};  