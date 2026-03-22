import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Video, Mic, MicOff, VideoOff, PhoneOff, Loader2, AlertCircle, MessageSquare, Send, X, Monitor } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.services.mozilla.com' }];

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);
  const chatPollRef = useRef<number | null>(null);
  const iceRef = useRef(0);
  const chatIdxRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const visitorId = useRef(Math.random().toString(36).slice(2, 8));

  const [step, setStep] = useState<'name' | 'waiting' | 'connecting' | 'connected' | 'ended' | 'error'>('name');
  const [name, setName] = useState('');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [unread, setUnread] = useState(0);

  // ── Join waiting room ──
  const joinWaiting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch(`${API}/api/signal/${sessionId}/waiting`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: visitorId.current, name: name.trim() }) });
    setStep('waiting');

    // Poll for admission
    const admitPoll = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/signal/${sessionId}/admitted/${visitorId.current}`);
        const d = await r.json();
        if (d.admitted) { clearInterval(admitPoll); setStep('connecting'); connectWebRTC(); }
      } catch {}
    }, 1500);
    pollRef.current = admitPoll as any;
  };

  // ── WebRTC connect ──
  const connectWebRTC = async () => {
    // Wait for offer
    let offer: any = null;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${API}/api/signal/${sessionId}/offer`);
        const d = await r.json();
        if (d.offer) { offer = d.offer; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!offer) { setStep('error'); return; }

    let stream: MediaStream | null = null;
    for (const c of [{ video: true, audio: true }, { video: true, audio: false }, { video: false, audio: true }]) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { continue; }
    }
    if (!stream) { setStep('error'); return; }
    streamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream!));

    pc.ontrack = (e) => { if (remoteRef.current && e.streams[0]) { remoteRef.current.srcObject = e.streams[0]; setStep('connected'); } };
    pc.onicecandidate = (e) => { if (e.candidate) fetch(`${API}/api/signal/${sessionId}/ice/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: e.candidate.toJSON() }) }).catch(() => {}); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setStep('ended'); };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await fetch(`${API}/api/signal/${sessionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: pc.localDescription?.toJSON() }) });

    // ICE polling
    const icePoll = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/signal/${sessionId}/ice/guest?from=${iceRef.current}`);
        const d = await r.json();
        for (const c of d.candidates) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        iceRef.current = d.total;
        // Typing
        const tp = await fetch(`${API}/api/signal/${sessionId}/typing/guest`);
        const tpd = await tp.json();
        setOtherTyping(tpd.typing);
      } catch {}
    }, 1000);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = icePoll as any;

    // Chat polling
    chatPollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/signal/${sessionId}/chat?from=${chatIdxRef.current}`);
        const d = await r.json();
        if (d.messages.length > 0) {
          setMessages(prev => [...prev, ...d.messages]);
          chatIdxRef.current = d.total;
          if (!showChat) setUnread(u => u + d.messages.filter((m: any) => m.from !== 'guest').length);
        }
      } catch {}
    }, 2000) as any;
  };

  const sendChat = () => {
    if (!chatMsg.trim()) return;
    fetch(`${API}/api/signal/${sessionId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'guest', text: chatMsg.trim() }) });
    setChatMsg("");
  };

  const handleTyping = () => { fetch(`${API}/api/signal/${sessionId}/typing/guest`, { method: 'POST' }).catch(() => {}); };

  const toggleMute = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMuted(!muted); };
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setCamOff(!camOff); };
  const hangUp = () => { pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); [pollRef, chatPollRef].forEach(r => { if (r.current) clearInterval(r.current); }); setStep('ended'); };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => () => { [pollRef, chatPollRef].forEach(r => { if (r.current) clearInterval(r.current); }); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  // ── Name entry ──
  if (step === 'name') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1a1412' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.2)' }}><Video size={28} style={{ color: '#c4a882' }} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>Teleconsulta</h1>
        <p className="text-sm mb-8" style={{ color: '#8b7f77' }}>Informe seu nome para entrar na sala de espera</p>
        <form onSubmit={joinWaiting} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full h-12 rounded-xl px-4 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8d8c3' }} placeholder="Seu nome completo" required autoFocus />
          <button type="submit" className="w-full h-12 rounded-xl font-medium text-sm" style={{ background: '#54423b', color: '#f5f2ee' }}>Entrar na Sala de Espera</button>
        </form>
      </div>
    </div>
  );

  // ── Waiting room ──
  if (step === 'waiting' || step === 'connecting') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1a1412' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.1)' }}><Video size={32} style={{ color: '#c4a882' }} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>{step === 'connecting' ? 'Conectando...' : 'Sala de Espera'}</h1>
        <p className="text-sm mb-2" style={{ color: '#b8b0aa' }}>Olá, <strong style={{ color: '#e8d8c3' }}>{name}</strong>!</p>
        <p className="text-sm mb-8" style={{ color: '#8b7f77' }}>{step === 'connecting' ? 'Preparando sua conexão...' : 'Aguarde o profissional admitir você.'}</p>
        <Loader2 size={24} className="animate-spin mx-auto mb-8" style={{ color: '#c4a882' }} />
        <div className="p-4 rounded-xl max-w-xs mx-auto text-left" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-xs mb-2" style={{ color: '#b8b0aa' }}>Dicas para uma boa sessão:</p>
          <ul className="text-xs space-y-1.5" style={{ color: '#6b5f57' }}>
            <li>• Local tranquilo e privado</li>
            <li>• Use fones de ouvido</li>
            <li>• Boa iluminação ajuda</li>
            <li>• Permita câmera e microfone</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // ── Connected ──
  if (step === 'connected') return (
    <div className="h-screen flex flex-col" style={{ background: '#0f0a08' }}>
      {/* Top bar */}
      <div className="h-10 flex items-center justify-between px-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(26,20,18,0.9)' }}>
        <span className="text-xs" style={{ color: '#b8b0aa' }}>Teleconsulta com {name}</span>
        <button onClick={() => { setShowChat(!showChat); if (!showChat) setUnread(0); }} className="relative flex items-center gap-1 h-6 px-2 rounded text-[10px]" style={{ background: showChat ? 'rgba(196,168,130,0.2)' : 'transparent', color: '#b8b0aa' }}>
          <MessageSquare size={11} /> Chat {unread > 0 && <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">{unread}</span>}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-20 right-3 w-32 h-24 sm:w-40 sm:h-28 rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
            <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {camOff && <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#2a2523' }}><VideoOff size={16} style={{ color: '#6b5f57' }} /></div>}
          </div>
        </div>

        {/* Chat */}
        {showChat && (
          <div className="w-64 shrink-0 flex flex-col" style={{ background: '#2a2523', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] ${m.from === 'guest' ? 'ml-auto' : ''}`}>
                  <div className={`px-2.5 py-1.5 rounded-lg text-[11px] ${m.from === 'guest' ? 'bg-brand-600/20 text-brand-200' : 'bg-white/5 text-surface-300'}`}>{m.text}</div>
                </div>
              ))}
              {otherTyping && <p className="text-[10px] italic" style={{ color: '#8b7f77' }}>digitando...</p>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 flex gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <input value={chatMsg} onChange={e => { setChatMsg(e.target.value); handleTyping(); }} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                className="flex-1 h-7 rounded-lg px-2.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8d8c3' }} placeholder="Mensagem..." />
              <button onClick={sendChat} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#54423b', color: '#e8d8c3' }}><Send size={10} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-16 flex items-center justify-center gap-3" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={toggleMute} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: muted ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef9a9a' : '#e8d8c3' }}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
        <button onClick={toggleCam} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: camOff ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: camOff ? '#ef9a9a' : '#e8d8c3' }}>{camOff ? <VideoOff size={18} /> : <Video size={18} />}</button>
        <button onClick={hangUp} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#c62828', color: 'white' }}><PhoneOff size={20} /></button>
      </div>
    </div>
  );

  // ── Ended ──
  if (step === 'ended') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center"><Video size={24} style={{ color: '#54423b' }} className="mx-auto mb-4" /><h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Sessão encerrada</h1><p className="text-sm" style={{ color: '#b8b0aa' }}>Obrigado. Pode fechar esta página.</p></div>
    </div>
  );

  // ── Error ──
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center"><AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" /><h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Não foi possível conectar</h1><p className="text-sm mb-4" style={{ color: '#b8b0aa' }}>Verifique o link com seu profissional.</p><button onClick={() => window.location.reload()} className="h-10 px-6 rounded-xl text-sm font-medium" style={{ background: '#54423b', color: '#f5f2ee' }}>Tentar novamente</button></div>
    </div>
  );
}
