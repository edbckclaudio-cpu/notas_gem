This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Passo a passo (GitHub → Vercel)

1. Acesse https://vercel.com/new e clique em "Import Project".
2. Conecte o repositório GitHub `edbckclaudio-cpu/notas_gem`.
3. Framework: Next.js (detectado automaticamente). Build: `next build`. Output: automático.
4. Configure variáveis de ambiente em "Settings → Environment Variables":
   - `RESEND_API_KEY`: sua chave da Resend
   - `FROM_EMAIL`: remetente (ex.: `onboarding@resend.dev` ou seu domínio verificado)
5. Clique em "Deploy". Após o build, o projeto ficará acessível em um domínio `.vercel.app`.

Observações:
- As rotas de API usam runtime Node.js (definido em cada arquivo via `export const runtime = "nodejs";`).
- Para melhor entregabilidade de e-mails, verifique seu domínio na Resend e configure SPF/DKIM/DMARC.

### Alternativa: Deploy via Docker

Caso prefira rodar em sua própria infraestrutura:

1. Gere o build localmente: `npm run build`
2. Suba com Docker (exemplo genérico):

```Dockerfile
# Dockerfile exemplo
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm","run","start"]
```

3. Passe as variáveis `RESEND_API_KEY` e `FROM_EMAIL` no ambiente do container.

### Scripts úteis
- `npm run build` → build de produção
- `npm run start` → inicia servidor de produção
- `npm run dev` → desenvolvimento
