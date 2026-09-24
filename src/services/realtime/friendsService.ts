import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { ref, set, remove, onValue, off, serverTimestamp as rtdbServerTimestamp, onDisconnect } from 'firebase/database';
import { getFirebaseFirestore, getFirebaseDatabase, isFirebaseConfigured } from '../firebase';

export interface UserProfile {
  userId: string;
  eclipseId: string;
  eclipseIdLower?: string;
  displayName: string;
  photoUrl?: string;
  online?: boolean;
  lastActive?: any;
  shareLocationWithFriends?: boolean;
  createdAt?: any;
}

export interface FriendRequest {
  id?: string;
  requestId?: string;
  senderId: string;
  senderName: string;
  senderEclipseId: string;
  senderPhotoUrl?: string;
  receiverId: string;
  receiverName: string;
  receiverEclipseId: string;
  receiverPhotoUrl?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  timestamp: any;
}

export interface FriendRelation {
  friendId: string;
  friendName: string;
  friendEclipseId: string;
  friendPhotoUrl?: string;
  online?: boolean;
  sharingEnabled?: boolean;
  lastActive?: any;
  timestamp: any;
}

export interface BlockedUser {
  blockedId: string;
  blockedName?: string;
  blockedEclipseId?: string;
  timestamp: any;
}

export interface FriendLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  sharingEnabled: boolean;
}

// ============================================================================
// ECLIPSE ID GENERATION & NORMALIZATION
// ============================================================================

/**
 * Generates an authentic Eclipse ID in the format: ECL-7K4P9X2
 * Uses unambiguous uppercase alphanumeric characters (excluding confusing 0/O, 1/I).
 */
export function generateEclipseId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 7; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    randomPart += chars[idx];
  }
  return `ECL-${randomPart}`;
}

/**
 * Normalizes any user-entered Eclipse ID for case-insensitive and whitespace-tolerant matching.
 * e.g. "ecl-7k4p9x2" -> "ECL-7K4P9X2", "7k4p9x2" -> "ECL-7K4P9X2", " ECL 7K4P9X2 " -> "ECL-7K4P9X2"
 */
export function normalizeEclipseId(id: string): string {
  if (!id || typeof id !== 'string') return '';
  let clean = id.trim().toUpperCase().replace(/[\s\-_]+/g, '');
  if (clean.startsWith('ECL')) {
    clean = clean.slice(3);
  }
  if (!clean) return '';
  return `ECL-${clean}`;
}

/**
 * Retrieves the user's permanent Eclipse ID from localStorage, or automatically generates and stores one.
 */
export function getOrCreateEclipseId(): string {
  if (typeof window === 'undefined') return generateEclipseId();
  let stored = localStorage.getItem('eclipse_gps_eclipseId');
  if (!stored || !stored.startsWith('ECL-')) {
    stored = generateEclipseId();
    localStorage.setItem('eclipse_gps_eclipseId', stored);
  }
  return stored;
}

// ============================================================================
// LOCAL STORAGE FALLBACK (For offline, local development, or no-Firebase mode)
// ============================================================================

const getLocalUsers = (): Record<string, UserProfile> => {
  try {
    return JSON.parse(localStorage.getItem('local_users') || '{}');
  } catch {
    return {};
  }
};
const saveLocalUsers = (u: any) => localStorage.setItem('local_users', JSON.stringify(u));

const getLocalFriends = (): Record<string, Record<string, FriendRelation>> => {
  try {
    return JSON.parse(localStorage.getItem('local_friends') || '{}');
  } catch {
    return {};
  }
};
const saveLocalFriends = (f: any) => localStorage.setItem('local_friends', JSON.stringify(f));

const getLocalFriendRequests = (): Record<string, Record<string, FriendRequest>> => {
  try {
    return JSON.parse(localStorage.getItem('local_friend_requests') || '{}');
  } catch {
    return {};
  }
};
const saveLocalFriendRequests = (r: any) => localStorage.setItem('local_friend_requests', JSON.stringify(r));

const getLocalFriendRequestsReceived = (): Record<string, Record<string, FriendRequest>> => {
  try {
    return JSON.parse(localStorage.getItem('local_friend_requests_received') || '{}');
  } catch {
    return {};
  }
};
const saveLocalFriendRequestsReceived = (r: any) => localStorage.setItem('local_friend_requests_received', JSON.stringify(r));

const getLocalBlockedUsers = (): Record<string, Record<string, BlockedUser>> => {
  try {
    return JSON.parse(localStorage.getItem('local_blocked_users') || '{}');
  } catch {
    return {};
  }
};
const saveLocalBlockedUsers = (b: any) => localStorage.setItem('local_blocked_users', JSON.stringify(b));

