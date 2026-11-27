# Prompt para o AI Studio — Tapioca Pay (camada de visual + segurança)

Aplique exatamente as alterações abaixo no projeto, sem remover nenhuma funcionalidade existente.

## 1. src/index.css
Substitua a linha `.bento-card { --mx: 50%; --my: 0%; overflow: hidden; }` por `.bento-card { --mx: 50%; --my: 0%; }` caso exista, e adicione ao FINAL do arquivo este bloco (inclui o ::after com `border-radius: inherit`):

```css

/* ===== Tapioca Motion & Polish layer ===== */
:root { --ease-out: cubic-bezier(0.22, 1, 0.36, 1); --tp-glow: rgba(140, 224, 44, 0.16); }

/* Spotlight hover (magicui-style) — any .bento-card follows the cursor */
.bento-card { --mx: 50%; --my: 0%; }
.bento-card::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  background: radial-gradient(360px circle at var(--mx) var(--my), var(--tp-glow), transparent 65%);
  transition: opacity 260ms var(--ease-out);
}
.bento-card:hover::after { opacity: 1; }
.bento-card:hover { transform: translateY(-2px); border-color: rgba(101, 201, 29, 0.45); }

/* Aurora backdrop + film grain (reactbits-style ambience) */
.tp-aurora { position: fixed; inset: -20% -10% auto; height: 70vh; z-index: -1; pointer-events: none; filter: blur(80px); opacity: 0.55;
  background: radial-gradient(40% 50% at 20% 30%, rgba(140,224,44,.35), transparent 70%),
              radial-gradient(35% 45% at 75% 20%, rgba(11,19,15,.25), transparent 70%);
  animation: tp-drift 18s ease-in-out infinite alternate; }
.dark .tp-aurora { opacity: 0.35; }
.tp-grain::before { content: ''; position: fixed; inset: 0; z-index: 50; pointer-events: none; opacity: .035; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }

/* Entrance choreography: add .tp-reveal to children, stagger with --i */
.tp-reveal { opacity: 0; transform: translateY(14px) scale(.985); animation: tp-rise 640ms var(--ease-out) forwards; animation-delay: calc(var(--i, 0) * 70ms); }

/* Shimmer skeleton, animated border, marquee, live pulse */
.tp-skeleton { background: linear-gradient(100deg, var(--tp-hairline) 30%, var(--tp-surface) 50%, var(--tp-hairline) 70%); background-size: 200% 100%; animation: tp-shimmer 1.4s linear infinite; border-radius: 12px; }
.tp-border-beam { position: relative; }
.tp-border-beam::before { content: ''; position: absolute; inset: 0; padding: 1.5px; border-radius: inherit; pointer-events: none;
  background: conic-gradient(from var(--a, 0deg), transparent 70%, #8CE02C 85%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  animation: tp-spin 5s linear infinite; }
@property --a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
.tp-marquee { display: flex; gap: 2rem; width: max-content; animation: tp-marquee 28s linear infinite; }
.tp-marquee:hover { animation-play-state: paused; }
.tp-live::after { content: ''; display: inline-block; width: 7px; height: 7px; margin-left: 8px; border-radius: 99px; background: #65C91D; box-shadow: 0 0 0 0 rgba(101,201,29,.6); animation: tp-ping 1.8s infinite; }

/* Press feedback, focus, mobile safe areas */
button, [role='button'] { transition: transform 160ms var(--ease-out), box-shadow 200ms var(--ease-out), background-color 200ms; }
button:active:not(:disabled) { transform: scale(.97); }
:focus-visible { outline: 2px solid #65C91D; outline-offset: 3px; border-radius: 10px; }
@media (max-width: 768px) { body { padding-bottom: env(safe-area-inset-bottom); } .bento-card:hover { transform: none; } }

@keyframes tp-rise { to { opacity: 1; transform: none; } }
@keyframes tp-shimmer { to { background-position: -200% 0; } }
@keyframes tp-spin { to { --a: 360deg; } }
@keyframes tp-marquee { to { transform: translateX(-50%); } }
@keyframes tp-drift { to { transform: translate3d(4%, 6%, 0) scale(1.1); } }
@keyframes tp-ping { 70% { box-shadow: 0 0 0 9px rgba(101,201,29,0); } 100% { box-shadow: 0 0 0 0 rgba(101,201,29,0); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } .tp-reveal { opacity: 1; transform: none; } }

/* Auto-stagger: add .tp-stagger to any view root */
.tp-stagger > * { opacity: 0; animation: tp-rise 640ms var(--ease-out) forwards; }
.tp-stagger > *:nth-child(1) { animation-delay: 70ms; }
.tp-stagger > *:nth-child(2) { animation-delay: 140ms; }
.tp-stagger > *:nth-child(3) { animation-delay: 210ms; }
.tp-stagger > *:nth-child(4) { animation-delay: 280ms; }
.tp-stagger > *:nth-child(5) { animation-delay: 350ms; }
.tp-stagger > *:nth-child(6) { animation-delay: 420ms; }
.tp-stagger > *:nth-child(7) { animation-delay: 490ms; }
.tp-stagger > *:nth-child(8) { animation-delay: 560ms; }
@media (prefers-reduced-motion: reduce) { .tp-stagger > * { opacity: 1; } }
```

## 2. src/main.tsx
Adicione ao final do arquivo:

```ts
document.addEventListener('pointermove', (e) => {
  const c = (e.target as HTMLElement)?.closest?.('.bento-card') as HTMLElement | null;
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
});
```

## 3. src/App.tsx
No div raiz (`min-h-screen bg-[#F7F8F7] dark:bg-[#060807] ... flex flex-col lg:flex-row`), adicione as classes `tp-grain relative` e, como primeiro filho, `<div aria-hidden="true" className="tp-aurora" />`.

## 4. Telas
- Em CardsPluggyView, CashFlowReportsView e SavingsGoalsView, troque o wrapper `className="space-y-6 animate-enter"` por `className="tp-stagger space-y-6"`.
- Em todo card com `rounded-2xl` ou `rounded-3xl` + `bg-white dark:bg-[#0D1210]` + `border`, adicione a classe `bento-card` (se ainda não tiver).

## 5. Segurança (obrigatório)
- Em server.ts, remova TODOS os valores fixos da Pluggy: o PLUGGY_API_KEY e PLUGGY_CONNECT_TOKEN usados como fallback, DEFAULT_PLUGGY_CLIENT_ID e DEFAULT_PLUGGY_CLIENT_SECRET (deixe string vazia). O app deve usar só process.env.
- Nunca escreva chaves, tokens ou secrets no código.
- Adicione `.cloudsql-mirror.json` ao .gitignore.

Depois me mostre o resumo do que mudou e confirme que o app compila.
