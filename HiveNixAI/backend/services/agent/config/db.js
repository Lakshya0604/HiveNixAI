import mongoose from "mongoose";
import dotenv from "dotenv"
const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("database connected")
    } catch (error) {
        console.log(`database not connected ${error}`)
    }
}
export default connectDb