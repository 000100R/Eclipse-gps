import { ref, set, remove, onValue, off, serverTimestamp, onDisconnect, push } from 'firebase/database';
import { getFirebaseDatabase, isFirebaseConfigured } from '../firebase';

export interface PujaGroup {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  meetingPoint?: {
    lat: number;
    lng: number;
    name: string;
  };
}

export interface GroupMember {
  userId: string;
  userName: string;
  role: 'owner' | 'member';
  joinedAt: number;
  sharingEnabled: boolean;
}

export interface GroupInvite {
  groupId: string;
  groupName: string;
  invitedBy: string;
  invitedByName: string;
  status: 'pending';
  timestamp: number;
}

export interface GroupLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

// --- LOCAL FALLBACK ENGINE ---
const getLocalGroups = (): Record<string, PujaGroup> => {
  try {
    return JSON.parse(localStorage.getItem('local_groups') || '{}');
  } catch {
    return {};
  }
};
const saveLocalGroups = (g: any) => localStorage.setItem('local_groups', JSON.stringify(g));

const getLocalMembers = (): Record<string, Record<string, GroupMember>> => {
  try {
    return JSON.parse(localStorage.getItem('local_members') || '{}');
  } catch {
    return {};
  }
};
const saveLocalMembers = (m: any) => localStorage.setItem('local_members', JSON.stringify(m));

const getLocalInvites = (): Record<string, Record<string, GroupInvite>> => {
  try {
    return JSON.parse(localStorage.getItem('local_invites') || '{}');
  } catch {
    return {};
  }
};
const saveLocalInvites = (i: any) => localStorage.setItem('local_invites', JSON.stringify(i));

const getLocalLocations = (): Record<string, Record<string, GroupLocation>> => {
  try {
    return JSON.parse(localStorage.getItem('local_locations') || '{}');
  } catch {
    return {};
  }
};
const saveLocalLocations = (l: any) => localStorage.setItem('local_locations', JSON.stringify(l));

interface LocalListener {
  id: string;
  type: 'invites' | 'mygroups' | 'members' | 'locations';
  targetId: string;
  callback: (data: any) => void;
}
let localListeners: LocalListener[] = [];

const triggerLocalListeners = (type: 'invites' | 'mygroups' | 'members' | 'locations', targetId: string) => {
  localListeners.forEach((l) => {
    if (l.type === type && l.targetId === targetId) {
      if (type === 'invites') {
        const i = getLocalInvites();
        const userInvites = Object.values(i[targetId] || {});
        l.callback(userInvites);
      } else if (type === 'mygroups') {
        const members = getLocalMembers();
        const myGroupIds = Object.keys(members).filter((gid) => members[gid] && members[gid][targetId]);
        const groups = getLocalGroups();
        const list = myGroupIds.map((gid) => groups[gid]).filter(Boolean);
        l.callback(list);
      } else if (type === 'members') {
        const members = getLocalMembers();
        const list = Object.values(members[targetId] || {});
        l.callback(list);
      } else if (type === 'locations') {
        const locs = getLocalLocations();
        const map = locs[targetId] || {};
        l.callback(map);
      }
    }
  });
};

// 1. Create Puja Group
export const createPujaGroup = async (name: string, ownerId: string, ownerName: string): Promise<string> => {
  if (!isFirebaseConfigured()) {
    const groupId = 'local-group-' + Math.random().toString(36).substring(2, 9);
    
    const groups = getLocalGroups();
    groups[groupId] = {
      id: groupId,
      name: name.trim(),
      ownerId,
      ownerName,
      createdAt: Date.now(),
    };
    saveLocalGroups(groups);

    const members = getLocalMembers();
    if (!members[groupId]) members[groupId] = {};
    members[groupId][ownerId] = {
      userId: ownerId,
      userName: ownerName,
      role: 'owner',
      joinedAt: Date.now(),
      sharingEnabled: true,
    };
    saveLocalMembers(members);

    setTimeout(() => {
      triggerLocalListeners('mygroups', ownerId);
      triggerLocalListeners('members', groupId);
    }, 10);

    return groupId;
  }

  const db = getFirebaseDatabase();

  const groupsRef = ref(db, 'groups');
  const newGroupRef = push(groupsRef);
  const groupId = newGroupRef.key;
  if (!groupId) throw new Error('Failed to generate group ID');

  const groupData: PujaGroup = {
    id: groupId,
    name: name.trim(),
    ownerId,
    ownerName,
    createdAt: Date.now(),
  };

  await set(newGroupRef, groupData);

  // Set creator as the owner in groupMembers
  const memberRef = ref(db, `groupMembers/${groupId}/${ownerId}`);
  const memberData: GroupMember = {
    userId: ownerId,
    userName: ownerName,
    role: 'owner',
    joinedAt: Date.now(),
    sharingEnabled: false, // OFF by default
  };
  await set(memberRef, memberData);

  return groupId;
};

