// src/app/dashboard/requests/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { MaterialRequest, MaterialRequestStatus, MaterialRequestUrgency, Personel } from '@/lib/types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { PlusCircle, Loader2, PackageSearch, MessageSquare, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

// Zod Schema for the request form
const requestSchema = z.object({
  itemName: z.string().min(3, 'Ürün adı en az 3 karakter olmalıdır.'),
  urgency: z.enum(['Düşük', 'Normal', 'Acil'], { required_error: 'Lütfen bir aciliyet seviyesi seçin.' }),
  currentStock: z.string().min(1, 'Lütfen mevcut stok durumunu belirtin (örn: "2 kutu", "Bitti").'),
  notes: z.string().optional(),
});
type RequestFormData = z.infer<typeof requestSchema>;

// Employee View: Form to create a request and a list of their own requests
const EmployeeView = () => {
    const { user, firebaseUser, materialRequests } = useApp();
    const { toast } = useToast();
    const form = useForm<RequestFormData>({
        resolver: zodResolver(requestSchema),
        defaultValues: { itemName: '', urgency: 'Normal', currentStock: '', notes: '' },
    });


    const onSubmit = async (data: RequestFormData) => {
        if (!firebaseUser || !user?.branchId) {
            toast({ title: 'Hata', description: 'Kullanıcı veya şube bilgisi bulunamadı.', variant: 'destructive' });
            return;
        }

        try {
            const newRequestRef = doc(collection(db, "materialRequests"));
            const newRequest: Omit<MaterialRequest, 'requestId'> = {
                branchId: user.branchId,
                requesterId: firebaseUser.uid, // Use UID as the requester ID
                requesterName: user.name,
                itemName: data.itemName,
                urgency: data.urgency as MaterialRequestUrgency,
                currentStock: data.currentStock,
                status: 'Beklemede',
                createdAt: new Date(),
                notes: data.notes,
            };
            await setDoc(newRequestRef, newRequest);
            toast({ title: 'Başarılı', description: 'Malzeme talebiniz başarıyla iletildi.' });
            form.reset();
        } catch (error) {
            console.error('Error creating material request:', error);
            toast({ title: 'Hata', description: 'Talep oluşturulurken bir sorun oluştu.', variant: 'destructive' });
        }
    };

    const myRequests = useMemo(() => 
        materialRequests
            .filter(req => req.requesterId === firebaseUser?.uid)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        [materialRequests, firebaseUser]
    );

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Yeni Talep Oluştur</CardTitle>
                        <CardDescription>İhtiyacınız olan malzemeyi aşağıdaki formu doldurarak talep edin.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="itemName" render={({ field }) => (
                                    <FormItem><FormLabel>Malzeme / Ürün Adı</FormLabel><FormControl><Input placeholder="Örn: M boy karton bardak" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="urgency" render={({ field }) => (
                                    <FormItem><FormLabel>Aciliyet</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Düşük">Düşük</SelectItem><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Acil">Acil</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="currentStock" render={({ field }) => (
                                    <FormItem><FormLabel>Mevcut Stok</FormLabel><FormControl><Input placeholder="Örn: 1 koli kaldı, Bitti" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem><FormLabel>Ek Notlar (Opsiyonel)</FormLabel><FormControl><Textarea placeholder="Eklemek istediğiniz detaylar..." {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />} Talep Gönder
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Geçmiş Taleplerim</h3>
                 <div className="rounded-md border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Ürün</TableHead><TableHead>Tarih</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {myRequests.length > 0 ? myRequests.map(req => (
                                <TableRow key={req.requestId}>
                                    <TableCell className="font-medium">{req.itemName}</TableCell>
                                    <TableCell>{format(req.createdAt, 'd MMM yyyy', { locale: tr })}</TableCell>
                                    <TableCell><Badge variant={req.status === 'Beklemede' ? 'secondary' : req.status === 'Reddedildi' ? 'destructive' : 'default'}>{req.status}</Badge></TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={3} className="h-24 text-center">Henüz bir talep oluşturmadınız.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

// Manager View: Table of all requests with actions
const ManagerView = () => {
    const { user, materialRequests } = useApp();
    const { toast } = useToast();
    const [filter, setFilter] = useState<MaterialRequestStatus | 'all'>('Beklemede');
    const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);
    const [managerNotes, setManagerNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const branchRequests = useMemo(() => {
        if (!user || !user.branchId) return [];
        return materialRequests
            .filter(req => req.branchId === user.branchId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }, [materialRequests, user]);

    const filteredRequests = useMemo(() =>
        filter === 'all' ? branchRequests : branchRequests.filter(req => req.status === filter),
        [branchRequests, filter]
    );
    
    const handleOpenModal = (request: MaterialRequest) => {
        setEditingRequest(request);
        setManagerNotes(request.managerNotes || '');
    };
    
    const handleStatusChange = async (newStatus: MaterialRequestStatus) => {
        if (!editingRequest) return;
        setIsSaving(true);
        try {
            const requestRef = doc(db, 'materialRequests', editingRequest.requestId);
            await updateDoc(requestRef, {
                status: newStatus,
                managerNotes: managerNotes
            });
            toast({ title: 'Başarılı', description: `Talebin durumu "${newStatus}" olarak güncellendi.`});
            setEditingRequest(null);
        } catch (error) {
            console.error("Error updating request status:", error);
            toast({ title: 'Hata', description: 'Durum güncellenemedi.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const urgencyVariant = (urgency: MaterialRequestUrgency): 'destructive' | 'secondary' | 'default' => {
        switch(urgency) {
            case 'Acil': return 'destructive';
            case 'Normal': return 'default';
            case 'Düşük': return 'secondary';
            default: return 'secondary';
        }
    }

    return (
        <>
            <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Talep Yönetimi: {editingRequest?.itemName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p><strong>Talep Eden:</strong> {editingRequest?.requesterName}</p>
                        <p><strong>Mevcut Stok:</strong> {editingRequest?.currentStock}</p>
                        {editingRequest?.notes && <p><strong>Personel Notu:</strong> {editingRequest.notes}</p>}
                         <div className="space-y-2">
                           <label htmlFor="manager-notes" className="text-sm font-medium">Yönetici Notu</label>
                           <Textarea id="manager-notes" value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} placeholder="Onay/Red sebebini veya ek bilgiyi buraya yazın..." />
                         </div>
                    </div>
                    <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button variant="outline" onClick={() => handleStatusChange('Onaylandı')} disabled={isSaving}>Onayla</Button>
                        <Button variant="destructive" onClick={() => handleStatusChange('Reddedildi')} disabled={isSaving}>Reddet</Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('Temin Edildi')} disabled={isSaving}>Temin Edildi</Button>
                         <Button variant="secondary" onClick={() => setEditingRequest(null)} disabled={isSaving}>İptal</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Şube Malzeme Talepleri</CardTitle>
                    <CardDescription>Personel tarafından gönderilen tüm malzeme taleplerini yönetin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="Beklemede">Beklemede</TabsTrigger>
                            <TabsTrigger value="Onaylandı">Onaylandı</TabsTrigger>
                            <TabsTrigger value="Temin Edildi">Temin Edildi</TabsTrigger>
                            <TabsTrigger value="Reddedildi">Reddedildi</TabsTrigger>
                            <TabsTrigger value="all">Tümü</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Talep Eden</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Aciliyet</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {filteredRequests.length > 0 ? filteredRequests.map(req => (
                                    <TableRow key={req.requestId}>
                                        <TableCell className="font-medium">{req.itemName}</TableCell>
                                        <TableCell>{req.requesterName}</TableCell>
                                        <TableCell>{format(req.createdAt, 'd MMM, HH:mm', { locale: tr })}</TableCell>
                                        <TableCell><Badge variant={urgencyVariant(req.urgency)}>{req.urgency}</Badge></TableCell>
                                        <TableCell><Badge variant={req.status === 'Beklemede' ? 'secondary' : req.status === 'Reddedildi' ? 'destructive' : 'default'}>{req.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(req)}><MessageSquare /></Button>
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={6} className="h-24 text-center">Bu filtrede gösterilecek talep bulunmuyor.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default function MaterialRequestsPage() {
    const { user, isLoading } = useApp();

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user) return null;

    // General Manager doesn't see this page.
    if (user.role === 'genel-mudur') {
        return (
            <div className="flex flex-col gap-8">
                 <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                        <PackageSearch className="inline-block mr-2" />
                        Malzeme Talepleri
                    </h1>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Erişim Bilgisi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Bu özellik şube içi operasyonlar için tasarlanmıştır ve genel müdür görünümünde aktif değildir.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    <PackageSearch className="inline-block mr-2" />
                    Malzeme Talepleri
                </h1>
                <p className="text-muted-foreground">
                    {user.role === 'sube-muduru'
                        ? 'Personelinizin malzeme ihtiyaçlarını buradan yönetin.'
                        : 'İhtiyacınız olan malzemeleri buradan talep edin ve durumlarını takip edin.'}
                </p>
            </div>

            {user.role === 'sube-muduru' ? <ManagerView /> : <EmployeeView />}

        </div>
    );
}
