import { ref, set, remove, onValue, off, serverTimestamp, onDisconnect } from 'firebase/database';
import { getFirebaseDatabase, isFirebaseConfigured } from '../firebase';

export interface UserProfile {
  userId: string;
  displayName: string;
  lastActive?: any;
}

export interface FriendRequest {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  status: 'pending';
  timestamp: any;
}

export interface FriendRelation {
  friendId: string;
  friendName: string;
  timestamp: any;
}

// --- LOCAL FALLBACK FOR FRIENDS ---
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
  type: 'incoming_requests' | 'outgoing_requests' | 'friends' | 'friend_location';
  targetId: string;
  callback: (data: any) => void;
}
let localFriendListeners: LocalFriendListener[] = [];

const triggerLocalFriendListeners = (type: 'incoming_requests' | 'outgoing_requests' | 'friends' | 'friend_location', targetId: string) => {
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
      } else if (type === 'friend_location') {
        const locs = getLocalUserLocations();
        const userLoc = locs[targetId] || null;
        l.callback(userLoc);
      }
    }
  });
};

// Synchronize user profile to registry
export const syncUserProfile = async (userId: string, displayName: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const users = getLocalUsers();
    users[userId] = {
      userId,
      displayName,
      lastActive: Date.now(),
    };
    saveLocalUsers(users);
    return;
  }

  const db = getFirebaseDatabase();
  const userRef = ref(db, `users/${userId}`);
  await set(userRef, {
    userId,
    displayName,
    lastActive: serverTimestamp(),
  });
};

// Search all registered users by display name or userId (excluding current user)
export const searchUsers = (
  searchQuery: string,
  currentUserId: string,
  callback: (users: UserProfile[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const data = getLocalUsers();
    const query = searchQuery.toLowerCase().trim();
    const results: UserProfile[] = [];

    Object.keys(data).forEach((key) => {
      if (key === currentUserId) return; // Skip self

      const user = data[key] as UserProfile;
      const nameMatch = user.displayName?.toLowerCase().includes(query);
      const idMatch = user.userId?.toLowerCase().includes(query);

      if (nameMatch || idMatch) {
        results.push(user);
      }
    });

    callback(results);
    return () => {};
  }

  const db = getFirebaseDatabase();
  const usersRef = ref(db, 'users');

  const listener = onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const results: UserProfile[] = [];

    Object.keys(data).forEach((key) => {
      if (key === currentUserId) return; // Skip self

      const user = data[key] as UserProfile;
      const nameMatch = user.displayName?.toLowerCase().includes(query);
      const idMatch = user.userId?.toLowerCase().includes(query);

      if (nameMatch || idMatch) {
        results.push(user);
      }
    });

    callback(results);
  }, (error) => {
    console.error('Error searching users:', error);
    callback([]);
  });

  return () => off(usersRef, 'value', listener);
};

