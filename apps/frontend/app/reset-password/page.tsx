import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a new password — GrowXQ',
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
