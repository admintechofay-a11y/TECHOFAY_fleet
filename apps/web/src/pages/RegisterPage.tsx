import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface RegisterPageProps {
  onNavigate?: (path: string) => void;
}

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { register } = useAuth();

  const [companyLegalName, setCompanyLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [companyGstin, setCompanyGstin] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Demo Autofill for testing
  const handleFillDemo = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setCompanyLegalName(`Garuda Express Logistics Pvt Ltd`);
    setTradeName(`Garuda Logistics ${randomSuffix}`);
    setCompanyGstin(`24AABCG${randomSuffix}A1Z5`);
    setAdminName(`Vikramaditya Rao`);
    setEmail(`fleet.director.${randomSuffix}@garudalogistics.com`);
    setPhone(`+91 98251 ${randomSuffix}12`);
    setCity('Surat');
    setState('Gujarat');
    setPassword('Technofay@2026!');
    setConfirmPassword('Technofay@2026!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!companyLegalName.trim() || !adminName.trim() || !email.trim() || !password) {
      setError('Please provide all mandatory fields (Company Name, Full Name, Work Email, and Password).');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        companyLegalName: companyLegalName.trim(),
        tradeName: tradeName.trim() || companyLegalName.trim(),
        companyGstin: companyGstin.trim() || undefined,
        adminName: adminName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined
      });
      // Upon successful registration, AuthContext updates user/tenant state
      // and App.tsx automatically renders the authenticated workspace dashboard!
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please review your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', score: 0, color: 'var(--border-medium)' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { label: 'Weak', score: 25, color: '#ef4444' };
    if (score <= 3) return { label: 'Fair', score: 55, color: '#f59e0b' };
    if (score <= 4) return { label: 'Good', score: 80, color: '#3b82f6' };
    return { label: 'Strong', score: 100, color: '#10b981' };
  };

  const strength = getPasswordStrength();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f4f6fa 0%, #e9eff7 100%)',
        padding: '2rem 1rem'
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '2.5rem',
          borderRadius: '18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Top Header & Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            🚚
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Register Your Fleet
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Set up your organization workspace on Technofay Haulage OS
          </p>

          {/* Quick Demo Fill Helper */}
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={handleFillDemo}
              style={{
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px dashed #2563eb',
                color: '#2563eb',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ⚡ Click to Fill Demo Fleet Details
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--status-error-subtle)',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#dc2626'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          {/* Section 1: Company Profile */}
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.25rem',
              background: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🏢 Company Profile
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Company Legal Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={companyLegalName}
                  onChange={(e) => setCompanyLegalName(e.target.value)}
                  placeholder="e.g. Apex Freight Logistics Pvt Ltd"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Trade / Fleet Name
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="e.g. Apex Transport"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  GSTIN (Tax ID)
                </label>
                <input
                  type="text"
                  value={companyGstin}
                  onChange={(e) => setCompanyGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AAACT1234A1Z5 (Optional)"
                  className="input-field"
                  maxLength={15}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Leave blank for trial / non-GST operations
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Operating Hub (City & State)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City (e.g. Ahmedabad)"
                    className="input-field"
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State (e.g. Gujarat)"
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Super Administrator */}
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.25rem',
              background: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a36a', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              👤 Primary Administrator Account
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Administrator Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Rajesh Patel"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Work Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rajesh@apexlogistics.com"
                  className="input-field"
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Official Contact Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Password & Security */}
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.25rem',
              background: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d97706', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔒 Security & Login Credentials
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Master Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.725rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="input-field"
                  required
                />
                {password && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: strength.color }}>
                      <span>Strength: {strength.label}</span>
                      <span>{strength.score}%</span>
                    </div>
                    <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '0.2rem', overflow: 'hidden' }}>
                      <div style={{ width: `${strength.score}%`, height: '100%', background: strength.color, transition: 'all 0.2s ease' }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Confirm Master Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="input-field"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>
                    ⚠️ Passwords do not match
                  </div>
                )}
                {confirmPassword && password === confirmPassword && (
                  <div style={{ fontSize: '0.7rem', color: '#16a36a', marginTop: '0.25rem' }}>
                    ✓ Passwords match
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Terms Agreement */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="terms-check"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: '0.2rem', cursor: 'pointer' }}
            />
            <label htmlFor="terms-check" style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4, cursor: 'pointer' }}>
              I agree to Technofay Fleet Management{' '}
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/terms')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}
              >
                Terms of Service
              </button>{' '}
              and acknowledge the{' '}
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/privacy')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}
              >
                Privacy Policy
              </button>
              .
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Provisioning Organization Workspace...' : 'Complete Registration & Open Dashboard →'}
          </button>
        </form>

        {/* Navigation to Login */}
        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
            Already have an organization workspace?{' '}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
                textDecoration: 'underline'
              }}
            >
              Sign In Here
            </button>
          </p>

          {/* Public Utility Links */}
          {onNavigate && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', marginTop: '1rem', fontSize: '0.725rem' }}>
              <button
                type="button"
                onClick={() => onNavigate('/track')}
                style={{ background: 'none', border: 'none', color: '#16a36a', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                🔍 Track Consignment
              </button>
              <span style={{ color: 'var(--border-medium)' }}>•</span>
              <button
                type="button"
                onClick={() => onNavigate('/contact')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: 0 }}
              >
                Contact Operations
              </button>
              <span style={{ color: 'var(--border-medium)' }}>•</span>
              <button
                type="button"
                onClick={() => onNavigate('/privacy')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                Privacy Policy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