// Send a friend request
export const sendFriendRequest = async (
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const payload: FriendRequest = {
      senderId,
      senderName,
      receiverId,
      receiverName,
      status: 'pending',
      timestamp: Date.now(),
    };

    const out = getLocalFriendRequests();
    if (!out[senderId]) out[senderId] = {};
    out[senderId][receiverId] = payload;
    saveLocalFriendRequests(out);

    const inc = getLocalFriendRequestsReceived();
    if (!inc[receiverId]) inc[receiverId] = {};
    inc[receiverId][senderId] = payload;
    saveLocalFriendRequestsReceived(inc);

    setTimeout(() => {
      triggerLocalFriendListeners('outgoing_requests', senderId);
      triggerLocalFriendListeners('incoming_requests', receiverId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();
  
  const payload: FriendRequest = {
    senderId,
    senderName,
    receiverId,
    receiverName,
    status: 'pending',
    timestamp: serverTimestamp(),
  };

  // Set outgoing request on sender side
  const outgoingRef = ref(db, `friend_requests/${senderId}/${receiverId}`);
  await set(outgoingRef, payload);

  // Set incoming request on receiver side
  const incomingRef = ref(db, `friend_requests_received/${receiverId}/${senderId}`);
  await set(incomingRef, payload);
};

// Cancel/Reject a friend request
export const rejectFriendRequest = async (myId: string, friendId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const inc = getLocalFriendRequestsReceived();
    if (inc[myId]) delete inc[myId][friendId];
    if (inc[friendId]) delete inc[friendId][myId];
    saveLocalFriendRequestsReceived(inc);

    const out = getLocalFriendRequests();
    if (out[friendId]) delete out[friendId][myId];
    if (out[myId]) delete out[myId][friendId];
    saveLocalFriendRequests(out);

    setTimeout(() => {
      triggerLocalFriendListeners('incoming_requests', myId);
      triggerLocalFriendListeners('outgoing_requests', myId);
      triggerLocalFriendListeners('incoming_requests', friendId);
      triggerLocalFriendListeners('outgoing_requests', friendId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();
  
  // Remove from both places
  await remove(ref(db, `friend_requests_received/${myId}/${friendId}`));
  await remove(ref(db, `friend_requests/${friendId}/${myId}`));
  
  // Also clean up reverse if any
  await remove(ref(db, `friend_requests_received/${friendId}/${myId}`));
  await remove(ref(db, `friend_requests/${myId}/${friendId}`));
};

// Accept a friend request
export const acceptFriendRequest = async (
  myId: string,
  myName: string,
  friendId: string,
  friendName: string
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const friends = getLocalFriends();
    if (!friends[myId]) friends[myId] = {};
    friends[myId][friendId] = {
      friendId,
      friendName,
      timestamp: Date.now(),
    };

    if (!friends[friendId]) friends[friendId] = {};
    friends[friendId][myId] = {
      friendId: myId,
      friendName: myName,
      timestamp: Date.now(),
    };
    saveLocalFriends(friends);

    const inc = getLocalFriendRequestsReceived();
    if (inc[myId]) delete inc[myId][friendId];
    saveLocalFriendRequestsReceived(inc);

    const out = getLocalFriendRequests();
    if (out[friendId]) delete out[friendId][myId];
    saveLocalFriendRequests(out);

    setTimeout(() => {
      triggerLocalFriendListeners('friends', myId);
      triggerLocalFriendListeners('friends', friendId);
      triggerLocalFriendListeners('incoming_requests', myId);
      triggerLocalFriendListeners('outgoing_requests', friendId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();

  const timestamp = serverTimestamp();

  // 1. Add friend relation for me
  const myFriendRef = ref(db, `friends/${myId}/${friendId}`);
  await set(myFriendRef, {
    friendId,
    friendName,
    timestamp,
  });

  // 2. Add friend relation for them
  const theirFriendRef = ref(db, `friends/${friendId}/${myId}`);
  await set(theirFriendRef, {
    friendId: myId,
    friendName: myName,
    timestamp,
  });

  // 3. Clear requests
  await remove(ref(db, `friend_requests_received/${myId}/${friendId}`));
  await remove(ref(db, `friend_requests/${friendId}/${myId}`));
};

// Remove a friend
export const removeFriend = async (myId: string, friendId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const friends = getLocalFriends();
    if (friends[myId]) delete friends[myId][friendId];
    if (friends[friendId]) delete friends[friendId][myId];
    saveLocalFriends(friends);

    setTimeout(() => {
      triggerLocalFriendListeners('friends', myId);
      triggerLocalFriendListeners('friends', friendId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();

  // Remove relationships on both sides
  await remove(ref(db, `friends/${myId}/${friendId}`));
  await remove(ref(db, `friends/${friendId}/${myId}`));
};

// Listen to incoming friend requests
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

  const db = getFirebaseDatabase();
  const requestsRef = ref(db, `friend_requests_received/${userId}`);

  const listener = onValue(requestsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const list = Object.keys(data).map((key) => data[key] as FriendRequest);
    callback(list);
  }, (error) => {
    console.error('Error listening to incoming requests:', error);
    callback([]);
  });

  return () => off(requestsRef, 'value', listener);
};

// Listen to outgoing pending requests
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

  const db = getFirebaseDatabase();
  const requestsRef = ref(db, `friend_requests/${userId}`);

  const listener = onValue(requestsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const list = Object.keys(data).map((key) => data[key] as FriendRequest);
    callback(list);
  }, (error) => {
    console.error('Error listening to outgoing requests:', error);
    callback([]);
  });

  return () => off(requestsRef, 'value', listener);
};

// Listen to active friends
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

  const db = getFirebaseDatabase();
  const friendsRef = ref(db, `friends/${userId}`);

  const listener = onValue(friendsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const list = Object.keys(data).map((key) => data[key] as FriendRelation);
    callback(list);
  }, (error) => {
    console.error('Error listening to friends:', error);
    callback([]);
  });

  return () => off(friendsRef, 'value', listener);
};

export interface FriendLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  sharingEnabled: boolean;
}

// Publish user's live coordinates
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

  const db = getFirebaseDatabase();
  const locationRef = ref(db, `locations/${userId}`);

  if (!sharingEnabled) {
    await onDisconnect(locationRef).cancel();
    await remove(locationRef);
    return;
  }

  // Set up onDisconnect to remove location on disconnect
  await onDisconnect(locationRef).remove();

  await set(locationRef, {
    lat: latitude,
    lng: longitude,
    accuracy: accuracy || 0,
    timestamp: serverTimestamp(),
    sharingEnabled: true,
  });
};

// Remove/expire the active location session
export const clearLiveLocation = async (userId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const locs = getLocalUserLocations();
    delete locs[userId];
    saveLocalUserLocations(locs);
    setTimeout(() => triggerLocalFriendListeners('friend_location', userId), 10);
    return;
  }

  const db = getFirebaseDatabase();
  const locationRef = ref(db, `locations/${userId}`);
  await onDisconnect(locationRef).cancel();
  await remove(locationRef);
};

// Listen to a friend's live location
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

  const db = getFirebaseDatabase();
  const locationRef = ref(db, `locations/${friendId}`);

  const listener = onValue(locationRef, (snapshot) => {
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
  }, (error) => {
    console.warn(`No permission or error reading location for friend ${friendId}:`, error);
    callback(null);
  });

  return () => off(locationRef, 'value', listener);
};
