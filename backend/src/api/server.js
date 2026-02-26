const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const redis = require("../config/redis");
const messageQueue = require("../config/queue");

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chat";
mongoose.connect(mongoUri).catch(err => console.error(err));

const Message = require("../models/message.model");

const app = express();
app.use(express.json()); // Allow JSON body parsing
app.use(require("cors")()); // Allow CORS for REST APIs too

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-e2ee-key";
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

// Redis Subscriber (for multi-instance support)
const subscriber = redis.duplicate();
subscriber.subscribe("chat");

subscriber.on("message", (channel, message) => {
    const data = JSON.parse(message);
    if (data.type === "statusUpdate") {
        io.to(data.sender).emit("statusUpdate", data);
    } else {
        io.to(data.receiver).emit("receiveMessage", data);
    }
});

// REST API: Login
app.post("/api/auth/login", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // In a real app, verify passwords against DB here
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, userId });
});

// REST API: Check Online Status
app.get("/api/users/:userId/status", async (req, res) => {
    const { userId } = req.params;
    try {
        const socketId = await redis.get(`online:${userId}`);
        res.json({ online: !!socketId });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// REST API: Fetch missed messages
app.get("/api/messages", async (req, res) => {
    // In a real app we'd verify JWT here, but for now we trust the query param
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// Socket.io Middleware: Verify JWT before connecting
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Authentication error: No token provided"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId; // Attach to socket for easy access
        next();
    } catch (err) {
        return next(new Error("Authentication error: Invalid token"));
    }
});

io.on("connection", async (socket) => {

    console.log(`User connected: ${socket.userId} (Socket ID: ${socket.id})`);

    // Join a personal room to route directed messages
    socket.join(socket.userId);

    // Mark user as online in Redis
    await redis.set(`online:${socket.userId}`, socket.id);

    // Save public key in Redis
    socket.on("registerPublicKey", async ({ userId, publicKey }) => {
        await redis.set(`publicKey:${userId}`, publicKey);
    });

    // Send message (already encrypted)
    socket.on("sendMessage", async (data) => {
        // Enforce the 'type' for our subscriber router logic
        const payload = { ...data, type: "message" };

        // 1️⃣ Real-time publish
        await redis.publish("chat", JSON.stringify(payload));

        // 2️⃣ Add to queue for DB storage
        await messageQueue.add("storeMessage", payload);
    });

    // Handle delivery receipts
    socket.on("messageDelivered", async ({ messageId, senderId }) => {
        await redis.publish("chat", JSON.stringify({ type: "statusUpdate", messageId, status: "delivered", sender: senderId }));
        await messageQueue.add("updateStatus", { messageId, status: "delivered" });
    });

    // Handle read receipts
    socket.on("messageRead", async ({ messageId, senderId }) => {
        await redis.publish("chat", JSON.stringify({ type: "statusUpdate", messageId, status: "read", sender: senderId }));
        await messageQueue.add("updateStatus", { messageId, status: "read" });
    });

    socket.on("disconnect", async () => {
        console.log(`User disconnected: ${socket.userId}`);
        // Remove user from online status in Redis
        await redis.del(`online:${socket.userId}`);
    });

});

server.listen(3000, "0.0.0.0", () => {
    console.log("Backend API running on port 3000");
});
