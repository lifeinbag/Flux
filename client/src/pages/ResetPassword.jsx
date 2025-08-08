// client/src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    otp: '',
    newPassword: '',
  });
  const [loading, setLoading] = useState(false);

  // handle input changes
  const onChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Step 1: send OTP for password reset
  const sendOtp = async () => {
    if (!form.email) return alert('Please enter your email');
    try {
      setLoading(true);
      await API.post('/auth/request-otp', {
        email: form.email,
        purpose: 'forgot',
      });
      alert('Reset code sent to your email');
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP & reset password
  const verifyAndReset = async () => {
    const { email, otp, newPassword } = form;
    if (!otp || !newPassword)
      return alert('Please enter the code and a new password');
    try {
      setLoading(true);
      // verify the code
      await API.post('/auth/verify-otp', { email, code: otp });
      // reset the password
      await API.post('/auth/reset-password', {
        email,
        code: otp,
        newPassword,
      });
      alert('Password reset successful. Please log in.');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.msg || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Forgot Password</h2>

      {step === 1 && (
        <>
          <p>Step 1: Enter your email to receive a reset code.</p>
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={onChange}
            disabled={loading}
            required
          />
          <button onClick={sendOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Code'}
          </button>
          <p style={{ marginTop: '1rem' }}>
            Remembered? <Link to="/login">Log in</Link>
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <p>Step 2: Enter the code and a new password.</p>
          <input
            name="otp"
            placeholder="One-Time Code"
            value={form.otp}
            onChange={onChange}
            disabled={loading}
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New Password"
            value={form.newPassword}
            onChange={onChange}
            disabled={loading}
            required
          />
          <button onClick={verifyAndReset} disabled={loading}>
            {loading ? 'Processing…' : 'Reset Password'}
          </button>
          <p style={{ marginTop: '1rem' }}>
            Go back to <Link to="/login">Log in</Link>
          </p>
        </>
      )}
    </div>
  );
}
