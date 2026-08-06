import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/chatRoutes.js"
const app = express()
app.use(express.json())
dotenv.config()
const port = process.env.PORT

app.use("/", router)
app.get("/", (req, res) => {
    res.json({ message: "chat is server is working" })
})


app.listen(port, () => {
    console.log(`your chat server is http://localhost:${port}`)
    connectDb()
})