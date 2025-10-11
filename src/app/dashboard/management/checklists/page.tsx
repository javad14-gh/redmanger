// src/app/dashboard/management/checklists/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, Edit, Save, Loader2, ListChecks, X, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { ChecklistTemplate } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const checklistItemSchema = z.object({
  id: z.string(),
  metin: z.string().min(3, 'Açıklama en az 3 karakter olmalıdır.'),
});

const checklistTemplateSchema = z.object({
  adi: z.string().min(3, 'Şablon adı en az 3 karakter olmalıdır.'),
  aciklama: z.string().optional(),
  items: z.array(checklistItemSchema).min(1, 'En az bir checklist maddesi eklemelisiniz.'),
  subeId: z.string().min(1, 'Şube seçimi zorunludur.'),
});

type ChecklistTemplateFormData = z.infer<typeof checklistTemplateSchema>;

const TemplateForm = ({ template, onFormSubmit, closeDialog }: { template?: ChecklistTemplate, onFormSubmit: (data: ChecklistTemplateFormData) => Promise<void>, closeDialog: () => void }) => {
  const { user, branches } = useApp();
  const isGeneralManager = user?.role === 'genel-mudur';
  
  const form = useForm<ChecklistTemplateFormData>({
    resolver: zodResolver(checklistTemplateSchema),
    defaultValues: template ? {
      adi: template.adi,
      aciklama: template.aciklama || '',
      items: template.items,
      subeId: template.subeId,
    } : {
      adi: '',
      aciklama: '',
      items: [{ id: `item-${Date.now()}`, metin: '' }],
      subeId: isGeneralManager ? '' : user?.branchId || '',
    },
  });

  const { fields, append, remove, swap, insert } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (data: ChecklistTemplateFormData) => {
    await onFormSubmit(data);
    closeDialog();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="adi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şablon Adı</FormLabel>
              <FormControl><Input placeholder="Örn: Açılış Kontrolleri" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="aciklama"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Açıklama (Opsiyonel)</FormLabel>
              <FormControl><Textarea placeholder="Bu checklist ne için kullanılır?" {...field} /></FormControl>
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
                  <FormControl><SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.subeId} value={b.subeId}>{b.adi}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div>
          <FormLabel>Checklist Maddeleri</FormLabel>
          <div className="space-y-2 mt-2 max-h-64 overflow-y-auto pr-2">
            <TooltipProvider>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.metin`}
                  render={({ field }) => (
                    <FormItem className="flex-grow">
                      <FormControl><Input {...field} placeholder={`Madde ${index + 1}`} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="icon" onClick={() => swap(index, index - 1)} disabled={index === 0}><ArrowUp/></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Yukarı Taşı</p></TooltipContent>
                 </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Button type="button" variant="outline" size="icon" onClick={() => swap(index, index + 1)} disabled={index === fields.length - 1}><ArrowDown/></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Aşağı Taşı</p></TooltipContent>
                 </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Button type="button" variant="outline" size="icon" onClick={() => insert(index + 1, { id: `item-${Date.now()}`, metin: ''})}><Plus/></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Araya Madde Ekle</p></TooltipContent>
                 </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Maddeyi Sil</p></TooltipContent>
                </Tooltip>
              </div>
            ))}
            </TooltipProvider>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ id: `item-${Date.now()}`, metin: '' })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Sona Madde Ekle
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={closeDialog}>İptal</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
            Şablonu Kaydet
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};


export default function ChecklistManagementPage() {
  const { user, firebaseUser, branches } = useApp();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    
    // Allow general manager to see all, branch managers to see their own
    const q = user.role === 'genel-mudur'
      ? collection(db, "checklistTemplates")
      : query(collection(db, "checklistTemplates"), where("subeId", "==", user.branchId || ''));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates = snapshot.docs.map(doc => ({
        ...doc.data(),
        templateId: doc.id,
        createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
      } as ChecklistTemplate));
      setTemplates(fetchedTemplates);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching templates:", error);
      toast({ title: 'Hata', description: 'Şablonlar getirilirken bir hata oluştu.', variant: 'destructive' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleFormSubmit = async (data: ChecklistTemplateFormData) => {
    if (!firebaseUser) return;
    
    try {
      if (editingTemplate) {
        // Update existing template
        const templateRef = doc(db, 'checklistTemplates', editingTemplate.templateId);
        await updateDoc(templateRef, {
          ...data,
          subeId: user?.role === 'genel-mudur' ? data.subeId : user?.branchId
        });
        toast({ title: 'Başarılı', description: 'Checklist şablonu güncellendi.' });
      } else {
        // Create new template
        const newTemplateRef = doc(collection(db, 'checklistTemplates'));
        const newTemplate: Omit<ChecklistTemplate, 'templateId'> = {
          ...data,
          subeId: user?.role === 'genel-mudur' ? data.subeId : user?.branchId!,
          createdAt: new Date(),
          createdBy: firebaseUser.uid,
        };
        await setDoc(newTemplateRef, newTemplate);
        toast({ title: 'Başarılı', description: 'Yeni checklist şablonu oluşturuldu.' });
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast({ title: 'Hata', description: 'Şablon kaydedilirken bir hata oluştu.', variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteDoc(doc(db, 'checklistTemplates', templateId));
      toast({ title: 'Silindi', description: 'Checklist şablonu başarıyla silindi.' });
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({ title: 'Hata', description: 'Şablon silinirken bir hata oluştu.', variant: 'destructive' });
    }
  };
  
  const getBranchName = (subeId: string) => branches.find(b => b.subeId === subeId)?.adi || 'Bilinmiyor';

  if (!user || (user.role !== 'genel-mudur' && user.role !== 'sube-muduru')) {
    return (
      <Card>
        <CardHeader><CardTitle>Erişim Reddedildi</CardTitle></CardHeader>
        <CardContent><p>Bu sayfayı görüntüleme yetkiniz yok.</p></CardContent>
      </Card>
    );
  }
  
  const openNewForm = () => {
    setEditingTemplate(undefined);
    setFormOpen(true);
  }
  
  const openEditForm = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Checklist Tanımları</h1>
          <p className="text-muted-foreground">Yeni checklist şablonları oluşturun, mevcutları düzenleyin veya silin.</p>
        </div>
        <Button onClick={openNewForm}><PlusCircle/> Yeni Şablon Oluştur</Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}</DialogTitle>
            <DialogDescription>
              Checklist için gerekli bilgileri ve maddeleri aşağıya girin.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm 
            template={editingTemplate}
            onFormSubmit={handleFormSubmit}
            closeDialog={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks/> Mevcut Şablonlar</CardTitle>
          <CardDescription>Oluşturulmuş tüm checklist şablonları aşağıda listelenmiştir.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : templates.length > 0 ? (
            <div className="space-y-4">
              {templates.map(template => (
                <Card key={template.templateId} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4">
                  <div className="flex-1 mb-4 md:mb-0">
                    <p className="font-bold">{template.adi}</p>
                    <p className="text-sm text-muted-foreground">{template.aciklama}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                       <span>Oluşturma: {template.createdAt ? format(template.createdAt, 'dd.MM.yyyy') : 'N/A'}</span>
                       {user.role === 'genel-mudur' && <Badge variant="outline">{getBranchName(template.subeId)}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2 self-end md:self-center">
                    <Button variant="outline" size="icon" onClick={() => openEditForm(template)}><Edit/></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon"><Trash2/></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{template.adi}" şablonunu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>İptal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTemplate(template.templateId)}>Evet, Sil</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Henüz bir checklist şablonu oluşturulmamış.</p>
              <Button variant="link" onClick={openNewForm}>Şimdi bir tane oluşturun.</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