const getLocalUserLocations = (): Record<string, FriendLocation> => {
  try {
    return JSON.parse(localStorage.getItem('local_user_locations') || '{}');
  } catch {
    return {};
  }
};
const saveLocalUserLocations = (l: any) => localStorage.setItem('local_user_locations', JSON.stringify(l));

interface LocalFriendListener {
  id: string;
  type: 'incoming_requests' | 'outgoing_requests' | 'friends' | 'friend_location' | 'blocked_users';
  targetId: string;
  callback: (data: any) => void;
}
let localFriendListeners: LocalFriendListener[] = [];

const triggerLocalFriendListeners = (
  type: 'incoming_requests' | 'outgoing_requests' | 'friends' | 'friend_location' | 'blocked_users',
  targetId: string
) => {
  localFriendListeners.forEach((l) => {
    if (l.type === type && l.targetId === targetId) {
      if (type === 'incoming_requests') {
        const reqs = getLocalFriendRequestsReceived();
        l.callback(Object.values(reqs[targetId] || {}));
      } else if (type === 'outgoing_requests') {
        const reqs = getLocalFriendRequests();
        l.callback(Object.values(reqs[targetId] || {}));
      } else if (type === 'friends') {
        const friends = getLocalFriends();
        l.callback(Object.values(friends[targetId] || {}));
      } else if (type === 'blocked_users') {
        const blocked = getLocalBlockedUsers();
        l.callback(Object.values(blocked[targetId] || {}));
      } else if (type === 'friend_location') {
        const locs = getLocalUserLocations();
        const userLoc = locs[targetId] || null;
        l.callback(userLoc);
      }
    }
  });
};

// ============================================================================
// USER PROFILE & ECLIPSE ID REGISTRY
// ============================================================================

/**
 * Synchronizes the user's profile and permanent Eclipse ID with Firestore and local cache.
 */
