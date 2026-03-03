/**
 * ChatPane.jsx — right panel: chat header, messages, compose bar
 */
import { useState } from 'react';
import { Avatar } from './Sidebar';
import ProfileViewer from './ProfileViewer';

export default function ChatPane({
    activeChatType, receiverId, activeGroupId,
    groups, groupsRef, isReceiverOnline,
    receiverProfilePic, myPrivacySettings,
    chatLog, selectedMessageId, setSelectedMessageId,
    message, setMessage, onSendMessage,
    bottomRef,
}) {
    const [showProfileViewer, setShowProfileViewer] = useState(false);
    const activeGroup = groups.find(g => g.groupId === activeGroupId);

    return (
        <div className="chat-pane">
            {/* Header */}
            <div className="chat-header">
                <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => activeChatType === 'direct' && setShowProfileViewer(true)}
                    title={activeChatType === 'direct' ? 'View profile' : ''}
                >
                    {activeChatType === 'direct'
                        ? <Avatar name={receiverId} pic={receiverProfilePic} size={40} />
                        : <div className="avatar" style={{ background: 'linear-gradient(135deg,#00a884,#007a62)', color: '#fff', width: 40, height: 40, fontSize: 18 }}>G</div>
                    }
                </div>
                <div className="header-info">
                    <span className="title">
                        {activeChatType === 'direct' ? receiverId : activeGroup?.name}
                    </span>
                    <span className="subtitle" style={{ color: isReceiverOnline ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {activeChatType === 'direct'
                            ? (isReceiverOnline ? '● Online' : 'Offline')
                            : `${activeGroup?.members?.length || 0} members`}
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
                        showReadReceipts={myPrivacySettings?.readReceipts !== 'nobody'}
                    />
                ))}
                <div ref={bottomRef} style={{ height: '10px' }} />
            </div>

            {/* Compose */}
            <form className="compose-area" onSubmit={onSendMessage}>
                <button type="button" style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', border: 'none', cursor: 'default' }}>📎</button>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" disabled={!message}>Send ›</button>
            </form>

            {/* Contact profile viewer */}
            {showProfileViewer && activeChatType === 'direct' && (
                <ProfileViewer
                    name={receiverId}
                    profilePic={receiverProfilePic}
                    onClose={() => setShowProfileViewer(false)}
                />
            )}
        </div>
    );
}

function MessageBubble({ log, selectedMessageId, setSelectedMessageId, groups, groupsRef, showReadReceipts }) {
    return (
        <div
            className={`message ${log.isMe ? 'me' : 'them'} ${log.error ? 'error' : ''}`}
            onClick={() => { if (log.isMe && log.isGroup) setSelectedMessageId(selectedMessageId === log.messageId ? null : log.messageId); }}
            style={{ cursor: log.isMe && log.isGroup ? 'pointer' : 'default' }}
        >
            {/* Group sender label */}
            {!log.isMe && log.isGroup && (
                <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '3px', fontSize: '12.5px' }}>
                    {log.from}
                </strong>
            )}

            <span>{log.text}</span>

            {/* Sent message meta (time + tick) */}
            {log.isMe && (
                <div className="message-meta">
                    {log.timestamp && <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    {showReadReceipts && (
                        <>
                            {log.status === 'sent' && <span title="Sent">✓</span>}
                            {log.status === 'delivered' && <span title="Delivered">✓✓</span>}
                            {log.status === 'read' && <span title="Read" style={{ color: '#53bdeb', fontWeight: 'bold' }}>✓✓</span>}
                        </>
                    )}
                    {!showReadReceipts && log.status && <span title="Sent">✓</span>}
                </div>
            )}

            {/* Received message time */}
            {!log.isMe && log.timestamp && (
                <div className="message-meta">
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )}

            {/* Group message read tracker popup */}
            {selectedMessageId === log.messageId && log.isGroup && (
                <GroupMessageInfo log={log} groups={groups} groupsRef={groupsRef} />
            )}
        </div>
    );
}

function GroupMessageInfo({ log, groups, groupsRef }) {
    const groupObj = groups.find(g => g.groupId === log.receiver) || groupsRef.current.find(g => g.groupId === log.receiver);
    const expected = groupObj ? groupObj.members.filter(m => m !== log.from) : [];
    const readIds = (log.readBy || []).map(r => r.userId);
    const deliveredOnly = (log.deliveredTo || []).filter(d => !readIds.includes(d.userId));
    const notDelivered = expected.filter(m => !readIds.includes(m) && !(log.deliveredTo || []).some(d => d.userId === m));

    return (
        <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.06)', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
            <strong style={{ display: 'block', marginBottom: '5px', color: 'var(--text-primary)' }}>Message Tracking</strong>
            <InfoRow label="Read" color="#53bdeb" items={log.readBy} />
            <InfoRow label="Delivered" color="#667781" items={deliveredOnly} />
            {notDelivered.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: '#f44336' }}>Pending: </span>
                    {notDelivered.join(', ')}
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, color, items }) {
    return (
        <div style={{ marginTop: '4px' }}>
            <span style={{ fontWeight: 'bold', color }}>{label}: </span>
            {items?.length > 0
                ? items.map(i => `${i.userId} (${new Date(i.timestamp).toLocaleTimeString()})`).join(', ')
                : 'None'
            }
        </div>
    );
}
