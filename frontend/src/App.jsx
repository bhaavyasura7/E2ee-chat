import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  generateRSAKeyPair, importRSAPrivateKey,
  encryptMessagePayload, decryptMessagePayload, encryptGroupMessagePayload
} from './utils/crypto';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import GroupModal from './components/GroupModal';
import SettingsPanel from './components/SettingsPanel';
import './App.css';

const API_URL = 'http://127.0.0.1:3000';

export default function App() {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState(null);
  const [myKeys, setMyKeys] = useState(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  // ── Profile & Privacy ─────────────────────────────────────────────────────
  const [profilePic, setProfilePic] = useState(null);
  const [privacySettings, setPrivacySettings] = useState({ readReceipts: 'everyone', onlineStatus: 'everyone' });
  // contactProfiles: { username: { profilePic } } — fetched when contacts are loaded
  const [contactProfiles, setContactProfiles] = useState({});

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  // ── UI Panels ─────────────────────────────────────────────────────────────
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const currentReceiverRef = useRef(receiverId);
  useEffect(() => { currentReceiverRef.current = receiverId; }, [receiverId]);

  const currentGroupIdRef = useRef(activeGroupId);
  useEffect(() => { currentGroupIdRef.current = activeGroupId; }, [activeGroupId]);

  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  const bottomRef = useRef(null);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatLog]);

  // ── Persist chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (userId && chatLog.length > 0) localStorage.setItem(`chat_${userId}`, JSON.stringify(chatLog));
  }, [chatLog, userId]);

  // ── Username availability ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isRegistering || !userId || userId.length < 2) { setUsernameStatus(null); return; }
    const timer = setTimeout(async () => {
      try { const r = await axios.get(`${API_URL}/api/auth/check-username/${userId}`); setUsernameStatus(r.data); }
      catch { setUsernameStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, isRegistering]);

  // ── Read receipts on chat change ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    let updated = false;
    const newChatLog = chatLog.map(log => {
      if (!log.isMe && !log.hasAckedDelivery && log.status !== 'read') {
        socket.emit('messageDelivered', { messageId: log.messageId, senderId: log.from, isGroup: log.isGroup });
        updated = true;
        log.hasAckedDelivery = true;
      }
      const isActive = log.isGroup ? log.receiver === currentGroupIdRef.current : log.from === currentReceiverRef.current;
      if (!log.isMe && isActive && log.status !== 'read') {
        socket.emit('messageRead', { messageId: log.messageId, senderId: log.from, isGroup: log.isGroup });
        updated = true;
        log.status = 'read';
      }
      return log;
    });
    if (updated) setChatLog(newChatLog);
  }, [receiverId, activeGroupId, chatLog, socket]);

  // ── Receiver online status ────────────────────────────────────────────────
  useEffect(() => {
    if (!receiverId) { setIsReceiverOnline(false); return; }
    const check = async () => {
      try { const r = await axios.get(`${API_URL}/api/users/${receiverId}/status`); setIsReceiverOnline(r.data.online); }
      catch { setIsReceiverOnline(false); }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [receiverId]);

  // ── Fetch & cache contact profile pics ───────────────────────────────────
  const ensureContactProfile = useCallback(async (username) => {
    if (contactProfiles[username]) return;
    try {
      const res = await axios.get(`${API_URL}/api/users/${username}`);
      setContactProfiles(prev => ({ ...prev, [username]: { profilePic: res.data.profilePic } }));
    } catch { /* ignore */ }
  }, [contactProfiles]);

  useEffect(() => {
    Object.keys(contacts).forEach(c => ensureContactProfile(c));
  }, [contacts]);

  // ── CORE: Socket init (shared by login + session restore) ─────────────────
  const initSocket = useCallback((jwtToken, uid, keys) => {
    const newSocket = io(API_URL, { auth: { token: jwtToken } });

    newSocket.on('connect', async () => {
      newSocket.emit('registerPublicKey', { userId: uid, publicKey: keys.publicKey });

      const savedContacts = localStorage.getItem(`contacts_${uid}`);
      if (savedContacts) setContacts(JSON.parse(savedContacts));

      try { const gr = await axios.get(`${API_URL}/api/users/${uid}/groups`); setGroups(gr.data); } catch { }

      let mergedLog = [];
      const savedLog = localStorage.getItem(`chat_${uid}`);
      if (savedLog) { try { mergedLog = JSON.parse(savedLog); } catch { mergedLog = []; } }

      try {
        const dbRes = await axios.get(`${API_URL}/api/messages?userId=${uid}`);
        for (const msg of dbRes.data) {
          if (mergedLog.find(l => l.messageId === msg.messageId)) continue;
          if (msg.receiver === uid || msg.isGroup) {
            try {
              newSocket.emit('messageDelivered', { messageId: msg.messageId, senderId: msg.sender, isGroup: msg.isGroup });
              const text = await decryptMessagePayload(
                { encryptedMessage: msg.encryptedMessage, encryptedKey: msg.encryptedKey, iv: msg.iv },
                keys.rawKeyPair.privateKey, uid
              );
              const isA = msg.isGroup ? msg.receiver === currentGroupIdRef.current : msg.sender === currentReceiverRef.current;
              if (isA) newSocket.emit('messageRead', { messageId: msg.messageId, senderId: msg.sender, isGroup: msg.isGroup });
              const groupObj = groupsRef.current.find(g => g.groupId === msg.receiver);
              const rMap = msg.readBy || [], dMap = msg.deliveredTo || [];
              let s = msg.status;
              if (msg.isGroup) { const n = groupObj ? groupObj.members.length : 1; if (rMap.length >= n) s = 'read'; else if (dMap.length > 1) s = 'delivered'; }
              else { s = isA ? 'read' : 'delivered'; }
              mergedLog.push({ messageId: msg.messageId, from: msg.sender, receiver: msg.receiver, isGroup: msg.isGroup, text, isMe: false, hasAckedDelivery: true, status: s, timestamp: msg.createdAt, deliveredTo: dMap, readBy: rMap });
            } catch { }
          }
        }
      } catch { }
      setChatLog([...mergedLog]);
    });

    newSocket.on('connect_error', () => {
      localStorage.removeItem('session_token');
      localStorage.removeItem('session_userId');
      localStorage.removeItem('session_displayName');
      setToken(null); setSessionRestored(true);
      setAuthError('Session expired. Please log in again.');
    });

    newSocket.on('receiveMessage', async (pkg) => {
      try {
        if (pkg.sender === uid) return;
        if (pkg.receiver !== uid && !pkg.isGroup) return;
        if (pkg.messageId) newSocket.emit('messageDelivered', { messageId: pkg.messageId, senderId: pkg.sender, isGroup: pkg.isGroup });
        const text = await decryptMessagePayload(pkg, keys.rawKeyPair.privateKey, uid);
        const isA = pkg.isGroup ? pkg.receiver === currentGroupIdRef.current : pkg.sender === currentReceiverRef.current;
        setChatLog(prev => [...prev, { messageId: pkg.messageId, from: pkg.sender, receiver: pkg.receiver, isGroup: pkg.isGroup, text, isMe: false, hasAckedDelivery: true, status: isA ? 'read' : 'delivered', timestamp: new Date().toISOString() }]);
        if (!isA) { const k = pkg.isGroup ? pkg.receiver : pkg.sender; setUnreadCounts(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 })); }
        if (pkg.messageId && isA) newSocket.emit('messageRead', { messageId: pkg.messageId, senderId: pkg.sender, isGroup: pkg.isGroup });
        // Cache sender's profile if unknown
        ensureContactProfile(pkg.sender);
      } catch {
        setChatLog(prev => [...prev, { messageId: pkg.messageId, from: pkg.sender, text: '[Encrypted - Could not decrypt]', isMe: false, error: true }]);
      }
    });

    newSocket.on('groupCreated', (group) => setGroups(prev => [...prev.filter(g => g.groupId !== group.groupId), group]));

    newSocket.on('statusUpdate', (update) => {
      setChatLog(prev => prev.map(msg => {
        if (msg.messageId !== update.messageId) return msg;
        if (!msg.isGroup) return { ...msg, status: update.status };
        const dMap = [...(msg.deliveredTo || [])], rMap = [...(msg.readBy || [])];
        if (update.status === 'delivered' && !dMap.find(d => d.userId === update.userId)) dMap.push({ userId: update.userId, timestamp: new Date() });
        if (update.status === 'read' && !rMap.find(r => r.userId === update.userId)) rMap.push({ userId: update.userId, timestamp: new Date() });
        const g = groupsRef.current.find(g => g.groupId === msg.receiver);
        const n = g ? g.members.length : 1;
        let s = msg.status;
        if (rMap.length >= n) s = 'read'; else if (dMap.length > 1) s = 'delivered';
        return { ...msg, status: s, deliveredTo: dMap, readBy: rMap };
      }));
    });

    setSocket(newSocket);
    return newSocket;
  }, [ensureContactProfile]);

  // ── SESSION RESTORE on refresh ───────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const savedToken = localStorage.getItem('session_token');
      const savedUserId = localStorage.getItem('session_userId');
      const savedDisplayName = localStorage.getItem('session_displayName');
      if (!savedToken || !savedUserId) { setSessionRestored(true); return; }

      const savedKeysRaw = localStorage.getItem(`keys_${savedUserId}`);
      if (!savedKeysRaw) { localStorage.removeItem('session_token'); setSessionRestored(true); return; }

      try {
        const parsed = JSON.parse(savedKeysRaw);
        const privateCryptoKey = await importRSAPrivateKey(parsed.privateKey);
        const keys = { publicKey: parsed.publicKey, privateKey: parsed.privateKey, rawKeyPair: { privateKey: privateCryptoKey } };
        setUserId(savedUserId);
        setDisplayName(savedDisplayName || savedUserId);
        setMyKeys(keys);
        setToken(savedToken);
        setSessionRestored(true);
        // Re-fetch profile info
        try {
          const pr = await axios.get(`${API_URL}/api/users/${savedUserId}`);
          if (pr.data.profilePic) setProfilePic(pr.data.profilePic);
          if (pr.data.privacySettings) setPrivacySettings(pr.data.privacySettings);
        } catch { }
        initSocket(savedToken, savedUserId, keys);
      } catch {
        localStorage.removeItem('session_token');
        setSessionRestored(true);
      }
    };
    restore();
  }, []);

  // ── LOGIN / REGISTER ──────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!userId.trim()) { setAuthError('Please enter a username.'); return; }
    if (!password) { setAuthError('Please enter a password.'); return; }
    if (isRegistering && !displayName.trim()) { setAuthError('Please enter a display name.'); return; }
    if (isRegistering && usernameStatus && !usernameStatus.available) { setAuthError(`Username "${userId}" is taken.`); return; }

    let keys;
    const savedKeysRaw = localStorage.getItem(`keys_${userId}`);
    try {
      if (savedKeysRaw) {
        const p = JSON.parse(savedKeysRaw);
        keys = { publicKey: p.publicKey, privateKey: p.privateKey, rawKeyPair: { privateKey: await importRSAPrivateKey(p.privateKey) } };
      } else { keys = await generateRSAKeyPair(); }
    } catch { setAuthError('Failed to prepare encryption keys.'); return; }

    let res;
    try {
      res = await axios.post(`${API_URL}/api/auth/login`, { userId: userId.trim(), displayName: displayName.trim() || userId.trim(), publicKey: keys.publicKey, password, isRegistering });
    } catch (err) { setAuthError(err.response?.data?.error || 'Authentication failed.'); return; }

    if (!savedKeysRaw) localStorage.setItem(`keys_${userId}`, JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey }));

    const jwtToken = res.data.token;
    localStorage.setItem('session_token', jwtToken);
    localStorage.setItem('session_userId', userId.trim());
    localStorage.setItem('session_displayName', res.data.displayName);

    setDisplayName(res.data.displayName);
    setMyKeys(keys);
    setToken(jwtToken);
    if (res.data.profilePic) setProfilePic(res.data.profilePic);
    if (res.data.privacySettings) setPrivacySettings(res.data.privacySettings);
    initSocket(jwtToken, userId.trim(), keys);
  };

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    if (socket) socket.disconnect();
    ['session_token', 'session_userId', 'session_displayName'].forEach(k => localStorage.removeItem(k));
    setToken(null); setUserId(''); setDisplayName(''); setPassword('');
    setIsRegistering(false); setUsernameStatus(null); setAuthError('');
    setSocket(null); setMyKeys(null); setReceiverId(''); setReceiverKey('');
    setMessage(''); setChatLog([]); setContacts({}); setGroups([]);
    setActiveChatType('direct'); setActiveGroupId(''); setNewChatUser('');
    setSelectedMessageId(null); setUnreadCounts({}); setShowGroupModal(false);
    setProfilePic(null); setContactProfiles({}); setPrivacySettings({ readReceipts: 'everyone', onlineStatus: 'everyone' });
  };

  // ── SETTINGS SAVE ─────────────────────────────────────────────────────────
  const handleSaveSettings = async ({ displayName: newName, profilePic: newPic, privacySettings: newPrivacy }) => {
    try {
      const res = await axios.put(`${API_URL}/api/users/${userId}/profile`, {
        displayName: newName, profilePic: newPic, privacySettings: newPrivacy
      });
      setDisplayName(res.data.displayName);
      setProfilePic(res.data.profilePic || null);
      setPrivacySettings(res.data.privacySettings);
      localStorage.setItem('session_displayName', res.data.displayName);
    } catch { alert('Failed to save settings.'); }
  };

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!socket || !message) return;
    if (activeChatType === 'direct' && (!receiverId || !receiverKey)) return;
    if (activeChatType === 'group' && !activeGroupId) return;
    try {
      const msgId = self.crypto.randomUUID();
      setChatLog(prev => [...prev, { messageId: msgId, from: userId, receiver: activeChatType === 'direct' ? receiverId : activeGroupId, isGroup: activeChatType === 'group', text: message, isMe: true, status: 'sent', timestamp: new Date().toISOString(), deliveredTo: [{ userId, timestamp: new Date() }], readBy: [{ userId, timestamp: new Date() }] }]);
      let payload;
      if (activeChatType === 'direct') {
        const nc = { ...contacts, [receiverId]: receiverKey.trim() };
        setContacts(nc); localStorage.setItem(`contacts_${userId}`, JSON.stringify(nc));
        payload = await encryptMessagePayload(message, receiverKey.trim());
      } else {
        const grp = groups.find(g => g.groupId === activeGroupId);
        const kr = await axios.post(`${API_URL}/api/users/keys`, { userIds: grp.members });
        payload = await encryptGroupMessagePayload(message, kr.data);
      }
      socket.emit('sendMessage', { messageId: msgId, sender: userId, receiver: activeChatType === 'direct' ? receiverId : activeGroupId, isGroup: activeChatType === 'group', members: activeChatType === 'group' ? groups.find(g => g.groupId === activeGroupId).members : undefined, ...payload });
      setMessage('');
    } catch (err) { console.error('Encrypt failed', err); alert('Failed to encrypt message'); }
  };

  // ── CREATE GROUP ──────────────────────────────────────────────────────────
  const handleCreateGroup = async ({ name, members }) => {
    try {
      await axios.post(`${API_URL}/api/groups`, { groupId: self.crypto.randomUUID(), name, members, createdBy: userId });
      setShowGroupModal(false);
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
      setContacts(nc); localStorage.setItem(`contacts_${userId}`, JSON.stringify(nc));
      setContactProfiles(prev => ({ ...prev, [u.username]: { profilePic: u.profilePic } }));
      setActiveChatType('direct'); setReceiverId(u.username); setReceiverKey(u.publicKey); setNewChatUser('');
    } catch (err) { alert(err.response?.data?.error || `User "${target}" not found.`); }
  };

  const selectGroup = (g) => { setActiveChatType('group'); setActiveGroupId(g.groupId); setUnreadCounts(prev => ({ ...prev, [g.groupId]: 0 })); };
  const selectContact = (c) => { setActiveChatType('direct'); setReceiverId(c); setReceiverKey(contacts[c]); setUnreadCounts(prev => ({ ...prev, [c]: 0 })); ensureContactProfile(c); };

  const filteredLog = chatLog.filter(log => {
    if (activeChatType === 'direct') return !log.isGroup && (log.from === receiverId || (log.isMe && log.receiver === receiverId));
    return log.isGroup && log.receiver === activeGroupId;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (!sessionRestored) return null;

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
        displayName={displayName} userId={userId} profilePic={profilePic}
        contactProfiles={contactProfiles}
        onLogout={handleLogout} onOpenSettings={() => setShowSettings(true)}
        newChatUser={newChatUser} setNewChatUser={setNewChatUser} onStartDirectChat={startDirectChat}
        groups={groups} activeChatType={activeChatType} activeGroupId={activeGroupId} onSelectGroup={selectGroup}
        contacts={contacts} receiverId={receiverId} isReceiverOnline={isReceiverOnline} onSelectContact={selectContact}
        unreadCounts={unreadCounts} onCreateGroup={() => setShowGroupModal(true)}
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
          receiverProfilePic={contactProfiles[receiverId]?.profilePic || null}
          myPrivacySettings={privacySettings}
          chatLog={filteredLog} selectedMessageId={selectedMessageId} setSelectedMessageId={setSelectedMessageId}
          message={message} setMessage={setMessage} onSendMessage={sendMessage}
          bottomRef={bottomRef}
        />
      )}

      {showGroupModal && (
        <GroupModal
          currentUserId={userId} contacts={contacts}
          onClose={() => setShowGroupModal(false)} onCreate={handleCreateGroup}
        />
      )}

      {showSettings && (
        <SettingsPanel
          userId={userId} displayName={displayName}
          profilePic={profilePic} privacySettings={privacySettings} theme={theme}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        />
      )}
    </div>
  );
}
