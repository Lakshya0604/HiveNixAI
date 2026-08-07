import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import { router } from "./agents/routes/agentRoute.js"
dotenv.config()
const app = express()

app.use(express.json())

app.use("/", router)
app.get("/", (req, res) => {
    res.json({ message: "agent server is working" })
})
const port = process.env.PORT
app.listen(port, () => {
    console.log(`your agent server http://localhost:${port}`)
    connectDb()
})