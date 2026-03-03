/**
 * ProfileViewer.jsx
 * Full-screen modal that shows a contact's profile picture + name when avatar is clicked.
 */
export default function ProfileViewer({ name, profilePic, onClose }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 2000,
                background: 'rgba(0,0,0,0.88)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', animation: 'fadeIn 0.15s ease'
            }}
        >
            {profilePic ? (
                <img
                    src={profilePic}
                    alt={name}
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '260px', height: '260px',
                        borderRadius: '50%', objectFit: 'cover',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                        cursor: 'default'
                    }}
                />
            ) : (
                <div style={{
                    width: '260px', height: '260px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00a884, #007a62)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '100px', fontWeight: 'bold', color: '#fff',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
                }}>
                    {(name || '?').charAt(0).toUpperCase()}
                </div>
            )}
            <p style={{ color: '#fff', fontSize: '22px', fontWeight: '600', marginTop: '20px' }}>{name}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '6px' }}>Click anywhere to close</p>
            <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        </div>
    );
}
