import { AuthScreen } from '@/features/auth/AuthScreen';

export const metadata = { title: 'Create account — SynapseAI' };

export default function RegisterPage() {
  return <AuthScreen initialMode="register" />;
}
