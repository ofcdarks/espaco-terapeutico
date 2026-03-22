import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3099';
let accessToken = '';
let refreshToken = '';
const testUser = { name: 'Test User', email: `test${Date.now()}@test.com`, password: 'Test123456' };

describe('Auth API', () => {
  it('POST /api/auth/register - creates user', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe(testUser.email);
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('POST /api/auth/register - rejects duplicate email', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login - succeeds with correct credentials', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.accessToken).toBeTruthy();
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('POST /api/auth/login - fails with wrong password', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'WrongPassword' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - returns profile', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(testUser.email);
    expect(data.passwordHash).toBeUndefined();
  });

  it('GET /api/auth/me - rejects without token', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/refresh - rotates tokens', async () => {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refreshToken }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).not.toBe(refreshToken);
  });

  it('POST /api/auth/change-password - works', async () => {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    const { accessToken: at } = await loginRes.json();
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
      body: JSON.stringify({ currentPassword: testUser.password, newPassword: 'NewPass123' }),
    });
    expect(res.status).toBe(200);
  });

  it('POST /api/auth/forgot-password - returns ok even for unknown email', async () => {
    const res = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@test.com' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('CRUD API (Patients)', () => {
  let patientId = '';

  it('should login first', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'NewPass123' }),
    });
    const data = await res.json();
    accessToken = data.accessToken;
  });

  it('POST /api/patients - creates patient', async () => {
    const res = await fetch(`${BASE}/api/patients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: 'Maria Silva', email: 'maria@test.com', phone: '11999999999', cpf: '12345678901' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe('Maria Silva');
    patientId = data.id;
  });

  it('GET /api/patients - lists with ownership', async () => {
    const res = await fetch(`${BASE}/api/patients`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].ownerId).toBeTruthy();
  });

  it('GET /api/patients/:id - returns single', async () => {
    const res = await fetch(`${BASE}/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(patientId);
  });

  it('PATCH /api/patients/:id - updates', async () => {
    const res = await fetch(`${BASE}/api/patients/${patientId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: 'Maria Santos' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Maria Santos');
  });

  it('DELETE /api/patients/:id - removes', async () => {
    const res = await fetch(`${BASE}/api/patients/${patientId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(204);
  });

  it('GET /api/patients/:id - returns 404 after delete', async () => {
    const res = await fetch(`${BASE}/api/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
  });
});

describe('Appointments - Conflict Detection', () => {
  it('should detect time conflicts', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'NewPass123' }),
    });
    const { accessToken: at } = await res.json();

    // Create patient first
    const pRes = await fetch(`${BASE}/api/patients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
      body: JSON.stringify({ name: 'Test Patient' }),
    });
    const patient = await pRes.json();

    // Create appointment at 10:00
    await fetch(`${BASE}/api/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
      body: JSON.stringify({ patientId: patient.id, date: '2025-12-01', time: '10:00', duration: 50, type: 'Consulta' }),
    });

    // Check conflict at 10:30 (overlaps with 10:00-10:50)
    const conflictRes = await fetch(`${BASE}/api/appointments/check-conflict?date=2025-12-01&time=10:30&duration=50`, {
      headers: { Authorization: `Bearer ${at}` },
    });
    const conflict = await conflictRes.json();
    expect(conflict.hasConflict).toBe(true);

    // Check no conflict at 11:00
    const noConflictRes = await fetch(`${BASE}/api/appointments/check-conflict?date=2025-12-01&time=11:00&duration=50`, {
      headers: { Authorization: `Bearer ${at}` },
    });
    const noConflict = await noConflictRes.json();
    expect(noConflict.hasConflict).toBe(false);
  });
});

describe('Health Check', () => {
  it('GET /api/health - returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });
});