export const syncUserProfile = async (
  userId: string,
  displayName: string,
  photoUrl: string = '',
  eclipseIdParam?: string
): Promise<void> => {
  const eclipseId = eclipseIdParam || getOrCreateEclipseId();
  const eclipseIdLower = eclipseId.toLowerCase();

  // Always update local storage
  const users = getLocalUsers();
  users[userId] = {
    userId,
    eclipseId,
    eclipseIdLower,
    displayName,
    photoUrl,
    online: true,
    lastActive: Date.now(),
  };
  saveLocalUsers(users);

  if (!isFirebaseConfigured()) {
    return;
  }

  try {
    const firestore = getFirebaseFirestore();

    // 1. Update user document
    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(
      userDocRef,
      {
        userId,
        eclipseId,
        eclipseIdLower,
        displayName,
        photoUrl,
        online: true,
        lastActive: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Register direct O(1) lookup index: eclipseIds/{normalizedLower}
    const lookupDocRef = doc(firestore, 'eclipseIds', eclipseIdLower);
    await setDoc(
      lookupDocRef,
      {
        eclipseId,
        userId,
        displayName,
        photoUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore syncUserProfile warning:', err);
  }
};

/**
 * Search user specifically by Eclipse ID (case-insensitive, fast lookup).
 */
export interface SearchEclipseIdResult {
  found: boolean;
  isSelf: boolean;
  isFriend: boolean;
  isBlocked: boolean;
  hasSentRequest: boolean;
  hasReceivedRequest: boolean;
  user: UserProfile | null;
  error?: string;
}

export const searchUserByEclipseId = async (
  rawQuery: string,
  currentUserId: string,
  myFriends: FriendRelation[] = [],
  blockedList: BlockedUser[] = [],
  outgoing: FriendRequest[] = [],
  incoming: FriendRequest[] = []
): Promise<SearchEclipseIdResult> => {
  const safeFriends = Array.isArray(myFriends) ? myFriends : [];
  const safeBlocked = Array.isArray(blockedList) ? blockedList : [];
  const safeOutgoing = Array.isArray(outgoing) ? outgoing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  const normalized = normalizeEclipseId(rawQuery);
  if (!normalized || normalized.length < 5) {
    return {
      found: false,
      isSelf: false,
      isFriend: false,
      isBlocked: false,
      hasSentRequest: false,
      hasReceivedRequest: false,
      user: null,
      error: 'Please enter a valid Eclipse ID (e.g. ECL-7K4P9X2)',
    };
  }

  const normalizedLower = normalized.toLowerCase();

  // Try Firestore first if configured
  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();

      // 1. Fast direct lookup in eclipseIds collection
      const lookupRef = doc(firestore, 'eclipseIds', normalizedLower);
      const lookupSnap = await getDoc(lookupRef);

      let foundProfile: UserProfile | null = null;

      if (lookupSnap.exists()) {
        const lookupData = lookupSnap.data() || {};
        const targetUserId = lookupData.userId;

        // Fetch full profile from users collection
        if (targetUserId) {
          const userRef = doc(firestore, 'users', targetUserId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const ud = userSnap.data() || {};
            foundProfile = {
              userId: ud.userId || targetUserId,
              eclipseId: ud.eclipseId || lookupData.eclipseId || normalized,
              eclipseIdLower: ud.eclipseIdLower || normalizedLower,
              displayName: ud.displayName || lookupData.displayName || 'Eclipse Explorer',
              photoUrl: ud.photoUrl || lookupData.photoUrl || '',
              online: ud.online ?? true,
              lastActive: ud.lastActive,
            };
          } else {
            foundProfile = {
              userId: targetUserId,
              eclipseId: lookupData.eclipseId || normalized,
              displayName: lookupData.displayName || 'Eclipse Explorer',
              photoUrl: lookupData.photoUrl || '',
              online: true,
            };
          }
        }
      } else {
        // Fallback: Query users collection by eclipseIdLower
        const usersQuery = query(
          collection(firestore, 'users'),
          where('eclipseIdLower', '==', normalizedLower),
          limit(1)
        );
        const qSnap = await getDocs(usersQuery);
        if (!qSnap.empty) {
          const docData = qSnap.docs[0].data() || {};
          foundProfile = {
            userId: docData.userId || qSnap.docs[0].id,
            eclipseId: docData.eclipseId || normalized,
            eclipseIdLower: docData.eclipseIdLower || normalizedLower,
            displayName: docData.displayName || 'Eclipse Explorer',
            photoUrl: docData.photoUrl || '',
            online: docData.online ?? true,
            lastActive: docData.lastActive,
          };
        }
      }

      if (foundProfile) {
        const isSelf = foundProfile.userId === currentUserId;
        const isFriend = safeFriends.some((f) => f && f.friendId === foundProfile!.userId);
        const isBlocked = safeBlocked.some((b) => b && b.blockedId === foundProfile!.userId);
        const hasSentRequest = safeOutgoing.some((r) => r && r.receiverId === foundProfile!.userId && r.status === 'pending');
        const hasReceivedRequest = safeIncoming.some((r) => r && r.senderId === foundProfile!.userId && r.status === 'pending');

        return {
          found: true,
          isSelf,
          isFriend,
          isBlocked,
          hasSentRequest,
          hasReceivedRequest,
          user: foundProfile,
        };
      }
    } catch (err) {
      console.warn('Error querying Firestore for Eclipse ID:', err);
    }
  }

  // Local storage fallback search
  const localUsers = getLocalUsers() || {};
  const matchedUser = Object.values(localUsers).find((u) => {
    if (!u) return false;
    const userNorm = normalizeEclipseId(u.eclipseId || '').toLowerCase();
    return userNorm === normalizedLower;
  });

  if (matchedUser) {
    const isSelf = matchedUser.userId === currentUserId;
    const isFriend = safeFriends.some((f) => f && f.friendId === matchedUser.userId);
    const isBlocked = safeBlocked.some((b) => b && b.blockedId === matchedUser.userId);
    const hasSentRequest = safeOutgoing.some((r) => r && r.receiverId === matchedUser.userId && r.status === 'pending');
    const hasReceivedRequest = safeIncoming.some((r) => r && r.senderId === matchedUser.userId && r.status === 'pending');

    return {
      found: true,
      isSelf,
      isFriend,
      isBlocked,
      hasSentRequest,
      hasReceivedRequest,
      user: matchedUser,
    };
  }

  return {
    found: false,
    isSelf: false,
    isFriend: false,
    isBlocked: false,
    hasSentRequest: false,
    hasReceivedRequest: false,
    user: null,
    error: `No user found with Eclipse ID: ${normalized}`,
  };
};

/**
 * Search all registered users by display name or Eclipse ID.
 */
export const searchUsers = (
  searchQuery: string,
  currentUserId: string,
  callback: (users: UserProfile[]) => void
): (() => void) => {
  const queryText = searchQuery.toLowerCase().trim();
  const normId = normalizeEclipseId(searchQuery).toLowerCase();

  if (!isFirebaseConfigured()) {
    const data = getLocalUsers();
    const results: UserProfile[] = [];

    Object.keys(data).forEach((key) => {
      if (key === currentUserId) return; // Skip self

      const user = data[key] as UserProfile;
      const nameMatch = user.displayName?.toLowerCase().includes(queryText);
      const idMatch = user.eclipseId?.toLowerCase().includes(normId) || user.userId?.toLowerCase().includes(queryText);

      if (nameMatch || idMatch) {
        results.push(user);
      }
    });

    callback(results);
    return () => {};
  }

  const firestore = getFirebaseFirestore();
  const usersRef = collection(firestore, 'users');

  const unsubscribe = onSnapshot(
    usersRef,
    (snapshot) => {
      const results: UserProfile[] = [];
      snapshot.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u.userId === currentUserId || d.id === currentUserId) return;

        const nameMatch = u.displayName?.toLowerCase().includes(queryText);
        const idMatch = u.eclipseId?.toLowerCase().includes(normId) || u.userId?.toLowerCase().includes(queryText);

        if (nameMatch || idMatch) {
          results.push({
            userId: u.userId || d.id,
            eclipseId: u.eclipseId || 'ECL-???????',
            displayName: u.displayName || 'Explorer',
            photoUrl: u.photoUrl || '',
            online: u.online ?? false,
            lastActive: u.lastActive,
          });
        }
      });
      callback(results);
    },
    (error) => {
      console.warn('Error searching users in Firestore:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

// ============================================================================
// FRIEND REQUESTS (SEND, ACCEPT, DECLINE, CANCEL)
// ============================================================================

export const sendFriendRequest = async (
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string,
  senderEclipseIdParam?: string,
  receiverEclipseIdParam?: string,
  senderPhotoUrl: string = '',
  receiverPhotoUrl: string = ''
): Promise<{ success: boolean; error?: string }> => {
  if (!senderId || !receiverId) {
    return { success: false, error: 'Invalid user identities provided.' };
  }

  if (senderId === receiverId) {
    return { success: false, error: 'You cannot send a friend request to yourself.' };
  }

  // 1. Check local storage state for friends or existing pending requests
  const localFriends = getLocalFriends();
  if (localFriends[senderId]?.[receiverId]) {
    return { success: false, error: 'You are already friends with this user.' };
  }

  const localOut = getLocalFriendRequests();
  if (localOut[senderId]?.[receiverId]?.status === 'pending') {
    return { success: false, error: 'A friend request has already been sent to this user.' };
  }

  const localInc = getLocalFriendRequestsReceived();
  if (localInc[senderId]?.[receiverId]?.status === 'pending') {
    return { success: false, error: 'This user has already sent you a friend request. Check your incoming requests to accept.' };
  }

  const senderEclipseId = senderEclipseIdParam || getOrCreateEclipseId();
  const receiverEclipseId = receiverEclipseIdParam || 'ECL-???????';
  const reqDocId = `${senderId}_${receiverId}`;
  const payload: FriendRequest = {
    id: reqDocId,
    requestId: reqDocId,
    senderId,
    senderName,
    senderEclipseId,
    senderPhotoUrl,
    receiverId,
    receiverName,
    receiverEclipseId,
    receiverPhotoUrl,
    status: 'pending',
    timestamp: Date.now(),
  };

  // 2. Check Firestore if configured
  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();

      // Check if already friends in Firestore
      const friendRef = doc(firestore, 'users', senderId, 'friends', receiverId);
      const friendSnap = await getDoc(friendRef);
      if (friendSnap.exists()) {
        return { success: false, error: 'You are already friends with this user.' };
      }

      // Check if outgoing request already exists and is pending
      const reqRef = doc(firestore, 'friendRequests', reqDocId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists() && reqSnap.data()?.status === 'pending') {
        return { success: false, error: 'A friend request has already been sent to this user.' };
      }

      // Check if reverse incoming request already exists and is pending
      const reverseReqRef = doc(firestore, 'friendRequests', `${receiverId}_${senderId}`);
      const reverseSnap = await getDoc(reverseReqRef);
      if (reverseSnap.exists() && reverseSnap.data()?.status === 'pending') {
        return { success: false, error: 'This user has already sent you a friend request. Check your incoming requests to accept.' };
      }

      // Write request document
      await setDoc(reqRef, {
        ...payload,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Firestore sendFriendRequest error:', err);
      return { success: false, error: err.message || 'Failed to send friend request.' };
    }
  }

  // 3. Update local storage fallback and trigger local listeners
  const out = getLocalFriendRequests();
  if (!out[senderId]) out[senderId] = {};
  out[senderId][receiverId] = payload;
  saveLocalFriendRequests(out);

  const inc = getLocalFriendRequestsReceived();
  if (!inc[receiverId]) inc[receiverId] = {};
  inc[receiverId][senderId] = payload;
  saveLocalFriendRequestsReceived(inc);

  triggerLocalFriendListeners('outgoing_requests', senderId);
  triggerLocalFriendListeners('incoming_requests', receiverId);

  return { success: true };
};

export const acceptFriendRequest = async (
  myIdOrReq: string | FriendRequest,
  myNameParam?: string,
  friendIdParam?: string,
  friendNameParam?: string
): Promise<{ success: boolean; error?: string }> => {
  let senderId: string;
  let senderName: string;
  let senderEclipseId: string = 'ECL-???????';
  let senderPhotoUrl: string = '';
  let receiverId: string;
  let receiverName: string;
  let receiverEclipseId: string = 'ECL-???????';
  let receiverPhotoUrl: string = '';
  let reqDocId: string;

  if (typeof myIdOrReq === 'string') {
    receiverId = myIdOrReq;
    receiverName = myNameParam || 'Explorer';
    senderId = friendIdParam || '';
    senderName = friendNameParam || 'Friend';
    reqDocId = `${senderId}_${receiverId}`;
  } else {
    senderId = myIdOrReq.senderId;
    senderName = myIdOrReq.senderName;
    senderEclipseId = myIdOrReq.senderEclipseId || 'ECL-???????';
    senderPhotoUrl = myIdOrReq.senderPhotoUrl || '';
    receiverId = myIdOrReq.receiverId;
    receiverName = myIdOrReq.receiverName;
    receiverEclipseId = myIdOrReq.receiverEclipseId || 'ECL-???????';
    receiverPhotoUrl = myIdOrReq.receiverPhotoUrl || '';
    reqDocId = myIdOrReq.requestId || `${senderId}_${receiverId}`;
  }

  // Resolve Eclipse IDs from local registry if still default
  const localUsers = getLocalUsers() || {};
  if ((!senderEclipseId || senderEclipseId === 'ECL-???????') && localUsers[senderId]?.eclipseId) {
    senderEclipseId = localUsers[senderId].eclipseId;
    senderPhotoUrl = senderPhotoUrl || localUsers[senderId].photoUrl || '';
    senderName = senderName || localUsers[senderId].displayName || 'Friend';
  }
  if ((!receiverEclipseId || receiverEclipseId === 'ECL-???????') && localUsers[receiverId]?.eclipseId) {
    receiverEclipseId = localUsers[receiverId].eclipseId;
    receiverPhotoUrl = receiverPhotoUrl || localUsers[receiverId].photoUrl || '';
    receiverName = receiverName || localUsers[receiverId].displayName || 'Explorer';
  }

  const now = Date.now();

  // 1. Update local storage for immediate responsiveness
  const friends = getLocalFriends();
  if (!friends[receiverId]) friends[receiverId] = {};
  friends[receiverId][senderId] = {
    friendId: senderId,
    friendName: senderName,
    friendEclipseId: senderEclipseId,
    friendPhotoUrl: senderPhotoUrl,
    online: true,
    timestamp: now,
  };

  if (!friends[senderId]) friends[senderId] = {};
  friends[senderId][receiverId] = {
    friendId: receiverId,
    friendName: receiverName,
    friendEclipseId: receiverEclipseId,
    friendPhotoUrl: receiverPhotoUrl,
    online: true,
    timestamp: now,
  };
  saveLocalFriends(friends);

  // Clear pending requests locally
  const inc = getLocalFriendRequestsReceived();
  if (inc[receiverId]) delete inc[receiverId][senderId];
  if (inc[senderId]) delete inc[senderId][receiverId];
  saveLocalFriendRequestsReceived(inc);

  const out = getLocalFriendRequests();
  if (out[senderId]) delete out[senderId][receiverId];
  if (out[receiverId]) delete out[receiverId][senderId];
  saveLocalFriendRequests(out);

  triggerLocalFriendListeners('friends', receiverId);
  triggerLocalFriendListeners('friends', senderId);
  triggerLocalFriendListeners('incoming_requests', receiverId);
  triggerLocalFriendListeners('outgoing_requests', senderId);

  // 2. Update Firestore if configured
  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();

      // Retrieve full profiles from Firestore if Eclipse ID is missing
      if (!senderEclipseId || senderEclipseId === 'ECL-???????') {
        const sSnap = await getDoc(doc(firestore, 'users', senderId));
        if (sSnap.exists()) {
          const sData = sSnap.data() || {};
          senderEclipseId = sData.eclipseId || senderEclipseId;
          senderPhotoUrl = senderPhotoUrl || sData.photoUrl || '';
          senderName = senderName || sData.displayName || 'Friend';
        }
      }
      if (!receiverEclipseId || receiverEclipseId === 'ECL-???????') {
        const rSnap = await getDoc(doc(firestore, 'users', receiverId));
        if (rSnap.exists()) {
          const rData = rSnap.data() || {};
          receiverEclipseId = rData.eclipseId || receiverEclipseId;
          receiverPhotoUrl = receiverPhotoUrl || rData.photoUrl || '';
          receiverName = receiverName || rData.displayName || 'Explorer';
        }
      }

      // Add to receiver's friends subcollection
      const myFriendRef = doc(firestore, 'users', receiverId, 'friends', senderId);
      await setDoc(myFriendRef, {
        friendId: senderId,
        friendName: senderName,
        friendEclipseId: senderEclipseId,
        friendPhotoUrl: senderPhotoUrl,
        timestamp: serverTimestamp(),
      });

      // Add to sender's friends subcollection
      const theirFriendRef = doc(firestore, 'users', senderId, 'friends', receiverId);
      await setDoc(theirFriendRef, {
        friendId: receiverId,
        friendName: receiverName,
        friendEclipseId: receiverEclipseId,
        friendPhotoUrl: receiverPhotoUrl,
        timestamp: serverTimestamp(),
      });

      // Clean up the request document in Firestore
      await deleteDoc(doc(firestore, 'friendRequests', reqDocId)).catch(() => {});
      if (reqDocId !== `${senderId}_${receiverId}`) {
        await deleteDoc(doc(firestore, 'friendRequests', `${senderId}_${receiverId}`)).catch(() => {});
      }
      if (reqDocId !== `${receiverId}_${senderId}`) {
        await deleteDoc(doc(firestore, 'friendRequests', `${receiverId}_${senderId}`)).catch(() => {});
      }
    } catch (err: any) {
      console.error('Firestore acceptFriendRequest error:', err);
      return { success: false, error: err.message || 'Failed to accept friend request.' };
    }
  }

  return { success: true };
};

export const rejectFriendRequest = async (
  myIdOrReq: string | FriendRequest,
  friendIdParam?: string
): Promise<{ success: boolean; error?: string }> => {
  let senderId: string;
  let receiverId: string;
  let reqDocId: string;

  if (typeof myIdOrReq === 'string') {
    receiverId = myIdOrReq;
    senderId = friendIdParam || '';
    reqDocId = `${senderId}_${receiverId}`;
  } else {
    senderId = myIdOrReq.senderId;
    receiverId = myIdOrReq.receiverId;
    reqDocId = myIdOrReq.requestId || `${senderId}_${receiverId}`;
  }

  // Local storage cleanup
  const inc = getLocalFriendRequestsReceived();
  if (inc[receiverId]) delete inc[receiverId][senderId];
  if (inc[senderId]) delete inc[senderId][receiverId];
  saveLocalFriendRequestsReceived(inc);

  const out = getLocalFriendRequests();
  if (out[senderId]) delete out[senderId][receiverId];
  if (out[receiverId]) delete out[receiverId][senderId];
  saveLocalFriendRequests(out);

  triggerLocalFriendListeners('incoming_requests', receiverId);
  triggerLocalFriendListeners('outgoing_requests', senderId);

  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();
      await deleteDoc(doc(firestore, 'friendRequests', reqDocId)).catch(() => {});
      if (reqDocId !== `${senderId}_${receiverId}`) {
        await deleteDoc(doc(firestore, 'friendRequests', `${senderId}_${receiverId}`)).catch(() => {});
      }
      if (reqDocId !== `${receiverId}_${senderId}`) {
        await deleteDoc(doc(firestore, 'friendRequests', `${receiverId}_${senderId}`)).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Firestore rejectFriendRequest error:', err);
    }
  }

  return { success: true };
};

