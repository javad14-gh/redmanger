// src/app/dashboard/management/branches/page.tsx
'use client';

import { useState } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { Sube } from '@/lib/types';


const branchSchema = z.object({
  adi: z.string().min(3, 'Şube adı en az 3 karakter olmalıdır.'),
});

type BranchFormData = z.infer<typeof branchSchema>;

const BranchForm = ({ onFormSubmit, closeDialog }: { onFormSubmit: (data: BranchFormData) => Promise<void>, closeDialog: () => void }) => {
    const form = useForm<BranchFormData>({
        resolver: zodResolver(branchSchema),
        defaultValues: {
            adi: '',
        },
    });

    const onSubmit = async (data: BranchFormData) => {
        await onFormSubmit(data);
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

    const handleFormSubmit = async (data: BranchFormData) => {
        try {
            const newBranchRef = doc(collection(db, "branches"));
            const newBranch: Sube = {
                subeId: newBranchRef.id,
                adi: data.adi,
            };
            await setDoc(newBranchRef, newBranch);
            toast({ title: 'Başarılı', description: 'Yeni şube başarıyla oluşturuldu.' });
        } catch (error) {
            console.error("Error creating branch: ", error);
            toast({ title: 'Hata', description: 'Şube oluşturulurken bir hata oluştu.', variant: 'destructive' });
        }
    };
    
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
                <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle/> Yeni Şube Ekle</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Şube Ekle</DialogTitle>
                        </DialogHeader>
                        <BranchForm
                            onFormSubmit={handleFormSubmit}
                            closeDialog={() => setFormOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

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
                                        <TableHead>Şube ID</TableHead>
                                        <TableHead>Şube Adı</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {branches.length > 0 ? (
                                        branches.map(branch => (
                                            <TableRow key={branch.subeId}>
                                                <TableCell className="font-mono text-xs">{branch.subeId}</TableCell>
                                                <TableCell className="font-medium">{branch.adi}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
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
