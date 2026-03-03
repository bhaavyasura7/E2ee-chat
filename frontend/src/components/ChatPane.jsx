/**
 * ChatPane.jsx — WeChat-style message layout + FIXED photo sending (label + canvas compression)
 */
import { useState, useId } from 'react';
import { Avatar } from './Sidebar';
import ProfileViewer from './ProfileViewer';

/** Compress image to JPEG, max 900px wide, 0.78 quality — keeps socket payload small */
function compressImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 900;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.src = src;
    });
}

export default function ChatPane({
    activeChatType, receiverId, activeGroupId,
    groups, groupsRef, isReceiverOnline,
    receiverProfilePic, myProfilePic, myUserId, myPrivacySettings,
    chatLog, selectedMessageId, setSelectedMessageId,
    message, setMessage, onSendMessage, onSendImage,
    onEditMessage, onDeleteMessage,
    bottomRef,
}) {
    const [showProfileViewer, setShowProfileViewer] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const fileInputId = useId(); // stable unique id — fixes the label↔input link
    const activeGroup = groups.find(g => g.groupId === activeGroupId);

    // ── Photo pick: uses label+id approach (no programmatic click needed) ─────
    const handleImagePick = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB.'); return; }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const compressed = await compressImage(ev.target.result);
                await onSendImage(compressed, 'image/jpeg');
            } catch { onSendImage(ev.target.result, file.type); }
        };
        reader.readAsDataURL(file);
        // reset value so same file can be picked again
        e.target.value = '';
    };

    const startEdit = (log) => { setEditingId(log.messageId); setEditText(log.text); setContextMenu(null); };
    const submitEdit = (e) => {
        e.preventDefault();
        if (!editText.trim()) return;
        onEditMessage(editingId, editText.trim());
        setEditingId(null); setEditText('');
    };
    const handleCtxMenu = (e, log) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, log }); };
    const dismissMenu = () => setContextMenu(null);

    return (
        <div className="chat-pane" onClick={dismissMenu}>

            {/* ── Chat Header ── */}
            <div className="chat-header">
                <div style={{ cursor: 'pointer' }} onClick={() => activeChatType === 'direct' && setShowProfileViewer(true)}>
                    {activeChatType === 'direct'
                        ? (<div className="avatar-wrap"><Avatar name={receiverId} pic={receiverProfilePic} size={42} />{isReceiverOnline && <span className="online-dot" />}</div>)
                        : (<div className="avatar" style={{ width: 42, height: 42, fontSize: 19, background: 'linear-gradient(135deg,#1d7bff,#6b48ff)', color: '#fff' }}>{activeGroup?.name?.charAt(0) || 'G'}</div>)
                    }
                </div>
                <div className="header-info">
                    <span className="title">{activeChatType === 'direct' ? receiverId : activeGroup?.name}</span>
                    <span className="subtitle" style={{ color: isReceiverOnline && activeChatType === 'direct' ? '#22c55e' : 'var(--text-secondary)' }}>
                        {activeChatType === 'direct'
                            ? (isReceiverOnline ? '● Online' : 'Offline')
                            : `${activeGroup?.members?.length || 0} members`}
                    </span>
                </div>
            </div>

            {/* ── Messages ── */}
            <div className="messages-area">
                {chatLog.map((log, idx) => {
                    // Date separator
                    const prevLog = idx > 0 ? chatLog[idx - 1] : null;
                    const showDate = !prevLog || !sameDay(log.timestamp, prevLog.timestamp);
                    return (
                        <div key={idx}>
                            {showDate && log.timestamp && (
                                <div className="date-separator">{fmtDate(log.timestamp)}</div>
                            )}
                            <MessageBubble
                                log={log}
                                selectedMessageId={selectedMessageId}
                                setSelectedMessageId={setSelectedMessageId}
                                groups={groups} groupsRef={groupsRef}
                                showReadReceipts={myPrivacySettings?.readReceipts !== 'nobody'}
                                isEditing={editingId === log.messageId}
                                editText={editText} setEditText={setEditText}
                                onSubmitEdit={submitEdit}
                                onCancelEdit={() => setEditingId(null)}
                                onContextMenu={handleCtxMenu}
                                onImageClick={src => setLightboxSrc(src)}
                                myProfilePic={myProfilePic}
                                receiverProfilePic={receiverProfilePic}
                                myUserId={myUserId}
                            />
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* ── Compose Bar ── */}
            <form className="compose-area" onSubmit={onSendMessage}>
                {/* Hidden file input linked to label by id — most reliable across all browsers */}
                <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImagePick}
                />
                <label
                    htmlFor={fileInputId}
                    className="compose-btn photo-btn"
                    title="Send a photo"
                    style={{ cursor: 'pointer' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </label>
                <input
                    type="text"
                    placeholder="Type a message…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                />
                <button type="submit" className="compose-btn send-btn" disabled={!message} title="Send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </form>

            {/* ── Context Menu ── */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x} y={contextMenu.y} log={contextMenu.log}
                    onEdit={() => startEdit(contextMenu.log)}
                    onDeleteMe={() => { onDeleteMessage(contextMenu.log.messageId, 'me', contextMenu.log); setContextMenu(null); }}
                    onDeleteEveryone={() => { onDeleteMessage(contextMenu.log.messageId, 'everyone', contextMenu.log); setContextMenu(null); }}
                    onDismiss={dismissMenu}
                />
            )}

            {/* ── Image lightbox ── */}
            {lightboxSrc && (
                <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', animation: 'fadeIn 0.15s ease' }}>
                    <img src={lightboxSrc} alt="Photo" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,.6)' }} />
                </div>
            )}

            {/* ── Profile viewer ── */}
            {showProfileViewer && activeChatType === 'direct' && (
                <ProfileViewer name={receiverId} profilePic={receiverProfilePic} onClose={() => setShowProfileViewer(false)} />
            )}
        </div>
    );
}

