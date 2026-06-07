// src/app/dashboard/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Clock, ListChecks, Warehouse, Wallet, Users, AlertCircle, Hourglass, HandCoins, BarChart2, LogIn, LogOut, MapPin, CheckCircle, XCircle, Award } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/dashboard/StatCard';
import { Vardiya, SalesReport, Sube, PerformanceRuleCategory, Personel } from '@/lib/types';
import { startOfMonth, endOfMonth, isWithinInterval, differenceInMinutes, addDays, format, parse, isSameDay, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { getBusinessDate, getDistanceInMeters } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


const DashboardLinkCard = ({ href, icon: Icon, title, description, roles, permission }: { href: string; icon: React.ElementType; title: string; description: string; roles?: string[]; permission?: string; }) => {
    const { user } = useApp();

    const hasAccess = () => {
        if (!user) return false;
        
        let hasRoleAccess = false;
        if (roles) {
            hasRoleAccess = roles.includes(user.role);
        }

        let hasPermissionAccess = false;
        if (permission) {
            // Any user with the specific permission flag
            const hasSpecificPermission = (user as any)[permission] === true;
            // Managers also get access implicitly to permission-based items
            const isManager = user.role === 'genel-mudur' || user.role === 'sube-muduru';
            hasPermissionAccess = hasSpecificPermission || isManager;
        }

        // If no roles or permissions are specified, it's a general link for all authenticated users
        if (!roles && !permission) return true;

        return hasRoleAccess || hasPermissionAccess;
    };

    if (!hasAccess()) return null;

    return (
        <Link href={href} className="block hover:bg-muted/50 rounded-lg transition-colors">
            <Card className="h-full">
                <CardHeader className="flex-row gap-4 items-center">
                    <div className="flex-shrink-0">
                        <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        </Link>
    );
};

const calculateOvertimeForShifts = (shifts: Vardiya[]): string => {
    let totalOvertimeMinutes = 0;
    shifts.forEach(shift => {
        if (shift.tur === 'calisma' && shift.girisSaati && shift.cikisSaati && shift.planliSureDakika) {
            let giris = new Date(shift.girisSaati);
            let cikis = new Date(shift.cikisSaati);
            if (cikis < giris) cikis = addDays(cikis, 1);
            const durationMinutes = differenceInMinutes(cikis, giris);
            totalOvertimeMinutes += durationMinutes - shift.planliSureDakika;
        }
    });

    const sign = totalOvertimeMinutes < 0 ? '-' : '+';
    const absMins = Math.abs(totalOvertimeMinutes);
    const hours = Math.floor(absMins / 60);
    const minutes = absMins % 60;
    return `${sign}${hours} sa ${minutes} dk`;
};

const EmployeeClockInCard = () => {
    const { user, firebaseUser, shifts, branches, staff } = useApp();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Durum kontrol ediliyor...');
    const [permissionAlert, setPermissionAlert] = useState<{ isOpen: boolean; message: string; action?: 'in' | 'out' }>({ isOpen: false, message: '' });

    const today = getBusinessDate();
    
    const self = useMemo(() => staff.find(s => s.uid === firebaseUser?.uid), [staff, firebaseUser]);

    const todaysShift = useMemo(() => {
        if (!self) return undefined;
        return shifts.find(s => 
            s.personelId === self.personelId && 
            isSameDay(new Date(s.tarih), today)
        );
    }, [shifts, self, today]);

    const userBranch = useMemo(() => {
        if (!user?.branchId) return undefined;
        return branches.find(b => b.subeId === user.branchId);
    }, [branches, user]);

    const canClockIn = todaysShift && !todaysShift.girisSaati;
    const canClockOut = todaysShift && todaysShift.girisSaati && !todaysShift.cikisSaati;

    useEffect(() => {
        if (todaysShift) {
            if (todaysShift.girisSaati && !todaysShift.cikisSaati) {
                setStatusMessage(`Giriş yapıldı: ${format(new Date(todaysShift.girisSaati), 'HH:mm')}`);
            } else if (todaysShift.girisSaati && todaysShift.cikisSaati) {
                setStatusMessage('Bugünkü vardiyanız tamamlandı.');
            } else {
                if (todaysShift.planliGiris) {
                    setStatusMessage(`Vardiyanız saat ${format(new Date(todaysShift.planliGiris), 'HH:mm')}'da başlıyor. Giriش yapmaya hazırsınız.`);
                } else {
                    setStatusMessage('Bugün için giriş yapmaya hazırsınız.');
                }
            }
        } else {
            setStatusMessage('Bugün için planlanmış bir vardiyanız yok.');
        }
    }, [todaysShift]);


    const handleClockAction = (action: 'in' | 'out') => {
        if (!navigator.geolocation) {
             setPermissionAlert({
                isOpen: true,
                message: 'Tarayıcınız konum servisini desteklemiyor. Lütfen farklı bir tarayıcı deneyin.',
            });
            return;
        }

        if (!userBranch?.latitude || !userBranch?.longitude) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Şubenizin konumu tanımlanmamış. Lütfen yöneticinizle görüşün.' });
            return;
        }

        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const distance = getDistanceInMeters(latitude, longitude, userBranch.latitude!, userBranch.longitude!);

                if (distance > 50) { // 50 meters radius
                    toast({ variant: 'destructive', title: 'Uzak Konum', description: `Şubeden ${Math.round(distance)} metre uzaktasınız. Giriş/çıkış yapmak için şubede olmalısınız.` });
                    setIsLoading(false);
                    return;
                }
                
                // Location is valid, proceed to save
                saveClockAction(action);
            },
            (error) => {
                let message;
                switch (error.code) {
                    case 1: // PERMISSION_DENIED
                        message = 'Konum izni reddedildi. Giriş/çıkış yapmak için tarayıcı ayarlarından bu site için konum iznini etkinleştirmeniz gerekmektedir.';
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        message = 'Konumunuz şu anda tespit edilemiyor. Lütfen açık bir alanda tekrar deneyin veya internet bağlantınızı kontrol edin.';
                        break;
                    case 3: // TIMEOUT
                        message = 'Konum bilgisi alınırken zaman aşımı oluştu. Lütfen sinyalinizin güçlü olduğundan emin olup tekrar deneyین.';
                        break;
                    default:
                        message = 'Konum bilgisi alınamadı. Bu özelliği kullanmak için konum izni vermeniz gerekmektedir.';
                        break;
                }
                setPermissionAlert({ isOpen: true, message, action });
                setIsLoading(false);
            },
            {
                timeout: 10000, // 10 seconds
            }
        );
    };
    
    const saveClockAction = async (action: 'in' | 'out') => {
        if (!todaysShift) {
             toast({ variant: 'destructive', title: 'Hata', description: 'Bugün için vardiya bulunamadı.' });
             setIsLoading(false);
             return;
        }

        try {
            const shiftRef = doc(db, 'shifts', todaysShift.vardiyaId);
            const now = Timestamp.now();
            if(action === 'in') {
                await updateDoc(shiftRef, { girisSaati: now });
                toast({ title: 'Başارılı!', description: `Giriş saatiniz ${format(now.toDate(), 'HH:mm')} olarak kaydedildi.`});
            } else {
                await updateDoc(shiftRef, { cikisSaati: now });
                 toast({ title: 'Başارılı!', description: `Çıkış saatiniz ${format(now.toDate(), 'HH:mm')} olarak kaydedildi.`});
            }
        } catch (error) {
            console.error("Error saving clock action:", error);
            toast({ variant: 'destructive', title: 'Hata', description: 'Saat bilgisi kaydedilirken bir sorun oluştu.' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <>
        <AlertDialog open={permissionAlert.isOpen} onOpenChange={(isOpen) => setPermissionAlert(prev => ({...prev, isOpen}))}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Konum Hatası</AlertDialogTitle>
                    <AlertDialogDescription>
                       {permissionAlert.message}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    {permissionAlert.action && (
                        <AlertDialogAction onClick={() => handleClockAction(permissionAlert.action!)}>
                            Tekrar Dene
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin />
                    Hızlı Giriş / Çıkış
                </CardTitle>
                <CardDescription>
                    Konumunuz doğrulandıktan sonra giriş veya çıkış saatinizi kaydedین.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-center font-semibold text-lg p-4 bg-background rounded-md">
                    {statusMessage}
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Button size="lg" disabled={!canClockIn || isLoading} onClick={() => handleClockAction('in')}>
                        {isLoading && canClockIn ? <Loader2 className="animate-spin" /> : <LogIn />}
                        Giriş Yap
                    </Button>
                    <Button size="lg" variant="outline" disabled={!canClockOut || isLoading} onClick={() => handleClockAction('out')}>
                         {isLoading && canClockOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                        Çıkış Yap
                    </Button>
                 </div>
            </CardContent>
        </Card>
        </>
    );
};


export default function DashboardPage() {
  const { user, firebaseUser, shifts, cashEntries, salesReports, expenses, scoreEntries, performanceRules, staff } = useApp();

  const { monthlyOvertime, pendingNetBalance, performanceScore } = useMemo(() => {
    if (!user || !firebaseUser) return { monthlyOvertime: 'N/A', pendingNetBalance: 0, performanceScore: { base: 'N/A', bonus: 'N/A' } };
    
    const self = staff.find(s => s.uid === firebaseUser.uid);
    if (!self) return { monthlyOvertime: 'N/A', pendingNetBalance: 0, performanceScore: { base: 'N/A', bonus: 'N/A' } };

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const userShifts = shifts.filter(s => 
        s.personelId === self.personelId && 
        s.tarih && 
        isWithinInterval(new Date(s.tarih), { start: monthStart, end: monthEnd })
    );

    const overtime = calculateOvertimeForShifts(userShifts);

    // Calculate pending net balance for the branch
    const branchCashEntries = cashEntries.filter(e => user.role === 'genel-mudur' || e.subeId === user.branchId);
    const pendingCash = branchCashEntries
        .filter(e => e.teslimDurumu === 'beklemede')
        .reduce((sum, entry) => sum + (entry.dagilim?.reduce((s, d) => s + d.miktar, 0) || 0), 0);
        
    const branchExpenses = expenses.filter(e => user.role === 'genel-mudur' || e.subeId === user.branchId);
    const unsettledExpenses = branchExpenses
        .filter(e => !e.hesaplandi)
        .reduce((sum, exp) => sum + exp.tutar, 0);

    const netBalance = pendingCash - unsettledExpenses;
    
    // --- Performance Score Calculation ---
    const personelEntries = scoreEntries.filter(entry => 
        entry.personelId === self.personelId && 
        isWithinInterval(entry.tarih, { start: monthStart, end: monthEnd })
    );

    const directScore = personelEntries.reduce((sum, entry) => sum + entry.puan, 0);

    let purityBonuses: Record<PerformanceRuleCategory, number> = {
        'Operasyon ve Kalite': 5,
        'Davranış ve Disiplin': 5,
        'Müşteri Memnuniyeti': 5,
    };
    let categoryErrorCounts: Record<PerformanceRuleCategory, number> = {
        'Operasyon ve Kalite': 0,
        'Davranış ve Disiplin': 0,
        'Müşteri Memnuniyeti': 0,
    };
    
    const penaltyEntries = personelEntries
        .filter(entry => entry.puan < 0)
        .sort((a,b) => a.tarih.getTime() - b.tarih.getTime());

    penaltyEntries.forEach(entry => {
        const rule = performanceRules.find(r => r.ruleId === entry.ruleId);
        if (!rule) return;
        
        const category = rule.category;
        categoryErrorCounts[category]++;
        
        const deduction = Math.abs(rule.score) * categoryErrorCounts[category] * 0.1;
        purityBonuses[category] = Math.max(0, purityBonuses[category] - deduction);
    });
    
    const totalPurityBonus = Object.values(purityBonuses).reduce((sum, bonus) => sum + bonus, 0);
    const baseScoreComponent = 75 + directScore;

    return { 
        monthlyOvertime: overtime, 
        pendingNetBalance: netBalance, 
        performanceScore: {
            base: baseScoreComponent.toFixed(2),
            bonus: totalPurityBonus.toFixed(2)
        }
    };

  }, [user, firebaseUser, shifts, cashEntries, expenses, scoreEntries, performanceRules, staff]);


  if (!user) return null;

  const getRoleDescription = () => {
    switch (user.role) {
      case 'genel-mudur': return 'Tüm şubelerin genel durumunu buradan yönetin ve raporlara erişin.';
      case 'sube-muduru': return 'Şubenizin operasyonel durumunu buradan takip edin ve yönetin.';
      case 'calisan': return 'Sana özel bilgilere ve görevlere buradan ulaşabilirsin.';
      default: return 'Uygulamaya hoş geldiniz.';
    }
  };

  const quickLinks = [
    { href: '/dashboard/shifts', icon: Clock, title: 'Vardiya Yönetimi', description: 'Günlük ve haftalık vardiyaları yönetin.', roles: ['sube-muduru'] },
    { href: '/dashboard/cash-register', icon: Wallet, title: 'Kasa Defteri', description: 'Nakit akışını yönetin ve raporlayın.', roles: ['sube-muduru', 'genel-mudur'] },
    { href: '/dashboard/inventory', icon: Warehouse, title: 'Depo Yönetimi', description: 'Stok sayımı yapın ve envanteri takip edin.', permission: 'canManageInventory' },
    { href: '/dashboard/checklists', icon: ListChecks, title: 'Kontrol Listeleri', description: 'Günlük görevleri tamamlayın ve izleyin.', roles: ['sube-muduru', 'genel-mudur', 'calisan'] },
    { href: '/dashboard/reports', icon: AreaChart, title: 'Raporlar', description: 'Performans ve vardiya raporlarını analiz edin.', roles: ['sube-muduru', 'genel-mudur'] },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Hoş Geldiniz, {user.name}!
        </h1>
        <p className="text-muted-foreground">
          {getRoleDescription()}
        </p>
      </div>
      
       {(user.role === 'calisan' || user.role === 'sube-muduru') && <EmployeeClockInCard /> }

      {/* --- STAT CARDS --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        { (user.role === 'calisan' || user.role === 'sube-muduru') && 
            <Link href="/dashboard/reports/shift-details">
                <StatCard 
                    title="Bu Ayki Fazla Mesain"
                    value={monthlyOvertime}
                    icon={Hourglass}
                    description="Mevcut aydaki toplam fazla mesai/eksik çalışma süresi."
                />
            </Link>
        }
        { (user.role === 'calisan' || user.role === 'sube-muduru') && 
            <Link href="/dashboard/performance">
                <StatCard 
                    title="Bu Ayki Performans Puanın"
                    value={`${performanceScore.base} (${performanceScore.bonus})`}
                    icon={Award}
                    description="Detayları görmek için tıklayın."
                />
            </Link>
        }
        { user.role === 'sube-muduru' && 
             <Link href="/dashboard/cash-register">
                 <StatCard 
                    title="Bekleyen Net Bakiye"
                    value={`₺${pendingNetBalance.toFixed(2)}`}
                    icon={HandCoins}
                    description="Teslim edilecek nakit ve harcamalar sonrası net tutar."
                />
            </Link>
        }
      </div>

       {/* --- QUICK LINKS --- */}
       <div>
            <h2 className="text-xl font-semibold tracking-tight mb-4">Hızlı Erişim</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickLinks.map(link => <DashboardLinkCard key={link.href} {...link}/>)}
            </div>
       </div>

    </div>
  );
}
