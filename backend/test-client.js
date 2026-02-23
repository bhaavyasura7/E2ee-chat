const { io } = require("socket.io-client");

// Connect to your local API server
const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("✅ Connected to E2EE API Server with ID:", socket.id);

    // 1️⃣ Test: Register a Public Key
    console.log("🔑 Registering mock public key for user_123...");
    socket.emit("registerPublicKey", {
        userId: "user_123",
        publicKey: "mock_rsa_public_key_abc123"
    });

    // 2️⃣ Wait a second, then test sending a message
    setTimeout(() => {
        const mockMessage = {
            sender: "user_123",
            receiver: "user_456",
            encryptedMessage: "mock_encrypted_cipher_text...",
            encryptedKey: "mock_encrypted_aes_key...",
            iv: "mock_iv_string"
        };

        console.log("📤 Sending encrypted message payload...");
        socket.emit("sendMessage", mockMessage);
    }, 1000);
});

// 3️⃣ Test: Receive broadcasted messages
socket.on("receiveMessage", (data) => {
    console.log("📥 Received broadcast message via Redis Pub/Sub:", data);

    console.log("\nIf you saw this, the API & Redis are working perfectly!");
    console.log("Check your Docker terminal—the Worker should have also logged 'Message stored in DB'.");

    // Close connection after test
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 1500);
});

socket.on("disconnect", () => {
    console.log("❌ Disconnected from server.");
});
