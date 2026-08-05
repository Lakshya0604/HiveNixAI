import redis from "../../common/redis/redis.js"
const protect = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.session
        if (!sessionId) {
            return res.status(400).json({ message: "unauthrize" })
        }
        const session = await redis.get(`session-${sessionId}`)
        if (!session) {
            return res.status(400).json({ message: "session expired again login" })
        }
        req.user = JSON.parse(session)
        next()
    } catch (error) {
        res.status(500).json({ message: `protect error ${error}` })
    }
}
export default protect