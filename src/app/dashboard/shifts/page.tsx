// src/app/dashboard/shifts/page.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, User, Save, Users, CalendarDays, Check, X, Pencil, Loader2, Ban, LogIn, LogOut, Share2 } from 'lucide-react';
import { format, isSameDay, differenceInMinutes, set, addDays, startOfDay, addMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Vardiya, Personel } from '@/lib/types';
import { cn, getBusinessDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, Timestamp, writeBatch, query, where, deleteField, setDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';


// Helper to combine a date and a time string (HH:mm) into a Date object, respecting the target timezone (Turkey UTC+3)
const combineDateAndTime = (date: Date, timeString: string): Date | undefined => {
    if (!timeString) return undefined;
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return undefined;

    // 1. Create a local date object with the desired time.
    // This will be in the browser's current timezone (e.g., Dubai time).
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);

    // 2. Get the timezone offset for that specific local date.
    // The offset is the difference in minutes between UTC and the local time.
    // A positive offset means the local time is behind UTC (e.g., Americas).
    // A negative offset means the local time is ahead of UTC (e.g., Asia).
    const localOffsetInMinutes = localDate.getTimezoneOffset();

    // 3. The offset for Turkey (UTC+3) is -180 minutes.
    const turkeyOffsetInMinutes = -180;

    // 4. Calculate the difference between the local offset and Turkey's offset.
    const offsetDifference = localOffsetInMinutes - turkeyOffsetInMinutes;

    // 5. Add this difference back to the local date to get the correct UTC time
    // that will represent the intended Turkey time.
    const turkeyDate = new Date(localDate.getTime() + offsetDifference * 60 * 1000);

    return turkeyDate;
};


const getStaffAvatar = (personel: Personel) => personel.avatarUrl || `https://picsum.photos/seed/${personel.personelId}/100/100`;
const getStaffInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P';


