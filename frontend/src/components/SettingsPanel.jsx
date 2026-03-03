/**
 * SettingsPanel.jsx
 * Slide-out settings panel from the sidebar.
 * Covers: profile picture upload, display name, dark/light theme, read receipts, online status.
 */

import { useRef, useState } from 'react';

export default function SettingsPanel({
    userId, displayName, profilePic, privacySettings, theme,
    onClose, onSave, onThemeToggle
}) {
    const [newDisplayName, setNewDisplayName] = useState(displayName);
    const [newProfilePic, setNewProfilePic] = useState(profilePic);
    const [readReceipts, setReadReceipts] = useState(privacySettings?.readReceipts || 'everyone');
    const [onlineStatus, setOnlineStatus] = useState(privacySettings?.onlineStatus || 'everyone');
    const [saving, setSaving] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const fileInputRef = useRef();

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB.'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setNewProfilePic(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave({
            displayName: newDisplayName.trim() || displayName,
            profilePic: newProfilePic,
            privacySettings: { readReceipts, onlineStatus }
        });
        setSaving(false);
        onClose();
    };

    const isDark = theme === 'dark';

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 900,
                    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
                    animation: 'fadeIn 0.15s ease'
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: '360px', zIndex: 1000,
                background: isDark ? '#1f2c34' : '#fff',
                boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column',
                animation: 'slideInLeft 0.25s ease'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #00a884, #007a62)',
                    padding: '20px 20px 30px',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                        width: '32px', height: '32px', cursor: 'pointer', color: '#fff', fontSize: '16px'
                    }}>←</button>
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>Settings</span>
                </div>

                {/* Profile Picture */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    marginTop: '-35px', marginBottom: '8px', position: 'relative'
                }}>
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => newProfilePic && setPreviewOpen(true)}>
                        {newProfilePic ? (
                            <img src={newProfilePic} alt="profile"
                                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                            />
                        ) : (
                            <div style={{
                                width: '90px', height: '90px', borderRadius: '50%', background: '#dfe5e7',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '36px', fontWeight: 'bold', color: '#54656f',
                                border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                            }}>
                                {(displayName || userId).charAt(0).toUpperCase()}
                            </div>
                        )}
                        {/* Camera overlay */}
                        <div
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
                            style={{
                                position: 'absolute', bottom: '2px', right: '2px',
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                            }}
                        >📷</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                    {newProfilePic && (
                        <button onClick={() => setNewProfilePic(null)} style={{
                            marginTop: '6px', background: 'none', border: 'none', color: '#e53935',
                            fontSize: '12px', cursor: 'pointer'
                        }}>Remove photo</button>
                    )}
                </div>

                {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>

                    {/* Display Name */}
                    <Section title="YOUR NAME" isDark={isDark}>
                        <input
                            type="text"
                            value={newDisplayName}
                            onChange={e => setNewDisplayName(e.target.value)}
                            placeholder="Display name"
                            style={{
                                width: '100%', padding: '10px 12px', border: 'none',
                                borderBottom: `2px solid ${isDark ? '#2a3942' : '#e0e0e0'}`,
                                background: 'transparent', fontSize: '15px', outline: 'none',
                                color: isDark ? '#e9edef' : '#111b21', fontFamily: 'inherit'
                            }}
                            onFocus={e => e.target.style.borderBottomColor = '#00a884'}
                            onBlur={e => e.target.style.borderBottomColor = isDark ? '#2a3942' : '#e0e0e0'}
                        />
                        <p style={{ fontSize: '12px', color: '#667781', marginTop: '4px' }}>
                            This is not your username. Username: <strong>@{userId}</strong>
                        </p>
                    </Section>

                    {/* Theme */}
                    <Section title="APPEARANCE" isDark={isDark}>
                        <ToggleRow
                            label={isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
                            subtitle="Switch between light and dark theme"
                            enabled={isDark}
                            onChange={onThemeToggle}
                            isDark={isDark}
                        />
                    </Section>

                    {/* Privacy */}
                    <Section title="PRIVACY" isDark={isDark}>
                        <RadioGroup
                            label="Blue Ticks (Read Receipts)"
                            subtitle="Control who can see when you've read their messages"
                            options={[
                                { value: 'everyone', label: 'Everyone', icon: '🌍' },
                                { value: 'nobody', label: 'Nobody', icon: '🚫' }
                            ]}
                            value={readReceipts}
                            onChange={setReadReceipts}
                            isDark={isDark}
                        />
                        <div style={{ height: '1px', background: isDark ? '#2a3942' : '#f0f2f5', margin: '12px 0' }} />
                        <RadioGroup
                            label="Online Status"
                            subtitle="Control who can see when you're online"
                            options={[
                                { value: 'everyone', label: 'Everyone', icon: '🌍' },
                                { value: 'nobody', label: 'Nobody', icon: '🚫' }
                            ]}
                            value={onlineStatus}
                            onChange={setOnlineStatus}
                            isDark={isDark}
                        />
                    </Section>
                </div>

                {/* Save button */}
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${isDark ? '#2a3942' : '#f0f2f5'}` }}>
                    <button onClick={handleSave} disabled={saving} style={{
                        width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                        background: saving ? '#8edcce' : 'linear-gradient(135deg, #00a884, #007a62)',
                        color: '#fff', fontWeight: '700', fontSize: '15px', cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(0,168,132,0.3)'
                    }}>
                        {saving ? 'Saving...' : 'Save Changes ✓'}
                    </button>
                </div>
            </div>

            {/* Full profile pic viewer */}
            {previewOpen && (
                <div
                    onClick={() => setPreviewOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out', animation: 'fadeIn 0.15s ease'
                    }}
                >
                    <img src={newProfilePic} alt="Profile"
                        style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    />
                </div>
            )}

            <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>
        </>
    );
}

function Section({ title, children, isDark }) {
    return (
        <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '12px', color: '#00a884', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>{title}</p>
            <div style={{ background: isDark ? '#111b21' : '#f9f9f9', borderRadius: '10px', padding: '12px 14px' }}>
                {children}
            </div>
        </div>
    );
}

function ToggleRow({ label, subtitle, enabled, onChange, isDark }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: isDark ? '#e9edef' : '#111b21' }}>{label}</p>
                <p style={{ fontSize: '12px', color: '#667781', marginTop: '2px' }}>{subtitle}</p>
            </div>
            <div
                onClick={onChange}
                style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: enabled ? '#00a884' : '#ccc', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0
                }}
            >
                <div style={{
                    position: 'absolute', top: '2px',
                    left: enabled ? '22px' : '2px',
                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                }} />
            </div>
        </div>
    );
}

function RadioGroup({ label, subtitle, options, value, onChange, isDark }) {
    return (
        <div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: isDark ? '#e9edef' : '#111b21', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: '#667781', marginBottom: '10px' }}>{subtitle}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {options.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        style={{
                            padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: '500',
                            background: value === opt.value ? '#00a884' : isDark ? '#2a3942' : '#e9edef',
                            color: value === opt.value ? '#fff' : isDark ? '#aaa' : '#555',
                            transition: 'all 0.15s'
                        }}
                    >
                        {opt.icon} {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
