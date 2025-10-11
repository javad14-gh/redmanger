// src/app/dashboard/reports/shift-details/ShiftDetailsReport.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Personel, Vardiya, Sube } from '@/lib/types';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  format,
  isWithinInterval,
  setYear,
  setMonth,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { User, Building } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';



export function ShiftDetailsReport() {
  const { user, staff, shifts, branches, isLoading, firebaseUser } = useApp();
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');

  const isEmployee = user?.role === 'calisan';

  // Set default branch/staff for specific roles
  useEffect(() => {
    if (user?.role === 'sube-muduru' && user.branchId) {
      setSelectedBranch(user.branchId);
    }
    if (user?.role === 'calisan' && firebaseUser) {
      setSelectedStaff(firebaseUser.uid);
    }
  }, [user, firebaseUser]);

  const { daysInMonth, filteredStaff, shiftMap } = useMemo(() => {
    if (isLoading) return { daysInMonth: [], filteredStaff: [], shiftMap: new Map() };

    const monthStart = startOfMonth(selectedMonthDate);
    const monthEnd = endOfMonth(selectedMonthDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let staffForView = staff.filter(s => s.aktif !== false && s.rol !== 'genel-mudur');

    if (user?.role === 'sube-muduru' && user.branchId) {
      staffForView = staffForView.filter(s => s.subeId === user.branchId);
    } else if (user?.role === 'genel-mudur' && selectedBranch !== 'all') {
      staffForView = staffForView.filter(s => s.subeId === selectedBranch);
    }
    
    if (selectedStaff !== 'all') {
      staffForView = staffForView.filter(s => s.personelId === selectedStaff);
    }

    const monthlyShifts = shifts.filter(shift => 
        shift.tarih && isWithinInterval(new Date(shift.tarih), { start: monthStart, end: monthEnd })
    );

    const newShiftMap = new Map<string, Vardiya>();
    monthlyShifts.forEach(shift => {
      const key = `${shift.personelId}-${format(new Date(shift.tarih), 'yyyy-MM-dd')}`;
      newShiftMap.set(key, shift);
    });

    return { daysInMonth: days, filteredStaff: staffForView, shiftMap: newShiftMap };
  }, [isLoading, staff, shifts, selectedMonthDate, selectedBranch, selectedStaff, user]);

  const getShiftForCell = (personelId: string, day: Date): Vardiya | undefined => {
    const dateOnlyKey = `${personelId}-${format(day, 'yyyy-MM-dd')}`;
    return shiftMap.get(dateOnlyKey);
  };
  
  const staffOptionsForFilter = useMemo(() => {
    let staffList = staff.filter(s => s.aktif !== false && s.rol !== 'genel-mudur');
     if (user?.role === 'sube-muduru' && user.branchId) {
      return staffList.filter(s => s.subeId === user.branchId);
    }
    if (user?.role === 'genel-mudur' && selectedBranch !== 'all') {
        return staffList.filter(s => s.subeId === selectedBranch);
    }
    return staffList;
  }, [staff, user, selectedBranch]);
  
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
            <Skeleton className="h-10 w-full max-w-lg" />
            <div className="rounded-md border p-4 space-y-2">
                 <Skeleton className="h-8 w-1/4" />
                 <Skeleton className="h-40 w-full" />
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-4">
       <div className='flex flex-wrap gap-4'>
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

            {user?.role === 'genel-mudur' && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[200px]">
                        <Building className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Şube Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Şubeler</SelectItem>
                        {branches.map(b => <SelectItem key={b.subeId} value={b.subeId}>{b.adi}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
             <Select value={selectedStaff} onValueChange={setSelectedStaff} disabled={isEmployee}>
                <SelectTrigger className="w-[200px]">
                    <User className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Personel Seçin" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tüm Personel</SelectItem>
                     {staffOptionsForFilter.map(s => <SelectItem key={s.personelId} value={s.personelId}>{s.adi}</SelectItem>)}
                </SelectContent>
            </Select>
       </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='min-w-[120px] sticky left-0 bg-card z-10'>Tarih</TableHead>
              {filteredStaff.map(personel => (
                <TableHead key={personel.personelId} className="text-center min-w-[150px]">
                  {personel.adi}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {daysInMonth.length > 0 ? (
                daysInMonth.map(day => (
                    <TableRow key={day.toString()}>
                        <TableCell className='font-medium sticky left-0 bg-card z-10'>
                           <div className='flex flex-col'>
                                <span>{format(day, 'd MMM', { locale: tr })}</span>
                                <span className='text-xs text-muted-foreground'>{format(day, 'EEE', { locale: tr })}</span>
                           </div>
                        </TableCell>
                        {filteredStaff.length > 0 ? filteredStaff.map(personel => {
                            const shift = getShiftForCell(personel.personelId, day);
                            return (
                                <TableCell key={personel.personelId} className="text-center p-2 text-xs">
                                  {shift ? (
                                    shift.tur === 'izinli' ? (
                                      <Badge variant="secondary">İzinli</Badge>
                                    ) : (
                                      <div className='flex flex-col'>
                                        {shift.girisSaati && <span className='font-semibold'>{format(new Date(shift.girisSaati), 'HH:mm')}</span>}
                                        {shift.cikisSaati && <span className='text-muted-foreground'>{format(new Date(shift.cikisSaati), 'HH:mm')}</span>}
                                        {!shift.girisSaati && shift.planliGiris && <span className='text-blue-500'>Planlandı</span>}
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                            )
                        }) : (
                           <TableCell colSpan={1} className="h-24 text-center">
                             Personel bulunamadı.
                           </TableCell>
                        )}
                    </TableRow>
                ))
            ) : (
                 <TableRow>
                    <TableCell colSpan={filteredStaff.length + 1} className="h-24 text-center">
                        Seçili ay için gösterilecek veri bulunmuyor.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
