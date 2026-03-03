const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { type: String },
    displayName: { type: String, required: true },
    publicKey: { type: String, required: true },
    profilePic: { type: String, default: null },  // base64 data URL
    privacySettings: {
        readReceipts: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' },
        onlineStatus: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
