import { FastifyInstance } from 'fastify';

interface Room {
  offer?: any;
  answer?: any;
  hostCandidates: any[];
  guestCandidates: any[];
  hostConnected: boolean;
  guestConnected: boolean;
  chat: { from: string; text: string; ts: number }[];
  waitingRoom: { id: string; name: string; joinedAt: number }[];
  admitted: string[];
  typing: { host: number; guest: number };
}

const rooms = new Map<string, Room>();
function getRoom(id: string): Room {
  if (!rooms.has(id)) rooms.set(id, { hostCandidates: [], guestCandidates: [], hostConnected: false, guestConnected: false, chat: [], waitingRoom: [], admitted: [], typing: { host: 0, guest: 0 } });
  return rooms.get(id)!;
}
setInterval(() => { const now = Date.now(); rooms.forEach((r, k) => { if (now - (r.typing.host || 0) > 300000) rooms.delete(k); }); }, 600000);

export async function signalingRoutes(app: FastifyInstance) {
  // ── WebRTC signaling ──
  app.post('/api/signal/:roomId/offer', async (req) => { getRoom((req.params as any).roomId).offer = (req.body as any).offer; getRoom((req.params as any).roomId).hostConnected = true; return { ok: true }; });
  app.get('/api/signal/:roomId/offer', async (req) => ({ offer: getRoom((req.params as any).roomId).offer || null }));
  app.post('/api/signal/:roomId/answer', async (req) => { getRoom((req.params as any).roomId).answer = (req.body as any).answer; getRoom((req.params as any).roomId).guestConnected = true; return { ok: true }; });
  app.get('/api/signal/:roomId/answer', async (req) => ({ answer: getRoom((req.params as any).roomId).answer || null }));

  app.post('/api/signal/:roomId/ice/:role', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const c = (req.body as any).candidate;
    if ((req.params as any).role === 'host') room.hostCandidates.push(c); else room.guestCandidates.push(c);
    return { ok: true };
  });

  app.get('/api/signal/:roomId/ice/:role', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const from = parseInt((req.query as any).from || '0');
    const candidates = (req.params as any).role === 'host' ? room.guestCandidates : room.hostCandidates;
    return { candidates: candidates.slice(from), total: candidates.length };
  });

  // ── Chat ──
  app.post('/api/signal/:roomId/chat', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const { from, text } = req.body as any;
    const msg = { from, text, ts: Date.now() };
    room.chat.push(msg);
    return { ok: true };
  });

  app.get('/api/signal/:roomId/chat', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const from = parseInt((req.query as any).from || '0');
    return { messages: room.chat.slice(from), total: room.chat.length };
  });

  // ── Typing indicator ──
  app.post('/api/signal/:roomId/typing/:role', async (req) => {
    const room = getRoom((req.params as any).roomId);
    room.typing[(req.params as any).role as 'host' | 'guest'] = Date.now();
    return { ok: true };
  });

  app.get('/api/signal/:roomId/typing/:role', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const otherRole = (req.params as any).role === 'host' ? 'guest' : 'host';
    return { typing: Date.now() - room.typing[otherRole] < 3000 };
  });

  // ── Waiting room ──
  app.post('/api/signal/:roomId/waiting', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const { id, name } = req.body as any;
    if (!room.waitingRoom.find(w => w.id === id)) room.waitingRoom.push({ id, name, joinedAt: Date.now() });
    return { ok: true };
  });

  app.get('/api/signal/:roomId/waiting', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { waiting: room.waitingRoom, admitted: room.admitted };
  });

  app.post('/api/signal/:roomId/admit/:visitorId', async (req) => {
    const room = getRoom((req.params as any).roomId);
    room.admitted.push((req.params as any).visitorId);
    return { ok: true };
  });

  app.get('/api/signal/:roomId/admitted/:visitorId', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { admitted: room.admitted.includes((req.params as any).visitorId) };
  });

  // ── Room status + cleanup ──
  app.get('/api/signal/:roomId/status', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { hostConnected: room.hostConnected, guestConnected: room.guestConnected, hasOffer: !!room.offer, hasAnswer: !!room.answer };
  });

  app.delete('/api/signal/:roomId', async (req) => { rooms.delete((req.params as any).roomId); return { ok: true }; });
}
