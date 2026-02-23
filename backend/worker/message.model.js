const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    encryptedMessage: String,
    encryptedKey: String,
    iv: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);
