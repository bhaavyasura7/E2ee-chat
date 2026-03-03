/**
 * ChatPane.jsx — messages with image sending, single-view, edit (10 min), delete for me/everyone
 */
import { useState, useRef } from 'react';
import { Avatar } from './Sidebar';
import ProfileViewer from './ProfileViewer';

export default function ChatPane({
    activeChatType, receiverId, activeGroupId,
    groups, groupsRef, isReceiverOnline,
    receiverProfilePic, myPrivacySettings,
    chatLog, selectedMessageId, setSelectedMessageId,
    message, setMessage, onSendMessage, onSendImage,
    onEditMessage, onDeleteMessage,
    bottomRef,
}) {
    const [showProfileViewer, setShowProfileViewer] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [contextMenu, setContextMenu] = useState(null); // { x, y, log }
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const fileInputRef = useRef();
    const activeGroup = groups.find(g => g.groupId === activeGroupId);

    const handleImagePick = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => onSendImage(ev.target.result, file.type);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const startEdit = (log) => {
        setEditingId(log.messageId);
        setEditText(log.text);
        setContextMenu(null);
    };

    const submitEdit = (e) => {
        e.preventDefault();
        if (!editText.trim()) return;
        onEditMessage(editingId, editText.trim());
        setEditingId(null);
        setEditText('');
    };

    const handleContextMenu = (e, log) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, log });
    };

    const dismissMenu = () => setContextMenu(null);

    return (
        <div className="chat-pane" onClick={dismissMenu}>
            {/* Header */}
            <div className="chat-header">
                <div style={{ cursor: 'pointer' }} onClick={() => activeChatType === 'direct' && setShowProfileViewer(true)}>
                    {activeChatType === 'direct'
                        ? <Avatar name={receiverId} pic={receiverProfilePic} size={40} />
                        : <div className="avatar" style={{ background: 'linear-gradient(135deg,#00a884,#007a62)', color: '#fff', width: 40, height: 40, fontSize: 18 }}>G</div>
                    }
                </div>
                <div className="header-info">
                    <span className="title">{activeChatType === 'direct' ? receiverId : activeGroup?.name}</span>
                    <span className="subtitle" style={{ color: isReceiverOnline ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {activeChatType === 'direct' ? (isReceiverOnline ? '● Online' : 'Offline') : `${activeGroup?.members?.length || 0} members`}
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
                        groups={groups} groupsRef={groupsRef}
                        showReadReceipts={myPrivacySettings?.readReceipts !== 'nobody'}
                        isEditing={editingId === log.messageId}
                        editText={editText} setEditText={setEditText}
                        onSubmitEdit={submitEdit}
                        onCancelEdit={() => setEditingId(null)}
                        onContextMenu={handleContextMenu}
                        onImageClick={(src) => setLightboxSrc(src)}
                    />
                ))}
                <div ref={bottomRef} style={{ height: '10px' }} />
            </div>

            {/* Compose */}
            <form className="compose-area" onSubmit={onSendMessage}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    title="Send photo"
                    style={{
                        background: 'var(--accent)', border: 'none', borderRadius: '50%',
                        width: '40px', height: '40px', cursor: 'pointer',
                        color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: '0 2px 6px rgba(0,168,132,0.3)'
                    }}
                >📷</button>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" disabled={!message}>Send ›</button>
            </form>

            {/* Right-click / long-press context menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x} y={contextMenu.y} log={contextMenu.log}
                    onEdit={() => startEdit(contextMenu.log)}
                    onDeleteMe={() => { onDeleteMessage(contextMenu.log.messageId, 'me', contextMenu.log); setContextMenu(null); }}
                    onDeleteEveryone={() => { onDeleteMessage(contextMenu.log.messageId, 'everyone', contextMenu.log); setContextMenu(null); }}
                    onDismiss={dismissMenu}
                />
            )}

            {/* Image lightbox */}
            {lightboxSrc && (
                <div onClick={() => setLightboxSrc(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.92)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'
                }}>
                    <img src={lightboxSrc} alt="Photo" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
                </div>
            )}

            {/* Contact profile viewer */}
            {showProfileViewer && activeChatType === 'direct' && (
                <ProfileViewer name={receiverId} profilePic={receiverProfilePic} onClose={() => setShowProfileViewer(false)} />
            )}
        </div>
    );
}

