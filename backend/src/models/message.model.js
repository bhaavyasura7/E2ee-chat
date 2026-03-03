const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    sender: String,
    receiver: String,
    encryptedMessage: String,
    encryptedKey: mongoose.Schema.Types.Mixed, // Object for groups, String for DMs
    iv: String,
    isGroup: { type: Boolean, default: false },
    isImage: { type: Boolean, default: false },      // photo message flag
    isSingleView: { type: Boolean, default: false }, // burn-after-reading photo
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    deliveredTo: [{ userId: String, timestamp: Date }],
    readBy: [{ userId: String, timestamp: Date }],
    // Edit support
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editHistory: [{ text: String, editedAt: Date }],
    // Delete support
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [String],   // list of userIds who deleted it for themselves
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
