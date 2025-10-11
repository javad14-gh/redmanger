// src/app/dashboard/checklists/page.tsx
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ListChecks, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompletedChecklist, ChecklistTemplate, CompletedChecklistItem } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import { doc, collection, onSnapshot, writeBatch, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn, getBusinessDate } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';


const ChecklistInstance = ({ template, date }: { template: ChecklistTemplate, date: Date }) => {
  const { user, firebaseUser } = useApp();
  const { toast } = useToast();
  const [completedItems, setCompletedItems] = useState<Record<string, CompletedChecklistItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [completedChecklistId, setCompletedChecklistId] = useState<string | null>(null);

  const startOfSelectedDay = useMemo(() => startOfDay(date), [date]);

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, "completedChecklists"),
      where("templateId", "==", template.templateId),
      where("tarih", "==", Timestamp.fromDate(startOfSelectedDay))
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsFromTemplate = template.items.reduce((acc, item) => {
        acc[item.id] = { itemId: item.id, metin: item.metin, tamamlandi: false };
        return acc;
      }, {} as Record<string, CompletedChecklistItem>);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data() as CompletedChecklist;
        setCompletedChecklistId(doc.id);
        
        data.items.forEach(completedItem => {
          if (itemsFromTemplate[completedItem.itemId]) {
            const completionTime = (completedItem.tamamlanmaZamani as any)?.toDate 
              ? (completedItem.tamamlanmaZamani as any).toDate() 
              : undefined;

            itemsFromTemplate[completedItem.itemId] = {
              ...itemsFromTemplate[completedItem.itemId],
              ...completedItem,
              metin: itemsFromTemplate[completedItem.itemId].metin,
              tamamlanmaZamani: completionTime,
            };
          }
        });
      } else {
        setCompletedChecklistId(null);
      }

      setCompletedItems(itemsFromTemplate);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching checklist instance:", error);
      toast({ title: 'Hata', description: 'Checklist verileri alınamadı.', variant: 'destructive'});
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [template, startOfSelectedDay, toast]);

  const handleToggle = async (itemId: string) => {
    if (!firebaseUser || !user) return;

    const currentItem = completedItems[itemId];
    const isNowComplete = !currentItem.tamamlandi;
    const isManager = user.role === 'genel-mudur' || user.role === 'sube-muduru';

    // Prevent unchecking if the user is not the one who completed it and is not a manager
    if (!isNowComplete && currentItem.tamamlayan?.personelId !== firebaseUser.uid && !isManager) {
        toast({
            title: 'Yetki Hatası',
            description: 'Bu maddeyi sadece tamamlayan kişi veya bir yönetici değiştirebilir.',
            variant: 'destructive',
        });
        return;
    }

    const newCompletedItems = { ...completedItems };
    const updatedItem: CompletedChecklistItem = {
        ...currentItem,
        tamamlandi: isNowComplete,
    };
    
    if (isNowComplete) {
        updatedItem.tamamlanmaZamani = new Date();
        updatedItem.tamamlayan = { personelId: firebaseUser.uid, adi: user.name };
    } else {
        // When unchecking, remove the completion details
        delete updatedItem.tamamlanmaZamani;
        delete updatedItem.tamamlayan;
    }
    
    newCompletedItems[itemId] = updatedItem;
    setCompletedItems(newCompletedItems); // Optimistic update

    try {
        const batch = writeBatch(db);
        let targetDocId = completedChecklistId;
        
        const itemsToSave = Object.values(newCompletedItems).map(item => {
            const itemToSave: any = { ...item };
            if (itemToSave.tamamlanmaZamani instanceof Date) {
                itemToSave.tamamlanmaZamani = Timestamp.fromDate(itemToSave.tamamlanmaZamani);
            }
            // Ensure properties that might be undefined are not sent to Firestore
            if (itemToSave.tamamlayan === undefined) delete itemToSave.tamamlayan;
            if (itemToSave.tamamlanmaZamani === undefined) delete itemToSave.tamamlanmaZamani;
            return itemToSave;
        });
        
        if (!targetDocId) {
            const newDocRef = doc(collection(db, "completedChecklists"));
            targetDocId = newDocRef.id;
            
            const initialChecklist: CompletedChecklist = {
                completedChecklistId: targetDocId,
                templateId: template.templateId,
                subeId: template.subeId,
                tarih: startOfDay(date), // Use the passed date
                items: itemsToSave as CompletedChecklistItem[],
            };
            batch.set(newDocRef, initialChecklist);
            setCompletedChecklistId(targetDocId);
        } else {
            const docRef = doc(db, "completedChecklists", targetDocId);
            batch.update(docRef, { items: itemsToSave });
        }
        
        await batch.commit();

    } catch (error) {
        console.error("Error updating checklist:", error);
        toast({ title: 'Hata', description: 'Değişiklik kaydedilemedi.', variant: 'destructive'});
        setCompletedItems(prev => ({...prev, [itemId]: currentItem}));
    }
  };
  
  if (isLoading) {
    return <div className="space-y-2 rounded-md border p-4"><Loader2 className="animate-spin" /></div>
  }

  const itemsArray = Object.values(completedItems);
  const isManager = user?.role === 'genel-mudur' || user?.role === 'sube-muduru';

  const totalItems = itemsArray.length;
  const completedCount = itemsArray.filter(item => item.tamamlandi).length;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  return (
    <div className="space-y-4">
       <div className="space-y-2 rounded-md border p-4">
        <div className="flex items-center gap-4 mb-4">
            <Progress value={progress} className="w-full" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {completedCount} / {totalItems} Tamamlandı
            </span>
        </div>
        {itemsArray.map((item) => {
          const canToggle = !item.tamamlandi || (item.tamamlayan?.personelId === firebaseUser?.uid) || isManager;
          return (
            <div key={item.itemId} className="flex items-start space-x-3">
              <Checkbox
                id={`item-${template.templateId}-${item.itemId}`}
                checked={item.tamamlandi}
                onCheckedChange={() => handleToggle(item.itemId)}
                disabled={!canToggle}
                className="mt-1"
              />
              <div className="flex flex-col">
                   <label
                      htmlFor={`item-${template.templateId}-${item.itemId}`}
                      className={cn(
                        "text-sm font-medium",
                        item.tamamlandi ? 'text-muted-foreground line-through' : '',
                        !canToggle && 'cursor-not-allowed'
                      )}
                   >
                      {item.metin}
                  </label>
                  {item.tamamlandi && item.tamamlayan && (
                      <span className="text-xs text-muted-foreground">
                          {item.tamamlayan.adi} tarafından, {item.tamamlanmaZamani ? format(item.tamamlanmaZamani, 'dd.MM.yyyy HH:mm') : ''}
                      </span>
                  )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};


export default function ChecklistsPage() {
  const { user } = useApp();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
  
  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    };

    let q;
    // General manager sees all templates
    if (user.role === 'genel-mudur') {
        q = collection(db, "checklistTemplates");
    } 
    // Branch manager sees templates for their specific branch
    else if (user.branchId) {
        q = query(collection(db, "checklistTemplates"), where("subeId", "==", user.branchId));
    } 
    // Employee with no branchId, don't query
    else {
        setIsLoading(false);
        setTemplates([]);
        return;
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTemplates = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                templateId: doc.id,
                createdAt: (data.createdAt as Timestamp)?.toDate(),
            } as ChecklistTemplate;
        }).sort((a,b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
        setTemplates(fetchedTemplates);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching checklist templates:", error);
        toast({ title: 'Hata', description: 'Checklist şablonları alınamadı.', variant: 'destructive'});
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);


  if (!user) {
     return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  const hasNoBranchAndViewingRights = user.role !== 'genel-mudur' && !user.branchId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Kontrol Listeleri
            </h1>
            <p className="text-muted-foreground">
            Günlük görevleri buradan yönetin ve tamamlayın.
            </p>
        </div>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={'outline'}
                    className={cn('w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: tr }) : <span>Tarih seçin</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks />
            Günlük Görevler
          </CardTitle>
           <CardDescription>
            İlgili şablonu seçip görevleri tamamlayın. Her bir görev kimin tarafından ve ne zaman tamamlandığını kaydeder.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
             <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
           ) : hasNoBranchAndViewingRights ? (
              <div className="text-center py-10 text-muted-foreground">
                <p>Bu sayfayı görüntülemek için bir şubeye atanmış olmalısınız.</p>
             </div>
           ) : templates.length > 0 ? (
             <Tabs defaultValue={templates[0]?.templateId} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {templates.map(t => <TabsTrigger key={t.templateId} value={t.templateId}>{t.adi}</TabsTrigger>)}
                </TabsList>
                {templates.map(t => (
                    <TabsContent key={t.templateId} value={t.templateId} className='pt-4'>
                        <ChecklistInstance template={t} date={selectedDate} />
                    </TabsContent>
                ))}
            </Tabs>
           ) : (
             <div className="text-center py-10 text-muted-foreground">
                <p>Şubeniz için tanımlanmış bir kontrol listesi şablonu bulunamadı.</p>
                {user.role !== 'calisan' && (
                  <Button variant="link" asChild><a href="/dashboard/management/checklists">Şimdi bir tane oluşturun.</a></Button>
                )}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
