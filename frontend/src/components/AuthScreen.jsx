/**
 * AuthScreen.jsx
 * Handles the Login and Register UI forms.
 * All state is managed by the parent (App.jsx) and passed via props.
 */

const API_URL = 'http://127.0.0.1:3000';

export default function AuthScreen({
    isRegistering, setIsRegistering,
    userId, setUserId,
    displayName, setDisplayName,
    password, setPassword,
    authError, setAuthError,
    usernameStatus, setUsernameStatus,
    onSubmit,
}) {
    return (
        <div className="login-container">
            <h1>{isRegistering ? 'Create Account' : 'Welcome Back'}</h1>
            <p style={{ color: '#888', marginBottom: '20px', fontSize: '13px', textAlign: 'center' }}>
                {isRegistering ? 'Register to start chatting securely.' : 'Login to your E2EE Chat account.'}
            </p>

            <form onSubmit={onSubmit}>
                {/* Username */}
                <div style={{ marginBottom: '10px' }}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={userId}
                        onChange={(e) => {
                            setAuthError('');
                            setUserId(e.target.value.toLowerCase().replace(/\s/g, ''));
                        }}
                        required
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    {/* Username availability hint (register mode only) */}
                    {isRegistering && usernameStatus && (
                        <p style={{
                            fontSize: '12px',
                            margin: '4px 0 0',
                            color: usernameStatus.available ? '#00a884' : '#e53935'
                        }}>
                            {usernameStatus.available
                                ? `✓ "${userId}" is available!`
                                : <>✗ "{userId}" is taken. Try:{' '}
                                    <span
                                        style={{ fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => setUserId(usernameStatus.suggested)}
                                    >
                                        {usernameStatus.suggested}
                                    </span>
                                </>
                            }
                        </p>
                    )}
                </div>

                {/* Display Name — register only */}
                {isRegistering && (
                    <input
                        type="text"
                        placeholder="Display Name (Your full name)"
                        value={displayName}
                        onChange={(e) => { setAuthError(''); setDisplayName(e.target.value); }}
                        required
                        style={{ marginBottom: '10px' }}
                    />
                )}

                {/* Password */}
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => { setAuthError(''); setPassword(e.target.value); }}
                    required
                    style={{ marginBottom: '10px' }}
                />

                {/* Inline error */}
                {authError && (
                    <p style={{
                        color: '#e53935', fontSize: '13px', margin: '0 0 12px',
                        padding: '8px 12px', background: '#fff0f0',
                        borderRadius: '6px', border: '1px solid #ffcdd2'
                    }}>
                        ⚠ {authError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isRegistering && usernameStatus != null && !usernameStatus.available}
                    style={{ opacity: (isRegistering && usernameStatus != null && !usernameStatus.available) ? 0.5 : 1 }}
                >
                    {isRegistering ? 'Register & Generate Keys' : 'Login'}
                </button>

                <p
                    style={{ fontSize: '13px', color: '#00a884', marginTop: '15px', cursor: 'pointer', textAlign: 'center' }}
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setUsernameStatus(null);
                        setAuthError('');
                        setPassword('');
                        setDisplayName('');
                    }}
                >
                    {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
                </p>
            </form>
        </div>
    );
}
