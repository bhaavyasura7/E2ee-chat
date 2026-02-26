const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const Message = require("../models/message.model");

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chat";
mongoose.connect(mongoUri)
    .then(() => console.log("Worker connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

const redisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379
};

const worker = new Worker("messages", async job => {
    if (job.name === "storeMessage") {
        await Message.create(job.data);
        console.log(`Message ${job.data.messageId} stored in DB`);
    } else if (job.name === "updateStatus") {
        await Message.updateOne({ messageId: job.data.messageId }, { status: job.data.status });
        console.log(`Message ${job.data.messageId} status updated to ${job.data.status}`);
    }
}, { connection: redisOptions });

worker.on("completed", job => {
    console.log(`Job with id ${job.id} has been completed`);
});
worker.on("failed", (job, err) => {
    console.error(`Job with id ${job.id} has failed with ${err.message}`);
});
