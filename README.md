<p align="center"><img width="700" height="478" alt="print" src="https://github.com/user-attachments/assets/02f80453-9ef9-4f39-a18d-d0885890e72d" /></p>

O web app **Alarme Google Agenda 2026** é um sistema de alarme impossível de ignorar, sincronizado com o Google Agenda (Calendar). Alarme sonoro, visual (overlay vermelho fullscreen) e push notifications para garantir que você nunca mais perca uma reunião.

## Recursos

- **Alarme sonoro** — toca MP3 em loop com fallback Web Audio API (880Hz square wave)
- **Alarme visual** — overlay vermelho fullscreen em níveis critical/maximum
- **Push notifications** — via Service Worker, funciona com tela bloqueada no smartphone
- **Vibração** — padrão de vibração no mobile quando o alarme dispara
- **Sincronização automática** — polling a cada 2 min (configurável), busca todos os eventos do dia
- **Links de reunião** — detecta Google Meet, Zoom, Teams, Webex, Chime, AWS Events e outros
- **Salas de reunião** — menu hambúrguer com salas sincronizadas do Google Calendar (eventos "SALA INTERNA")
- **Contador de presença** — ícone de olho mostrando quantos colegas estão online
- **Botão de teste** — simula alarme completo (som + visual) para validar que tudo funciona
- **Silenciar/Snooze** — silenciar evento individual ou adiar por 5 minutos
- **Wake Lock** — impede o Chrome mobile de recarregar a tab em segundo plano
- **Auto-recovery do áudio** — após reload, reativa o som automaticamente sem intervenção
- **Painel admin** — configuração de intervalos, volume, frequência do fallback (protegido por senha)
- **Tema dark** — interface escura otimizada para uso contínuo
- **OAuth seguro** — login com Google, somente leitura do calendário, tokens com refresh automático

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript (strict mode) |
| Autenticação | NextAuth.js v4 + Google OAuth 2.0 |
| API | Google Calendar API v3 |
| Estilo | Tailwind CSS v3 (tema dark customizado) |
| Deploy | Vercel |

## Logo personalizada

O web app exibe uma logo na tela de login e no header. Adicione a sua própria:

1. Crie uma imagem PNG com **fundo transparente**
2. Tamanho recomendado: **1024 x 461 px** (proporção ~2.2:1)
3. Salve como `public/som/logo.png`

A logo não está incluída no repositório — cada instalação usa a sua.

## Pré-requisitos

- Node.js 18+
- Conta Google Cloud (a API é gratuita)
- Vercel CLI (`npm i -g vercel`) ou conta na vercel.com

## Passo a passo: do zero à produção

### 1. Clonar o repositório

```bash
git clone https://github.com/aryribeiro/alarme-google-agenda.git
cd alarme-google-agenda
npm install
```

### 2. Criar projeto no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: "Alarme Agenda")
3. No menu lateral, vá em **APIs & Services → Library**
4. Pesquise **Google Calendar API** e clique em **Enable**

### 3. Configurar OAuth Consent Screen

1. Vá em **APIs & Services → OAuth consent screen**
2. Escolha o tipo:
   - **Internal** — somente usuários da sua organização Google Workspace (recomendado para empresas)
   - **External** — qualquer pessoa com conta Google (exige verificação do Google para produção)
3. Preencha:
   - App name: `Alarme Google Agenda`
   - User support email: seu email
   - Developer contact: seu email
4. Em **Scopes**, adicione:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events.readonly`
5. Salve

### 4. Criar credenciais OAuth 2.0

1. Vá em **APIs & Services → Credentials**
2. Clique em **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Alarme Agenda Web`
5. Em **Authorized redirect URIs**, adicione:
   - `http://localhost:3000/api/auth/callback/google` (desenvolvimento)
   - `https://seu-app.vercel.app/api/auth/callback/google` (produção)
6. Clique em **Create**
7. Copie o **Client ID** e **Client Secret**

### 5. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.local.example .env.local
```

Preencha com seus valores:

```env
GOOGLE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=gere_com_comando_abaixo
```
Para gerar o `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 6. Testar localmente

```bash
npm run dev
```

Acesse `http://localhost:3000`, faça login com sua conta Google e verifique se os eventos do Google Agenda aparecem.

### 7. Deploy na Vercel

#### Via CLI (recomendado):

