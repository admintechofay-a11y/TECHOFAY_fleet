import React, { useState } from 'react';
import { apiRequest } from '../lib/api';

interface ExcelImportModalProps {
  entityType: 'customers' | 'locations' | 'vehicles' | 'drivers';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  entityType,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setDryRunResult(null);
      setError(null);
      setImportSuccessMsg(null);
    }
  };

  const handleDryRun = async () => {
    if (!file) {
      setError('Please select an Excel (.xlsx) file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest(`/master/dry-run/${entityType}`, {
        method: 'POST',
        body: formData
      });

      setDryRunResult(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!dryRunResult || !dryRunResult.validRecords || dryRunResult.validRecords.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/master/confirm/${entityType}`, {
        method: 'POST',
        body: JSON.stringify({
          batchId: dryRunResult.batchId,
          validRecords: dryRunResult.validRecords
        })
      });

      setImportSuccessMsg(res.data.message || `Imported ${res.data.importedCount} records successfully.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to complete import.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white capitalize">
              Import {entityType} via Excel
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Dry-run preview and row-level error validation before committing to database
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg">
            {error}
          </div>
        )}

        {importSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-sm font-semibold rounded-lg flex items-center gap-2">
            <span>✔</span> {importSuccessMsg}
          </div>
        )}

        {!dryRunResult && !importSuccessMsg && (
          <div className="mt-6 space-y-4">
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-950/50 hover:border-blue-500/50 transition">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <span className="text-3xl mb-2">📊</span>
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : 'Choose an Excel file (.xlsx)'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Drag and drop or click to browse
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDryRun}
                disabled={!file || loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
              >
                {loading ? 'Analyzing Sheet...' : 'Analyze & Preview (Dry Run)'}
              </button>
            </div>
          </div>
        )}

        {dryRunResult && !importSuccessMsg && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400">Total Rows</span>
                <p className="text-lg font-bold text-white">{dryRunResult.totalRows}</p>
              </div>
              <div className="bg-emerald-950/50 p-3 rounded-lg border border-emerald-800">
                <span className="text-xs text-emerald-400">Valid Rows</span>
                <p className="text-lg font-bold text-emerald-300">{dryRunResult.validCount}</p>
              </div>
              <div className="bg-red-950/50 p-3 rounded-lg border border-red-800">
                <span className="text-xs text-red-400">Errors</span>
                <p className="text-lg font-bold text-red-300">{dryRunResult.invalidCount}</p>
              </div>
            </div>

            {/* Error Table if any */}
            {dryRunResult.errors && dryRunResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  Row-Level Validation Errors ({dryRunResult.errors.length})
                </h4>
                <div className="border border-red-900/60 rounded-lg overflow-x-auto max-h-48 bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-red-950/40 text-red-300 border-b border-red-900/50 sticky top-0">
                      <tr>
                        <th className="p-2">Row #</th>
                        <th className="p-2">Field</th>
                        <th className="p-2">Provided Value</th>
                        <th className="p-2">Correction Guidance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {dryRunResult.errors.map((err: any, i: number) => (
                        <tr key={i} className="hover:bg-red-950/20">
                          <td className="p-2 font-mono text-slate-400">{err.rowNumber}</td>
                          <td className="p-2 font-semibold text-slate-200">{err.field}</td>
                          <td className="p-2 text-slate-400 font-mono">{String(err.value || '-')}</td>
                          <td className="p-2 text-red-300">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Preview of Valid Records */}
            {dryRunResult.validCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Preview of Valid Rows Ready to Commit ({dryRunResult.validCount})
                </h4>
                <div className="border border-slate-700 rounded-lg overflow-x-auto max-h-40 bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-300 sticky top-0">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Primary Identifier</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {dryRunResult.preview.map((rec: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-900">
                          <td className="p-2 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2 font-semibold text-emerald-300">
                            {rec.name || rec.plateNumber || rec.licenseNumber}
                          </td>
                          <td className="p-2 text-slate-400">
                            {rec.partyType || rec.vehicleType || rec.licenseType || rec.locationType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDryRunResult(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                ← Back to File Upload
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={dryRunResult.validCount === 0 || loading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {loading
                    ? 'Importing...'
                    : `Confirm Import (${dryRunResult.validCount} Records)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
