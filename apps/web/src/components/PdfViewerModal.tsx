import React, { useState, useEffect, useRef } from 'react';
import { apiFetchBlob } from '../lib/api';

export interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  endpoint: string; // e.g. /lr/:id/pdf, /bilties/:id/pdf, /maintenance/:id/job-card
  documentNumber?: string;
  defaultCopy?: 'ORIGINAL' | 'CONSIGNOR' | 'CONSIGNEE' | 'DRIVER' | 'TRANSPORTER';
  allowCopySwitch?: boolean;
  whatsappPhone?: string;
}

const COPY_TYPES = [
  { id: 'ORIGINAL', label: 'Original', badgeColor: '#0284c7' },
  { id: 'CONSIGNOR', label: 'Consignor Copy', badgeColor: '#059669' },
  { id: 'CONSIGNEE', label: 'Consignee Copy', badgeColor: '#d97706' },
  { id: 'DRIVER', label: 'Driver Copy', badgeColor: '#dc2626' },
  { id: 'TRANSPORTER', label: 'Transporter Copy', badgeColor: '#4f46e5' },
];

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  endpoint,
  documentNumber = 'DOC',
  defaultCopy = 'ORIGINAL',
  allowCopySwitch = true,
  whatsappPhone = ''
}) => {
  const [selectedCopy, setSelectedCopy] = useState<string>(defaultCopy);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('document.pdf');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Synchronize defaultCopy when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedCopy(defaultCopy);
    }
  }, [isOpen, defaultCopy]);

  // Load PDF Blob whenever endpoint or selectedCopy changes
  useEffect(() => {
    if (!isOpen || !endpoint) return;

    let active = true;
    let createdUrl: string | null = null;

    async function loadPdf() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const separator = endpoint.includes('?') ? '&' : '?';
        const urlToFetch = allowCopySwitch ? `${endpoint}${separator}copy=${selectedCopy}` : endpoint;
        const fallbackName = `${documentNumber}_${selectedCopy}.pdf`;

        const { blob, filename } = await apiFetchBlob(urlToFetch, fallbackName);

        if (!active) return;

        createdUrl = window.URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) window.URL.revokeObjectURL(prev);
          return createdUrl;
        });
        setCurrentFilename(filename);
      } catch (err: any) {
        if (!active) return;
        setErrorMessage(err.message || 'Failed to render PDF document. Please try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      active = false;
      if (createdUrl) {
        window.URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, endpoint, selectedCopy, allowCopySwitch, documentNumber]);

  // Clean up blob URL when modal closes
  useEffect(() => {
    if (!isOpen && blobUrl) {
      window.URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        // Fallback below
      }
    }
    if (blobUrl) {
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWhatsAppShare = () => {
    const cleanPhone = (whatsappPhone || '').replace(/\D/g, '');
    const phoneSegment = cleanPhone ? `${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}` : '';
    const text = encodeURIComponent(
      `Hello, please find official transport document for ${title} (${documentNumber}). Copy: ${selectedCopy}.\nIssued by Technofay Global Logistics Operating System.`
    );
    const waUrl = phoneSegment 
      ? `https://api.whatsapp.com/send?phone=${phoneSegment}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? '0' : '1.5rem',
      }}
    >
      <div
        style={{
          width: isFullscreen ? '100vw' : '94vw',
          maxWidth: isFullscreen ? '100vw' : '1080px',
          height: isFullscreen ? '100vh' : '90vh',
          backgroundColor: '#0f172a',
          borderRadius: isFullscreen ? '0' : '14px',
          border: isFullscreen ? 'none' : '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Title & Document Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#38bdf8'
              }}
            >
              📄
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {title}
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    letterSpacing: '0.5px'
                  }}
                >
                  GST RCM / 9965
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                Doc Ref: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{documentNumber}</span> • Carriage by Road Act 2007 Verified
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              disabled={isLoading || !blobUrl}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 0.85rem',
                opacity: isLoading || !blobUrl ? 0.6 : 1
              }}
              title="Print document directly"
            >
              🖨️ Print
            </button>

            <button
              onClick={handleDownload}
              disabled={isLoading || !blobUrl}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 0.85rem',
                opacity: isLoading || !blobUrl ? 0.6 : 1
              }}
              title="Download signed PDF file"
            >
              📥 Download
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.45rem 0.85rem',
                backgroundColor: 'rgba(37, 211, 102, 0.1)',
                borderColor: '#25d366',
                color: '#25d366'
              }}
              title="Share document details via WhatsApp"
            >
              💬 WhatsApp
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="btn btn-ghost"
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '0.45rem 0.75rem', fontSize: '1rem', color: '#94a3b8' }}
              title="Close viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Copy Type Selection Sub-header (when enabled) */}
        {allowCopySwitch && (
          <div
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#111827',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginRight: '4px' }}>
                COPY TYPE:
              </span>
              {COPY_TYPES.map((copy) => {
                const isSelected = selectedCopy === copy.id;
                return (
                  <button
                    key={copy.id}
                    onClick={() => setSelectedCopy(copy.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected ? `1.5px solid ${copy.badgeColor}` : '1px solid #334155',
                      backgroundColor: isSelected ? 'rgba(30, 41, 59, 0.95)' : '#0f172a',
                      color: isSelected ? copy.badgeColor : '#94a3b8',
                      boxShadow: isSelected ? `0 0 10px ${copy.badgeColor}33` : 'none',
                    }}
                  >
                    {copy.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Viewing: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{selectedCopy} COPY</span>
            </div>
          </div>
        )}

        {/* Document Body / Live Iframe Viewer */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(2, 6, 23, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                zIndex: 10
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #334155',
                  borderTopColor: '#38bdf8',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Rendering official vector PDF ({selectedCopy} COPY)...
              </span>
            </div>
          )}

          {errorMessage ? (
            <div
              style={{
                padding: '2rem',
                maxWidth: '480px',
                textAlign: 'center',
                backgroundColor: '#1e293b',
                borderRadius: '10px',
                border: '1px solid #dc2626',
                color: '#f8fafc'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f87171' }}>Unable to load PDF document</h4>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                {errorMessage}
              </p>
              <button
                onClick={() => setSelectedCopy((c) => c)}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
              >
                🔄 Retry Loading
              </button>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#334155'
              }}
            />
          ) : null}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#1e293b',
            borderTop: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#64748b'
          }}
        >
          <div>
            Carrier Standard: <strong>Carriage by Road Act 2007</strong> • Digital Document System
          </div>
          <div>
            Technofay Fleet OS • In-Browser Vector Rendering
          </div>
        </div>
      </div>
    </div>
  );
};
