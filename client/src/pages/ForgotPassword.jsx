// client/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Key, Eye, EyeOff } from 'lucide-react';
import API from '../services/api';
import './Login.css';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    code: '',
    newPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Step 1: Request OTP for password reset
  const sendOtp = async () => {
    if (!form.email) return alert('Please enter your email');
    try {
      setLoading(true);
      await API.post('/auth/request-otp', {
        email: form.email,
        purpose: 'forgot'
      });
      alert('Reset code sent to your email');
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and set new password
  const resetPassword = async () => {
    const { email, code, newPassword } = form;
    if (!code || !newPassword) return alert('Enter reset code and new password');
    try {
      setLoading(true);
      
      // verify the code
      await API.post('/auth/verify-otp', { email, code });
      
      // reset the password
      await API.post('/auth/reset-password', {
        email,
        code,
        newPassword
      });
      
      alert('Password reset successful! Please log in.');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.msg || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1>{step === 1 ? 'Reset Password' : 'Create New Password'}</h1>
          <p>{step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code and create a new password'}</p>
        </div>

        {/* Step 1: Email Input */}
        {step === 1 && (
          <>
            <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Sending Code...
                  </>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </form>

            <div className="auth-links">
              <div className="auth-divider">
                <span>Remembered your password?</span>
              </div>
              <Link to="/login" className="signup-link">
                Sign In
              </Link>
            </div>
          </>
        )}

        {/* Step 2: Code & New Password */}
        {step === 2 && (
          <>
            <form onSubmit={(e) => { e.preventDefault(); resetPassword(); }} className="auth-form">
              <div className="form-group">
                <label htmlFor="code">Reset Code</label>
                <div className="input-wrapper">
                  <Key className="input-icon" />
                  <input
                    id="code"
                    name="code"
                    type="text"
                    value={form.code}
                    onChange={onChange}
                    placeholder="Enter 6-digit code"
                    required
                    disabled={loading}
                    maxLength="6"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={form.newPassword}
                    onChange={onChange}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>

            <div className="auth-links">
              <button 
                onClick={() => setStep(1)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#60a5fa', 
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ← Back to Email
              </button>
              
              <div className="auth-divider">
                <span>Ready to sign in?</span>
              </div>
              
              <Link to="/login" className="signup-link">
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}