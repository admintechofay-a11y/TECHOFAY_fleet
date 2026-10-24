import React, { useMemo } from 'react';

export interface Waypoint {
  sequence: number;
  stopType: string;
  locationName: string;
  city: string;
  state: string;
  status: string;
  allocatedQuantity?: number;
  deliveredQuantity?: number;
  coordinates: {
    lat: number;
    lng: number;
    source?: string;
  };
}

interface RouteMapProps {
  waypoints: Waypoint[];
  currentStatus?: string;
  height?: number | string;
  className?: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  waypoints = [],
  currentStatus = 'IN_TRANSIT',
  height = 360,
  className = ''
}) => {
  // If no waypoints or single waypoint with zero coords, show placeholder
  const validWaypoints = useMemo(() => {
    return waypoints.filter(
      w => w.coordinates && typeof w.coordinates.lat === 'number' && typeof w.coordinates.lng === 'number'
    );
  }, [waypoints]);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 400;
  const padding = 60;

  // Calculate bounding box and projection coordinates
  const { points, polylinePoints, transitPosition } = useMemo(() => {
    if (validWaypoints.length === 0) {
      return { points: [], polylinePoints: '', transitPosition: null };
    }

    const lats = validWaypoints.map(w => w.coordinates.lat);
    const lngs = validWaypoints.map(w => w.coordinates.lng);

    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Expand bounding box slightly if coords are too close
    const latSpan = Math.max(0.2, maxLat - minLat);
    const lngSpan = Math.max(0.2, maxLng - minLng);

    minLat -= latSpan * 0.15;
    maxLat += latSpan * 0.15;
    minLng -= lngSpan * 0.15;
    maxLng += lngSpan * 0.15;

    const mapped = validWaypoints.map((w, idx) => {
      // Mercator-like 2D projection
      const x = padding + ((w.coordinates.lng - minLng) / (maxLng - minLng)) * (svgWidth - 2 * padding);
      // Invert Y for SVG coordinates (latitude increases upwards)
      const y = (svgHeight - padding) - ((w.coordinates.lat - minLat) / (maxLat - minLat)) * (svgHeight - 2 * padding);
      return { ...w, x, y, idx };
    });

    const polylineStr = mapped.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Calculate in-transit estimated vehicle position along route
    let transitPos = null;
    if (mapped.length >= 2) {
      let progressRatio = 0.5; // default mid-route
      if (currentStatus === 'DELIVERED') progressRatio = 1.0;
      else if (currentStatus === 'BOOKED' || currentStatus === 'VEHICLE_ASSIGNED') progressRatio = 0.05;
      else if (currentStatus === 'PARTIALLY_DELIVERED') progressRatio = 0.75;

      const origin = mapped[0];
      const destination = mapped[mapped.length - 1];
      transitPos = {
        x: origin.x + (destination.x - origin.x) * progressRatio,
        y: origin.y + (destination.y - origin.y) * progressRatio
      };
    }

    return { points: mapped, polylinePoints: polylineStr, transitPosition: transitPos };
  }, [validWaypoints, currentStatus]);

  if (validWaypoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-sm p-8 ${className}`}
        style={{ height }}
      >
        No route waypoint coordinates available for visual mapping.
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-inner ${className}`}
      style={{ height }}
    >
      {/* Top Map Bar / Status Indicator */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-medium text-slate-200">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Interactive Route Trajectory • {validWaypoints.length} Logistics Hubs</span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle Grid Pattern */}
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
          </pattern>

          {/* Polyline Route Gradient */}
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Map Background Grid */}
        <rect width="100%" height="100%" fill="url(#gridPattern)" />

        {/* Ambient Topographic Lines */}
        <path
          d="M 50 350 Q 250 150 450 300 T 750 100"
          fill="none"
          stroke="rgba(255, 255, 255, 0.025)"
          strokeWidth="3"
        />
        <path
          d="M 30 200 Q 200 380 500 180 T 780 280"
          fill="none"
          stroke="rgba(255, 255, 255, 0.025)"
          strokeWidth="2"
        />

        {/* Route Connecting Glow */}
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
            filter="url(#glow)"
          />
        )}

        {/* Main Route Polyline */}
        {polylinePoints && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* In-Transit Vehicle Checkpoint Indicator */}
        {transitPosition && currentStatus !== 'DELIVERED' && (
          <g transform={`translate(${transitPosition.x}, ${transitPosition.y})`}>
            {/* Radar Pulsing Circle */}
            <circle r="18" fill="#38bdf8" opacity="0.25">
              <animate attributeName="r" values="8;24;8" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2.4s" repeatCount="indefinite" />
            </circle>
            {/* Core Vehicle Beacon */}
            <circle r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
            <text
              y="-12"
              textAnchor="middle"
              className="fill-sky-300 font-bold text-[10px] tracking-wide uppercase filter drop-shadow"
            >
              🚚 En Route
            </text>
          </g>
        )}

        {/* Waypoint Hub Markers */}
        {points.map((p, index) => {
          const isOrigin = index === 0;
          const isDestination = index === points.length - 1;
          const isCompleted = p.status === 'COMPLETED';

          let pinColor = '#f59e0b'; // Amber for intermediate stops
          let pinLabel = `${index + 1}`;
          if (isOrigin) {
            pinColor = '#10b981'; // Emerald for Origin
            pinLabel = 'A';
          } else if (isDestination) {
            pinColor = '#3b82f6'; // Blue for Destination
            pinLabel = 'B';
          }

          return (
            <g key={p.sequence || index} transform={`translate(${p.x}, ${p.y})`}>
              {/* Pin Base Circle */}
              <circle
                r="11"
                fill={pinColor}
                stroke="#0f172a"
                strokeWidth="2.5"
                className="transition-transform hover:scale-125 cursor-pointer"
              />
              {/* Pin Text Label */}
              <text
                textAnchor="middle"
                dy="3.5"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                className="select-none pointer-events-none"
              >
                {pinLabel}
              </text>

              {/* Hub City & Name Label Card */}
              <g transform="translate(0, 20)">
                <rect
                  x="-55"
                  y="-2"
                  width="110"
                  height="22"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  dy="12"
                  fill="#f8fafc"
                  fontSize="9.5"
                  fontWeight="600"
                  className="select-none"
                >
                  {p.city || p.locationName}
                </text>
              </g>

              {/* Status Badge */}
              {isCompleted && (
                <circle cx="8" cy="-8" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Map Legend (Bottom Right) */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-800 text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Origin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Waypoints</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>Destination</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
          <span>Vehicle Position</span>
        </div>
      </div>
    </div>
  );
};
