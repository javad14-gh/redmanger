'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from '@/hooks/use-app';
import { LogOut, Settings, User, Download, Share, PlusSquare } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export function UserNav() {
  const { user, logout } = useApp();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showSafariInstall, setShowSafariInstall] = useState(false);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsPwaInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback for browsers that don't support beforeinstallprompt but support PWA (like Safari)
    const checkPwaInstallable = () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (!isStandalone) {
             setIsPwaInstallable(true);
        }
    };
    checkPwaInstallable();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setIsPwaInstallable(false);
        } else {
          console.log('User dismissed the install prompt');
        }
        setInstallPrompt(null);
      });
    } else {
      // This is the fallback for browsers like Safari
      setShowSafariInstall(true);
    }
  };

  if (!user) {
    return null;
  }

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names
      .map((n) => n[0])
      .slice(0, 2)
      .join('');
  };

  return (
    <AlertDialog open={showSafariInstall} onOpenChange={setShowSafariInstall}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Ayarlar</span>
            </DropdownMenuItem>
            {isPwaInstallable && (
              <DropdownMenuItem onClick={handleInstallClick}>
                <Download className="mr-2 h-4 w-4" />
                <span>Uygulamayı Yükle</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Çıkış Yap</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uygulamayı Ana Ekrana Ekle</AlertDialogTitle>
          <AlertDialogDescription>
            Bu uygulama Safari'de manuel olarak yüklenmelidir. Lütfen aşağıdaki adımları izleyin:
            <ol className="list-decimal list-inside mt-4 space-y-2">
              <li>Aşağıdaki <Share className="inline h-4 w-4" /> (Paylaş) simgesine dokunun.</li>
              <li>Açılan menüde aşağı kaydırın.</li>
              <li><PlusSquare className="inline h-4 w-4" /> "Ana Ekrana Ekle" seçeneğine dokunun.</li>
            </ol>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Anladım</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
