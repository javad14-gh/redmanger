// src/app/dashboard/reports/sales/page.tsx
'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, Loader2, Bot, ShoppingCart, CreditCard } from 'lucide-react';
import { SalesReport, SalesReportItem, PaymentBreakdownItem } from '@/lib/types';

type AggregatedProduct = {
    name: string;
    totalQuantity: number;
    totalRevenue: number;
};

type AggregatedPayments = {
    [key: string]: number;
};

export default function SalesAnalysisPage() {
    const { salesReports, isLoading } = useApp();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const { aggregatedProducts, aggregatedPayments, totalRevenue } = useMemo(() => {
        const filteredReports = salesReports.filter(report => {
            if (!dateRange?.from) return true; // Show all if no start date
            const reportDate = startOfDay(new Date(report.reportDate));
            const from = startOfDay(dateRange.from);
            const to = dateRange.to ? startOfDay(dateRange.to) : from;
            return reportDate >= from && reportDate <= to;
        });

        const productMap = new Map<string, AggregatedProduct>();
        const paymentMap: AggregatedPayments = {};
        let revenue = 0;

        filteredReports.forEach(report => {
            report.items.forEach(item => {
                const existing = productMap.get(item.productName);
                const price = item.totalPrice || 0;
                if (existing) {
                    existing.totalQuantity += item.quantity;
                    existing.totalRevenue += price;
                } else {
                    productMap.set(item.productName, {
                        name: item.productName,
                        totalQuantity: item.quantity,
                        totalRevenue: price,
                    });
                }
                revenue += price;
            });
            report.paymentBreakdown.forEach(payment => {
                if(paymentMap[payment.method]){
                    paymentMap[payment.method] += payment.amount;
                } else {
                    paymentMap[payment.method] = payment.amount;
                }
            });
        });

        const sortedProducts = Array.from(productMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { 
            aggregatedProducts: sortedProducts, 
            aggregatedPayments: paymentMap,
            totalRevenue: revenue 
        };

    }, [salesReports, dateRange]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    Satış Analizi Raporu
                </h1>
                <p className="text-muted-foreground">
                    Yapay zeka ile dijitalleştirilmiş satış verilerini analiz edin ve ürün performansını ölçün.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className='space-y-1.5'>
                            <CardTitle className="flex items-center gap-2">
                               <Bot/> Toplam Satış Verileri
                            </CardTitle>
                            <CardDescription>
                                Belirtilen tarih aralığındaki toplam satış verilerini görüntüleyin.
                            </CardDescription>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className="w-full md:w-[300px] justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "d MMM yyyy", { locale: tr })} -{' '}
                                                {format(dateRange.to, "d MMM yyyy", { locale: tr })}
                                            </>
                                        ) : (
                                            format(dateRange.from, "d MMM yyyy", { locale: tr })
                                        )
                                    ) : (
                                        <span>Tarih aralığı seçin</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
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
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {salesReports.length === 0 ? (
                         <div className="text-center py-10 text-muted-foreground">
                            <p>Henüz kaydedilmiş bir satış raporu bulunmuyor.</p>
                            <Button variant="link" asChild><a href="/dashboard/ai-tools">AI Araçları sayfasından ilk raporunuzu oluşturun.</a></Button>
                         </div>
                    ) : (
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShoppingCart/> Ürün Satışları</h3>
                             <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ürün Adı</TableHead>
                                            <TableHead className="text-center">Toplam Satış Adedi</TableHead>
                                            <TableHead className="text-right">Toplam Ciro (₺)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {aggregatedProducts.map((product) => (
                                            <TableRow key={product.name}>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell className="text-center">{product.totalQuantity}</TableCell>
                                                <TableCell className="text-right font-mono">₺{product.totalRevenue.toFixed(2)}</TableCell>
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
                             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><CreditCard/> Ödeme Yöntemleri</h3>
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                     {Object.keys(aggregatedPayments).length > 0 ? (
                                        Object.entries(aggregatedPayments).map(([method, amount]) => (
                                            <div key={method} className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-muted-foreground">{method}</span>
                                                <span className="font-mono font-semibold">₺{amount.toFixed(2)}</span>
                                            </div>
                                        ))
                                     ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">Bu tarih aralığı için ödeme detayı bulunamadı.</p>
                                     )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
