// src/app/dashboard/inventory/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Boxes, Save, AlertCircle, Loader2, PackagePlus } from 'lucide-react';
import { Urun, StokSayimi, Sube, AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection, Timestamp, setDoc } from 'firebase/firestore';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getBusinessDate } from '@/lib/utils';


const productSchema = z.object({
  adi: z.string().min(2, 'Ürün adı en az 2 karakter olmalıdır.'),
  kategori: z.string().min(2, 'Kategori adı en az 2 karakter olmalıdır.'),
  birim: z.enum(['kg', 'adet', 'litre']),
  minStok: z.coerce.number().min(0, 'Minimum stok 0 veya daha fazla olmalıdır.'),
});

// For General Manager, they need to select a branch
const gmProductSchema = productSchema.extend({
  subeId: z.string().min(1, 'Şube seçmek zorunludur.'),
});

type ProductFormData = z.infer<typeof productSchema>;
type GmProductFormData = z.infer<typeof gmProductSchema>;


const AddProductForm = ({ user, branches, onProductAdded }: { user: AppUser; branches: Sube[]; onProductAdded: () => void; }) => {
    const { toast } = useToast();
    const isGeneralManager = user.role === 'genel-mudur';
    const schema = isGeneralManager ? gmProductSchema : productSchema;
    
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            adi: '',
            kategori: '',
            birim: 'adet',
            minStok: 0,
            ...(isGeneralManager ? { subeId: '' } : {}),
        },
    });

    const handleAddProduct = async (data: z.infer<typeof schema>) => {
        const branchId = isGeneralManager ? (data as GmProductFormData).subeId : user.branchId;

        if (!branchId) {
            toast({ title: 'Hata', description: 'Şube ID bulunamadı.', variant: 'destructive' });
            return;
        }

        try {
            const newProductRef = doc(collection(db, "products"));
            const newProduct: Omit<Urun, 'urunId' | 'sonGuncelleme' | 'guncelleyenPersonelId'> = {
                adi: data.adi,
                kategori: data.kategori,
                birim: data.birim,
                minStok: data.minStok,
                subeId: branchId,
                mevcutStok: 0, // Initial stock is 0
            };
            await setDoc(newProductRef, newProduct);

            toast({
                title: 'Ürün Eklendi',
                description: `${data.adi} ürünü başarıyla eklendi.`,
            });
            form.reset();
            onProductAdded(); // Close the dialog
        } catch (error) {
            console.error("Error adding product: ", error);
            toast({
                title: 'Hata',
                description: 'Ürün eklenirken bir hata oluştu.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddProduct)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="adi"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ürün Adı</FormLabel>
                            <FormControl>
                                <Input placeholder="Örn: Patates" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="kategori"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Kategori</FormLabel>
                            <FormControl>
                                <Input placeholder="Örn: Sebzeler, İçecekler" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="birim"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Birim</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Birim seçin" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="adet">Adet</SelectItem>
                                <SelectItem value="kg">Kg</SelectItem>
                                <SelectItem value="litre">Litre</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="minStok"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Minimum Stok Miktarı</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Örn: 50" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {isGeneralManager && (
                    <FormField
                        control={form.control}
                        name="subeId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Şube</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Şube seçin" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {branches.map(branch => (
                                    <SelectItem key={branch.subeId} value={branch.subeId}>{branch.adi}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
                <DialogFooter>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                       {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : 'Ürünü Ekle'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
};


export default function InventoryPage() {
  const { user, firebaseUser, products: allProducts, stockCounts: allStockCounts, branches } = useApp();
  const { toast } = useToast();
  
  const [todayStockValues, setTodayStockValues] = useState<Record<string, number | ''>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddProductDialogOpen, setAddProductDialogOpen] = useState(false);

  const hasPermission = user?.role === 'sube-muduru' || user?.role === 'genel-mudur' || user?.canManageInventory;

  // Filter products and stock counts for the current user's branch
  const { branchProducts, branchStockCounts, groupedProducts } = useMemo(() => {
    if (!user || (!user.branchId && user.role !== 'genel-mudur')) {
        return { branchProducts: [], branchStockCounts: [], groupedProducts: {} };
    }
    
    const productsForView = user.role === 'genel-mudur' 
        ? allProducts // General manager sees all products initially
        : allProducts.filter(p => p.subeId === user.branchId);

    const gp = productsForView.reduce((acc, product) => {
        const category = product.kategori || 'Diğer';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(product);
        return acc;
    }, {} as Record<string, Urun[]>);

    const filteredStockCounts = (user.branchId)
      ? allStockCounts.filter(sc => sc.subeId === user.branchId).sort((a, b) => b.zamanDamgasi.getTime() - a.zamanDamgasi.getTime())
      : [];

    return { branchProducts: productsForView, branchStockCounts: filteredStockCounts, groupedProducts: gp };
  }, [allProducts, allStockCounts, user]);

  useEffect(() => {
    const initialStock = branchProducts.reduce((acc, p) => {
        acc[p.urunId] = ''; // Start with empty inputs for today's count
        return acc;
    }, {} as Record<string, number | ''>);
    setTodayStockValues(initialStock);
  }, [branchProducts]);


  // Get the last 5 stock count dates
  const recentCountDates = useMemo(() => 
    branchStockCounts.slice(0, 5).map(sc => sc.zamanDamgasi), 
    [branchStockCounts]
  );
  
  // Create a map for quick lookup: { [urunId]: { [dateStr]: count } }
  const productHistoryMap = useMemo(() => {
    const history: Record<string, Record<string, number>> = {};
    branchStockCounts.forEach(count => {
      if (count.zamanDamgasi && count.sayimDetaylari) { // Check if fields exist
        const dateStr = format(getBusinessDate(count.zamanDamgasi), 'yyyy-MM-dd');
        count.sayimDetaylari.forEach(detail => {
          if (detail.urunId) {
            if (!history[detail.urunId]) {
              history[detail.urunId] = {};
            }
            history[detail.urunId][dateStr] = detail.sayilanMiktar;
          }
        });
      }
    });
    return history;
  }, [branchStockCounts]);


  if (!user || !hasPermission) {
    return (
       <Card>
          <CardHeader>
            <CardTitle>Erişim Reddedildi</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
          </CardContent>
        </Card>
    )
  }

  const handleStockChange = (urunId: string, value: string) => {
    const numberValue = parseInt(value, 10);
    setTodayStockValues(prev => ({
      ...prev,
      [urunId]: isNaN(numberValue) ? '' : numberValue,
    }));
  };

  const handleSaveStockCount = async () => {
    if (!firebaseUser || !user?.branchId) {
      toast({ title: 'Hata', description: 'Şube bilgileri bulunamadı. Lütfen şubenize atandığınızdan emin olun.', variant: 'destructive' });
      return;
    }
    
    const productsToSave = branchProducts.filter(p => p.subeId === user.branchId && todayStockValues[p.urunId] !== '' && todayStockValues[p.urunId] !== null);

    if (productsToSave.length === 0) {
      toast({ title: 'Uyarı', description: 'Kaydetmek için en az bir ürünün sayımını girmelisiniz.', variant: 'default' });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const submissionTimestamp = new Date();
      const businessDate = getBusinessDate(submissionTimestamp);

      // We use the actual time for the timestamp, but the business date for grouping/logic.
      const now = Timestamp.fromDate(submissionTimestamp);

      const sayimDetaylari = productsToSave.map(p => ({
        urunId: p.urunId,
        adi: p.adi,
        sayilanMiktar: Number(todayStockValues[p.urunId]),
      }));

      // 1. Create a new stock count document
      const stockCountRef = doc(collection(db, 'stockCounts'));
      batch.set(stockCountRef, {
        sayimId: stockCountRef.id,
        subeId: user.branchId,
        personelId: firebaseUser.uid,
        zamanDamgasi: now, // The actual time of submission
        islemTarihi: Timestamp.fromDate(startOfDay(businessDate)), // The logical "business date"
        sayimDetaylari: sayimDetaylari,
      });

      // 2. Update the current stock for each product
      productsToSave.forEach(product => {
        const productRef = doc(db, 'products', product.urunId);
        batch.update(productRef, {
          mevcutStok: Number(todayStockValues[product.urunId]),
          sonGuncelleme: now,
          guncelleyenPersonelId: firebaseUser.uid,
        });
      });

      await batch.commit();
      
      toast({
        title: 'Başarılı',
        description: `Depo sayımı ${format(businessDate, 'd MMMM yyyy', {locale: tr})} tarihi için başarıyla kaydedildi.`,
      });
      // Reset inputs after successful save
      const resetValues = Object.keys(todayStockValues).reduce((acc, key) => {
        acc[key] = '';
        return acc;
      }, {} as Record<string, number | ''>);
      setTodayStockValues(resetValues);

    } catch (error) {
      console.error('Error saving stock count:', error);
      toast({
        title: 'Hata',
        description: 'Depo sayımı kaydedilirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultAccordionValue = Object.keys(groupedProducts).length > 0 ? [Object.keys(groupedProducts)[0]] : [];
  
  const isGeneralManagerAndNoBranchSelected = user.role === 'genel-mudur'; // This will be expanded later
  const shouldShowInventory = user.role === 'sube-muduru' || user.canManageInventory;


  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Depo Yönetimi
            </h1>
            <p className="text-muted-foreground">
            Periyodik olarak depo sayımını buradan yapın ve kaydedin. Bugün: <span className='font-semibold'>{format(getBusinessDate(), 'd MMMM yyyy, EEEE', {locale: tr})}</span>
            </p>
        </div>
         {hasPermission && (
            <Dialog open={isAddProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
                <DialogTrigger asChild>
                    <Button><PackagePlus/> Yeni Ürün Ekle</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>Yeni Ürün Ekle</DialogTitle>
                    <DialogDescription>
                        Yeni bir ürün tanımlamak için bilgileri doldurun.
                    </DialogDescription>
                    </DialogHeader>
                    <AddProductForm user={user} branches={branches} onProductAdded={() => setAddProductDialogOpen(false)} />
                </DialogContent>
            </Dialog>
         )}
      </div>

       <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Önemli Bilgilendirme</AlertTitle>
          <AlertDescription>
            Bu sayfa, anlık depo sayımı (envanter) yapmak içindir. Mevcut stok miktarını "Bugünkü Sayım" kolonuna girin ve "Sayımı Kaydet" butonuna tıklayın. Her kaydetme işlemi, o anki durumu bir "sayım raporu" olarak sistemde saklar ve tabloda yeni bir tarih sütunu olarak görünür hale gelir.
          </AlertDescription>
        </Alert>
        
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes />
            Anlık Depo Sayımı
          </CardTitle>
          <CardDescription>
            {user.role === 'genel-mudur' ? 'Tüm ürünleri görüntüleyin. Sayım işlemi şube bazlıdır.' : 'Şubenizdeki ürünlerin mevcut stoklarını girerek sayımı tamamlayın.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
           {!user.branchId && user.role !== 'genel-mudur' ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                   Bu sayfayı görüntülemek için bir şubeye atanmış olmalısınız.
                </div>
            ) : (
                <>
                <Accordion type="multiple" defaultValue={defaultAccordionValue} className="w-full space-y-4">
                    {Object.entries(groupedProducts).map(([category, products]) => (
                        <AccordionItem value={category} key={category} className="border rounded-lg">
                           <AccordionTrigger className="px-4 text-lg font-medium bg-muted/50 hover:bg-muted rounded-t-lg">
                                {category} ({products.length})
                           </AccordionTrigger>
                           <AccordionContent className="p-0">
                                <div className="rounded-md border-t-0 border overflow-x-auto">
                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                        <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">Ürün Adı</TableHead>
                                        {shouldShowInventory && <TableHead className="text-center w-[150px]">Bugünkü Sayım</TableHead>}
                                        {shouldShowInventory && recentCountDates.map(date => (
                                            <TableHead key={date.toISOString()} className="text-center w-[150px]">
                                            {format(date, 'd MMM yy', { locale: tr })}
                                            </TableHead>
                                        ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.length > 0 ? (
                                        products.map(product => (
                                            <TableRow key={product.urunId}>
                                            <TableCell className="font-medium sticky left-0 bg-background z-10">{product.adi} ({product.birim})</TableCell>
                                            
                                            {shouldShowInventory && (
                                                <>
                                                    <TableCell>
                                                        <div className='flex justify-center'>
                                                        <Input
                                                            type="number"
                                                            value={todayStockValues[product.urunId] ?? ''}
                                                            onChange={e => handleStockChange(product.urunId, e.target.value)}
                                                            className="w-24 h-8 text-center"
                                                        />
                                                        </div>
                                                    </TableCell>
                                                    {recentCountDates.map(date => {
                                                        const dateStr = format(getBusinessDate(date), 'yyyy-MM-dd');
                                                        const countForDate = productHistoryMap[product.urunId]?.[dateStr];
                                                        return (
                                                        <TableCell key={date.toISOString()} className="text-center">
                                                            {countForDate !== undefined ? countForDate : 'N/A'}
                                                        </TableCell>
                                                        );
                                                    })}
                                                </>
                                            )}
                                            </TableRow>
                                        ))
                                        ) : (
                                        <TableRow>
                                            <TableCell colSpan={shouldShowInventory ? recentCountDates.length + 2 : 1} className="h-24 text-center">
                                            Bu kategoride ürün bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                        )}
                                    </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                
                {branchProducts.length === 0 && (
                     <div className="h-24 flex items-center justify-center text-muted-foreground">
                        Şubenize atanmış ürün bulunmuyor. Lütfen "Yeni Ürün Ekle" butonu ile bir ürün ekleyin.
                    </div>
                )}
                
                {shouldShowInventory && branchProducts.length > 0 && (
                    <div className="flex justify-end mt-4">
                    <Button onClick={handleSaveStockCount} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Kaydediliyor...' : 'Sayımı Kaydet'}
                    </Button>
                    </div>
                )}
                </>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
