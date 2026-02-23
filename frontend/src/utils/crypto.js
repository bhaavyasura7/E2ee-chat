/**
 * Utility functions for Hybrid E2EE (AES-GCM + RSA-OAEP)
 * Runs entirely in the browser (Frontend)
 */

// --- 1. RSA KEY GENERATION ---
export async function generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true, // extractable
        ["encrypt", "decrypt"]
    );

    // Export public key to send to backend
    const exportedPublicKey = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
    );

    // Export private key to store locally (e.g. IndexedDB or memory)
    const exportedPrivateKey = await window.crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey
    );

    return {
        publicKey: btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey))),
        privateKey: btoa(String.fromCharCode(...new Uint8Array(exportedPrivateKey))),
        rawKeyPair: keyPair // keep raw crypto keys in memory for fast operations
    };
}


// --- 2. AES KEY GENERATION ---
export async function generateAESKey() {
    return await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}


// --- 3. ENCRYPT MESSAGE (The Sender Flow) ---
export async function encryptMessagePayload(plainText, receiverPublicKeyBase64) {
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(plainText);

    // 1. Generate one-time AES key
    const aesKey = await generateAESKey();

    // 2. Encrypt the text using AES
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContentBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        aesKey,
        encodedText
    );

    // 3. Export AES key to encrypt it
    const exportedAESKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // 4. Import the receiver's RSA public key string into a CryptoKey
    const binaryDerString = window.atob(receiverPublicKeyBase64);
    const binaryDer = new Uint8Array([...binaryDerString].map(char => char.charCodeAt(0)));
    const receiverRSAPublicKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["encrypt"]
    );

    // 5. Encrypt the AES key using their RSA Public Key
    const encryptedAESKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        receiverRSAPublicKey,
        exportedAESKey
    );

    // 6. Return the fully encrypted package, encoded in Base64 for JSON transmission
    return {
        encryptedMessage: btoa(String.fromCharCode(...new Uint8Array(encryptedContentBuffer))),
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedAESKeyBuffer))),
        iv: btoa(String.fromCharCode(...iv))
    };
}


// --- 4. DECRYPT MESSAGE (The Receiver Flow) ---
export async function decryptMessagePayload(encryptedPackage, myRSAPrivateKeyObject) {
    const { encryptedMessage, encryptedKey, iv } = encryptedPackage;

    // 1. Decode base64 strings back to ArrayBuffers
    const encryptedContentBuffer = new Uint8Array([...window.atob(encryptedMessage)].map(c => c.charCodeAt(0)));
    const encryptedKeyBuffer = new Uint8Array([...window.atob(encryptedKey)].map(c => c.charCodeAt(0)));
    const ivBuffer = new Uint8Array([...window.atob(iv)].map(c => c.charCodeAt(0)));

    // 2. Decrypt the AES key using my RSA Private Key
    const decryptedAESKeyBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myRSAPrivateKeyObject,
        encryptedKeyBuffer
    );

    // 3. Import the decrypted ArrayBuffer back into an AES CryptoKey object
    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedAESKeyBuffer,
        "AES-GCM",
        true,
        ["decrypt"]
    );

    // 4. Decrypt the actual message using the AES key
    const decryptedContentBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuffer
        },
        aesKey,
        encryptedContentBuffer
    );

    // 5. Decode back to plain string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedContentBuffer);
}