const DailyTrackingTab = () => {
    const { user, staff, shifts: appShifts } = useApp();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [shiftValues, setShiftValues] = useState<Record<string, { girisSaati: string, cikisSaati: string }>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

    const visibleStaff = useMemo(() => {
        if (!user || user.role !== 'sube-muduru' || !user.branchId) return [];
        return staff.filter(s => s.subeId === user.branchId && s.aktif !== false);
    }, [user, staff]);

    const dailyShifts = useMemo(() => {
        const shiftsForDay = appShifts.filter(s => s.tarih && isSameDay(new Date(s.tarih), selectedDate));
        const shiftMap = new Map<string, Vardiya>();
        shiftsForDay.forEach(s => shiftMap.set(s.personelId, s));
        return shiftMap;
    }, [appShifts, selectedDate]);
    
    // Function to populate shiftValues from dailyShifts
    const populateShiftValues = useCallback(() => {
        const newShiftValues: Record<string, { girisSaati: string, cikisSaati: string }> = {};
        visibleStaff.forEach(p => {
            const shift = dailyShifts.get(p.uid);
            newShiftValues[p.uid] = {
                girisSaati: shift?.girisSaati ? format(new Date(shift.girisSaati), 'HH:mm') : '',
                cikisSaati: shift?.cikisSaati ? format(new Date(shift.cikisSaati), 'HH:mm') : ''
            };
        });
        setShiftValues(newShiftValues);
    }, [visibleStaff, dailyShifts]);

    // Effect to populate shiftValues when data changes
    useEffect(() => {
        populateShiftValues();
    }, [populateShiftValues]);

    const handleTimeChange = (personelId: string, field: 'girisSaati' | 'cikisSaati', value: string) => {
        setShiftValues(prev => ({
            ...prev,
            [personelId]: { ...prev[personelId], [field]: value }
        }));
    };
    
    const handleQuickAction = (personelId: string, action: 'clockIn' | 'clockOut') => {
        const now = format(new Date(), 'HH:mm');
        const field = action === 'clockIn' ? 'girisSaati' : 'cikisSaati';
        handleTimeChange(personelId, field, now);
        toast({ title: 'Saat Güncellendi', description: `${action === 'clockIn' ? 'Giriş' : 'Çıkış'} saati ${now} olarak ayarlandı.`});
    };

    const handleEditRow = (personelId: string) => {
        populateShiftValues(); // Ensure values are fresh before editing
        setEditingRow(personelId);
    };

    const handleCancelEdit = () => {
        populateShiftValues(); // Revert any changes
        setEditingRow(null);
    };
    
    const handleSaveRow = async (personelId: string) => {
        setSavingStates(prev => ({ ...prev, [personelId]: true }));
        const existingShift = dailyShifts.get(personelId);
        const times = shiftValues[personelId];

        if (!existingShift) {
            toast({ title: 'Hata', description: 'Bu personel için planlanmış bir vardiya bulunamadı.', variant: 'destructive'});
            setSavingStates(prev => ({ ...prev, [personelId]: false }));
            return;
        }
        
        // Prevent saving if it's a leave day
        if (existingShift.tur === 'izinli') {
             toast({ title: 'Uyarı', description: 'İzinli bir gün için saat kaydedilemez.', variant: 'default'});
             setSavingStates(prev => ({ ...prev, [personelId]: false }));
             return;
        }

        const girisDate = combineDateAndTime(selectedDate, times.girisSaati);
        let cikisDate = combineDateAndTime(selectedDate, times.cikisSaati);

        if (cikisDate && girisDate && cikisDate < girisDate) {
            cikisDate = addDays(cikisDate, 1);
        }
        
        try {
            const shiftRef = doc(db, 'shifts', existingShift.vardiyaId);
            const updateData: any = {};
            
            // Always re-calculate and save the times to fix timezone issues on old data
            updateData.girisSaati = girisDate ? Timestamp.fromDate(girisDate) : deleteField();
            updateData.cikisSaati = cikisDate ? Timestamp.fromDate(cikisDate) : deleteField();

            await updateDoc(shiftRef, updateData);
            toast({ title: 'Başarılı', description: `${existingShift.personelAdi} için değişiklikler kaydedildi.`});
            setEditingRow(null); // Exit edit mode
        } catch(error) {
            console.error(error);
            toast({ title: 'Hata', description: 'Değişiklikler kaydedilemedi.', variant: 'destructive'});
        } finally {
            setSavingStates(prev => ({ ...prev, [personelId]: false }));
        }
    };

    const calculateStatus = (personelId: string) => {
        const shift = dailyShifts.get(personelId);
        
        if (shift?.tur === 'izinli') return <Badge variant="secondary">İzinli</Badge>;
        if (!shift) return <Badge variant="outline">Tanımsız</Badge>;
        
        const girisSaati = shift.girisSaati ? new Date(shift.girisSaati) : undefined;
        let cikisSaati = shift.cikisSaati ? new Date(shift.cikisSaati) : undefined;
        
        if (!girisSaati || !cikisSaati || !shift.planliSureDakika) {
            return <Badge variant="outline">Beklemede</Badge>;
        }

        if (cikisSaati < girisSaati) {
            cikisSaati = addDays(cikisSaati, 1);
        }
        
        const actualDuration = differenceInMinutes(cikisSaati, girisSaati);
        const overtime = actualDuration - shift.planliSureDakika;

        const sign = overtime < 0 ? '-' : '+';
        const absMins = Math.abs(overtime);
        const hours = Math.floor(absMins / 60);
        const minutes = absMins % 60;
        const overtimeText = `${sign}${hours}s ${minutes}d`;
        
        if (overtime > 0) return <Badge className="bg-green-600 hover:bg-green-700">{overtimeText}</Badge>;
        if (overtime < 0) return <Badge variant="destructive">{overtimeText}</Badge>;
        return <Badge variant="default">Tamam</Badge>;
    };
    
    const renderQuickActionButton = (personelId: string) => {
        const values = shiftValues[personelId] || { girisSaati: '', cikisSaati: '' };
        if (!values.girisSaati) {
            return (
                <Button size="sm" variant="outline" onClick={() => handleQuickAction(personelId, 'clockIn')}>
                    <LogIn className="mr-2 h-4 w-4" /> Giriş
                </Button>
            );
        }
        if (values.girisSaati && !values.cikisSaati) {
            return (
                <Button size="sm" variant="outline" onClick={() => handleQuickAction(personelId, 'clockOut')}>
                    <LogOut className="mr-2 h-4 w-4" /> Çıkış
                </Button>
            );
        }
        return null; // Both are filled, so hide the button
    };


    return (
         <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div className='space-y-1.5'>
                    <CardTitle className="flex items-center gap-2">
                        <Clock />
                        Günlük Vardiya Takibi
                    </CardTitle>
                    <CardDescription>
                       Personelin giriş/çıkış saatlerini kaydedin.
                    </CardDescription>
                </div>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={'outline'}
                            className={cn('w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, 'PPP', { locale: tr }) : <span>Tarih seçin</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Personel</TableHead>
                                <TableHead>Giriş / Çıkış</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleStaff.length > 0 ? (
                                visibleStaff.map((personel) => {
                                    const isCurrentEditing = editingRow === personel.uid;
                                    const shift = dailyShifts.get(personel.uid);
                                    const isLeave = shift?.tur === 'izinli';
                                    const values = shiftValues[personel.uid] || { girisSaati: '', cikisSaati: '' };

                                    return (
                                        <TableRow key={personel.personelId} className={isCurrentEditing ? 'bg-muted/50' : ''}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={getStaffAvatar(personel)} />
                                                        <AvatarFallback>{getStaffInitials(personel.adi)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{personel.adi}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isCurrentEditing ? (
                                                     <div className="flex items-center gap-1">
                                                        <Input type="time" className="w-24 h-8" value={values.girisSaati} onChange={e => handleTimeChange(personel.uid, 'girisSaati', e.target.value)} />
                                                        <span>-</span>
                                                        <Input type="time" className="w-24 h-8" value={values.cikisSaati} onChange={e => handleTimeChange(personel.uid, 'cikisSaati', e.target.value)} />
                                                    </div>
                                                ) : (
                                                    isLeave ? (
                                                        <span className='text-muted-foreground'>-- İzinli --</span>
                                                    ) : (
                                                        <span className='font-mono'>{values.girisSaati || '--:--'} - {values.cikisSaati || '--:--'}</span>
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell>{calculateStatus(personel.uid)}</TableCell>
                                            <TableCell className="text-right">
                                                {isCurrentEditing ? (
                                                     <div className="flex gap-2 justify-end">
                                                        {renderQuickActionButton(personel.uid)}
                                                        <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X/></Button>
                                                        <Button size="icon" onClick={() => handleSaveRow(personel.uid)} disabled={savingStates[personel.uid]}>
                                                            {savingStates[personel.uid] ? <Loader2 className="animate-spin" /> : <Save />}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                     <Button size="icon" variant="ghost" onClick={() => handleEditRow(personel.uid)} disabled={isLeave}>
                                                        {isLeave ? <Ban className="text-muted-foreground" /> : <Pencil />}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Bu şubede gösterilecek aktif personel bulunmuyor.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
         </Card>
    );
};

const ShiftPlanningTab = () => {
    const { user, staff, shifts: appShifts } = useApp();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isShareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareableText, setShareableText] = useState('');

    const [shiftData, setShiftData] = useState<Record<string, { tur: 'calisma' | 'izinli', planliGiris: string }>>({});

    const visibleStaff = useMemo(() => {
        if (!user || user.role !== 'sube-muduru' || !user.branchId) return [];
        return staff.filter(s => s.subeId === user.branchId && s.aktif !== false);
    }, [user, staff]);

    const dailyShifts = useMemo(() => {
        const shiftsForDay = appShifts.filter(s => s.tarih && isSameDay(new Date(s.tarih), selectedDate));
        const shiftMap = new Map<string, Vardiya>();
        shiftsForDay.forEach(s => shiftMap.set(s.personelId, s));
        return shiftMap;
    }, [appShifts, selectedDate]);

    // Populates the form data when dailyShifts changes or editing starts
    useEffect(() => {
        const newShiftData: typeof shiftData = {};
        visibleStaff.forEach(personel => {
            const shift = dailyShifts.get(personel.uid);
            newShiftData[personel.uid] = {
                tur: shift?.tur || 'calisma',
                planliGiris: shift?.planliGiris ? format(new Date(shift.planliGiris), 'HH:mm') : '09:00',
            }
        });
        setShiftData(newShiftData);
    }, [visibleStaff, dailyShifts, isEditing]); // Reruns when editing is toggled

    const handleShiftDataChange = (personelId: string, field: keyof typeof shiftData[''], value: string) => {
        setShiftData(prev => ({
            ...prev,
            [personelId]: { ...prev[personelId], [field]: value }
        }));
    };

    const handleSave = async () => {
        if (!user?.branchId) return;
        setIsSaving(true);
        const batch = writeBatch(db);

        for (const personel of visibleStaff) {
            const personelId = personel.uid;
            const data = shiftData[personelId];
            if (!data) continue;

            const existingShift = dailyShifts.get(personelId);

            const shiftPayload: any = {
                subeId: user.branchId,
                personelId: personelId,
                personelAdi: personel.adi, // Denormalize name
                tarih: Timestamp.fromDate(startOfDay(selectedDate)),
                tur: data.tur,
                // ALWAYS update the duration based on the profile
                planliSureDakika: (personel.tanimlananSaat || 8) * 60,
            };

            if (data.tur === 'calisma') {
                const combinedDate = combineDateAndTime(selectedDate, data.planliGiris);
                if (!combinedDate) {
                    toast({title: "Hata", description: `${personel.adi} için geçersiz saat formatı.`, variant: "destructive"});
                    setIsSaving(false);
                    return;
                }
                shiftPayload.planliGiris = Timestamp.fromDate(combinedDate);
            } else {
                shiftPayload.planliGiris = deleteField();
                // We keep planliSureDakika for leave days for potential reporting, but remove times
                shiftPayload.girisSaati = deleteField();
                shiftPayload.cikisSaati = deleteField();
            }
            
            if(existingShift) {
                const shiftRef = doc(db, 'shifts', existingShift.vardiyaId);
                batch.update(shiftRef, shiftPayload);
            } else {
                const newShiftRef = doc(collection(db, 'shifts'));
                shiftPayload.vardiyaId = newShiftRef.id;
                batch.set(newShiftRef, shiftPayload, { merge: true });
            }
        }
        
        try {
            await batch.commit();
            toast({ title: 'Başarılı', description: 'Vardiya planı kaydedildi.'});
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving shift plan:", error);
            toast({ title: 'Hata', description: 'Vardiya planı kaydedilemedi.', variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    };
    
    const generateShareableText = () => {
        let text = `**Vardiya Planı - ${format(selectedDate, 'd MMMM yyyy, EEEE', { locale: tr })}**\n\n`;
        
        const staffOnly = visibleStaff.filter(p => p.rol === 'calisan');

        staffOnly.forEach(personel => {
            const shift = dailyShifts.get(personel.uid);
            text += `- ${personel.adi}: `;
            
            if (shift?.tur === 'izinli') {
                text += `izinli\n`;
            } else if (shift?.planliGiris) {
                const startTime = format(new Date(shift.planliGiris), 'HH:mm');
                text += `${startTime}\n`;
            } else {
                text += `Tanımsız\n`;
            }
        });
        
        text += '\nİyi çalışmalar!';
        setShareableText(text);
        setShareDialogOpen(true);
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(shareableText).then(() => {
            toast({ title: 'Kopyalandı!', description: 'Vardiya planı panoya kopyalandı.' });
            setShareDialogOpen(false);
        }).catch(err => {
            toast({ title: 'Hata', description: 'Metin kopyalanamadı.', variant: 'destructive' });
        });
    };


    const renderShiftInfo = (personel: Personel) => {
        const shift = dailyShifts.get(personel.uid);
        if (shift?.tur === 'izinli') return <Badge variant="secondary">İzinli</Badge>;
        
        const sureDakika = shift?.planliSureDakika || (personel.tanimlananSaat || 8) * 60;
        
        if (!shift?.planliGiris) return <Badge variant="outline">Tanımsız</Badge>;

        const plannedEndTime = addMinutes(new Date(shift.planliGiris), sureDakika);
        return `${format(new Date(shift.planliGiris), 'HH:mm')} - ${format(plannedEndTime, 'HH:mm')} (${sureDakika/60} sa)`;
    }

    return (
        <>
            <Dialog open={isShareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Paylaşım Metni Oluştur</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki metni kopyalayıp grup sohbetinde paylaşabilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        readOnly
                        value={shareableText}
                        rows={visibleStaff.filter(p => p.rol === 'calisan').length + 4}
                        className="font-mono bg-muted"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShareDialogOpen(false)}>İptal</Button>
                        <Button onClick={handleCopyText}>Metni Kopyala</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div className='space-y-1.5'>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays />
                            Vardiya Planlama
                        </CardTitle>
                        <CardDescription>
                           Personel için günlük vardiyaları planlayın.
                        </CardDescription>
                    </div>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={'outline'}
                                className={cn('w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, 'PPP', { locale: tr }) : <span>Tarih seçin</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => { if (date) { setSelectedDate(date); setIsEditing(false); } }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <>
                        <Alert variant="default" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Düzenleme Modu</AlertTitle>
                            <AlertDescription>
                                Personel için çalışma günü/izin günü seçimi yapın ve başlangıç saatini ayarlayın. Süre, personelin profilinden otomatik alınacaktır.
                            </AlertDescription>
                        </Alert>
                        <div className="rounded-md border">
                            <Table>
                                 <TableHeader>
                                    <TableRow>
                                        <TableHead>Personel</TableHead>
                                        <TableHead>Tür</TableHead>
                                        <TableHead>Planlama</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleStaff.map(personel => (
                                        <TableRow key={personel.personelId}>
                                            <TableCell className="font-medium">{personel.adi}</TableCell>
                                            <TableCell>
                                                <RadioGroup
                                                    value={shiftData[personel.uid]?.tur || 'calisma'}
                                                    onValueChange={(val: 'calisma' | 'izinli') => handleShiftDataChange(personel.uid, 'tur', val)}
                                                    className="flex gap-4"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="calisma" id={`calisma-${personel.personelId}`} />
                                                        <Label htmlFor={`calisma-${personel.personelId}`}>Çalışma</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="izinli" id={`izinli-${personel.personelId}`} />
                                                        <Label htmlFor={`izinli-${personel.personelId}`}>İzinli</Label>
                                                    </div>
                                                </RadioGroup>
                                            </TableCell>
                                            <TableCell>
                                                {shiftData[personel.uid]?.tur === 'calisma' && (
                                                     <div className="flex items-center gap-2">
                                                        <Input type="time" className="w-24 h-8" value={shiftData[personel.uid]?.planliGiris} onChange={e => handleShiftDataChange(personel.uid, 'planliGiris', e.target.value)} />
                                                        <Badge variant="outline">({personel.tanimlananSaat || 8} saat)</Badge>
                                                     </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                         <div className="flex justify-end gap-2 mt-4">
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>İptal</Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save/>}
                                Tümünü Kaydet
                            </Button>
                         </div>
                         </>
                    ) : (
                        <>
                        <div className="rounded-md border">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Personel</TableHead>
                                        <TableHead>Tanımlı Vardiya</TableHead>
                                    </TableRow>
                                </TableHeader>
                                 <TableBody>
                                    {visibleStaff.map(personel => (
                                         <TableRow key={personel.personelId}>
                                             <TableCell>
                                                 <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={getStaffAvatar(personel)} />
                                                        <AvatarFallback>{getStaffInitials(personel.adi)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{personel.adi}</span>
                                                </div>
                                             </TableCell>
                                             <TableCell>{renderShiftInfo(personel)}</TableCell>
                                         </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                        </div>
                         <div className="flex justify-end gap-2 mt-4">
                             <Button variant="outline" onClick={generateShareableText} disabled={dailyShifts.size === 0}>
                                <Share2 /> Paylaşım Metni Oluştur
                            </Button>
                            <Button onClick={() => setIsEditing(true)}><Pencil/> Düzenle</Button>
                        </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </>
    );
}

const EmployeeShiftView = () => {
    const { user, shifts: allShifts, firebaseUser } = useApp();

    if (!user || !firebaseUser) return null;
    
    // Get shifts from today onwards
    const upcomingShifts = allShifts
        .filter(s => s.personelId === firebaseUser.uid && s.tarih && startOfDay(new Date(s.tarih)) >= startOfDay(new Date()))
        .sort((a,b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
        .slice(0, 5);

    return (
        <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <User />
                    Yaklaşan Vardiyaların
                </CardTitle>
                 <CardDescription>
                   Gelecek 5 vardiyan aşağıda listelenmiştir.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {upcomingShifts.length > 0 ? (
                    <div className='space-y-2'>
                    {upcomingShifts.map(s => {
                        let plannedEndTime = null;
                        if (s.tur === 'calisma' && s.planliGiris instanceof Date && s.planliSureDakika) {
                             plannedEndTime = addMinutes(s.planliGiris, s.planliSureDakika);
                        }

                        return (
                            <div key={s.vardiyaId} className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                                <div>
                                    <p className='font-semibold'>{s.tarih ? format(new Date(s.tarih), 'd MMMM yyyy, EEEE', {locale: tr}) : 'Tarih Belirsiz'}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        {s.tur === 'izinli'
                                            ? "İzinli (Ücretli)"
                                            : (s.planliGiris instanceof Date && plannedEndTime instanceof Date ? `${format(s.planliGiris, 'HH:mm')} - ${format(plannedEndTime, 'HH:mm')}` : 'Tanımsız')
                                        }
                                    </p>
                                </div>
                                <Badge variant={s.tur === 'izinli' ? 'secondary' : 'default'}>Onaylandı</Badge>
                            </div>
                        )
                    })}
                    </div>
                ) : (
                    <p className='text-sm text-muted-foreground text-center py-8'>Yaklaşan vardiyanız bulunmamaktadır.</p>
                )}
            </CardContent>
        </Card>
    );
};


export default function ShiftsPage() {
  const { user } = useApp();

  const getRoleSpecificView = () => {
    switch (user?.role) {
      case 'sube-muduru':
        return (
             <Tabs defaultValue="daily-tracking" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="daily-tracking">Günlük Takip</TabsTrigger>
                    <TabsTrigger value="planning">Vardiya Planlama</TabsTrigger>
                </TabsList>
                <TabsContent value="daily-tracking" className='pt-6'>
                    <DailyTrackingTab />
                </TabsContent>
                <TabsContent value="planning" className='pt-6'>
                    <ShiftPlanningTab />
                </TabsContent>
            </Tabs>
        );
      case 'calisan':
        return <EmployeeShiftView />;
      case 'genel-mudur':
         return (
             <Card>
                <CardHeader>
                    <CardTitle>Vardiya Yönetimi</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Vardiya yönetimi operasyonel bir işlemdir ve şube müdürleri tarafından yapılır. Lütfen verileri <a href="/dashboard/reports/shift-details" className="text-primary underline">Detaylı Vardiya Raporu</a> sayfasından takip edin.</p>
                </CardContent>
            </Card>
         );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Vardiya Yönetimi
        </h1>
        <p className="text-muted-foreground">
          {user?.role === 'calisan' 
            ? 'Yaklaşan vardiyalarını buradan takip edebilirsin.'
            : 'Personel vardiyalarını ve fazla mesailerini günlük olarak görüntüleyin.'
          }
        </p>
      </div>
      
      {getRoleSpecificView()}

    </div>
  );
}
