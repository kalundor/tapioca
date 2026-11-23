import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Send,
  X,
  Bot,
  CheckCircle2,
  Square,
  AudioLines,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  formatBRL,
  calculatePredictedBalance,
  calculateHouseSplit,
  type BillItem,
  type CoupleProfile,
} from '../utils/financeMath';
import {
  AnimatedSegmentedControl,
  EditorialModalShell,
  EDITORIAL_EASE,
} from './MotionPrimitives';

interface ExecutedActionItem {
  tool: string;
  label: string;
  detail: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  mode: 'chat_ai' | 'live_ws';
  actions?: ExecutedActionItem[];
  isError?: boolean;
}

interface VoiceAssistantWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CoupleProfile;
  bills: BillItem[];
  onWorkspaceMutated?: () => Promise<void> | void;
  onNavigateSection?: (
    sec: 'overview' | 'cashflow' | 'cards' | 'house' | 'savings' | 'income' | 'workspace'
  ) => void;
}

const QUICK_AI_PROMPTS = [
  'Resuma todo o meu mês, o saldo livre e o Pix da Larissa',
  'Adicione uma despesa Mercado de R$ 145 hoje dividida 50/50',
  'Crie uma meta Viagem 2027 de R$ 4.000 com aporte R$ 300/mês',
  'Abra o estúdio de gráficos e fluxo para eu analisar os custos',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceAssistantWidget({
  isOpen,
  onClose,
  profile,
  bills,
  onWorkspaceMutated,
  onNavigateSection,
}: VoiceAssistantWidgetProps) {
  const initialPredicted = calculatePredictedBalance(profile, bills);
  const initialSplit = calculateHouseSplit(bills);

  const [copilotTab, setCopilotTab] = useState<'chat' | 'live'>('chat');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isMicStreaming, setIsMicStreaming] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isLoadingTurn, setIsLoadingTurn] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [inputText, setInputText] = useState('');
  const [liveInputTranscript, setLiveInputTranscript] = useState('');
  const [liveOutputTranscript, setLiveOutputTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Copiloto Tapioca AI (Gemini) conectado às suas finanças e ações do app'
  );

  // Voice Note Recording for Chat Prompt / Dictation
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [isTranscribingNote, setIsTranscribingNote] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [sqlSnapshot, setSqlSnapshot] = useState<{
    predictedLeftover: number;
    totalHouseBills: number;
    pixSettlementAmount: number;
    housingCostSolo: number;
    totalPayable: number;
  }>({
    predictedLeftover: initialPredicted.predictedLeftover,
    totalHouseBills: initialSplit.totalHouseBills,
    pixSettlementAmount: initialSplit.pixSettlementAmount,
    housingCostSolo: initialSplit.eachShare50,
    totalPayable: initialPredicted.userHouseShare + initialPredicted.personalBillsTotal,
  });

  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'welcome-copilot',
      role: 'assistant',
      text: `Olá, ${profile.displayName.split(' ')[0]}! Sou o Copiloto AI do Tapioca Pay. Posso resumir suas contas Pluggy, simular cortes, criar lançamentos e metas ou navegar pelo app. Hoje sua sobra prevista é R$ ${formatBRL(
        initialPredicted.predictedLeftover
      )} (${initialPredicted.predictedLeftoverPct}% livre). Digite, escolha um atalho ou use o microfone!`,
      timestamp: 'Agora',
      mode: 'chat_ai',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const currentOutputBufferRef = useRef<string>('');

  // MediaRecorder refs for voice notes
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteStreamRef = useRef<MediaStream | null>(null);
  const noteChunksRef = useRef<Blob[]>([]);
  const noteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingTurn]);

  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore already stopped
      }
    });
    activeSourcesRef.current = [];
    if (playbackCtxRef.current) {
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsModelSpeaking(false);
  }, []);

  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (playbackCtxRef.current.state === 'suspended') {
      playbackCtxRef.current.resume();
    }
    return playbackCtxRef.current;
  }, []);

  const schedulePcm24kChunk = useCallback(
    (base64Pcm: string) => {
      if (isMuted) return;
      try {
        const ctx = ensurePlaybackContext();
        const binary = atob(base64Pcm);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const startTime = Math.max(now, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;

        activeSourcesRef.current.push(source);
        setIsModelSpeaking(true);

        source.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
          if (activeSourcesRef.current.length === 0) {
            setIsModelSpeaking(false);
          }
        };
      } catch (err) {
        console.error('Error scheduling 24kHz PCM chunk:', err);
      }
    },
    [ensurePlaybackContext, isMuted]
  );

  const playWavBase64OrBrowserPtBr = useCallback(
    (wavBase64: string | null, fallbackText: string) => {
      if (isMuted) return;
      if (wavBase64) {
        try {
          const audio = new Audio(`data:audio/wav;base64,${wavBase64}`);
          setIsModelSpeaking(true);
          audio.onended = () => setIsModelSpeaking(false);
          audio.onerror = () => setIsModelSpeaking(false);
          audio.play().catch(() => setIsModelSpeaking(false));
          return;
        } catch {
          // Fall through
        }
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(fallbackText);
          utter.lang = 'pt-BR';
          utter.rate = 1.05;
          utter.onstart = () => setIsModelSpeaking(true);
          utter.onend = () => setIsModelSpeaking(false);
          utter.onerror = () => setIsModelSpeaking(false);
          window.speechSynthesis.speak(utter);
        } catch {
          // Ignore
        }
      }
    },
    [isMuted]
  );

  const stopMicCapture = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (captureCtxRef.current && captureCtxRef.current.state !== 'closed') {
      captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }
    setIsMicStreaming(false);
  }, []);

  const stopNoteRecordingCleanup = useCallback(() => {
    if (noteTimerRef.current) {
      window.clearInterval(noteTimerRef.current);
      noteTimerRef.current = null;
    }
    if (noteStreamRef.current) {
      noteStreamRef.current.getTracks().forEach((t) => t.stop());
      noteStreamRef.current = null;
    }
    noteRecorderRef.current = null;
    setIsRecordingNote(false);
    setRecordingSeconds(0);
  }, []);

  const disconnectLiveSession = useCallback(() => {
    stopMicCapture();
    stopNoteRecordingCleanup();
    stopAllPlayback();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsLiveConnected(false);
  }, [stopMicCapture, stopNoteRecordingCleanup, stopAllPlayback]);

  const connectLiveWebSocket = useCallback((): Promise<WebSocket | null> => {
    return new Promise((resolve) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
        wsRef.current = ws;
        setStatusMessage('Conectando canal de voz ao vivo em PT-BR...');

        const timeoutId = window.setTimeout(() => {
          resolve(ws.readyState === WebSocket.OPEN ? ws : null);
        }, 3500);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'sql_context' && msg.metrics) {
              setSqlSnapshot(msg.metrics);
            } else if (msg.type === 'ready') {
              window.clearTimeout(timeoutId);
              setIsLiveConnected(true);
              setStatusMessage('Canal de Voz Gemini Live pronto (PT-BR)');
              resolve(ws);
            } else if (msg.type === 'audio' && msg.data) {
              schedulePcm24kChunk(msg.data);
            } else if (msg.type === 'input_transcript' && msg.text) {
              setLiveInputTranscript((prev) => `${prev} ${msg.text}`.trim());
            } else if (msg.type === 'output_transcript' && msg.text) {
              currentOutputBufferRef.current = `${currentOutputBufferRef.current} ${msg.text}`.trim();
              setLiveOutputTranscript(currentOutputBufferRef.current);
            } else if (msg.type === 'turn_complete') {
              const completedText = currentOutputBufferRef.current.trim();
              if (completedText) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `live-${Date.now()}`,
                    role: 'assistant',
                    text: completedText,
                    timestamp: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    mode: 'live_ws',
                  },
                ]);
              }
              currentOutputBufferRef.current = '';
              setLiveOutputTranscript('');
              setIsLoadingTurn(false);
            } else if (msg.type === 'interrupted') {
              stopAllPlayback();
              currentOutputBufferRef.current = '';
              setLiveOutputTranscript('');
            } else if (msg.type === 'error') {
              setStatusMessage(msg.message || 'Canal ao vivo em standby');
              setIsLoadingTurn(false);
              window.clearTimeout(timeoutId);
              resolve(null);
            }
          } catch (err) {
            console.error('WS message parse error:', err);
          }
        };

        ws.onerror = () => {
          window.clearTimeout(timeoutId);
          setIsLiveConnected(false);
          resolve(null);
        };

        ws.onclose = () => {
          setIsLiveConnected(false);
          setIsMicStreaming(false);
        };
      } catch {
        resolve(null);
      }
    });
  }, [schedulePcm24kChunk, stopAllPlayback]);

  const toggleMicrophoneLive = async () => {
    if (isMicStreaming) {
      stopMicCapture();
      setStatusMessage('Microfone ao vivo pausado');
      return;
    }

    ensurePlaybackContext();
    const ws = await connectLiveWebSocket();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const captureCtx = new AudioContext({ sampleRate: 16000 });
      captureCtxRef.current = captureCtx;
      const source = captureCtx.createMediaStreamSource(stream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        ws.send(JSON.stringify({ type: 'audio', data: btoa(binary) }));
      };

      source.connect(processor);
      processor.connect(captureCtx.destination);
      setIsMicStreaming(true);
      setStatusMessage('Ouvindo ao vivo em PT-BR — pode falar!');
    } catch {
      setStatusMessage('Microfone bloqueado neste dispositivo. Use o chat ou atalhos abaixo.');
    }
  };

  // Voice Note Recorder -> Gemini 3.5 Transcribe
  const handleToggleVoiceNote = async () => {
    if (isRecordingNote && noteRecorderRef.current) {
      noteRecorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      noteStreamRef.current = stream;
      noteChunksRef.current = [];

      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType: preferredType });
      noteRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          noteChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(noteChunksRef.current, { type: mimeType });
        stopNoteRecordingCleanup();

        if (audioBlob.size < 400) return;

        setIsTranscribingNote(true);
        setStatusMessage('Transcrevendo áudio com Gemini...');
        try {
          const base64 = await blobToBase64(audioBlob);
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: mimeType.split(';')[0],
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Falha ao transcrever nota de áudio.');
          }
          if (data.transcript) {
            setInputText((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
            setStatusMessage('Transcrição pronta — revise ou envie!');
          }
        } catch (err: any) {
          setStatusMessage(err?.message || 'Não foi possível transcrever o áudio.');
        } finally {
          setIsTranscribingNote(false);
        }
      };

      recorder.start();
      setIsRecordingNote(true);
      setRecordingSeconds(0);
      setStatusMessage('Gravando nota de voz... toque para finalizar');
      noteTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setStatusMessage('Permissão de microfone necessária para ditar anotações.');
    }
  };

  const handleSendChatPrompt = async (promptText: string) => {
    const cleanText = promptText.trim();
    if (!cleanText || isLoadingTurn) return;

    setInputText('');
    setIsLoadingTurn(true);

    const userMsg: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      mode: 'chat_ai',
    };

    const historyPayload = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setStatusMessage('Gemini analisando finanças e executando ações...');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: historyPayload,
          withAudio: !isMuted,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: data.error || 'Não foi possível obter resposta do Copiloto Gemini agora.',
            timestamp: 'Agora',
            mode: 'chat_ai',
            isError: true,
          },
        ]);
        setStatusMessage('Atenção: verifique a resposta do servidor.');
        return;
      }

      if (data.summaryMetrics) {
        setSqlSnapshot(data.summaryMetrics);
      }

      if (data.shouldRefreshWorkspace && onWorkspaceMutated) {
        await onWorkspaceMutated();
      }

      if (data.navigateToSection && onNavigateSection) {
        onNavigateSection(data.navigateToSection);
      }

      const assistantMsg: ConversationMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: data.replyText || 'Ação concluída com sucesso.',
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        mode: 'chat_ai',
        actions: Array.isArray(data.executedActions) ? data.executedActions : [],
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (!isMuted && data.replyText) {
        ensurePlaybackContext();
        playWavBase64OrBrowserPtBr(data.audioBase64 || null, data.replyText);
      }

      setStatusMessage('Resposta concluída · Pronto para o próximo comando');
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: err?.message || 'Erro de conexão ao consultar o Copiloto Gemini.',
          timestamp: 'Agora',
          mode: 'chat_ai',
          isError: true,
        },
      ]);
      setStatusMessage('Erro de rede ao consultar Gemini.');
    } finally {
      setIsLoadingTurn(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopMicCapture();
      stopNoteRecordingCleanup();
      stopAllPlayback();
    }
  }, [isOpen, stopMicCapture, stopNoteRecordingCleanup, stopAllPlayback]);

  useEffect(() => {
    return () => {
      disconnectLiveSession();
    };
  }, [disconnectLiveSession]);

  return (
    <EditorialModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Copiloto Tapioca AI com Gemini"
      variant="dialog"
      containerClassName="flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white dark:bg-[#0D1210] w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[#E4E7E5] dark:border-[#1B231F] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* TOP COPILOT HEADER */}
        <div className="p-4 sm:p-5 bg-[#090E0C] border-b border-[#1E2823] text-[#F3F5F4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isMicStreaming || isModelSpeaking || isRecordingNote
                  ? 'bg-[#8CE02C] text-[#060807]'
                  : 'bg-white/[0.08] text-[#8CE02C]'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-editorial text-base sm:text-lg font-bold tracking-tight truncate">
                Copiloto Tapioca <span className="font-accent-serif text-[#8CE02C]">AI</span>
              </h2>
              <p className="text-[11px] text-[#8C9891] mt-0.5 truncate">{statusMessage}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsMuted((prev) => !prev);
                if (!isMuted) stopAllPlayback();
              }}
              aria-label={isMuted ? 'Ativar leitura em voz' : 'Silenciar leitura em voz'}
              title={isMuted ? 'Ativar leitura em áudio' : 'Áudio silenciado'}
              className="w-9 h-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#8CE02C]" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar copiloto AI"
              className="w-9 h-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LIVE METRIC STRIP + MODE SWITCH */}
        <div className="px-4 py-2.5 bg-[#F1F3F2] dark:bg-[#090C0B] border-b border-[#E4E7E5] dark:border-[#1B231F] flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <AnimatedSegmentedControl
            options={[
              { id: 'chat', label: 'Chat & Ações AI', icon: <Bot className="w-3.5 h-3.5" /> },
              { id: 'live', label: 'Voz ao Vivo', icon: <Radio className="w-3.5 h-3.5" /> },
            ]}
            value={copilotTab}
            onChange={setCopilotTab}
            layoutId="copilot-mode-switch"
            ariaLabel="Modo do copiloto"
          />

          <div className="flex flex-wrap items-center gap-3 font-mono-num text-[#0B110E] dark:text-[#F3F5F4]">
            <span>
              Sobra:{' '}
              <strong className="text-[#56AD17] dark:text-[#8CE02C]">
                R$ {formatBRL(sqlSnapshot.predictedLeftover)}
              </strong>
            </span>
            <span>
              Pix {profile.partnerName.split(' ')[0]}:{' '}
              <strong className="text-[#D97706] dark:text-[#F59E0B]">
                R$ {formatBRL(sqlSnapshot.pixSettlementAmount)}
              </strong>
            </span>
          </div>
        </div>

        {copilotTab === 'live' && (
          <div className="p-3.5 sm:p-4 border-b border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-between gap-3 bg-white dark:bg-[#0D1210]">
            <button
              type="button"
              onClick={toggleMicrophoneLive}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isMicStreaming
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 text-white dark:text-[#060807]'
              }`}
            >
              {isMicStreaming ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Pausar Canal ao Vivo</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-[#8CE02C] dark:text-[#060807]" />
                  <span>Iniciar Conversa por Voz (PT-BR)</span>
                </>
              )}
            </button>

            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
              {isMicStreaming
                ? 'Capturando áudio 16kHz ao vivo'
                : isLiveConnected
                  ? 'Canal aberto'
                  : 'Toque para falar com o Gemini Live'}
            </div>
          </div>
        )}

        {/* CONVERSATION TRANSCRIPT & ACTION CARDS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F8F7] dark:bg-[#080B09] min-h-[210px] max-h-[340px]">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.26, ease: EDITORIAL_EASE }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#0B130F] dark:bg-[#19221D] text-white rounded-br-xs'
                    : m.isError
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 rounded-bl-xs'
                      : 'bg-white dark:bg-[#0D1210] text-[#0B110E] dark:text-[#F3F5F4] border border-[#E4E7E5] dark:border-[#1B231F] rounded-bl-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                  <span className="font-bold">
                    {m.role === 'user' ? 'Você' : 'Copiloto Tapioca AI'}
                  </span>
                  <span>{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-line">{m.text}</p>

                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F] space-y-1.5">
                    {m.actions.map((act, idx) => (
                      <div
                        key={`${act.tool}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#EAF5D8] dark:bg-[#16271D] text-[#0B110E] dark:text-[#8CE02C] text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 font-semibold truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{act.label}</span>
                        </span>
                        <span className="font-mono-num text-[10px] shrink-0 opacity-85">
                          {act.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoadingTurn && (
            <div className="flex items-start">
              <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] text-xs text-[#5C6660] dark:text-[#8C9891] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#56AD17] dark:text-[#8CE02C]" />
                <span>Consultando Open Finance &amp; executando com Gemini...</span>
              </div>
            </div>
          )}

          {(liveInputTranscript || liveOutputTranscript) && (
            <div className="p-3 rounded-xl bg-[#EAF5D8] dark:bg-[#16271D] border border-[#8CE02C]/30 text-xs text-[#0B110E] dark:text-[#F3F5F4]">
              {liveInputTranscript && (
                <div>
                  <strong>Ouvindo:</strong> {liveInputTranscript}
                </div>
              )}
              {liveOutputTranscript && (
                <div className="mt-1">
                  <strong>Respondendo:</strong> {liveOutputTranscript}
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK ACTIONS & INPUT + VOICE NOTE RECORDER */}
        <div className="p-4 pb-safe bg-white dark:bg-[#0D1210] border-t border-[#E4E7E5] dark:border-[#1B231F] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {QUICK_AI_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isLoadingTurn}
                onClick={() => handleSendChatPrompt(q)}
                className="min-h-[36px] text-left px-3 py-1.5 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] hover:border-[#0B130F]/30 dark:hover:border-[#8CE02C]/40 text-[11px] font-medium text-[#0B110E] dark:text-[#F3F5F4] transition-colors flex items-center justify-between gap-2 truncate cursor-pointer"
              >
                <span className="truncate">{q}</span>
                <ArrowRight className="w-3 h-3 text-[#56AD17] dark:text-[#8CE02C] shrink-0" />
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatPrompt(inputText);
            }}
            className="flex items-center gap-2 pt-0.5"
          >
            {/* VOICE NOTE DICTATION BUTTON */}
            <button
              type="button"
              onClick={handleToggleVoiceNote}
              disabled={isTranscribingNote || isLoadingTurn}
              aria-label={isRecordingNote ? 'Parar gravação de áudio' : 'Gravar nota ou comando por voz'}
              title={
                isRecordingNote
                  ? 'Clique para finalizar e transcrever'
                  : 'Ditar comando ou anotação pelo microfone'
              }
              className={`min-h-[44px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isRecordingNote
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#8CE02C] hover:bg-[#E4E7E5]'
              }`}
            >
              {isTranscribingNote ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecordingNote ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="font-mono-num">{recordingSeconds}s</span>
                </>
              ) : (
                <AudioLines className="w-4 h-4" />
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Peça um resumo, crie despesa/meta ou diga o que fazer..."
              className="flex-1 min-h-[44px] px-3.5 py-2 text-xs rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
            />

            <button
              type="submit"
              disabled={isLoadingTurn || !inputText.trim()}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 disabled:opacity-50 text-white dark:text-[#060807] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </EditorialModalShell>
  );
}