export const cancelFriendRequest = async (req: FriendRequest): Promise<{ success: boolean; error?: string }> => {
  return rejectFriendRequest(req);
};

// ============================================================================
// REMOVE & BLOCK FRIEND
// ============================================================================

export const removeFriend = async (myId: string, friendId: string): Promise<{ success: boolean }> => {
  // 1. Remove from local storage
  const friends = getLocalFriends();
  if (friends[myId]) delete friends[myId][friendId];
  if (friends[friendId]) delete friends[friendId][myId];
  saveLocalFriends(friends);

  triggerLocalFriendListeners('friends', myId);
  triggerLocalFriendListeners('friends', friendId);

  // 2. Remove from Firestore
  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();
      await deleteDoc(doc(firestore, 'users', myId, 'friends', friendId));
      await deleteDoc(doc(firestore, 'users', friendId, 'friends', myId));
    } catch (err) {
      console.warn('Firestore removeFriend error:', err);
    }
  }

  return { success: true };
};

export const blockUser = async (
  myId: string,
  targetUserId: string,
  targetName: string = '',
  targetEclipseId: string = ''
): Promise<{ success: boolean }> => {
  // 1. First remove any active friendship
  await removeFriend(myId, targetUserId);

  // 2. Clean up any pending requests
  const inc = getLocalFriendRequestsReceived();
  if (inc[myId]) delete inc[myId][targetUserId];
  if (inc[targetUserId]) delete inc[targetUserId][myId];
  saveLocalFriendRequestsReceived(inc);

  const out = getLocalFriendRequests();
  if (out[myId]) delete out[myId][targetUserId];
  if (out[targetUserId]) delete out[targetUserId][myId];
  saveLocalFriendRequests(out);

  // 3. Add to local blocked users
  const blocked = getLocalBlockedUsers();
  if (!blocked[myId]) blocked[myId] = {};
  blocked[myId][targetUserId] = {
    blockedId: targetUserId,
    blockedName: targetName,
    blockedEclipseId: targetEclipseId,
    timestamp: Date.now(),
  };
  saveLocalBlockedUsers(blocked);
  triggerLocalFriendListeners('blocked_users', myId);

  // 4. Update Firestore
  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();
      const blockedRef = doc(firestore, 'users', myId, 'blockedUsers', targetUserId);
      await setDoc(blockedRef, {
        blockedId: targetUserId,
        blockedName: targetName,
        blockedEclipseId: targetEclipseId,
        timestamp: serverTimestamp(),
      });

      // Clear any pending friend requests
      await deleteDoc(doc(firestore, 'friendRequests', `${myId}_${targetUserId}`)).catch(() => {});
      await deleteDoc(doc(firestore, 'friendRequests', `${targetUserId}_${myId}`)).catch(() => {});
    } catch (err) {
      console.warn('Firestore blockUser error:', err);
    }
  }

  return { success: true };
};

