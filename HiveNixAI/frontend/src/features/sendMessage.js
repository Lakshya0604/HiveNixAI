import api from "../../utils/axios"

async function sendMessage(payload) {
    try {
        const { data } = await api.post("api/agent/chat", payload)
        return data;

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