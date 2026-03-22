import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneOff, Copy, Check, Video, Mic, MicOff, VideoOff, Clock, Maximize2 } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

export default function VideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);
  const iceIdxRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [elapsed, setElapsed] = useState("00:00");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const i = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, [startTime]);

  const patientLink = `${window.location.origin}/teleconsulta/entrar/${sessionId}`;
  const copyLink = () => { navigator.clipboard.writeText(patientLink); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Link copiado!"); };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localVideoRef.current) { localVideoRef.current.srcObject = stream; }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setConnected(true); setStartTime(Date.now());
        }
      };
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await fetch(`${API}/api/signal/${sessionId}/ice/host`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: e.candidate.toJSON() }) });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setConnected(false);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(`${API}/api/signal/${sessionId}/offer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: pc.localDescription?.toJSON() }) });

      setStarted(true); setWaiting(true);

      // Poll for answer + ICE
      pollRef.current = window.setInterval(async () => {
        try {
          if (!pc.remoteDescription) {
            const res = await fetch(`${API}/api/signal/${sessionId}/answer`);
            const data = await res.json();
            if (data.answer) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              setWaiting(false);
            }
          }
          const iceRes = await fetch(`${API}/api/signal/${sessionId}/ice/host?from=${iceIdxRef.current}`);
          const iceData = await iceRes.json();
          for (const c of iceData.candidates) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          iceIdxRef.current = iceData.total;
        } catch {}
      }, 1000);

    } catch (err: any) {
      toast.error("Não foi possível acessar câmera/microfone. Verifique as permissões.");
    }
  };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(!muted);
  };
  const toggleVideo = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoOff(!videoOff);
  };

  const endCall = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    await fetch(`${API}/api/signal/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    await fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }).catch(() => {});
    navigate('/teleconsulta');
  };

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1a1412' }}>
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#54423b' }}>
            <span className="text-[10px] font-bold" style={{ color: '#e8d8c3' }}>ET</span>
          </div>
          <span className="text-sm font-medium" style={{ color: '#e8d8c3' }}>Teleconsulta</span>
          {connected && <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(46,125,50,0.15)', color: '#81c784' }}>{elapsed}</span>}
          {waiting && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(196,168,130,0.1)', color: '#c4a882' }}>Aguardando paciente...</span>}
        </div>
        <button onClick={copyLink} className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all" style={{ background: 'rgba(255,255,255,0.05)', color: '#b8b0aa' }}>
          {copied ? <><Check size={12} style={{ color: '#81c784' }} /> Copiado</> : <><Copy size={12} /> Copiar link</>}
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {!started ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8" style={{ background: 'rgba(84,66,59,0.2)' }}>
              <Video size={40} style={{ color: '#c4a882' }} />
            </div>
            <h2 className="text-2xl font-semibold mb-3" style={{ color: '#e8d8c3' }}>Sala de Teleconsulta</h2>
            <p className="text-sm mb-8 max-w-md" style={{ color: '#8b7f77' }}>
              Envie o link para o paciente via WhatsApp. Quando estiver pronto, inicie a chamada.
            </p>
            <div className="flex items-center gap-2 rounded-xl p-3 max-w-lg w-full mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <code className="flex-1 text-xs truncate" style={{ color: '#8b7f77' }}>{patientLink}</code>
              <button onClick={copyLink} style={{ color: '#c4a882' }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
            <button onClick={startCall} className="h-12 px-8 rounded-xl font-medium text-sm flex items-center gap-2 transition-all" style={{ background: '#54423b', color: '#f5f2ee' }}>
              <Video size={18} /> Iniciar Chamada
            </button>
          </div>
        ) : (
          <>
            {/* Remote video (full) */}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ background: '#0f0a08' }} />

            {/* No remote yet */}
            {!connected && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#1a1412' }}>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,168,130,0.1)' }}>
                    <Clock size={28} className="animate-pulse" style={{ color: '#c4a882' }} />
                  </div>
                  <p className="text-sm" style={{ color: '#b8b0aa' }}>Aguardando paciente conectar...</p>
                  <p className="text-xs mt-2" style={{ color: '#6b5f57' }}>Envie o link por WhatsApp</p>
                </div>
              </div>
            )}

            {/* Local video (PiP) */}
            <div className="absolute bottom-24 right-4 w-48 h-36 rounded-2xl overflow-hidden shadow-2xl" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              {videoOff && <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#2a2523' }}><VideoOff size={20} style={{ color: '#6b5f57' }} /></div>}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {started && (
        <div className="h-20 flex items-center justify-center gap-4" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={toggleMute} className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{ background: muted ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef9a9a' : '#e8d8c3' }}>
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button onClick={toggleVideo} className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{ background: videoOff ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: videoOff ? '#ef9a9a' : '#e8d8c3' }}>
            {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button onClick={endCall} className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ background: '#c62828', color: 'white' }}>
            <PhoneOff size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