export const unblockUser = async (myId: string, targetUserId: string): Promise<{ success: boolean }> => {
  const blocked = getLocalBlockedUsers();
  if (blocked[myId]) delete blocked[myId][targetUserId];
  saveLocalBlockedUsers(blocked);
  triggerLocalFriendListeners('blocked_users', myId);

  if (isFirebaseConfigured()) {
    try {
      const firestore = getFirebaseFirestore();
      await deleteDoc(doc(firestore, 'users', myId, 'blockedUsers', targetUserId));
    } catch (err) {
      console.warn('Firestore unblockUser error:', err);
    }
  }

  return { success: true };
};

// ============================================================================
// REAL-TIME LISTENERS (FIRESTORE ON SNAPSHOT WITH LOCAL FALLBACK)
// ============================================================================

export const listenToFriends = (
  userId: string,
  callback: (friends: FriendRelation[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localFriendListeners.push({ id: lid, type: 'friends', targetId: userId, callback });
    const friends = getLocalFriends();
    callback(Object.values(friends[userId] || {}));
    return () => {
      localFriendListeners = localFriendListeners.filter((l) => l.id !== lid);
    };
  }

  const firestore = getFirebaseFirestore();
  const friendsCollection = collection(firestore, 'users', userId, 'friends');

  const unsubscribe = onSnapshot(
    friendsCollection,
    (snapshot) => {
      const list: FriendRelation[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          friendId: data.friendId || d.id,
          friendName: data.friendName || 'Friend',
          friendEclipseId: data.friendEclipseId || 'ECL-???????',
          friendPhotoUrl: data.friendPhotoUrl || '',
          online: data.online ?? true,
          sharingEnabled: data.sharingEnabled ?? false,
          lastActive: data.lastActive,
          timestamp: data.timestamp || Date.now(),
        });
      });
      callback(list);
    },
    (error) => {
      console.warn('Error listening to friends in Firestore:', error);
      const friends = getLocalFriends();
      callback(Object.values(friends[userId] || {}));
    }
  );

  return unsubscribe;
};

