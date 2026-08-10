import "dotenv/config";

import express from "express";
import connectDb from "./config/db.js";
import router from "./agents/routes/agentRoute.js";

const app = express();

app.use(express.json());

app.use("/", router);

app.get("/", (req, res) => {
    res.json({
        message: "agent server is working",
    });
});

const port = process.env.PORT || 8003;

app.listen(port, () => {
    console.log(`Your agent server http://localhost:${port}`);
    connectDb();
});