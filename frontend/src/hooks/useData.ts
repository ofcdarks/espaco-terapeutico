import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  patientsApi, appointmentsApi, recordsApi, transactionsApi,
  packagesApi, documentsApi, dashboardApi, appointmentExtras,
} from "@/lib/api";
import type { Patient, Appointment, ConsultationRecord, Transaction, ServicePackage, Document, DashboardStats, PaginatedResponse } from "@/types";
import { toast } from "sonner";

// ── P1+P2 FIX: Typed CRUD hook with optimistic updates ─────
function useCrud<T extends { id: string }>(key: string, api: {
  list: (p?: any) => Promise<PaginatedResponse<T>>;
  create: (d: any) => Promise<T>;
  update: (id: string, d: any) => Promise<T>;
  remove: (id: string) => Promise<void>;
}) {
  const qc = useQueryClient();

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: [key],
    queryFn: () => api.list({ limit: 200 }),
  });

  const create = useMutation({
    mutationFn: (data: Partial<T>) => api.create(data),
    onMutate: async (newItem) => {
      await qc.cancelQueries({ queryKey: [key] });
      const prev = qc.getQueryData<PaginatedResponse<T>>([key]);
      if (prev) {
        qc.setQueryData<PaginatedResponse<T>>([key], {
          ...prev,
          data: [{ id: `temp-${Date.now()}`, ...newItem } as T, ...prev.data],
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData([key], ctx.prev); toast.error("Erro ao criar"); },
    onSettled: () => qc.invalidateQueries({ queryKey: [key] }),
    onSuccess: () => toast.success("Criado com sucesso"),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<T> & { id: string }) => api.update(id, data),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: [key] });
      const prev = qc.getQueryData<PaginatedResponse<T>>([key]);
      if (prev) {
        qc.setQueryData<PaginatedResponse<T>>([key], {
          ...prev,
          data: prev.data.map(item => item.id === updated.id ? { ...item, ...updated } : item),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData([key], ctx.prev); toast.error("Erro ao atualizar"); },
    onSettled: () => qc.invalidateQueries({ queryKey: [key] }),
    onSuccess: () => toast.success("Atualizado com sucesso"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [key] });
      const prev = qc.getQueryData<PaginatedResponse<T>>([key]);
      if (prev) {
        qc.setQueryData<PaginatedResponse<T>>([key], {
          ...prev,
          data: prev.data.filter(item => item.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData([key], ctx.prev); toast.error("Erro ao remover"); },
    onSettled: () => qc.invalidateQueries({ queryKey: [key] }),
    onSuccess: () => toast.success("Removido com sucesso"),
  });

  return {
    data: query.data?.data || [],
    pagination: query.data?.pagination,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
  };
}

export const usePatients = () => useCrud<Patient>("patients", patientsApi);
export const useAppointments = () => useCrud<Appointment>("appointments", appointmentsApi);
export const useRecords = () => useCrud<ConsultationRecord>("records", recordsApi);
export const useTransactions = () => useCrud<Transaction>("transactions", transactionsApi);
export const usePackages = () => useCrud<ServicePackage>("packages", packagesApi);
export const useDocuments = () => useCrud<Document>("documents", documentsApi);

export function useDashboard() {
  const stats = useQuery<DashboardStats>({ queryKey: ["dashboard-stats"], queryFn: dashboardApi.getStats });
  const chart = useQuery<any[]>({ queryKey: ["dashboard-chart"], queryFn: dashboardApi.getRevenueChart });
  return { stats: stats.data, chartData: chart.data || [], loading: stats.isLoading };
}

export function useTodayAppointments() {
  return useQuery<Appointment[]>({ queryKey: ["appointments-today"], queryFn: appointmentExtras.getToday });
}
