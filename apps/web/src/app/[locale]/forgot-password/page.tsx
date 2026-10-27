import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard, ForgotPasswordForm } from '@/features/auth';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.forgot');
  return { title: t('title'), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Auth.forgot');
  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('back')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
