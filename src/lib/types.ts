export interface Sube {
  subeId: string;
  adi: string;
  latitude?: number;
  longitude?: number;
}

export type UserRole = 'genel-mudur' | 'sube-muduru' | 'calisan' | 'sistem-yoneticisi';

export interface Personel {
  personelId: string; // The document ID
  uid: string; // The Firebase Authentication UID
  subeId: string;
  adi: string;
  rol: UserRole;
  tanimlananSaat: number;
  avatarUrl: string;
  email: string;
  password?: string;
  canManageInventory?: boolean; // Izin kontrolü için yeni alan
  aktif?: boolean; // Personelin aktif olup olmadığını belirtir
  notificationTokens?: string[]; // For push notifications
  puan?: number;
}

export interface PuanGirdisi {
    puanId: string;
    personelId: string;
    verenMudurId: string;
    verenMudurAdi: string;
    puan: number;
    aciklama: string;
    tarih: Date;
    ruleId?: string; // To link back to the rule
}

export type PerformanceRuleCategory = 'Operasyon ve Kalite' | 'Davranış ve Disiplin' | 'Müşteri Memnuniyeti';

export interface PerformanceRule {
  ruleId: string;
  name: string;
  description?: string;
  score: number;
  type: 'bonus' | 'penalty';
  category: PerformanceRuleCategory;
}

export interface Vardiya {
  vardiyaId: string;
  subeId:string;
  personelId: string;
  personelAdi?: string; // Denormalized for reporting
  tarih: Date;
  tur: 'calisma' | 'izinli'; // 'work' | 'leave' - Yeni alan
  planliGiris?: Date;
  planliSureDakika?: number;
  girisSaati?: Date;
  cikisSaati?: Date;
}

export interface Urun {
  urunId: string;
  subeId: string;
  adi: string;
  kategori: string;
  birim: 'kg' | 'adet' | 'litre';
  mevcutStok: number;
  minStok: number;
  sonGuncelleme?: Date;
  guncelleyenPersonelId?: string;
}

export interface StokSayimDetayi {
  urunId: string;
  adi: string;
  sayilanMiktar: number;
}

export interface StokSayimi {
  sayimId: string;
  subeId: string;
  personelId: string;
  zamanDamgasi: Date; // The actual time of submission
  islemTarihi: Date; // The logical "business date" for which the count is valid
  sayimDetaylari: StokSayimDetayi[];
}

export interface NakitDagilimDetayi {
    personelId: string;
    adi: string;
    miktar: number;
}

export interface CashEntry {
  cashEntryId: string;
  subeId: string;
  personelId: string; // The user who submitted the entry
  islemTarihi: Date; // The business date
  zamanDamgasi: Date; // The actual timestamp of submission
  dagilim: NakitDagilimDetayi[]; // Cash distribution among managers
  teslimDurumu: 'beklemede' | 'teslim edildi';
  teslimTarihi?: Date;
  topluTeslimId?: string; // To group batched handovers
  personelAdi?: string; // Denormalized name of the submitting user
  // nakitMiktari is now obsolete
  nakitMiktari?: number;
}

export interface Expense {
  expenseId: string;
  subeId: string;
  personelId: string;
  tarih: Date;
  tutar: number;
  aciklama: string;
  zamanDamgasi: Date;
  hesaplandi: boolean;
}

// === MATERIAL REQUEST TYPES START ===
export type MaterialRequestUrgency = 'Düşük' | 'Normal' | 'Acil';
export type MaterialRequestStatus = 'Beklemede' | 'Onaylandı' | 'Reddedildi' | 'Temin Edildi';

export interface MaterialRequest {
  requestId: string;
  branchId: string;
  requesterId: string; // This will now store the Firebase Auth UID
  requesterName: string;
  itemName: string;
  urgency: MaterialRequestUrgency;
  currentStock: string;
  status: MaterialRequestStatus;
  createdAt: Date;
  notes?: string;
  managerNotes?: string; // Notes from the manager
}
// === MATERIAL REQUEST TYPES END ===


// === SALES REPORT TYPES START ===

export interface SalesReportItem {
  productName: string;
  quantity: number;
  totalPrice?: number;
}

export interface PaymentBreakdownItem {
  method: string;
  amount: number;
}

export interface SalesReport {
  reportId: string;
  subeId: string;
  personelId: string;
  reportDate: Date; // The business date of the report
  createdAt: Date; // The timestamp of when it was saved
  items: SalesReportItem[];
  paymentBreakdown: PaymentBreakdownItem[];
}

// === SALES REPORT TYPES END ===


// === CHECKLIST TYPES START ===

// This is the template for a checklist
export interface ChecklistTemplate {
  templateId: string;
  subeId: string;
  adi: string;
  aciklama?: string;
  items: { id: string; metin: string }[];
  createdAt: Date;
  createdBy: string; // personelId
}

// This is an instance of a completed checklist for a specific day
export interface CompletedChecklist {
  completedChecklistId: string;
  templateId: string;
  subeId: string;
  tarih: Date;
  items: CompletedChecklistItem[];
}

export interface CompletedChecklistItem {
  itemId: string;
  metin: string;
  tamamlandi: boolean;
  tamamlayan?: {
    personelId: string;
    adi: string;
  };
  tamamlanmaZamani?: Date;
}

// === CHECKLIST TYPES END ===


export interface KontrolListesiOgesi {
  metin: string;
}

export interface KontrolListesi {
  kontrolListesiId: 'acilis' | 'kapanis';
  subeId: string;
  ogeler: KontrolListesiOgesi[];
}

export interface TamamlananKontrolListesiOgesi {
  metin: string;
  tamamlandi: boolean;
  tamamlanmaZamani?: Date;
}

export interface TamamlananKontrolListesi {
  tamamlananKontrolListesiId: string;
  subeId: string;
kontrolListesiId: 'acilis' | 'kapanis';
  tamamlayan: string; // personelId
  zamanDamgasi: Date;
  ogeler: TamamlananKontrolListesiOgesi[];
}

export type AppUser = {
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  branchId?: string;
  canManageInventory?: boolean; // Izin kontrolü için yeni alan
};
