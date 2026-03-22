import { FastifyInstance } from 'fastify';

// In-memory signaling store (room → signals)
const rooms = new Map<string, {
  offer?: any; answer?: any;
  hostCandidates: any[]; guestCandidates: any[];
  hostConnected: boolean; guestConnected: boolean;
}>();

function getRoom(id: string) {
  if (!rooms.has(id)) rooms.set(id, { hostCandidates: [], guestCandidates: [], hostConnected: false, guestConnected: false });
  return rooms.get(id)!;
}

// Clean old rooms every 2 hours
setInterval(() => rooms.clear(), 2 * 60 * 60 * 1000);

export async function signalingRoutes(app: FastifyInstance) {
  // Host sends offer
  app.post('/api/signal/:roomId/offer', async (req) => {
    const room = getRoom((req.params as any).roomId);
    room.offer = (req.body as any).offer;
    room.hostConnected = true;
    return { ok: true };
  });

  // Guest gets offer
  app.get('/api/signal/:roomId/offer', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { offer: room.offer || null };
  });

  // Guest sends answer
  app.post('/api/signal/:roomId/answer', async (req) => {
    const room = getRoom((req.params as any).roomId);
    room.answer = (req.body as any).answer;
    room.guestConnected = true;
    return { ok: true };
  });

  // Host gets answer
  app.get('/api/signal/:roomId/answer', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { answer: room.answer || null };
  });

  // Send ICE candidate
  app.post('/api/signal/:roomId/ice/:role', async (req) => {
    const room = getRoom((req.params as any).roomId);
    const role = (req.params as any).role; // 'host' or 'guest'
    const candidate = (req.body as any).candidate;
    if (role === 'host') room.hostCandidates.push(candidate);
    else room.guestCandidates.push(candidate);
    return { ok: true };
  });

  // Get ICE candidates from the other side
  app.get('/api/signal/:roomId/ice/:role', async (req, reply) => {
    const room = getRoom((req.params as any).roomId);
    const role = (req.params as any).role;
    const from = parseInt((req.query as any).from || '0');
    // Return candidates from the OTHER role
    const candidates = role === 'host' ? room.guestCandidates : room.hostCandidates;
    return { candidates: candidates.slice(from), total: candidates.length };
  });

  // Room status
  app.get('/api/signal/:roomId/status', async (req) => {
    const room = getRoom((req.params as any).roomId);
    return { hostConnected: room.hostConnected, guestConnected: room.guestConnected, hasOffer: !!room.offer, hasAnswer: !!room.answer };
  });

  // Reset room
  app.delete('/api/signal/:roomId', async (req) => {
    rooms.delete((req.params as any).roomId);
    return { ok: true };
  });
}
