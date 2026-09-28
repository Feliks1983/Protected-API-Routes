import { useEffect, useState } from 'react';

export default function EmailVerification() {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          setStatus('success');
          setMessage('Your email has been verified. You can now log in.');
        } else {
          setStatus('error');
          setMessage(result.error || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong verifying your email.');
      });
  }, []);

  async function handleResend(e) {
    e.preventDefault();
    if (!email) return;
    setErrors({});
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (result.success) setResent(true);
    } catch (error) {
      throw Error('Error resend-verification', error);
    }
  }

  return (
    <div>
      <h2>Email verification</h2>

      {status === 'verifying' && <p>Verifying your email…</p>}
      {status === 'success' && <p role="status">{message}</p>}

      {status === 'error' && (
        <>
          <p role="alert">{message}</p>
          {!resent ? (
            <form onSubmit={handleResend}>
              <label>
                Resend verification to:
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>
              {errors.email && <p style={{ color: 'red' }}>{errors.email}</p>}
              <label>
                <input type="text" />
              </label>
              <button type="submit">Resend verification email</button>
            </form>
          ) : (
            <p>If that email exists in our system, a new link has been sent.</p>
          )}
        </>
      )}
    </div>
  );
}
