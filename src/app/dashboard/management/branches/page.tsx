// src/app/dashboard/management/branches/page.tsx
'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Building, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { Sube } from '@/lib/types';


const branchSchema = z.object({
  adi: z.string().min(3, 'Şube adı en az 3 karakter olmalıdır.'),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

type BranchFormData = z.infer<typeof branchSchema>;

const BranchForm = ({ branch, onFormSubmit, closeDialog }: { branch?: Sube, onFormSubmit: (data: BranchFormData, branchId?: string) => Promise<void>, closeDialog: () => void }) => {
    const form = useForm<BranchFormData>({
        resolver: zodResolver(branchSchema),
        defaultValues: branch ? {
            adi: branch.adi,
            latitude: branch.latitude,
            longitude: branch.longitude,
        } : {
            adi: '',
        },
    });

    const onSubmit = async (data: BranchFormData) => {
        await onFormSubmit(data, branch?.subeId);
        form.reset();
        closeDialog();
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="adi" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Şube Adı</FormLabel>
                        <FormControl><Input placeholder="Örn: Ankara Kızılay" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="latitude" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Latitude (Enlem)</FormLabel>
                            <FormControl><Input type="number" step="any" placeholder="Örn: 39.925533" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="longitude" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Longitude (Boylam)</FormLabel>
                            <FormControl><Input type="number" step="any" placeholder="Örn: 32.866287" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={closeDialog}>İptal</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
};


export default function BranchManagementPage() {
    const { user, branches, isLoading } = useApp();
    const { toast } = useToast();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Sube | undefined>(undefined);

    const handleFormSubmit = async (data: BranchFormData, branchId?: string) => {
        try {
            if (branchId) {
                // Update
                const branchRef = doc(db, "branches", branchId);
                await updateDoc(branchRef, data);
                toast({ title: 'Başarılı', description: 'Şube bilgileri güncellendi.' });
            } else {
                // Create
                const newBranchRef = doc(collection(db, "branches"));
                const newBranch: Sube = {
                    subeId: newBranchRef.id,
                    adi: data.adi,
                    latitude: data.latitude,
                    longitude: data.longitude,
                };
                await setDoc(newBranchRef, newBranch);
                toast({ title: 'Başarılı', description: 'Yeni şube başarıyla oluşturuldu.' });
            }
        } catch (error) {
            console.error("Error creating/updating branch: ", error);
            toast({ title: 'Hata', description: 'Şube kaydedilirken bir hata oluştu.', variant: 'destructive' });
        }
    };
    
    const openForm = (branch?: Sube) => {
        setEditingBranch(branch);
        setFormOpen(true);
    }

    if (user?.role !== 'genel-mudur') {
        return (
          <Card>
            <CardHeader><CardTitle>Erişim Reddedildi</CardTitle></CardHeader>
            <CardContent><p>Bu sayfayı görüntüleme yetkiniz yok.</p></CardContent>
          </Card>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Şube Yönetimi</h1>
                    <p className="text-muted-foreground">Yeni şubeler ekleyin ve mevcut şubeleri yönetin.</p>
                </div>
                <Button onClick={() => openForm()}><PlusCircle/> Yeni Şube Ekle</Button>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingBranch ? 'Şubeyi Düzenle' : 'Yeni Şube Ekle'}</DialogTitle>
                    </DialogHeader>
                    <BranchForm
                        branch={editingBranch}
                        onFormSubmit={handleFormSubmit}
                        closeDialog={() => setFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building/> Mevcut Şubeler</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Şube Adı</TableHead>
                                        <TableHead>Latitude</TableHead>
                                        <TableHead>Longitude</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {branches.length > 0 ? (
                                        branches.map(branch => (
                                            <TableRow key={branch.subeId}>
                                                <TableCell className="font-medium">{branch.adi}</TableCell>
                                                <TableCell className="font-mono text-xs">{branch.latitude || 'N/A'}</TableCell>
                                                <TableCell className="font-mono text-xs">{branch.longitude || 'N/A'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => openForm(branch)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                Henüz şube eklenmemiş.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
