// O orçamento que vai para a cliente: imagem (para o WhatsApp) e texto.
import { dataBR, somaDias } from './calc.js';

const MARSALA = '#6E2A3C';
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const VALIDADE_DIAS = 7;

const somaItens = (o) => (o.itens || []).reduce((t, i) => t + i.valor, 0);
const nomeItem = (i) => `${i.qtd > 1 ? `${i.qtd}× ` : ''}${i.nome}`;
// Desconto dado sobre a soma dos serviços (só quando são vários).
export const descontoDe = (o) => (o.itens ? Math.max(0, Math.round((somaItens(o) - o.valor) * 100) / 100) : 0);

export function textoOrcamento(o, atelie) {
  const desc = descontoDe(o);
  return [
    atelie.nome ? `*${atelie.nome}*` : null,
    `Orçamento para ${o.cliente}`,
    '',
    ...(o.itens
      ? [...o.itens.map((i) => `${nomeItem(i)}: ${fmt.format(i.valor)}`), ...(desc ? [`Desconto: −${fmt.format(desc)}`] : []), `*Total: ${fmt.format(o.valor)}*`]
      : [`${o.descricao}: *${fmt.format(o.valor)}*`]),
    `Pronto até ${dataBR(o.prazo)}`,
    o.obs ? `Observação: ${o.obs}` : null,
    '',
    `Orçamento válido até ${dataBR(somaDias(o.criadoEm, VALIDADE_DIAS))}`,
    atelie.telefone || null,
  ].filter((l) => l !== null).join('\n');
}

export function textoTabela(itens, atelie) {
  return [
    `*Tabela de preços${atelie.nome ? ` — ${atelie.nome}` : ''}*`,
    '',
    ...itens.map(([nome, v]) => `${nome}: ${fmt.format(v)}`),
    '',
    atelie.telefone || null,
  ].filter((l) => l !== null).join('\n').trim();
}

// Quebra o texto em linhas que cabem na largura.
function linhas(ctx, texto, largura) {
  const palavras = String(texto).split(/\s+/);
  const out = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { out.push(atual); atual = p; } else atual = teste;
  }
  if (atual) out.push(atual);
  return out;
}

export async function imagemOrcamento(o, atelie) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1080;
  const M = 90; // margem
  const serif = '"Fraunces", Georgia, serif';
  const sans = '"Inter", system-ui, sans-serif';

  // Primeiro mede a altura, depois desenha.
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const blocos = [];
  const add = (texto, fonte, cor, gap, alinhar = 'left') => {
    ctx.font = fonte;
    const ls = linhas(ctx, texto, W - 2 * M);
    const tam = parseInt(fonte.match(/(\d+)px/)[1], 10);
    blocos.push({ ls, fonte, cor, gap, alt: tam * 1.25, alinhar });
  };
  add(`Orçamento para ${o.cliente}`, `500 44px ${sans}`, '#6B6B6B', 70);
  if (o.itens) {
    // Cada serviço numa linha: nome à esquerda, valor à direita.
    const desc = descontoDe(o);
    const lista = [...o.itens.map((i) => [nomeItem(i), fmt.format(i.valor)]), ...(desc ? [['Desconto', `−${fmt.format(desc)}`]] : [])];
    lista.forEach(([nome, valor], k) => {
      ctx.font = `600 42px ${sans}`;
      const larguraValor = ctx.measureText(valor).width;
      ctx.font = `400 42px ${sans}`;
      const ls = linhas(ctx, nome, W - 2 * M - larguraValor - 40);
      blocos.push({ ls, fonte: `400 42px ${sans}`, cor: '#2B2522', gap: k ? 18 : 36, alt: 42 * 1.3, valor });
    });
    add('Total', `600 36px ${sans}`, '#6B6B6B', 46);
  } else {
    add(o.descricao, `600 60px ${serif}`, '#2B2522', 24);
  }
  const iValor = blocos.length;
  add(fmt.format(o.valor), `600 120px ${serif}`, MARSALA, o.itens ? 6 : 30);
  add(`Pronto até ${dataBR(o.prazo)}`, `600 44px ${sans}`, '#2B2522', 70);
  if (o.obs) add(o.obs, `400 40px ${sans}`, '#2B2522', 30);
  add(`Orçamento válido até ${dataBR(somaDias(o.criadoEm, VALIDADE_DIAS))}`, `400 34px ${sans}`, '#6B6B6B', 60);

  const topoAlt = 230;
  const corpo = blocos.reduce((t, b) => t + b.gap + b.ls.length * b.alt, 0);
  const rodape = atelie.telefone ? 140 : 70;
  c.width = W;
  c.height = topoAlt + corpo + rodape;

  ctx.fillStyle = '#FBF8F6';
  ctx.fillRect(0, 0, W, c.height);
  ctx.fillStyle = MARSALA;
  ctx.fillRect(0, 0, W, topoAlt);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 64px ${serif}`;
  const nome = linhas(ctx, atelie.nome || 'Orçamento', W - 2 * M)[0];
  ctx.fillText(nome, M, 140);
  ctx.font = `500 30px ${sans}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText('ORÇAMENTO', M, 190);
  ctx.globalAlpha = 1;

  let y = topoAlt;
  blocos.forEach((b, i) => {
    y += b.gap;
    ctx.font = b.fonte;
    ctx.fillStyle = b.cor;
    const y0 = y;
    for (const l of b.ls) { y += b.alt; ctx.fillText(l, M, y - b.alt * 0.2); }
    if (b.valor) { // valor do serviço, alinhado à direita na primeira linha
      ctx.font = `600 42px ${'"Inter", system-ui, sans-serif'}`;
      ctx.textAlign = 'right';
      ctx.fillText(b.valor, W - M, y0 + b.alt * 0.8);
      ctx.textAlign = 'left';
    }
    if (o.itens && i === iValor - 2) { // linha antes do total
      ctx.fillStyle = '#E8DED9';
      ctx.fillRect(M, y + 20, W - 2 * M, 3);
    }
    if (i === iValor) { // linha depois do valor
      ctx.fillStyle = '#E8DED9';
      ctx.fillRect(M, y + 24, W - 2 * M, 3);
    }
  });

  if (atelie.telefone) {
    ctx.fillStyle = '#F4F2F0';
    ctx.fillRect(0, c.height - 110, W, 110);
    ctx.fillStyle = MARSALA;
    ctx.font = `600 40px ${sans}`;
    ctx.fillText(atelie.telefone, M, c.height - 42);
  }

  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
