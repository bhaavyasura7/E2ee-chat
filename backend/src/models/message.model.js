const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    sender: String,
    receiver: String,
    encryptedMessage: String,
    encryptedKey: mongoose.Schema.Types.Mixed, // Object for Groups mapping userId -> their AES key, String for DMs
    iv: String,
    isGroup: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    deliveredTo: [{ userId: String, timestamp: Date }],
    readBy: [{ userId: String, timestamp: Date }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);
