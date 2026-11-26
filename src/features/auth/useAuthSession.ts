import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { usePrakti } from '../../context/PraktiContext';
import { subscribeAuth, toCurrentUser, type UserProfile } from '../../services/authService';
import { auth, db } from '../../services/firebase';

export function useAuthSession() {
  const { masuk, keluar } = usePrakti();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopAuth = subscribeAuth((user) => {
      stopProfile?.();
      if (!user) { keluar(); setReady(true); return; }
      stopProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (auth.currentUser?.uid !== user.uid) return;
        if (snapshot.exists()) {
          try { masuk(toCurrentUser({ ...snapshot.data(), uid: snapshot.id } as UserProfile)); }
          catch { keluar(); }
        } else keluar();
        setReady(true);
      }, () => { keluar(); setReady(true); });
    });
    return () => { stopAuth(); stopProfile?.(); };
  }, [masuk, keluar]);
  return ready;
}
