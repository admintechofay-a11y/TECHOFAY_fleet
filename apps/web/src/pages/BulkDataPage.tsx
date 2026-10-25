import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';

export const BulkDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'jobs'>('import');
  const [selectedEntity, setSelectedEntity] = useState<string>('loads');

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Export State
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exportFilterStatus, setExportFilterStatus] = useState('');
  const [exportSearch, setExportSearch] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Job History State
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Global Action Notification
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await apiRequest('/master/jobs?limit=25');
      setJobs(res.data || []);
    } catch (err: any) {
      console.error('Failed to load export jobs:', err.message);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'jobs') {
      fetchJobs();
    }
  }, [activeTab]);

  // Handle Download Blank/Sample Template
  const handleDownloadTemplate = () => {
    try {
      apiDownload(`/master/template/${selectedEntity}`, `${selectedEntity}_template.xlsx`);
      setFeedback({ text: `Downloaded ${selectedEntity} template successfully.`, type: 'success' });
    } catch (err: any) {
      setFeedback({ text: 'Failed to download template', type: 'error' });
    }
  };

  // Handle Dry-Run Validation
  const handleDryRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Please select an Excel (.xlsx) file to upload.');
      return;
    }

    setDryRunLoading(true);
    setImportError(null);
    setDryRunResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const res = await apiRequest(`/master/dry-run/${selectedEntity}`, {
        method: 'POST',
        body: formData
      });

      setDryRunResult(res.data);
      setFeedback({
        text: `Dry run finished: ${res.data.validRowsCount} valid rows, ${res.data.invalidRowsCount} issues detected.`,
        type: res.data.invalidRowsCount === 0 ? 'success' : 'error'
      });
    } catch (err: any) {
      setImportError(err.message || 'Dry-run validation failed.');
    } finally {
      setDryRunLoading(false);
    }
  };

  // Handle Confirm Commit
  const handleConfirmImport = async () => {
    if (!dryRunResult || !dryRunResult.validRecords || dryRunResult.validRecords.length === 0) {
      return;
    }

    setCommitLoading(true);
    try {
      const res = await apiRequest(`/master/confirm/${selectedEntity}`, {
        method: 'POST',
        body: JSON.stringify({
          batchId: dryRunResult.batchId,
          validRecords: dryRunResult.validRecords
        })
      });

      setFeedback({
        text: `Successfully committed ${res.data.importedCount} ${selectedEntity} records!`,
        type: 'success'
      });
      setDryRunResult(null);
      setImportFile(null);
    } catch (err: any) {
      setFeedback({ text: err.message || 'Import commit failed.', type: 'error' });
    } finally {
      setCommitLoading(false);
    }
  };

  // Handle Direct Streaming Export
  const handleDirectExport = () => {
    try {
      let q = `/master/export/${selectedEntity}?format=${exportFormat}`;
      if (exportFilterStatus) q += `&status=${encodeURIComponent(exportFilterStatus)}`;
      if (exportSearch) q += `&search=${encodeURIComponent(exportSearch)}`;

      apiDownload(q, `${selectedEntity}_export.${exportFormat}`);
      setFeedback({ text: `Generating and streaming ${selectedEntity} ${exportFormat.toUpperCase()} file...`, type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err.message || 'Export failed', type: 'error' });
    }
  };

  // Handle Async Export Job
  const handleCreateExportJob = async () => {
    setExportLoading(true);
    try {
      const payload = {
        entityType: selectedEntity,
        format: exportFormat,
        filters: { status: exportFilterStatus, search: exportSearch }
      };

      const res = await apiRequest('/master/jobs/export', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setFeedback({ text: `Export job #${res.data._id.slice(-6)} created and queued for processing!`, type: 'success' });
      setActiveTab('jobs');
      fetchJobs();
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to create export job', type: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              Bulk Data & Excel Operations Hub
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600
              }}
            >
              Phase 6
            </span>
          </div>
          <p style={{ color: '#94a3b8', marginTop: '0.35rem', fontSize: '0.875rem' }}>
            Two-stage batch imports with live error auditing, versioned templates, and formula-injection-sanitized Excel & CSV exports.
          </p>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#4ade80' : '#f87171'
          }}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem'
        }}
      >
        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'import' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'import' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'import' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>📥</span> Two-Stage Bulk Import
        </button>

        <button
          onClick={() => setActiveTab('export')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'export' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'export' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'export' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>📤</span> Universal Export Center
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          style={{
            padding: '0.75rem 1.25rem',
            background: activeTab === 'jobs' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'jobs' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'jobs' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>⚙️</span> Export Jobs & Download History
        </button>
      </div>

      {/* TAB 1: TWO-STAGE BULK IMPORT */}
      {activeTab === 'import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem' }}>
          {/* Controls Card */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Import Configuration</h3>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Select Target Entity *
              </label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  setDryRunResult(null);
                  setImportFile(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="loads">Consignment Loads</option>
                <option value="customers">Customers & Parties</option>
                <option value="locations">Locations & Hubs</option>
                <option value="vehicles">Fleet Vehicles</option>
                <option value="drivers">Drivers</option>
              </select>
            </div>

            {/* Template Download Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Official Spreadsheet Template
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Contains correct headers, validation rules, and sample records for {selectedEntity}.
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📄 Download {selectedEntity} Template (.xlsx)
              </button>
            </div>

            {/* Upload File Form */}
            <form onSubmit={handleDryRun}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Upload Excel Workbook (.xlsx) *
                </label>
                <input
                  type="file"
                  required
                  accept=".xlsx"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px dashed var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {importError && (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    marginBottom: '1rem'
                  }}
                >
                  ⚠️ {importError}
                </div>
              )}

              <button
                type="submit"
                disabled={dryRunLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {dryRunLoading ? 'Auditing Workbook...' : 'Step 1: Dry-Run Validate 🔍'}
              </button>
            </form>
          </div>

          {/* Results & Commit Stage */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {!dryRunResult ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Awaiting Dry-Run Execution</h4>
                <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0.5rem auto', color: 'var(--text-secondary)' }}>
                  Upload an Excel workbook on the left and run Dry-Run Validate to see a row-level audit before inserting any data into the database.
                </p>
              </div>
            ) : (
              <div>
                {/* Metric Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Processed Rows</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      {dryRunResult.totalRows}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valid Records Ready</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a36a', marginTop: '0.25rem' }}>
                      {dryRunResult.validRowsCount}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Row Errors Detected</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                      {dryRunResult.invalidRowsCount}
                    </div>
                  </div>
                </div>

                {/* Errors Table */}
                {dryRunResult.errors && dryRunResult.errors.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>
                      Validation Error Log ({dryRunResult.errors.length} issues)
                    </h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#ffffff', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#fef2f2', color: 'var(--text-secondary)', borderBottom: '1px solid #fee2e2' }}>
                            <th style={{ padding: '0.5rem' }}>Row #</th>
                            <th style={{ padding: '0.5rem' }}>Field</th>
                            <th style={{ padding: '0.5rem' }}>Invalid Value</th>
                            <th style={{ padding: '0.5rem' }}>Failure Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dryRunResult.errors.map((err: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.5rem', fontWeight: 700, color: '#dc2626' }}>{err.rowNumber}</td>
                              <td style={{ padding: '0.5rem', color: 'var(--accent-cyan)' }}>{err.field}</td>
                              <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{String(err.value || '-')}</td>
                              <td style={{ padding: '0.5rem', color: '#b91c1c' }}>{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Valid Records Preview */}
                {dryRunResult.validRecords && dryRunResult.validRecords.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#16a36a' }}>
                        Valid Records Preview ({dryRunResult.validRecords.length} records ready)
                      </h4>
                      <button
                        onClick={handleConfirmImport}
                        disabled={commitLoading}
                        style={{
                          padding: '0.55rem 1.25rem',
                          borderRadius: '8px',
                          background: '#10b981',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {commitLoading ? 'Committing...' : 'Step 2: Confirm & Commit Import 🚀'}
                      </button>
                    </div>

                    <div style={{ maxHeight: '220px', overflowY: 'auto', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                      <pre style={{ margin: 0, padding: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {JSON.stringify(dryRunResult.validRecords.slice(0, 5), null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UNIVERSAL EXPORT CENTER */}
      {activeTab === 'export' && (
        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '2rem', maxWidth: '850px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Universal Export Center</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
            Export operational datasets formatted for spreadsheets with automatic CSV formula injection sanitization.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Dataset / Entity *
              </label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="loads">Loads & Freight Orders</option>
                <option value="trips">Trips & Route Settlements</option>
                <option value="bilties">Bilties (Consignment Notes)</option>
                <option value="lr">Lorry Receipts (LR Numbers)</option>
                <option value="pod">Proof of Delivery (POD)</option>
                <option value="vehicles">Fleet Vehicles Registry</option>
                <option value="drivers">Drivers Registry</option>
                <option value="customers">Customers & Parties</option>
                <option value="locations">Locations & Depots</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Export File Format *
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="xlsx">Microsoft Excel (.xlsx)</option>
                <option value="csv">Standard CSV (.csv)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Status Filter (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. IN_TRANSIT, DELIVERED, CLOSED"
                value={exportFilterStatus}
                onChange={(e) => setExportFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Search Keyword (Optional)
              </label>
              <input
                type="text"
                placeholder="Search across references..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCreateExportJob}
              disabled={exportLoading}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                background: '#f1f5f9',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {exportLoading ? 'Creating Job...' : 'Background Async Job ⏳'}
            </button>
            <button
              onClick={handleDirectExport}
              style={{
                padding: '0.75rem 1.75rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
              }}
            >
              Direct Instant Download ⚡
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: JOBS & DOWNLOAD HISTORY */}
      {activeTab === 'jobs' && (
        <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Export & Import Activity History</h3>
            <button
              onClick={fetchJobs}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid var(--border-medium)',
                color: 'var(--accent-cyan)',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh Status
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Job ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Entity</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Format</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Records</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Loading job records...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No export jobs recorded yet. Initiate an export above!
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job._id} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                        #{job._id.slice(-8)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize' }}>{job.entityType}</td>
                      <td style={{ padding: '0.85rem 1rem', textTransform: 'uppercase' }}>{job.format}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>{job.totalRecords || 0} rows</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontWeight: 600,
                            background: job.status === 'COMPLETED' ? 'rgba(22, 163, 106, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            color: job.status === 'COMPLETED' ? '#16a36a' : '#d97706'
                          }}
                        >
                          ● {job.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {new Date(job.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {job.status === 'COMPLETED' && (
                          <button
                            onClick={() => apiDownload(`/master/jobs/${job._id}/download`, job.fileName || `export.${job.format}`)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              background: '#0284c7',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ⬇️ Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
