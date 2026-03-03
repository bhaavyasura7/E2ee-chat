/**
 * Sidebar.jsx — WeChat-inspired sidebar with last-message preview, timestamps, online dot
 */
import { useState } from 'react';
import ProfileViewer from './ProfileViewer';

export default function Sidebar({
    displayName, userId, profilePic, contactProfiles, lastMessages,
    onLogout, onOpenSettings,
    newChatUser, setNewChatUser, onStartDirectChat,
    groups, activeChatType, activeGroupId, onSelectGroup,
    contacts, receiverId, isReceiverOnline, onSelectContact,
    unreadCounts, onCreateGroup,
}) {
    const [viewProfile, setViewProfile] = useState(null);

    return (
        <>
            <div className="sidebar">
                {/* Header */}
                <div className="sidebar-header">
                    <div className="user-info" onClick={onOpenSettings} title="Settings">
                        <div className="avatar-wrap">
                            <Avatar name={displayName || userId} pic={profilePic} size={40} />
                        </div>
                        <span className="username">{displayName || userId}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <IconBtn title="Settings" onClick={onOpenSettings}>⚙️</IconBtn>
                        <IconBtn title="Logout" onClick={onLogout}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </IconBtn>
                    </div>
                </div>

                {/* Search */}
                <div className="search-bar">
                    <form onSubmit={onStartDirectChat}>
                        <input
                            type="text"
                            placeholder="🔍  Search exact username to start chat…"
                            value={newChatUser}
                            onChange={e => setNewChatUser(e.target.value.toLowerCase())}
                        />
                    </form>
                </div>

                <div className="chat-list">
                    {/* ── Groups ── */}
                    <div className="section-label">
                        Groups
                        <span className="new-btn" onClick={onCreateGroup}>+ New</span>
                    </div>

                    {groups.length === 0 && (
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 20px' }}>No groups yet</p>
                    )}

                    {groups.map(g => {
                        const unread = unreadCounts[g.groupId] || 0;
                        const last = lastMessages?.[g.groupId];
                        const isActive = activeChatType === 'group' && activeGroupId === g.groupId;
                        return (
                            <div key={g.groupId} className={`chat-item ${isActive ? 'active' : ''}`} onClick={() => onSelectGroup(g)}>
                                <div className="avatar-wrap">
                                    <div className="avatar" style={{ width: 46, height: 46, fontSize: 19, background: 'linear-gradient(135deg,#1d7bff,#6b48ff)', color: '#fff' }}>
                                        {g.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="chat-item-details">
                                    <div className="chat-item-row">
                                        <span className="chat-item-title">{g.name}</span>
                                        {last && <span className="chat-item-time">{fmtTime(last.timestamp)}</span>}
                                    </div>
                                    <div className="chat-item-row">
                                        <span className="chat-item-preview">
                                            {last ? (last.isImage ? '📷 Photo' : (last.deletedForEveryone ? '🚫 Deleted' : last.text)) : `${g.members.length} members`}
                                        </span>
                                        {unread > 0 && <div className="unread-badge">{unread > 99 ? '99+' : unread}</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* ── Direct Messages ── */}
                    <div className="section-label" style={{ marginTop: '6px' }}>Messages</div>

                    {Object.keys(contacts).length === 0 && (
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 20px' }}>Search a username above to start chatting</p>
                    )}

                    {Object.keys(contacts).map(c => {
                        const unread = unreadCounts[c] || 0;
                        const cPic = contactProfiles?.[c]?.profilePic || null;
                        const last = lastMessages?.[c];
                        const isActive = activeChatType === 'direct' && receiverId === c;
                        const isOnline = isReceiverOnline && receiverId === c;
                        return (
                            <div key={c} className={`chat-item ${isActive ? 'active' : ''}`} onClick={() => onSelectContact(c)}>
                                <div
                                    className="avatar-wrap"
                                    onClick={e => { e.stopPropagation(); setViewProfile({ name: c, pic: cPic }); }}
                                >
                                    <Avatar name={c} pic={cPic} size={46} />
                                    {isOnline && <span className="online-dot" />}
                                </div>
                                <div className="chat-item-details">
                                    <div className="chat-item-row">
                                        <span className="chat-item-title" style={{ fontWeight: unread > 0 ? 700 : 600 }}>{c}</span>
                                        {last && <span className="chat-item-time">{fmtTime(last.timestamp)}</span>}
                                    </div>
                                    <div className="chat-item-row">
                                        <span className="chat-item-preview" style={{ fontWeight: unread > 0 && !isActive ? 600 : 400 }}>
                                            {last ? (last.isImage ? '📷 Photo' : (last.deletedForEveryone ? '🚫 Deleted' : last.text)) : (isOnline ? '● Online' : 'No messages yet')}
                                        </span>
                                        {unread > 0 && <div className="unread-badge">{unread > 99 ? '99+' : unread}</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {viewProfile && <ProfileViewer name={viewProfile.name} profilePic={viewProfile.pic} onClose={() => setViewProfile(null)} />}
        </>
    );
}

/** Avatar — shows image or initials */
export function Avatar({ name, pic, size = 40 }) {
    const initials = (name || '?').charAt(0).toUpperCase();
    return (
        <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
            {pic
                ? <img src={pic} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials
            }
        </div>
    );
}

/** Small icon button for header */
function IconBtn({ onClick, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                width: '34px', height: '34px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                transition: 'background 0.15s, color 0.15s'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-item-hover)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
            {children}
        </button>
    );
}

/** Format timestamp to short string */
function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
