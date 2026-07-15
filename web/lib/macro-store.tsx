"use client";

import { trpc } from "@/lib/trpc";

export function useMacros(tenantId: string | null) {
  const utils = trpc.useUtils();

  const query = trpc.macros.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );

  const createMut = trpc.macros.create.useMutation({
    onSuccess: () => utils.macros.list.invalidate(),
  });

  const deleteMut = trpc.macros.delete.useMutation({
    onSuccess: () => utils.macros.list.invalidate(),
  });

  const macros = (query.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    content: m.content,
  }));

  const addMacro = (title: string, content: string) => {
    if (!tenantId) return;
    createMut.mutate({ tenantId, title, content });
  };

  const removeMacro = (macroId: string) => {
    if (!tenantId) return;
    deleteMut.mutate({ tenantId, macroId });
  };

  return { macros, addMacro, removeMacro, isLoading: query.isLoading };
}
