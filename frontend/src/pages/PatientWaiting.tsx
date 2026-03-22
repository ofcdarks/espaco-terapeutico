import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Video, Mic, MicOff, VideoOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.services.mozilla.com' }];

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);
  const iceRef = useRef(0);

  const [step, setStep] = useState<'waiting' | 'connected' | 'ended' | 'error'>('waiting');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  useEffect(() => {
    let active = true;
    const connect = async () => {
      // Poll for host offer
      let offer: any = null;
      for (let i = 0; i < 180 && active; i++) {
        try {
          const r = await fetch(`${API}/api/signal/${sessionId}/offer`);
          const d = await r.json();
          if (d.offer) { offer = d.offer; break; }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!offer || !active) { if (active) setStep('error'); return; }

      let stream: MediaStream | null = null;
      for (const c of [{ video: true, audio: true }, { video: true, audio: false }, { video: false, audio: true }]) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { continue; }
      }
      if (!stream || !active) { if (active) setStep('error'); return; }
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

      pollRef.current = window.setInterval(async () => {
        try {
          const r = await fetch(`${API}/api/signal/${sessionId}/ice/guest?from=${iceRef.current}`);
          const d = await r.json();
          for (const c of d.candidates) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          iceRef.current = d.total;
        } catch {}
      }, 1000);
    };
    connect();
    return () => { active = false; if (pollRef.current) clearInterval(pollRef.current); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [sessionId]);

  const toggleMute = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMuted(!muted); };
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setCamOff(!camOff); };
  const hangUp = () => { pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); if (pollRef.current) clearInterval(pollRef.current); setStep('ended'); };

  if (step === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1a1412' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.1)' }}>
          <Video size={32} style={{ color: '#c4a882' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>Aguardando profissional...</h1>
        <p className="text-sm mb-8" style={{ color: '#8b7f77' }}>O profissional iniciará a chamada em instantes</p>
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

  if (step === 'connected') return (
    <div className="h-screen flex flex-col" style={{ background: '#0f0a08' }}>
      <div className="flex-1 relative">
        <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-20 right-3 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
          <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          {camOff && <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#2a2523' }}><VideoOff size={16} style={{ color: '#6b5f57' }} /></div>}
        </div>
      </div>
      <div className="h-20 flex items-center justify-center gap-4" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={toggleMute} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: muted ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef9a9a' : '#e8d8c3' }}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
        <button onClick={toggleCam} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: camOff ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: camOff ? '#ef9a9a' : '#e8d8c3' }}>{camOff ? <VideoOff size={20} /> : <Video size={20} />}</button>
        <button onClick={hangUp} className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#c62828', color: 'white' }}><PhoneOff size={22} /></button>
      </div>
    </div>
  );

  if (step === 'ended') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <Video size={24} style={{ color: '#54423b' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Sessão encerrada</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>Obrigado. Você pode fechar esta página.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Não foi possível conectar</h1>
        <p className="text-sm mb-4" style={{ color: '#b8b0aa' }}>Verifique o link com seu profissional.</p>
        <button onClick={() => window.location.reload()} className="h-10 px-6 rounded-xl text-sm font-medium" style={{ background: '#54423b', color: '#f5f2ee' }}>Tentar novamente</button>
      </div>
    </div>
  );
}
