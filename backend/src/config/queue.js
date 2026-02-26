const { Queue } = require("bullmq");
const redis = require("./redis");

const messageQueue = new Queue("messages", {
    connection: redis
});

module.exports = messageQueue;
