import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  generateRSAKeyPair, importRSAPrivateKey,
  encryptMessagePayload, decryptMessagePayload, encryptGroupMessagePayload
} from './utils/crypto';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import './App.css';

const API_URL = 'http://127.0.0.1:3000';

export default function App() {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState(null);
  const [myKeys, setMyKeys] = useState(null);

  // ── Auth form ─────────────────────────────────────────────────────────────
  const [isRegistering, setIsRegistering] = useState(false);
  const [password, setPassword] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [authError, setAuthError] = useState('');

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [socket, setSocket] = useState(null);
  const [receiverId, setReceiverId] = useState('');
  const [receiverKey, setReceiverKey] = useState('');
  const [isReceiverOnline, setIsReceiverOnline] = useState(false);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [newChatUser, setNewChatUser] = useState('');

  // ── Contacts / Groups ─────────────────────────────────────────────────────
  const [contacts, setContacts] = useState({});
  const [groups, setGroups] = useState([]);
  const [activeChatType, setActiveChatType] = useState('direct');
  const [activeGroupId, setActiveGroupId] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  // ── Refs (stable references for socket callbacks) ─────────────────────────
  const currentReceiverRef = useRef(receiverId);
  useEffect(() => { currentReceiverRef.current = receiverId; }, [receiverId]);

  const currentGroupIdRef = useRef(activeGroupId);
  useEffect(() => { currentGroupIdRef.current = activeGroupId; }, [activeGroupId]);

  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  const bottomRef = useRef(null);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // ── Persist chat to localStorage ──────────────────────────────────────────
  useEffect(() => {
    if (userId && chatLog.length > 0) {
      localStorage.setItem(`chat_${userId}`, JSON.stringify(chatLog));
    }
  }, [chatLog, userId]);

  // ── Live username availability (register mode) ────────────────────────────
  useEffect(() => {
    if (!isRegistering || !userId || userId.length < 2) {
      setUsernameStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/check-username/${userId}`);
        setUsernameStatus(res.data);
      } catch {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, isRegistering]);

  // ── Send read receipts when active chat changes ───────────────────────────
  useEffect(() => {
    if (!socket) return;
    let updated = false;
    const newChatLog = chatLog.map(log => {
      if (!log.isMe && !log.hasAckedDelivery && log.status !== 'read') {
        socket.emit('messageDelivered', { messageId: log.messageId, senderId: log.from, isGroup: log.isGroup });
        updated = true;
        log.hasAckedDelivery = true;
      }
      const isActive = log.isGroup
        ? log.receiver === currentGroupIdRef.current
        : log.from === currentReceiverRef.current;
      if (!log.isMe && isActive && log.status !== 'read') {
        socket.emit('messageRead', { messageId: log.messageId, senderId: log.from, isGroup: log.isGroup });
        updated = true;
        log.status = 'read';
      }
      return log;
    });
    if (updated) setChatLog(newChatLog);
  }, [receiverId, activeGroupId, chatLog, socket]);

  // ── Poll receiver online status ───────────────────────────────────────────
  useEffect(() => {
    if (!receiverId) { setIsReceiverOnline(false); return; }
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/${receiverId}/status`);
        setIsReceiverOnline(res.data.online);
      } catch { setIsReceiverOnline(false); }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [receiverId]);

  // ── LOGIN / REGISTER ──────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!userId.trim()) { setAuthError('Please enter a username.'); return; }
    if (!password) { setAuthError('Please enter a password.'); return; }
    if (isRegistering && !displayName.trim()) { setAuthError('Please enter a display name.'); return; }
    if (isRegistering && usernameStatus && !usernameStatus.available) {
      setAuthError(`Username "${userId}" is already taken. Please choose another.`);
      return;
    }

    // Load or generate RSA keys
    let keys;
    const savedKeysRaw = localStorage.getItem(`keys_${userId}`);
    try {
      if (savedKeysRaw) {
        const parsed = JSON.parse(savedKeysRaw);
        const privateCryptoKey = await importRSAPrivateKey(parsed.privateKey);
        keys = { publicKey: parsed.publicKey, privateKey: parsed.privateKey, rawKeyPair: { privateKey: privateCryptoKey } };
      } else {
        keys = await generateRSAKeyPair();
      }
    } catch {
      setAuthError('Failed to prepare encryption keys. Please try again.');
      return;
    }

    // Call backend
    let res;
    try {
      res = await axios.post(`${API_URL}/api/auth/login`, {
        userId: userId.trim(),
        displayName: displayName.trim() || userId.trim(),
        publicKey: keys.publicKey,
        password,
        isRegistering
      });
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Authentication failed. Check your connection.');
      return;
    }

    // Persist keys only after successful auth
    if (!savedKeysRaw) {
      localStorage.setItem(`keys_${userId}`, JSON.stringify({
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
      }));
    }

    const jwtToken = res.data.token;
    setDisplayName(res.data.displayName);
    setMyKeys(keys);
    setToken(jwtToken);

    const newSocket = io(API_URL, { auth: { token: jwtToken } });

    newSocket.on('connect', async () => {
      newSocket.emit('registerPublicKey', { userId, publicKey: keys.publicKey });

      const savedContacts = localStorage.getItem(`contacts_${userId}`);
      if (savedContacts) setContacts(JSON.parse(savedContacts));

      try {
        const groupRes = await axios.get(`${API_URL}/api/users/${userId}/groups`);
        setGroups(groupRes.data);
      } catch { /* non-fatal */ }

      // Load local + offline messages
      let mergedLog = [];
      const savedLog = localStorage.getItem(`chat_${userId}`);
      if (savedLog) { try { mergedLog = JSON.parse(savedLog); } catch { mergedLog = []; } }

      try {
        const dbRes = await axios.get(`${API_URL}/api/messages?userId=${userId}`);
        for (const msg of dbRes.data) {
          if (mergedLog.find(l => l.messageId === msg.messageId)) continue;
          if (msg.receiver === userId || msg.isGroup) {
            try {
              newSocket.emit('messageDelivered', { messageId: msg.messageId, senderId: msg.sender, isGroup: msg.isGroup });
              const text = await decryptMessagePayload(
                { encryptedMessage: msg.encryptedMessage, encryptedKey: msg.encryptedKey, iv: msg.iv },
                keys.rawKeyPair.privateKey, userId
              );
              const isActive = msg.isGroup ? msg.receiver === currentGroupIdRef.current : msg.sender === currentReceiverRef.current;
              if (isActive) newSocket.emit('messageRead', { messageId: msg.messageId, senderId: msg.sender, isGroup: msg.isGroup });

              const groupObj = groupsRef.current.find(g => g.groupId === msg.receiver);
              const rMap = msg.readBy || [], dMap = msg.deliveredTo || [];
              let retroStatus = msg.status;
              if (msg.isGroup) {
                const needed = groupObj ? groupObj.members.length : 1;
                if (rMap.length >= needed) retroStatus = 'read';
                else if (dMap.length > 1 || rMap.length > 1) retroStatus = 'delivered';
              } else {
                retroStatus = isActive ? 'read' : 'delivered';
              }

              mergedLog.push({
                messageId: msg.messageId, from: msg.sender, receiver: msg.receiver,
                isGroup: msg.isGroup, text, isMe: false, hasAckedDelivery: true,
                status: retroStatus, timestamp: msg.createdAt, deliveredTo: dMap, readBy: rMap
              });
            } catch { /* decrypt failed, skip */ }
          }
        }
      } catch { /* non-fatal */ }

      setChatLog([...mergedLog]);
    });

    newSocket.on('connect_error', (err) => {
      setAuthError('Socket connection failed: ' + err.message);
      setToken(null);
    });

    newSocket.on('receiveMessage', async (pkg) => {
      try {
        if (pkg.sender === userId) return;
        if (pkg.receiver !== userId && !pkg.isGroup) return;

        if (pkg.messageId) newSocket.emit('messageDelivered', { messageId: pkg.messageId, senderId: pkg.sender, isGroup: pkg.isGroup });

        const text = await decryptMessagePayload(pkg, keys.rawKeyPair.privateKey, userId);
        const isActive = pkg.isGroup ? pkg.receiver === currentGroupIdRef.current : pkg.sender === currentReceiverRef.current;

        setChatLog(prev => [...prev, {
          messageId: pkg.messageId, from: pkg.sender, receiver: pkg.receiver,
          isGroup: pkg.isGroup, text, isMe: false, hasAckedDelivery: true,
          status: isActive ? 'read' : 'delivered',
          timestamp: new Date().toISOString()
        }]);

        if (!isActive) {
          const key = pkg.isGroup ? pkg.receiver : pkg.sender;
          setUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
        }

        if (pkg.messageId && isActive) newSocket.emit('messageRead', { messageId: pkg.messageId, senderId: pkg.sender, isGroup: pkg.isGroup });
      } catch {
        setChatLog(prev => [...prev, { messageId: pkg.messageId, from: pkg.sender, text: '[Encrypted - Could not decrypt]', isMe: false, error: true }]);
      }
    });

    newSocket.on('groupCreated', (group) => {
      setGroups(prev => [...prev.filter(g => g.groupId !== group.groupId), group]);
    });

    newSocket.on('statusUpdate', (update) => {
      setChatLog(prev => prev.map(msg => {
        if (msg.messageId !== update.messageId) return msg;
        if (!msg.isGroup) return { ...msg, status: update.status };
        const dMap = [...(msg.deliveredTo || [])];
        const rMap = [...(msg.readBy || [])];
        if (update.status === 'delivered' && !dMap.find(d => d.userId === update.userId)) dMap.push({ userId: update.userId, timestamp: new Date() });
        if (update.status === 'read' && !rMap.find(r => r.userId === update.userId)) rMap.push({ userId: update.userId, timestamp: new Date() });
        const groupObj = groupsRef.current.find(g => g.groupId === msg.receiver);
        const needed = groupObj ? groupObj.members.length : 1;
        let newStatus = msg.status;
        if (rMap.length >= needed) newStatus = 'read';
        else if (dMap.length > 1 || rMap.length > 1) newStatus = 'delivered';
        return { ...msg, status: newStatus, deliveredTo: dMap, readBy: rMap };
      }));
    });

    setSocket(newSocket);
  };

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    if (socket) socket.disconnect();
    setToken(null); setUserId(''); setDisplayName(''); setPassword('');
    setIsRegistering(false); setUsernameStatus(null); setAuthError('');
    setSocket(null); setMyKeys(null); setReceiverId(''); setReceiverKey('');
    setMessage(''); setChatLog([]); setContacts({}); setGroups([]);
    setActiveChatType('direct'); setActiveGroupId(''); setNewChatUser('');
    setSelectedMessageId(null); setUnreadCounts({});
  };

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!socket || !message) return;
    if (activeChatType === 'direct' && (!receiverId || !receiverKey)) return;
    if (activeChatType === 'group' && !activeGroupId) return;

    try {
      const msgId = self.crypto.randomUUID();
      setChatLog(prev => [...prev, {
        messageId: msgId, from: userId,
        receiver: activeChatType === 'direct' ? receiverId : activeGroupId,
        isGroup: activeChatType === 'group', text: message, isMe: true, status: 'sent',
        timestamp: new Date().toISOString(),
        deliveredTo: [{ userId, timestamp: new Date() }],
        readBy: [{ userId, timestamp: new Date() }]
      }]);

      let payload;
      if (activeChatType === 'direct') {
        const nc = { ...contacts, [receiverId]: receiverKey.trim() };
        setContacts(nc);
        localStorage.setItem(`contacts_${userId}`, JSON.stringify(nc));
        payload = await encryptMessagePayload(message, receiverKey.trim());
      } else {
        const grp = groups.find(g => g.groupId === activeGroupId);
        const keysRes = await axios.post(`${API_URL}/api/users/keys`, { userIds: grp.members });
        payload = await encryptGroupMessagePayload(message, keysRes.data);
      }

      socket.emit('sendMessage', {
        messageId: msgId, sender: userId,
        receiver: activeChatType === 'direct' ? receiverId : activeGroupId,
        isGroup: activeChatType === 'group',
        members: activeChatType === 'group' ? groups.find(g => g.groupId === activeGroupId).members : undefined,
        ...payload
      });
      setMessage('');
    } catch (err) {
      console.error('Encryption failed:', err);
      alert('Failed to encrypt message');
    }
  };

  // ── CREATE GROUP ──────────────────────────────────────────────────────────
  const createGroup = async () => {
    const name = prompt('Enter Group Name:');
    if (!name) return;
    const memberStr = prompt('Enter comma-separated member usernames (include yourself):', userId);
    if (!memberStr) return;
    const members = memberStr.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    try {
      await axios.post(`${API_URL}/api/groups`, { groupId: self.crypto.randomUUID(), name, members, createdBy: userId });
    } catch { alert('Failed to create group.'); }
  };

  // ── START DIRECT CHAT ─────────────────────────────────────────────────────
  const startDirectChat = async (e) => {
    e.preventDefault();
    const target = newChatUser.trim().toLowerCase();
    if (!target) return;
    if (target === userId) { alert("You can't chat with yourself!"); return; }
    try {
      const res = await axios.get(`${API_URL}/api/users/${target}`);
      const u = res.data;
      const nc = { ...contacts, [u.username]: u.publicKey };
      setContacts(nc);
      localStorage.setItem(`contacts_${userId}`, JSON.stringify(nc));
      setActiveChatType('direct'); setReceiverId(u.username); setReceiverKey(u.publicKey); setNewChatUser('');
    } catch (err) {
      alert(err.response?.data?.error || `User "${target}" not found.`);
    }
  };

  // ── SELECT GROUP ──────────────────────────────────────────────────────────
  const selectGroup = (g) => {
    setActiveChatType('group');
    setActiveGroupId(g.groupId);
    setUnreadCounts(prev => ({ ...prev, [g.groupId]: 0 }));
  };

  // ── SELECT CONTACT ────────────────────────────────────────────────────────
  const selectContact = (c) => {
    setActiveChatType('direct');
    setReceiverId(c);
    setReceiverKey(contacts[c]);
    setUnreadCounts(prev => ({ ...prev, [c]: 0 }));
  };

  // ── FILTERED CHAT LOG ─────────────────────────────────────────────────────
  const filteredLog = chatLog.filter(log => {
    if (activeChatType === 'direct') return !log.isGroup && (log.from === receiverId || (log.isMe && log.receiver === receiverId));
    return log.isGroup && log.receiver === activeGroupId;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <AuthScreen
        isRegistering={isRegistering} setIsRegistering={setIsRegistering}
        userId={userId} setUserId={setUserId}
        displayName={displayName} setDisplayName={setDisplayName}
        password={password} setPassword={setPassword}
        authError={authError} setAuthError={setAuthError}
        usernameStatus={usernameStatus} setUsernameStatus={setUsernameStatus}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        displayName={displayName} userId={userId} onLogout={handleLogout}
        newChatUser={newChatUser} setNewChatUser={setNewChatUser} onStartDirectChat={startDirectChat}
        groups={groups} activeChatType={activeChatType} activeGroupId={activeGroupId} onSelectGroup={selectGroup}
        contacts={contacts} receiverId={receiverId} isReceiverOnline={isReceiverOnline} onSelectContact={selectContact}
        unreadCounts={unreadCounts} onCreateGroup={createGroup}
      />

      {(!receiverId && !activeGroupId) ? (
        <div className="chat-empty">
          <img src="https://cdn-icons-png.flaticon.com/512/1041/1041916.png" width="80" style={{ opacity: 0.2, marginBottom: '15px' }} alt="chat" />
          <span>Select a chat to start messaging</span>
        </div>
      ) : (
        <ChatPane
          activeChatType={activeChatType} receiverId={receiverId} activeGroupId={activeGroupId}
          groups={groups} groupsRef={groupsRef} isReceiverOnline={isReceiverOnline}
          chatLog={filteredLog} selectedMessageId={selectedMessageId} setSelectedMessageId={setSelectedMessageId}
          message={message} setMessage={setMessage} onSendMessage={sendMessage}
          bottomRef={bottomRef}
        />
      )}
    </div>
  );
}
