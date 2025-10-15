// src/app/dashboard/page.tsx
'use client';

import { useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Clock, ListChecks, Warehouse, Wallet, Users, AlertCircle, Hourglass, HandCoins, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/dashboard/StatCard';
import { Vardiya, SalesReport } from '@/lib/types';
import { startOfMonth, endOfMonth, isWithinInterval, differenceInMinutes, addDays, format, parse, compareAsc, getDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


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


export default function DashboardPage() {
  const { user, firebaseUser, shifts, cashEntries, salesReports, expenses } = useApp();

  const { monthlyOvertime, pendingNetBalance } = useMemo(() => {
    if (!user || !firebaseUser) return { monthlyOvertime: 'N/A', pendingNetBalance: 0 };
    
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const userShifts = shifts.filter(s => 
        s.personelId === firebaseUser.uid && 
        s.tarih && 
        isWithinInterval(new Date(s.tarih), { start: monthStart, end: monthEnd })
    );

    const overtime = calculateOvertimeForShifts(userShifts);

    // Calculate pending net balance for the branch
    const branchCashEntries = cashEntries.filter(e => user.role === 'genel-mudur' || e.subeId === user.branchId);
    const pendingCash = branchCashEntries
        .filter(e => e.teslimDurumu === 'beklemede')
        .reduce((sum, entry) => sum + entry.nakitMiktari, 0);
        
    const branchExpenses = expenses.filter(e => user.role === 'genel-mudur' || e.subeId === user.branchId);
    const unsettledExpenses = branchExpenses
        .filter(e => !e.hesaplandi)
        .reduce((sum, exp) => sum + exp.tutar, 0);

    const netBalance = pendingCash - unsettledExpenses;

    return { monthlyOvertime: overtime, pendingNetBalance: netBalance };

  }, [user, firebaseUser, shifts, cashEntries, expenses]);

    const weeklySalesChartData = useMemo(() => {
        if (!salesReports || salesReports.length === 0) return [];
        
        // Sunday is 0 in date-fns, but we want it to be 7 for our sorting.
        const dayOfWeekMap: { [key: number]: string } = {
            1: 'Pazartesi', 2: 'Sali', 3: 'Carsamba',
            4: 'Persembe', 5: 'Cuma', 6: 'Cumartesi', 0: 'Pazar'
        };

        const salesByDay = salesReports.reduce((acc, report) => {
            const reportDate = new Date(report.reportDate);
            const dayKey = format(reportDate, 'yyyy-MM-dd');
            const dayOfWeek = getDay(reportDate); // Sunday = 0, Monday = 1, ...
            const dayName = dayOfWeekMap[dayOfWeek];
            
            const total = report.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

            if (!acc[dayKey]) {
                acc[dayKey] = { 
                    date: format(reportDate, 'd MMM', { locale: tr }),
                    Pazartesi: 0, Sali: 0, Carsamba: 0, Persembe: 0, Cuma: 0, Cumartesi: 0, Pazar: 0 
                };
            }
            if(dayName) {
                acc[dayKey][dayName] = (acc[dayKey][dayName] || 0) + total;
            }

            return acc;
        }, {} as Record<string, { date: string, [key: string]: number | string }>);
        
        return Object.values(salesByDay)
          .sort((a, b) => compareAsc(parse(a.date, 'd MMM', new Date(), {locale: tr}), parse(b.date, 'd MMM', new Date(), {locale: tr})))
          .slice(-30);

    }, [salesReports]);
    
    const chartConfig = {
      Pazartesi: { label: 'Pazartesi', color: 'hsl(var(--chart-1))' },
      Sali: { label: 'Salı', color: 'hsl(var(--chart-2))' },
      Carsamba: { label: 'Çarşamba', color: 'hsl(var(--chart-3))' },
      Persembe: { label: 'Perşembe', color: 'hsl(var(--chart-4))' },
      Cuma: { label: 'Cuma', color: 'hsl(var(--chart-5))' },
      Cumartesi: { label: 'Cumartesi', color: '#82ca9d' },
      Pazar: { label: 'Pazar', color: '#ffc658' },
    };


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
        { user.role === 'sube-muduru' && 
             <StatCard 
                title="Bekleyen Net Bakiye"
                value={`₺${pendingNetBalance.toFixed(2)}`}
                icon={HandCoins}
                description="Teslim edilecek nakit ve harcamalar sonrası net tutar."
            />
        }
      </div>

       {/* --- Sales Chart --- */}
       {(user.role === 'genel-mudur' || user.role === 'sube-muduru') && weeklySalesChartData.length > 0 && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <BarChart2 />
                Haftalık Satış Trendleri
             </CardTitle>
             <CardDescription>
                AI ile işlenen raporlardan elde edilen günlük ciro, haftanın günlerine göre ayrıştırılmıştır.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <ChartContainer config={chartConfig} className="h-[300px] w-full">
               <LineChart data={weeklySalesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                 <CartesianGrid vertical={false} />
                 <XAxis
                   dataKey="date"
                   tickLine={false}
                   tickMargin={10}
                   axisLine={false}
                 />
                 <YAxis
                  tickFormatter={(value) => `₺${(Number(value) / 1000).toFixed(value > 0 ? 1 : 0)}k`}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                 />
                <Tooltip
                    cursor={true}
                    content={<ChartTooltipContent
                        formatter={(value, name) => (Number(value) > 0 ? `₺${Number(value).toFixed(2)}` : null)}
                        indicator="line"
                    />}
                />
                 <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: '30px'}}/>
                 {Object.entries(chartConfig).map(([key, config]) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={config.color} strokeWidth={2} dot={false} name={config.label} />
                 ))}
               </LineChart>
             </ChartContainer>
           </CardContent>
         </Card>
       )}


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
