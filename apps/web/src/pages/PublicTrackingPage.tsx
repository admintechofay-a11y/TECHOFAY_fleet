import React, { useState, useEffect } from 'react';
import { RouteMap, Waypoint } from '../components/RouteMap';

interface Milestone {
  code: string;
  title: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  timestamp: string | null;
}

interface TrackingData {
  trackingNumber: string;
  lrNumber: string | null;
  biltyNumber: string | null;
  loadNumber: string;
  tripNumber: string | null;
  currentStatus: string;
  statusLabel: string;
  materialType: string;
  totalQuantity: number;
  totalWeightMt: number;
  parties: {
    consignor: string;
    consignee: string;
  };
  vehicle: {
    type: string;
    maskedPlateNumber: string;
  };
  pickupDate: string | null;
  expectedDeliveryDate: string | null;
  milestones: Milestone[];
  waypoints: Waypoint[];
  podVerified: boolean;
  podNumber: string | null;
  podReceiver: string | null;
  lastUpdated: string;
}

export const PublicTrackingPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);

  // Check URL path or query params for pre-filled tracking number
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const identifierFromPath = pathParts.length > 2 && pathParts[1] === 'track' ? pathParts[2] : null;
    const searchParams = new URLSearchParams(window.location.search);
    const identifierFromQuery = searchParams.get('q') || searchParams.get('lr') || searchParams.get('load');

    const initialId = identifierFromPath || identifierFromQuery;
    if (initialId) {
      setSearchInput(initialId);
      performTrackingLookup(initialId);
    }
  }, []);

  const performTrackingLookup = async (id: string) => {
    if (!id.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/public/track/${encodeURIComponent(id.trim())}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Consignment record not found.');
      }

      setTrackingData(json.data);
    } catch (err: any) {
      setError(err.message || 'Unable to track consignment. Please verify the tracking number.');
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.history.pushState({}, '', `/track/${encodeURIComponent(searchInput.trim())}`);
      performTrackingLookup(searchInput.trim());
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'IN_TRANSIT':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'PARTIALLY_DELIVERED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'VEHICLE_ASSIGNED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Public Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">Techofay</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Track & Trace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium">
            <a href="/contact" className="text-slate-600 hover:text-blue-600 transition-colors">
              Help & Support
            </a>
            <a
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all text-xs font-semibold"
            >
              Operator Portal Login
            </a>
          </div>
        </div>
      </header>

      {/* Hero Search Section */}
      <section className="bg-gradient-to-b from-slate-100 to-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-slate-900">
            Track Consignment & Freight Waypoints
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto mb-8">
            Real-time milestone visibility for Consignors and Consignees across Indian logistics corridors. Enter your LR, Bilty, or Load number.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Enter LR # (e.g. LR-2026-0001) or Bilty / Load #"
                className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Track Status</span>
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Error Notification */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3 mb-8 shadow-sm">
            <svg className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-sm">Tracking Notice</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Tracking Details View */}
        {trackingData && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Status Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Consignment Tracking Record
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className="text-xl font-bold text-slate-900">
                      {trackingData.lrNumber || trackingData.biltyNumber || trackingData.loadNumber}
                    </h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${getStatusBadgeClass(trackingData.currentStatus)}`}>
                      {trackingData.statusLabel}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  <div>Load Reference: <span className="font-semibold text-slate-700">{trackingData.loadNumber}</span></div>
                  {trackingData.tripNumber && (
                    <div>Trip Reference: <span className="font-semibold text-slate-700">{trackingData.tripNumber}</span></div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-400">
                    Live Status As of {new Date(trackingData.lastUpdated).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Parties & Cargo Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-sm">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Consignor</span>
                  <span className="font-semibold text-slate-800">{trackingData.parties.consignor}</span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Consignee</span>
                  <span className="font-semibold text-slate-800">{trackingData.parties.consignee}</span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Commodity / Material</span>
                  <span className="font-semibold text-slate-800">{trackingData.materialType}</span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {trackingData.totalQuantity} Units • {trackingData.totalWeightMt} MT
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Assigned Vehicle</span>
                  <span className="font-semibold text-slate-800">{trackingData.vehicle.maskedPlateNumber}</span>
                  <span className="text-xs text-slate-500 block mt-0.5">{trackingData.vehicle.type}</span>
                </div>
              </div>
            </div>

            {/* Milestones Horizontal Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Transit Progress & Checkpoints</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 relative">
                {trackingData.milestones.map((m, idx) => {
                  const isDone = m.status === 'COMPLETED';
                  const isInProgress = m.status === 'IN_PROGRESS';

                  return (
                    <div
                      key={m.code}
                      className={`relative p-4 rounded-xl border transition-all ${
                        isDone
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                          : isInProgress
                          ? 'bg-sky-50 border-sky-300 text-slate-800 shadow-sm ring-2 ring-sky-200'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isInProgress
                            ? 'bg-sky-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {isDone ? '✓' : idx + 1}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInProgress
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">{m.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2">{m.description}</p>
                      {m.timestamp && (
                        <div className="mt-3 text-[10px] font-medium text-slate-500 border-t border-slate-200/60 pt-2">
                          {new Date(m.timestamp).toLocaleDateString()} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Route Map */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Geographical Route & Hub Trajectory</span>
              </h3>

              <RouteMap waypoints={trackingData.waypoints} currentStatus={trackingData.currentStatus} height={380} />
            </div>

            {/* Waypoints Breakdown Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                Stop-Wise Hub Log & Offload Quantities
              </h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Seq</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Stop Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Logistics Hub</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">City & State</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Allocated</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Delivered</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {trackingData.waypoints.map(wp => (
                      <tr key={wp.sequence} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-700">{wp.sequence}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            wp.stopType === 'PICKUP' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {wp.stopType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{wp.locationName}</td>
                        <td className="px-4 py-3 text-slate-600">{wp.city}, {wp.state}</td>
                        <td className="px-4 py-3 text-slate-700">{wp.allocatedQuantity} units</td>
                        <td className="px-4 py-3 font-medium text-emerald-700">{wp.deliveredQuantity} units</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            wp.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {wp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verified POD Card (if signed off) */}
            {trackingData.podVerified && (
              <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Verified Proof of Delivery (POD)</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Receipt authenticated by Supervisor • Received by: <span className="font-semibold text-slate-800">{trackingData.podReceiver}</span> (Ref: {trackingData.podNumber})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                    Officially Verified
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Techofay Fleet & Transport Platform. Consignment Tracking Portal.</p>
          <div className="flex items-center gap-4 font-medium">
            <a href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="/contact" className="hover:text-blue-600 transition-colors">Contact Support</a>
            <a href="/login" className="hover:text-blue-600 transition-colors">Portal Login</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
