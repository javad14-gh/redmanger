

'use client';

import React from 'react';
import { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppUser, Sube, Personel, Urun, Vardiya, KontrolListesi, StokSayimi, CashEntry, Expense, SalesReport } from '@/lib/types';
import * as mockData from '@/lib/mock-data';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, Timestamp, enableNetwork } from 'firebase/firestore';
import { getOrRegisterMessagingToken } from '@/lib/firebase-messaging-client';


interface AppContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{success: boolean, error?: string}>;
  branches: Sube[];
  staff: Personel[];
  products: Urun[];
  shifts: Vardiya[];
  stockCounts: StokSayimi[];
  cashEntries: CashEntry[];
  expenses: Expense[];
  salesReports: SalesReport[];
  checklists: KontrolListesi[];
  isLoading: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [branches, setBranches] = useState<Sube[]>([]);
  const [staff, setStaff] = useState<Personel[]>([]);
  const [products, setProducts] = useState<Urun[]>([]);
  const [shifts, setShifts] = useState<Vardiya[]>([]);
  const [stockCounts, setStockCounts] = useState<StokSayimi[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setIsLoading(true);
      if (currentFirebaseUser) {
        setFirebaseUser(currentFirebaseUser);
        
        try {
          // Ensure Firestore network is enabled before fetching
          await enableNetwork(db);
          const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfile = userDocSnap.data() as Personel;
            const appUser: AppUser = {
              name: userProfile.adi,
              email: userProfile.email,
              avatar: userProfile.avatarUrl || `https://picsum.photos/seed/${currentFirebaseUser.uid}/100/100`,
              role: userProfile.rol,
              branchId: userProfile.rol !== 'genel-mudur' ? userProfile.subeId : undefined,
              canManageInventory: userProfile.canManageInventory || false
            };
            setUser(appUser);
            
            // Kullanıcı giriş yaptıktan sonra bildirim token'ını kaydetmeye çalış
            getOrRegisterMessagingToken(currentFirebaseUser.uid);
            
          } else {
            console.warn(`User with UID ${currentFirebaseUser.uid} not found in Firestore. Logging out.`);
            await signOut(auth);
            setUser(null);
            setFirebaseUser(null);
          }
        } catch (error) {
          console.error("Error fetching user document from Firestore:", error);
          await signOut(auth);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Only set up listeners if there is a logged-in user.
    if (!firebaseUser) {
      setBranches([]);
      setStaff([]);
      setShifts([]);
      setProducts([]);
      setStockCounts([]);
      setCashEntries([]);
      setExpenses([]);
      setSalesReports([]);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const collectionsToSubscribe = [
        { name: 'branches', setter: setBranches },
        { name: 'users', setter: setStaff, idField: 'personelId' },
        { name: 'products', setter: setProducts, idField: 'urunId', dateFields: ['sonGuncelleme'] },
        { name: 'shifts', setter: setShifts, idField: 'vardiyaId', dateFields: ['tarih', 'planliGiris', 'girisSaati', 'cikisSaati'] },
        { name: 'stockCounts', setter: setStockCounts, idField: 'sayimId', dateFields: ['zamanDamgasi'] },
        { name: 'cashEntries', setter: setCashEntries, idField: 'cashEntryId', dateFields: ['islemTarihi', 'zamanDamgasi', 'teslimTarihi'] },
        { name: 'expenses', setter: setExpenses, idField: 'expenseId', dateFields: ['tarih', 'zamanDamgasi'] },
        { name: 'salesReports', setter: setSalesReports, idField: 'reportId', dateFields: ['reportDate', 'createdAt'] },
    ];
    
    collectionsToSubscribe.forEach(({ name, setter, idField, dateFields }) => {
        const q = query(collection(db, name));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                 if (dateFields) {
                    dateFields.forEach(field => {
                        if (docData[field] && docData[field] instanceof Timestamp) {
                            docData[field] = docData[field].toDate();
                        }
                    });
                }
                return {
                    ...docData,
                    [idField || name]: doc.id,
                };
            });
            setter(data as any);
        }, (error) => console.error(`Error fetching ${name}:`, error));
        unsubscribers.push(unsub);
    });


    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firebaseUser]);


  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Firebase login error:", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Firebase logout error:", error);
    }
  };
  
  const changePassword = async (currentPassword: string, newPassword: string): Promise<{success: boolean, error?: string}> => {
    if (!firebaseUser || !firebaseUser.email) {
      return { success: false, error: 'Kullanıcı bulunamadı.'};
    }
    
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);

    try {
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      return { success: true };

    } catch (error: any) {
        console.error("Password change error:", error);
        let errorMessage = "Bir hata oluştu.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "Mevcut şifreniz yanlış.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Yeni şifre çok zayıf. En az 6 karakter olmalıdır.";
        }
        return { success: false, error: errorMessage };
    }
  };

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      login,
      logout,
      changePassword,
      branches,
      staff,
      products,
      shifts,
      stockCounts,
      cashEntries,
      expenses,
      salesReports,
      checklists: mockData.kontrolListeleri, // This is now obsolete but kept for now to avoid breaking other parts
      isLoading,
    }),
    [user, firebaseUser, isLoading, branches, staff, products, shifts, stockCounts, cashEntries, expenses, salesReports]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
