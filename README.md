# Espaço Terapêutico v2

Sistema completo de gestão para profissionais de saúde mental.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, React Query, Recharts |
| Backend | Fastify 5, Drizzle ORM, Zod |
| Database | SQLite (WAL mode) via better-sqlite3 |
| Auth | JWT + bcrypt (self-hosted, zero dependência externa) |
| Deploy | Docker single-container → Easypanel |

## Estrutura

```
├── Dockerfile          ← Build único (frontend + backend)
├── docker-compose.yml  ← Deploy local ou Easypanel
├── .env.example        ← Variáveis de ambiente
├── frontend/           ← React SPA
│   └── src/
│       ├── pages/      ← Dashboard, Agenda, Pacientes, etc
│       ├── hooks/      ← React Query hooks (usePatients, etc)
│       ├── lib/        ← API client, utils
│       └── components/ ← Layout, common, UI
└── backend/            ← Fastify API
    └── src/
        ├── routes/     ← Auth, CRUD, Dashboard, AI proxy
        ├── db/         ← Schema Drizzle, migrations
        ├── lib/        ← Auth utils, CRUD factory
        ├── middleware/  ← JWT guard
        └── cron/       ← Lembretes, backup, cleanup
```

## Deploy no Easypanel (5 minutos)

### 1. Subir para GitHub/GitLab

```bash
git init
git add .
git commit -m "v2"
git remote add origin <seu-repo>
git push -u origin main
```

### 2. No Easypanel

1. **Novo Projeto** → nome: `espaco-terapeutico`
2. **Adicionar Service** → App → Source: GitHub → selecionar repo
3. **Build**: Dockerfile (já aponta para `./Dockerfile` na raiz)
4. **Volumes**: adicionar mount `/app/data`
5. **Variáveis de Ambiente**:
   ```
   JWT_SECRET=<gerar: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   CORS_ORIGIN=https://seudominio.com.br
   ```
6. **Domains**: adicionar seu domínio → SSL automático
7. **Deploy** 🚀

### 3. Testar

```bash
curl https://seudominio.com.br/api/health
# {"status":"ok","timestamp":"...","uptime":12.34}
```

## Dev Local

```bash
# Terminal 1 — Backend
cd backend
cp ../.env.example .env  # editar JWT_SECRET
npm install
npm run db:generate
npm run db:migrate
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Acesse http://localhost:5173
```

O Vite faz proxy de `/api/*` para `localhost:3000` automaticamente.

## Funcionalidades

- **Dashboard** — stats em tempo real, gráfico de receita, agenda do dia
- **Agenda** — navegação por dia, criar/editar/concluir consultas
- **Pacientes** — CRUD completo com busca, CPF, contato
- **Prontuários** — registros clínicos vinculados a pacientes
- **Financeiro** — receitas/despesas, status de pagamento, pacotes
- **Documentos** — recibos, atestados, declarações, relatórios
- **Relatórios** — gráficos de receita, status, tipos, crescimento
- **Configurações** — perfil, consultório, senha, tema dark/light
- **AI Analysis** — análise de sessões via proxy seguro (chave no servidor)
- **Push Notifications** — lembretes de consulta via web-push
- **Backup automático** — SQLite backupado diariamente às 2h

## Segurança

- Multi-tenant: toda query filtra por `ownerId`
- JWT com refresh token rotation (hasheados em SHA-256)
- Rate limiting: 100 req/min por IP
- Helmet security headers
- Chaves de API server-side only
- Validação Zod em toda entrada
- Foreign keys enforced
- Backup automático com retenção de 7 dias