```bash
vercel login
vercel --prod
```

#### Via Dashboard:

1. Acesse [vercel.com](https://vercel.com) → Import Project
2. Conecte o repositório GitHub
3. Antes do deploy, configure as **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Seu Client ID do Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Seu Client Secret do Google Cloud |
| `NEXTAUTH_URL` | URL do deploy (ex: `https://seu-app.vercel.app`) |
| `NEXTAUTH_SECRET` | Resultado do `openssl rand -base64 32` |

4. Deploy

### 8. Atualizar Redirect URI no Google Cloud

Após o primeiro deploy, volte ao Google Cloud Console e adicione a URL de produção nas Authorized redirect URIs:

```
https://seu-app.vercel.app/api/auth/callback/google
https://seu-app.vercel.app no campo sobre JavaScript...
```

## Estrutura do projeto

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth endpoints
│   │   ├── calendar/events/      # Busca eventos do dia
│   │   ├── calendar/rooms/       # Busca salas de reunião
│   │   └── presence/             # Heartbeat de presença online
│   ├── admin/                    # Painel administrativo
│   ├── login/                    # Tela de login
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard principal
│   └── providers.tsx             # Context providers (alarme, áudio, polling)
├── components/
│   ├── AlarmOverlay.tsx          # Overlay vermelho fullscreen
│   ├── AudioUnlockBanner.tsx     # Banner para ativar áudio (restrição do browser)
│   ├── EventCard.tsx             # Card individual de evento
│   ├── EventList.tsx             # Lista de eventos
│   ├── Header.tsx                # Header com logo, sync, teste, logout
│   ├── OnlineCounter.tsx         # Contador de presença (ícone de olho)
│   └── RoomsMenu.tsx             # Menu hambúrguer com salas de reunião
├── hooks/
│   ├── useAlarmAudio.ts          # Controle de áudio (MP3 + Web Audio fallback)
│   ├── useAlarmState.ts          # Context type + provider hook
│   ├── useCalendarPolling.ts     # Polling + cálculo de alarmes
│   ├── useNotifications.ts       # Push notifications via Service Worker
│   └── useWakeLock.ts            # Wake Lock API (previne tab discard no mobile)
├── lib/
│   ├── adminAuth.ts              # Autenticação admin (SHA-256 local)
│   ├── alarmLogic.ts             # Lógica de níveis e timing
│   ├── auth.ts                   # NextAuth config (Google provider + JWT refresh)
│   └── googleCalendar.ts         # Integração Google Calendar API v3
├── public/
│   ├── som/                      # som.mp3 (alarme) + logo.png
│   └── sw.js                     # Service Worker para push notifications
└── types/
    └── index.ts                  # Interfaces TypeScript
```

## Níveis de alarme

| Nível | Tempo antes do evento | Comportamento |
|-------|----------------------|---------------|
| Warning | 30 min | Notificação push |
| Urgent | 10 min | Notificação push + vibração |
| Critical | 5 min | Som em loop + overlay vermelho + push + vibração |
| Maximum | 0 min (evento iniciou) | Som máximo + overlay vermelho + push + vibração |

## Salas de reunião

O menu hambúrguer (canto inferior esquerdo) sincroniza automaticamente salas permanentes do Google Agenda (Calendar) caso existam ou tenham sido configuradas previamente. Para que uma sala apareça:

1. Crie um evento **all-day** (dia inteiro) no Google Calendar
2. O nome do evento deve conter **"SALA INTERNA"** (ex: "SALA INTERNA 1 - Marketing")
3. O evento deve ter um **link do Google Meet** vinculado

As salas são sincronizadas via API — nenhum link fica exposto no código fonte.

## Segurança

- Somente leitura do calendário (scope `calendar.readonly`)
- Tokens com refresh automático (JWT strategy)
- Nenhum dado armazenado em banco — tudo é buscado em tempo real da API do Google
- Links de reunião sincronizados dinamicamente (nunca hardcoded)
- Middleware protege rotas autenticadas

## Desenvolvimento local

```bash
npm run dev     # Inicia em http://localhost:3000
npm run build   # Build de produção
npm run start   # Serve o build localmente
```

## Licença

MIT

## Autor

**Ary Ribeiro** — [@aryribeiro](https://github.com/aryribeiro) — [LinkedIn](https://www.linkedin.com/in/aryribeiro)
