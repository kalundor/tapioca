import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, type FunctionDeclaration } from '@google/genai';
import { PluggyClient } from 'pluggy-sdk';
import path from 'path';
import * as dotenv from 'dotenv';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  DEFAULT_DEMO_UID,
  getFullWorkspaceData,
  createBillRecord,
  toggleBillPaidStatus,
  deleteBillRecord,
  updateProfileSettings,
  createOrContributeSavingsGoal,
  syncPluggyOpenFinance,
  saveRealPluggyItemData,
  disconnectPluggySlot,
  clearDemoWorkspaceData,
} from './src/db/repository.ts';
import {
  calculateHouseSplit,
  calculatePredictedBalance,
  calculateHousingBenchmark,
  formatBRL,
} from './src/utils/financeMath.ts';

dotenv.config();

// Server-side Pluggy API Key & Connect Token (configured exclusively via process.env)
let runtimePluggyApiKey = (process.env.PLUGGY_API_KEY || '').trim();
let runtimePluggyConnectToken = (process.env.PLUGGY_CONNECT_TOKEN || '').trim();

const DEFAULT_PLUGGY_CLIENT_ID = '';
const DEFAULT_PLUGGY_CLIENT_SECRET = '';
const DEFAULT_PLUGGY_ITEM_IDS = [
  '33115539-9017-4732-b3d2-4d23c9caa164', // Banco Santander Pessoa Física
  '7982b3e3-d73a-49f1-bc68-dbf48c8e55a6', // Nubank (Nu Pagamentos S.A. + Cartão Gold + CDB)
  '3c8b3fca-d92e-47cb-bcb0-04a301b29920', // Banco Inter (Conta Corrente + Cartão Gold + CDB)
];

function hasEnvPluggyClientCredentials(): { clientId: string; clientSecret: string } | null {
  const rawClientId = (process.env.CLIENT_ID || process.env.PLUGGY_CLIENT_ID || '').trim();
  const rawClientSecret = (process.env.CLIENT_SECRET || process.env.PLUGGY_CLIENT_SECRET || '').trim();

  const clientId =
    rawClientId &&
    rawClientId !== 'YOUR_PLUGGY_CLIENT_ID' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawClientId)
      ? rawClientId
      : DEFAULT_PLUGGY_CLIENT_ID;
  const clientSecret =
    rawClientSecret &&
    rawClientSecret !== 'YOUR_PLUGGY_CLIENT_SECRET' &&
    rawClientSecret.startsWith('pluggy_sk_')
      ? rawClientSecret
      : DEFAULT_PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

