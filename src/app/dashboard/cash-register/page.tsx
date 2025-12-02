// src/app/dashboard/cash-register/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, Timestamp, serverTimestamp, where, query, orderBy, getDocs, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { CashEntry, Personel, Sube, Expense, AppUser, NakitDagilimDetayi } from '@/lib/types';
import { format, isSameDay, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn, getBusinessDate } from '@/lib/utils';
import { Loader2, Wallet, HandCoins, CheckCheck, PiggyBank, Calendar as CalendarIcon, FileText, Building, CreditCard, MinusCircle, PlusCircle, CheckCircle2, CircleAlert, ArrowRightLeft, FileDown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


const DailyEntryTab = ({ staff, branchId, personelId, todaysEntry, pendingAmount, unsettledExpenses, personelName, selectedDate, onDateChange }: { staff: Personel[], branchId: string, personelId: string, todaysEntry?: CashEntry, pendingAmount: number, unsettledExpenses: number, personelName: string, selectedDate: Date, onDateChange: (date: Date) => void }) => {
    const { toast } = useToast();
    const [distribution, setDistribution] = useState<Record<string, number | ''>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const branchManagers = useMemo(() => staff.filter(s => s.rol === 'sube-muduru' || s.rol === 'genel-mudur'), [staff]);

    useEffect(() => {
        const initialDistribution: Record<string, number | ''> = {};
        branchManagers.forEach(manager => {
            const existing = todaysEntry?.dagilim.find(d => d.personelId === manager.personelId);
            initialDistribution[manager.personelId] = existing ? existing.miktar : '';
        });
        setDistribution(initialDistribution);
    }, [todaysEntry, branchManagers]);

    const handleAmountChange = (managerId: string, amount: string) => {
        const numericAmount = amount === '' ? '' : parseFloat(amount);
        setDistribution(prev => ({
            ...prev,
            [managerId]: numericAmount
        }));
    };
    
    const totalAmount = useMemo(() => {
        return Object.values(distribution).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
    }, [distribution]);

    const handleSave = async () => {
        if (!branchId || !personelId) {
            toast({ title: 'Hata', description: 'Kullanıcı veya şube bilgisi eksik.', variant: 'destructive' });
            return;
        }

        const dagilim: NakitDagilimDetayi[] = Object.entries(distribution)
            .map(([managerId, miktar]) => {
                const manager = branchManagers.find(m => m.personelId === managerId);
                if (manager && Number(miktar) > 0) {
                    return {
                        personelId: managerId,
                        adi: manager.adi,
                        miktar: Number(miktar)
                    };
                }
                return null;
            })
            .filter((item): item is NakitDagilimDetayi => item !== null);
        
        if (dagilim.length === 0) {
            toast({ title: 'Hata', description: 'Lütfen en az bir yönetici için tutar girin.', variant: 'destructive' });
            return;
        }


        setIsSubmitting(true);
        try {
            const businessDate = startOfDay(selectedDate);
            const docId = `${branchId}_${format(businessDate, 'yyyy-MM-dd')}`;
            const docRef = doc(db, 'cashEntries', docId);
            
            const entryData: Partial<CashEntry> = {
                subeId: branchId,
                personelId: personelId,
                personelAdi: personelName,
                islemTarihi: businessDate,
                zamanDamgasi: new Date(),
                dagilim: dagilim,
                teslimDurumu: 'beklemede', // Default status
            };
            
            await setDoc(docRef, entryData, { merge: true });

            toast({ title: 'Başarılı', description: 'Kasa kaydı başarıyla kaydedildi.' });
        } catch (error) {
            console.error("Error saving cash entry: ", error);
            toast({ title: 'Hata', description: 'Kasa kaydı kaydedilirken bir hata oluştu.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isEntryEditable = !todaysEntry || todaysEntry.teslimDurumu !== 'teslim edildi';

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <CardHeader className="p-0 flex-row justify-between items-center">
                    <div>
                        <CardTitle>Günün Kaydı</CardTitle>
                        <CardDescription>Her yöneticinin uhdesindeki nakit tutarını girin.</CardDescription>
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
                                onSelect={(date) => date && onDateChange(date)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </CardHeader>
                <div className="space-y-4">
                    <div className='space-y-3 rounded-md border p-4'>
                        <h4 className="font-medium flex items-center gap-2"><Users/> Yönetici Nakit Dağılımı</h4>
                        {branchManagers.map(manager => (
                             <div key={manager.personelId} className="flex items-center gap-3">
                                 <label htmlFor={`amount-${manager.personelId}`} className="text-sm font-medium flex-1">{manager.adi}</label>
                                 <Input
                                     id={`amount-${manager.personelId}`}
                                     type="number"
                                     placeholder="Tutar (₺)"
                                     value={distribution[manager.personelId] || ''}
                                     onChange={(e) => handleAmountChange(manager.personelId, e.target.value)}
                                     disabled={!isEntryEditable}
                                     className="w-32"
                                 />
                             </div>
                        ))}
                         <div className="flex items-center justify-between pt-3 border-t">
                            <span className='font-bold text-lg'>Toplam Tutar</span>
                            <span className='font-bold text-lg font-mono'>₺{totalAmount.toFixed(2)}</span>
                         </div>
                    </div>
                  
                    {isEntryEditable ? (
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Wallet className="mr-2" />}
                            {todaysEntry ? 'Kaydı Güncelle' : 'Kaydet'}
                        </Button>
                    ) : (
                         <Alert variant="default">
                          <CheckCheck className="h-4 w-4" />
                          <AlertTitle>Kayıt Tamamlandı ve Teslim Edildi</AlertTitle>
                          <AlertDescription>
                            Bu tarihin kaydı zaten teslim edildiği için düzenlenemez.
                          </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
            <div className="space-y-4">
                 <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PiggyBank />
                            Teslim Edilmemiş Toplam Nakit
                        </CardTitle>
                        <CardDescription>Henüz genel müdüre teslim edilmemiş toplam kasa tutarı.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold tracking-tighter">
                           ₺{pendingAmount.toFixed(2)}
                        </p>
                    </CardContent>
                 </Card>
                 <Card className="bg-destructive/10 border-destructive/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <CircleAlert />
                            Henüz Düşülmemiş Harcamalar
                        </CardTitle>
                         <CardDescription className="text-destructive/80">"Harcama Ekle" sekmesinde girilen ve henüz kasadan ödenmemiş masraflar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold tracking-tighter text-destructive">
                           -₺{unsettledExpenses.toFixed(2)}
                        </p>
                    </CardContent>
                 </Card>
            </div>
        </div>
    );
};

const BatchHandoverTab = ({ pendingEntries, branchId }: { pendingEntries: CashEntry[], branchId: string }) => {
    const { toast } = useToast();
    const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelect = (entryId: string, isSelected: boolean) => {
        setSelectedEntries(prev => ({...prev, [entryId]: isSelected}));
    }

    const handleSelectAll = (isSelected: boolean) => {
        const newSelection: Record<string, boolean> = {};
        if (isSelected) {
            pendingEntries.forEach(entry => newSelection[entry.cashEntryId] = true);
        }
        setSelectedEntries(newSelection);
    }

    const handleBatchSubmit = async () => {
        const entryIdsToUpdate = Object.keys(selectedEntries).filter(id => selectedEntries[id]);
        if(entryIdsToUpdate.length === 0) {
            toast({ title: 'Uyarı', description: 'Lütfen teslim edilecek en az bir kayıt seçin.', variant: 'default' });
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const batchHandoverId = doc(collection(db, 'batchHandovers')).id; // Just for grouping
            
            entryIdsToUpdate.forEach(entryId => {
                const docRef = doc(db, 'cashEntries', entryId);
                batch.update(docRef, {
                    teslimDurumu: 'teslim edildi',
                    teslimTarihi: serverTimestamp(),
                    topluTeslimId: batchHandoverId
                });
            });

            await batch.commit();
            toast({ title: 'Başarılı', description: `${entryIdsToUpdate.length} adet kayıt başarıyla teslim edildi olarak işaretlendi.`});
            setSelectedEntries({});
        } catch (error) {
            console.error("Error during batch handover: ", error);
            toast({ title: 'Hata', description: 'Toplu teslimat sırasında bir hata oluştu.', variant: 'destructive'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const totalSelectedAmount = useMemo(() => {
        return pendingEntries
            .filter(entry => selectedEntries[entry.cashEntryId])
            .reduce((sum, entry) => sum + (entry.dagilim?.reduce((s, d) => s + d.miktar, 0) || 0), 0);
    }, [selectedEntries, pendingEntries]);

    const allSelected = pendingEntries.length > 0 && pendingEntries.every(e => selectedEntries[e.cashEntryId]);

    return (
         <div>
            <CardHeader className="p-0 mb-4">
                <CardTitle>Toplu Teslimat</CardTitle>
                <CardDescription>Birden fazla günü seçerek genel müdüre toplu teslimat olarak bildirin.</CardDescription>
            </CardHeader>
             {pendingEntries.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                    Teslimatı bekleyen kasa kaydı bulunmuyor.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                            checked={allSelected}
                                        />
                                    </TableHead>
                                    <TableHead>İşlem Tarihi</TableHead>
                                    <TableHead className="text-right">Tutar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingEntries.map(entry => {
                                    const total = entry.dagilim?.reduce((s,d) => s + d.miktar, 0) || 0;
                                    return (
                                        <TableRow key={entry.cashEntryId}>
                                            <TableCell>
                                                 <Checkbox 
                                                    onCheckedChange={(checked) => handleSelect(entry.cashEntryId, Boolean(checked))}
                                                    checked={!!selectedEntries[entry.cashEntryId]}
                                                />
                                            </TableCell>
                                            <TableCell>{format(entry.islemTarihi, 'd MMMM yyyy', {locale: tr})}</TableCell>
                                            <TableCell className="text-right">₺{total.toFixed(2)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <div className='flex justify-between items-center bg-muted p-4 rounded-lg'>
                        <div className='text-lg font-bold'>
                            Toplam Seçilen Tutar: ₺{totalSelectedAmount.toFixed(2)}
                        </div>
                        <Button onClick={handleBatchSubmit} disabled={isSubmitting || totalSelectedAmount === 0}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <HandCoins className="mr-2" />}
                            Seçilenleri Teslim Et
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AddExpenseTab = ({ user, branchId, personelId, branchExpenses, onToggleExpenseStatus }: { user: AppUser, branchId: string; personelId: string; branchExpenses: Expense[]; onToggleExpenseStatus: (expenseId: string, currentStatus: boolean) => void; }) => {
    const { toast } = useToast();
    const [expenseDate, setExpenseDate] = useState<Date>(getBusinessDate());
    const [amount, setAmount] = useState<number | ''>('');
    const [description, setDescription] = useState('');
    const [isSettled, setIsSettled] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveExpense = async () => {
        if (!branchId || !personelId) {
            toast({ title: 'Hata', description: 'Kullanıcı veya şube bilgisi eksik.', variant: 'destructive' });
            return;
        }
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            toast({ title: 'Hata', description: 'Lütfen geçerli bir tutar girin.', variant: 'destructive' });
            return;
        }
        if (!description.trim()) {
            toast({ title: 'Hata', description: 'Lütfen harcama için bir açıklama girin.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const newExpenseRef = doc(collection(db, 'expenses'));
            const newExpense: Expense = {
                expenseId: newExpenseRef.id,
                subeId: branchId,
                personelId: personelId,
                tarih: startOfDay(expenseDate),
                tutar: numericAmount,
                aciklama: description.trim(),
                zamanDamgasi: new Date(),
                hesaplandi: isSettled
            };
            await setDoc(newExpenseRef, newExpense);
            toast({ title: 'Başarılı', description: 'Harcama kaydı başarıyla oluşturuldu.' });
            setAmount('');
            setDescription('');
            setIsSettled(false);
        } catch (error) {
            console.error("Error saving expense:", error);
            toast({ title: 'Hata', description: 'Harcama kaydedilirken bir hata oluştu.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const recentExpenses = useMemo(() => {
        return branchExpenses.sort((a,b) => b.tarih.getTime() - a.tarih.getTime()).slice(0, 10);
    }, [branchExpenses]);

    const isManager = user.role === 'genel-mudur' || user.role === 'sube-muduru';

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div>
                <CardHeader className="p-0 mb-4">
                    <CardTitle>Harcama Ekle</CardTitle>
                    <CardDescription>Şube için yapılan bir harcamayı kaydedin.</CardDescription>
                </CardHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Harcama Tarihi</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={'outline'}
                                    className={cn('w-full justify-start text-left font-normal')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(expenseDate, 'PPP', { locale: tr })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={expenseDate} onSelect={(date) => date && setExpenseDate(date)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="expense-amount" className="text-sm font-medium">Harcama Tutarı (₺)</label>
                        <Input id="expense-amount" type="number" placeholder="Örn: 75.50" value={amount} onChange={(e) => setAmount(e.target.value as any)} />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="expense-description" className="text-sm font-medium">Açıklama</label>
                        <Textarea id="expense-description" placeholder="Örn: Temizlik malzemesi alımı" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="is-settled"
                            checked={isSettled}
                            onCheckedChange={(checked) => setIsSettled(Boolean(checked))}
                        />
                        <label htmlFor="is-settled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Harcama Kasadan Hesaplanıp Ödendi
                        </label>
                    </div>
                    <Button onClick={handleSaveExpense} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
                        Harcamayı Kaydet
                    </Button>
                </div>
            </div>
            <div>
                <CardHeader className="p-0 mb-4">
                    <CardTitle>Son Harcamalar</CardTitle>
                    <CardDescription>Bu şubede yapılan son 10 harcama.</CardDescription>
                </CardHeader>
                <div className="rounded-md border">
                    <TooltipProvider>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Açıklama</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead className="text-right">Tutar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentExpenses.length > 0 ? (
                                    recentExpenses.map(exp => (
                                        <TableRow key={exp.expenseId}>
                                            <TableCell>{format(exp.tarih, 'd MMM yy', {locale: tr})}</TableCell>
                                            <TableCell>{exp.aciklama}</TableCell>
                                            <TableCell>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onToggleExpenseStatus(exp.expenseId, exp.hesaplandi)}
                                                            disabled={!isManager}
                                                            className={!isManager ? 'cursor-not-allowed' : ''}
                                                        >
                                                            {exp.hesaplandi ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <MinusCircle className="h-5 w-5 text-gray-400" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {isManager ? <p>Durumu Değiştir</p> : <p>Sadece yöneticiler değiştirebilir</p>}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="text-right">₺{exp.tutar.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">Henüz harcama kaydı yok.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
};

type ReportItem = (CashEntry & { type: 'cash'; totalAmount: number; }) | (Expense & { type: 'expense'; islemTarihi: Date });


const ReportingTab = ({ cashEntries, expenses, branches, showBranchFilter }: { cashEntries: CashEntry[], expenses: Expense[], branches: Sube[], showBranchFilter: boolean }) => {
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [statusFilter, setStatusFilter] = useState<'all' | 'beklemede' | 'teslim edildi'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'cash' | 'expense'>('all');
    const [branchFilter, setBranchFilter] = useState<'all' | string>('all');
    const { toast } = useToast();
    
    const branchMap = useMemo(() => {
        return branches.reduce((acc, branch) => {
            acc[branch.subeId] = branch.adi;
            return acc;
        }, {} as Record<string, string>);
    }, [branches]);

    const combinedEntries = useMemo((): ReportItem[] => {
        const cash: ReportItem[] = cashEntries.map(e => ({ 
            ...e, 
            type: 'cash', 
            totalAmount: e.dagilim.reduce((sum, d) => sum + d.miktar, 0)
        }));
        const expenseItems: ReportItem[] = expenses.map(e => ({ ...e, type: 'expense', islemTarihi: e.tarih }));
        return [...cash, ...expenseItems];
    }, [cashEntries, expenses]);


    const filteredEntries = useMemo(() => {
        let result = [...combinedEntries];
        
        if (dateRange?.from) {
            result = result.filter(e => e.islemTarihi >= startOfDay(dateRange.from!));
        }
        if (dateRange?.to) {
             result = result.filter(e => e.islemTarihi <= startOfDay(dateRange.to!));
        }
        if (typeFilter !== 'all') {
            result = result.filter(entry => entry.type === typeFilter);
        }
        if (statusFilter !== 'all') {
            result = result.filter(entry => {
                if (entry.type === 'cash') return entry.teslimDurumu === statusFilter;
                if (entry.type === 'expense') {
                    if (statusFilter === 'beklemede') return !entry.hesaplandi;
                    if (statusFilter === 'teslim edildi') return entry.hesaplandi;
                }
                return false;
            });
        }
        if (showBranchFilter && branchFilter !== 'all') {
            result = result.filter(e => e.subeId === branchFilter);
        }

        return result.sort((a,b) => b.islemTarihi.getTime() - a.islemTarihi.getTime());
    }, [combinedEntries, dateRange, statusFilter, branchFilter, showBranchFilter, typeFilter]);

    const totalAmount = useMemo(() => {
        if (typeFilter === 'expense') {
            return filteredEntries.reduce((sum, entry) => {
                if(entry.type === 'expense') return sum + entry.tutar;
                return sum;
            }, 0);
        }
        return filteredEntries.reduce((sum, entry) => {
            if(entry.type === 'cash') return sum + entry.totalAmount;
            if(entry.type === 'expense' && entry.hesaplandi) return sum - entry.tutar;
            return sum;
        }, 0);
    }, [filteredEntries, typeFilter]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        const tableColumns = ["Tarih", "Açıklama", "Şube", "Durum", "Tutar"];
        const tableRows: (string | number)[][] = [];

        filteredEntries.forEach(entry => {
            const rowData = [
                format(entry.islemTarihi, 'dd.MM.yyyy', { locale: tr }),
                entry.type === 'cash' ? 'Kasa Girişi' : entry.aciklama,
                branchMap[entry.subeId] || 'Bilinmiyor',
                entry.type === 'cash' 
                    ? (entry.teslimDurumu === 'teslim edildi' ? 'Teslim Edildi' : 'Beklemede')
                    : (entry.hesaplandi ? 'Hesaplandı' : 'Beklemede'),
                entry.type === 'cash' ? `+${entry.totalAmount.toFixed(2)}` : `-${entry.tutar.toFixed(2)}`
            ];
            tableRows.push(rowData);
        });


        let title = "Kasa Raporu";
        if (dateRange?.from) {
            title += ` (${format(dateRange.from, 'd MMM', { locale: tr })}`;
            if (dateRange.to) {
                title += ` - ${format(dateRange.to, 'd MMM', { locale: tr })}`;
            }
            title += ")";
        }
        doc.text(title, 14, 15);
        
        (doc as any).autoTable({
            head: [tableColumns],
            body: tableRows,
            startY: 20,
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
             foot: [['', '', '', 'Genel Toplam', `₺${totalAmount.toFixed(2)}`]],
            footStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        doc.save('Kasa-Raporu.pdf');
         toast({ title: 'Başarılı', description: 'Rapor PDF olarak indirildi.' });
    };

    return (
        <div>
            <CardHeader className="p-0 mb-4">
                <CardTitle>Raporlama</CardTitle>
                <CardDescription>Kasa ve harcama kayıtlarını tarihe ve duruma göre filtreleyerek görüntüleyin.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-4 mb-4 items-center">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className="w-[300px] justify-start text-left font-normal"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, "d MMM yyyy", {locale: tr})} -{' '}
                            {format(dateRange.to, "d MMM yyyy", {locale: tr})}
                            </>
                        ) : (
                            format(dateRange.from, "d MMM yyyy", {locale: tr})
                        )
                        ) : (
                        <span>Tarih aralığı seçin</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
                 <Select value={typeFilter} onValueChange={(value: 'all' | 'cash' | 'expense') => setTypeFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="İşlem Türü" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm İşlemler</SelectItem>
                        <SelectItem value="cash">Sadece Kasa Girişleri</SelectItem>
                        <SelectItem value="expense">Sadece Harcamalar</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value: 'all' | 'beklemede' | 'teslim edildi') => setStatusFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Durum" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="beklemede">Beklemede</SelectItem>
                        <SelectItem value="teslim edildi">Teslim Edildi / Hesaplandı</SelectItem>
                    </SelectContent>
                </Select>
                 {showBranchFilter && (
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger className="w-[200px]">
                            <Building className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Şube" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Şubeler</SelectItem>
                            {branches.map(branch => (
                                <SelectItem key={branch.subeId} value={branch.subeId}>
                                    {branch.adi}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 )}
                 <Button onClick={handleExportPDF} variant="outline">
                    <FileDown className="mr-2 h-4 w-4" />
                    PDF Olarak Aktar
                </Button>
            </div>

             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>İşlem Tarihi</TableHead>
                            <TableHead>Tür / Açıklama</TableHead>
                            <TableHead>Şube</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEntries.length > 0 ? filteredEntries.map(entry => (
                            <TableRow key={entry.type + (entry.type === 'cash' ? entry.cashEntryId : entry.expenseId)}>
                                <TableCell>{format(entry.islemTarihi, 'd MMM yyyy', {locale: tr})}</TableCell>
                                <TableCell>
                                    <div className='flex items-center gap-2'>
                                        {entry.type === 'cash' ? (
                                            <Badge variant='secondary' className='border-green-300'>Kasa Girişi</Badge>
                                        ) : (
                                            <Badge variant='secondary' className='border-red-300'>Harcama</Badge>
                                        )}
                                        {entry.type === 'expense' && <span>{entry.aciklama}</span>}
                                    </div>
                                </TableCell>
                                <TableCell>{branchMap[entry.subeId] || 'Bilinmiyor'}</TableCell>
                                <TableCell>
                                    {entry.type === 'cash' ? (
                                        <Badge variant={entry.teslimDurumu === 'teslim edildi' ? 'default' : 'secondary'}>
                                            {entry.teslimDurumu === 'teslim edildi' ? 'Teslim Edildi' : 'Beklemede'}
                                        </Badge>
                                    ) : (
                                        <Badge variant={entry.hesaplandi ? 'default' : 'secondary'}>
                                            {entry.hesaplandi ? 'Hesaplandı' : 'Beklemede'}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className={cn("text-right font-medium", entry.type === 'expense' && "text-destructive")}>
                                     {entry.type === 'cash' ? `+₺${entry.totalAmount.toFixed(2)}` : `-₺${entry.tutar.toFixed(2)}`}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">Filtre kriterlerine uygun kayıt bulunamadı.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-end items-center mt-4 pr-4">
                 <div className="text-lg font-bold">
                    Hesaplanan Toplam: ₺{totalAmount.toFixed(2)}
                </div>
            </div>
        </div>
    )
}

export default function CashRegisterPage() {
    const { user, firebaseUser, cashEntries, branches, expenses, isLoading: isAppLoading, staff } = useApp();
    const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
    const { toast } = useToast();
    
    const isGeneralManager = user?.role === 'genel-mudur';
    
    const {userBranchCashEntries, userBranchExpenses, userBranchStaff } = useMemo(() => {
        if (!user) return { userBranchCashEntries: [], userBranchExpenses: [], userBranchStaff: [] };
        
        const filteredCash = isGeneralManager
            ? cashEntries
            : cashEntries.filter(e => e.subeId === user.branchId);

        const filteredExpenses = isGeneralManager
            ? expenses
            : expenses.filter(e => e.subeId === user.branchId);
            
        const filteredStaff = isGeneralManager
            ? staff
            : staff.filter(s => s.subeId === user.branchId);

        return { 
            userBranchCashEntries: filteredCash.sort((a, b) => b.zamanDamgasi.getTime() - a.zamanDamgasi.getTime()),
            userBranchExpenses: filteredExpenses.sort((a,b) => b.zamanDamgasi.getTime() - a.zamanDamgasi.getTime()),
            userBranchStaff: filteredStaff,
        };
    }, [user, cashEntries, expenses, staff, isGeneralManager]);

    const todaysEntry = useMemo(() => {
        if (!userBranchCashEntries) return undefined;
        return userBranchCashEntries.find(e => isSameDay(e.islemTarihi, selectedDate));
    }, [userBranchCashEntries, selectedDate]);

    const pendingEntries = useMemo(() => userBranchCashEntries.filter(e => e.teslimDurumu === 'beklemede'), [userBranchCashEntries]);
    
    const { pendingAmount, unsettledExpensesTotal } = useMemo(() => {
        const pendingCash = pendingEntries.reduce((sum, entry) => {
            const entryTotal = entry.dagilim?.reduce((s, d) => s + d.miktar, 0) || 0;
            return sum + entryTotal;
        }, 0);
        const unsettledExpenses = userBranchExpenses
            .filter(e => !e.hesaplandi)
            .reduce((sum, exp) => sum + exp.tutar, 0);
        return { pendingAmount: pendingCash, unsettledExpensesTotal: unsettledExpenses };
    }, [pendingEntries, userBranchExpenses]);
    
    const handleToggleExpenseStatus = async (expenseId: string, currentStatus: boolean) => {
        const expenseRef = doc(db, 'expenses', expenseId);
        try {
            await updateDoc(expenseRef, {
                hesaplandi: !currentStatus
            });
            toast({
                title: 'Başarılı',
                description: `Harcama durumu güncellendi.`,
            });
        } catch (error) {
            console.error("Error toggling expense status:", error);
            toast({
                title: 'Hata',
                description: 'Harcama durumu güncellenirken bir hata oluştu.',
                variant: 'destructive',
            });
        }
    };


    if (isAppLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user || !firebaseUser) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Erişim Reddedildi</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Bu sayfayı görüntülemek için giriş yapmalısınız.</p>
                </CardContent>
            </Card>
        );
    }
     if (user.role === 'calisan') {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Erişim Reddedildi</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Bu sayfayı sadece yöneticiler görüntüleyebilir.</p>
                </CardContent>
            </Card>
        );
    }

    const branchId = user.branchId || '';

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    Kasa Defteri
                </h1>
                <p className="text-muted-foreground">
                    {isGeneralManager
                        ? 'Nakit akışını şube bazında analiz edin ve raporları görüntüleyin.'
                        : 'Günlük nakit akışını yönetin, harcamaları kaydedin ve raporları görüntüleyin.'
                    }
                </p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {isGeneralManager ? (
                        <ReportingTab
                            cashEntries={userBranchCashEntries}
                            expenses={userBranchExpenses}
                            branches={branches}
                            showBranchFilter={true}
                         />
                    ) : (
                        <Tabs defaultValue="daily">
                            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                                <TabsTrigger value="daily">Günlük Kayıt</TabsTrigger>
                                <TabsTrigger value="expense">Harcama Ekle</TabsTrigger>
                                <TabsTrigger value="batch">Toplu Teslimat</TabsTrigger>
                                <TabsTrigger value="report">Raporlama</TabsTrigger>
                            </TabsList>
                            <TabsContent value="daily" className="pt-6">
                                <DailyEntryTab 
                                    staff={userBranchStaff}
                                    branchId={branchId}
                                    personelId={firebaseUser.uid}
                                    todaysEntry={todaysEntry}
                                    pendingAmount={pendingAmount}
                                    unsettledExpenses={unsettledExpensesTotal}
                                    personelName={user.name}
                                    selectedDate={selectedDate}
                                    onDateChange={setSelectedDate}
                                />
                            </TabsContent>
                             <TabsContent value="expense" className="pt-6">
                                <AddExpenseTab
                                    user={user}
                                    branchId={branchId}
                                    personelId={firebaseUser.uid}
                                    branchExpenses={userBranchExpenses}
                                    onToggleExpenseStatus={handleToggleExpenseStatus}
                                />
                            </TabsContent>
                            <TabsContent value="batch" className="pt-6">
                                 <BatchHandoverTab
                                    pendingEntries={pendingEntries}
                                    branchId={branchId}
                                 />
                            </TabsContent>
                            <TabsContent value="report" className="pt-6">
                                 <ReportingTab
                                    cashEntries={userBranchCashEntries}
                                    expenses={userBranchExpenses}
                                    branches={branches}
                                    showBranchFilter={false}
                                 />
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
