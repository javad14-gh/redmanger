'use client';

import { useApp } from '@/hooks/use-app';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, ListChecks, Users, Award } from 'lucide-react';
import Link from 'next/link';

const ManagementCard = ({ href, icon: Icon, title, description }: { href: string, icon: React.ElementType, title: string, description: string }) => (
    <Link href={href} className="block hover:bg-muted/50 rounded-lg transition-colors">
        <Card className="h-full">
            <CardHeader className="flex-row gap-4 items-center">
                <div className="flex-shrink-0">
                    <Icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </CardHeader>
        </Card>
    </Link>
);


export default function ManagementPage() {
    const { user } = useApp();

    const managementItems = [
        {
            href: '/dashboard/management/staff',
            icon: Users,
            title: 'Personel Yönetimi',
            description: 'Personel ekleyin, düzenleyin ve izinlerini yönetin.',
            roles: ['genel-mudur', 'sube-muduru'],
        },
        {
            href: '/dashboard/management/checklists',
            icon: ListChecks,
            title: 'Checklist Tanımları',
            description: 'Günlük, haftalık veya özel kontrol listeleri oluşturun ve düzenleyin.',
            roles: ['genel-mudur', 'sube-muduru'],
        },
        {
            href: '/dashboard/management/performance-rules',
            icon: Award,
            title: 'Performans Kuralları',
            description: 'Ödül ve ceza puanlarını standartlaştırın.',
            roles: ['genel-mudur', 'sube-muduru'],
        },
        {
            href: '/dashboard/management/branches',
            icon: Building,
            title: 'Şube Yönetimi',
            description: 'Yeni şubeler ekleyin ve mevcut şubeleri görüntüleyin.',
            roles: ['genel-mudur'],
        },
    ];

    const accessibleItems = managementItems.filter(item => item.roles.includes(user?.role || ''));

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    Yönetim Paneli
                </h1>
                <p className="text-muted-foreground">
                    Sistem genelindeki ayarları ve temel verileri buradan yönetin.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accessibleItems.map(item => (
                    <ManagementCard key={item.href} {...item} />
                ))}
            </div>

            {user?.role === 'calisan' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Erişim Reddedildi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
