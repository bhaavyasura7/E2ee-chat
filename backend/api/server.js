const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const redis = require("./redis");
const messageQueue = require("./queue");

const jwt = require("jsonwebtoken");

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
    io.emit("receiveMessage", JSON.parse(message));
});

// REST API: Login
app.post("/api/auth/login", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // In a real app, verify passwords against DB here
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, userId });
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

io.on("connection", (socket) => {

    console.log(`User connected: ${socket.userId} (Socket ID: ${socket.id})`);

    // Save public key in Redis
    socket.on("registerPublicKey", async ({ userId, publicKey }) => {
        await redis.set(`publicKey:${userId}`, publicKey);
    });

    // Send message (already encrypted)
    socket.on("sendMessage", async (data) => {

        // 1️⃣ Real-time publish
        await redis.publish("chat", JSON.stringify(data));

        // 2️⃣ Add to queue for DB storage
        await messageQueue.add("storeMessage", data);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });

});

server.listen(3000, "0.0.0.0", () => {
    console.log("Backend API running on port 3000");
});
