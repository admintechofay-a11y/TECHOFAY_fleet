import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export const AdminSettingsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    legalName: '',
    tradeName: '',
    gstin: '',
    pan: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'IN'
    },
    settings: {
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      weightUnit: 'MT',
      distanceUnit: 'KM',
      defaultGtaGstRate: 5.0,
      defaultGtaSacCode: '9965',
      prefixes: {
        load: 'LD',
        lr: 'LR',
        bilty: 'BL',
        trip: 'TR'
      }
    },
    branding: {
      logoUrl: '',
      letterheadHeaderUrl: '',
      authorizedSignatoryUrl: ''
    }
  });

  const [initialData, setInitialData] = useState<any>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/admin/settings');
      if (res && res.data) {
        setFormData({
          legalName: res.data.legalName || '',
          tradeName: res.data.tradeName || '',
          gstin: res.data.gstin || '',
          pan: res.data.pan || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          address: {
            street: res.data.address?.street || '',
            city: res.data.address?.city || '',
            state: res.data.address?.state || '',
            pincode: res.data.address?.pincode || '',
            country: res.data.address?.country || 'IN'
          },
          settings: {
            timezone: res.data.settings?.timezone || 'Asia/Kolkata',
            currency: res.data.settings?.currency || 'INR',
            weightUnit: res.data.settings?.weightUnit || 'MT',
            distanceUnit: res.data.settings?.distanceUnit || 'KM',
            defaultGtaGstRate: res.data.settings?.defaultGtaGstRate ?? 5.0,
            defaultGtaSacCode: res.data.settings?.defaultGtaSacCode || '9965',
            prefixes: {
              load: res.data.settings?.prefixes?.load || 'LD',
              lr: res.data.settings?.prefixes?.lr || 'LR',
              bilty: res.data.settings?.prefixes?.bilty || 'BL',
              trip: res.data.settings?.prefixes?.trip || 'TR'
            }
          },
          branding: {
            logoUrl: res.data.branding?.logoUrl || '',
            letterheadHeaderUrl: res.data.branding?.letterheadHeaderUrl || '',
            authorizedSignatoryUrl: res.data.branding?.authorizedSignatoryUrl || ''
          }
        });
        setInitialData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to retrieve organization settings' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    // Basic Indian GSTIN regex validation if provided
    if (formData.gstin) {
      const gstinClean = formData.gstin.trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstinClean)) {
        setIsSaving(false);
        setNotification({
          type: 'error',
          message: 'Invalid GSTIN format. Must be a valid 15-character Indian Goods & Services Tax Identification Number.'
        });
        return;
      }
    }

    try {
      const res = await apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(formData)
      });
      if (res && res.data) {
        setNotification({ type: 'success', message: 'Organization profile and operational parameters saved successfully!' });
        setInitialData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to update organization settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (initialData) {
      setFormData({
        legalName: initialData.legalName || '',
        tradeName: initialData.tradeName || '',
        gstin: initialData.gstin || '',
        pan: initialData.pan || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: {
          street: initialData.address?.street || '',
          city: initialData.address?.city || '',
          state: initialData.address?.state || '',
          pincode: initialData.address?.pincode || '',
          country: initialData.address?.country || 'IN'
        },
        settings: {
          timezone: initialData.settings?.timezone || 'Asia/Kolkata',
          currency: initialData.settings?.currency || 'INR',
          weightUnit: initialData.settings?.weightUnit || 'MT',
          distanceUnit: initialData.settings?.distanceUnit || 'KM',
          defaultGtaGstRate: initialData.settings?.defaultGtaGstRate ?? 5.0,
          defaultGtaSacCode: initialData.settings?.defaultGtaSacCode || '9965',
          prefixes: {
            load: initialData.settings?.prefixes?.load || 'LD',
            lr: initialData.settings?.prefixes?.lr || 'LR',
            bilty: initialData.settings?.prefixes?.bilty || 'BL',
            trip: initialData.settings?.prefixes?.trip || 'TR'
          }
        },
        branding: {
          logoUrl: initialData.branding?.logoUrl || '',
          letterheadHeaderUrl: initialData.branding?.letterheadHeaderUrl || '',
          authorizedSignatoryUrl: initialData.branding?.authorizedSignatoryUrl || ''
        }
      });
      setNotification({ type: 'success', message: 'Form reset to server state.' });
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}>🔄</div>
        <div>Loading organization configurations and system parameters...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.75rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>⚙️</span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
            System & Organization Settings
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Manage legal entity credentials, GST compliance rules, regional defaults, and document prefixes.
        </p>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: notification.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: notification.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            color: notification.type === 'success' ? '#4ade80' : '#f87171'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Organization Legal Profile */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏢</span> Legal Entity Profile
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  LEGAL REGISTERED NAME *
                </label>
                <input
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="e.g. Technofay Transport Solutions Pvt Ltd"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  TRADE / BRAND NAME
                </label>
                <input
                  type="text"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                  placeholder="e.g. Technofay Logistics"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    GSTIN (15 DIGITS)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AABCU9603R1ZM"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    PAN NUMBER
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="AABCU9603R"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    OFFICIAL EMAIL
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ops@technofay.com"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    PHONE / CONTACT
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Operational & Compliance Defaults */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚖️</span> Transport & Compliance Defaults
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    GTA GST RATE (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.settings.defaultGtaGstRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, defaultGtaGstRate: parseFloat(e.target.value) || 0 }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#4ade80',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Statutory GTA rate: 5% (RCM / Non-credit)</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    DEFAULT SAC CODE
                  </label>
                  <input
                    type="text"
                    value={formData.settings.defaultGtaSacCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, defaultGtaSacCode: e.target.value }
                      })
                    }
                    placeholder="9965"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Goods Transport Agency Code: 9965</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    DEFAULT TIMEZONE
                  </label>
                  <select
                    value={formData.settings.timezone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, timezone: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="UTC">UTC (+0:00)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    OPERATING CURRENCY
                  </label>
                  <select
                    value={formData.settings.currency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, currency: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="INR">INR (₹ Indian Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    DEFAULT WEIGHT UNIT
                  </label>
                  <select
                    value={formData.settings.weightUnit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, weightUnit: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="MT">MT (Metric Tonnes)</option>
                    <option value="KG">KG (Kilograms)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    DISTANCE UNIT
                  </label>
                  <select
                    value={formData.settings.distanceUnit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, distanceUnit: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="KM">KM (Kilometres)</option>
                    <option value="MILES">Miles</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Address & Prefix Configuration */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Operating Address */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📍</span> Registered Office Address
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  STREET / PREMISES ADDRESS
                </label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, street: e.target.value }
                    })
                  }
                  placeholder="Plot 104, Transport Nagar"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    CITY
                  </label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value }
                      })
                    }
                    placeholder="Nagpur"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    STATE
                  </label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value }
                      })
                    }
                    placeholder="Maharashtra"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    PINCODE
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.address.pincode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, pincode: e.target.value }
                      })
                    }
                    placeholder="440008"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    COUNTRY
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="India (IN)"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'rgba(15, 23, 42, 0.3)',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sequence Prefixes Preview */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔢</span> Document Numbering Prefixes
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>Load Order Series</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto-incremented on order creation</div>
                </div>
                <span className="badge badge-cyan" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {formData.settings.prefixes?.load || 'LD'}-YYYY-XXXX
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>Lorry Receipt (LR) Series</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pre-printed and digital consignment pool</div>
                </div>
                <span className="badge badge-purple" style={{ fontSize: '0.75rem', fontFamily: 'monospace', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                  {formData.settings.prefixes?.lr || 'LR'}-YYYY-XXXX
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>Bilty Consignment Series</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mandatory statutory consignment notes</div>
                </div>
                <span className="badge badge-pink" style={{ fontSize: '0.75rem', fontFamily: 'monospace', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
                  {formData.settings.prefixes?.bilty || 'BL'}-YYYY-XXXX
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>Trip Manifest Series</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Multi-stop journey tracking manifest</div>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontFamily: 'monospace', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
                  {formData.settings.prefixes?.trip || 'TR'}-YYYY-XXXX
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="btn btn-secondary"
            style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}
          >
            Discard Changes
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.75rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isSaving ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
                <span>Saving System Settings...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Organization Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