// 2. Send Invitation
export const inviteFriendToGroup = async (
  groupId: string,
  groupName: string,
  ownerId: string,
  ownerName: string,
  friendId: string,
  friendName: string
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const i = getLocalInvites();
    if (!i[friendId]) i[friendId] = {};
    i[friendId][groupId] = {
      groupId,
      groupName,
      invitedBy: ownerId,
      invitedByName: ownerName,
      status: 'pending',
      timestamp: Date.now(),
    };
    saveLocalInvites(i);
    setTimeout(() => triggerLocalListeners('invites', friendId), 10);
    return;
  }

  const db = getFirebaseDatabase();

  const inviteRef = ref(db, `groupInvites/${friendId}/${groupId}`);
  const inviteData: GroupInvite = {
    groupId,
    groupName,
    invitedBy: ownerId,
    invitedByName: ownerName,
    status: 'pending',
    timestamp: Date.now(),
  };
  await set(inviteRef, inviteData);
};

// 3. Respond to invitation
export const respondToGroupInvite = async (
  userId: string,
  userName: string,
  groupId: string,
  accept: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const i = getLocalInvites();
    if (i[userId]) {
      delete i[userId][groupId];
      saveLocalInvites(i);
    }

    if (accept) {
      const groups = getLocalGroups();
      const groupVal = groups[groupId];
      if (groupVal) {
        const members = getLocalMembers();
        if (!members[groupId]) members[groupId] = {};
        members[groupId][userId] = {
          userId,
          userName,
          role: 'member',
          joinedAt: Date.now(),
          sharingEnabled: true,
        };
        saveLocalMembers(members);
      }
    }
    setTimeout(() => {
      triggerLocalListeners('invites', userId);
      triggerLocalListeners('mygroups', userId);
      triggerLocalListeners('members', groupId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();

  // Remove the invite
  const inviteRef = ref(db, `groupInvites/${userId}/${groupId}`);
  await remove(inviteRef);

  if (accept) {
    // Read group name first to ensure group exists
    const groupRef = ref(db, `groups/${groupId}`);
    onValue(groupRef, async (snapshot) => {
      const groupVal = snapshot.val();
      if (!groupVal) return;

      const memberRef = ref(db, `groupMembers/${groupId}/${userId}`);
      const memberData: GroupMember = {
        userId,
        userName,
        role: 'member',
        joinedAt: Date.now(),
        sharingEnabled: false, // OFF by default
      };
      await set(memberRef, memberData);
    }, { onlyOnce: true });
  }
};

// 4. Remove Group Member
export const removeGroupMember = async (groupId: string, memberId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const members = getLocalMembers();
    if (members[groupId]) {
      delete members[groupId][memberId];
      saveLocalMembers(members);
    }
    const locs = getLocalLocations();
    if (locs[groupId]) {
      delete locs[groupId][memberId];
      saveLocalLocations(locs);
    }
    setTimeout(() => {
      triggerLocalListeners('members', groupId);
      triggerLocalListeners('locations', groupId);
      triggerLocalListeners('mygroups', memberId);
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();

  // Remove member from member list
  await remove(ref(db, `groupMembers/${groupId}/${memberId}`));
  // Clean up their group location if any
  await remove(ref(db, `groupLocations/${groupId}/${memberId}`));
};

// 5. Leave Group
export const leavePujaGroup = async (groupId: string, userId: string): Promise<void> => {
  await removeGroupMember(groupId, userId);
};

// 6. Rename Group
export const renamePujaGroup = async (groupId: string, newName: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const groups = getLocalGroups();
    if (groups[groupId]) {
      groups[groupId].name = newName.trim();
      saveLocalGroups(groups);
      setTimeout(() => {
        const members = getLocalMembers();
        const list = Object.keys(members[groupId] || {});
        list.forEach((uid) => triggerLocalListeners('mygroups', uid));
      }, 10);
    }
    return;
  }

  const db = getFirebaseDatabase();

  const nameRef = ref(db, `groups/${groupId}/name`);
  await set(nameRef, newName.trim());
};

// 7. Delete Group
export const deletePujaGroup = async (groupId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const groups = getLocalGroups();
    delete groups[groupId];
    saveLocalGroups(groups);

    const members = getLocalMembers();
    const uids = Object.keys(members[groupId] || {});
    delete members[groupId];
    saveLocalMembers(members);

    const locs = getLocalLocations();
    delete locs[groupId];
    saveLocalLocations(locs);

    setTimeout(() => {
      uids.forEach((uid) => triggerLocalListeners('mygroups', uid));
    }, 10);
    return;
  }

  const db = getFirebaseDatabase();

  // 1. Remove group info
  await remove(ref(db, `groups/${groupId}`));
  // 2. Remove all group members
  await remove(ref(db, `groupMembers/${groupId}`));
  // 3. Remove all group locations
  await remove(ref(db, `groupLocations/${groupId}`));
};

// 8. Update Location Sharing Toggle
export const updateGroupSharingState = async (
  groupId: string,
  userId: string,
  sharingEnabled: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const members = getLocalMembers();
    if (members[groupId] && members[groupId][userId]) {
      members[groupId][userId].sharingEnabled = sharingEnabled;
      saveLocalMembers(members);
    }
    if (!sharingEnabled) {
      await clearGroupLocation(groupId, userId);
    }
    setTimeout(() => triggerLocalListeners('members', groupId), 10);
    return;
  }

  const db = getFirebaseDatabase();

  const sharingRef = ref(db, `groupMembers/${groupId}/${userId}/sharingEnabled`);
  await set(sharingRef, sharingEnabled);

  if (!sharingEnabled) {
    await clearGroupLocation(groupId, userId);
  }
};

// 9. Publish Live Group Location
export const publishGroupLocation = async (
  groupId: string,
  userId: string,
  lat: number,
  lng: number,
  accuracy: number | null,
  sharingEnabled: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!sharingEnabled) return;
    const locs = getLocalLocations();
    if (!locs[groupId]) locs[groupId] = {};
    locs[groupId][userId] = {
      userId,
      lat,
      lng,
      accuracy: accuracy || 0,
      timestamp: Date.now(),
    };
    saveLocalLocations(locs);
    setTimeout(() => triggerLocalListeners('locations', groupId), 10);
    return;
  }

  const db = getFirebaseDatabase();

  const locRef = ref(db, `groupLocations/${groupId}/${userId}`);

  // Auto clean-up on disconnection
  await onDisconnect(locRef).remove();

  await set(locRef, {
    userId,
    lat,
    lng,
    accuracy: accuracy || 0,
    timestamp: Date.now(),
  });
};

