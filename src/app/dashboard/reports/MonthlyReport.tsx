// src/app/dashboard/reports/MonthlyReport.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Personel, Vardiya, Sube } from '@/lib/types';
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  differenceInMinutes,
  addDays,
  format,
  setMonth,
  setYear,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const formatMinutesToHours = (mins: number) => {
  if (isNaN(mins) || !isFinite(mins)) return '0 saat';
  
  const sign = mins < 0 ? '- ' : '';
  const absMins = Math.abs(mins);
  const hours = Math.floor(absMins / 60);
  const minutes = absMins % 60;
  
  if (hours === 0 && minutes === 0) return '0 saat';
  
  return `${sign}${hours} sa ${minutes} dk`;
};

const getStaffAvatar = (personel: Personel) => personel.avatarUrl || `https://picsum.photos/seed/${personel.personelId}/100/100`;
const getStaffInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P';

const ReportTable = ({ reportData }: { reportData: any[] }) => {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Çalışılan Gün Sayısı</TableHead>
                    <TableHead>İzin Günü Sayısı</TableHead>
                    <TableHead>Toplam Fazla Mesai</TableHead>
                    <TableHead>Toplam Gecikme Sayısı</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.length > 0 ? (
                    reportData.map(report => (
                        <TableRow key={report.personelId}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={getStaffAvatar(report as any)} />
                                    <AvatarFallback>{getStaffInitials(report.adi)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{report.adi}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-medium">{report.workedDays} gün</TableCell>
                        <TableCell className="font-medium">{report.leaveDays} gün</TableCell>
                        <TableCell className="font-medium">{report.totalOvertime}</TableCell>
                        <TableCell className="font-medium">{report.totalLatenessCount} kez</TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                        Bu grup için gösterilecek veri bulunmuyor.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

export function MonthlyReport() {
  const { user, staff, shifts, branches, isLoading, firebaseUser } = useApp();
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [showInactive, setShowInactive] = useState(false);


  const { reportData, groupedReportData } = useMemo(() => {
    if (!user || staff.length === 0 || !firebaseUser) return { reportData: [], groupedReportData: {} };

    const monthStart = startOfMonth(selectedMonthDate);
    const monthEnd = endOfMonth(selectedMonthDate);
    
    const monthlyShifts = shifts.filter(shift => 
      shift.tarih && isWithinInterval(new Date(shift.tarih), { start: monthStart, end: monthEnd })
    );
    
    const processPersonel = (personel: Personel) => {
        const personShifts = monthlyShifts.filter(s => s.personelId === personel.personelId);
        
        let totalOvertimeMinutes = 0;
        let totalLatenessCount = 0;
        
        const leaveDays = personShifts.filter(s => s.tur === 'izinli').length;
        const workShifts = personShifts.filter(s => s.tur === 'calisma');
        const workedDays = personShifts.length;


        workShifts.forEach(shift => {
            if (shift.girisSaati && shift.cikisSaati && shift.planliSureDakika) {
                let giris = new Date(shift.girisSaati);
                let cikis = new Date(shift.cikisSaati);

                if (cikis < giris) {
                    cikis = addDays(cikis, 1);
                }
                
                const durationMinutes = differenceInMinutes(cikis, giris);
                const overtime = durationMinutes - shift.planliSureDakika;
                totalOvertimeMinutes += overtime;
            }

            if (shift.planliGiris && shift.girisSaati) {
                if (new Date(shift.girisSaati) > new Date(shift.planliGiris)) {
                    totalLatenessCount += 1;
                }
            }
        });

        return {
            personelId: personel.personelId,
            adi: personel.adi,
            avatarUrl: personel.avatarUrl,
            workedDays: workedDays,
            leaveDays: leaveDays,
            totalOvertime: formatMinutesToHours(totalOvertimeMinutes),
            totalLatenessCount: totalLatenessCount,
        };
    }
    
    let staffToProcess = staff;
    if (!showInactive) {
        staffToProcess = staff.filter(s => s.aktif !== false);
    }
    
    // Handle employee role first
    if (user.role === 'calisan') {
        const self = staffToProcess.find(s => s.personelId === firebaseUser.uid);
        const selfReport = self ? [processPersonel(self)] : [];
        return { reportData: selfReport, groupedReportData: {} };
    }

    if (user.role === 'genel-mudur') {
        const groupedData = staffToProcess
            .filter(s => s.rol !== 'genel-mudur')
            .reduce((acc, personel) => {
                if (!personel.subeId) return acc;
                const branchId = personel.subeId;
                if (!acc[branchId]) {
                    acc[branchId] = [];
                }
                acc[branchId].push(processPersonel(personel));
                return acc;
            }, {} as Record<string, any[]>);
        return { reportData: [], groupedReportData: groupedData };
    } else if (user.role === 'sube-muduru') {
        const branchStaff = user.branchId ? staffToProcess.filter(s => s.subeId === user.branchId) : [];
        const flatData = branchStaff.map(processPersonel);
        return { reportData: flatData, groupedReportData: {} };
    }
    
    return { reportData: [], groupedReportData: {} };

  }, [user, staff, shifts, selectedMonthDate, firebaseUser, showInactive]);
  
  const getBranchName = (branchId: string) => branches.find(b => b.subeId === branchId)?.adi || 'Bilinmeyen Şube';
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2000, i), 'LLLL', { locale: tr }),
  }));

  const handleYearChange = (year: string) => {
    setSelectedMonthDate(prev => setYear(prev, parseInt(year, 10)));
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonthDate(prev => setMonth(prev, parseInt(month, 10)));
  };


  if (isLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="rounded-md border p-4 space-y-2">
                 <Skeleton className="h-8 w-1/4" />
                 <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
  }

  const isGeneralManager = user?.role === 'genel-mudur';
  const isEmployee = user?.role === 'calisan';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={String(selectedMonthDate.getFullYear())}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedMonthDate.getMonth())}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ay" />
          </SelectTrigger>
          <SelectContent>
            {months.map(month => (
              <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isEmployee && (
            <div className="flex items-center space-x-2">
                <Switch id="show-inactive-monthly" checked={showInactive} onCheckedChange={setShowInactive} />
                <Label htmlFor="show-inactive-monthly">Ayrılanları Göster</Label>
            </div>
        )}

      </div>


      {isGeneralManager ? (
        Object.keys(groupedReportData).length > 0 ? (
            <Accordion type="multiple" defaultValue={Object.keys(groupedReportData)} className="w-full space-y-4">
                {Object.entries(groupedReportData).map(([branchId, data]) => (
                     <AccordionItem value={branchId} key={branchId} className="border rounded-lg bg-card">
                        <AccordionTrigger className="px-4 text-lg font-medium hover:no-underline">
                           <div className='flex items-center gap-2'>
                             <Building className="h-5 w-5 text-primary" />
                             {getBranchName(branchId)} ({data.length} personel)
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0">
                            <ReportTable reportData={data} />
                        </AccordionContent>
                     </AccordionItem>
                ))}
            </Accordion>
        ) : (
             <div className="h-24 flex items-center justify-center text-muted-foreground">
                Seçili ay için gösterilecek veri bulunmuyor.
            </div>
        )
      ) : (
        <ReportTable reportData={reportData} />
      )}
    </div>
  );
}
