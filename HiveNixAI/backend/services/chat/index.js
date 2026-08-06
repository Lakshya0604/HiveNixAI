import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
const app = express()
app.use(express.json())
dotenv.config()

app.get("/", (req, res) => {
    res.json({ message: "chat is server is working" })
})

const port = process.env.PORT
app.listen(port, () => {
    console.log(`your chat server is http://localhost:${port}`)
    connectDb()
})