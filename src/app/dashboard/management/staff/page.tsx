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
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';


const staffSchema = z.object({
  adi: z.string().min(2, 'Ad en az 2 karakter olmalıdır.'),
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
  rol: z.enum(['sube-muduru', 'calisan'], { required_error: 'Rol seçimi zorunludur.'}),
  subeId: z.string().min(1, 'Şube seçimi zorunludur.'),
  tanimlananSaat: z.coerce.number().min(1, 'Tanımlanan saat en az 1 olmalıdır.').max(16, 'Tanımlanan saat en fazla 16 olabilir.'),
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
            tanimlananSaat: staffMember.tanimlananSaat || 8,
            canManageInventory: staffMember.canManageInventory || false,
            aktif: staffMember.aktif !== false, // default to true if undefined
            ...(isNewUser ? {} : { password: '' }),
        } : {
            adi: '',
            email: '',
            password: '',
            rol: 'calisan',
            subeId: currentUser.role === 'sube-muduru' ? currentUser.branchId : '',
            tanimlananSaat: 8,
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
                {isNewUser && (
                     <Alert variant="default">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Önemli Not</AlertTitle>
                        <AlertDescription>
                            Yeni personel eklemek iki adımlıdır: 1) Bu formla Firestore verisini oluşturun. 2) Firebase Authentication'da aynı e-posta/şifre ile kullanıcı oluşturun ve dönen UID'yi Firestore'daki `uid` alanına manuel olarak ekleyin.
                        </AlertDescription>
                    </Alert>
                )}
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
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="rol" render={({ field }) => (
                        <FormItem><FormLabel>Rol</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger></FormControl>
                                <SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )}/>
                     <FormField control={form.control} name="tanimlananSaat" render={({ field }) => (
                        <FormItem><FormLabel>Tanımlanan Saat</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
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
    const [showInactive, setShowInactive] = useState(false);
    
    /**
     * This is a placeholder for a Cloud Function that would create the user in Firebase Auth.
     * The client SDK cannot create users with email/password directly for security reasons.
     * @param email 
     * @param password 
     * @returns A simulated Auth UID.
     */
    const createUserInAuth = async (email: string, password: string): Promise<string> => {
        // In a real app, this would be a call to a Cloud Function.
        // e.g., `const result = await httpsCallable(functions, 'createUser')({ email, password });`
        // The function would return the new user's UID.
        toast({
           title: "Simülasyon Notu",
           description: "Gerçek uygulamada, kullanıcı Firebase Auth'da oluşturulur ve gerçek UID döner. Bu sadece bir simülasyondur.",
           variant: "default",
        });
        // For this prototype, we return a placeholder. You need to replace this with the real UID from Firebase Auth Console.
        return `yeni-kullanici-uid-${Date.now()}`;
    }

    const handleFormSubmit = async (data: any, isNew: boolean) => {
        if (!user) return;
        
        if (isNew) {
            // In a real scenario, you'd call a Cloud Function to create the auth user
            // and get the real UID back. For now, we're just creating the Firestore record.
             try {
                const newStaffRef = doc(collection(db, "users"));
                // The UID should come from your backend/cloud function after creating the auth user.
                // For now, we'll use the document ID as a placeholder, but this MUST be updated manually.
                const newUID = newStaffRef.id;

                const newUser: Omit<Personel, 'personelId'> = {
                    uid: newUID, // Placeholder UID. MUST BE UPDATED MANUALLY.
                    adi: data.adi,
                    email: data.email,
                    rol: data.rol,
                    subeId: data.subeId,
                    tanimlananSaat: data.tanimlananSaat,
                    canManageInventory: data.canManageInventory,
                    avatarUrl: `https://picsum.photos/seed/${newStaffRef.id}/100/100`,
                    aktif: data.aktif,
                };
                await setDoc(newStaffRef, newUser);
                toast({ title: 'Başarılı', description: 'Yeni personel başarıyla Firestore\'a eklendi. Lütfen Auth UID\'sini manuel olarak güncelleyin.' });
             } catch(e) {
                 console.error(e);
                 toast({ title: 'Firestore Hatası', description: 'Personel Firestore\'a eklenemedi.', variant: 'destructive'});
             }

        } else {
             // Update existing user
            try {
                const staffRef = doc(db, 'users', editingStaff!.personelId);
                // We don't update the UID here. It's considered immutable.
                await updateDoc(staffRef, {
                    adi: data.adi,
                    email: data.email,
                    rol: data.rol,
                    subeId: data.subeId,
                    tanimlananSaat: data.tanimlananSaat,
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
        let filteredStaff = staff;

        if (user.role === 'genel-mudur') {
            filteredStaff = staff.filter(s => s.rol !== 'genel-mudur');
        } else if (user.role === 'sube-muduru') {
            filteredStaff = staff.filter(s => s.subeId === user.branchId);
        } else {
            return []; // No staff visible for other roles
        }
        
        if (!showInactive) {
            filteredStaff = filteredStaff.filter(s => s.aktif !== false);
        }

        return filteredStaff;
    }, [user, staff, showInactive]);


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
             <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Personel Yönetimi</h1>
                    <p className="text-muted-foreground">Personel bilgilerini düzenleyin ve izinlerini yönetin.</p>
                </div>
                 <div className="flex items-center gap-4">
                    <Button onClick={openNewForm}><PlusCircle/> Yeni Personel Ekle</Button>
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
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><Users/> Personel Listesi</CardTitle>
                        <div className="flex items-center space-x-2">
                            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                            <Label htmlFor="show-inactive">Ayrılanları Göster</Label>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Personel</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Tanımlı Saat</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Şube</TableHead>
                                    <TableHead>Yetkiler</TableHead>
                                    <TableHead className="text-right">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleStaff.length > 0 ? (
                                    visibleStaff.map(p => (
                                    <TableRow key={p.personelId} className={cn(p.aktif === false && 'bg-muted/50')}>
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
                                        <TableCell className="text-center">{p.tanimlananSaat} saat</TableCell>
                                        <TableCell>
                                             <Badge variant={p.aktif === false ? 'destructive' : 'default'} className={cn(p.aktif !== false && 'bg-green-600 hover:bg-green-700 text-white')}>
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
                                ))) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Gösterilecek personel bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
