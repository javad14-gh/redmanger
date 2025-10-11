'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';

import { useApp } from '@/hooks/use-app';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';


const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Mevcut şifrenizi girmelisiniz.' }),
  newPassword: z.string().min(6, { message: 'Yeni şifre en az 6 karakter olmalıdır.' }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Yeni şifreler eşleşmiyor.',
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, changePassword } = useApp();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit: SubmitHandler<PasswordFormData> = async (data) => {
    setIsSubmitting(true);
    setError(null);
    const result = await changePassword(data.currentPassword, data.newPassword);
    
    if (result.success) {
      toast({
        title: 'Başarılı',
        description: 'Şifreniz başarıyla değiştirildi.',
      });
      form.reset();
    } else {
      setError(result.error || 'Şifre değiştirilirken bir hata oluştu.');
    }
    
    setIsSubmitting(false);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Profilim
        </h1>
        <p className="text-muted-foreground">
          Kullanıcı bilgilerinizi yönetin ve şifrenizi değiştirin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock/> Şifreyi Değiştir</CardTitle>
          <CardDescription>
            Güvenlik nedeniyle, yeni bir şifre belirleyebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mevcut Şifre</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yeni Şifre</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yeni Şifre (Tekrar)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Hata</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
                 Değişiklikleri Kaydet
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
