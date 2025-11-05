'use client';

import { getMessaging, getToken } from 'firebase/messaging';
import { app, db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// Bu key, Firebase projenizin Cloud Messaging ayarlarından alınır.
// Gerçek bir projede bu değeri environment variable olarak saklamak en doğrusudur.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;


/**
 * Cihaz için Firebase Messaging token'ını alır ve Firestore'a kaydeder.
 * @param userId Geçerli kullanıcının ID'si.
 */
export const getOrRegisterMessagingToken = async (userId: string): Promise<string | null> => {
  if (typeof window === 'undefined' || !('Notification' in window) || !VAPID_KEY) {
    console.log('Bildirimler bu tarayıcıda desteklenmiyor veya VAPID key eksik.');
    return null;
  }

  try {
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Bildirim izni verildi.');
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      
      if (currentToken) {
        console.log('Alınan FCM token:', currentToken);
        // Token'ı Firestore'daki kullanıcı belgesine kaydet
        const userDocRef = doc(db, 'users', userId);
        
        await updateDoc(userDocRef, {
            notificationTokens: arrayUnion(currentToken)
        });
        console.log('Token başarıyla kullanıcının profiline eklendi.');

        return currentToken;
      } else {
        console.log('FCM token alınamadı. Tarayıcı bildirimlerini etkinleştirdiğinizden emin olun.');
        return null;
      }
    } else {
      console.log('Bildirim izni verilmedi.');
      return null;
    }
  } catch (error) {
    console.error('FCM token alınırken bir hata oluştu:', error);
    return null;
  }
};
