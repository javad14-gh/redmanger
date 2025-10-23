'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, CalendarIcon, Wallet } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useApp } from '@/hooks/use-app';
import { SalesReport } from '@/lib/types';
import { doc, setDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getBusinessDate, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';


export default function ManualSalesEntryPage() {
    const { toast } = useToast();
    const { user, firebaseUser } = useApp();
    const [isSaving, setIsSaving] = useState(false);
    const [reportDate, setReportDate] = useState<Date>(getBusinessDate());
    const [totalSales, setTotalSales] = useState<string>('');

    const handleSaveReport = async () => {
        if (!user || !firebaseUser || !user.branchId) {
            toast({
                title: 'Hata',
                description: 'Raporu kaydetmek için kullanıcı veya şube bilgisi eksik.',
                variant: 'destructive',
            });
            return;
        }

        const salesAmount = parseFloat(totalSales);
        if (isNaN(salesAmount) || salesAmount < 0) {
            toast({
                title: 'Hata',
                description: 'Lütfen geçerli bir satış tutarı girin.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const newReportRef = doc(collection(db, 'salesReports'));
            
            // We create a simplified SalesReport structure for manual entry
            // This ensures it works with the existing dashboard chart
            const reportData: SalesReport = {
                reportId: newReportRef.id,
                subeId: user.branchId,
                personelId: firebaseUser.uid,
                reportDate: Timestamp.fromDate(reportDate).toDate(),
                createdAt: serverTimestamp() as unknown as Date, // Cast for type consistency
                items: [
                    {
                        productName: 'Günlük Toplam Satış',
                        quantity: 1,
                        totalPrice: salesAmount,
                    }
                ],
                paymentBreakdown: [
                    {
                        method: 'Nakit', // Assign a default payment method
                        amount: salesAmount,
                    }
                ],
            };

            await setDoc(newReportRef, reportData);
            
            toast({
                title: 'Başarılı!',
                description: `Satış raporu ${format(reportDate, 'd MMMM yyyy', {locale: tr})} tarihi için başarıyla kaydedildi.`,
            });
            
            setTotalSales('');
            setReportDate(getBusinessDate());

        } catch(e) {
            console.error("Error saving sales report:", e);
            toast({
                title: 'Kaydetme Hatası',
                description: 'Rapor veritabanına kaydedilirken bir sorun oluştu.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    Manuel Satış Girişi
                </h1>
                <p className="text-muted-foreground">
                    Günlük toplam satış tutarını girerek ana paneldeki grafiği güncelleyin.
                </p>
            </div>

            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet />
                        Günlük Satış Kaydı
                    </CardTitle>
                    <CardDescription>
                       İlgili tarih için toplam KDV dahil ciroyu girin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className='font-medium text-sm'>Rapor Tarihi</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={'outline'}
                                    className={cn('w-full justify-start text-left font-normal', !reportDate && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {reportDate ? format(reportDate, 'PPP', { locale: tr }) : <span>Tarih seçin</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={reportDate}
                                    onSelect={(date) => date && setReportDate(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="total-sales" className='font-medium text-sm'>Toplam Satış Tutarı (₺)</label>
                        <Input
                            id="total-sales"
                            type="number"
                            placeholder="Örn: 12500.75"
                            value={totalSales}
                            onChange={(e) => setTotalSales(e.target.value)}
                        />
                    </div>
                   
                    <Button onClick={handleSaveReport} disabled={isSaving} className='w-full'>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                        Satış Verisini Kaydet
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