export const listenToIncomingRequests = (
  userId: string,
  callback: (requests: FriendRequest[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localFriendListeners.push({ id: lid, type: 'incoming_requests', targetId: userId, callback });
    const inc = getLocalFriendRequestsReceived();
    callback(Object.values(inc[userId] || {}));
    return () => {
      localFriendListeners = localFriendListeners.filter((l) => l.id !== lid);
    };
  }

  const firestore = getFirebaseFirestore();
  const requestsCollection = collection(firestore, 'friendRequests');
  const q = query(
    requestsCollection,
    where('receiverId', '==', userId),
    where('status', '==', 'pending')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: FriendRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          requestId: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderEclipseId: data.senderEclipseId,
          senderPhotoUrl: data.senderPhotoUrl || '',
          receiverId: data.receiverId,
          receiverName: data.receiverName,
          receiverEclipseId: data.receiverEclipseId,
          status: data.status || 'pending',
          timestamp: data.timestamp || Date.now(),
        });
      });
      callback(list);
    },
    (error) => {
      console.warn('Error listening to incoming requests in Firestore:', error);
      const inc = getLocalFriendRequestsReceived();
      callback(Object.values(inc[userId] || {}));
    }
  );

  return unsubscribe;
};

export const listenToOutgoingRequests = (
  userId: string,
  callback: (requests: FriendRequest[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localFriendListeners.push({ id: lid, type: 'outgoing_requests', targetId: userId, callback });
    const out = getLocalFriendRequests();
    callback(Object.values(out[userId] || {}));
    return () => {
      localFriendListeners = localFriendListeners.filter((l) => l.id !== lid);
    };
  }

  const firestore = getFirebaseFirestore();
  const requestsCollection = collection(firestore, 'friendRequests');
  const q = query(
    requestsCollection,
    where('senderId', '==', userId),
    where('status', '==', 'pending')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: FriendRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          requestId: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderEclipseId: data.senderEclipseId,
          receiverId: data.receiverId,
          receiverName: data.receiverName,
          receiverEclipseId: data.receiverEclipseId,
          receiverPhotoUrl: data.receiverPhotoUrl || '',
          status: data.status || 'pending',
          timestamp: data.timestamp || Date.now(),
        });
      });
      callback(list);
    },
    (error) => {
      console.warn('Error listening to outgoing requests in Firestore:', error);
      const out = getLocalFriendRequests();
      callback(Object.values(out[userId] || {}));
    }
  );

  return unsubscribe;
};

