// src/app/dashboard/reports/shift-details/page.tsx
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { ShiftDetailsReport } from "./ShiftDetailsReport";

export default function ShiftDetailsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Detaylı Vardiya Raporu
        </h1>
        <p className="text-muted-foreground">
          Personel vardiyalarını aylık takvim görünümünde detaylı olarak inceleyin.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock />
            Aylık Vardiya Takvimi
          </CardTitle>
          <CardDescription>
            İlgili ay, şube ve personeli seçerek vardiya detaylarını görüntüleyin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShiftDetailsReport />
        </CardContent>
      </Card>
    </div>
  );
}
