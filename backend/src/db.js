const mongoose = require("mongoose");

async function connectDB() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/refund_console');

        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

module.exports = connectDB;