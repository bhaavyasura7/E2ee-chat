const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const redis = require("../config/redis");
const messageQueue = require("../config/queue");

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chat";
mongoose.connect(mongoUri).catch(err => console.error(err));

const Message = require("../models/message.model");
const Group = require("../models/group.model");
const User = require("../models/user.model");

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
    } else if (data.type === "groupCreated") {
        data.group.members.forEach(member => {
            io.to(member).emit("groupCreated", data.group);
        });
    } else if (data.type === "messageEdited") {
        // Broadcast edit to all participants
        if (data.isGroup && data.members) {
            data.members.forEach(member => io.to(member).emit("messageEdited", data));
        } else {
            io.to(data.receiver).emit("messageEdited", data);
            io.to(data.sender).emit("messageEdited", data);
        }
    } else if (data.type === "messageDeleted") {
        // Broadcast delete-for-everyone to all participants
        if (data.isGroup && data.members) {
            data.members.forEach(member => io.to(member).emit("messageDeleted", data));
        } else {
            io.to(data.receiver).emit("messageDeleted", data);
            io.to(data.sender).emit("messageDeleted", data);
        }
    } else {
        if (data.isGroup && data.members) {
            data.members.forEach(member => {
                io.to(member).emit("receiveMessage", data);
            });
        } else {
            io.to(data.receiver).emit("receiveMessage", data);
        }
    }
});

