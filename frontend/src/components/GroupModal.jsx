/**
 * GroupModal.jsx
 * A beautiful modal dialog for creating a new group chat.
 * Shows contacts as clickable chips and allows typing extra usernames.
 */

import { useState } from 'react';

export default function GroupModal({ currentUserId, contacts, onClose, onCreate }) {
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([currentUserId]);
    const [customInput, setCustomInput] = useState('');
    const [error, setError] = useState('');

    const toggleContact = (username) => {
        if (username === currentUserId) return; // can't remove yourself
        setSelectedMembers(prev =>
            prev.includes(username) ? prev.filter(m => m !== username) : [...prev, username]
        );
    };

    const addCustom = () => {
        const name = customInput.trim().toLowerCase();
        if (!name) return;
        if (selectedMembers.includes(name)) { setCustomInput(''); return; }
        setSelectedMembers(prev => [...prev, name]);
        setCustomInput('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!groupName.trim()) { setError('Please enter a group name.'); return; }
        if (selectedMembers.length < 2) { setError('Add at least one other member.'); return; }
        onCreate({ name: groupName.trim(), members: selectedMembers });
    };

    const knownContacts = Object.keys(contacts).filter(c => c !== currentUserId);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', width: '420px', maxWidth: '95vw',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                animation: 'slideUp 0.2s ease'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #00a884, #007a62)',
                    borderRadius: '16px 16px 0 0', padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px'
                    }}>👥</div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '17px' }}>New Group</div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Create an encrypted group chat</div>
                    </div>
                    <button onClick={onClose} style={{
                        marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none',
                        borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                        color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    {/* Group Name */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#00a884', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Group Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Study Group, Weekend Plans..."
                            value={groupName}
                            onChange={e => { setGroupName(e.target.value); setError(''); }}
                            autoFocus
                            style={{
                                width: '100%', padding: '10px 14px', border: '1.5px solid #e0e0e0',
                                borderRadius: '10px', fontSize: '14px', outline: 'none',
                                boxSizing: 'border-box', transition: 'border-color 0.2s',
                                fontFamily: 'inherit'
                            }}
                            onFocus={e => e.target.style.borderColor = '#00a884'}
                            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                        />
                    </div>

                    {/* Add Members from Contacts */}
                    {knownContacts.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#00a884', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Your Contacts
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {knownContacts.map(c => {
                                    const selected = selectedMembers.includes(c);
                                    return (
                                        <button
                                            key={c} type="button"
                                            onClick={() => toggleContact(c)}
                                            style={{
                                                padding: '6px 14px', borderRadius: '20px', border: 'none',
                                                cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                                                transition: 'all 0.15s',
                                                background: selected ? '#00a884' : '#f0f2f5',
                                                color: selected ? '#fff' : '#555',
                                                transform: selected ? 'scale(1.05)' : 'scale(1)',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <span style={{
                                                width: '22px', height: '22px', borderRadius: '50%',
                                                background: selected ? 'rgba(255,255,255,0.25)' : '#ddd',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: 'bold', color: selected ? '#fff' : '#666'
                                            }}>
                                                {c.charAt(0).toUpperCase()}
                                            </span>
                                            {c}
                                            {selected && ' ✓'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add by username */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#00a884', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Add by Username
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Type a username..."
                                value={customInput}
                                onChange={e => setCustomInput(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                                style={{
                                    flex: 1, padding: '9px 14px', border: '1.5px solid #e0e0e0',
                                    borderRadius: '10px', fontSize: '14px', outline: 'none',
                                    boxSizing: 'border-box', fontFamily: 'inherit'
                                }}
                                onFocus={e => e.target.style.borderColor = '#00a884'}
                                onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                            />
                            <button type="button" onClick={addCustom} style={{
                                padding: '9px 16px', borderRadius: '10px', border: 'none',
                                background: '#00a884', color: '#fff', cursor: 'pointer',
                                fontSize: '14px', fontWeight: '600'
                            }}>Add</button>
                        </div>
                    </div>

                    {/* Selected Members Preview */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#54656f', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Members ({selectedMembers.length})
                        </label>
                        <div style={{
                            background: '#f0f2f5', borderRadius: '10px', padding: '10px 12px',
                            minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center'
                        }}>
                            {selectedMembers.map(m => (
                                <span key={m} style={{
                                    background: m === currentUserId ? '#e0f7f2' : '#00a884',
                                    color: m === currentUserId ? '#00a884' : '#fff',
                                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                                    fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    {m === currentUserId ? `${m} (you)` : m}
                                    {m !== currentUserId && (
                                        <span
                                            onClick={() => toggleContact(m)}
                                            style={{ cursor: 'pointer', opacity: 0.8, marginLeft: '2px' }}
                                        >✕</span>
                                    )}
                                </span>
                            ))}
                            {selectedMembers.length === 1 && (
                                <span style={{ color: '#aaa', fontSize: '13px' }}>No other members yet...</span>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p style={{
                            color: '#e53935', fontSize: '13px', margin: '0 0 12px',
                            padding: '8px 12px', background: '#fff0f0',
                            borderRadius: '8px', border: '1px solid #ffcdd2'
                        }}>⚠ {error}</p>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e0e0e0',
                            background: '#fff', color: '#555', cursor: 'pointer',
                            fontSize: '14px', fontWeight: '600'
                        }}>Cancel</button>
                        <button type="submit" style={{
                            padding: '10px 24px', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #00a884, #007a62)',
                            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                            boxShadow: '0 4px 12px rgba(0,168,132,0.3)'
                        }}>Create Group 🚀</button>
                    </div>
                </form>
            </div>

            <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
        </div>
    );
}