/* ── Message Bubble ─────────────────────────────────────────────────────────── */
function MessageBubble({ log, selectedMessageId, setSelectedMessageId, groups, groupsRef, showReadReceipts, isEditing, editText, setEditText, onSubmitEdit, onCancelEdit, onContextMenu, onImageClick }) {
    const [singleViewed, setSingleViewed] = useState(false);

    // Deleted for everyone
    if (log.deletedForEveryone) {
        return (
            <div className={`message ${log.isMe ? 'me' : 'them'}`} style={{ opacity: 0.6, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                🚫 This message was deleted
            </div>
        );
    }
    // Deleted for me (local)
    if (log.deletedForMe) return null;

    // Edit inline mode
    if (isEditing) {
        return (
            <form className={`message ${log.isMe ? 'me' : 'them'}`} onSubmit={onSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '65%', alignSelf: 'flex-end' }}>
                <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1.5px solid var(--accent)', background: 'var(--bg-compose-inp)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onCancelEdit} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#ccc', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                </div>
            </form>
        );
    }

    return (
        <div
            className={`message ${log.isMe ? 'me' : 'them'} ${log.error ? 'error' : ''}`}
            onContextMenu={(e) => onContextMenu(e, log)}
            onClick={() => { if (log.isMe && log.isGroup) setSelectedMessageId(selectedMessageId === log.messageId ? null : log.messageId); }}
            style={{ cursor: 'context-menu' }}
        >
            {/* Group sender label */}
            {!log.isMe && log.isGroup && (
                <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '3px', fontSize: '12.5px' }}>{log.from}</strong>
            )}

            {/* Image message */}
            {log.isImage ? (
                log.isSingleView && !log.isMe ? (
                    // Single view — blurred until tapped
                    singleViewed ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>📷 Photo viewed</div>
                    ) : (
                        <div
                            style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
                            onClick={() => { setSingleViewed(true); onImageClick(log.imageData); }}
                        >
                            <img src={log.imageData} alt="Photo" style={{ width: '200px', height: '150px', objectFit: 'cover', borderRadius: '6px', filter: 'blur(12px)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '28px' }}>👁️</div>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px' }}>Tap to view once</p>
                        </div>
                    )
                ) : (
                    // Normal image
                    <img
                        src={log.imageData}
                        alt="Photo"
                        onClick={() => onImageClick(log.imageData)}
                        style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: '8px', cursor: 'zoom-in', display: 'block', objectFit: 'cover' }}
                    />
                )
            ) : (
                <span>{log.text}</span>
            )}

            {/* Edited label */}
            {log.edited && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '6px' }}>edited</span>}

            {/* Sent meta */}
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
                    {!showReadReceipts && <span>✓</span>}
                </div>
            )}
            {!log.isMe && log.timestamp && (
                <div className="message-meta">
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            )}

            {/* Group tracker popup */}
            {selectedMessageId === log.messageId && log.isGroup && (
                <GroupMessageInfo log={log} groups={groups} groupsRef={groupsRef} />
            )}
        </div>
    );
}

/* ── Right-click context menu ────────────────────────────────────────────────── */
function ContextMenu({ x, y, log, onEdit, onDeleteMe, onDeleteEveryone, onDismiss }) {
    const canEdit = log.isMe && !log.isImage && !log.deletedForEveryone && (Date.now() - new Date(log.timestamp).getTime() < 10 * 60 * 1000);
    const canDeleteEveryone = log.isMe && !log.deletedForEveryone;

    // Keep menu inside viewport
    const menuStyle = {
        position: 'fixed',
        top: Math.min(y, window.innerHeight - 180),
        left: Math.min(x, window.innerWidth - 180),
        zIndex: 2000,
        background: 'var(--bg-sidebar)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        minWidth: '170px',
        padding: '6px 0',
        border: '1px solid var(--border-color)',
        animation: 'fadeIn 0.1s ease'
    };

    const itemStyle = (danger) => ({
        padding: '10px 16px',
        cursor: 'pointer',
        fontSize: '14px',
        color: danger ? '#e53935' : 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'background 0.1s'
    });

    return (
        <div style={menuStyle} onClick={e => e.stopPropagation()}>
            {canEdit && (
                <div style={itemStyle(false)} onClick={onEdit} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-item-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    ✏️ Edit Message
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>10 min</span>
                </div>
            )}
            <div style={itemStyle(false)} onClick={onDeleteMe} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-item-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                🗑️ Delete for Me
            </div>
            {canDeleteEveryone && (
                <div style={itemStyle(true)} onClick={onDeleteEveryone} onMouseOver={e => e.currentTarget.style.background = '#fff0f0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    🗑️ Delete for Everyone
                </div>
            )}
            <div style={{ ...itemStyle(false), borderTop: '1px solid var(--border-light)', marginTop: '4px', color: 'var(--text-secondary)' }} onClick={onDismiss}>
                ✕ Cancel
            </div>
        </div>
    );
}

/* ── Group tracking info ─────────────────────────────────────────────────────── */
function GroupMessageInfo({ log, groups, groupsRef }) {
    const groupObj = groups.find(g => g.groupId === log.receiver) || groupsRef.current.find(g => g.groupId === log.receiver);
    const expected = groupObj ? groupObj.members.filter(m => m !== log.from) : [];
    const readIds = (log.readBy || []).map(r => r.userId);
    const deliveredOnly = (log.deliveredTo || []).filter(d => !readIds.includes(d.userId));
    const notDelivered = expected.filter(m => !readIds.includes(m) && !(log.deliveredTo || []).some(d => d.userId === m));
    return (
        <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.06)', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>Message Tracking</strong>
            <div><span style={{ color: '#53bdeb', fontWeight: 'bold' }}>Read: </span>{readIds.join(', ') || 'None'}</div>
            <div><span style={{ color: '#667781', fontWeight: 'bold' }}>Delivered: </span>{deliveredOnly.map(d => d.userId).join(', ') || 'None'}</div>
            {notDelivered.length > 0 && <div><span style={{ color: '#f44336', fontWeight: 'bold' }}>Pending: </span>{notDelivered.join(', ')}</div>}
        </div>
    );
}
