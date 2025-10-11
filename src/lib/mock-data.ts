
import { Sube, Personel, Vardiya, KontrolListesi } from './types';

// Bu dosya, uygulamanın prototip aşamasındaki yerel veritabanı işlevi görür.
// Gerçek bir uygulamada bu veriler Firestore gibi bir veritabanında saklanmalıdır.

/**
 * Şubeler Tablosu
 */
export const subeler: Sube[] = [
  { subeId: 'sube-1', adi: 'Ankara Kızılay' },
  { subeId: 'sube-2', adi: 'İstanbul Kadıköy' },
  { subeId: 'sube-3', adi: 'İzmir Alsancak' },
];

/**
 * Personel (Kullanıcılar) Tablosu - Artık Firestore'dan okunacak.
 */
export const personel: Personel[] = [];

/**
 * Ürünler Tablosu - Artık Firestore'dan okunacak.
 */
export const urunler: [] = [];

/**
 * Vardiyalar Tablosu - Artık Firestore'dan okunuyor.
 */
export const vardiyalar: Vardiya[] = [];

/**
 * Kontrol Listeleri Tablosu
 */
export const kontrolListeleri: KontrolListesi[] = [
  {
    kontrolListesiId: 'acilis',
    subeId: 'sube-1',
    ogeler: [
      { metin: 'Işıkları aç' },
      { metin: 'Kasa sayımını yap' },
      { metin: 'Mutfak ekipmanlarını kontrol et' },
    ],
  },
  {
    kontrolListesiId: 'kapanis',
    subeId: 'sube-1',
    ogeler: [
      { metin: 'Çöpleri at' },
      { metin: 'Kasa gün sonu raporunu al' },
      { metin: 'Kapıları kilitle' },
    ],
  },
];