async function resolvePluggyApiKey(): Promise<string> {
  const creds = hasEnvPluggyClientCredentials();
  if (creds) {
    try {
      const authRes = await fetch('https://api.pluggy.ai/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
        }),
      });
      if (authRes.ok) {
        const data = (await authRes.json()) as { apiKey?: string };
        if (data.apiKey) {
          runtimePluggyApiKey = data.apiKey;
          return data.apiKey;
        }
      }
    } catch {
      // Fallback to env-provided runtimePluggyApiKey if auth call fails
    }
  }
  return runtimePluggyApiKey;
}

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function buildPtBrFinancialSystemPrompt(uid: string, email: string): Promise<{
  prompt: string;
  summaryMetrics: {
    predictedLeftover: number;
    totalHouseBills: number;
    pixSettlementAmount: number;
    housingCostSolo: number;
    totalPayable: number;
  };
}> {
  const data = await getFullWorkspaceData(uid, email);
  const predicted = calculatePredictedBalance(data.profile, data.bills);
  const houseSplit = calculateHouseSplit(data.bills);
  const housing = calculateHousingBenchmark(data.profile, data.bills, 'solo');
  const payableBills = data.bills
    .filter((b) => b.paidBy === 'user' && b.dueDay >= 5)
    .slice(0, 8);
  const totalPayable = payableBills.reduce((acc, b) => acc + b.amount, 0);

  const goalsSummary = (data.savingsGoals || [])
    .map(
      (g) =>
        `- [ID ${g.id}] ${g.title}: R$ ${formatBRL(g.currentAmount)} de R$ ${formatBRL(
          g.targetAmount
        )} (aporte R$ ${formatBRL(g.monthlyContribution)}/mês)`
    )
    .join('\n');

  const cardsSummary = (data.creditCards || [])
    .map(
      (c) =>
        `- ${c.name}: fatura/saldo R$ ${formatBRL(c.currentInvoice)}, limite livre R$ ${formatBRL(
          c.availableLimit
        )}, vence ${c.dueDate}`
    )
    .join('\n');

  const txSummary = (data.transactions || [])
    .slice(0, 10)
    .map(
      (t) =>
        `- ${t.date} | ${t.description} | R$ ${formatBRL(t.amount)} | ${t.accountName} (${t.category})`
    )
    .join('\n');

  const billsSummary = data.bills
    .map(
      (b) =>
        `- [ID ${b.id}] ${b.title}: R$ ${formatBRL(b.amount)} (vence dia ${b.dueDay}, ${
          b.isShared ? 'Casa 50/50' : 'Individual'
        }, pago por ${b.paidBy === 'user' ? data.profile.displayName : data.profile.partnerName}, ${
          b.isPaid ? 'PAGA' : 'EM ABERTO'
        })`
    )
    .join('\n');

  const nowRioDate = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const prompt = `Você é o Copiloto Financeiro Inteligente do Tapioca Pay, falando sempre em Português do Brasil (PT-BR) com clareza, precisão numérica e tom executivo acolhedor.
Localização e Fuso Horário de referência do usuário: Rio de Janeiro / Brasil (GMT-3, Horário de Brasília). Data e hora atual: ${nowRioDate}.
Você está conectado em tempo real às 2 contas Open Finance da Pluggy do casal (${data.profile.displayName} — Titular e ${data.profile.partnerName} — Namorada):
- Entradas líquidas de ${data.profile.displayName}: R$ ${formatBRL(predicted.salary)}
- Entradas líquidas de ${data.profile.partnerName} (Namorada): R$ ${formatBRL(data.profile.partnerSalary || 0)}
- Orçamento dia a dia: R$ ${formatBRL(data.profile.dayToDayBudget)}
- Saldo Previsto Livre (Sobra após contas e orçamento): R$ ${formatBRL(predicted.predictedLeftover)} (${predicted.predictedLeftoverPct}% livre)
- Divisão da Casa 50/50 (Total): R$ ${formatBRL(houseSplit.totalHouseBills)} (${data.profile.displayName} pagou R$ ${formatBRL(houseSplit.userPaidTotal)} | ${data.profile.partnerName} pagou R$ ${formatBRL(houseSplit.partnerPaidTotal)})
- Acerto Pix da Casa: ${
    data.profile.pixSettled
      ? 'QUITADO neste mês'
      : `${
          houseSplit.whoOwesWhom === 'partner_owes_user'
            ? `${data.profile.partnerName} deve transferir R$ ${formatBRL(houseSplit.pixSettlementAmount)} para ${data.profile.displayName}`
            : `${data.profile.displayName} deve transferir R$ ${formatBRL(houseSplit.pixSettlementAmount)} para ${data.profile.partnerName}`
        }`
  }
- Custo de Moradia Individual: R$ ${formatBRL(housing.userHousingCost)} (${housing.housingPctOfSalary}% da renda; ideal <= 30%).
- Contas a Pagar: R$ ${formatBRL(totalPayable)}.

Contas e despesas monitoradas:
${billsSummary || 'Nenhuma conta cadastrada no momento.'}

Cartões & Contas Pluggy:
${cardsSummary || 'Nenhum cartão sincronizado.'}

Reservas & Metas CDB:
${goalsSummary || 'Nenhuma meta cadastrada.'}

Últimas movimentações Pluggy:
${txSummary || 'Sem movimentações recentes.'}

Diretrizes de comportamento:
1. Responda SEMPRE em Português do Brasil (PT-BR).
2. Cite números exatos em Reais (R$) com vírgula decimal brasileira com base nos dados reais acima.
3. Quando o usuário pedir para criar despesa/conta, marcar conta como paga, quitar/reabrir Pix 50/50, criar meta de economia, aportar em meta, ajustar renda/orçamento ou abrir uma tela do app, CHAME a função (tool) correspondente imediatamente antes de responder.
4. Para chats de texto, organize resumos de forma limpa com quebras de linha objetivas e sem excesso de jargões técnicos.`;

  return {
    prompt,
    summaryMetrics: {
      predictedLeftover: predicted.predictedLeftover,
      totalHouseBills: houseSplit.totalHouseBills,
      pixSettlementAmount: houseSplit.pixSettlementAmount,
      housingCostSolo: housing.userHousingCost,
      totalPayable,
    },
  };
}