/* ── WeChat-style message bubble with avatar ─────────────────────────────── */
function MessageBubble({ log, selectedMessageId, setSelectedMessageId, groups, groupsRef, showReadReceipts, isEditing, editText, setEditText, onSubmitEdit, onCancelEdit, onContextMenu, onImageClick, myProfilePic, receiverProfilePic, myUserId }) {
    const [singleViewed, setSingleViewed] = useState(false);

    if (log.deletedForMe) return null;

    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    // Inline edit
    if (isEditing) {
        return (
            <div className="msg-row me">
                <div className="msg-col">
                    <form onSubmit={onSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                        <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '10px', border: '2px solid var(--accent)', background: 'var(--bg-compose-inp)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={onCancelEdit} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: 'var(--border-color)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                            <button type="submit" style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className={`msg-row ${log.isMe ? 'me' : 'them'}`}>
            {/* Avatar */}
            <div className="msg-avatar">
                <Avatar
                    name={log.isMe ? (myUserId || 'me') : log.from}
                    pic={log.isMe ? myProfilePic : receiverProfilePic}
                    size={34}
                />
            </div>

            <div className="msg-col">
                {/* Sender name (in groups for received) */}
                {!log.isMe && log.isGroup && (
                    <span className="msg-sender-name">{log.from}</span>
                )}

                {/* Bubble */}
                {log.deletedForEveryone ? (
                    <div className="message them" style={{ opacity: 0.6, fontStyle: 'italic', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)' }}>
                        🚫 This message was deleted
                    </div>
                ) : (
                    <div
                        className={`message ${log.isMe ? 'me' : 'them'} ${log.error ? 'error' : ''}`}
                        onContextMenu={e => onContextMenu(e, log)}
                        onClick={() => log.isMe && log.isGroup && setSelectedMessageId(selectedMessageId === log.messageId ? null : log.messageId)}
                        style={{ cursor: 'context-menu' }}
                    >
                        {/* Image */}
                        {log.isImage ? (
                            log.isSingleView && !log.isMe ? (
                                singleViewed
                                    ? <div style={{ fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>📷 Photo viewed</div>
                                    : (
                                        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => { setSingleViewed(true); onImageClick(log.imageData); }}>
                                            <img src={log.imageData} alt="Photo" style={{ width: '200px', height: '150px', objectFit: 'cover', borderRadius: '8px', filter: 'blur(14px)' }} />
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '4px' }}>
                                                <span style={{ fontSize: '28px' }}>👁️</span><span style={{ fontSize: '11px' }}>View once</span>
                                            </div>
                                        </div>
                                    )
                            ) : (
                                <img src={log.imageData} alt="Photo" onClick={() => onImageClick(log.imageData)}
                                    style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: '8px', cursor: 'zoom-in', display: 'block', objectFit: 'cover' }}
                                />
                            )
                        ) : (
                            <span>{log.text}</span>
                        )}

                        {log.edited && <span style={{ fontSize: '10px', opacity: 0.65, marginLeft: '6px' }}>edited</span>}

                        {/* Meta: time + ticks */}
                        <div className="message-meta">
                            <span>{timeStr}</span>
                            {log.isMe && showReadReceipts && (
                                log.status === 'read' ? <span className="tick-read">✓✓</span>
                                    : log.status === 'delivered' ? <span>✓✓</span>
                                        : <span>✓</span>
                            )}
                            {log.isMe && !showReadReceipts && <span>✓</span>}
                        </div>

                        {/* Group tracking */}
                        {selectedMessageId === log.messageId && log.isGroup && (
                            <GroupMessageInfo log={log} groups={groups} groupsRef={groupsRef} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Context Menu ──────────────────────────────────────────────────────────── */
function ContextMenu({ x, y, log, onEdit, onDeleteMe, onDeleteEveryone, onDismiss }) {
    const canEdit = log.isMe && !log.isImage && !log.deletedForEveryone && (Date.now() - new Date(log.timestamp).getTime() < 10 * 60 * 1000);
    const canDeleteAll = log.isMe && !log.deletedForEveryone;
    const left = Math.min(x, window.innerWidth - 190);
    const top = Math.min(y, window.innerHeight - 190);

    const row = (danger, onClick, children) => (
        <div onClick={onClick}
            style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '13.5px', color: danger ? '#ef4444' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '6px', transition: 'background 0.1s' }}
            onMouseOver={e => e.currentTarget.style.background = danger ? '#fff0f0' : 'var(--bg-item-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >{children}</div>
    );

    return (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top, left, zIndex: 2000, background: 'var(--bg-sidebar)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', minWidth: '175px', padding: '4px', border: '1px solid var(--border-color)', animation: 'popIn 0.1s ease' }}>
            {canEdit && row(false, onEdit, <><span>✏️</span> Edit <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>10 min</span></>)}
            {row(false, onDeleteMe, <><span>🗑️</span> Delete for Me</>)}
            {canDeleteAll && row(true, onDeleteEveryone, <><span>🗑️</span> Delete for Everyone</>)}
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
            {row(false, onDismiss, <><span>✕</span> Cancel</>)}
        </div>
    );
}

/* ── Group tracking ──────────────────────────────────────────────────────── */
function GroupMessageInfo({ log, groups, groupsRef }) {
    const g = groups.find(x => x.groupId === log.receiver) || groupsRef.current.find(x => x.groupId === log.receiver);
    const expected = g ? g.members.filter(m => m !== log.from) : [];
    const readIds = (log.readBy || []).map(r => r.userId);
    const deliveredOnly = (log.deliveredTo || []).filter(d => !readIds.includes(d.userId)).map(d => d.userId);
    const pending = expected.filter(m => !readIds.includes(m) && !deliveredOnly.includes(m));
    return (
        <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.1)', padding: '8px 10px', borderRadius: '8px', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)' }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Message tracking</strong>
            <div><span style={{ color: '#93dcff' }}>✓✓ Read: </span>{readIds.join(', ') || 'None'}</div>
            <div><span style={{ opacity: 0.7 }}>✓✓ Delivered: </span>{deliveredOnly.join(', ') || 'None'}</div>
            {pending.length > 0 && <div><span style={{ color: '#fca5a5' }}>⏳ Pending: </span>{pending.join(', ')}</div>}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function sameDay(ts1, ts2) {
    if (!ts1 || !ts2) return false;
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
