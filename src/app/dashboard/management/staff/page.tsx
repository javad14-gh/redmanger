// src/app/dashboard/management/staff/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { Personel, Sube, AppUser, UserRole } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Loader2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';
// NOTE: We don't have a way to CREATE users with email/password from the client SDK directly for security reasons.
// This form would typically call a serverless function. For this prototype, we'll just add user data to Firestore.

const staffSchema = z.object({
  adi: z.string().min(2, 'Ad en az 2 karakter olmalıdır.'),
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
  rol: z.enum(['sube-muduru', 'calisan'], { required_error: 'Rol seçimi zorunludur.'}),
  subeId: z.string().min(1, 'Şube seçimi zorunludur.'),
  canManageInventory: z.boolean().default(false),
  aktif: z.boolean().default(true),
});

// A separate schema for creation where password is required
const createStaffSchema = staffSchema.extend({
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
});

type StaffFormData = z.infer<typeof staffSchema>;
type CreateStaffFormData = z.infer<typeof createStaffSchema>;


const getStaffAvatar = (personel?: Personel) => personel?.avatarUrl || `https://picsum.photos/seed/${personel?.personelId || 'new'}/100/100`;
const getStaffInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P';


const StaffForm = ({ staffMember, onFormSubmit, closeDialog, currentUser }: { staffMember?: Personel, onFormSubmit: (data: any, isNew: boolean) => Promise<void>, closeDialog: () => void, currentUser: AppUser }) => {
    const { branches } = useApp();
    const isNewUser = !staffMember;
    
    const form = useForm<StaffFormData | CreateStaffFormData>({
        resolver: zodResolver(isNewUser ? createStaffSchema : staffSchema),
        defaultValues: staffMember ? {
            adi: staffMember.adi,
            email: staffMember.email,
            rol: staffMember.rol as 'sube-muduru' | 'calisan',
            subeId: staffMember.subeId,
            canManageInventory: staffMember.canManageInventory || false,
            aktif: staffMember.aktif !== false, // default to true if undefined
        } : {
            adi: '',
            email: '',
            password: '',
            rol: 'calisan',
            subeId: currentUser.role === 'sube-muduru' ? currentUser.branchId : '',
            canManageInventory: false,
            aktif: true,
        },
    });
    
    const onSubmit = async (data: StaffFormData | CreateStaffFormData) => {
        await onFormSubmit(data, isNewUser);
        closeDialog();
    };
    
    const availableRoles = currentUser.role === 'genel-mudur' 
        ? [{value: 'sube-muduru', label: 'Şube Müdürü'}, {value: 'calisan', label: 'Çalışan'}]
        : [{value: 'calisan', label: 'Çalışan'}];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="adi" render={({ field }) => (
                    <FormItem><FormLabel>Ad Soyad</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-posta</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                {isNewUser && (
                     <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Şifre</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
                <FormField control={form.control} name="rol" render={({ field }) => (
                    <FormItem><FormLabel>Rol</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger></FormControl>
                            <SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="subeId" render={({ field }) => (
                    <FormItem><FormLabel>Şube</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={currentUser.role === 'sube-muduru'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger></FormControl>
                            <SelectContent>{branches.map(b => <SelectItem key={b.subeId} value={b.subeId}>{b.adi}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )}/>
                 <div className="space-y-2">
                    <FormField control={form.control} name="canManageInventory" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Depo Yönetimi Yetkisi</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="aktif" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>Personel Aktif</FormLabel>
                                <FormMessage>Personelin sistemde aktif olup olmadığını belirtir.</FormMessage>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
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

export default function StaffManagementPage() {
    const { user, staff, branches } = useApp();
    const { toast } = useToast();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Personel | undefined>(undefined);

    const handleFormSubmit = async (data: any, isNew: boolean) => {
        if (!user) return;
        
        // This is a placeholder for creating user in Firebase Auth which should be done via a backend function
        // For now, we just show a toast message.
        if (isNew) {
             toast({
                title: "Prototip Notu",
                description: "Gerçek bir uygulamada, kullanıcı Firebase Authentication'da oluşturulur. Bu prototipte sadece Firestore'a veri ekliyoruz."
             });
             try {
                const newStaffRef = doc(collection(db, "users"));
                const newUser: Omit<Personel, 'personelId'> = {
                    adi: data.adi,
                    email: data.email,
                    rol: data.rol,
                    subeId: data.subeId,
                    canManageInventory: data.canManageInventory,
                    avatarUrl: `https://picsum.photos/seed/${newStaffRef.id}/100/100`,
                    tanimlananSaat: 160, // default
                    aktif: data.aktif,
                };
                await setDoc(newStaffRef, newUser);
                toast({ title: 'Başarılı', description: 'Yeni personel başarıyla Firestore\'a eklendi.' });
             } catch(e) {
                 console.error(e);
                 toast({ title: 'Firestore Hatası', description: 'Personel Firestore\'a eklenemedi.', variant: 'destructive'});
             }

        } else {
             // Update existing user
            try {
                const staffRef = doc(db, 'users', editingStaff!.personelId);
                await updateDoc(staffRef, {
                    adi: data.adi,
                    email: data.email,
                    rol: data.rol,
                    subeId: data.subeId,
                    canManageInventory: data.canManageInventory,
                    aktif: data.aktif,
                });
                toast({ title: 'Başarılı', description: 'Personel bilgileri güncellendi.' });
            } catch(e) {
                console.error(e);
                toast({ title: 'Hata', description: 'Personel bilgileri güncellenemedi.', variant: 'destructive'});
            }
        }
    };

    const openNewForm = () => {
        setEditingStaff(undefined);
        setFormOpen(true);
    };

    const openEditForm = (staffMember: Personel) => {
        setEditingStaff(staffMember);
        setFormOpen(true);
    };

    const getBranchName = (subeId: string) => branches.find(b => b.subeId === subeId)?.adi || 'Bilinmiyor';

    const visibleStaff = useMemo(() => {
        if (!user) return [];
        if (user.role === 'genel-mudur') return staff.filter(s => s.rol !== 'genel-mudur');
        if (user.role === 'sube-muduru') return staff.filter(s => s.subeId === user.branchId);
        return [];
    }, [user, staff]);


    if (!user || (user.role !== 'genel-mudur' && user.role !== 'sube-muduru')) {
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
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Personel Yönetimi</h1>
                    <p className="text-muted-foreground">Personel bilgilerini düzenleyin ve izinlerini yönetin.</p>
                </div>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStaff ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}</DialogTitle>
                        <DialogDescription>
                            Personel bilgilerini ve yetkilerini buradan yönetin.
                        </DialogDescription>
                    </DialogHeader>
                    <StaffForm
                        staffMember={editingStaff}
                        onFormSubmit={handleFormSubmit}
                        closeDialog={() => setFormOpen(false)}
                        currentUser={user}
                    />
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users/> Personel Listesi</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Personel</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Şube</TableHead>
                                    <TableHead>Yetkiler</TableHead>
                                    <TableHead className="text-right">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleStaff.map(p => (
                                    <TableRow key={p.personelId} className={p.aktif === false ? 'bg-muted/50' : ''}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={getStaffAvatar(p)} />
                                                    <AvatarFallback>{getStaffInitials(p.adi)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{p.adi}</p>
                                                    <p className="text-sm text-muted-foreground">{p.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="secondary">{p.rol}</Badge></TableCell>
                                        <TableCell>
                                             <Badge variant={p.aktif === false ? 'destructive' : 'default'} className={cn(p.aktif !== false && 'bg-green-600 hover:bg-green-700')}>
                                                {p.aktif === false ? 'Ayrıldı' : 'Aktif'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{getBranchName(p.subeId)}</TableCell>
                                        <TableCell>
                                            {p.canManageInventory && <Badge variant="outline">Depo</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => openEditForm(p)}>
                                                <Edit />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
