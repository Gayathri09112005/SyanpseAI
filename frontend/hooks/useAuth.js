'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return (await auth.me()).user;
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

function useAuthMutation(fn) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ user }) => {
      qc.setQueryData(['session'], user);
      router.push('/workspace');
    },
  });
}

export const useLogin = () => useAuthMutation(auth.login);
export const useRegister = () => useAuthMutation(auth.register);

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: auth.logout,
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(['session'], null);
      router.push('/');
    },
  });
}

export function usePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.updatePreferences,
    onSuccess: ({ user }) => qc.setQueryData(['session'], user),
  });
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '·';
