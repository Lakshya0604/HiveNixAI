import express from "express"
import { login, logout } from "../controllers/authCountroller.js"
const router = express.Router()

router.post("/login", login)
router.get("/logout", logout)

export default router