/**
 * Sidebar.jsx — left panel with settings gear, avatar with photo, search, groups, DMs
 */
import { useState } from 'react';
import ProfileViewer from './ProfileViewer';

export default function Sidebar({
    displayName, userId, profilePic, contactProfiles,
    onLogout, onOpenSettings,
    newChatUser, setNewChatUser, onStartDirectChat,
    groups, activeChatType, activeGroupId, onSelectGroup,
    contacts, receiverId, isReceiverOnline, onSelectContact,
    unreadCounts, onCreateGroup,
}) {
    const [viewProfile, setViewProfile] = useState(null); // { name, pic }

    return (
        <>
            <div className="sidebar">
                {/* Header */}
                <div className="sidebar-header">
                    {/* Own avatar → opens settings */}
                    <div className="user-info" onClick={onOpenSettings} title="Settings">
                        <Avatar name={displayName || userId} pic={profilePic} size={40} />
                        <span style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{displayName || userId}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={onOpenSettings}
                            title="Settings"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '20px', lineHeight: 1 }}
                        >⚙️</button>
                        <button
                            onClick={onLogout}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Search / New Chat */}
                <div className="search-bar">
                    <form onSubmit={onStartDirectChat}>
                        <input
                            type="text"
                            placeholder="🔍  Search by exact username..."
                            value={newChatUser}
                            onChange={(e) => setNewChatUser(e.target.value.toLowerCase())}
                        />
                        <button type="submit" style={{ display: 'none' }}>Search</button>
                    </form>
                </div>

                <div className="chat-list">
                    {/* Groups */}
                    <div style={{ padding: '10px 15px', color: 'var(--accent)', fontSize: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        GROUPS <span style={{ cursor: 'pointer' }} onClick={onCreateGroup}>+ New</span>
                    </div>
                    {groups.map(g => {
                        const gUnread = unreadCounts[g.groupId] || 0;
                        return (
                            <div
                                key={g.groupId}
                                className={`chat-item ${activeChatType === 'group' && activeGroupId === g.groupId ? 'active' : ''}`}
                                onClick={() => onSelectGroup(g)}
                            >
                                <div className="avatar" style={{ background: 'linear-gradient(135deg, #00a884, #007a62)', color: 'white', fontSize: '18px' }}>G</div>
                                <div className="chat-item-details">
                                    <span className="chat-item-title">{g.name}</span>
                                    <span className="chat-item-subtitle">{g.members.length} members</span>
                                </div>
                                {gUnread > 0 && <UnreadBadge count={gUnread} />}
                            </div>
                        );
                    })}

                    {/* Direct Messages */}
                    <div style={{ padding: '10px 15px', color: 'var(--accent)', fontSize: '12px', fontWeight: 'bold' }}>DIRECT MESSAGES</div>
                    {Object.keys(contacts).map(c => {
                        const cUnread = unreadCounts[c] || 0;
                        const cPic = contactProfiles?.[c]?.profilePic || null;
                        return (
                            <div
                                key={c}
                                className={`chat-item ${activeChatType === 'direct' && receiverId === c ? 'active' : ''}`}
                                onClick={() => onSelectContact(c)}
                            >
                                {/* Clickable avatar → profile viewer */}
                                <div onClick={(e) => { e.stopPropagation(); setViewProfile({ name: c, pic: cPic }); }}>
                                    <Avatar name={c} pic={cPic} size={40} />
                                </div>
                                <div className="chat-item-details">
                                    <span className="chat-item-title" style={{ fontWeight: cUnread > 0 ? '700' : '500' }}>{c}</span>
                                    <span className="chat-item-subtitle" style={{ color: isReceiverOnline && receiverId === c ? '#00a884' : 'var(--text-secondary)' }}>
                                        {isReceiverOnline && receiverId === c ? '● Online' : ''}
                                    </span>
                                </div>
                                {cUnread > 0 && <UnreadBadge count={cUnread} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Profile viewer modal */}
            {viewProfile && (
                <ProfileViewer
                    name={viewProfile.name}
                    profilePic={viewProfile.pic}
                    onClose={() => setViewProfile(null)}
                />
            )}
        </>
    );
}

/** Reusable avatar that shows image or initial */
export function Avatar({ name, pic, size = 40 }) {
    return (
        <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
            {pic
                ? <img src={pic} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : (name || '?').charAt(0).toUpperCase()
            }
        </div>
    );
}

function UnreadBadge({ count }) {
    return (
        <div style={{
            minWidth: '20px', height: '20px', borderRadius: '10px',
            background: 'var(--accent)', color: 'white',
            fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px', marginLeft: 'auto', flexShrink: 0
        }}>
            {count > 99 ? '99+' : count}
        </div>
    );
}
