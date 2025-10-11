// src/app/dashboard/reports/page.tsx
'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { AreaChart, CalendarClock, Bot } from "lucide-react";
import { MonthlyReport } from "./MonthlyReport";
import Link from "next/link";


const ReportCard = ({ href, icon: Icon, title, description }: { href: string, icon: React.ElementType, title: string, description: string }) => (
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


export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Raporlar
        </h1>
        <p className="text-muted-foreground">
          Sistem genelindeki raporlara buradan erişin.
        </p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard 
            href="/dashboard/reports"
            icon={AreaChart}
            title="Aylık Özet Raporu"
            description="Personel fazla mesai ve gecikme istatistiklerini aylık olarak görüntüleyin."
          />
          <ReportCard 
            href="/dashboard/reports/shift-details"
            icon={CalendarClock}
            title="Detaylı Vardiya Raporu"
            description="Personel vardiyalarını aylık takvim görünümünde detaylı inceleyin."
          />
           <ReportCard 
            href="/dashboard/reports/sales"
            icon={Bot}
            title="Satış Analizi Raporu"
            description="AI ile dijitalleştirilmiş satış verilerini analiz edin."
          />
       </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AreaChart />
            Aylık Fazla Mesai ve Gecikme Raporu
          </CardTitle>
          <CardDescription>
            İlgili ayı seçerek personel performansını analiz edin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyReport />
        </CardContent>
      </Card>
    </div>
  );
}