// 10. Clear Group Location
export const clearGroupLocation = async (groupId: string, userId: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    const locs = getLocalLocations();
    if (locs[groupId] && locs[groupId][userId]) {
      delete locs[groupId][userId];
      saveLocalLocations(locs);
    }
    setTimeout(() => triggerLocalListeners('locations', groupId), 10);
    return;
  }

  const db = getFirebaseDatabase();

  const locRef = ref(db, `groupLocations/${groupId}/${userId}`);
  await onDisconnect(locRef).cancel();
  await remove(locRef);
};

// --- LISTENERS ---

// Listen to all group invites for a user
export const listenToUserGroupInvites = (
  userId: string,
  callback: (invites: GroupInvite[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localListeners.push({ id: lid, type: 'invites', targetId: userId, callback });
    const i = getLocalInvites();
    const list = Object.values(i[userId] || {});
    callback(list);
    return () => {
      localListeners = localListeners.filter((l) => l.id !== lid);
    };
  }

  const db = getFirebaseDatabase();
  const invitesRef = ref(db, `groupInvites/${userId}`);

  const listener = onValue(invitesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const invitesList: GroupInvite[] = Object.keys(data).map((key) => data[key]);
    callback(invitesList);
  }, (error) => {
    console.warn(`Error reading group invites for user ${userId}:`, error);
    callback([]);
  });

  return () => off(invitesRef, 'value', listener);
};

