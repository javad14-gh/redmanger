'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Bot, BarChart, AlertCircle, Save, CalendarIcon } from 'lucide-react';
import { analyzeSalesReport, SalesReportOutput } from '@/ai/flows/analyze-sales-report';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { useApp } from '@/hooks/use-app';
import { SalesReport } from '@/lib/types';
import { doc, setDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getBusinessDate, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';


function fileToDataURI(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function AiToolsPage() {
    const { toast } = useToast();
    const { user, firebaseUser } = useApp();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<SalesReportOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reportDate, setReportDate] = useState<Date>(getBusinessDate());

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setAnalysisResult(null);
            setError(null);
        }
    };

    const handleAnalyzeClick = async () => {
        if (!selectedFile) {
            toast({
                title: 'Hata',
                description: 'Lütfen bir resim dosyası seçin.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const imageDataUri = await fileToDataURI(selectedFile);
            const result = await analyzeSalesReport({ reportImage: imageDataUri });

            if (result && Array.isArray(result.items)) {
                setAnalysisResult(result);
            } else {
                 setError('Analizden anlamlı bir sonuç alınamadı. Lütfen farklı bir resim deneyin.');
            }

        } catch (e) {
            console.error(e);
            setError('Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveReport = async () => {
        if (!analysisResult || !user || !firebaseUser || !user.branchId) {
            toast({
                title: 'Hata',
                description: 'Raporu kaydetmek için gerekli veriler (kullanıcı, analiz sonucu) eksik.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const newReportRef = doc(collection(db, 'salesReports'));
            const reportData: SalesReport = {
                reportId: newReportRef.id,
                subeId: user.branchId,
                personelId: firebaseUser.uid,
                reportDate: Timestamp.fromDate(reportDate).toDate(),
                createdAt: serverTimestamp() as unknown as Date, // Cast for type consistency
                items: analysisResult.items,
                paymentBreakdown: analysisResult.paymentBreakdown,
            };

            await setDoc(newReportRef, reportData);
            
            toast({
                title: 'Başarılı!',
                description: `Satış raporu ${format(reportDate, 'd MMMM yyyy', {locale: tr})} tarihi için başarıyla kaydedildi.`,
            });
            // Optionally reset state after saving
            setAnalysisResult(null);
            setSelectedFile(null);

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

    const totalRevenue = analysisResult?.items?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;

    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    AI Araçları
                </h1>
                <p className="text-muted-foreground">
                    Yapay zeka destekli araçlar ile verimliliği artırın.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot />
                        Görüntüden Satış Raporu Analizi
                    </CardTitle>
                    <CardDescription>
                        Gün sonu Z-raporu gibi satış raporlarının resmini yükleyerek verileri otomatik olarak dijitalleştirin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid w-full max-w-sm items-center gap-2">
                        <label htmlFor="picture" className="text-sm font-medium">Rapor Resmini Yükle</label>
                        <div className="flex items-center gap-2">
                            <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} />
                            <Button onClick={handleAnalyzeClick} disabled={isLoading || !selectedFile}>
                                {isLoading ? <Loader2 className="animate-spin" /> : <BarChart />}
                                Analiz Et
                            </Button>
                        </div>
                    </div>
                    
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Analiz Hatası</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {isLoading && (
                         <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="font-semibold">Analiz Ediliyor...</p>
                            <p className="text-sm text-muted-foreground">Yapay zeka raporunuzu inceliyor. Bu işlem birkaç saniye sürebilir.</p>
                        </div>
                    )}

                    {analysisResult && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-semibold mb-2">Satılan Ürünler</h3>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Ürün Adı</TableHead>
                                                    <TableHead className="text-center">Satış Adedi</TableHead>
                                                    <TableHead className="text-right">Toplam Fiyat (₺)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {analysisResult.items.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                                        <TableCell className="text-right font-mono">{item.totalPrice?.toFixed(2) || 'N/A'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-end mt-4 text-lg font-bold">
                                        Toplam Ciro: ₺{totalRevenue.toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Ödeme Dağılımı</h3>
                                    <Card>
                                        <CardContent className="pt-6 space-y-4">
                                            {analysisResult.paymentBreakdown && analysisResult.paymentBreakdown.length > 0 ? (
                                                analysisResult.paymentBreakdown.map((item) => (
                                                    <div key={item.method} className="flex justify-between items-center text-sm">
                                                        <span className="font-medium text-muted-foreground">{item.method}</span>
                                                        <span className="font-mono font-semibold">₺{item.amount.toFixed(2)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-4">Ödeme detayı bulunamadı.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                            <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/50 justify-center'>
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn('w-[280px] justify-start text-left font-normal', !reportDate && 'text-muted-foreground')}
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
                                <Button onClick={handleSaveReport} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                                    Raporu Veritabanına Kaydet
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
