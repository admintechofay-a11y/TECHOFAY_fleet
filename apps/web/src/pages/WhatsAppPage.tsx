import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

interface MessageLogItem {
  _id: string;
  recipientPhone: string;
  recipientName?: string;
  templateName?: string;
  messageType: string;
  renderedMessage: string;
  documentFileName?: string;
  provider: string;
  providerMessageId?: string;
  status: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  deliveredAt?: string;
  createdAt: string;
  relatedEntity?: {
    entityType?: string;
    referenceNumber?: string;
  };
}

interface WhatsAppConfigData {
  provider: string;
  isEnabled: boolean;
  senderNumber: string;
  phoneNumberId: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  hasApiSecret: boolean;
  maskedApiSecret: string;
  hasWebhookSecret: boolean;
  maskedWebhookSecret: string;
}

export const WhatsAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'send' | 'logs' | 'config'>('send');

  // Provider Config State
  const [config, setConfig] = useState<WhatsAppConfigData | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Send Form State
  const [sendType, setSendType] = useState<'template' | 'document' | 'custom'>('template');
  const [recipientPhone, setRecipientPhone] = useState('+91');
  const [recipientName, setRecipientName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('LOAD_CREATED');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({
    loadNumber: 'LD-2026-00104',
    originCity: 'Mumbai',
    destCity: 'Nagpur',
    weightMt: '28.5',
    packageType: 'Bags'
  });

  // Document Share State
  const [documentType, setDocumentType] = useState<'LR' | 'BILTY'>('LR');
  const [documentId, setDocumentId] = useState('');
  const [customCaption, setCustomCaption] = useState('');

  // Custom Message State
  const [customText, setCustomText] = useState('');

  // Execution & Feedback State
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Logs State
  const [messages, setMessages] = useState<MessageLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Config Form State
  const [configForm, setConfigForm] = useState({
    provider: 'MOCK',
    isEnabled: true,
    senderNumber: '+919876543210',
    phoneNumberId: '',
    apiKey: '',
    apiSecret: '',
    webhookSecret: ''
  });
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);

  // Load Config
  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await apiRequest('/whatsapp/config');
      setConfig(res.data);
      if (res.data) {
        setConfigForm(prev => ({
          ...prev,
          provider: res.data.provider || 'MOCK',
          isEnabled: res.data.isEnabled ?? true,
          senderNumber: res.data.senderNumber || '',
          phoneNumberId: res.data.phoneNumberId || ''
        }));
      }
    } catch (err: any) {
      console.error('Failed to load WhatsApp config:', err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  // Load Message Logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      let query = '/whatsapp/messages?limit=50';
      if (logFilterStatus) query += `&status=${encodeURIComponent(logFilterStatus)}`;
      if (logSearch) query += `&search=${encodeURIComponent(logSearch)}`;
      const res = await apiRequest(query);
      setMessages(res.data || []);
    } catch (err: any) {
      console.error('Failed to load messages:', err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, logFilterStatus]);

  // Live WhatsApp Message Preview Generator
  const getPreviewText = (): string => {
    if (sendType === 'custom') {
      return customText || 'Type your message in the composer to preview how it appears on mobile...';
    }
    if (sendType === 'document') {
      return (
        `📄 *Official ${documentType} Consignment Document*\n\n` +
        (customCaption ? `${customCaption}\n\n` : `Attached document file: ${documentType}_${documentId || 'REF1001'}.pdf\n\n`) +
        `Technofay Fleet Document Management`
      );
    }

    if (selectedTemplate === 'LOAD_CREATED') {
      return (
        `🚚 *Technofay Logistics Update*\n\n` +
        `Dear Customer,\nA new consignment load *${templateVars.loadNumber || 'LD-2026-XXXXX'}* has been registered.\n` +
        `📍 *Origin:* ${templateVars.originCity || 'Origin Hub'}\n` +
        `🏁 *Destination:* ${templateVars.destCity || 'Destination'}\n` +
        `📦 *Cargo:* ${templateVars.weightMt || '0'} MT (${templateVars.packageType || 'Packages'})\n\n` +
        `Thank you for choosing our fleet services!`
      );
    }
    if (selectedTemplate === 'VEHICLE_DISPATCHED') {
      return (
        `🚛 *Trip Dispatched - On The Move*\n\n` +
        `Trip *${templateVars.tripNumber || 'TR-2026-0001'}* (Load ${templateVars.loadNumber || 'LD-2026-0001'}) has been dispatched!\n` +
        `🚚 *Vehicle Plate:* ${templateVars.vehiclePlate || 'MH12AB1234'}\n` +
        `👤 *Assigned Driver:* ${templateVars.driverName || 'Driver Name'} (📞 ${templateVars.driverPhone || '+91 98000 00000'})\n` +
        `📍 *Route:* ${templateVars.originCity || 'Origin'} ➔ ${templateVars.destCity || 'Destination'}\n\n` +
        `Technofay Fleet Dispatch Management`
      );
    }
    if (selectedTemplate === 'IN_TRANSIT') {
      return (
        `📍 *Consignment In Transit*\n\n` +
        `Load *${templateVars.loadNumber || 'LD-2026-0001'}* is currently on route to *${templateVars.destCity || 'Destination'}*.\n` +
        `Expected Arrival: *${templateVars.expectedDate || 'Today 6:00 PM'}*.\n` +
        `Driver Contact: ${templateVars.driverPhone || '+91 98000 00000'}.\n\n` +
        `Technofay Fleet Operations`
      );
    }
    if (selectedTemplate === 'DELIVERY_COMPLETED') {
      return (
        `✅ *Consignment Delivered Successfully*\n\n` +
        `Load *${templateVars.loadNumber || 'LD-2026-0001'}* has successfully arrived at ${templateVars.destCity || 'Destination'}.\n` +
        `📦 *Delivered Quantity:* ${templateVars.deliveredQty || '100'} Units\n` +
        `👤 *Received By:* ${templateVars.receivedBy || 'Store Manager'}\n` +
        `Proof of Delivery (POD) has been verified and recorded.`
      );
    }
    return (
      `📄 *Official Consignment Document Attached*\n\n` +
      `Please find attached official ${templateVars.documentType || 'LR'} *${templateVars.documentNumber || 'LR-2026-0001'}* for Load *${templateVars.loadNumber || 'LD-2026-0001'}*.\n` +
      `Vehicle: ${templateVars.vehiclePlate || 'MH12AB1234'}\n` +
      `Freight: INR ${templateVars.totalFreightRupees || '45000'}.\n\n` +
      `Technofay Fleet Document Management`
    );
  };

  // Handle Send Operation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFeedback(null);

    try {
      if (sendType === 'template') {
        const res = await apiRequest('/whatsapp/send', {
          method: 'POST',
          body: JSON.stringify({
            toPhone: recipientPhone,
            recipientName,
            templateName: selectedTemplate,
            variables: templateVars
          })
        });
        setFeedback({
          text: `Message dispatched successfully to ${recipientPhone} [${res.data?.status || 'QUEUED'}].`,
          type: 'success'
        });
      } else if (sendType === 'document') {
        if (!documentId.trim()) {
          throw new Error('Document reference ID is required.');
        }
        const res = await apiRequest('/whatsapp/send-document', {
          method: 'POST',
          body: JSON.stringify({
            toPhone: recipientPhone,
            recipientName,
            documentType,
            documentId: documentId.trim(),
            caption: customCaption
          })
        });
        setFeedback({
          text: `Document PDF shared successfully with ${recipientPhone} [${res.data?.status || 'QUEUED'}].`,
          type: 'success'
        });
      } else {
        if (!customText.trim()) {
          throw new Error('Message body cannot be empty.');
        }
        const res = await apiRequest('/whatsapp/send-custom', {
          method: 'POST',
          body: JSON.stringify({
            toPhone: recipientPhone,
            recipientName,
            message: customText
          })
        });
        setFeedback({
          text: `Custom note dispatched to ${recipientPhone} [${res.data?.status || 'QUEUED'}].`,
          type: 'success'
        });
        setCustomText('');
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to dispatch WhatsApp message.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  // Handle Retry
  const handleRetry = async (messageId: string) => {
    setRetryingId(messageId);
    setFeedback(null);
    try {
      const res = await apiRequest(`/whatsapp/retry/${messageId}`, { method: 'POST' });
      setFeedback({ text: res.message || 'Message retry executed.', type: 'success' });
      fetchLogs();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Retry failed.', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  // Handle Config Save
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveConfigLoading(true);
    setFeedback(null);
    try {
      const res = await apiRequest('/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify(configForm)
      });
      setConfig(res.data);
      setFeedback({ text: 'WhatsApp provider settings saved successfully.', type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to update configuration.', type: 'error' });
    } finally {
      setSaveConfigLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
            WhatsApp Communication Center
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>
            Dispatch automated consignment updates, share LR/Bilty PDFs, configure provider credentials, and audit message delivery.
          </p>
        </div>

        {/* Provider Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: config?.provider === 'MOCK' ? '#06B6D4' : config?.isEnabled ? '#10B981' : '#F59E0B'
          }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
            Provider: {config?.provider === 'MOCK' ? 'Mock Adapter (Local Dev)' : config?.provider || 'MOCK'}
          </span>
          <span style={{ fontSize: '11px', background: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>
            {config?.isEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Global Toast / Feedback */}
      {feedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: feedback.type === 'success' ? '#065F46' : '#991B1B',
          border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`
        }}>
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: '24px', gap: '8px' }}>
        {[
          { key: 'send', label: '💬 Dispatch & Message Composer' },
          { key: 'logs', label: '📋 Message History & Delivery Audit' },
          { key: 'config', label: '⚙️ Provider & Webhook Settings' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: activeTab === tab.key ? '#0284C7' : '#64748B',
              borderBottom: activeTab === tab.key ? '3px solid #0284C7' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: Dispatch & Message Composer                             */}
      {/* ============================================================== */}
      {activeTab === 'send' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(360px, 0.8fr)', gap: '28px', alignItems: 'start' }}>
          {/* Left Column: Form Composer */}
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              Compose WhatsApp Notification
            </h2>

            <form onSubmit={handleSendMessage}>
              {/* Message Type Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Dispatch Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'template', label: 'Approved Template' },
                    { id: 'document', label: 'Share Document' },
                    { id: 'custom', label: 'Custom Text' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setSendType(t.id as any)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: sendType === t.id ? '2px solid #0284C7' : '1px solid #CBD5E1',
                        background: sendType === t.id ? '#F0F9FF' : '#FFFFFF',
                        color: sendType === t.id ? '#0369A1' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Phone & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Recipient Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Indian 10-digit mobile or international E.164</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Recipient Name / Party
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Patel (Consignee)"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Type: TEMPLATE */}
              {sendType === 'template' && (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                      Select Approved Business Template *
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                    >
                      <option value="LOAD_CREATED">🚚 LOAD_CREATED (Consignment Registered)</option>
                      <option value="VEHICLE_DISPATCHED">🚛 VEHICLE_DISPATCHED (Vehicle on the Move)</option>
                      <option value="IN_TRANSIT">📍 IN_TRANSIT (Transit Progress Update)</option>
                      <option value="DELIVERY_COMPLETED">✅ DELIVERY_COMPLETED (Consignment Delivered)</option>
                      <option value="LR_BILTY_SHARE">📄 LR_BILTY_SHARE (Official Document Link)</option>
                    </select>
                  </div>

                  {/* Dynamic Template Variables */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Load Number</label>
                      <input
                        type="text"
                        value={templateVars.loadNumber || ''}
                        onChange={(e) => setTemplateVars({ ...templateVars, loadNumber: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Destination City</label>
                      <input
                        type="text"
                        value={templateVars.destCity || ''}
                        onChange={(e) => setTemplateVars({ ...templateVars, destCity: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>

                    {selectedTemplate === 'LOAD_CREATED' && (
                      <>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Origin City</label>
                          <input
                            type="text"
                            value={templateVars.originCity || ''}
                            onChange={(e) => setTemplateVars({ ...templateVars, originCity: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Cargo Weight (MT)</label>
                          <input
                            type="text"
                            value={templateVars.weightMt || ''}
                            onChange={(e) => setTemplateVars({ ...templateVars, weightMt: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}

                    {selectedTemplate === 'VEHICLE_DISPATCHED' && (
                      <>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Trip Number</label>
                          <input
                            type="text"
                            value={templateVars.tripNumber || 'TR-2026-0001'}
                            onChange={(e) => setTemplateVars({ ...templateVars, tripNumber: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Vehicle Plate</label>
                          <input
                            type="text"
                            value={templateVars.vehiclePlate || 'MH12AB1234'}
                            onChange={(e) => setTemplateVars({ ...templateVars, vehiclePlate: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Driver Name</label>
                          <input
                            type="text"
                            value={templateVars.driverName || 'Mohan Singh'}
                            onChange={(e) => setTemplateVars({ ...templateVars, driverName: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Driver Phone</label>
                          <input
                            type="text"
                            value={templateVars.driverPhone || '+91 98000 00000'}
                            onChange={(e) => setTemplateVars({ ...templateVars, driverPhone: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}

                    {selectedTemplate === 'DELIVERY_COMPLETED' && (
                      <>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Delivered Quantity</label>
                          <input
                            type="text"
                            value={templateVars.deliveredQty || '250'}
                            onChange={(e) => setTemplateVars({ ...templateVars, deliveredQty: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Received By</label>
                          <input
                            type="text"
                            value={templateVars.receivedBy || 'Store In-charge'}
                            onChange={(e) => setTemplateVars({ ...templateVars, receivedBy: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Type: DOCUMENT */}
              {sendType === 'document' && (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                        Document Type *
                      </label>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value as any)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      >
                        <option value="LR">Lorry Receipt (LR)</option>
                        <option value="BILTY">Consignment Bilty</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                        Document MongoDB ObjectId *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 60d5ec49f1b2c8a1b8e4e1a2"
                        value={documentId}
                        onChange={(e) => setDocumentId(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                      Accompanying Note / Caption
                    </label>
                    <input
                      type="text"
                      placeholder="Please find attached official freight document..."
                      value={customCaption}
                      onChange={(e) => setCustomCaption(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {/* Type: CUSTOM TEXT */}
              {sendType === 'custom' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Message Content *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter message text to dispatch..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8' }}>
                    {customText.length} characters
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={sending}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#25D366',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(37,211,102,0.3)'
                }}
              >
                {sending ? '⏳ Dispatched...' : '🚀 Dispatch WhatsApp Notification'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Mobile Chat Bubble Preview */}
          <div>
            <div style={{
              background: '#0F172A',
              padding: '16px 20px',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                🚚
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>Technofay Fleet Support</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Verified WhatsApp Business Account</div>
              </div>
            </div>

            <div style={{
              background: '#ECE5DD',
              padding: '24px 16px',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px',
              border: '1px solid #CBD5E1',
              minHeight: '340px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {/* WhatsApp Bubble */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '8px',
                padding: '12px 14px',
                maxWidth: '90%',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                position: 'relative',
                whiteSpace: 'pre-wrap',
                fontSize: '13px',
                lineHeight: '1.45',
                color: '#111827'
              }}>
                {sendType === 'document' && (
                  <div style={{
                    padding: '8px 10px',
                    background: '#F1F5F9',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '12px', color: '#0F172A' }}>
                        {documentType}_{documentId || 'REF1001'}.pdf
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>Portable Document Format • Ready</div>
                    </div>
                  </div>
                )}
                {getPreviewText()}
                <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '10px', color: '#94A3B8', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '3px' }}>
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: '#0284C7' }}>✓✓</span>
                </div>
              </div>

              {/* Mobile Footer Note */}
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B', marginTop: '20px' }}>
                🔒 End-to-end encrypted • Dispatched via {config?.provider || 'MOCK'} Adapter
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: Message History & Delivery Audit                        */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search phone, recipient, or text..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', width: '260px' }}
              />
              <select
                value={logFilterStatus}
                onChange={(e) => setLogFilterStatus(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="">All Delivery Statuses</option>
                <option value="MOCK_DELIVERED">MOCK_DELIVERED (Dev)</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="READ">READ</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="FAILED">FAILED</option>
              </select>
              <button
                onClick={fetchLogs}
                style={{ padding: '8px 16px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                🔍 Search
              </button>
            </div>

            <button
              onClick={fetchLogs}
              style={{ padding: '8px 16px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
            >
              🔄 Refresh Logs
            </button>
          </div>

          {/* Table */}
          {logsLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>Loading WhatsApp message audit trail...</div>
          ) : messages.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>No message records found matching your filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '12px' }}>Timestamp</th>
                    <th style={{ padding: '12px' }}>Recipient</th>
                    <th style={{ padding: '12px' }}>Type / Template</th>
                    <th style={{ padding: '12px' }}>Message Preview</th>
                    <th style={{ padding: '12px' }}>Provider</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => {
                    const statusColor =
                      m.status === 'DELIVERED' ? '#10B981' :
                      m.status === 'MOCK_DELIVERED' ? '#06B6D4' :
                      m.status === 'READ' ? '#3B82F6' :
                      m.status === 'FAILED' ? '#EF4444' : '#F59E0B';

                    return (
                      <tr key={m._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#0F172A' }}>{m.recipientPhone}</div>
                          {m.recipientName && <div style={{ fontSize: '11px', color: '#64748B' }}>{m.recipientName}</div>}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#334155', fontWeight: '600' }}>
                            {m.templateName || m.messageType}
                          </span>
                          {m.relatedEntity?.referenceNumber && (
                            <div style={{ fontSize: '11px', color: '#0284C7', marginTop: '2px' }}>
                              Ref: {m.relatedEntity.referenceNumber}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>
                          {m.renderedMessage}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#475569' }}>
                          {m.provider}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#FFFFFF',
                            background: statusColor
                          }}>
                            {m.status}
                          </span>
                          {m.status === 'FAILED' && m.errorMessage && (
                            <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '2px', maxWidth: '180px' }}>
                              {m.errorMessage}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {m.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(m._id)}
                              disabled={retryingId === m._id || m.retryCount >= m.maxRetries}
                              style={{
                                padding: '4px 10px',
                                background: '#FEE2E2',
                                color: '#991B1B',
                                border: '1px solid #FECACA',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              {retryingId === m._id ? 'Retrying...' : `Retry (${m.retryCount}/${m.maxRetries})`}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: Provider & Webhook Settings                             */}
      {/* ============================================================== */}
      {activeTab === 'config' && (
        <div style={{ maxWidth: '800px', background: '#FFFFFF', padding: '28px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>
            WhatsApp Provider Configuration
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            Configure your enterprise WhatsApp Business API adapter. For local development, the Mock Adapter safely simulates delivery without making outbound network requests.
          </p>

          <form onSubmit={handleSaveConfig}>
            {/* Active Provider Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                Active Provider Adapter *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { id: 'MOCK', name: 'Mock Adapter (Local Dev)', desc: 'Zero cost simulation with delivery logs' },
                  { id: 'INTERAKT', name: 'Interakt API', desc: 'Indian WhatsApp Business Solution Provider' },
                  { id: 'TWILIO', name: 'Twilio WhatsApp', desc: 'Global Twilio Programmable Messaging' }
                ].map(p => (
                  <div
                    key={p.id}
                    onClick={() => setConfigForm({ ...configForm, provider: p.id })}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: configForm.provider === p.id ? '2px solid #0284C7' : '1px solid #CBD5E1',
                      background: configForm.provider === p.id ? '#F0F9FF' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', color: configForm.provider === p.id ? '#0369A1' : '#0F172A' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      {p.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Toggle Enablement */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="isEnabled"
                checked={configForm.isEnabled}
                onChange={(e) => setConfigForm({ ...configForm, isEnabled: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="isEnabled" style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                Enable Outbound WhatsApp Notifications for this Organization
              </label>
            </div>

            {/* Sender Phone & Phone ID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Sender Number / Display Phone
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={configForm.senderNumber}
                  onChange={(e) => setConfigForm({ ...configForm, senderNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  WhatsApp Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 109283746501928"
                  value={configForm.phoneNumberId}
                  onChange={(e) => setConfigForm({ ...configForm, phoneNumberId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* API Keys (Masked) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  API Key / Account SID {config?.hasApiKey && <span style={{ color: '#10B981', fontSize: '11px' }}>({config.maskedApiKey})</span>}
                </label>
                <input
                  type="password"
                  placeholder={config?.hasApiKey ? config.maskedApiKey : 'Enter API Key'}
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  API Secret / Auth Token {config?.hasApiSecret && <span style={{ color: '#10B981', fontSize: '11px' }}>({config.maskedApiSecret})</span>}
                </label>
                <input
                  type="password"
                  placeholder={config?.hasApiSecret ? config.maskedApiSecret : 'Enter API Secret'}
                  value={configForm.apiSecret}
                  onChange={(e) => setConfigForm({ ...configForm, apiSecret: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Webhook Secret */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Webhook HMAC Secret Key {config?.hasWebhookSecret && <span style={{ color: '#10B981', fontSize: '11px' }}>({config.maskedWebhookSecret})</span>}
              </label>
              <input
                type="password"
                placeholder={config?.hasWebhookSecret ? config.maskedWebhookSecret : 'Enter Webhook HMAC Secret'}
                value={configForm.webhookSecret}
                onChange={(e) => setConfigForm({ ...configForm, webhookSecret: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Used to cryptographically verify inbound status delivery webhooks.</span>
            </div>

            {/* Webhook Endpoint Box */}
            <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                Inbound Webhook Receiver URL:
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ fontSize: '12px', background: '#E2E8F0', padding: '6px 10px', borderRadius: '4px', flex: 1, color: '#0F172A' }}>
                  {window.location.origin}/api/v1/whatsapp/webhook
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/v1/whatsapp/webhook`);
                    setFeedback({ text: 'Webhook URL copied to clipboard.', type: 'success' });
                  }}
                  style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saveConfigLoading}
              style={{
                padding: '12px 24px',
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: saveConfigLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {saveConfigLoading ? 'Saving...' : '💾 Save WhatsApp Settings'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
