'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/hooks/use-app';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarInset, SidebarFooter, useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import Logo from '@/components/Logo';
import { UserNav } from '@/components/UserNav';
import { AreaChart, Bot, Clock, FileText, LayoutDashboard, ListChecks, Loader2, PanelLeftClose, Settings, Users, Warehouse, Wallet, Award } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Panel' },
  { href: '/dashboard/shifts', icon: Clock, label: 'Vardiyalar', roles: ['sube-muduru'] },
  { href: '/dashboard/inventory', icon: Warehouse, label: 'Depo', permission: 'canManageInventory' },
  { href: '/dashboard/cash-register', icon: Wallet, label: 'Kasa', roles: ['genel-mudur', 'sube-muduru'] },
  { href: '/dashboard/checklists', icon: ListChecks, label: 'Kontrol Listeleri' },
  { 
    href: '/dashboard/reports', 
    icon: AreaChart, 
    label: 'Raporlar', 
    roles: ['genel-mudur', 'sube-muduru'],
    subItems: [
      { href: '/dashboard/reports', label: 'Aylık Özet' },
      { href: '/dashboard/reports/shift-details', label: 'Detaylı Vardiya' },
      { href: '/dashboard/reports/sales', label: 'Satış Analizi', roles: ['genel-mudur', 'sube-muduru']},
    ]
  },
  { href: '/dashboard/performance', icon: Award, label: 'Performans' },
  { href: '/dashboard/ai-tools', icon: Bot, label: 'Satış Girişi', roles: ['genel-mudur', 'sube-muduru'] },
  { 
    href: '/dashboard/management', 
    icon: Settings, 
    label: 'Yönetim', 
    roles: ['genel-mudur', 'sube-muduru'],
    subItems: [
      { href: '/dashboard/management/staff', label: 'Personel' },
      { href: '/dashboard/management/branches', label: 'Şubeler', roles: ['genel-mudur'] },
      { href: '/dashboard/management/checklists', label: 'Checklist Tanımları' },
      { href: '/dashboard/management/performance-rules', label: 'Performans Kuralları' },
    ]
  },
];

const SidebarCollapseButton = () => {
    const { toggleSidebar } = useSidebar();
    return (
        <Button variant="ghost" className="w-full justify-start" onClick={toggleSidebar}>
            <PanelLeftClose />
            <span>Kapat</span>
        </Button>
    )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const userHasAccess = (item: { roles?: string[], permission?: string }) => {
    if (!user) return false;
    
    // General items visible to all authenticated users
    if (!item.roles && !item.permission) return true;

    // Role-based access
    const hasRoleAccess = item.roles ? item.roles.includes(user.role) : false;

    // Permission-based access (e.g., canManageInventory)
    let hasPermissionAccess = false;
    if (item.permission) {
        // Any user with the specific permission flag
        const hasSpecificPermission = (user as any)[item.permission] === true;
        // Managers also get access implicitly to permission-based items
        const isManager = user.role === 'genel-mudur' || user.role === 'sube-muduru';
        hasPermissionAccess = hasSpecificPermission || isManager;
    }

    return hasRoleAccess || hasPermissionAccess;
  };


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
             <Logo className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="font-headline text-lg font-semibold text-sidebar-foreground">Red Fries</span>
              <span className="text-xs text-sidebar-foreground/70">Manager</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.filter(item => userHasAccess(item)).map((item) => (
              item.subItems && item.subItems.length > 0 ? (
                 <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {item.subItems.filter(sub => userHasAccess(sub)).map(subItem => (
                        <SidebarMenuSubItem key={subItem.href}>
                            <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                <Link href={subItem.href}>{subItem.label}</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                 </SidebarMenuItem>
              ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarCollapseButton />
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
           <SidebarTrigger className="md:hidden"/>
          <div className="flex items-center gap-4 ml-auto">
             <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
