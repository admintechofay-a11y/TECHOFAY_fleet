import React, { useState, useEffect } from 'react';
import { apiRequest, apiDownload } from '../lib/api';
import { ExcelImportModal } from '../components/ExcelImportModal';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [partyType, setPartyType] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    partyType: 'CUSTOMER',
    gstin: '',
    pan: '',
    primaryContact: { name: '', phone: '', email: '' },
    billingAddress: { street: '', city: '', state: '', pincode: '' },
    paymentTermsDays: 30
  });

  const fetchCustomers = async (page = 1) => {
    setLoading(true);
    setFetchError(null);
    try {
      let q = `/customers?page=${page}&limit=10`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (partyType) q += `&partyType=${partyType}`;

      const res = await apiRequest(q);
      setCustomers(res.data.items || []);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load customer accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
  }, [search, partyType]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Please enter a party / company name.');
      setFormLoading(false);
      return;
    }

    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      setFormData({
        name: '',
        code: '',
        partyType: 'CUSTOMER',
        gstin: '',
        pan: '',
        primaryContact: { name: '', phone: '', email: '' },
        billingAddress: { street: '', city: '', state: '', pincode: '' },
        paymentTermsDays: 30
      });
      fetchCustomers(1);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      await apiDownload(`/master/export/customers?format=${format}`, `customers_${Date.now()}.${format}`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await apiDownload('/master/template/customers', 'customers_template.xlsx');
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer & Party Registry</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Consignors, Consignees, and Billing Accounts with verified Indian GSTINs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            📥 Template
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 transition"
          >
            📊 Import Excel
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            📤 Export XLSX
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
          >
            + New Party
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search party name, GSTIN, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={partyType}
            onChange={(e) => setPartyType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Party Types</option>
            <option value="CUSTOMER">Customer</option>
            <option value="CONSIGNOR">Consignor</option>
            <option value="CONSIGNEE">Consignee</option>
            <option value="TRANSPORTER">Transporter</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Party Name & Code</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">GSTIN & PAN</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading customer accounts...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-red-400">
                    <div className="mb-2 font-semibold">⚠️ {fetchError}</div>
                    <button onClick={() => fetchCustomers(1)} className="btn btn-secondary text-xs">
                      🔄 Retry
                    </button>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No customers found matching filters.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{c.name}</div>
                      {c.code && <div className="text-[11px] text-slate-400 font-mono">{c.code}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {c.partyType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-200">{c.gstin || 'Unregistered'}</div>
                      {c.pan && <div className="text-[10px] text-slate-500 font-mono">PAN: {c.pan}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div>{c.primaryContact?.name || '-'}</div>
                      <div className="text-slate-400">{c.primaryContact?.phone || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{c.billingAddress?.city || '-'}</div>
                      <div className="text-slate-400">{c.billingAddress?.state || ''}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {c.paymentTermsDays} Days
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        c.isActive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                      }`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>Total: {pagination.total} parties</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchCustomers(pagination.page - 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="py-1 px-2 font-mono text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchCustomers(pagination.page + 1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create Customer / Party</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-red-950 border border-red-800 text-red-200 text-xs rounded">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adani Logistics Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CUST-ADANI"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Party Type</label>
                  <select
                    value={formData.partyType}
                    onChange={(e) => setFormData({ ...formData, partyType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="CONSIGNOR">Consignor</option>
                    <option value="CONSIGNEE">Consignee</option>
                    <option value="TRANSPORTER">Transporter</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">GSTIN (15 chars)</label>
                  <input
                    type="text"
                    placeholder="24AAACA1234A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">PAN</label>
                  <input
                    type="text"
                    placeholder="AAACA1234A"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={formData.primaryContact.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primaryContact: { ...formData.primaryContact, name: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={formData.primaryContact.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primaryContact: { ...formData.primaryContact, phone: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">Billing Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={formData.billingAddress.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billingAddress: { ...formData.billingAddress, city: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.billingAddress.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billingAddress: { ...formData.billingAddress, state: e.target.value }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {formLoading ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        entityType="customers"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchCustomers(1)}
      />
    </div>
  );
};