export const listenToBlockedUsers = (
  userId: string,
  callback: (blocked: BlockedUser[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localFriendListeners.push({ id: lid, type: 'blocked_users', targetId: userId, callback });
    const blocked = getLocalBlockedUsers();
    callback(Object.values(blocked[userId] || {}));
    return () => {
      localFriendListeners = localFriendListeners.filter((l) => l.id !== lid);
    };
  }

  const firestore = getFirebaseFirestore();
  const blockedCollection = collection(firestore, 'users', userId, 'blockedUsers');

  const unsubscribe = onSnapshot(
    blockedCollection,
    (snapshot) => {
      const list: BlockedUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          blockedId: data.blockedId || d.id,
          blockedName: data.blockedName || 'Blocked User',
          blockedEclipseId: data.blockedEclipseId || '',
          timestamp: data.timestamp || Date.now(),
        });
      });
      callback(list);
    },
    (error) => {
      console.warn('Error listening to blocked users in Firestore:', error);
      const blocked = getLocalBlockedUsers();
      callback(Object.values(blocked[userId] || {}));
    }
  );

  return unsubscribe;
};

// ============================================================================
// LIVE LOCATION SHARING (Preserved for GPS/Navigation integration)
// ============================================================================

export const publishLiveLocation = async (
  userId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
  sharingEnabled: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const locs = getLocalUserLocations();
    if (!sharingEnabled) {
      delete locs[userId];
      saveLocalUserLocations(locs);
      setTimeout(() => triggerLocalFriendListeners('friend_location', userId), 10);
      return;
    }

    locs[userId] = {
      userId,
      lat: latitude,
      lng: longitude,
      accuracy: accuracy || 0,
      timestamp: Date.now(),
      sharingEnabled: true,
    };
    saveLocalUserLocations(locs);
    setTimeout(() => triggerLocalFriendListeners('friend_location', userId), 10);
    return;
  }

  try {
    const db = getFirebaseDatabase();
    const locationRef = ref(db, `locations/${userId}`);

    if (!sharingEnabled) {
      await onDisconnect(locationRef).cancel();
      await remove(locationRef);
      return;
    }

    await onDisconnect(locationRef).remove();
    await set(locationRef, {
      lat: latitude,
      lng: longitude,
      accuracy: accuracy || 0,
      timestamp: rtdbServerTimestamp(),
      sharingEnabled: true,
    });
  } catch (err) {
    console.warn('RTDB publishLiveLocation error:', err);
  }
};

