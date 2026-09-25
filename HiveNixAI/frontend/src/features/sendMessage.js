import api from "../../utils/axios"

async function sendMessage(payload) {
    try {
        const { data } = await api.post("api/agent/chat", payload)
        // Backend returns { answer, images } — return both so the UI
        // can render images inline instead of just text links.
        if (data && typeof data === "object" && "answer" in data) {
            return {
                answer: data.answer,
                images: Array.isArray(data.images) ? data.images : []
            }
        }
        return { answer: data, images: [] };
    } catch (error) {
        console.error("SEND MESSAGE ERROR:", error);

        console.error(
            "STATUS:",
            error.response?.status
        );

        console.error(
            "BACKEND RESPONSE:",
            error.response?.data
        );

        throw error;

    }
}
export default sendMessage