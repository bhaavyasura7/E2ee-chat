/**
 * ChatPane.jsx
 * The right panel: chat header, messages area, and compose bar.
 */

export default function ChatPane({
    activeChatType, receiverId, activeGroupId,
    groups, groupsRef, isReceiverOnline,
    chatLog, selectedMessageId, setSelectedMessageId,
    message, setMessage, onSendMessage,
    bottomRef,
}) {
    const activeGroup = groups.find(g => g.groupId === activeGroupId);

    return (
        <div className="chat-pane">
            {/* Header */}
            <div className="chat-header">
                <div className="avatar" style={{
                    backgroundColor: activeChatType === 'direct' ? '#dfe5e7' : '#00a884',
                    color: activeChatType === 'direct' ? '#54656f' : 'white'
                }}>
                    {activeChatType === 'direct' ? receiverId.charAt(0).toUpperCase() : 'G'}
                </div>
                <div className="header-info">
                    <span className="title">
                        {activeChatType === 'direct' ? receiverId : activeGroup?.name}
                    </span>
                    <span className="subtitle">
                        {activeChatType === 'direct'
                            ? (isReceiverOnline ? 'Online' : 'Offline')
                            : `${activeGroup?.members.length} members`}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="messages-area">
                {chatLog.map((log, idx) => (
                    <MessageBubble
                        key={idx}
                        log={log}
                        selectedMessageId={selectedMessageId}
                        setSelectedMessageId={setSelectedMessageId}
                        groups={groups}
                        groupsRef={groupsRef}
                    />
                ))}
                <div ref={bottomRef} style={{ height: '10px' }} />
            </div>

            {/* Compose Bar */}
            <form className="compose-area" onSubmit={onSendMessage}>
                <button type="button" style={{ background: 'transparent', color: '#54656f', fontSize: '20px' }}>+</button>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" disabled={!message}>Send</button>
            </form>
        </div>
    );
}

/** Individual message bubble */
function MessageBubble({ log, selectedMessageId, setSelectedMessageId, groups, groupsRef }) {
    return (
        <div
            className={`message ${log.isMe ? 'me' : 'them'} ${log.error ? 'error' : ''}`}
            onClick={() => {
                if (log.isMe && log.isGroup) {
                    setSelectedMessageId(selectedMessageId === log.messageId ? null : log.messageId);
                }
            }}
            style={{ cursor: log.isMe && log.isGroup ? 'pointer' : 'default' }}
        >
            {/* Group sender name */}
            {!log.isMe && log.isGroup && (
                <strong style={{ color: '#00a884', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>
                    {log.from}
                </strong>
            )}

            <span>{log.text}</span>

            {/* Sent message tick/time */}
            {log.isMe && log.status && (
                <div className="message-meta">
                    {log.timestamp && (
                        <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {log.status === 'sent' && '✓'}
                    {log.status === 'delivered' && '✓✓'}
                    {log.status === 'read' && <span style={{ color: '#53bdeb', fontWeight: 'bold' }}>✓✓</span>}
                </div>
            )}

            {/* Received message time */}
            {!log.isMe && log.timestamp && (
                <div className="message-meta">
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )}

            {/* Group message tracking popup */}
            {selectedMessageId === log.messageId && log.isGroup && (
                <GroupMessageInfo log={log} groups={groups} groupsRef={groupsRef} />
            )}
        </div>
    );
}

/** Popup showing read/delivered/pending info for a group message */
function GroupMessageInfo({ log, groups, groupsRef }) {
    const groupObj = groups.find(g => g.groupId === log.receiver)
        || groupsRef.current.find(g => g.groupId === log.receiver);
    const expectedMembers = groupObj ? groupObj.members.filter(m => m !== log.from) : [];
    const readIds = (log.readBy || []).map(r => r.userId);
    const deliveredButNotRead = (log.deliveredTo || []).filter(d => !readIds.includes(d.userId));
    const notDelivered = expectedMembers.filter(
        m => !readIds.includes(m) && !(log.deliveredTo || []).some(d => d.userId === m)
    );

    return (
        <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.05)', padding: '10px', borderRadius: '5px', fontSize: '12px' }}>
            <strong style={{ display: 'block', marginBottom: '5px' }}>Message Tracking</strong>

            <div style={{ marginTop: '5px' }}>
                <span style={{ color: '#53bdeb', fontWeight: 'bold' }}>Read: </span>
                {log.readBy?.length > 0
                    ? <ul style={{ margin: '2px 0 5px 20px', padding: 0 }}>
                        {log.readBy.map(r => <li key={r.userId}>{r.userId} ({new Date(r.timestamp).toLocaleTimeString()})</li>)}
                    </ul>
                    : <span style={{ marginLeft: '5px' }}>None</span>}
            </div>

            <div style={{ marginTop: '5px' }}>
                <span style={{ fontWeight: 'bold', color: '#666' }}>Delivered: </span>
                {deliveredButNotRead.length > 0
                    ? <ul style={{ margin: '2px 0 5px 20px', padding: 0 }}>
                        {deliveredButNotRead.map(d => <li key={d.userId}>{d.userId} ({new Date(d.timestamp).toLocaleTimeString()})</li>)}
                    </ul>
                    : <span style={{ marginLeft: '5px' }}>None</span>}
            </div>

            {notDelivered.length > 0 && (
                <div style={{ marginTop: '5px' }}>
                    <span style={{ fontWeight: 'bold', color: '#f44336' }}>Pending: </span>
                    <ul style={{ margin: '2px 0 0 20px', padding: 0, color: '#f44336' }}>
                        {notDelivered.map(m => <li key={m}>{m}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
