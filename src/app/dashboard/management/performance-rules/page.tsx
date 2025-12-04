'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, Edit, Save, Loader2, Award, ChevronsRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { PerformanceRule, PerformanceRuleCategory } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';


const ruleSchema = z.object({
  name: z.string().min(3, 'Kural adı en az 3 karakter olmalıdır.'),
  description: z.string().optional(),
  score: z.coerce.number().refine(val => val !== 0, 'Puan 0 olamaz.'),
  type: z.enum(['bonus', 'penalty']),
  category: z.enum(['Operasyon ve Kalite', 'Davranış ve Disiplin', 'Müşteri Memnuniyeti']),
});

type RuleFormData = z.infer<typeof ruleSchema>;

const RuleForm = ({ rule, onFormSubmit, closeDialog }: { rule?: PerformanceRule, onFormSubmit: (data: RuleFormData, ruleId?: string) => Promise<void>, closeDialog: () => void }) => {
    const form = useForm<RuleFormData>({
        resolver: zodResolver(ruleSchema),
        defaultValues: rule ? {
            name: rule.name,
            description: rule.description,
            score: rule.score,
            type: rule.type,
            category: rule.category,
        } : {
            name: '',
            description: '',
            score: 0,
            type: 'penalty',
            category: 'Operasyon ve Kalite',
        },
    });

    const onSubmit = async (data: RuleFormData) => {
        // Ensure score has correct sign based on type
        if (data.type === 'bonus' && data.score < 0) data.score = Math.abs(data.score);
        if (data.type === 'penalty' && data.score > 0) data.score = -Math.abs(data.score);
        
        await onFormSubmit(data, rule?.ruleId);
        form.reset();
        closeDialog();
    };
    
    const categories: PerformanceRuleCategory[] = ['Operasyon ve Kalite', 'Davranış ve Disiplin', 'Müşteri Memnuniyeti'];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Kural Adı</FormLabel>
                        <FormControl><Input placeholder="Örn: Müşteri Memnuniyeti, Sipariş Hatası" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Açıklama (Opsiyonel)</FormLabel>
                        <FormControl><Input placeholder="Bu kuralın ne anlama geldiğini açıklayın." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Kategori</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategori seçin" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Kural Tipi</FormLabel>
                        <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="bonus" /></FormControl>
                                    <FormLabel className="font-normal">Ödül (Pozitif Puan)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="penalty" /></FormControl>
                                    <FormLabel className="font-normal">Ceza (Negatif Puan)</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="score" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Puan Değeri (Mutlak Değer)</FormLabel>
                        <FormControl><Input type="number" placeholder="Örn: 5, 10, 20" {...field} onChange={e => field.onChange(Math.abs(parseInt(e.target.value, 10)))} /></FormControl>
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


export default function PerformanceRulesPage() {
  const { user, performanceRules, isLoading } = useApp();
  const { toast } = useToast();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PerformanceRule | undefined>(undefined);
  
  const handleFormSubmit = async (data: RuleFormData, ruleId?: string) => {
    try {
        if (ruleId) {
            // Update
            const ruleRef = doc(db, "performanceRules", ruleId);
            await updateDoc(ruleRef, data as Partial<PerformanceRule>);
            toast({ title: 'Başarılı', description: 'Performans kuralı güncellendi.' });
        } else {
            // Create
            const newRuleRef = doc(collection(db, "performanceRules"));
            const newRule: Omit<PerformanceRule, 'ruleId'> = {
                ...data,
            };
            await setDoc(newRuleRef, newRule);
            toast({ title: 'Başarılı', description: 'Yeni performans kuralı oluşturuldu.' });
        }
    } catch (error) {
        console.error("Error saving rule:", error);
        toast({ title: 'Hata', description: 'Kural kaydedilirken bir hata oluştu.', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteDoc(doc(db, 'performanceRules', ruleId));
      toast({ title: 'Silindi', description: 'Kural başarıyla silindi.' });
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast({ title: 'Hata', description: 'Kural silinirken bir hata oluştu.', variant: 'destructive' });
    }
  };
  
  const openNewForm = () => {
    setEditingRule(undefined);
    setFormOpen(true);
  }
  
  const openEditForm = (rule: PerformanceRule) => {
    setEditingRule(rule);
    setFormOpen(true);
  }

  const isManager = user?.role === 'genel-mudur' || user?.role === 'sube-muduru';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Performans Kuralları Yönetimi</h1>
          <p className="text-muted-foreground">Performans değerlendirmesi için standart ödül ve ceza puanları oluşturun.</p>
        </div>
        {isManager && <Button onClick={openNewForm}><PlusCircle/> Yeni Kural Ekle</Button>}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Ekle'}</DialogTitle>
          </DialogHeader>
          <RuleForm
            rule={editingRule}
            onFormSubmit={handleFormSubmit}
            closeDialog={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Award/> Tanımlanmış Kurallar</CardTitle>
          <CardDescription>Oluşturulmuş tüm performans kuralları aşağıda listelenmiştir.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : performanceRules.length > 0 ? (
            <div className="space-y-4">
              {performanceRules.map(rule => (
                <Card key={rule.ruleId} className={cn("flex flex-col md:flex-row items-start md:items-center justify-between p-4", rule.type === 'bonus' ? 'bg-green-50/20 dark:bg-green-900/10' : 'bg-red-50/20 dark:bg-red-900/10')}>
                  <div className="flex-1 mb-4 md:mb-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold flex items-center gap-2">
                            {rule.name}
                            <span className={cn('font-bold text-lg', rule.score > 0 ? 'text-green-600' : 'text-red-600')}>
                            ({rule.score > 0 ? `+${rule.score}` : rule.score})
                            </span>
                        </p>
                        <Badge variant="outline">{rule.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rule.description || 'Açıklama yok'}</p>
                  </div>
                  {isManager && (
                    <div className="flex gap-2 self-end md:self-center">
                      <Button variant="outline" size="icon" onClick={() => openEditForm(rule)}><Edit/></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon"><Trash2/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{rule.name}" kuralını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteRule(rule.ruleId)}>Evet, Sil</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Henüz bir performans kuralı oluşturulmamış.</p>
              {isManager && <Button variant="link" onClick={openNewForm}>Şimdi bir tane oluşturun.</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
