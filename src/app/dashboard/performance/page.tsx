'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/hooks/use-app';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, TrendingUp, TrendingDown, ChevronsRight, Award, User, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { Personel, PuanGirdisi, PerformanceRule, PerformanceRuleCategory } from '@/lib/types';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const getStaffAvatar = (personel: Personel) => personel.avatarUrl || `https://picsum.photos/seed/${personel.personelId}/100/100`;
const getStaffInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'P';


export default function PerformancePage() {
    const { user, firebaseUser, staff, scoreEntries, performanceRules, isLoading } = useApp();
    const { toast } = useToast();
    
    const [selectedPersonelId, setSelectedPersonelId] = useState<string>('');
    const [selectedRuleId, setSelectedRuleId] = useState<string>('');
    const [aciklama, setAciklama] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const manageableStaff = useMemo(() => {
        if (!user) return [];
        const activeStaff = staff.filter(s => s.aktif !== false);
        
        if (user.role === 'genel-mudur') {
            return activeStaff.filter(s => s.rol !== 'genel-mudur');
        }
        if (user.role === 'sube-muduru' && user.branchId) {
            return activeStaff.filter(s => s.subeId === user.branchId && s.rol === 'calisan');
        }
        return [];
    }, [user, staff]);

    const staffWithScores = useMemo(() => {
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);

        const activeStaff = staff.filter(s => s.aktif !== false);

        const staffScores = activeStaff.map(personel => {
            const personelEntries = scoreEntries.filter(entry => 
                entry.personelId === personel.personelId && 
                isWithinInterval(entry.tarih, { start: monthStart, end: monthEnd })
            );

            const directScore = personelEntries.reduce((sum, entry) => sum + entry.puan, 0);

            let purityBonuses: Record<PerformanceRuleCategory, number> = {
                Operational: 5,
                Discipline: 5,
                Customer: 5,
            };

            let categoryErrorCounts: Record<PerformanceRuleCategory, number> = {
                Operational: 0,
                Discipline: 0,
                Customer: 0,
            };
            
            const penaltyEntries = personelEntries
                .filter(entry => entry.puan < 0)
                .sort((a,b) => a.tarih.getTime() - b.tarih.getTime());

            penaltyEntries.forEach(entry => {
                const rule = performanceRules.find(r => r.ruleId === entry.ruleId);
                if (!rule) return;
                
                const category = rule.category;
                categoryErrorCounts[category]++;
                
                // Formula: Deduction = (PenaltyScore * RepetitionFactor * 0.1)
                const deduction = Math.abs(rule.score) * categoryErrorCounts[category] * 0.1;
                
                purityBonuses[category] = Math.max(0, purityBonuses[category] - deduction);
            });
            
            const totalPurityBonus = Object.values(purityBonuses).reduce((sum, bonus) => sum + bonus, 0);
            const baseScoreComponent = 75 + directScore;
            const finalScore = baseScoreComponent + totalPurityBonus;

            return {
                ...personel,
                finalScore: finalScore,
                baseScoreComponent: baseScoreComponent,
                purityBonusComponent: totalPurityBonus,
            };
        });
        
        return staffScores
            .filter(s => {
                if(user?.role === 'genel-mudur') return true;
                if(user?.role === 'sube-muduru') return s.subeId === user.branchId;
                return false;
            })
            .sort((a, b) => b.finalScore - a.finalScore);

    }, [staff, scoreEntries, performanceRules, selectedMonth, user]);
    
    const recentScoreEntries = useMemo(() => {
        return scoreEntries
        .sort((a,b) => b.tarih.getTime() - a.tarih.getTime())
        .slice(0, 10)
        .map(entry => {
            const personel = staff.find(s => s.personelId === entry.personelId);
            return { ...entry, personelAdi: personel?.adi || 'Bilinmiyor' };
        });
    }, [scoreEntries, staff]);

    const groupedRules = useMemo(() => {
        return performanceRules.reduce((acc, rule) => {
            const category = rule.category || 'Diğer';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(rule);
            return acc;
        }, {} as Record<PerformanceRuleCategory | 'Diğer', PerformanceRule[]>);
    }, [performanceRules]);


    const handleSubmit = async () => {
        const selectedRule = performanceRules.find(r => r.ruleId === selectedRuleId);

        if (!firebaseUser || !selectedPersonelId || !selectedRule) {
            toast({ title: 'Hata', description: 'Lütfen personel ve bir işlem türü seçin.', variant: 'destructive'});
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const newEntryRef = doc(collection(db, 'scoreEntries'));
            
            const newEntry: Omit<PuanGirdisi, 'puanId'> = {
                personelId: selectedPersonelId,
                verenMudurId: firebaseUser.uid,
                verenMudurAdi: user?.name || '',
                puan: selectedRule.score,
                aciklama: `${selectedRule.name}${aciklama ? `: ${aciklama.trim()}` : ''}`,
                tarih: new Date(),
                ruleId: selectedRule.ruleId
            };
            batch.set(newEntryRef, newEntry);
            
            await batch.commit();

            toast({ title: 'Başarılı', description: 'Performans girdisi başarıyla kaydedildi.'});
            setSelectedPersonelId('');
            setSelectedRuleId('');
            setAciklama('');

        } catch (error) {
            console.error("Error saving score entry:", error);
            toast({ title: 'Hata', description: 'Puan kaydedilirken bir sorun oluştu.', variant: 'destructive'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (user?.role === 'calisan') {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Erişim Reddedildi</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Bu sayfayı sadece yöneticiler görüntüleyebilir.</p>
                </CardContent>
            </Card>
        );
    }
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }


    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    Performans Yönetimi
                </h1>
                <p className="text-muted-foreground">
                    Personel performansını standart kurallar ile takip edin ve yönetin.
                </p>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <ChevronsRight /> Performans Girdisi
                        </CardTitle>
                        <CardDescription>Personel için bir ödül veya ceza işlemi seçin.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Personel</label>
                            <Select value={selectedPersonelId} onValueChange={setSelectedPersonelId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Personel seç..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {manageableStaff.map(p => (
                                        <SelectItem key={p.personelId} value={p.personelId}>{p.adi}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             <label className="text-sm font-medium">İşlem Türü</label>
                            <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bir kural seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {performanceRules.length > 0 ? (
                                        Object.entries(groupedRules).map(([category, rules]) => (
                                            <SelectGroup key={category}>
                                                <SelectLabel>{category}</SelectLabel>
                                                {rules.map(rule => (
                                                    <SelectItem key={rule.ruleId} value={rule.ruleId}>
                                                        <div className='flex justify-between w-full'>
                                                            <span>{rule.name}</span>
                                                            <span className={cn('font-bold', rule.score > 0 ? 'text-green-600' : 'text-red-600')}>
                                                                {rule.score > 0 ? `+${rule.score}` : rule.score}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))
                                    ) : (
                                        <div className='p-4 text-center text-sm text-muted-foreground'>
                                            Hiç kural tanımlanmamış. <a href="/dashboard/management/performance-rules" className='underline text-primary'>Tanımla</a>
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ek Açıklama (Opsiyonel)</label>
                            <Textarea 
                                placeholder="Gerekirse bu işlemle ilgili ek detay verin."
                                value={aciklama}
                                onChange={(e) => setAciklama(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleSubmit} disabled={isSubmitting || !selectedPersonelId || !selectedRuleId}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Kaydet'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                             <CardTitle className="flex items-center gap-2">
                                <Award /> Genel Puan Durumu ({format(selectedMonth, 'MMMM yyyy', {locale: tr})})
                            </CardTitle>
                             <CardDescription>Tüm personelin, formüle göre hesaplanmış anlık puanları.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-4">
                                {staffWithScores.map(p => (
                                    <div key={p.personelId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar className='h-9 w-9'>
                                                <AvatarImage src={getStaffAvatar(p)} />
                                                <AvatarFallback>{getStaffInitials(p.adi)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{p.adi}</p>
                                                <p className="text-xs text-muted-foreground">{p.rol}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-right">
                                            <span className="font-bold text-lg">{p.baseScoreComponent.toFixed(2)}</span>
                                            <span className="font-bold text-green-600">({p.purityBonusComponent.toFixed(2)})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                               <History/> Son Puan Hareketleri
                            </CardTitle>
                             <CardDescription>Sistemde kaydedilen son 10 puan/ceza işlemi.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Personel</TableHead>
                                            <TableHead>Açıklama</TableHead>
                                            <TableHead>Tarih</TableHead>
                                            <TableHead className="text-right">Puan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentScoreEntries.map(entry => (
                                            <TableRow key={entry.puanId}>
                                                <TableCell className="font-medium">{entry.personelAdi}</TableCell>
                                                <TableCell className="text-muted-foreground">{entry.aciklama}</TableCell>
                                                <TableCell>{format(entry.tarih, 'd MMM, HH:mm', { locale: tr })}</TableCell>
                                                <TableCell className={`text-right font-bold ${entry.puan > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {entry.puan > 0 ? `+${entry.puan}` : entry.puan}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                     </Card>
                </div>
            </div>
        </div>
    );
}
