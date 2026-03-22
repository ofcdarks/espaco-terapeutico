import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneOff, Copy, Check, Video, Mic, MicOff, VideoOff, Clock, Camera, Monitor, MonitorOff, MessageSquare, X, Send, Users, UserCheck, Captions, CaptionsOff } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.services.mozilla.com' }];

// ── Audio Level Indicator ──
function AudioLevel({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf: number;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const c = canvasRef.current;
      if (!c) return;
      const cx = c.getContext('2d')!;
      cx.clearRect(0, 0, c.width, c.height);
      const barCount = 5;
      const barW = 3;
      const gap = 2;
      for (let i = 0; i < barCount; i++) {
        const h = Math.max(2, (avg / 128) * c.height * (0.5 + Math.random() * 0.5));
        cx.fillStyle = avg > 30 ? '#81c784' : '#6b5f57';
        cx.fillRect(i * (barW + gap), c.height - h, barW, h);
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); ctx.close(); };
  }, [stream]);
  return <canvas ref={canvasRef} width={25} height={20} className="inline-block" />;
}

export default function VideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const nav = useNavigate();

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);
  const chatPollRef = useRef<number | null>(null);
  const iceRef = useRef(0);
  const chatIdxRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<'idle' | 'waiting' | 'connected' | 'permError'>('idle');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [elapsed, setElapsed] = useState("00:00");
  const [startTime, setStartTime] = useState<number | null>(null);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<{ from: string; text: string; ts: number }[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [unread, setUnread] = useState(0);

  // Waiting room
  const [showWaiting, setShowWaiting] = useState(false);
  const [waitingList, setWaitingList] = useState<{ id: string; name: string; joinedAt: number }[]>([]);

  // Transcription
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  // Stream state for AudioLevel
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const i = setInterval(() => {
      const d = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, [startTime]);

  const patientLink = `${window.location.origin}/teleconsulta/entrar/${sessionId}`;
  const copyLnk = () => { navigator.clipboard.writeText(patientLink); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Link copiado!"); };

  // ── Media ──
  async function getMedia(): Promise<MediaStream | null> {
    for (const c of [{ video: true, audio: true }, { video: true, audio: false }, { video: false, audio: true }]) {
      try { return await navigator.mediaDevices.getUserMedia(c); } catch { continue; }
    }
    return null;
  }

  // ── Start Call ──
  const startCall = async () => {
    const stream = await getMedia();
    if (!stream) { setPhase('permError'); return; }
    streamRef.current = stream;
    setLocalStream(stream);
    if (localRef.current) localRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) { remoteRef.current.srcObject = e.streams[0]; setPhase('connected'); setStartTime(Date.now()); }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) fetch(`${API}/api/signal/${sessionId}/ice/host`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: e.candidate.toJSON() }) }).catch(() => {});
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await fetch(`${API}/api/signal/${sessionId}/offer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: pc.localDescription?.toJSON() }) });
    setPhase('waiting');

    // Poll for answer + ICE + waiting room
    pollRef.current = window.setInterval(async () => {
      try {
        const pc = pcRef.current;
        if (!pc) return;
        if (!pc.remoteDescription) {
          const r = await fetch(`${API}/api/signal/${sessionId}/answer`);
          const d = await r.json();
          if (d.answer) await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
        }
        const r2 = await fetch(`${API}/api/signal/${sessionId}/ice/host?from=${iceRef.current}`);
        const d2 = await r2.json();
        for (const c of d2.candidates) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        iceRef.current = d2.total;

        // Waiting room
        const wr = await fetch(`${API}/api/signal/${sessionId}/waiting`);
        const wrd = await wr.json();
        setWaitingList(wrd.waiting || []);

        // Typing
        const tp = await fetch(`${API}/api/signal/${sessionId}/typing/host`);
        const tpd = await tp.json();
        setOtherTyping(tpd.typing);
      } catch {}
    }, 1000);

    // Chat polling
    chatPollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/signal/${sessionId}/chat?from=${chatIdxRef.current}`);
        const d = await r.json();
        if (d.messages.length > 0) {
          setMessages(prev => [...prev, ...d.messages]);
          chatIdxRef.current = d.total;
          if (!showChat) setUnread(u => u + d.messages.filter((m: any) => m.from !== 'host').length);
        }
      } catch {}
    }, 2000);
  };

  // ── Screen Share ──
  const toggleScreenShare = async () => {
    if (sharing) {
      screenRef.current?.getTracks().forEach(t => t.stop());
      const pc = pcRef.current;
      const stream = streamRef.current;
      if (pc && stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(videoTrack);
        }
      }
      if (localRef.current && streamRef.current) localRef.current.srcObject = streamRef.current;
      setSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenRef.current = screen;
        const pc = pcRef.current;
        if (pc) {
          const videoTrack = screen.getVideoTracks()[0];
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(videoTrack);
          videoTrack.onended = () => toggleScreenShare();
        }
        if (localRef.current) localRef.current.srcObject = screen;
        setSharing(true);
      } catch { toast.error("Não foi possível compartilhar tela"); }
    }
  };

  // ── Chat ──
  const sendChat = () => {
    if (!chatMsg.trim()) return;
    fetch(`${API}/api/signal/${sessionId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'host', text: chatMsg.trim() }) });
    setChatMsg("");
  };

  const handleTyping = () => {
    fetch(`${API}/api/signal/${sessionId}/typing/host`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Transcription ──
  const toggleTranscription = () => {
    if (transcribing) {
      recognitionRef.current?.stop();
      setTranscribing(false);
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { toast.error("Transcrição não suportada neste navegador"); return; }
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      recognition.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            setTranscript(prev => [...prev, e.results[i][0].transcript]);
          }
        }
      };
      recognition.onerror = () => setTranscribing(false);
      recognition.start();
      recognitionRef.current = recognition;
      setTranscribing(true);
      toast.success("Transcrição ativada");
    }
  };

  // ── Controls ──
  const toggleMute = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMuted(!muted); };
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setCamOff(!camOff); };
  const admitVisitor = (id: string) => { fetch(`${API}/api/signal/${sessionId}/admit/${id}`, { method: 'POST' }); toast.success("Paciente admitido"); };

  const endCall = async () => {
    [pollRef, chatPollRef].forEach(r => { if (r.current) clearInterval(r.current); });
    recognitionRef.current?.stop();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenRef.current?.getTracks().forEach(t => t.stop());
    fetch(`${API}/api/signal/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }).catch(() => {});
    nav('/teleconsulta');
  };

  useEffect(() => () => {
    [pollRef, chatPollRef].forEach(r => { if (r.current) clearInterval(r.current); });
    recognitionRef.current?.stop();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Permission Error ──
  if (phase === 'permError') return (
    <div className="h-screen flex items-center justify-center" style={{ background: '#1a1412' }}>
      <div className="text-center max-w-md px-6">
        <Camera size={32} style={{ color: '#ef9a9a' }} className="mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#e8d8c3' }}>Permissão necessária</h2>
        <p className="text-sm mb-4" style={{ color: '#8b7f77' }}>Clique no cadeado na barra de endereço → Câmera/Microfone → Permitir</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setPhase('idle')} className="h-10 px-5 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: '#b8b0aa' }}>Voltar</button>
          <button onClick={() => window.location.reload()} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ background: '#54423b', color: '#f5f2ee' }}>Recarregar</button>
        </div>
      </div>
    </div>
  );

  // ── Main Layout ──
  return (
    <div className="h-screen flex flex-col" style={{ background: '#1a1412' }}>
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#54423b' }}><span className="text-[10px] font-bold" style={{ color: '#e8d8c3' }}>ET</span></div>
          <span className="text-sm font-medium" style={{ color: '#e8d8c3' }}>Teleconsulta</span>
          {phase === 'connected' && <><span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(46,125,50,0.15)', color: '#81c784' }}>{elapsed}</span><AudioLevel stream={localStream} /></>}
          {phase === 'waiting' && <span className="text-xs px-2 py-0.5 rounded animate-pulse" style={{ background: 'rgba(196,168,130,0.1)', color: '#c4a882' }}>Aguardando paciente...</span>}
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'idle' && waitingList.length > 0 && (
            <button onClick={() => setShowWaiting(!showWaiting)} className="relative flex items-center gap-1 h-7 px-2 rounded-lg text-xs" style={{ background: 'rgba(255,200,50,0.1)', color: '#ffd54f' }}>
              <Users size={12} /> {waitingList.length}
            </button>
          )}
          {phase !== 'idle' && (
            <button onClick={() => { setShowChat(!showChat); if (!showChat) setUnread(0); }} className="relative flex items-center gap-1 h-7 px-2 rounded-lg text-xs" style={{ background: showChat ? 'rgba(196,168,130,0.2)' : 'rgba(255,255,255,0.05)', color: '#b8b0aa' }}>
              <MessageSquare size={12} /> {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{unread}</span>}
            </button>
          )}
          <button onClick={copyLnk} className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#b8b0aa' }}>
            {copied ? <><Check size={12} style={{ color: '#81c784' }} /> Copiado</> : <><Copy size={12} /> Link</>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Video area */}
        <div className="flex-1 relative">
          {phase === 'idle' ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8" style={{ background: 'rgba(84,66,59,0.2)' }}><Video size={40} style={{ color: '#c4a882' }} /></div>
              <h2 className="text-2xl font-semibold mb-3" style={{ color: '#e8d8c3' }}>Sala de Teleconsulta</h2>
              <p className="text-sm mb-2" style={{ color: '#8b7f77' }}>Copie o link e envie ao paciente por WhatsApp.</p>
              <p className="text-xs mb-8" style={{ color: '#6b5f57' }}>Sem cadastro, sem download — clica e entra.</p>
              <div className="flex items-center gap-2 rounded-xl p-3 max-w-lg w-full mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <code className="flex-1 text-xs truncate" style={{ color: '#8b7f77' }}>{patientLink}</code>
                <button onClick={copyLnk} style={{ color: '#c4a882' }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
              <button onClick={startCall} className="h-12 px-8 rounded-xl font-medium text-sm flex items-center gap-2" style={{ background: '#54423b', color: '#f5f2ee' }}><Video size={18} /> Iniciar Chamada</button>
            </div>
          ) : (
            <>
              <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" style={{ background: '#0f0a08' }} />
              {phase === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#1a1412' }}>
                  <div className="text-center">
                    <Clock size={28} className="animate-pulse mx-auto mb-4" style={{ color: '#c4a882' }} />
                    <p className="text-sm" style={{ color: '#b8b0aa' }}>Aguardando paciente conectar...</p>
                  </div>
                </div>
              )}
              {/* Local PiP */}
              <div className="absolute bottom-24 right-4 w-48 h-36 rounded-2xl overflow-hidden shadow-2xl" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
                <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: sharing ? 'none' : 'scaleX(-1)' }} />
                {camOff && !sharing && <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#2a2523' }}><VideoOff size={20} style={{ color: '#6b5f57' }} /></div>}
                {sharing && <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] bg-red-500 text-white">Tela</div>}
              </div>
              {/* Transcript overlay */}
              {transcribing && transcript.length > 0 && (
                <div className="absolute bottom-24 left-4 right-56 max-h-32 overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.7)' }}>
                  {transcript.slice(-5).map((t, i) => <p key={i} className="text-xs text-white/80 mb-1">{t}</p>)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Waiting room sidebar */}
        {showWaiting && phase !== 'idle' && (
          <div className="w-64 shrink-0 flex flex-col" style={{ background: '#2a2523', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-medium" style={{ color: '#e8d8c3' }}>Sala de Espera ({waitingList.length})</span>
              <button onClick={() => setShowWaiting(false)}><X size={14} style={{ color: '#6b5f57' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {waitingList.map(w => (
                <div key={w.id} className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm font-medium" style={{ color: '#e8d8c3' }}>{w.name}</p>
                  <p className="text-[10px] mb-2" style={{ color: '#6b5f57' }}>{new Date(w.joinedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <button onClick={() => admitVisitor(w.id)} className="w-full h-7 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1" style={{ background: 'rgba(46,125,50,0.15)', color: '#81c784' }}>
                    <UserCheck size={10} /> Admitir
                  </button>
                </div>
              ))}
              {waitingList.length === 0 && <p className="text-xs text-center py-4" style={{ color: '#6b5f57' }}>Ninguém aguardando</p>}
            </div>
          </div>
        )}

        {/* Chat sidebar */}
        {showChat && phase !== 'idle' && (
          <div className="w-72 shrink-0 flex flex-col" style={{ background: '#2a2523', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-medium" style={{ color: '#e8d8c3' }}>Chat</span>
              <button onClick={() => setShowChat(false)}><X size={14} style={{ color: '#6b5f57' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] ${m.from === 'host' ? 'ml-auto' : ''}`}>
                  <div className={`px-3 py-2 rounded-xl text-xs ${m.from === 'host' ? 'bg-brand-600/20 text-brand-200' : 'bg-white/5 text-surface-300'}`} style={{ borderRadius: m.from === 'host' ? '12px 12px 4px 12px' : '12px 12px 12px 4px' }}>
                    {m.text}
                  </div>
                  <p className="text-[9px] mt-0.5 px-1" style={{ color: '#6b5f57' }}>{new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
              {otherTyping && <p className="text-[10px] italic" style={{ color: '#8b7f77' }}>digitando...</p>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <input value={chatMsg} onChange={e => { setChatMsg(e.target.value); handleTyping(); }} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                className="flex-1 h-8 rounded-lg px-3 text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8d8c3' }} placeholder="Mensagem..." />
              <button onClick={sendChat} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#54423b', color: '#e8d8c3' }}><Send size={12} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {phase !== 'idle' && (
        <div className="h-20 flex items-center justify-center gap-3 shrink-0" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={toggleMute} className="w-11 h-11 rounded-full flex items-center justify-center" title={muted ? "Ativar mic" : "Mutar"}
            style={{ background: muted ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef9a9a' : '#e8d8c3' }}>
            {muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button onClick={toggleCam} className="w-11 h-11 rounded-full flex items-center justify-center" title={camOff ? "Ativar câmera" : "Desligar câmera"}
            style={{ background: camOff ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: camOff ? '#ef9a9a' : '#e8d8c3' }}>
            {camOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>
          <button onClick={toggleScreenShare} className="w-11 h-11 rounded-full flex items-center justify-center" title="Compartilhar tela"
            style={{ background: sharing ? 'rgba(25,118,210,0.2)' : 'rgba(255,255,255,0.08)', color: sharing ? '#90caf9' : '#e8d8c3' }}>
            {sharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
          </button>
          <button onClick={toggleTranscription} className="w-11 h-11 rounded-full flex items-center justify-center" title="Transcrição"
            style={{ background: transcribing ? 'rgba(46,125,50,0.2)' : 'rgba(255,255,255,0.08)', color: transcribing ? '#81c784' : '#e8d8c3' }}>
            {transcribing ? <CaptionsOff size={18} /> : <Captions size={18} />}
          </button>
          <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <button onClick={endCall} className="w-13 h-13 px-5 rounded-full flex items-center justify-center" style={{ background: '#c62828', color: 'white' }}>
            <PhoneOff size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
