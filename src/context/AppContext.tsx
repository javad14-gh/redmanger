

'use client';

import React from 'react';
import { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppUser, Sube, Personel, Urun, Vardiya, KontrolListesi, StokSayimi, CashEntry, Expense, SalesReport, PuanGirdisi, PerformanceRule, MaterialRequest } from '@/lib/types';
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
import { doc, getDoc, collection, onSnapshot, query, Timestamp, enableNetwork, where, getDocs } from 'firebase/firestore';
import { getOrRegisterMessagingToken } from '@/lib/firebase-messaging-client';


interface AppContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{success: boolean, error?: string}>;
  branches: Sube[];
  staff: Personel[];
  scoreEntries: PuanGirdisi[];
  performanceRules: PerformanceRule[];
  products: Urun[];
  shifts: Vardiya[];
  stockCounts: StokSayimi[];
  cashEntries: CashEntry[];
  expenses: Expense[];
  salesReports: SalesReport[];
  materialRequests: MaterialRequest[];
  checklists: KontrolListesi[];
  isLoading: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [branches, setBranches] = useState<Sube[]>([]);
  const [staff, setStaff] = useState<Personel[]>([]);
  const [scoreEntries, setScoreEntries] = useState<PuanGirdisi[]>([]);
  const [performanceRules, setPerformanceRules] = useState<PerformanceRule[]>([]);
  const [products, setProducts] = useState<Urun[]>([]);
  const [shifts, setShifts] = useState<Vardiya[]>([]);
  const [stockCounts, setStockCounts] = useState<StokSayimi[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
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
          
          // Fetch user profile based on UID
          const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
          const userDoc = await getDoc(userDocRef);


          if (userDoc.exists()) {
            const userProfile = userDoc.data() as Personel;
            const appUser: AppUser = {
              name: userProfile.adi,
              email: userProfile.email,
              avatar: userProfile.avatarUrl || `https://picsum.photos/seed/${currentFirebaseUser.uid}/100/100`,
              role: userProfile.rol,
              branchId: userProfile.rol !== 'genel-mudur' ? userProfile.subeId : undefined,
              canManageInventory: userProfile.canManageInventory || false
            };
            setUser(appUser);
            
            // Register for push notifications
            getOrRegisterMessagingToken(userDoc.id);
            
          } else {
            console.warn(`User profile with UID ${currentFirebaseUser.uid} not found in Firestore. Logging out.`);
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
      setScoreEntries([]);
      setPerformanceRules([]);
      setMaterialRequests([]);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Collections that are small and needed globally
    const globalCollections = [
        { name: 'branches', setter: setBranches, idField: 'subeId' },
        { name: 'users', setter: setStaff, idField: 'personelId' },
        { name: 'performanceRules', setter: setPerformanceRules, idField: 'ruleId' },
    ];

    globalCollections.forEach(({ name, setter, idField }) => {
        const q = query(collection(db, name));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                ...doc.data(),
                [idField]: doc.id,
            }));
            setter(data as any);
        }, (error) => console.error(`Error fetching ${name}:`, error));
        unsubscribers.push(unsub);
    });
    
    // Collections that are large and should be filtered by branch
    const branchSpecificCollections = [
      { name: 'shifts', setter: setShifts, idField: 'vardiyaId', dateFields: ['tarih', 'planliGiris', 'girisSaati', 'cikisSaati'] },
      { name: 'products', setter: setProducts, idField: 'urunId', dateFields: ['sonGuncelleme'] },
      { name: 'stockCounts', setter: setStockCounts, idField: 'sayimId', dateFields: ['zamanDamgasi'] },
      { name: 'cashEntries', setter: (data: any[]) => {
          const migratedData = data.map(entry => {
              if (entry.nakitMiktari && !entry.dagilim) {
                  return { ...entry, dagilim: [{ personelId: entry.personelId, adi: entry.personelAdi || 'Bilinmiyor', miktar: entry.nakitMiktari }] };
              }
              return entry;
          });
          setCashEntries(migratedData);
      }, idField: 'cashEntryId', dateFields: ['islemTarihi', 'zamanDamgasi', 'teslimTarihi'] },
      { name: 'expenses', setter: setExpenses, idField: 'expenseId', dateFields: ['tarih', 'zamanDamgasi'] },
      { name: 'salesReports', setter: setSalesReports, idField: 'reportId', dateFields: ['reportDate', 'createdAt'] },
      { name: 'materialRequests', setter: setMaterialRequests, idField: 'requestId', dateFields: ['createdAt'] },
      { name: 'scoreEntries', setter: setScoreEntries, idField: 'puanId', dateFields: ['tarih'] },
    ];
    
    branchSpecificCollections.forEach(({ name, setter, idField, dateFields }) => {
        let q;
        // General manager can see all, others are filtered by branch
        if(user?.role === 'genel-mudur') {
            q = query(collection(db, name));
        } else if (user?.branchId) {
            q = query(collection(db, name), where('subeId', '==', user.branchId));
        } else if (name === 'materialRequests' && user?.role === 'calisan') {
             q = query(collection(db, name), where('requesterId', '==', firebaseUser.uid));
        } else {
            // If a user has no branch and is not GM, they see nothing from these collections
            setter([]);
            return;
        }

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
                return { ...docData, [idField || 'id']: doc.id };
            });
             setter(data as any);
        }, (error) => console.error(`Error fetching ${name}:`, error));
        unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firebaseUser, user]);


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
      scoreEntries,
      performanceRules,
      products,
      shifts,
      stockCounts,
      cashEntries,
      expenses,
      salesReports,
      materialRequests,
      checklists: mockData.kontrolListeleri, // This is now obsolete but kept for now to avoid breaking other parts
      isLoading,
    }),
    [user, firebaseUser, isLoading, branches, staff, scoreEntries, performanceRules, products, shifts, stockCounts, cashEntries, expenses, salesReports, materialRequests]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
