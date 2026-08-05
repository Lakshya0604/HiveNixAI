import api from "../../utils/axios"

const getCurrentUser = async () => {
    try {
        const { data } = await api.get("/api/me")
        console.log(data)
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}

export default getCurrentUser