export const clearLiveLocation = async (userId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const locs = getLocalUserLocations();
    delete locs[userId];
    saveLocalUserLocations(locs);
    setTimeout(() => triggerLocalFriendListeners('friend_location', userId), 10);
    return;
  }

  try {
    const db = getFirebaseDatabase();
    const locationRef = ref(db, `locations/${userId}`);
    await onDisconnect(locationRef).cancel();
    await remove(locationRef);
  } catch (err) {
    console.warn('RTDB clearLiveLocation error:', err);
  }
};

export const listenToFriendLocation = (
  friendId: string,
  callback: (location: FriendLocation | null) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localFriendListeners.push({ id: lid, type: 'friend_location', targetId: friendId, callback });
    const locs = getLocalUserLocations();
    callback(locs[friendId] || null);
    return () => {
      localFriendListeners = localFriendListeners.filter((l) => l.id !== lid);
    };
  }

  try {
    const db = getFirebaseDatabase();
    const locationRef = ref(db, `locations/${friendId}`);

    const listener = onValue(
      locationRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.sharingEnabled) {
          callback(null);
          return;
        }
        callback({
          userId: friendId,
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
          sharingEnabled: data.sharingEnabled,
        });
      },
      (error) => {
        console.warn(`Error reading location for friend ${friendId}:`, error);
        callback(null);
      }
    );

    return () => off(locationRef, 'value', listener);
  } catch (err) {
    console.warn('Error setting up location listener:', err);
    return () => {};
  }
};
