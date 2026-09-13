import { ref, set, onValue, off, remove, serverTimestamp } from 'firebase/database';
import { getFirebaseDatabase, isFirebaseConfigured } from '../firebase';

export interface VisitorPresence {
  userId: string;
  displayName: string;
  itemId: string;
  lastActive: number;
}

export class PresenceService {
  /**
   * Set user's presence at a specific location
   */
  async setUserPresence(userId: string, displayName: string, itemId: string | null): Promise<void> {
    if (!isFirebaseConfigured()) {
      console.warn('Firebase is not configured. Presence updates will run in local fallback mode.');
      return;
    }

    try {
      const db = getFirebaseDatabase();
      const userRef = ref(db, `presence/users/${userId}`);

      if (itemId) {
        await set(userRef, {
          userId,
          displayName,
          itemId,
          lastActive: serverTimestamp(),
        });
      } else {
        await remove(userRef);
      }
    } catch (error) {
      console.error('Error in setUserPresence:', error);
    }
  }

  /**
   * Listen to active visitor presence counts for a specific location
   */
  listenToLocationPresence(itemId: string, onUpdate: (count: number) => void): () => void {
    if (!isFirebaseConfigured()) {
      console.warn('Firebase is not configured. Presence listener is running in local fallback mode.');
      onUpdate(0);
      return () => {};
    }

    try {
      const db = getFirebaseDatabase();
      const usersRef = ref(db, 'presence/users');

      const listener = onValue(usersRef, (snapshot) => {
        if (!snapshot.exists()) {
          onUpdate(0);
          return;
        }

        let activeCount = 0;
        const data = snapshot.val();
        
        Object.keys(data).forEach((uid) => {
          const userPresence = data[uid];
          if (userPresence && userPresence.itemId === itemId) {
            const lastActive = userPresence.lastActive || 0;
            const now = Date.now();
            // Active within 15 minutes
            if (now - lastActive < 15 * 60 * 1000) {
              activeCount++;
            }
          }
        });

        onUpdate(activeCount);
      }, (error) => {
        console.error('Error listening to location presence:', error);
      });

      return () => {
        off(usersRef, 'value', listener);
      };
    } catch (error) {
      console.error('Error setting up location presence listener:', error);
      return () => {};
    }
  }

  /**
   * Clear presence for a user
   */
  async clearUserPresence(userId: string): Promise<void> {
    if (!isFirebaseConfigured()) return;

    try {
      const db = getFirebaseDatabase();
      const userRef = ref(db, `presence/users/${userId}`);
      await remove(userRef);
    } catch (error) {
      console.error('Error clearing user presence:', error);
    }
  }
}

export const presenceService = new PresenceService();
export default presenceService;
