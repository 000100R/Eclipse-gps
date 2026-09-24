import { FriendRelation, FriendLocation } from '../../services/realtime/friendsService';

export interface FriendLocationStatus {
  status: 'live' | 'stale' | 'offline';
  label: string;
  relativeTime: string;
  timeString: string;
  color: string;
  borderColor: string;
  bgColor: string;
  isLive: boolean;
  isStale: boolean;
  isOffline: boolean;
}

/**
 * Calculates staleness and friendly display labels for a location timestamp.
 * - < 120s: Live GPS
 * - 120s - 900s: Stale (idle / no recent movement)
 * - >= 900s: Offline / inactive
 */
export const getFriendLocationStatus = (timestampMs: number): FriendLocationStatus => {
  const now = Date.now();
  const ageMs = Math.max(0, now - timestampMs);

  const date = new Date(timestampMs);
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let relativeTime = 'Just now';
  const ageSec = Math.floor(ageMs / 1000);
  if (ageSec < 60) {
    relativeTime = 'Just now';
  } else if (ageSec < 3600) {
    const mins = Math.floor(ageSec / 60);
    relativeTime = `${mins}m ago`;
  } else if (ageSec < 86400) {
    const hours = Math.floor(ageSec / 3600);
    relativeTime = `${hours}h ago`;
  } else {
    const days = Math.floor(ageSec / 86400);
    relativeTime = `${days}d ago`;
  }

  if (ageMs < 120000) {
    return {
      status: 'live',
      label: 'Live GPS',
      relativeTime,
      timeString,
      color: '#10b981', // Emerald
      borderColor: '#059669',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      isLive: true,
      isStale: false,
      isOffline: false,
    };
  } else if (ageMs < 900000) {
    return {
      status: 'stale',
      label: 'Stale Location',
      relativeTime,
      timeString,
      color: '#f59e0b', // Amber
      borderColor: '#d97706',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      isLive: false,
      isStale: true,
      isOffline: false,
    };
  } else {
    return {
      status: 'offline',
      label: 'Offline / Inactive',
      relativeTime,
      timeString,
      color: '#94a3b8', // Slate / Gray
      borderColor: '#64748b',
      bgColor: 'rgba(148, 163, 184, 0.15)',
      isLive: false,
      isStale: false,
      isOffline: true,
    };
  }
};

/**
 * Builds an SVG Data URL marker pin specifically designed for Friends.
 * Distinct from user GPS blue dot and pandal red pins:
 * - 44x52 teardrop with bottom indicator point
 * - Emerald halo (Live), Amber halo (Stale), or Slate halo (Offline)
 * - Avatar center (initials or photo)
 * - Top-right status dot
 */
export const buildFriendMarkerSvg = (
  friend: FriendRelation,
  statusInfo: FriendLocationStatus
): string => {
  const initials = (friend.friendName || 'FR')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
      <defs>
        <filter id="f-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <!-- Dedicated Friend Pin Base (Distinct Teardrop) -->
      <path d="M 23 51 C 23 51 8 36 8 21 C 8 11.8 14.7 4 23 4 C 31.3 4 38 11.8 38 21 C 38 36 23 51 23 51 Z"
            fill="#09090b" stroke="${statusInfo.color}" stroke-width="2.5" filter="url(#f-shadow)"/>
      <!-- Inner Dark Disc -->
      <circle cx="23" cy="21" r="13" fill="#18181b"/>
      <!-- Avatar Initials -->
      <text x="23" y="25" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#f4f4f5" text-anchor="middle">
        ${encodeURIComponent(initials)}
      </text>
      <!-- Status Badge Dot -->
      <circle cx="33" cy="11" r="4.5" fill="${statusInfo.color}" stroke="#09090b" stroke-width="1.5"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${svgContent}`;
};

/**
 * Builds HTML card content for Google Maps InfoWindow and Leaflet Popups.
 */
export const buildFriendPopupHtml = (
  friend: FriendRelation,
  loc: FriendLocation,
  statusInfo: FriendLocationStatus
): string => {
  const initials = (friend.friendName || 'FR')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const photoHtml = friend.friendPhotoUrl
    ? `<img src="${friend.friendPhotoUrl}" alt="${friend.friendName}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${statusInfo.color};"/>`
    : `<div style="width:36px;height:36px;border-radius:50%;background:#27272a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;border:2px solid ${statusInfo.color};">${initials}</div>`;

  const statusPill = `
    <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${statusInfo.bgColor};color:${statusInfo.color};border:1px solid ${statusInfo.color}40;">
      <span style="width:6px;height:6px;border-radius:50%;background:${statusInfo.color};"></span>
      ${statusInfo.label} • ${statusInfo.relativeTime}
    </span>
  `;

  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#09090b;color:#f4f4f5;border-radius:12px;padding:12px;width:240px;box-shadow:0 12px 28px rgba(0,0,0,0.7);border:1px solid #27272a;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${photoHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;">
            ${friend.friendName}
          </div>
          <div style="font-family:monospace;font-size:11px;color:#818cf8;letter-spacing:0.04em;">
            ${friend.friendEclipseId || 'ECL-FRIEND'}
          </div>
        </div>
      </div>

      <div style="margin-bottom:8px;">
        ${statusPill}
      </div>

      <div style="background:#18181b;border-radius:8px;padding:6px 8px;font-size:11px;color:#a1a1aa;margin-bottom:10px;display:flex;flex-direction:column;gap:3px;">
        <div style="display:flex;justify-content:space-between;">
          <span>Last Updated:</span>
          <span style="color:#e4e4e7;font-weight:500;">${statusInfo.timeString} (${statusInfo.relativeTime})</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Coordinates:</span>
          <span style="color:#e4e4e7;font-family:monospace;">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</span>
        </div>
        ${
          loc.accuracy
            ? `<div style="display:flex;justify-content:space-between;">
                <span>GPS Accuracy:</span>
                <span style="color:#e4e4e7;">±${Math.round(loc.accuracy)}m</span>
               </div>`
            : ''
        }
      </div>

      <button 
        id="btn-nav-friend-${friend.friendId}"
        onclick="window.__eclipseNavigateToFriend && window.__eclipseNavigateToFriend('${friend.friendId}', '${encodeURIComponent(friend.friendName)}', ${loc.lat}, ${loc.lng})"
        style="width:100%;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:background 0.2s;"
        onmouseover="this.style.background='#4338ca'"
        onmouseout="this.style.background='#4f46e5'"
      >
        <span>🧭</span> Navigate to Friend
      </button>
    </div>
  `.trim();
};
