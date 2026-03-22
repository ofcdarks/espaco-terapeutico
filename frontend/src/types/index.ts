// ============================================================
// Shared types — mirrors backend schema exactly
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  category: ProfessionalCategory;
  phone?: string;
  bio?: string;
  registrationNumber?: string;
  specialty?: string;
  approaches?: string;
  sessionDuration?: number;
  sessionPrice?: number;
  clinicName?: string;
  clinicAddress?: string;
  clinicCity?: string;
  clinicState?: string;
  onlineService?: boolean;
  inPersonService?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProfessionalCategory = 'terapeuta' | 'sexologo' | 'psicologo' | 'psicanalista' | 'constelador';
export type PatientStatus = 'ativo' | 'inativo';
export type AppointmentStatus = 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';
export type PaymentStatus = 'pendente' | 'pago' | 'parcial' | 'cancelado';
export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'boleto';
export type TransactionType = 'receita' | 'despesa';
export type TransactionCategory = 'consulta' | 'pacote' | 'produto' | 'outros_receita' | 'aluguel' | 'salario' | 'material' | 'marketing' | 'software' | 'outros_despesa';
export type DocumentType = 'recibo' | 'atestado' | 'declaracao' | 'relatorio' | 'receituario';

export interface Patient {
  id: string; ownerId: string; name: string; email: string; phone: string;
  birthDate: string; cpf: string; address?: string; notes?: string;
  status: PatientStatus; packageId?: string; sessionsRemaining?: number; createdAt: string;
}

export interface Appointment {
  id: string; ownerId: string; patientId: string; patientName: string;
  date: string; time: string; duration: number; status: AppointmentStatus;
  type: string; notes?: string; value?: number;
  paymentStatus?: PaymentStatus; paymentMethod?: PaymentMethod; createdAt: string;
}

export interface ConsultationRecord {
  id: string; ownerId: string; appointmentId?: string; patientId: string;
  patientName: string; date: string; diagnosis?: string; treatment?: string;
  observations?: string; prescriptions?: string; attachments?: string; createdAt: string;
}

export interface Transaction {
  id: string; ownerId: string; type: TransactionType; category: TransactionCategory;
  description: string; value: number; date: string; patientId?: string;
  patientName?: string; appointmentId?: string; paymentMethod?: PaymentMethod;
  status: PaymentStatus; createdAt: string;
}

export interface ServicePackage {
  id: string; ownerId: string; name: string; description?: string;
  sessions: number; value: number; validity: number; isActive: boolean; createdAt: string;
}

export interface Document {
  id: string; ownerId: string; type: DocumentType; patientId: string;
  patientName: string; appointmentId?: string; title: string; content: string;
  date: string; createdAt: string;
}

export interface DashboardStats {
  totalPatients: number; totalAppointments: number; todayAppointments: number;
  weekAppointments: number; completedThisMonth: number; canceledThisMonth: number;
  monthRevenue: number; monthExpenses: number; pendingPayments: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