// REST API: Check username availability + suggest unique alternatives
app.get("/api/auth/check-username/:username", async (req, res) => {
    try {
        const base = req.params.username.toLowerCase().trim();
        const existing = await User.findOne({ username: base });
        if (!existing) {
            return res.json({ available: true, suggested: base });
        }
        // Username taken — find a unique suggestion like base_1, base_2, ...
        let counter = 1;
        let suggested = `${base}_${counter}`;
        while (await User.findOne({ username: suggested })) {
            counter++;
            suggested = `${base}_${counter}`;
        }
        return res.json({ available: false, suggested });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// REST API: Login / Register
app.post("/api/auth/login", async (req, res) => {
    try {
        const { userId, displayName, publicKey, password, isRegistering } = req.body;

        // --- Basic validation ---
        if (!userId) return res.status(400).json({ error: "Username is required." });
        if (!password) return res.status(400).json({ error: "Password is required." });

        const usernameClean = userId.toLowerCase().trim();
        const user = await User.findOne({ username: usernameClean });

        // ========== REGISTER FLOW ==========
        if (isRegistering) {
            // Block if username already exists
            if (user) {
                return res.status(400).json({ error: `Username "${usernameClean}" is already taken. Please choose another.` });
            }
            if (!displayName || !publicKey) {
                return res.status(400).json({ error: "Registration requires a display name and public key." });
            }
            // Hash the password before storing — never store plain text
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const newUser = await User.create({ username: usernameClean, password: hashedPassword, displayName, publicKey });
            const token = jwt.sign({ userId: newUser.username }, JWT_SECRET, { expiresIn: "30d" });
            return res.json({
                token, userId: newUser.username, displayName: newUser.displayName,
                publicKey: newUser.publicKey,
                profilePic: null,
                privacySettings: { readReceipts: 'everyone', onlineStatus: 'everyone' }
            });
        }

        // ========== LOGIN FLOW ==========
        // User must already exist
        if (!user) {
            return res.status(404).json({ error: "No account found with that username. Please register first." });
        }

        // Verify password against bcrypt hash
        if (!user.password) {
            // Legacy account with no password — hash and set it now
            user.password = await bcrypt.hash(password, SALT_ROUNDS);
            await user.save();
        } else {
            // Check if stored password looks like a bcrypt hash
            const isBcryptHash = user.password.startsWith("$2b$") || user.password.startsWith("$2a$");
            if (isBcryptHash) {
                const match = await bcrypt.compare(password, user.password);
                if (!match) return res.status(401).json({ error: "Incorrect password." });
            } else {
                // Legacy plain-text password — verify then upgrade to bcrypt hash
                if (user.password !== password) return res.status(401).json({ error: "Incorrect password." });
                user.password = await bcrypt.hash(password, SALT_ROUNDS);
                await user.save();
            }
        }

        // Update public key if it changed (new device / new session keys)
        if (publicKey && user.publicKey !== publicKey) {
            user.publicKey = publicKey;
            await user.save();
        }

        const token = jwt.sign({ userId: user.username }, JWT_SECRET, { expiresIn: "30d" });
        return res.json({
            token, userId: user.username, displayName: user.displayName,
            publicKey: user.publicKey,
            profilePic: user.profilePic || null,
            privacySettings: user.privacySettings || { readReceipts: 'everyone', onlineStatus: 'everyone' }
        });

    } catch (e) {
        console.error("Auth Error:", e);
        res.status(500).json({ error: e.message || "Server error" });
    }
});

// REST API: Fetch Single User for Direct Messages
app.get("/api/users/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username.toLowerCase() });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({
            username: user.username,
            displayName: user.displayName,
            publicKey: user.publicKey,
            profilePic: user.profilePic || null
        });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// REST API: Update profile (picture + privacy settings)
app.put("/api/users/:username/profile", async (req, res) => {
    try {
        const { username } = req.params;
        const { profilePic, privacySettings, displayName } = req.body;

        const update = {};
        if (profilePic !== undefined) update.profilePic = profilePic;
        if (displayName) update.displayName = displayName;
        if (privacySettings) update.privacySettings = privacySettings;

        const user = await User.findOneAndUpdate(
            { username: username.toLowerCase() },
            { $set: update },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({
            username: user.username,
            displayName: user.displayName,
            profilePic: user.profilePic || null,
            privacySettings: user.privacySettings
        });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// REST API: Check Online Status (respects user's privacy setting)
app.get("/api/users/:userId/status", async (req, res) => {
    const { userId } = req.params;
    try {
        // Check privacy setting first
        const user = await User.findOne({ username: userId.toLowerCase() });
        if (user && user.privacySettings?.onlineStatus === 'nobody') {
            return res.json({ online: false }); // hidden by privacy
        }
        const socketId = await redis.get(`online:${userId}`);
        res.json({ online: !!socketId });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// REST API: Fetch missed messages
app.get("/api/messages", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
        const userGroups = await Group.find({ members: userId });
        const groupIds = userGroups.map(g => g.groupId);

        const messages = await Message.find({
            $or: [
                { sender: userId },
                { receiver: userId },
                { receiver: { $in: groupIds }, isGroup: true }
            ]
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// REST API: Create a Group
app.post("/api/groups", async (req, res) => {
    try {
        const { groupId, name, members, createdBy } = req.body;
        const group = await Group.create({ groupId, name, members, createdBy });

        // Notify all members about the new group via Socket so their UI updates
        const groupEvent = { type: "groupCreated", group };
        await redis.publish("chat", JSON.stringify(groupEvent));

        res.json(group);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to create group" });
    }
});

// REST API: Fetch user's Groups
app.get("/api/users/:userId/groups", async (req, res) => {
    try {
        const groups = await Group.find({ members: req.params.userId });
        res.json(groups);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch groups" });
    }
});

// REST API: Fetch multiple public keys at once
app.post("/api/users/keys", async (req, res) => {
    try {
        const { userIds } = req.body;
        const users = await User.find({ username: { $in: userIds.map(u => u.toLowerCase()) } });

        const keys = {};
        users.forEach(u => keys[u.username] = u.publicKey);
        res.json(keys);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch keys" });
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
    socket.on("messageDelivered", async ({ messageId, senderId, isGroup }) => {
        const payload = { type: "statusUpdate", messageId, status: "delivered", sender: senderId, userId: socket.userId, isGroup };
        await redis.publish("chat", JSON.stringify(payload));
        // Add to background database worker
        await messageQueue.add("updateStatus", { messageId, status: "delivered", userId: socket.userId, isGroup });
    });

    // Handle read receipts
    socket.on("messageRead", async ({ messageId, senderId, isGroup }) => {
        const payload = { type: "statusUpdate", messageId, status: "read", sender: senderId, userId: socket.userId, isGroup };
        await redis.publish("chat", JSON.stringify(payload));
        await messageQueue.add("updateStatus", { messageId, status: "read", userId: socket.userId, isGroup });
    });

    // ── Edit Message (within 10 minutes) ──────────────────────────────────────────
    socket.on("editMessage", async ({ messageId, newEncryptedMessage, newEncryptedKey, newIv, receiver, isGroup, members }) => {
        try {
            const msg = await Message.findOne({ messageId });
            if (!msg) return;
            if (msg.sender !== socket.userId) return; // only sender can edit
            const ageMs = Date.now() - new Date(msg.createdAt).getTime();
            if (ageMs > 10 * 60 * 1000) {
                socket.emit("editError", { messageId, error: "Edit window (10 min) has expired." });
                return;
            }
            // Store old ciphertext in history (encrypted), update current
            msg.editHistory = msg.editHistory || [];
            msg.editHistory.push({ text: msg.encryptedMessage, editedAt: new Date() });
            msg.encryptedMessage = newEncryptedMessage;
            msg.encryptedKey = newEncryptedKey;
            msg.iv = newIv;
            msg.edited = true;
            msg.editedAt = new Date();
            await msg.save();

            // Broadcast edit to all relevant parties
            const editPayload = { type: "messageEdited", messageId, newEncryptedMessage, newEncryptedKey, newIv, sender: socket.userId, receiver, isGroup, members };
            await redis.publish("chat", JSON.stringify(editPayload));
        } catch (e) {
            console.error("Edit error:", e);
        }
    });

    // ── Delete Message ────────────────────────────────────────────────────────────
    socket.on("deleteMessage", async ({ messageId, deleteFor, receiver, isGroup, members }) => {
        try {
            // deleteFor: 'me' | 'everyone'
            const msg = await Message.findOne({ messageId });
            if (!msg) return;

            if (deleteFor === 'everyone') {
                if (msg.sender !== socket.userId) return; // only sender
                msg.deletedForEveryone = true;
                await msg.save();
                const delPayload = { type: "messageDeleted", messageId, deletedForEveryone: true, sender: socket.userId, receiver, isGroup, members };
                await redis.publish("chat", JSON.stringify(delPayload));
            } else {
                // Delete for me only — add userId to deletedFor array
                if (!msg.deletedFor.includes(socket.userId)) {
                    msg.deletedFor.push(socket.userId);
                    await msg.save();
                }
                // No broadcast needed — only local state changes
            }
        } catch (e) {
            console.error("Delete error:", e);
        }
    });

    socket.on("disconnect", async () => {
        console.log(`User disconnected: ${socket.userId}`);
        await redis.del(`online:${socket.userId}`);
    });

});

server.listen(3000, "0.0.0.0", () => {
    console.log("Backend API running on port 3000");
});
