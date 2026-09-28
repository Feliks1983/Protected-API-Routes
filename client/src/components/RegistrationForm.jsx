import { useState } from 'react';

export default function RegistrationForm({ onSuccess }) {
  const [form, setForm] = useState({
    email: '',
    passwordHash: '',
    username: '',
    firstName: '',
    lastName: '',
    bio: '',
  });

  const [errors, setErrors] = useState({});
  const [apiErrors, setApiErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function validateForm() {
    const newErrors = {};

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Must be a valid email';
    }
    if (!form.password || form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!form.username || !/^[a-zA-Z0-9_\s]+$/.test(form.username)) {
      newErrors.username = 'Username must contain only letters, numbers, and underscores';
    }
    if (!form.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiErrors([]);

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          username: form.username,
          profile: {
            firstName: form.firstName,
            lastName: form.lastName,
            bio: form.bio,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.errors && Array.isArray(result.errors)) {
          setApiErrors(result.errors.map(err => err.msg || err));
        } else {
          setApiErrors([result.message || 'Registration failed.']);
        }
        return;
      }
      setSubmitted(true);
      onSuccess?.(result.data);
    } catch (err) {
      setApiErrors(['Something went wrong. Please try again.', err]);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div role="status">
        <h2>Check your email</h2>
        <p>We sent a verification link to {form.email}. Click it to activate your account.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Create an account</h2>

      {apiErrors.length > 0 && (
        <ul role="alert" style={{ color: 'crimson' }}>
          {apiErrors.map((err, i) => (
            <li key={i}>{typeof err === 'string' ? err : err.msg}</li>
          ))}
        </ul>
      )}

      <div>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>
        {errors.email && <p style={{ color: 'red' }}>{errors.email}</p>}
      </div>

      <div>
        <label>
          Username
          <input
            type="text"
            name="username"
            value={form.username}
            autoComplete=""
            onChange={handleChange}
            required
          />
        </label>
        {errors.username && <p style={{ color: 'red' }}>{errors.username}</p>}
      </div>

      <div>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>
        {errors.password && <p style={{ color: 'red' }}>{errors.password}</p>}
      </div>

      <div>
        <label>
          First name
          <input type="text" name="firstName" value={form.firstName} onChange={handleChange} />
        </label>
        {errors.firstName && <p style={{ color: 'red' }}>{errors.firstName}</p>}
      </div>

      <div>
        <label>
          Last name
          <input type="text" name="lastName" value={form.lastName} onChange={handleChange} />
        </label>
        {errors.lastName && <p style={{ color: 'red' }}>{errors.lastName}</p>}
      </div>

      <div>
        <label>
          Bio
          <textarea name="bio" value={form.bio} onChange={handleChange} maxLength={500} />
        </label>
        {errors.bio && <p style={{ color: 'red' }}>{errors.bio}</p>}
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
