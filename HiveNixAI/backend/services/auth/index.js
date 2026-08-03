import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/authRoute.js"
dotenv.config()
const app = express()
const port = process.env.PORT

app.use(express.json())
app.use("/", router)
app.get("/", (req, res) => {
    res.json({ message: "this is auth page" })
})
app.listen(port, () => {
    console.log(`auth services started at http://localhost:${port}`)
    connectDb()
})

