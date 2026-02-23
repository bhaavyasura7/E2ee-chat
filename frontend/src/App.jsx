import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { generateRSAKeyPair, encryptMessagePayload, decryptMessagePayload } from './utils/crypto';
import './App.css';

const API_URL = 'http://127.0.0.1:3000';

function App() {
  // Auth state
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState(null);
  const [myKeys, setMyKeys] = useState(null);

  // Chat state
  const [socket, setSocket] = useState(null);
  const [receiverId, setReceiverId] = useState('');
  const [receiverKey, setReceiverKey] = useState('');
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);

  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // 1. LOGIN & GENERATE KEYS
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId) return;

    try {
      // Get JWT from backend
      const res = await axios.post(`${API_URL}/api/auth/login`, { userId });
      const jwtToken = res.data.token;

      // Generate RSA Keys for this session
      console.log('Generating RSA Keys...');
      const keys = await generateRSAKeyPair();
      setMyKeys(keys);
      setToken(jwtToken);

      // Connect to Socket.io securely
      const newSocket = io(API_URL, {
        auth: { token: jwtToken }
      });

      newSocket.on("connect", () => {
        console.log("Connected securely to Socket.io!");
        // Immediately register our public key with the backend
        newSocket.emit("registerPublicKey", {
          userId,
          publicKey: keys.publicKey
        });
      });

      newSocket.on("connect_error", (err) => {
        alert("Authentication failed: " + err.message);
      });

      // Listen for incoming messages
      newSocket.on("receiveMessage", async (incomingPackage) => {
        try {
          // If the message is from myself, just display it (we don't need to decrypt our own sent message here)
          if (incomingPackage.sender === userId) return;

          // Decrypt the message using my private key
          const decryptedText = await decryptMessagePayload(incomingPackage, keys.rawKeyPair.privateKey);

          setChatLog(prev => [...prev, {
            from: incomingPackage.sender,
            text: decryptedText,
            isMe: false
          }]);
        } catch (error) {
          console.error("Failed to decrypt message:", error);
          setChatLog(prev => [...prev, {
            from: incomingPackage.sender,
            text: "[Encrypted Message - Could not decrypt]",
            isMe: false,
            error: true
          }]);
        }
      });

      setSocket(newSocket);
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  // 2. SEND SECURE MESSAGE
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!socket || !receiverId || !receiverKey || !message) return;

    try {
      // Add plain text to our local UI immediately
      setChatLog(prev => [...prev, {
        from: userId,
        text: message,
        isMe: true
      }]);

      // Encrypt the payload using the receiver's public key (trim whitespace just in case)
      const encryptedPayload = await encryptMessagePayload(message, receiverKey.trim());

      // Send the gibberish to the backend bucket
      socket.emit("sendMessage", {
        sender: userId,
        receiver: receiverId,
        ...encryptedPayload
      });

      setMessage('');
    } catch (err) {
      console.error("Encryption failed:", err);
      alert("Failed to encrypt message");
    }
  };

  // UI: Login Screen
  if (!token) {
    return (
      <div className="login-container">
        <h1>E2EE Chat Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Enter your User ID (e.g. alice)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
          <button type="submit">Login & Generate Keys</button>
        </form>
      </div>
    );
  }

  // UI: Chat Screen
  return (
    <div className="chat-container">
      <header>
        <h2>Logged in as: {userId}</h2>
        <div className="key-display">
          <small style={{ display: 'block', wordBreak: 'break-all', marginBottom: '5px' }}>
            My Public Key: {myKeys?.publicKey}
          </small>
          <button
            onClick={() => navigator.clipboard.writeText(myKeys?.publicKey)}
            style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: '#e4e6eb', color: '#050505', border: 'none', borderRadius: '4px' }}
          >
            Copy Public Key
          </button>
        </div>
      </header>

      <div className="connection-setup">
        <h3>Start Chat Setup</h3>
        <input
          type="text"
          placeholder="Receiver User ID (e.g. bob)"
          value={receiverId}
          onChange={(e) => setReceiverId(e.target.value)}
        />
        <textarea
          placeholder="Paste Receiver's Public Key here..."
          value={receiverKey}
          onChange={(e) => setReceiverKey(e.target.value)}
          rows="3"
        />
        <small style={{ display: 'block', marginTop: '5px' }}>
          *In a real app, the backend would automatically fetch their public key from Redis. For this demo, copy and paste it.*
        </small>
      </div>

      <div className="messages-area">
        {chatLog.map((log, idx) => (
          <div key={idx} className={`message ${log.isMe ? 'me' : 'them'} ${log.error ? 'error' : ''}`}>
            <strong>{log.from}: </strong>
            <span>{log.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="compose-area" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a secure message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!receiverId || !receiverKey}
        />
        <button type="submit" disabled={!receiverId || !receiverKey || !message}>Send Encrypted</button>
      </form>
    </div>
  );
}

export default App;
