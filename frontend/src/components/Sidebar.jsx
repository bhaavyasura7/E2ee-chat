/**
 * Sidebar.jsx
 * The left panel: user header, search bar, group list, and direct message list.
 * All state is passed in from App.jsx.
 */

export default function Sidebar({
    displayName, userId, onLogout,
    newChatUser, setNewChatUser, onStartDirectChat,
    groups, activeChatType, activeGroupId, onSelectGroup,
    contacts, receiverId, isReceiverOnline, onSelectContact,
    unreadCounts, onCreateGroup,
}) {
    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <div className="user-info">
                    <div className="avatar">{(displayName || userId).charAt(0).toUpperCase()}</div>
                    <span>{displayName || userId}</span>
                </div>
                <button
                    onClick={onLogout}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', fontSize: '14px', fontWeight: '500' }}
                >
                    Logout
                </button>
            </div>

            {/* Search / New Chat */}
            <div className="search-bar">
                <form onSubmit={onStartDirectChat}>
                    <input
                        type="text"
                        placeholder="Search by exact username..."
                        value={newChatUser}
                        onChange={(e) => setNewChatUser(e.target.value.toLowerCase())}
                    />
                    <button type="submit" style={{ display: 'none' }}>Search</button>
                </form>
            </div>

            <div className="chat-list">
                {/* Groups Section */}
                <div style={{ padding: '10px 15px', color: '#00a884', fontSize: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
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
                            <div className="avatar" style={{ backgroundColor: '#00a884', color: 'white' }}>G</div>
                            <div className="chat-item-details">
                                <span className="chat-item-title">{g.name}</span>
                                <span className="chat-item-subtitle">{g.members.length} members</span>
                            </div>
                            {gUnread > 0 && <UnreadBadge count={gUnread} />}
                        </div>
                    );
                })}

                {/* Direct Messages Section */}
                <div style={{ padding: '10px 15px', color: '#00a884', fontSize: '12px', fontWeight: 'bold' }}>
                    DIRECT MESSAGES
                </div>
                {Object.keys(contacts).map(c => {
                    const cUnread = unreadCounts[c] || 0;
                    return (
                        <div
                            key={c}
                            className={`chat-item ${activeChatType === 'direct' && receiverId === c ? 'active' : ''}`}
                            onClick={() => onSelectContact(c)}
                        >
                            <div className="avatar">{c.charAt(0).toUpperCase()}</div>
                            <div className="chat-item-details">
                                <span className="chat-item-title" style={{ fontWeight: cUnread > 0 ? '700' : '400' }}>{c}</span>
                                <span className="chat-item-subtitle">{isReceiverOnline && receiverId === c ? 'Online' : ''}</span>
                            </div>
                            {cUnread > 0 && <UnreadBadge count={cUnread} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Green unread count bubble */
function UnreadBadge({ count }) {
    return (
        <div style={{
            minWidth: '20px', height: '20px', borderRadius: '10px',
            backgroundColor: '#00a884', color: 'white',
            fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px', marginLeft: 'auto', flexShrink: 0
        }}>
            {count > 99 ? '99+' : count}
        </div>
    );
}
