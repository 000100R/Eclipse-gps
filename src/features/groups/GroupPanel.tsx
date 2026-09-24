import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  UserMinus,
  Trash2,
  Share2,
  EyeOff,
  Radio,
  CheckSquare,
  Square
} from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import {
  searchUsers,
  searchUserByEclipseId,
  SearchEclipseIdResult,
  sendFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  removeFriend,
  blockUser,
  listenToIncomingRequests,
  listenToOutgoingRequests,
  listenToFriends,
  UserProfile,
  FriendRequest,
  FriendRelation
} from '../../services/realtime/friendsService';

export const GroupPanel: React.FC = () => {
  const {
    userId,
    eclipseId,
    displayName,
    setDisplayName,
    photoUrl,
    blockedUsers,
    sharingLocation,
    setSharingLocation,
    shareLocationWithFriends,
    setShareLocationWithFriends,
    locationSharingMode,
    selectedFriendsToShare,
    setLocationSharingMode,
    toggleFriendLocationSharing,
    setFriendLocationSharing,
    stopLocationSharing,
    friendsList,
    friendsLocations,
    incomingRequests,
    outgoingRequests,
    calculateDistanceInMeters,
    activeGroup,
    setActiveGroup,
    groupsList,
    groupInvites,
    groupMembers,
    groupLocations,
    groupSharingEnabled,
    createPujaGroup,
    inviteFriendToGroup,
    respondToGroupInvite,
    removeGroupMember,
    leavePujaGroup,
    renamePujaGroup,
    deletePujaGroup,
    updateGroupSharingState,
    currentLocation,
    speed,
    heading,
    mapRef,
    helpImproveCrowd,
    setHelpImproveCrowd,
    addStop,
    setActiveTab,
    updateMeetingPoint,
    isLostInCrowdActive,
    setIsLostInCrowdActive,
    calculateRouteToItem,
    setIsNavigating,
    setMapCenter
  } = useAppState();

  // Navigation sub-tab inside Friends Tab: 'friends' or 'groups'
  const [subTab, setSubTab] = useState<'friends' | 'groups'>('friends');

  // Friends Foundation state
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [eclipseSearchResult, setEclipseSearchResult] = useState<SearchEclipseIdResult | null>(null);
  const [isSearchingEclipseId, setIsSearchingEclipseId] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(null);
  const [friendActionNotice, setFriendActionNotice] = useState<string | null>(null);
  const [viewLocationFriend, setViewLocationFriend] = useState<FriendRelation | null>(null);
  const [isSendingRequest, setIsSendingRequest] = useState<Record<string, boolean>>({});
  const [isProcessingAction, setIsProcessingAction] = useState<Record<string, boolean>>({});
  
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invitedFriends, setInvitedFriends] = useState<Record<string, boolean>>({});

  // Real-time user searching as typing (by Eclipse ID & display name)
  useEffect(() => {
    const trimmed = friendSearchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setEclipseSearchResult(null);
      setIsSearchingEclipseId(false);
      return;
    }

    let isMounted = true;
    setIsSearchingEclipseId(true);

    // 1. Search by Eclipse ID using existing searchUserByEclipseId
    searchUserByEclipseId(trimmed, userId, friendsList, blockedUsers, outgoingRequests, incomingRequests)
      .then((res) => {
        if (isMounted) {
          setEclipseSearchResult(res);
          setIsSearchingEclipseId(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsSearchingEclipseId(false);
      });

    // 2. Also search users collection by display name if Firebase is configured
    let unsubscribe = () => {};
    if (isFirebaseConfigured() && userId) {
      unsubscribe = searchUsers(trimmed, userId, (results) => {
        if (isMounted) {
          setSearchResults(results);
        }
      });
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [friendSearchQuery, userId, friendsList, blockedUsers, outgoingRequests, incomingRequests]);

  // Copy local ID
  const copyUserId = () => {
    const idToCopy = eclipseId || userId;
    navigator.clipboard.writeText(idToCopy);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  // Share Eclipse ID via device sharing system
  const shareEclipseId = async () => {
    const idToShare = eclipseId || userId;
    const shareData = {
      title: 'My Eclipse ID',
      text: `Connect with me on Eclipse GPS! My Eclipse ID is ${idToShare}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback to clipboard
    navigator.clipboard.writeText(idToShare);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  // Friends Actions
  const handleSendRequest = async (targetUser: UserProfile) => {
    if (!targetUser || !targetUser.userId) return;

    // Prevent sending request to yourself
    if (targetUser.userId === userId) {
      setErrorMsg('You cannot send a friend request to yourself.');
      return;
    }

    // Prevent sending request when already friends
    const isAlreadyFriend = friendsList.some((f) => f.friendId === targetUser.userId);
    if (isAlreadyFriend) {
      setErrorMsg('You are already friends with this user.');
      return;
    }

    // Prevent duplicate outgoing requests
    const isAlreadySent = outgoingRequests.some(
      (r) => r.receiverId === targetUser.userId && r.status === 'pending'
    );
    if (isAlreadySent) {
      setErrorMsg('A friend request has already been sent to this user.');
      return;
    }

    try {
      setErrorMsg(null);
      setRequestSuccessMsg(null);
      setIsSendingRequest((prev) => ({ ...prev, [targetUser.userId]: true }));

      const res = await sendFriendRequest(
        userId,
        displayName,
        targetUser.userId,
        targetUser.displayName,
        eclipseId,
        targetUser.eclipseId,
        photoUrl,
        targetUser.photoUrl
      );

      if (res.success) {
        setRequestSuccessMsg(`Friend request sent to ${targetUser.displayName}!`);
        setTimeout(() => setRequestSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to send friend request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send friend request. Please try again.');
    } finally {
      setIsSendingRequest((prev) => ({ ...prev, [targetUser.userId]: false }));
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    const actionKey = request.requestId || request.senderId;
    try {
      setErrorMsg(null);
      setRequestSuccessMsg(null);
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: true }));
      const res = await acceptFriendRequest({
        ...request,
        receiverId: userId,
        receiverName: displayName,
        receiverEclipseId: eclipseId,
        receiverPhotoUrl: photoUrl,
      });
      if (res.success) {
        setRequestSuccessMsg(`You and ${request.senderName} are now connected as friends!`);
        setTimeout(() => setRequestSuccessMsg(null), 3500);
      } else {
        setErrorMsg(res.error || 'Failed to accept friend request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept request.');
    } finally {
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleRejectRequest = async (request: FriendRequest) => {
    const actionKey = request.requestId || request.senderId;
    try {
      setErrorMsg(null);
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: true }));
      const res = await rejectFriendRequest({
        ...request,
        receiverId: userId,
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to decline request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to decline request.');
    } finally {
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleCancelOutgoing = async (request: FriendRequest) => {
    const actionKey = request.requestId || request.receiverId;
    try {
      setErrorMsg(null);
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: true }));
      const res = await cancelFriendRequest({
        ...request,
        senderId: userId,
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to cancel request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel request.');
    } finally {
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const formatLastActive = (lastActive: any, timestamp: any, isOnline?: boolean): string => {
    if (isOnline) return 'Online now';
    let millis: number | null = null;
    if (lastActive) {
      if (typeof lastActive === 'number') millis = lastActive;
      else if (typeof lastActive.toMillis === 'function') millis = lastActive.toMillis();
      else if (lastActive.seconds) millis = lastActive.seconds * 1000;
    }
    if (!millis && timestamp) {
      if (typeof timestamp === 'number') millis = timestamp;
      else if (typeof timestamp.toMillis === 'function') millis = timestamp.toMillis();
      else if (timestamp.seconds) millis = timestamp.seconds * 1000;
    }
    if (!millis) return 'Recently active';
    const diffSec = Math.floor((Date.now() - millis) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const handleViewLocation = (friend: FriendRelation) => {
    setViewLocationFriend(friend);
    const loc = friendsLocations[friend.friendId];
    if (loc && loc.sharingEnabled) {
      setMapCenter({ lat: loc.lat, lng: loc.lng });
      setActiveTab('home');
      setFriendActionNotice(`Centered map on ${friend.friendName}'s live location.`);
    } else {
      setFriendActionNotice(`${friend.friendName} is not currently sharing location with you.`);
    }
    setTimeout(() => {
      setFriendActionNotice(null);
    }, 4000);
  };

  const handleRemoveFriend = async (friend: FriendRelation) => {
    if (!window.confirm(`Are you sure you want to remove ${friend.friendName} from your friends list? Location access will be revoked immediately.`)) return;
    const actionKey = `remove_${friend.friendId}`;
    try {
      setErrorMsg(null);
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: true }));
      await removeFriend(userId, friend.friendId);
      setFriendActionNotice(`${friend.friendName} has been removed from your friends list.`);
      setTimeout(() => setFriendActionNotice(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove friend.');
    } finally {
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleBlockFriend = async (friend: FriendRelation) => {
    if (!window.confirm(`Block ${friend.friendName}? This will remove them from your friends list, revoke all location access, and prevent future friend requests.`)) return;
    const actionKey = `block_${friend.friendId}`;
    try {
      setErrorMsg(null);
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: true }));
      await blockUser(userId, friend.friendId, friend.friendName, friend.friendEclipseId);
      setFriendActionNotice(`${friend.friendName} has been blocked.`);
      setTimeout(() => setFriendActionNotice(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to block user.');
    } finally {
      setIsProcessingAction((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // Puja Groups Handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;
    setErrorMsg(null);
    try {
      await createPujaGroup(groupNameInput);
      setGroupNameInput('');
    } catch (err) {
      setErrorMsg('Failed to create group. Please check your connection.');
    }
  };

  const handleInviteFriend = async (friendId: string, friendName: string) => {
    try {
      await inviteFriendToGroup(friendId, friendName);
      setInvitedFriends(prev => ({ ...prev, [friendId]: true }));
      setTimeout(() => {
        setInvitedFriends(prev => ({ ...prev, [friendId]: false }));
      }, 3000);
    } catch (err) {
      console.error('Invite friend error:', err);
    }
  };

  const copyGroupCode = () => {
    if (!activeGroup) return;
    navigator.clipboard.writeText(activeGroup.id);
    setCopiedGroup(true);
    setTimeout(() => setCopiedGroup(false), 2000);
  };

  const handleRenameGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await renamePujaGroup(newGroupName);
    setEditingGroupName(false);
  };

  const setMeetingPointToCurrent = async () => {
    if (currentLocation) {
      await updateMeetingPoint(currentLocation.lat, currentLocation.lng, "Group Meeting Point");
    }
  };

  const clearGroupMeetingPoint = async () => {
    await updateMeetingPoint(0, 0, "");
  };

  const centerOnMember = (member: any) => {
    if (mapRef && member.latitude && member.longitude) {
      mapRef.setView([member.latitude, member.longitude], 16);
    }
  };

  const getMemberStatus = (member: any) => {
    const loc = groupLocations[member.userId];
    const isLocationStale = !loc || !loc.timestamp || (Date.now() - loc.timestamp > 120000);
    const isLive = member.sharingEnabled && loc && !isLocationStale;

    if (isLive) {
      let distanceStr = '';
      if (loc) {
        const dist = calculateDistanceInMeters(currentLocation, { lat: loc.lat, lng: loc.lng });
        distanceStr = dist < 1000 ? `${Math.round(dist)}m away` : `${(dist / 1000).toFixed(1)}km away`;
      }
      return {
        text: `Live • ${distanceStr}`,
        badgeClass: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/50',
        dotClass: 'bg-emerald-500 animate-pulse',
        isLive: true,
        lat: loc?.lat,
        lng: loc?.lng
      };
    } else if (!member.sharingEnabled) {
      return {
        text: 'Location unavailable',
        badgeClass: 'text-neutral-500 bg-neutral-900 border-neutral-800',
        dotClass: 'bg-neutral-600',
        isLive: false
      };
    } else {
      return {
        text: 'Offline',
        badgeClass: 'text-neutral-500 bg-neutral-950 border-neutral-900',
        dotClass: 'bg-neutral-800',
        isLive: false
      };
    }
  };

  const getProcessedMembers = () => {
    if (!activeGroup || !activeGroup.members) return [];
    
    return (activeGroup.members as any[])
      .filter((m) => m.userId !== userId)
      .map((member) => {
        const loc = groupLocations[member.userId];
        const isLocationStale = !loc || !loc.timestamp || (Date.now() - loc.timestamp > 120000);
        const isLive = member.sharingEnabled && loc && !isLocationStale;
        
        let distance = Infinity;
        if (isLive && loc) {
          distance = calculateDistanceInMeters(currentLocation, {
            lat: loc.lat,
            lng: loc.lng,
          });
        }
        
        return {
          ...member,
          isLive,
          distance,
          latitude: loc?.lat,
          longitude: loc?.lng,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  };

  const handleNavigateToMember = async (member: any) => {
    if (!member.latitude || !member.longitude) return;
    
    const virtualPandal: any = {
      id: `member-${member.userId}`,
      name: member.displayName,
      location: { lat: member.latitude, lng: member.longitude },
      latitude: member.latitude,
      longitude: member.longitude,
      address: 'Live Puja Group Member',
      area: 'Group Mode',
      crowdLevel: 'LOW',
      images: [],
      source: 'GROUP_MEMBER',
    };
    
    await calculateRouteToItem(virtualPandal);
    setIsNavigating(true);
    setActiveTab('home');
  };

  const handleShowOnMap = (member: any) => {
    centerOnMember(member);
    setActiveTab('home');
  };

  return (
    <div id="eclipse-friends-panel" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Page Title */}
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-6 rounded-full bg-indigo-500 animate-pulse" />
        <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Eclipse Friends</h2>
      </div>

      {/* User Settings Header */}
      <GlassPanel className="p-3.5 space-y-3 bg-neutral-950/40 border-neutral-900">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Your Eclipse Identity</span>
          <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-600 flex items-center justify-center font-bold text-white text-sm">
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
              className="bg-transparent border-b border-neutral-800 hover:border-neutral-700 focus:border-indigo-500 text-xs font-bold text-neutral-100 w-full focus:outline-none py-0.5"
            />
            <p className="text-[9px] text-neutral-500 mt-0.5">Edit username directly above — updates in real-time</p>
          </div>
        </div>

        {/* My Eclipse ID Section */}
        <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">My Eclipse ID</span>
            <span className="text-[9px] text-indigo-400/80 font-mono">Permanent Public ID</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-neutral-900/60 px-3 py-2 rounded-lg border border-neutral-800/80">
            <span className="font-mono text-sm font-bold tracking-wider text-neutral-100 select-all">
              {eclipseId || 'ECL-???????'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                id="btn-copy-eclipse-id"
                onClick={copyUserId}
                className="flex items-center space-x-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 active:scale-95 px-2.5 py-1 rounded-md transition-all border border-neutral-700/60"
                title="Copy Eclipse ID"
              >
                {isCopiedId ? (
                  <>
                    <CheckCircle size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
              <button
                type="button"
                id="btn-share-eclipse-id"
                onClick={shareEclipseId}
                className="flex items-center space-x-1 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-2.5 py-1 rounded-md transition-all shadow-sm"
                title="Share Eclipse ID"
              >
                <Share2 size={12} />
                <span>Share ID</span>
              </button>
            </div>
          </div>
        </div>

        {/* Location Broadcast settings */}
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
              <span className="text-emerald-400 font-semibold">✓ Location broadcasting active! Friends can locate you on map overlays.</span>
            ) : (
              "Continuous location broadcast is strictly opt-in. Enable the toggle above to securely share your live coordinates."
            )}
          </p>
        </div>
      </GlassPanel>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {requestSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
          <span>{requestSuccessMsg}</span>
        </div>
      )}

      {/* Dual Tab Switcher */}
      <div className="flex bg-neutral-900/40 p-1.5 rounded-2xl border border-neutral-900">
        <button
          onClick={() => setSubTab('friends')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'friends'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <User size={13} />
          <span>My Friends</span>
          {incomingRequests.length > 0 && (
            <span className="shrink-0 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
              {incomingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab('groups')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'groups'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Users size={13} />
          <span>Active Groups</span>
        </button>
      </div>

      {/* FRIENDS TAB CONTENT */}
      {subTab === 'friends' && (
        <div className="space-y-4">
          {/* Phase 9 Part 3A: Location Sharing Controls */}
          <div className="p-4 bg-neutral-950/90 rounded-2xl border border-neutral-800/80 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass
                  size={16}
                  className={
                    locationSharingMode === 'all'
                      ? 'text-emerald-400 animate-spin'
                      : locationSharingMode === 'selected'
                      ? 'text-indigo-400'
                      : 'text-neutral-500'
                  }
                  style={{ animationDuration: '6s' }}
                />
                <div>
                  <h3 className="text-xs font-bold text-neutral-100 uppercase tracking-wider">
                    Location Sharing Controls
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Explicitly choose who can view your real-time location
                  </p>
                </div>
              </div>

              {/* Mode Badge */}
              <div>
                {locationSharingMode === 'off' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">
                    <EyeOff size={10} className="mr-1" />
                    Sharing OFF
                  </span>
                )}
                {locationSharingMode === 'all' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                    All Friends ({friendsList.length})
                  </span>
                )}
                {locationSharingMode === 'selected' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/70 text-indigo-400 border border-indigo-800/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5" />
                    {selectedFriendsToShare.length} Selected
                  </span>
                )}
              </div>
            </div>

            {/* 3 Main Mode Selection Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                id="btn-location-sharing-off"
                onClick={() => stopLocationSharing()}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  locationSharingMode === 'off'
                    ? 'bg-neutral-900 border-neutral-700 text-white shadow-sm ring-1 ring-neutral-600'
                    : 'bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <EyeOff size={12} className={locationSharingMode === 'off' ? 'text-rose-400' : 'text-neutral-500'} />
                  <span className="text-[11px] font-bold">Stop Sharing</span>
                </div>
                <p className="text-[9px] text-neutral-500 leading-tight">Disable & revoke</p>
              </button>

              <button
                type="button"
                id="btn-location-sharing-all"
                onClick={() => setLocationSharingMode('all')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  locationSharingMode === 'all'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-sm ring-1 ring-emerald-500/50'
                    : 'bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <Users size={12} className={locationSharingMode === 'all' ? 'text-emerald-400' : 'text-neutral-500'} />
                  <span className="text-[11px] font-bold">All Friends</span>
                </div>
                <p className="text-[9px] text-neutral-500 leading-tight">Share with everyone</p>
              </button>

              <button
                type="button"
                id="btn-location-sharing-selected"
                onClick={() => setLocationSharingMode('selected')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  locationSharingMode === 'selected'
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300 shadow-sm ring-1 ring-indigo-500/50'
                    : 'bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <UserCheck size={12} className={locationSharingMode === 'selected' ? 'text-indigo-400' : 'text-neutral-500'} />
                  <span className="text-[11px] font-bold">Selected</span>
                </div>
                <p className="text-[9px] text-neutral-500 leading-tight">Choose friends</p>
              </button>
            </div>

            {/* Selected Friends Granular Selection Drawer */}
            {locationSharingMode === 'selected' && (
              <div className="pt-2.5 border-t border-neutral-900 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Authorize Specific Friends ({selectedFriendsToShare.length} of {friendsList.length} enabled)
                  </span>
                  {friendsList.length > 0 && (
                    <div className="flex items-center space-x-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => friendsList.forEach((f) => setFriendLocationSharing(f.friendId, true))}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-neutral-600">•</span>
                      <button
                        type="button"
                        onClick={() => friendsList.forEach((f) => setFriendLocationSharing(f.friendId, false))}
                        className="text-neutral-400 hover:text-neutral-300 font-semibold"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {friendsList.length === 0 ? (
                  <p className="text-[11px] text-neutral-500 italic py-2">
                    No active friends connected yet. Add friends below to grant them location access.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {friendsList.map((f) => {
                      const isSelected = selectedFriendsToShare.includes(f.friendId);
                      return (
                        <div
                          key={f.friendId}
                          onClick={() => toggleFriendLocationSharing(f.friendId)}
                          className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/30 border-indigo-900/60 hover:border-indigo-700'
                              : 'bg-neutral-950 border-neutral-900 hover:border-neutral-800 opacity-75'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[9px] font-bold text-indigo-400 shrink-0">
                              {f.friendName ? f.friendName.slice(0, 2).toUpperCase() : '??'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-neutral-200 truncate block">
                                {f.friendName}
                              </span>
                              <span className="text-[8px] text-indigo-400 font-mono block">
                                {f.friendEclipseId}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? 'text-indigo-300 bg-indigo-900/40 border border-indigo-700/50'
                                  : 'text-neutral-500 bg-neutral-900 border border-neutral-800'
                              }`}
                            >
                              {isSelected ? 'Authorized' : 'Hidden'}
                            </span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Click handled by parent div
                              className="rounded border-neutral-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-neutral-900 cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Helpful description notice */}
            <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-900/60 pt-2">
              {locationSharingMode === 'off' && (
                <span>Location sharing is completely turned OFF. No friends can receive or view your location.</span>
              )}
              {locationSharingMode === 'all' && (
                <span className="text-emerald-400/90 font-medium">All accepted friends are authorized to view your live GPS location.</span>
              )}
              {locationSharingMode === 'selected' && (
                <span className="text-indigo-400/90 font-medium">
                  Only the {selectedFriendsToShare.length} explicitly authorized friend{selectedFriendsToShare.length === 1 ? '' : 's'} can receive your live location.
                </span>
              )}
            </p>
          </div>

          {/* 1. Real-time User Lookup / Search */}
          <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
            <div className="flex items-center space-x-2 border-b border-neutral-900 pb-2">
              <Search size={14} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Search Eclipse Users</h3>
            </div>
            <div className="relative">
              <input
                id="field-search-eclipse-users"
                type="text"
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                placeholder="Search by Eclipse ID (e.g. ECL-7K4P9X2) or name..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {friendSearchQuery && (
                <button
                  onClick={() => setFriendSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions & Search Results */}
            {friendSearchQuery && (
              <div className="space-y-2 mt-2 pt-1 border-t border-neutral-900">
                {isSearchingEclipseId && (
                  <div className="p-3 text-center text-xs text-neutral-500 flex items-center justify-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                    <span>Searching Eclipse network...</span>
                  </div>
                )}

                {/* Direct Eclipse ID Search Result Card */}
                {eclipseSearchResult?.found && eclipseSearchResult.user && (
                  <div className="p-3 bg-indigo-950/20 rounded-xl border border-indigo-900/50 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        Eclipse ID Match
                      </span>
                      <span className="text-[9px] text-neutral-400 font-mono">Verified Explorer</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {eclipseSearchResult.user.photoUrl ? (
                          <img
                            src={eclipseSearchResult.user.photoUrl}
                            alt={eclipseSearchResult.user.displayName}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {eclipseSearchResult.user.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-neutral-100 truncate">
                            {eclipseSearchResult.user.displayName}
                          </p>
                          <span className="inline-block font-mono text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                            {eclipseSearchResult.user.eclipseId || 'ECL-???????'}
                          </span>
                        </div>
                      </div>

                      {/* State-Specific Action Button */}
                      <div className="shrink-0">
                        {eclipseSearchResult.isSelf || eclipseSearchResult.user.userId === userId ? (
                          <span className="text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-lg font-medium">
                            This is you
                          </span>
                        ) : (friendsList || []).some((f) => f?.friendId === eclipseSearchResult.user!.userId) ? (
                          <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1.5 rounded-lg font-bold uppercase">
                            <Check size={12} />
                            <span>Already Friends</span>
                          </span>
                        ) : (outgoingRequests || []).some((r) => r?.receiverId === eclipseSearchResult.user!.userId && r?.status === 'pending') ? (
                          <button
                            type="button"
                            disabled
                            className="flex items-center space-x-1 text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-lg font-bold uppercase cursor-not-allowed opacity-90"
                          >
                            <Clock size={12} className="text-amber-400" />
                            <span>Request Sent</span>
                          </button>
                        ) : (incomingRequests || []).some((r) => r?.senderId === eclipseSearchResult.user!.userId && r?.status === 'pending') ? (
                          <button
                            type="button"
                            onClick={() => {
                              const req = (incomingRequests || []).find((r) => r?.senderId === eclipseSearchResult.user!.userId);
                              if (req) handleAcceptRequest(req);
                            }}
                            className="flex items-center space-x-1 text-[10px] text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-3 py-1.5 rounded-lg font-bold uppercase transition-all shadow-sm"
                          >
                            <Check size={12} />
                            <span>Accept Request</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendRequest(eclipseSearchResult.user!)}
                            disabled={!!isSendingRequest[eclipseSearchResult.user.userId]}
                            className="flex items-center space-x-1.5 text-[10px] text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-3 py-1.5 rounded-lg font-bold uppercase transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                          >
                            <UserPlus size={12} />
                            <span>{isSendingRequest[eclipseSearchResult.user.userId] ? 'Sending...' : 'Send Friend Request'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional / Name Search Results */}
                {(searchResults || [])
                  .filter((u) => u && u.userId !== userId && (!eclipseSearchResult?.user || u.userId !== eclipseSearchResult.user.userId))
                  .map((user) => {
                    const isFriend = (friendsList || []).some((f) => f?.friendId === user.userId);
                    const isSent = (outgoingRequests || []).some((r) => r?.receiverId === user.userId && r?.status === 'pending');
                    const isReceived = (incomingRequests || []).some((r) => r?.senderId === user.userId && r?.status === 'pending');
                    const isSending = !!isSendingRequest[user.userId];

                    return (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-2 bg-neutral-900/40 rounded-xl border border-neutral-900/60"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          {user.photoUrl ? (
                            <img
                              src={user.photoUrl}
                              alt={user.displayName}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-700 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-neutral-800 text-[10px] font-bold flex items-center justify-center text-indigo-400 shrink-0">
                              {user.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-neutral-200 truncate">{user.displayName}</p>
                            <p className="text-[8px] text-indigo-400/80 font-mono font-semibold">{user.eclipseId || 'Eclipse User'}</p>
                          </div>
                        </div>

                        {/* Direct responsive actions */}
                        <div className="shrink-0">
                          {isFriend ? (
                            <span className="flex items-center space-x-1 text-[9px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 px-2 py-1 rounded-lg font-bold uppercase">
                              <Check size={10} />
                              <span>Friends</span>
                            </span>
                          ) : isSent ? (
                            <span className="flex items-center space-x-1 text-[9px] text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-lg font-bold uppercase">
                              <Clock size={10} />
                              <span>Sent</span>
                            </span>
                          ) : isReceived ? (
                            <button
                              onClick={() => {
                                const req = incomingRequests.find((r) => r.senderId === user.userId);
                                if (req) handleAcceptRequest(req);
                              }}
                              className="text-[9px] text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded-lg font-bold uppercase transition-colors"
                            >
                              Accept
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendRequest(user)}
                              disabled={isSending}
                              className="flex items-center space-x-1 text-[9px] text-indigo-400 hover:text-white bg-indigo-950/30 hover:bg-indigo-600 border border-indigo-900/40 hover:border-indigo-500 px-2.5 py-1 rounded-lg font-bold uppercase transition-all disabled:opacity-50"
                            >
                              <UserPlus size={10} />
                              <span>{isSending ? 'Sending...' : 'Add'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Not found feedback */}
                {!isSearchingEclipseId &&
                  !eclipseSearchResult?.found &&
                  searchResults.length === 0 &&
                  friendSearchQuery.trim().length >= 4 && (
                    <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-900 text-center space-y-1">
                      <p className="text-xs font-semibold text-neutral-400">Invalid / User Not Found</p>
                      <p className="text-[10px] text-neutral-500">
                        {eclipseSearchResult?.error || `No user found with Eclipse ID or name matching "${friendSearchQuery.trim()}"`}
                      </p>
                    </div>
                  )}
              </div>
            )}
          </GlassPanel>

          {/* 2. Incoming Requests Box */}
          {incomingRequests.length > 0 && (
            <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-rose-950/40 border-l-2 border-l-rose-500">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
                <span>●</span>
                <span>Incoming Friend Requests ({incomingRequests.length})</span>
              </span>
              <div className="space-y-2">
                {incomingRequests.map((req) => {
                  const actionKey = req.requestId || req.senderId;
                  const isBusy = !!isProcessingAction[actionKey];

                  return (
                    <div
                      key={req.senderId}
                      className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-900 rounded-xl"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {req.senderPhotoUrl ? (
                          <img
                            src={req.senderPhotoUrl}
                            alt={req.senderName}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-800 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-900 text-xs font-bold flex items-center justify-center text-rose-400 shrink-0">
                            {req.senderName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-200 truncate">{req.senderName}</p>
                          <p className="text-[8px] text-indigo-400/80 font-mono">{req.senderEclipseId || 'Eclipse User'}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => handleAcceptRequest(req)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                        >
                          {isBusy ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          {isBusy ? '...' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          )}

          {/* 3. My Friends Registry */}
          <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                Active Friends ({friendsList.length})
              </span>
              {friendsList.length > 0 && (
                <span className="text-[9px] text-neutral-600 font-medium">
                  {friendsList.filter(f => f.online).length} online
                </span>
              )}
            </div>

            {/* Friend Action Feedback Notice */}
            {friendActionNotice && (
              <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center space-x-2 animate-in fade-in duration-200">
                <CheckCircle size={14} className="text-indigo-400 shrink-0" />
                <span className="text-[11px] leading-snug">{friendActionNotice}</span>
              </div>
            )}

            {friendsList.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Users size={28} className="text-neutral-700 mx-auto stroke-[1.2]" />
                <p className="text-xs text-neutral-400 font-bold">No Friends Connected Yet</p>
                <p className="text-[10px] text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  Search other active users above, or share your Eclipse ID to start sending invite queries.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendsList.map((friend) => {
                  const isOnline = friend.online ?? true;
                  const isRemoveBusy = !!isProcessingAction[`remove_${friend.friendId}`];
                  const isBlockBusy = !!isProcessingAction[`block_${friend.friendId}`];

                  return (
                    <div
                      key={friend.friendId}
                      className="flex items-center justify-between p-3 bg-neutral-950/60 border border-neutral-900 rounded-xl hover:border-neutral-800 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          {friend.friendPhotoUrl ? (
                            <img
                              src={friend.friendPhotoUrl}
                              alt={friend.friendName}
                              className="w-9 h-9 rounded-full object-cover border border-neutral-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-indigo-400 text-xs">
                              {friend.friendName ? friend.friendName.slice(0, 2).toUpperCase() : '??'}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-950 ${
                              isOnline ? 'bg-emerald-500' : 'bg-neutral-600'
                            }`}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-neutral-200 truncate block">
                            {friend.friendName}
                          </span>
                          <span className="text-[9px] text-indigo-400/90 font-mono block">
                            {friend.friendEclipseId || 'Eclipse User'}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-0.5 text-[9px]">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                isOnline ? 'text-emerald-400' : 'text-neutral-500'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'
                                }`}
                              />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span className="text-neutral-600">•</span>
                            <span className="text-neutral-400">
                              {formatLastActive(friend.lastActive, friend.timestamp, isOnline)}
                            </span>
                            <span className="text-neutral-600">•</span>
                            {locationSharingMode === 'off' && (
                              <span className="text-[9px] text-neutral-500 font-medium">Sharing off</span>
                            )}
                            {locationSharingMode === 'all' && (
                              <span className="text-[9px] text-emerald-400 font-medium">Sharing on</span>
                            )}
                            {locationSharingMode === 'selected' && (
                              selectedFriendsToShare.includes(friend.friendId) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFriendLocationSharing(friend.friendId);
                                  }}
                                  className="text-[9px] text-indigo-400 font-bold hover:underline"
                                  title="Click to toggle location authorization"
                                >
                                  Authorized ✓
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFriendLocationSharing(friend.friendId);
                                  }}
                                  className="text-[9px] text-neutral-500 hover:text-indigo-300"
                                  title="Click to authorize location sharing"
                                >
                                  + Authorize
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Friend Action Buttons */}
                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => handleViewLocation(friend)}
                          className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all shadow-sm"
                          title="View Location"
                        >
                          <MapPin size={11} />
                          <span>View Location</span>
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend)}
                          disabled={isRemoveBusy || isBlockBusy}
                          className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg transition-colors border border-neutral-800 shrink-0 disabled:opacity-50"
                          title="Remove Friend"
                        >
                          <UserMinus size={13} />
                        </button>
                        <button
                          onClick={() => handleBlockFriend(friend)}
                          disabled={isRemoveBusy || isBlockBusy}
                          className="p-1.5 bg-neutral-900 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 rounded-lg transition-colors border border-neutral-800 hover:border-rose-900/50 shrink-0 disabled:opacity-50"
                          title="Block User"
                        >
                          <ShieldAlert size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>

          {/* 4. Sent / Outgoing Pending Box */}
          {outgoingRequests.length > 0 && (
            <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                Pending Requests Sent ({outgoingRequests.length})
              </span>
              <div className="space-y-2">
                {outgoingRequests.map((req) => {
                  const actionKey = req.requestId || req.receiverId;
                  const isBusy = !!isProcessingAction[actionKey];

                  return (
                    <div
                      key={req.receiverId}
                      className="flex items-center justify-between p-2 bg-neutral-950/40 border border-neutral-900 rounded-xl"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {req.receiverPhotoUrl ? (
                          <img
                            src={req.receiverPhotoUrl}
                            alt={req.receiverName}
                            className="w-7 h-7 rounded-full object-cover border border-neutral-800 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-neutral-900 text-[10px] font-bold flex items-center justify-center text-neutral-500 shrink-0">
                            {req.receiverName ? req.receiverName.slice(0, 2).toUpperCase() : '??'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-300 truncate">{req.receiverName}</p>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[8px] text-indigo-400/80 font-mono">{req.receiverEclipseId || 'Eclipse User'}</span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-400 border border-amber-900/50">
                              Request Sent
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelOutgoing(req)}
                        disabled={isBusy}
                        className="text-[9px] text-neutral-400 hover:text-rose-400 bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 rounded-lg border border-neutral-800 font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0 ml-2"
                      >
                        {isBusy ? 'Cancelling...' : 'Cancel Request'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* GROUPS TAB CONTENT */}
      {subTab === 'groups' && (
        <div className="space-y-4">
          {!activeGroup ? (
            <div className="space-y-3.5">
              {/* 1. Pending Group Invites */}
              {groupInvites.length > 0 && (
                <GlassPanel className="p-4 space-y-3 bg-indigo-950/20 border-indigo-500/25 border-l-2 border-l-indigo-500">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <Clock size={13} />
                    <span>Group Invitations ({groupInvites.length})</span>
                  </div>
                  <div className="space-y-2">
                    {groupInvites.map((invite) => (
                      <div
                        key={invite.groupId}
                        className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-900 rounded-xl"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-neutral-200 truncate">{invite.groupName}</p>
                          <p className="text-[9px] text-neutral-500">Invited by: {invite.senderName}</p>
                        </div>
                        <div className="flex space-x-1.5 shrink-0">
                          <button
                            onClick={() => respondToGroupInvite(invite.groupId, true)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg uppercase transition-all"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => respondToGroupInvite(invite.groupId, false)}
                            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-bold text-[10px] rounded-lg uppercase transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              )}

              {/* 2. Create Group Card */}
              <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
                <div className="flex items-center space-x-2">
                  <Plus size={16} className="text-indigo-400" />
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Create Puja Group</h3>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Start a private Puja group. The group owner can invite accepted friends, manage membership, and share/view live coordination locations.
                </p>
                <form onSubmit={handleCreateGroup} className="flex space-x-2">
                  <input
                    id="field-group-name-create"
                    type="text"
                    placeholder="e.g. College Puja Squad"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    id="btn-submit-create-group"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-colors shrink-0"
                  >
                    Create
                  </button>
                </form>
              </GlassPanel>

              {/* 3. My Puja Groups list */}
              <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
                <div className="flex items-center space-x-2 border-b border-neutral-900 pb-2">
                  <Users size={14} className="text-indigo-400" />
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">My Puja Groups ({groupsList.length})</h3>
                </div>
                {groupsList.length === 0 ? (
                  <p className="text-[11px] text-neutral-500 text-center py-4">You haven't joined or created any groups yet.</p>
                ) : (
                  <div className="space-y-2">
                    {groupsList.map((group) => {
                      const isOwner = group.ownerId === userId;
                      return (
                        <div
                          key={group.id}
                          className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-900/60 rounded-xl hover:border-neutral-800 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-neutral-200 truncate">{group.name}</p>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-[9px] text-neutral-500">Owner: {group.ownerName}</span>
                              {isOwner && (
                                <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900/50 px-1 py-0.5 rounded font-bold uppercase">
                                  Owner
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setActiveGroup(group);
                              localStorage.setItem('eclipse_gps_activeGroupId', group.id);
                            }}
                            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all shrink-0"
                          >
                            Enter
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassPanel>
            </div>
          ) : (
            /* Active Group Dashboard */
            <div className="space-y-4">
              {isLostInCrowdActive ? (
                /* LOST IN CROWD SCREEN */
                <div className="space-y-4">
                  {/* Title Bar */}
                  <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <h2 className="text-sm font-black text-rose-500 uppercase tracking-widest">LOST IN CROWD</h2>
                    </div>
                    <button
                      onClick={() => setIsLostInCrowdActive(false)}
                      className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] font-bold rounded-lg border border-neutral-800 transition-colors uppercase tracking-wider"
                    >
                      Exit Mode
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                    Find your group members. Displaying ONLY active group members who are currently sharing location.
                  </p>

                  {/* 4. CLOSEST MEMBER */}
                  {(() => {
                    const processed = getProcessedMembers();
                    const liveOnly = processed.filter(m => m.isLive);
                    const closest = liveOnly[0] || null;
                    
                    if (closest) {
                      const distStr = closest.distance < 1000 ? `${Math.round(closest.distance)}m away` : `${(closest.distance / 1000).toFixed(1)}km away`;
                      return (
                        <div className="p-4 bg-rose-950/25 border-2 border-rose-500/50 rounded-2xl space-y-3 shadow-lg shadow-rose-950/30">
                          <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-widest block">
                            🏆 CLOSEST GROUP MEMBER
                          </span>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <h3 className="text-lg font-black text-white truncate">{closest.displayName}</h3>
                              <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5 shrink-0" />
                                🟢 Live • {distStr}
                              </p>
                            </div>
                            <button
                              onClick={() => handleNavigateToMember(closest)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl uppercase tracking-widest shadow-md shadow-rose-500/20 flex items-center space-x-1 transition-transform active:scale-95 shrink-0"
                            >
                              <Compass size={14} className="mr-1" />
                              NAVIGATE
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-4 bg-neutral-950/80 border border-neutral-900 rounded-2xl text-center">
                          <p className="text-xs text-neutral-400 font-bold leading-relaxed">
                            No group members are currently sharing their location.
                          </p>
                        </div>
                      );
                    }
                  })()}

                  {/* 2. LOST-IN-CROWD SCREEN MEMBERS LIST */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Group Members List
                    </span>

                    {(() => {
                      const processed = getProcessedMembers();
                      if (processed.length === 0) {
                        return <p className="text-xs text-neutral-500 py-3 text-center">No other members in this group.</p>;
                      }
                      
                      const liveOnly = processed.filter(m => m.isLive);
                      const unavailableOnly = processed.filter(m => !m.isLive);
                      
                      return (
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {/* Live Members */}
                          {liveOnly.map((member) => {
                            const distStr = member.distance < 1000 ? `${Math.round(member.distance)} m away` : `${(member.distance / 1000).toFixed(2)} km away`;
                            return (
                              <div
                                key={member.userId}
                                className="p-3 bg-neutral-950/80 border border-neutral-900 rounded-xl space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-black text-neutral-100 truncate">{member.displayName}</h4>
                                    <p className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 shrink-0 animate-pulse" />
                                      🟢 Live • {distStr}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <button
                                    onClick={() => handleShowOnMap(member)}
                                    className="py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] font-bold rounded-lg border border-neutral-800 uppercase tracking-wider transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <MapPin size={12} className="text-indigo-400 shrink-0" />
                                    <span>SHOW ON MAP</span>
                                  </button>
                                  <button
                                    onClick={() => handleNavigateToMember(member)}
                                    className="py-2 bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 text-[10px] font-extrabold rounded-lg border border-rose-900/50 uppercase tracking-wider transition-colors flex items-center justify-center space-x-1"
                                  >
                                    <Compass size={12} className="text-rose-400 shrink-0" />
                                    <span>NAVIGATE</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Location Unavailable Members */}
                          {unavailableOnly.map((member) => (
                            <div
                              key={member.userId}
                              className="p-3 bg-neutral-950/30 border border-neutral-950 rounded-xl flex items-center justify-between"
                            >
                              <span className="text-xs font-bold text-neutral-400 truncate pr-2">{member.displayName}</span>
                              <span className="text-[10px] text-neutral-500 font-medium flex items-center shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 mr-1.5" />
                                ⚪ Location unavailable
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bottom Exit Button */}
                  <button
                    onClick={() => setIsLostInCrowdActive(false)}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-xl border border-neutral-800 transition-colors uppercase tracking-widest mt-2"
                  >
                    EXIT LOST-IN-CROWD
                  </button>
                </div>
              ) : (
                /* NORMAL ACTIVE DASHBOARD */
                <div className="space-y-4 w-full">
                  {/* LOST IN CROWD PANIC TRIGGER BLOCK */}
                  <div className="p-4 bg-rose-950/25 border-2 border-rose-500/30 rounded-2xl flex flex-col items-center text-center space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest">Separated from friends?</h4>
                      <p className="text-[10px] text-neutral-400 max-w-xs leading-relaxed">
                        Enable Lost-in-Crowd mode to instantly view members sorted by distance and navigate to them.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="btn-lost-in-crowd-trigger"
                      onClick={() => setIsLostInCrowdActive(true)}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl uppercase tracking-widest shadow-md shadow-rose-500/20 transition-transform active:scale-95 animate-pulse"
                    >
                      🔴 LOST IN CROWD
                    </button>
                  </div>

                  <GlassPanel className="p-4 space-y-3 bg-neutral-950/40 border-neutral-900">
                {/* Header / Rename */}
                <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                  {editingGroupName ? (
                    <form onSubmit={handleRenameGroupSubmit} className="flex-1 flex space-x-2">
                      <input
                        id="field-group-name-rename"
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-100 focus:outline-none"
                      />
                      <button type="submit" className="text-xs font-bold text-emerald-400 px-1">Save</button>
                      <button type="button" onClick={() => setEditingGroupName(false)} className="text-xs font-bold text-neutral-500 px-1">Cancel</button>
                    </form>
                  ) : (
                    <div className="min-w-0 pr-2 flex-1">
                      <h3 className="text-sm font-bold text-neutral-100 truncate">{activeGroup.name}</h3>
                      {activeGroup.ownerId === userId && (
                        <button
                          id="btn-edit-group-name"
                          onClick={() => {
                            setNewGroupName(activeGroup.name);
                            setEditingGroupName(true);
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Rename Group
                        </button>
                      )}
                    </div>
                  )}

                  <span className="shrink-0 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                    ● ACTIVE PUJA GROUP
                  </span>
                </div>

                {/* Group Location Sharing Toggle */}
                <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Compass size={14} className={groupSharingEnabled ? 'text-emerald-400 animate-spin' : 'text-neutral-500'} />
                      <span className="text-xs font-semibold text-neutral-200">Share my location with this group</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="toggle-group-sharing-enabled"
                        type="checkbox"
                        checked={groupSharingEnabled}
                        onChange={(e) => updateGroupSharingState(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    {groupSharingEnabled ? (
                      <span className="text-emerald-400 font-semibold">✓ Location sharing is active! Only group members can view your coordinates.</span>
                    ) : (
                      "Opt-in to share your location with other members in this group. Joining does NOT share it automatically."
                    )}
                  </p>
                </div>

                {/* Owner invite friends list */}
                {activeGroup.ownerId === userId && (
                  <div className="space-y-2 pt-1 border-t border-neutral-900/40">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Invite Accepted Friends</span>
                    {friendsList.filter(f => !groupMembers.some(m => m.userId === f.friendId)).length === 0 ? (
                      <p className="text-[9px] text-neutral-500 leading-relaxed">No eligible friends to invite (all are already group members, or invite list is empty).</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {friendsList
                          .filter(f => !groupMembers.some(m => m.userId === f.friendId))
                          .map(friend => (
                            <div key={friend.friendId} className="flex items-center justify-between p-2 bg-neutral-950 rounded-lg border border-neutral-900">
                              <span className="text-xs font-bold text-neutral-200 truncate pr-2">{friend.friendName}</span>
                              <button
                                onClick={() => handleInviteFriend(friend.friendId, friend.friendName)}
                                disabled={invitedFriends[friend.friendId]}
                                className={`px-2.5 py-1 text-[9px] font-bold rounded-md uppercase tracking-wider transition-colors shrink-0 ${
                                  invitedFriends[friend.friendId]
                                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                              >
                                {invitedFriends[friend.friendId] ? 'Invited' : 'Invite'}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Active Members List */}
                <div className="space-y-2 pt-2 border-t border-neutral-900/40">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Group Members ({groupMembers.length})</span>
                  <div className="space-y-2">
                    {groupMembers.map((member) => {
                      const isMe = member.userId === userId;
                      const isOwner = member.role === 'owner';
                      const status = getMemberStatus(member);

                      return (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between p-2.5 bg-neutral-950/60 border border-neutral-900 rounded-xl hover:border-neutral-800 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-indigo-400 shrink-0 text-xs">
                              {member.userName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-bold text-neutral-200 truncate">{member.userName}</span>
                                {isMe && <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1 rounded-sm font-semibold shrink-0">me</span>}
                                {isOwner && <span className="text-[8px] bg-amber-950/40 text-amber-500 border border-amber-900/30 px-1 rounded-sm font-bold uppercase shrink-0">Owner</span>}
                              </div>

                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="inline-flex items-center text-[9px] text-neutral-400 font-semibold">
                                  <span className={`w-1.5 h-1.5 rounded-full mr-1 ${status.dotClass}`} />
                                  {status.text}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {/* Map Interaction */}
                            {status.isLive && (
                              <button
                                id={`btn-focus-member-${member.userId}`}
                                onClick={() => centerOnMember({ latitude: status.lat, longitude: status.lng })}
                                className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors shrink-0"
                                title="Locate Member on Map"
                              >
                                <MapPin size={13} className="stroke-[2.5]" />
                              </button>
                            )}

                            {/* Owner management: remove members */}
                            {activeGroup.ownerId === userId && !isOwner && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to remove ${member.userName} from this group?`)) {
                                    removeGroupMember(member.userId);
                                  }
                                }}
                                className="p-1.5 bg-neutral-900 hover:bg-rose-950/30 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-rose-900/30 shrink-0"
                                title="Remove from Group"
                              >
                                <UserX size={13} />
                              </button>
                            )}
                          </div>
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
                          {activeGroup.ownerId === userId && (
                            <button
                              id="btn-clear-meeting-point"
                              onClick={clearGroupMeetingPoint}
                              className="p-1 text-xs text-rose-500 hover:text-rose-400 font-bold uppercase ml-2"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-neutral-500 leading-relaxed">
                          No meeting point has been set for this session yet. An organizer can set one to coordinate.
                        </p>
                        {activeGroup.ownerId === userId && (
                          <button
                            type="button"
                            id="btn-set-meeting-current"
                            onClick={setMeetingPointToCurrent}
                            className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[10px] font-bold rounded-lg border border-neutral-800 uppercase tracking-wider transition-all"
                          >
                            Set Meeting Point at My Coordinates
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Exit Actions */}
                <div className="flex items-center space-x-2 border-t border-neutral-900 pt-3.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGroup(null);
                      localStorage.removeItem('eclipse_gps_activeGroupId');
                    }}
                    className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors border border-neutral-800"
                  >
                    Back to Groups
                  </button>
                  {activeGroup.ownerId === userId ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this group? All members will be removed and the group will be permanently deleted.')) {
                          deletePujaGroup();
                        }
                      }}
                      className="flex-1 py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors border border-rose-900/30"
                    >
                      Delete Group
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to leave this group?')) {
                          leavePujaGroup();
                        }
                      }}
                      className="flex-1 py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors border border-rose-900/30"
                    >
                      Leave Group
                    </button>
                  )}
                </div>
              </GlassPanel>
            </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default GroupPanel;
