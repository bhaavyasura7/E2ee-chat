const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    sender: String,
    receiver: String,
    encryptedMessage: String,
    encryptedKey: String,
    iv: String,
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);
