const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true },
    name: String,
    members: [String],
    createdBy: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Group", groupSchema);
