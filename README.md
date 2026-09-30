# Bracerum Park · Central Instagram

Automação de comentários no estilo ManyChat, própria do Bracerum Park.
Quem comenta a palavra-chave (ex.: **MAPA**) recebe o material em PDF no Direct, no idioma em que escreveu.

## Como funciona

1. A pessoa comenta **MAPA** em uma publicação.
2. O perfil responde publicamente no comentário (texto sorteado entre as variações cadastradas).
3. No Direct, chega uma mensagem com o botão **Receber o mapa**.
4. Ao tocar, ela recebe: o texto de apresentação, o **PDF anexado** e a pergunta de qualificação.
5. Se ela responder, a conversa fica com o time comercial. O sistema não responde mais nada automaticamente.

Regras aplicadas:

- **Idioma:** detectado no comentário (português ou espanhol). Sem sinal claro (ex.: só "MAPA"), vale o idioma padrão da automação.
- **Palavra-chave:** acentos, maiúsculas, pontuação e emojis são ignorados. "mapa", "Mapa!" e "MAPA 🙏" acionam igual.
- **Uma entrega por pessoa e por material:** quem já recebeu não recebe de novo.
- **Sem duplicidade:** eventos repetidos pela Meta não geram mensagens em dobro.
- **Botão:** se a conta não aceitar o botão nativo, o sistema usa resposta rápida. Se também não aceitar, envia texto pedindo que a pessoa responda.
- **PDF:** se o anexo falhar, o sistema envia um link curto rastreado (`/m/mapa`).
- **Modo "Link imediato"** (opcional por automação): o link do PDF segue já na primeira mensagem, sem o toque intermediário.

## Estrutura técnica

| Parte | Tecnologia |
|---|---|
| Aplicação e painel | Next.js na **Vercel** |
| Banco de dados | Postgres **Neon** (Vercel Marketplace, plano gratuito atende) |
| PDFs | **Vercel Blob** (até 25 MB por arquivo) |
| Domínio | subdomínio `instagram.bracerumpark.com.br`, com DNS na GoDaddy |
| Instagram | API oficial da Meta: Instagram API with Instagram Login |

O site atual na GoDaddy **não é alterado**. Apenas um registro DNS é criado para o subdomínio.

---

## Implantação: passo a passo

### 1. Publicar na Vercel

1. Envie esta pasta para um repositório no GitHub (privado).
2. Na Vercel: **Add New › Project**, importe o repositório. A estrutura Next.js é reconhecida automaticamente.
3. Ainda sem configurar variáveis, conclua o primeiro deploy.

### 2. Banco e armazenamento

No projeto da Vercel, em **Storage**:

1. **Create Database › Neon (Postgres)**. A variável `DATABASE_URL` é criada sozinha.
2. **Create › Blob**. A variável `BLOB_READ_WRITE_TOKEN` é criada sozinha.
3. Crie as tabelas, uma única vez, no seu computador:
   ```bash
   npm install
   DATABASE_URL="(copiar da Vercel)" npm run db:migrate
   ```

### 3. Variáveis de ambiente

Em **Settings › Environment Variables**, cadastre (modelo em `.env.example`):

| Variável | O que colocar |
|---|---|
| `ADMIN_PASSWORD` | senha do painel |
| `SESSION_SECRET` | texto longo e aleatório (ex.: `openssl rand -hex 32`) |
| `INSTAGRAM_APP_SECRET` | "Chave secreta do app do Instagram", no Painel da Meta |
| `IG_WEBHOOK_VERIFY_TOKEN` | uma palavra à sua escolha, repetida no passo 5 |
| `CRON_SECRET` | outro texto aleatório (renovação automática do token) |
| `PUBLIC_BASE_URL` | `https://instagram.bracerumpark.com.br` |
| `GRAPH_VERSION` | `v25.0` |

Faça um novo deploy após salvar.

### 4. Domínio (GoDaddy)

1. Na Vercel: **Settings › Domains › Add** › `instagram.bracerumpark.com.br`.
2. A Vercel mostra um registro **CNAME**. Na GoDaddy, em **DNS › Adicionar registro**:
   - Tipo: `CNAME` · Nome: `instagram` · Valor: o indicado pela Vercel (normalmente `cname.vercel-dns.com`).
3. Em alguns minutos o certificado HTTPS é emitido automaticamente.

### 5. Aplicativo na Meta

Em [developers.facebook.com](https://developers.facebook.com), com o Gerenciador de Negócios do Bracerum Park:

1. **Criar app** › tipo **Empresa**. Adicione o produto **Instagram** › **Configuração da API com login do Instagram**.
2. **Gerar token:** adicione a conta @bracerumpark e gere o token de acesso. Guarde-o para o passo 6.
3. **Webhooks:**
   - URL de retorno: `https://instagram.bracerumpark.com.br/api/webhooks/instagram`
   - Verificar token: o mesmo valor de `IG_WEBHOOK_VERIFY_TOKEN`
   - Assine os campos: `comments`, `messages`, `messaging_postbacks`
4. **Permissões** (solicitar acesso avançado na **Análise do app**):
   - `instagram_business_basic`
   - `instagram_business_manage_comments`
   - `instagram_business_manage_messages`
5. Informe a **URL da política de privacidade** (ex.: `bracerumpark.com.br/privacidade`) e coloque o app em modo **Ativo**.
6. No aplicativo do Instagram, na conta @bracerumpark: **Configurações › Mensagens e respostas ao story › Controles de mensagens › Ferramentas conectadas › Permitir acesso às mensagens**.

> **Enquanto a Meta não aprova a análise**, o sistema só responde a pessoas com função no app (administradores e testadores). Use esse período para testar com a sua conta pessoal.

### 6. Conectar e testar

1. Acesse `https://instagram.bracerumpark.com.br`, entre com a senha.
2. **Configurações** › cole o token › **Validar e salvar**.
3. **Automações › Nova automação › Mapa logístico** › anexe o PDF › **Salvar e ativar**.
4. Com uma conta de testador, comente **MAPA** em uma publicação e acompanhe em **Atividade**.

O token vale 60 dias e é renovado automaticamente toda segunda-feira. A validade aparece em Configurações.

---

## Operação

- **Modelos prontos:** MAPA, BOLETIM, TERRA, RESIDÊNCIA e RESORT, com os textos aprovados em português e espanhol.
- **Variáveis nos textos:** `{nome}` (primeiro nome ou @) e `{link}` (onde o PDF entra; o texto antes vai primeiro, o restante depois).
- **Limites do Instagram:** botão com até 20 caracteres; mensagens com até 1.000 caracteres; a resposta privada precisa sair em até 7 dias do comentário (o sistema responde em segundos).
- **Atividade:** cada comentário captado, idioma, situação da entrega, aberturas do link e registro técnico de falhas.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencher
npm run dev                  # http://localhost:3000
npm test                     # testes de palavra-chave, idioma e textos
```

Webhooks da Meta exigem HTTPS público. Para testar localmente, use a URL de produção ou um túnel (ex.: `cloudflared`).
