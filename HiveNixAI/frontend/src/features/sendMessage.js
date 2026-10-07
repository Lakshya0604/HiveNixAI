import api from "../../utils/axios"

async function sendMessage(payload) {
    try {
        const { data } = await api.post("api/agent/chat", payload)
        // Backend returns { success, answer, images } or { success, error }
        if (data && typeof data === "object" && "success" in data) {
            if (data.success === false) {
                // Structured error from backend
                const error = new Error(data.error?.message || "Request failed")
                error.response = {
                    status: data.error?.status || 500,
                    data: data
                }
                error.code = data.error?.code || "UNKNOWN_ERROR"
                throw error
            }
            return {
                answer: data.answer || "",
                images: Array.isArray(data.images) ? data.images : []
            }
        }
        // Fallback for old response format
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
