import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  HardDrive,
  CheckSquare,
  MessageSquare,
  StickyNote,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { getAccessToken } from '../lib/firebase';
import {
  formatBRL,
  calculateHouseSplit,
  calculatePredictedBalance,
  type BillItem,
  type CoupleProfile,
} from '../utils/financeMath';
import { SpotlightBento, EditorialModalShell } from './MotionPrimitives';

interface WorkspaceHubViewProps {
  profile: CoupleProfile;
  bills: BillItem[];
  isAuthenticated: boolean;
  onRequestGoogleSignIn: () => Promise<void>;
}

interface PendingAction {
  title: string;
  description: string;
  affectedCount: number;
  execute: () => Promise<void>;
}

export function WorkspaceHubView({
  profile,
  bills,
  isAuthenticated,
  onRequestGoogleSignIn,
}: WorkspaceHubViewProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarEvents, setCalendarEvents] = useState<Array<{ id: string; summary: string }>>([]);
  const [gmailSubjects, setGmailSubjects] = useState<string[]>([]);
  const [taskItems, setTaskItems] = useState<Array<{ id: string; title: string }>>([]);
  const [chatSpaces, setChatSpaces] = useState<Array<{ name: string; displayName: string }>>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingAction | null>(null);

  const houseSplit = calculateHouseSplit(bills);
  const predicted = calculatePredictedBalance(profile, bills);
  const chatConsoleUrl = 'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat';

  const ensureToken = async (): Promise<string | null> => {
    const token = await getAccessToken();
    if (!token) {
      await onRequestGoogleSignIn();
      return await getAccessToken();
    }
    return token;
  };

  // 1. Google Calendar: Read & Create Bill Due Date Events (with confirmation)
  const handleListCalendarEvents = async () => {
    setLoadingService('calendar');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao consultar Google Calendar');
      setCalendarEvents(
        (data.items || []).map((i: any) => ({
          id: i.id,
          summary: i.summary || 'Evento sem título',
        }))
      );
      setStatusMessage('Eventos do Google Calendar carregados com sucesso.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  const requestSyncBillsToCalendar = () => {
    const day5Bills = bills.filter((b) => b.dueDay === 5);
    setPendingConfirmation({
      title: 'Criar lembretes de vencimento no Google Calendar?',
      description: `Esta ação adicionará um evento de vencimento ("Contas Tapioca Pay — Dia 05: R$ ${formatBRL(
        day5Bills.reduce((a, b) => a + b.amount, 0)
      )}") na sua agenda principal do Google Calendar.`,
      affectedCount: day5Bills.length,
      execute: async () => {
        setLoadingService('calendar');
        setErrorMessage(null);
        try {
          const token = await ensureToken();
          if (!token) return;
          const res = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                summary: `Tapioca Pay · Vencimento Contas Dia 05 (R$ ${formatBRL(
                  day5Bills.reduce((a, b) => a + b.amount, 0)
                )})`,
                description: day5Bills.map((b) => `${b.title}: R$ ${formatBRL(b.amount)}`).join('\n'),
                start: { date: '2026-12-05' },
                end: { date: '2026-12-06' },
              }),
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Falha ao criar evento no Calendar');
          setStatusMessage('Evento de vencimento adicionado ao seu Google Calendar!');
          await handleListCalendarEvents();
        } catch (err: any) {
          setErrorMessage(err.message);
        } finally {
          setLoadingService(null);
        }
      },
    });
  };

  // 2. Google Tasks: List & Create Payment Checklist Tasks
  const handleListTasks = async () => {
    setLoadingService('tasks');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao listar Google Tasks');
      setTaskItems(
        (data.items || []).slice(0, 5).map((t: any) => ({ id: t.id, title: t.title }))
      );
      setStatusMessage('Tarefas do Google Tasks sincronizadas.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  const requestCreatePixTask = () => {
    setPendingConfirmation({
      title: 'Criar tarefa de acerto Pix no Google Tasks?',
      description: `Será criada uma tarefa na sua lista padrão do Google Tasks: "Acerto Pix Casal (${profile.partnerName} -> Você): R$ ${formatBRL(
        houseSplit.pixSettlementAmount
      )}".`,
      affectedCount: 1,
      execute: async () => {
        setLoadingService('tasks');
        setErrorMessage(null);
        try {
          const token = await ensureToken();
          if (!token) return;
          const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: `Tapioca Pay · Conferir Pix do Casal: R$ ${formatBRL(
                houseSplit.pixSettlementAmount
              )}`,
              notes: `Saldo previsto após contas: R$ ${formatBRL(predicted.predictedLeftover)}`,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Falha ao criar tarefa');
          setStatusMessage('Tarefa criada no Google Tasks com sucesso!');
          await handleListTasks();
        } catch (err: any) {
          setErrorMessage(err.message);
        } finally {
          setLoadingService(null);
        }
      },
    });
  };

  // 3. Google Drive: List & Export Financial Report JSON
  const handleListDriveFiles = async () => {
    setLoadingService('drive');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Falha ao consultar Google Drive');
      setDriveFiles(data.files || []);
      setStatusMessage('Arquivos recentes do Google Drive carregados.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  const requestExportToDrive = () => {
    setPendingConfirmation({
      title: 'Salvar relatório financeiro no Google Drive?',
      description:
        'Esta operação criará um novo arquivo "Tapioca-Pay-Fechamento-Novembro-2026.json" no seu Google Drive contendo o resumo das contas do casal e saldo previsto.',
      affectedCount: 1,
      execute: async () => {
        setLoadingService('drive');
        setErrorMessage(null);
        try {
          const token = await ensureToken();
          if (!token) return;
          const metadata = {
            name: 'Tapioca-Pay-Fechamento-Novembro-2026.json',
            mimeType: 'application/json',
          };
          const reportPayload = JSON.stringify(
            {
              month: 'Novembro 2026',
              predictedBalance: predicted.predictedLeftover,
              houseSplitTotal: houseSplit.totalHouseBills,
              pixSettlement: houseSplit.pixSettlementAmount,
              bills,
            },
            null,
            2
          );
          const form = new FormData();
          form.append(
            'metadata',
            new Blob([JSON.stringify(metadata)], { type: 'application/json' })
          );
          form.append('file', new Blob([reportPayload], { type: 'application/json' }));

          const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Falha ao exportar para o Drive');
          setStatusMessage(`Relatório salvo no Google Drive (ID: ${data.id})!`);
          await handleListDriveFiles();
        } catch (err: any) {
          setErrorMessage(err.message);
        } finally {
          setLoadingService(null);
        }
      },
    });
  };

  // 4. Gmail: Scan Financial Receipts
  const handleScanGmailBills = async () => {
    setLoadingService('gmail');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=fatura OR boleto OR pix',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Falha ao consultar Gmail');
      const messages = data.messages || [];
      setGmailSubjects(
        messages.length > 0
          ? messages.map((m: any) => `Mensagem financeira localizada (ID: ${m.id})`)
          : ['Nenhuma fatura pendente não lida encontrada na busca recente.']
      );
      setStatusMessage('Varredura de boletos e faturas no Gmail concluída.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  // 5. Google Chat: List Spaces (with explicit prerequisite handling)
  const handleListChatSpaces = async () => {
    setLoadingService('chat');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        const rawMsg =
          data.error?.message ||
          'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.';
        throw new Error(rawMsg);
      }
      setChatSpaces(data.spaces || []);
      setStatusMessage('Espaços do Google Chat sincronizados.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  // 6. Google Keep: List Notes (with Enterprise prerequisite disclosure)
  const handleKeepSync = async () => {
    setLoadingService('keep');
    setErrorMessage(null);
    try {
      const token = await ensureToken();
      if (!token) return;
      const res = await fetch('https://keep.googleapis.com/v1/notes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message ||
            'A API do Google Keep (keep.googleapis.com) é restrita a contas empresariais Google Workspace com delegação em todo o domínio. Use o botão Exportar para o Google Drive ou Google Tasks para contas pessoais @gmail.com.'
        );
      }
      setStatusMessage(`Notas do Google Keep carregadas (${(data.notes || []).length}).`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingService(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* CARBON ARCHITECTURAL HERO BANNER */}
      <section
        aria-label="Central Google Workspace"
        className="relative overflow-hidden rounded-3xl bg-[#090E0C] text-[#F3F5F4] p-5 sm:p-7 border border-[#1E2823] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #8CE02C 1px, transparent 1px), linear-gradient(to bottom, #8CE02C 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-[#8CE02C] font-medium">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Ecossistema Google Workspace · {profile.displayName.split(' ')[0]} &amp; {profile.partnerName.split(' ')[0]}</span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">
            Sincronia com <span className="font-accent-serif text-[#8CE02C]">Calendar, Drive &amp; Gmail</span>
          </h2>
          <p className="text-xs sm:text-[13px] text-[#9BA6A0] leading-relaxed">
            Exporte fechamentos em JSON, crie lembretes para o Pix de R${' '}
            {formatBRL(houseSplit.pixSettlementAmount)} e mantenha vencimentos na agenda do casal.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestGoogleSignIn}
          className="relative min-h-[44px] px-5 py-2.5 rounded-xl bg-white hover:bg-[#F1F3F2] text-[#0B110E] text-xs font-bold flex items-center justify-center gap-2.5 shrink-0 shadow-md transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>{isAuthenticated ? 'Reconectar Conta Google' : 'Entrar com Google'}</span>
        </button>
      </section>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Aviso da API Google Workspace: {errorMessage}</span>
          </div>
          {errorMessage.toLowerCase().includes('chat') && (
            <a
              href={chatConsoleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#0B110E] dark:text-[#8CE02C] underline font-semibold mt-1"
            >
              <span>Abrir Configuração da Google Chat API no Cloud Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* 6 WORKSPACE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Google Calendar */}
        <SpotlightBento as="div" delay={0.03} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#EEF7E4] dark:bg-[#132215] text-[#56AD17] dark:text-[#8CE02C] border border-[#DCEBC9] dark:border-[#1E3321] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Google Calendar
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Agenda do Casal</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">Ativo</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Agende lembretes de vencimento do mês diretamente na agenda do casal.
            </p>
            {calendarEvents.length > 0 && (
              <ul className="text-[11px] text-[#5C6660] dark:text-[#D1D7D4] space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
                {calendarEvents.map((ev) => (
                  <li key={ev.id} className="truncate">
                    · {ev.summary}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleListCalendarEvents}
              disabled={loadingService === 'calendar'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
            >
              Listar Próximos Eventos
            </button>
            <button
              type="button"
              onClick={requestSyncBillsToCalendar}
              disabled={loadingService === 'calendar'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] rounded-xl transition-colors cursor-pointer"
            >
              Agendar Contas na Agenda
            </button>
          </div>
        </SpotlightBento>

        {/* 2. Google Tasks */}
        <SpotlightBento as="div" delay={0.07} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#EEF7E4] dark:bg-[#132215] text-[#56AD17] dark:text-[#8CE02C] border border-[#DCEBC9] dark:border-[#1E3321] flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Google Tasks
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Checklist Pix</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">Ativo</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Transforme o acerto Pix mensal (R$ {formatBRL(houseSplit.pixSettlementAmount)}) e contas em tarefas.
            </p>
            {taskItems.length > 0 && (
              <ul className="text-[11px] text-[#5C6660] dark:text-[#D1D7D4] space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
                {taskItems.map((t) => (
                  <li key={t.id} className="truncate">
                    · {t.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleListTasks}
              disabled={loadingService === 'tasks'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
            >
              Carregar Minhas Tarefas
            </button>
            <button
              type="button"
              onClick={requestCreatePixTask}
              disabled={loadingService === 'tasks'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] rounded-xl transition-colors cursor-pointer"
            >
              Criar Tarefa de Acerto Pix
            </button>
          </div>
        </SpotlightBento>

        {/* 3. Google Drive */}
        <SpotlightBento as="div" delay={0.11} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[#D97706] dark:text-[#F59E0B] border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Google Drive
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Arquivo em Nuvem</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">Ativo</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Exporte o fechamento mensal do casal e comprovantes para o seu Google Drive.
            </p>
            {driveFiles.length > 0 && (
              <ul className="text-[11px] text-[#5C6660] dark:text-[#D1D7D4] space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
                {driveFiles.map((f) => (
                  <li key={f.id} className="truncate">
                    · {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleListDriveFiles}
              disabled={loadingService === 'drive'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
            >
              Listar Arquivos Recentes
            </button>
            <button
              type="button"
              onClick={requestExportToDrive}
              disabled={loadingService === 'drive'}
              className="min-h-[38px] w-full py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] rounded-xl transition-colors cursor-pointer"
            >
              Salvar Fechamento no Drive
            </button>
          </div>
        </SpotlightBento>

        {/* 4. Gmail */}
        <SpotlightBento as="div" delay={0.15} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Gmail
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Radar de Faturas</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">Ativo</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Localize boletos, faturas Nubank/Inter e comprovantes Pix diretamente no seu e-mail.
            </p>
            {gmailSubjects.length > 0 && (
              <ul className="text-[11px] text-[#5C6660] dark:text-[#D1D7D4] space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
                {gmailSubjects.map((s, idx) => (
                  <li key={idx} className="truncate">
                    · {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={handleScanGmailBills}
            disabled={loadingService === 'gmail'}
            className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
          >
            Buscar Faturas e Boletos no Gmail
          </button>
        </SpotlightBento>

        {/* 5. Google Chat */}
        <SpotlightBento as="div" delay={0.19} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#F1F3F2] dark:bg-[#111714] text-[#0B110E] dark:text-[#8CE02C] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Google Chat
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Workspace Corp</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#B45309] dark:text-[#F59E0B]">Business</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Compartilhe o resumo de divisão da casa em espaços corporativos do Google Chat.
            </p>
            <div className="p-2.5 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] text-[11px] text-[#5C6660] dark:text-[#8C9891] space-y-1">
              <p>Disponível para contas Google Workspace Business com app Chat habilitado.</p>
              <a
                href={chatConsoleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#0B110E] dark:text-[#8CE02C] hover:underline font-medium"
              >
                <span>Abrir Console da Chat API</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {chatSpaces.length > 0 && (
              <ul className="text-[11px] text-[#5C6660] dark:text-[#D1D7D4] space-y-1">
                {chatSpaces.map((sp) => (
                  <li key={sp.name} className="truncate">
                    · {sp.displayName || sp.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={handleListChatSpaces}
            disabled={loadingService === 'chat'}
            className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
          >
            Conectar Espaços do Google Chat
          </button>
        </SpotlightBento>

        {/* 6. Google Keep */}
        <SpotlightBento as="div" delay={0.23} className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[#D97706] dark:text-[#F59E0B] border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-center shrink-0">
                  <StickyNote className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Google Keep
                  </h3>
                  <span className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Notas Compartilhadas</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#B45309] dark:text-[#F59E0B]">Enterprise</span>
            </div>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Sincronize notas financeiras e listas compartilhadas do casal no Google Keep.
            </p>
            <div className="p-2.5 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] text-[11px] text-[#5C6660] dark:text-[#8C9891]">
              Restrito a contas Enterprise. Para uso pessoal em @gmail.com, utilize Google Tasks ou Drive.
            </div>
          </div>
          <button
            type="button"
            onClick={handleKeepSync}
            disabled={loadingService === 'keep'}
            className="min-h-[38px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl transition-colors cursor-pointer"
          >
            Sincronizar Notas Google Keep
          </button>
        </SpotlightBento>
      </div>

      {/* USER CONFIRMATION MODAL FOR WORKSPACE MUTATIONS */}
      <EditorialModalShell
        isOpen={Boolean(pendingConfirmation)}
        onClose={() => setPendingConfirmation(null)}
        ariaLabelledBy="workspace-confirm-title"
        variant="dialog"
        containerClassName="flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        {pendingConfirmation && (
          <div className="bg-[#FFFFFF] dark:bg-[#0D1210] rounded-t-3xl sm:rounded-3xl border border-[#E4E7E5] dark:border-[#1B231F] max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-1 bg-[#D3D8D5] dark:bg-[#27322C] rounded-full mx-auto mb-1 sm:hidden" />
            <h3
              id="workspace-confirm-title"
              className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]"
            >
              {pendingConfirmation.title}
            </h3>
            <p className="text-xs text-[#5C6660] dark:text-[#9BA6A0] leading-relaxed">
              {pendingConfirmation.description}
            </p>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
              Itens afetados: {pendingConfirmation.affectedCount} registro(s)
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 pb-safe">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#0B110E] dark:text-[#D1D7D4] bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = pendingConfirmation.execute;
                  setPendingConfirmation(null);
                  await action();
                }}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] rounded-xl cursor-pointer"
              >
                Confirmar e Executar
              </button>
            </div>
          </div>
        )}
      </EditorialModalShell>
    </div>
  );
}
