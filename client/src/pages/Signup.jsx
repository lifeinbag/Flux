// src/pages/Signup.jsx
import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Key, Eye, EyeOff } from 'lucide-react';
import API from '../services/api';
import './Login.css';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sponsor = searchParams.get('ref') || null;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    otp: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Step 1: send OTP
  const sendOtp = async () => {
    if (!form.email) return alert('Please enter your email');
    try {
      setLoading(true);
      await API.post('/auth/request-otp', {
        email: form.email,
        purpose: 'signup'
      });
      alert('OTP sent to your email');
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP & complete signup
  const verifyAndSignup = async () => {
    const { email, otp, password } = form;
    if (!otp || !password) return alert('Enter OTP and new password');
    try {
      setLoading(true);

      // 1) verify code
      await API.post('/auth/verify-otp', { email, code: otp });

      // 2) actually create account – note sponsorCode here
      await API.post('/auth/signup', {
        email,
        password,
        sponsorCode: sponsor  // ← pass the ref code
      });

      alert('Signup successful! Please log in.');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.msg || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1>{step === 1 ? 'Create Account' : 'Verify Email'}</h1>
          <p>{step === 1 ? 'Join our trading platform today' : 'Enter the code sent to your email'}</p>
          {sponsor && (
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.5rem',
              marginTop: '1rem',
              color: '#10b981',
              fontSize: '0.9rem'
            }}>
              🎉 Referred by: {sponsor}
            </div>
          )}
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
                    Sending OTP...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>

            <div className="auth-links">
              <div className="auth-divider">
                <span>Already have an account?</span>
              </div>
              <Link to="/login" className="signup-link">
                Sign In
              </Link>
            </div>
          </>
        )}

        {/* Step 2: OTP & Password */}
        {step === 2 && (
          <>
            <form onSubmit={(e) => { e.preventDefault(); verifyAndSignup(); }} className="auth-form">
              <div className="form-group">
                <label htmlFor="otp">Verification Code</label>
                <div className="input-wrapper">
                  <Key className="input-icon" />
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    value={form.otp}
                    onChange={onChange}
                    placeholder="Enter 6-digit code"
                    required
                    disabled={loading}
                    maxLength="6"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Create Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={onChange}
                    placeholder="Choose a strong password"
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
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
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
                <span>Already have an account?</span>
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