// Listen to all groups where a user is currently a member
export const listenToMyGroups = (
  userId: string,
  callback: (groups: PujaGroup[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localListeners.push({ id: lid, type: 'mygroups', targetId: userId, callback });
    const members = getLocalMembers();
    const myGroupIds = Object.keys(members).filter((gid) => members[gid] && members[gid][userId]);
    const groups = getLocalGroups();
    const list = myGroupIds.map((gid) => groups[gid]).filter(Boolean);
    callback(list);
    return () => {
      localListeners = localListeners.filter((l) => l.id !== lid);
    };
  }

  const db = getFirebaseDatabase();
  
  const membersRef = ref(db, 'groupMembers');
  const groupsRef = ref(db, 'groups');

  const listener = onValue(membersRef, (membersSnapshot) => {
    const membersData = membersSnapshot.val();
    if (!membersData) {
      callback([]);
      return;
    }

    const myGroupIds = Object.keys(membersData).filter((groupId) => {
      return membersData[groupId] && membersData[groupId][userId];
    });

    if (myGroupIds.length === 0) {
      callback([]);
      return;
    }

    // Now fetch corresponding group objects
    onValue(groupsRef, (groupsSnapshot) => {
      const groupsData = groupsSnapshot.val() || {};
      const filteredGroups: PujaGroup[] = myGroupIds
        .map((id) => groupsData[id])
        .filter((g) => g !== undefined);
      callback(filteredGroups);
    }, { onlyOnce: true });

  }, (error) => {
    console.warn(`Error reading groups for member user ${userId}:`, error);
    callback([]);
  });

  return () => off(membersRef, 'value', listener);
};

// Listen to a group's members
export const listenToGroupMembers = (
  groupId: string,
  callback: (members: GroupMember[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localListeners.push({ id: lid, type: 'members', targetId: groupId, callback });
    const members = getLocalMembers();
    const list = Object.values(members[groupId] || {});
    callback(list);
    return () => {
      localListeners = localListeners.filter((l) => l.id !== lid);
    };
  }

  const db = getFirebaseDatabase();
  const membersRef = ref(db, `groupMembers/${groupId}`);

  const listener = onValue(membersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const membersList: GroupMember[] = Object.keys(data).map((key) => data[key]);
    callback(membersList);
  }, (error) => {
    console.warn(`Error listening to group members for ${groupId}:`, error);
    callback([]);
  });

  return () => off(membersRef, 'value', listener);
};

// Listen to group locations
export const listenToGroupLocations = (
  groupId: string,
  callback: (locations: Record<string, GroupLocation>) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    const lid = Math.random().toString();
    localListeners.push({ id: lid, type: 'locations', targetId: groupId, callback });
    const locs = getLocalLocations();
    const map = locs[groupId] || {};
    callback(map);
    return () => {
      localListeners = localListeners.filter((l) => l.id !== lid);
    };
  }

  const db = getFirebaseDatabase();
  const locationsRef = ref(db, `groupLocations/${groupId}`);

  const listener = onValue(locationsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback({});
      return;
    }
    callback(data);
  }, (error) => {
    console.warn(`Error listening to group locations for ${groupId}:`, error);
    callback({});
  });

  return () => off(locationsRef, 'value', listener);
};
