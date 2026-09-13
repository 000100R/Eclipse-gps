import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import {
  Users,
  ShieldAlert,
  User,
  Link,
  Plus,
  Compass,
  MapPin,
  LogOut,
  XCircle,
  Copy,
  CheckCircle,
  Play,
  RotateCw,
  HelpCircle
} from 'lucide-react';

export const GroupPanel: React.FC = () => {
  const {
    userId,
    displayName,
    setDisplayName,
    sharingLocation,
    setSharingLocation,
    activeGroup,
    createGroup,
    joinGroup,
    leaveGroup,
    renameGroup,
    endGroupSession,
    updateMeetingPoint,
    currentLocation,
    speed,
    heading,
    mapRef,
    helpImproveCrowd,
    setHelpImproveCrowd
  } = useAppState();

  const [groupNameInput, setGroupNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;
    setErrorMsg(null);
    try {
      await createGroup(groupNameInput);
      setGroupNameInput('');
    } catch (err) {
      setErrorMsg('Failed to create group. Please check your connection.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setErrorMsg(null);
    const success = await joinGroup(inviteCodeInput);
    if (success) {
      setInviteCodeInput('');
    } else {
      setErrorMsg('Invalid or expired invite code. Please try again.');
    }
  };

  const copyCode = () => {
    if (!activeGroup) return;
    navigator.clipboard.writeText(activeGroup.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await renameGroup(newGroupName);
    setEditingName(false);
  };

  const setMeetingPointToCurrent = async () => {
    await updateMeetingPoint(currentLocation.lat, currentLocation.lng, "Group Meeting Point");
  };

  const clearGroupMeetingPoint = async () => {
    await updateMeetingPoint(0, 0, "");
  };

  const centerOnMember = (member: any) => {
    if (mapRef && member.latitude && member.longitude) {
      mapRef.setView([member.latitude, member.longitude], 16);
    }
  };

  const formatLastUpdated = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 10000) return 'Just now';
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ago`;
  };

  return (
    <div id="eclipse-friends-panel" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Title */}
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Eclipse Friends</h2>
      </div>

      {/* User Settings Header */}
      <GlassPanel className="p-3.5 space-y-3 bg-neutral-950/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Your Profile Settings</span>
          <span className="text-[9px] text-neutral-600 font-mono">ID: {userId.slice(0, 8)}...</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-neutral-950 bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              id="field-user-displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="bg-transparent border-b border-transparent hover:border-neutral-800 focus:border-indigo-500 text-xs font-bold text-neutral-100 w-full focus:outline-none py-0.5"
            />
            <p className="text-[9px] text-neutral-500 mt-0.5">Click directly on your name to change it</p>
          </div>
        </div>

        {/* Location Sharing Opt-in Lock */}
        <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Compass size={14} className={sharingLocation ? 'text-emerald-400 animate-spin' : 'text-neutral-500'} />
              <span className="text-xs font-semibold text-neutral-200">Broadcast Live Location</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-group-location-sharing"
                type="checkbox"
                checked={sharingLocation}
                onChange={(e) => setSharingLocation(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            {sharingLocation ? (
              <span className="text-emerald-400 font-semibold">✓ Location broadcasting active! Friends in your group can see your real-time path, speed, and status.</span>
            ) : (
              "Continuous location broadcast is strictly opt-in. Enable the toggle above to securely share your live telemetry with group members."
            )}
          </p>
        </div>

        {/* Help Improve Live Crowd Information Toggle */}
        <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HelpCircle size={14} className={helpImproveCrowd ? 'text-indigo-400 animate-pulse' : 'text-neutral-500'} />
              <span className="text-xs font-semibold text-neutral-200">Help improve live crowd info</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-help-improve-crowd"
                type="checkbox"
                checked={helpImproveCrowd}
                onChange={(e) => setHelpImproveCrowd(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            {helpImproveCrowd ? (
              <span className="text-indigo-400 font-semibold">✓ Active anonymous presence sharing. Thank you for contributing to aggregated live crowd intelligence!</span>
            ) : (
              "Anonymously share location telemetry to help generate real-time crowd metrics. Strictly private — no personal details are ever sent or exposed."
            )}
          </p>
        </div>
      </GlassPanel>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
          <ShieldAlert size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* No Group State: Join or Create */}
      {!activeGroup ? (
        <div className="space-y-3.5">
          {/* Create Group Card */}
          <GlassPanel className="p-4 space-y-3 bg-neutral-950/40">
            <div className="flex items-center space-x-2">
              <Plus size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-neutral-200">Create Private Group</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Start a private coordination group for your friends, family, or tour buddies. Assign an encrypted meeting point and synchronize live telemetry.
            </p>
            <form onSubmit={handleCreate} className="flex space-x-2">
              <input
                id="field-group-name-create"
                type="text"
                placeholder="e.g. Mahashtami Pandal Hop"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                id="btn-submit-create-group"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-colors"
              >
                Create
              </button>
            </form>
          </GlassPanel>

          {/* Join Group Card */}
          <GlassPanel className="p-4 space-y-3 bg-neutral-950/40">
            <div className="flex items-center space-x-2">
              <Link size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-neutral-200">Join Existing Group</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Enter a 4-character invite code provided by a group organizer to join their active safety coordination session.
            </p>
            <form onSubmit={handleJoin} className="flex space-x-2">
              <input
                id="field-group-invite-join"
                type="text"
                placeholder="e.g. PUJA-A4B3"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                id="btn-submit-join-group"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-colors"
              >
                Join
              </button>
            </form>
          </GlassPanel>
        </div>
      ) : (
        /* Active Group State Dashboard */
        <div className="space-y-4">
          <GlassPanel className="p-4 space-y-3 bg-neutral-950/40">
            {/* Header / Rename */}
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              {editingName ? (
                <form onSubmit={handleRenameSubmit} className="flex-1 flex space-x-2">
                  <input
                    id="field-group-name-rename"
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-100 focus:outline-none"
                  />
                  <button type="submit" className="text-xs font-bold text-emerald-400 px-1">Save</button>
                  <button type="button" onClick={() => setEditingName(false)} className="text-xs font-bold text-neutral-500 px-1">Cancel</button>
                </form>
              ) : (
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm font-bold text-neutral-100 truncate">{activeGroup.name}</h3>
                  <button
                    id="btn-edit-group-name"
                    onClick={() => {
                      setNewGroupName(activeGroup.name);
                      setEditingName(true);
                    }}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300 font-semibold"
                  >
                    Rename Group
                  </button>
                </div>
              )}

              <span className="shrink-0 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                ● LIVE GROUP
              </span>
            </div>

            {/* Invite Code Row */}
            <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded-xl border border-neutral-900">
              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Invite Your Friends</span>
                <p className="text-sm font-mono font-bold text-indigo-400 tracking-wider mt-0.5">{activeGroup.id}</p>
              </div>
              <button
                id="btn-copy-invite-code"
                onClick={copyCode}
                className="flex items-center space-x-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg text-[10px] font-bold uppercase transition-colors"
              >
                {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Active Members List */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Group Members ({activeGroup.members?.length || 0})</span>
              <div className="space-y-2">
                {activeGroup.members?.map((member: any) => {
                  const isMe = member.userId === userId;
                  const isBroadcasting = member.sharingEnabled;

                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-2.5 bg-neutral-950/60 border border-neutral-900 rounded-xl hover:border-neutral-800 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-indigo-400 shrink-0 text-xs">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-neutral-200 truncate">{member.displayName}</span>
                            {isMe && <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1 rounded-sm font-semibold shrink-0">me</span>}
                          </div>

                          {/* Telemetry metadata */}
                          {isBroadcasting ? (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-neutral-500">
                              <span className="truncate">Speed: {Math.round((member.speed || 0) * 3.6)} km/h</span>
                              <span>•</span>
                              <span>HDG: {Math.round(member.heading || 0)}°</span>
                              <span>•</span>
                              <span className="text-emerald-500">{formatLastUpdated(member.lastUpdated)}</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-rose-500 font-semibold block mt-0.5">Location Paused</span>
                          )}
                        </div>
                      </div>

                      {/* Map Interaction */}
                      {isBroadcasting && (
                        <button
                          id={`btn-focus-member-${member.userId}`}
                          onClick={() => centerOnMember(member)}
                          className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors shrink-0"
                          title="Locate Member on Map"
                        >
                          <MapPin size={13} className="stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meeting Point Coordinator */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Group Meeting Point</span>
              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-900 mt-1.5 space-y-3">
                {activeGroup.meetingPoint && activeGroup.meetingPoint.lat !== 0 ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <MapPin size={15} className="text-indigo-400 shrink-0" />
                      <div className="min-w-0 text-xs">
                        <p className="font-bold text-neutral-200 truncate">{activeGroup.meetingPoint.name || 'Assigned Meeting Point'}</p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {activeGroup.meetingPoint.lat.toFixed(5)}, {activeGroup.meetingPoint.lng.toFixed(5)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        id="btn-focus-meeting-point"
                        onClick={() => {
                          if (mapRef) mapRef.setView([activeGroup.meetingPoint.lat, activeGroup.meetingPoint.lng], 16);
                        }}
                        className="p-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase"
                      >
                        Locate
                      </button>
                      <button
                        id="btn-clear-meeting-point"
                        onClick={clearGroupMeetingPoint}
                        className="p-1 text-xs text-rose-500 hover:text-rose-400 font-bold uppercase ml-2"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      No meeting point has been set for this session yet. An organizer can set one to coordinate.
                    </p>
                    <button
                      type="button"
                      id="btn-set-meeting-current"
                      onClick={setMeetingPointToCurrent}
                      className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[10px] font-bold rounded-lg border border-neutral-800 uppercase tracking-wider transition-all"
                    >
                      Set Meeting Point at My Coordinates
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Exit Actions */}
            <div className="flex items-center space-x-2 border-t border-neutral-900 pt-3.5 mt-2">
              <button
                type="button"
                id="btn-leave-group"
                onClick={leaveGroup}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors border border-neutral-800"
              >
                <LogOut size={13} />
                <span>Leave Group</span>
              </button>
              <button
                type="button"
                id="btn-end-group-session"
                onClick={endGroupSession}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors border border-rose-900/30"
              >
                <XCircle size={13} />
                <span>End Session</span>
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};
export default GroupPanel;
