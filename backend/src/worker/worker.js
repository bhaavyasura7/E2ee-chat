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
        const { messageId, status, userId, isGroup } = job.data;
        const msg = await Message.findOne({ messageId });
        if (!msg) return;

        if (isGroup) {
            // Group Logic: Track individual reads and deliveries
            if (status === "delivered" && !msg.deliveredTo.find(d => d.userId === userId)) {
                msg.deliveredTo.push({ userId, timestamp: new Date() });
            } else if (status === "read" && !msg.readBy.find(r => r.userId === userId)) {
                msg.readBy.push({ userId, timestamp: new Date() });
            }
            await msg.save();
        } else {
            // Direct Message logic
            msg.status = status;
            await msg.save();
        }
        console.log(`Message ${messageId} status update processed for user ${userId || "DM"}`);
    }
}, { connection: redisOptions });

worker.on("completed", job => {
    console.log(`Job with id ${job.id} has been completed`);
});
worker.on("failed", (job, err) => {
    console.error(`Job with id ${job.id} has failed with ${err.message}`);
});
