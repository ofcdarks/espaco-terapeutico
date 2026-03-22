import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { patientGroups, patientGroupMembers, patientRelationships, patients } from '../db/schema.js';
import { db } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { registerCrudRoutes } from '../lib/crud-factory.js';
import { authGuard } from '../middleware/auth.js';

// ── Patient Groups ──────────────────────────────────────────

const groupCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['familia', 'casal', 'grupo_terapeutico']).default('familia'),
  description: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
});

const groupUpdateSchema = groupCreateSchema.partial();

export async function groupRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/patient-groups',
    table: patientGroups,
    createSchema: groupCreateSchema.omit({ memberIds: true }),
    updateSchema: groupUpdateSchema.omit({ memberIds: true }),
    searchColumn: 'name',
  });

  // Create group with members
  app.post('/api/patient-groups/with-members', { preHandler: authGuard }, async (request, reply) => {
    const parsed = groupCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { memberIds, ...groupData } = parsed.data;

    const [group] = db
      .insert(patientGroups)
      .values({ ...groupData, ownerId: request.user.userId })
      .returning()
      .all();

    if (memberIds.length > 0) {
      const members = memberIds.map((patientId) => ({
        groupId: group.id,
        patientId,
      }));
      db.insert(patientGroupMembers).values(members).run();
    }

    return reply.status(201).send({ ...group, memberIds });
  });

  // Get group members
  app.get('/api/patient-groups/:id/members', { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const group = db
      .select()
      .from(patientGroups)
      .where(and(eq(patientGroups.id, id), eq(patientGroups.ownerId, request.user.userId)))
      .get();

    if (!group) return reply.status(404).send({ error: 'Grupo não encontrado' });

    const members = db
      .select({ patient: patients })
      .from(patientGroupMembers)
      .innerJoin(patients, eq(patientGroupMembers.patientId, patients.id))
      .where(eq(patientGroupMembers.groupId, id))
      .all();

    return members.map((m) => m.patient);
  });

  // Add member to group
  app.post('/api/patient-groups/:id/members', { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { patientId } = request.body as { patientId: string };

    db.insert(patientGroupMembers).values({ groupId: id, patientId }).run();
    return reply.status(201).send({ ok: true });
  });

  // Remove member from group
  app.delete('/api/patient-groups/:groupId/members/:patientId', { preHandler: authGuard }, async (request, reply) => {
    const { groupId, patientId } = request.params as { groupId: string; patientId: string };

    db.delete(patientGroupMembers)
      .where(and(eq(patientGroupMembers.groupId, groupId), eq(patientGroupMembers.patientId, patientId)))
      .run();

    return reply.status(204).send();
  });

  // ── Patient Relationships ─────────────────────────────────
  registerCrudRoutes(app, {
    prefix: '/api/patient-relationships',
    table: patientRelationships,
    createSchema: z.object({
      patientId: z.string().min(1),
      relatedPatientId: z.string().min(1),
      relationship: z.enum([
        'conjuge', 'pai', 'mae', 'filho', 'filha',
        'irmao', 'irma', 'parceiro', 'parceira', 'outro',
      ]).default('outro'),
      groupId: z.string().optional(),
    }),
    updateSchema: z.object({
      relationship: z.enum([
        'conjuge', 'pai', 'mae', 'filho', 'filha',
        'irmao', 'irma', 'parceiro', 'parceira', 'outro',
      ]).optional(),
      groupId: z.string().optional(),
    }),
  });

  // Get relationships for a patient
  app.get('/api/patients/:id/relationships', { preHandler: authGuard }, async (request) => {
    const { id } = request.params as { id: string };
    const ownerId = request.user.userId;

    const rels = db
      .select()
      .from(patientRelationships)
      .where(
        and(
          eq(patientRelationships.ownerId, ownerId),
          eq(patientRelationships.patientId, id)
        )
      )
      .all();

    // Enrich with patient data
    return rels.map((rel) => {
      const related = db.select().from(patients).where(eq(patients.id, rel.relatedPatientId)).get();
      return { ...rel, relatedPatient: related };
    });
  });
}
