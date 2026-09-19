import { AuthScreen } from '@/features/auth/AuthScreen';

export const metadata = { title: 'Sign in — SynapseAI' };

export default function LoginPage() {
  return <AuthScreen initialMode="login" />;
}
