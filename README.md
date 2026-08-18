# Bot de WhatsApp para Gestão de Grupos (Instituto Sentidos & ISP Preparatórios)

Sistema centralizado para automação e gestão de grupos do WhatsApp conectados à Evolution API (v2.3.7), incluindo mensagens de boas-vindas customizadas com variáveis dinâmicas, agendamento de mídias (PDFs/imagens), monitoramento automático de novos conteúdos (YouTube, Instagram via container RSSHub próprio, blogs RSS) e painel administrativo web moderno.

## 🚀 Funcionalidades

- **Boas-Vindas Automáticas**: Envio instantâneo ao detectar novos membros via webhook da Evolution API, com suporte a variáveis `{nome}`, `{grupo}`, `{numero}`.
- **Segurança Reforçada no Webhook**: Validação obrigatória de token secreto (`EVOLUTION_WEBHOOK_SECRET`) retornando **HTTP 401 Unauthorized** em requisições não autorizadas.
- **Agendamento de Mídias**: Upload e agendamento de arquivos (PDF, apostilas, imagens) ou mensagens de texto com fuso horário oficial **America/Fortaleza** (UTC-3) e suporte a reenvio/disparo imediato manual.
- **Monitoramento de Conteúdos**:
  - **Instagram**: Leitura automática de perfis via container local **RSSHub** (`diygod/rsshub`).
  - **YouTube**: Leitura de feeds RSS oficiais de canais.
  - **Blogs Institucionais**: Feeds RSS de `isentidos.com.br` e `isppreparatorios.com.br`.
- **Logs de Auditoria**: Registro completo de cada evento com status (Sucesso/Erro), data/hora e filtros.
- **Painel Administrativo Web (Next.js)**: Dashboard responsivo em Dark Mode com Glassmorphism.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, `node-cron`, `rss-parser`, `date-fns-tz`.
- **Banco de Dados**: PostgreSQL 16 com timestamps `TIMESTAMPTZ`.
- **Integração WhatsApp**: Evolution API v2.3.7.
- **Feed Generator**: RSSHub (`diygod/rsshub:latest`).
- **Orquestração**: Docker Compose com suporte a rede externa do Traefik (HTTPS SSL).

---

## 📦 Estrutura do Projeto

```text
isentidosbot/
├── backend/
│   ├── src/
│   │   ├── db/              # Conexão e Schema SQL PostgreSQL
│   │   ├── middleware/      # Auth JWT & Webhook Secret Token (401)
│   │   ├── routes/          # Endpoints API & Handlers de Webhook
│   │   ├── services/        # Client Evolution API & Motores Cron (Fortaleza TZ)
│   │   └── index.ts         # Servidor Express Principal
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Rotas Next.js App Router (Grupos, Boas-Vindas, Agendamentos, etc.)
│   │   ├── components/      # Componentes UI (Sidebar, Navbar, StatCard)
│   │   ├── context/         # AuthContext
│   │   └── lib/             # Cliente Axios API
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Orquestração com Postgres, RSSHub, Backend, Frontend e Traefik
├── .env.example
└── README.md
```

---

## 🔧 Configuração e Execução

### 1. Requisitos
- Node.js 20+
- Docker e Docker Compose (para implantação na VPS)

### 2. Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e ajuste as credenciais:
```bash
cp .env.example .env
```

Principais variáveis de ambiente do backend:
- `BACKEND_PUBLIC_URL`: URL pública da API Backend (ex: `https://isentidosbot-api.isentidos.com.br`). Utilizada para gerar a URL pública acessível dos arquivos de mídia enviados à Evolution API.
- `NEXT_PUBLIC_API_URL`: URL pública da API Backend acessível pelo Frontend (ex: `https://isentidosbot-api.isentidos.com.br`).
- `EVOLUTION_API_URL`: URL base da Evolution API v2.3.7.
- `EVOLUTION_API_KEY`: API Key da Evolution API.
- `EVOLUTION_WEBHOOK_SECRET`: Token secreto de autenticação do webhook da Evolution API.

### 3. Execução via Docker Compose (VPS)
```bash
docker-compose up -d --build
```

---

## 🛡️ Licença
Uso exclusivo do **Instituto Sentidos** e **ISP Preparatórios**. Desenvolvido por Aristóteles Meneses Lima.
