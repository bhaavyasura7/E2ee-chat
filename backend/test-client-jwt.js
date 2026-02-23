const { io } = require("socket.io-client");

async function runTest() {
    console.log("1️⃣ Step 1: Trying to connect without a token...");
    const badSocket = io("http://127.0.0.1:3000");

    badSocket.on("connect_error", (err) => {
        console.log("   ❌ Connection rejected as expected! Reason:", err.message);
        badSocket.close();
        testLogin();
    });
}

async function testLogin() {
    console.log("\n2️⃣ Step 2: Logging in via REST API...");
    try {
        const response = await fetch("http://127.0.0.1:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user_test_jwt" }),
        });

        const data = await response.json();
        console.log("   ✅ Received JWT from API:", data.token.substring(0, 30) + "...");

        testAuthenticatedSocket(data.token);
    } catch (err) {
        console.error("   ❌ Failed to login:", err);
    }
}

function testAuthenticatedSocket(token) {
    console.log("\n3️⃣ Step 3: Connecting with JWT Token...");
    const socket = io("http://127.0.0.1:3000", {
        auth: { token } // Passing the JWT here!
    });

    socket.on("connect", () => {
        console.log("   ✅ Connected successfully with ID:", socket.id);
        console.log("   Test passed! Authentication flow is working.");

        setTimeout(() => {
            socket.disconnect();
            process.exit(0);
        }, 1000);
    });

    socket.on("connect_error", (err) => {
        console.error("   ❌ Authentication failed:", err.message);
    });
}

// Start test
runTest();
