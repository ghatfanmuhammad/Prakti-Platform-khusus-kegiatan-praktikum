import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { dispatchNotification, NotificationError } from './dispatcher';

initializeApp();
const db = getFirestore();

export const kirimNotifikasi = onCall(async (request) => {
  try {
    return await dispatchNotification(request.auth?.uid, request.data, {
      read: async (path) => (await db.doc(path).get()).data(),
      members: async (classId) => {
        const participants = await db.collection('participants').where('classId', '==', classId).get();
        return participants.docs.map((doc) => doc.data().uid).filter((uid): uid is string => typeof uid === 'string');
      },
    });
  } catch (error) {
    if (error instanceof NotificationError) throw new HttpsError(error.code, error.message);
    // Never return database records, tokens, or raw upstream errors to the caller.
    throw new HttpsError('internal', 'Notifikasi gagal diproses server.');
  }
});