async function resolveUidAndEmail(req: express.Request): Promise<{ uid: string; email: string }> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email || 'alanpires.contato@gmail.com',
      };
    } catch {
      // Fallback to default workspace if token is expired or demo
    }
  }
  return {
    uid: DEFAULT_DEMO_UID,
    email: 'alanpires.contato@gmail.com',
  };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // Strictly authenticated route for signed-in Firebase users
  app.get('/api/user/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'alanpires.contato@gmail.com';
      const data = await getFullWorkspaceData(uid, email);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch authenticated workspace:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch workspace' });
    }
  });

  // Workspace route (uses authenticated UID if signed in, or default Cloud SQL workspace)
  app.get('/api/workspace', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const data = await getFullWorkspaceData(uid, email);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch workspace:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch workspace' });
    }
  });

  // Clear all pre-populated sample/demo data so user sees ONLY real Pluggy data and their own bills
  app.post('/api/workspace/clear-demo', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const cleared = await clearDemoWorkspaceData(uid, email);
      res.json(cleared);
    } catch (error: any) {
      console.error('Failed to clear demo workspace:', error);
      res.status(500).json({ error: error.message || 'Failed to clear demo data' });
    }
  });

  app.post('/api/bills', async (req, res) => {
    try {
      const { uid } = await resolveUidAndEmail(req);
      const { title, amount, dueDay, category, isHousingCost, paidBy, isShared, iconType } = req.body;
      if (!title || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Informe um título válido e valor maior que zero.' });
      }
      const created = await createBillRecord(uid, {
        title: String(title).trim(),
        amount: Number(amount),
        dueDay: Number(dueDay) || 5,
        category: category || 'house',
        isHousingCost: Boolean(isHousingCost),
        paidBy: paidBy || 'user',
        isShared: Boolean(isShared),
        iconType: iconType || 'receipt',
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create bill:', error);
      res.status(500).json({ error: error.message || 'Failed to create bill' });
    }
  });

  app.patch('/api/bills/:id', async (req, res) => {
    try {
      const { uid } = await resolveUidAndEmail(req);
      const billId = Number(req.params.id);
      const { isPaid } = req.body;
      const updated = await toggleBillPaidStatus(uid, billId, Boolean(isPaid));
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update bill:', error);
      res.status(500).json({ error: error.message || 'Failed to update bill' });
    }
  });

  app.delete('/api/bills/:id', async (req, res) => {
    try {
      const { uid } = await resolveUidAndEmail(req);
      const billId = Number(req.params.id);
      const result = await deleteBillRecord(uid, billId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete bill:', error);
      res.status(500).json({ error: error.message || 'Failed to delete bill' });
    }
  });

  app.patch('/api/profile', async (req, res) => {
    try {
      const { uid } = await resolveUidAndEmail(req);
      const updated = await updateProfileSettings(uid, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  });

  app.post('/api/goals', async (req, res) => {
    try {
      const { uid } = await resolveUidAndEmail(req);
      const result = await createOrContributeSavingsGoal(uid, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to update savings goal:', error);
      res.status(500).json({ error: error.message || 'Failed to update savings goal' });
    }
  });

  // Server-side Pluggy Connect Token Endpoint
  app.post('/api/connect-token', async (req, res) => {
    try {
      const { clientUserId, itemId, apiKey: customApiKey, connectToken: customConnectToken } =
        req.body || {};
      if (customApiKey && String(customApiKey).startsWith('eyJ')) {
        runtimePluggyApiKey = String(customApiKey).trim();
      }
      if (customConnectToken && String(customConnectToken).startsWith('eyJ')) {
        runtimePluggyConnectToken = String(customConnectToken).trim();
      }

      const { email } = await resolveUidAndEmail(req);
      const effectiveClientUserId = clientUserId || email || 'alanpires.contato@gmail.com';

      const creds = hasEnvPluggyClientCredentials();
      if (creds) {
        const pluggy = new PluggyClient({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
        });

        const connectToken = await pluggy.createConnectToken(itemId || undefined, {
          clientUserId: effectiveClientUserId,
        });

        return res.json({ accessToken: connectToken.accessToken });
      }

      const apiKey = await resolvePluggyApiKey();
      if (apiKey) {
        const tokenResp = await fetch('https://api.pluggy.ai/connect_token', {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(itemId ? { itemId } : {}),
            options: { clientUserId: effectiveClientUserId },
          }),
        });

        if (tokenResp.ok) {
          const tokenData = (await tokenResp.json()) as { accessToken?: string };
          if (tokenData.accessToken) {
            return res.json({ accessToken: tokenData.accessToken });
          }
        }
      }

      if (runtimePluggyConnectToken) {
        return res.json({ accessToken: runtimePluggyConnectToken });
      }

      return res.status(400).json({
        error:
          'Configure CLIENT_ID e CLIENT_SECRET reais da Pluggy no process.env para gerar o Connect Token.',
        missingCredentials: true,
      });
    } catch (error: any) {
      console.error('Failed to create Pluggy Connect Token:', error);
      return res.status(500).json({
        error: error.message || 'Falha ao gerar Connect Token na API da Pluggy.',
      });
    }
  });

  // Helper to sync a single Pluggy itemId into the user's workspace using /v2/transactions and /investments
  const syncSinglePluggyItem = async (
    uid: string,
    itemId: string,
    owner: 'user' | 'partner' = 'user'
  ) => {
    const cleanId = String(itemId).trim();
    const apiKey = await resolvePluggyApiKey();
    if (!apiKey) {
      throw new Error(
        'Não foi possível autenticar na API da Pluggy com o CLIENT_ID e CLIENT_SECRET informados.'
      );
    }

    const headers = {
      'X-API-KEY': apiKey,
      Accept: 'application/json',
    };

    const itemRes = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(cleanId)}`, {
      headers,
    });
    if (!itemRes.ok) {
      const errBody = await itemRes.text();
      throw new Error(
        `Não foi possível consultar o item ${cleanId} na Pluggy API (${itemRes.status}): ${errBody}`
      );
    }
    const itemData = (await itemRes.json()) as any;
    let institutionName = itemData?.connector?.name || 'Instituição Open Finance';

    const accRes = await fetch(
      `https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(cleanId)}`,
      { headers }
    );
    let accounts: any[] = [];
    if (accRes.ok) {
      const accJson = (await accRes.json()) as any;
      accounts = accJson?.results || [];
    }

    // Derive real bank name when connector is MeuPluggy
    const bankAccount = accounts.find((a) => a.type === 'BANK') || accounts[0];
    if (
      (!institutionName || institutionName === 'MeuPluggy') &&
      bankAccount?.name
    ) {
      const rawBankName = String(bankAccount.name);
      if (rawBankName.toLowerCase().includes('santander')) {
        institutionName = 'Banco Santander PF';
      } else if (rawBankName.toLowerCase().includes('nu pagamentos') || rawBankName.toLowerCase().includes('nubank')) {
        institutionName = 'Nubank';
      } else if (rawBankName.toLowerCase().includes('inter')) {
        institutionName = 'Banco Inter';
      } else {
        institutionName = rawBankName;
      }
    }

    // Fetch real investments (CDBs / RDBs)
    let investments: any[] = [];
    try {
      const invRes = await fetch(
        `https://api.pluggy.ai/investments?itemId=${encodeURIComponent(cleanId)}`,
        { headers }
      );
      if (invRes.ok) {
        const invJson = (await invRes.json()) as any;
        investments = invJson?.results || [];
      }
    } catch {
      // Continue if no investments
    }

    const allTransactions: Array<{
      id: string;
      description: string;
      merchant?: string;
      amount: number;
      type?: string;
      category?: string;
      date: string;
      accountName: string;
    }> = [];

    for (const acc of accounts) {
      try {
        const txRes = await fetch(
          `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(acc.id)}`,
          { headers }
        );
        if (txRes.ok) {
          const txJson = (await txRes.json()) as any;
          const accLabel =
            acc.type === 'CREDIT'
              ? `${institutionName} (${acc.name.toUpperCase()})`
              : institutionName;
          for (const tx of txJson?.results || []) {
            allTransactions.push({
              id: tx.id,
              description: tx.description || tx.descriptionRaw || 'Transação Open Finance',
              merchant: tx.merchant?.name || institutionName,
              amount: Number(tx.amount),
              type: tx.type,
              category: tx.category || 'Open Finance Pluggy',
              date: tx.date
                ? new Date(tx.date).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10),
              accountName: accLabel,
            });
          }
        }
      } catch {
        // Continue if an account has no transactions yet
      }
    }

    return await saveRealPluggyItemData(uid, {
      itemId: cleanId,
      institutionName,
      owner,
      accounts: accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balance: Number(a.balance || 0),
        creditData: a.creditData || null,
      })),
      investments: investments.map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        balance: Number(inv.balance || 0),
        type: inv.type,
        subtype: inv.subtype,
        rate: inv.rate ?? null,
        rateType: inv.rateType ?? null,
        dueDate: inv.dueDate ?? null,
        issuer: inv.issuer ?? null,
      })),
      transactions: allTransactions,
    });
  };

  // Track received webhook items in memory as well as persisting to DB
  const receivedPluggyItemIds = new Set<string>(DEFAULT_PLUGGY_ITEM_IDS);

  // Pluggy Webhook Receiver (automatically imports items when Pluggy fires item/created, item/updated, transactions/created)
  app.post('/api/pluggy/webhook', async (req, res) => {
    try {
      const { itemId, event } = req.body || {};
      console.log(`[Pluggy Webhook] event=${event} itemId=${itemId}`);
      if (itemId) {
        receivedPluggyItemIds.add(String(itemId));
        await syncSinglePluggyItem(DEFAULT_DEMO_UID, String(itemId));
      }
      return res.status(200).json({ received: true, itemId, event });
    } catch (err: any) {
      console.error('Pluggy webhook processing error:', err);
      return res.status(200).json({ received: true, error: err.message });
    }
  });

  // Pluggy Open Finance Reception Status Endpoint
  app.get('/api/pluggy/status', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const data = await getFullWorkspaceData(uid, email);
      const realTransactions = data.transactions.filter((t) => t.source === 'pluggy_live');
      const realCards = data.creditCards.filter(
        (c) =>
          c.pluggyItemId &&
          !['pluggy_santander_unique_01', 'pluggy_itau_pers_02', 'pluggy_nubank_uv_03'].includes(
            c.pluggyItemId
          )
      );
      return res.json({
        credentialsActive: Boolean(hasEnvPluggyClientCredentials()),
        receivedItemIds: Array.from(receivedPluggyItemIds),
        realCardsCount: realCards.length,
        realTransactionsCount: realTransactions.length,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Real Pluggy Item Sync Endpoint (supports slot owner 'user' | 'partner' and 1 or multiple itemIds)
  app.post('/api/pluggy/sync-item', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const { itemId, itemIds, owner } = req.body || {};
      const slotOwner: 'user' | 'partner' = owner === 'partner' ? 'partner' : 'user';

      let listToSync: Array<{ id: string; owner: 'user' | 'partner' }> = [];

      if (Array.isArray(itemIds) && itemIds.length > 0) {
        listToSync = itemIds
          .map((entry: any) =>
            typeof entry === 'string'
              ? { id: entry.trim(), owner: slotOwner }
              : {
                  id: String(entry?.itemId || entry?.id || '').trim(),
                  owner: entry?.owner === 'partner' ? ('partner' as const) : ('user' as const),
                }
          )
          .filter((x) => Boolean(x.id));
      } else if (itemId) {
        const parsed = String(itemId)
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        listToSync = parsed.map((id) => ({ id, owner: slotOwner }));
      } else {
        const workspace = await getFullWorkspaceData(uid, email);
        const connectedSlots = (workspace.pluggyConnections || []).filter(
          (c) => c.itemId && c.status === 'connected'
        );
        listToSync =
          connectedSlots.length > 0
            ? connectedSlots.map((c) => ({ id: c.itemId!, owner: c.slot }))
            : [{ id: DEFAULT_PLUGGY_ITEM_IDS[1], owner: 'user' }];
      }

      let totalAccounts = 0;
      let totalTransactions = 0;
      let totalInvestments = 0;
      const institutions: string[] = [];

      for (const target of listToSync) {
        const summary = await syncSinglePluggyItem(uid, target.id, target.owner);
        receivedPluggyItemIds.add(target.id);
        totalAccounts += summary.importedAccounts;
        totalInvestments += summary.importedInvestments || 0;
        totalTransactions += summary.importedTransactions;
        institutions.push(summary.institutionName);
      }

      return res.json({
        status: 'connected_live_api',
        importedItems: listToSync.length,
        importedAccounts: totalAccounts,
        importedInvestments: totalInvestments,
        importedTransactions: totalTransactions,
        institutionName: institutions.join(', '),
        owner: slotOwner,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Pluggy sync-item error:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao importar dados reais do item Pluggy.',
      });
    }
  });

  // Disconnect one of the 2 couple Pluggy slots ('user' = Alan, 'partner' = Larissa Namorada)
  app.post('/api/pluggy/disconnect', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const slot = req.body?.slot === 'partner' ? 'partner' : 'user';
      const updated = await disconnectPluggySlot(uid, slot, email);
      return res.json({
        disconnectedSlot: slot,
        pluggyConnections: updated.pluggyConnections,
      });
    } catch (error: any) {
      console.error('Pluggy disconnect error:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao desconectar conta Pluggy.',
      });
    }
  });

  // Pluggy Open Finance Integration Endpoint
  app.post('/api/pluggy/sync', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const { institutionName, itemId, slot } = req.body || {};
      const targetSlot: 'user' | 'partner' = slot === 'partner' ? 'partner' : 'user';

      if (itemId && /^[0-9a-f-]{36}$/i.test(String(itemId))) {
        try {
          const summary = await syncSinglePluggyItem(uid, String(itemId), targetSlot);
          return res.json({
            status: 'connected_live_api',
            summary,
            syncedAt: new Date().toISOString(),
          });
        } catch {
          // Fall back to timestamp reconciliation if Pluggy API is temporarily unreachable
        }
      }

      const workspace = await getFullWorkspaceData(uid, email);
      const slotInfo = workspace.pluggyConnections?.find((c) => c.slot === targetSlot);
      const syncResult = await syncPluggyOpenFinance(
        uid,
        institutionName || slotInfo?.institutionName || 'Pluggy Open Finance',
        targetSlot
      );
      return res.json({
        status: 'connected_live_api',
        ...syncResult,
      });
    } catch (error: any) {
      console.error('Pluggy Open Finance sync failed:', error);
      res.status(500).json({ error: error.message || 'Pluggy sync failed' });
    }
  });

  const copilotToolDeclarations: FunctionDeclaration[] = [
    {
      name: 'create_bill',
      description: 'Cria uma nova conta, despesa fixa ou lançamento financeiro no Tapioca Pay.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Nome ou descrição da conta ou despesa' },
          amount: { type: Type.NUMBER, description: 'Valor em Reais (BRL), ex: 145.90' },
          dueDay: { type: Type.NUMBER, description: 'Dia do vencimento (1 a 31), padrão 10' },
          category: {
            type: Type.STRING,
            description: "'house' para despesa do casal/casa ou 'personal' para individual",
          },
          paidBy: {
            type: Type.STRING,
            description: "'user' se pago por Alan ou 'partner' se pago por Larissa",
          },
          isShared: {
            type: Type.BOOLEAN,
            description: 'true se a despesa entra na divisão 50/50 do casal',
          },
          isHousingCost: {
            type: Type.BOOLEAN,
            description: 'true se é gasto essencial de moradia/casa',
          },
        },
        required: ['title', 'amount'],
      },
    },
    {
      name: 'toggle_bill_paid',
      description: 'Marca uma conta existente como paga (true) ou pendente/em aberto (false).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          billTitleQuery: { type: Type.STRING, description: 'Parte do nome da conta para localizar' },
          billId: { type: Type.NUMBER, description: 'ID numérico exato da conta, se conhecido' },
          isPaid: { type: Type.BOOLEAN, description: 'true para paga, false para pendente' },
        },
        required: ['isPaid'],
      },
    },
    {
      name: 'settle_pix',
      description: 'Marca ou desmarca o acerto Pix 50/50 da casa entre Alan e Larissa como quitado.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          settled: { type: Type.BOOLEAN, description: 'true para quitado, false para pendente' },
        },
        required: ['settled'],
      },
    },
    {
      name: 'create_savings_goal',
      description: 'Cria uma nova meta de reserva financeira ou caixinha CDB no Tapioca Pay.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Título da meta' },
          targetAmount: { type: Type.NUMBER, description: 'Valor alvo em Reais' },
          monthlyContribution: { type: Type.NUMBER, description: 'Aporte mensal planejado em Reais' },
          category: { type: Type.STRING, description: 'Categoria da meta' },
          deadline: { type: Type.STRING, description: 'Prazo estimado (ex: Dezembro 2027)' },
        },
        required: ['title', 'targetAmount'],
      },
    },
    {
      name: 'contribute_goal',
      description: 'Registra um aporte financeiro em uma meta/caixinha de reserva existente.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          goalTitleQuery: { type: Type.STRING, description: 'Parte do nome da meta ou CDB' },
          goalId: { type: Type.NUMBER, description: 'ID da meta, se conhecido' },
          amount: { type: Type.NUMBER, description: 'Valor do aporte em Reais' },
        },
        required: ['amount'],
      },
    },
    {
      name: 'update_budget_income',
      description: 'Atualiza o salário de Alan, salário de Larissa ou orçamento livre dia a dia.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          userSalary: { type: Type.NUMBER, description: 'Nova renda líquida mensal de Alan em R$' },
          partnerSalary: { type: Type.NUMBER, description: 'Nova renda líquida mensal de Larissa em R$' },
          dayToDayBudget: { type: Type.NUMBER, description: 'Novo orçamento livre mensal em R$' },
        },
      },
    },
    {
      name: 'navigate_app',
      description: 'Abre uma tela específica do Tapioca Pay para o usuário visualizar.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          section: {
            type: Type.STRING,
            description: "Uma das telas: 'overview', 'cards', 'cashflow', 'savings', 'house', 'income', 'workspace'",
          },
        },
        required: ['section'],
      },
    },
  ];

  // Transcribe user microphone voice notes using Gemini 3.5 Transcribe
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error: 'GEMINI_API_KEY não configurada no servidor para transcrição de áudio.',
        });
      }

      const audioBase64 = String(req.body?.audioBase64 || '').trim();
      const mimeType = String(req.body?.mimeType || 'audio/webm').trim();
      if (!audioBase64) {
        return res.status(400).json({ error: 'Áudio vazio enviado para transcrição.' });
      }

      const ai = getGenAI();
      const transcriptionRes = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcreva com precisão em Português do Brasil (PT-BR) exatamente o que foi falado neste áudio, preservando valores em reais e nomes próprios (como Alan, Larissa, Nubank, Inter, Santander, Tapioca Pay). Retorne apenas a transcrição.',
            },
          ],
        },
      });

      const transcript = (transcriptionRes.text || '').trim();
      return res.json({ transcript });
    } catch (error: any) {
      console.error('Gemini audio transcribe error:', error);
      return res.status(500).json({
        error: error?.message || 'Erro ao transcrever nota de áudio com Gemini.',
      });
    }
  });

  // Multi-turn Gemini 4 Hydrogen Copilot Chat with real Function Calling execution
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const message = String(req.body?.message || '').trim();
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const withAudio = Boolean(req.body?.withAudio);

      if (!message) {
        return res.status(400).json({ error: 'Envie uma mensagem ou comando para o Copiloto.' });
      }

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error: 'Chave GEMINI_API_KEY não configurada no servidor.',
        });
      }

      const { prompt } = await buildPtBrFinancialSystemPrompt(uid, email);
      const ai = getGenAI();

      const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = history
        .slice(-10)
        .filter((h: any) => h && typeof h.text === 'string' && h.text.trim().length > 0)
        .map((h: any) => ({
          role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        }));

      contents.push({ role: 'user', parts: [{ text: message }] });

      const generateCopilotContent = async (params: {
        contents: any;
        config: Record<string, any>;
      }) => {
        const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-4-argon'] as const;
        let lastErr: any = null;
        for (const modelName of modelsToTry) {
          try {
            return await ai.models.generateContent({
              model: modelName,
              contents: params.contents,
              config: params.config,
            });
          } catch (err: any) {
            lastErr = err;
            const status = Number(err?.status || 0);
            const msg = String(err?.message || '');
            if (status === 503 || status === 429 || msg.includes('503') || msg.includes('UNAVAILABLE')) {
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      };

      const firstResponse = await generateCopilotContent({
        contents,
        config: {
          systemInstruction: prompt,
          tools: [{ functionDeclarations: copilotToolDeclarations }],
        },
      });

      const executedActions: Array<{
        tool: string;
        label: string;
        detail: string;
      }> = [];
      let shouldRefreshWorkspace = false;
      let navigateToSection: string | null = null;

      const modelContent = firstResponse.candidates?.[0]?.content;
      const functionCalls = firstResponse.functionCalls || [];

      let finalReplyText = (firstResponse.text || '').trim();

      if (functionCalls.length > 0 && modelContent) {
        const workspaceBefore = await getFullWorkspaceData(uid, email);
        const functionResponseParts: Array<any> = [];

        for (const call of functionCalls) {
          const args: Record<string, any> = (call.args as any) || {};
          let toolResult: Record<string, any> = { ok: false };

          if (call.name === 'create_bill') {
            const title = String(args.title || 'Nova Despesa');
            const amount = Math.max(0.01, Number(args.amount || 0));
            const category = args.category === 'personal' ? 'personal' : 'house';
            const paidBy = args.paidBy === 'partner' ? 'partner' : 'user';
            const isShared = args.isShared !== undefined ? Boolean(args.isShared) : category === 'house';
            const isHousingCost =
              args.isHousingCost !== undefined ? Boolean(args.isHousingCost) : category === 'house';
            const dueDay = Math.min(31, Math.max(1, Number(args.dueDay || 10)));

            const created = await createBillRecord(uid, {
              title,
              amount,
              dueDay,
              category,
              isHousingCost,
              paidBy,
              isShared,
              iconType: category === 'house' ? 'building' : 'card',
            });
            shouldRefreshWorkspace = true;
            executedActions.push({
              tool: 'create_bill',
              label: `Lançamento criado: ${title}`,
              detail: `R$ ${formatBRL(amount)} · ${isShared ? 'Divisão 50/50' : 'Individual'}`,
            });
            toolResult = { ok: true, createdBill: created };
          } else if (call.name === 'toggle_bill_paid') {
            const targetId = Number(args.billId);
            const q = String(args.billTitleQuery || '').toLowerCase();
            const found =
              workspaceBefore.bills.find((b) => b.id === targetId) ||
              workspaceBefore.bills.find((b) => q && b.title.toLowerCase().includes(q));

            if (found) {
              const nextPaid = Boolean(args.isPaid);
              await toggleBillPaidStatus(uid, found.id, nextPaid);
              shouldRefreshWorkspace = true;
              executedActions.push({
                tool: 'toggle_bill_paid',
                label: nextPaid ? `Conta marcada como paga` : `Conta reaberta`,
                detail: `${found.title} (R$ ${formatBRL(found.amount)})`,
              });
              toolResult = { ok: true, bill: found.title, isPaid: nextPaid };
            } else {
              toolResult = { ok: false, error: 'Conta não encontrada na lista atual.' };
            }
          } else if (call.name === 'settle_pix') {
            const settled = Boolean(args.settled);
            await updateProfileSettings(uid, { pixSettled: settled });
            shouldRefreshWorkspace = true;
            executedActions.push({
              tool: 'settle_pix',
              label: settled ? 'Pix 50/50 quitado' : 'Pix 50/50 marcado em aberto',
              detail: settled ? 'Acerto da casa equilibrado' : 'Pendente para quitação',
            });
            toolResult = { ok: true, pixSettled: settled };
          } else if (call.name === 'create_savings_goal') {
            const title = String(args.title || 'Nova Reserva');
            const targetAmount = Math.max(10, Number(args.targetAmount || 1000));
            const monthlyContribution = Math.max(10, Number(args.monthlyContribution || 250));
            const category = String(args.category || 'Reserva Personalizada');
            const deadline = String(args.deadline || 'Dezembro 2027');

            const goal = await createOrContributeSavingsGoal(uid, {
              title,
              category,
              targetAmount,
              monthlyContribution,
              deadline,
            });
            shouldRefreshWorkspace = true;
            executedActions.push({
              tool: 'create_savings_goal',
              label: `Meta criada: ${title}`,
              detail: `Alvo R$ ${formatBRL(targetAmount)} · R$ ${formatBRL(monthlyContribution)}/mês`,
            });
            toolResult = { ok: true, goal };
          } else if (call.name === 'contribute_goal') {
            const targetId = Number(args.goalId);
            const q = String(args.goalTitleQuery || '').toLowerCase();
            const foundGoal =
              workspaceBefore.savingsGoals.find((g) => g.id === targetId) ||
              workspaceBefore.savingsGoals.find((g) => q && g.title.toLowerCase().includes(q)) ||
              workspaceBefore.savingsGoals[0];

            const amount = Math.max(1, Number(args.amount || 0));
            if (foundGoal) {
              const updatedGoal = await createOrContributeSavingsGoal(uid, {
                goalId: foundGoal.id,
                contributionAmount: amount,
              });
              shouldRefreshWorkspace = true;
              executedActions.push({
                tool: 'contribute_goal',
                label: `Aporte registrado em ${foundGoal.title}`,
                detail: `+ R$ ${formatBRL(amount)} adicionado à reserva`,
              });
              toolResult = { ok: true, goal: updatedGoal };
            } else {
              toolResult = { ok: false, error: 'Nenhuma meta encontrada.' };
            }
          } else if (call.name === 'update_budget_income') {
            const updates: Record<string, number> = {};
            if (args.userSalary !== undefined) updates.userSalary = Number(args.userSalary);
            if (args.partnerSalary !== undefined) updates.partnerSalary = Number(args.partnerSalary);
            if (args.dayToDayBudget !== undefined) updates.dayToDayBudget = Number(args.dayToDayBudget);
            const updatedProfile = await updateProfileSettings(uid, updates);
            shouldRefreshWorkspace = true;
            executedActions.push({
              tool: 'update_budget_income',
              label: 'Parâmetros de renda atualizados',
              detail: Object.entries(updates)
                .map(([k, v]) => `${k}: R$ ${formatBRL(v)}`)
                .join(' · '),
            });
            toolResult = { ok: true, profile: updatedProfile };
          } else if (call.name === 'navigate_app') {
            const validSections = new Set([
              'overview',
              'cards',
              'cashflow',
              'savings',
              'house',
              'income',
              'workspace',
            ]);
            const sec = String(args.section || 'overview');
            if (validSections.has(sec)) {
              navigateToSection = sec;
              executedActions.push({
                tool: 'navigate_app',
                label: `Abrindo tela: ${sec}`,
                detail: 'Navegação executada pelo Copiloto',
              });
              toolResult = { ok: true, navigatedTo: sec };
            } else {
              toolResult = { ok: false, error: 'Seção desconhecida.' };
            }
          }

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: toolResult,
            },
          });
        }

        const followUpPrompt = (await buildPtBrFinancialSystemPrompt(uid, email)).prompt;
        const secondResponse = await generateCopilotContent({
          contents: [
            ...contents,
            modelContent,
            { role: 'user', parts: functionResponseParts },
          ],
          config: {
            systemInstruction: followUpPrompt,
            tools: [{ functionDeclarations: copilotToolDeclarations }],
          },
        });
        finalReplyText = (secondResponse.text || '').trim();
      }

      if (!finalReplyText && executedActions.length > 0) {
        finalReplyText = executedActions.map((a) => `✓ ${a.label} (${a.detail})`).join('\n');
      }

      let audioBase64: string | null = null;
      if (withAudio && finalReplyText) {
        try {
          const ttsRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [{ parts: [{ text: finalReplyText.slice(0, 600) }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
            },
          });
          const inlineAudio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (inlineAudio) {
            audioBase64 = pcmToWav(Buffer.from(inlineAudio, 'base64'), 24000).toString('base64');
          }
        } catch (ttsErr) {
          console.warn('Copilot TTS optional skip:', ttsErr);
        }
      }

      const refreshed = await buildPtBrFinancialSystemPrompt(uid, email);

      return res.json({
        replyText: finalReplyText,
        executedActions,
        shouldRefreshWorkspace,
        navigateToSection,
        audioBase64,
        summaryMetrics: refreshed.summaryMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Gemini AI Copilot chat error:', error);
      const raw = String(error?.message || '');
      const isOverloaded =
        Number(error?.status) === 503 || raw.includes('503') || raw.includes('UNAVAILABLE');
      return res.status(isOverloaded ? 503 : 500).json({
        error: isOverloaded
          ? 'O modelo Gemini está com pico temporário de demanda (503). Tente novamente em instantes.'
          : raw || 'Erro ao processar solicitação no Copiloto Gemini.',
      });
    }
  });

  // Conversational Voice Endpoint in PT-BR grounded in Cloud SQL PostgreSQL
  app.post('/api/voice/converse', async (req, res) => {
    try {
      const { uid, email } = await resolveUidAndEmail(req);
      const userQuestion = String(req.body?.message || 'Qual é o resumo do meu saldo previsto em novembro?').trim();
      const { prompt, summaryMetrics } = await buildPtBrFinancialSystemPrompt(uid, email);

      let replyText = '';
      let audioBase64: string | null = null;

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error: 'GEMINI_API_KEY não configurada no servidor.',
        });
      }

      const ai = getGenAI();
      let textRes;
      try {
        textRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userQuestion,
          config: {
            systemInstruction: prompt,
          },
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
          textRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: userQuestion,
            config: {
              systemInstruction: prompt,
            },
          });
        } else {
          throw err;
        }
      }
      replyText = (textRes.text || '').trim();

      // Synthesize spoken PT-BR audio with gemini-3.8-flash-lite-tts
      if (replyText) {
        try {
          const ttsRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [{ parts: [{ text: replyText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
            },
          });
          const inlineAudio =
            ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (inlineAudio) {
            const pcmBuf = Buffer.from(inlineAudio, 'base64');
            const wavBuf = pcmToWav(pcmBuf, 24000);
            audioBase64 = wavBuf.toString('base64');
          }
        } catch (ttsErr) {
          console.warn('TTS synthesis optional skip:', ttsErr);
        }
      }

      res.json({
        replyText,
        audioBase64,
        mimeType: 'audio/wav',
        sqlMetrics: summaryMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Voice converse error:', error);
      res.status(500).json({ error: error.message || 'Falha ao consultar assistente de voz.' });
    }
  });

  // Gemini Live API WebSocket Bridge (/live) for real-time bidirectional PT-BR voice
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws: WebSocket) => {
    let session: any = null;

    try {
      const { prompt, summaryMetrics } = await buildPtBrFinancialSystemPrompt(
        DEFAULT_DEMO_UID,
        'casal@duofinn.com.br'
      );

      // Send initial Cloud SQL context confirmation to client
      ws.send(
        JSON.stringify({
          type: 'sql_context',
          metrics: summaryMetrics,
        })
      );

      const ai = getGenAI();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
          systemInstruction: {
            parts: [{ text: prompt }],
          },
        },
        callbacks: {
          onopen: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ready', model: 'gemini-3.8-live' }));
            }
          },
          onmessage: (message: any) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (!content) return;

            if (content.interrupted) {
              ws.send(JSON.stringify({ type: 'interrupted' }));
              return;
            }

            for (const part of content.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                ws.send(
                  JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                  })
                );
              }
              if (part.text) {
                ws.send(
                  JSON.stringify({
                    type: 'output_transcript',
                    text: part.text,
                  })
                );
              }
            }

            if (content.inputTranscription?.text) {
              ws.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                })
              );
            }
            if (content.outputTranscription?.text) {
              ws.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                })
              );
            }
            if (content.turnComplete) {
              ws.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live session error:', err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Erro na sessão Gemini Live API',
                })
              );
            }
          },
          onclose: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          },
        },
      });
    } catch (err: any) {
      console.error('Failed to connect to Gemini Live API:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message:
              err?.message ||
              'Conexão Gemini Live indisponível no momento. Usando síntese de voz PT-BR integrada.',
          })
        );
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!session) return;

        if (msg.type === 'audio' && msg.data) {
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'text' && msg.text) {
          session.sendRealtimeInput({
            text: String(msg.text),
          });
        }
      } catch (parseErr) {
        console.error('Failed to process incoming WS message:', parseErr);
      }
    });

    ws.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tapioca Pay server running on http://localhost:${PORT}`);
  });
}

startServer();

