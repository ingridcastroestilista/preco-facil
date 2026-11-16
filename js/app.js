import { valorDaHora, preco, totalLista, lucroValido, LUCRO, tempoTxt, hojeISO, somaDias, dataBR, diaMes, formatarTelefone } from './calc.js';
import { imagemOrcamento, textoOrcamento, textoTabela } from './orcamento.js';

// ---------- Dados no aparelho ----------

const CHAVE = 'preco-facil:v1';

const SERVICOS = [
  ['Barra simples', 20], ['Barra de calça jeans', 30], ['Barra italiana', 40], ['Trocar zíper', 45],
  ['Apertar ou soltar cintura', 45], ['Ajustar lateral', 45], ['Encurtar manga', 40], ['Pregar botões', 15], ['Remendo', 20],
];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function inicial() {
  return {
    hora: { ganhar: 0, gastos: 0, dias: 5, horas: 6, itens: {}, lucro: LUCRO },
    configurado: false,
    servicos: SERVICOS.map(([nome, min]) => ({ id: uid(), nome, min })),
    atelie: { nome: '', telefone: '', endereco: '' },
    atual: null, // cálculo em andamento
    orc: null,   // orçamento em andamento
    lista: null, // vários serviços para a mesma cliente: { itens, lucro }
    adicionando: false, // o cálculo em andamento vai para a lista
    orcamentos: [],
  };
}

let S;
try { S = { ...inicial(), ...JSON.parse(localStorage.getItem(CHAVE)) }; } catch { S = inicial(); }
S.hora.lucro ??= LUCRO; // quem configurou antes do lucro ajustável
S.atelie = { nome: '', telefone: '', endereco: '', ...S.atelie };
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch { /* sem espaço */ } };
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

// ---------- Formatação ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (v) => fmt.format(v || 0);
const brlRedondo = (v) => (Number.isInteger(v) ? `R$ ${v.toLocaleString('pt-BR')}` : brl(v));

function lerNum(s) {
  s = String(s ?? '').replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
const mostrarNum = (v) => (v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');

// ---------- Pedaços de tela ----------

const $app = document.getElementById('app');

const ENGRENAGEM = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function topo(titulo, voltar) {
  return `<header class="topo">
    ${voltar ? `<a class="voltar" href="${voltar}">‹ Voltar</a>` : '<span class="marca">Preço Fácil</span>'}
    ${titulo ? `<span class="passo">${titulo}</span>` : ''}
    ${!voltar && S.configurado ? `<a class="engrenagem" href="#/ajustes" aria-label="Ajustes">${ENGRENAGEM}</a>` : ''}
  </header>`;
}

const pergunta = (texto, ajuda = '') => `<h1>${texto}</h1>${ajuda ? `<p class="ajuda">${ajuda}</p>` : ''}`;

const campoDinheiro = (id, valor, rotulo) => `
  <label class="dinheiro"><span class="sr">${rotulo}</span><b>R$</b>
    <input id="${id}" inputmode="decimal" autocomplete="off" value="${esc(mostrarNum(valor))}" placeholder="0">
  </label>`;

const continuar = (acao = 'continuar', texto = 'Continuar') => `<button class="btn principal" data-acao="${acao}">${texto}</button>`;

const opcoes = (nome, lista, atual) => `<div class="opcoes" role="radiogroup">${lista.map(([v, t]) =>
  `<button class="opcao" role="radio" aria-checked="${String(v) === String(atual)}" data-acao="${nome}" data-v="${v}">${t}</button>`).join('')}</div>`;

const pctTxt = (v) => `${Math.round(v * 100)}%`;

// Lucro do cálculo: − / + de 5 em 5.
const lucroCtl = (v) => `
  <div class="lucro">
    <div><span>Seu lucro</span><b>${pctTxt(v)}</b></div>
    <button class="btn redondo" data-acao="lucroMenos" aria-label="Menos lucro">−</button>
    <button class="btn redondo" data-acao="lucroMais" aria-label="Mais lucro">+</button>
  </div>
  ${v < LUCRO ? '<p class="alerta">Abaixo de 20% sobra pouco para a sua costura crescer.</p>' : ''}`;
const mudaLucro = (v, d) => lucroValido(Math.round((v + d) * 100) / 100);

function aviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove('on'), 3000);
}

// ---------- Telas ----------
// Cada tela: render() devolve o HTML; acoes (opcional) trata os botões dela.

const T = {};

// Convite para o curso: leva ao grupo da Ingrid Castro Academy no WhatsApp.
const LINK_GRUPO = 'https://chat.whatsapp.com/IV4EsY83cfXJRgKowkGg8D?mode=gi_t';
const conviteCurso = () => `<section class="convite">
    <h2>Quer transformar a costura em negócio?</h2>
    <p>Entre no grupo gratuito da <b>Ingrid Castro Academy</b> no WhatsApp e conheça o curso de <b>Precificação e Empreendedorismo</b>.</p>
    <a class="btn whats" href="${LINK_GRUPO}" target="_blank" rel="noopener">Entrar no grupo do WhatsApp</a>
  </section>`;

T.inicio = {
  render() {
    if (!S.configurado) {
      return `${topo()}
        <div class="boas-vindas">
          <img src="icons/icon.svg" alt="" width="88" height="88">
          ${pergunta('Vamos descobrir quanto cobrar pelo seu trabalho', 'Primeiro, 4 perguntas rápidas sobre a sua costura. Você só faz isso uma vez.')}
          <a class="btn principal" href="#/hora1">Começar</a>
        </div>`;
    }
    return `${topo()}
      <p class="valor-hora">Sua hora vale <b>${brl(valorDaHora(S.hora))}</b> · lucro de <b>${pctTxt(S.hora.lucro)}</b></p>
      ${S.lista?.itens.length ? `<a class="btn principal" href="#/lista">Continuar a lista da cliente (${S.lista.itens.length})</a>` : ''}
      <h1>O que você quer calcular?</h1>
      <div class="grandes">
        <a class="btn gigante" href="#/conserto"><span aria-hidden="true">✂️</span>Conserto ou ajuste</a>
        <a class="btn gigante" href="#/peca1" data-acao="novaPeca"><span aria-hidden="true">👗</span>Peça nova</a>
      </div>
      <div class="menores">
        <a class="btn secundario" href="#/orcamentos">Meus orçamentos${S.orcamentos.length ? ` (${S.orcamentos.length})` : ''}</a>
        <a class="btn secundario" href="#/tabela">Minha tabela de preços</a>
        <a class="btn secundario" href="#/hora1">Mudar o valor da minha hora</a>
      </div>
      ${conviteCurso()}
      ${!instalado() ? `<p class="dica">${ehIOS() ? 'Dica: para guardar o app no celular, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.' : 'Dica: para guardar o app no celular, abra o menu do navegador e toque em <b>Adicionar à tela inicial</b>.'}</p>` : ''}`;
  },
};

// --- Quanto vale a sua hora ---

T.hora1 = {
  render: () => `${topo('Pergunta 1 de 4', '#/inicio')}
    ${pergunta('Quanto você quer ganhar por mês com a costura?', 'É o dinheiro que fica para você, como um salário.')}
    ${campoDinheiro('ganhar', S.hora.ganhar, 'Quanto quer ganhar')}
    ${continuar()}`,
  continuar() {
    const v = lerNum(document.getElementById('ganhar').value);
    if (!v) return aviso('Escreva quanto você quer ganhar por mês.');
    S.hora.ganhar = v; salvar(); ir('#/hora2');
  },
};

const ITENS_GASTOS = [['luz', 'Luz (parte da costura)'], ['linha', 'Linha, agulha e alfinete'], ['maquina', 'Conserto da máquina'], ['transporte', 'Transporte'], ['outros', 'Outros']];
let ajudaSomar = false;

T.hora2 = {
  render: () => `${topo('Pergunta 2 de 4', '#/hora1')}
    ${pergunta('Quanto você gasta por mês com a costura?', 'Pense em: luz, linha, agulha, conserto da máquina, transporte.')}
    ${campoDinheiro('gastos', S.hora.gastos, 'Quanto gasta por mês')}
    ${ajudaSomar ? `<div class="somar">${ITENS_GASTOS.map(([k, t]) => `<label class="item-soma"><span>${t}</span>
        <span class="mini-dinheiro">R$ <input inputmode="decimal" data-item="${k}" value="${esc(mostrarNum(S.hora.itens[k]))}" placeholder="0"></span></label>`).join('')}</div>`
      : '<button class="link" data-acao="ajudar">Me ajude a somar</button>'}
    ${continuar()}`,
  ajudar() { ajudaSomar = true; render(); },
  continuar() {
    S.hora.gastos = lerNum(document.getElementById('gastos').value);
    salvar(); ir('#/hora3');
  },
};

T.hora3 = {
  render: () => `${topo('Pergunta 3 de 4', '#/hora2')}
    ${pergunta('Quantos dias por semana você costura?')}
    ${opcoes('dias', [1, 2, 3, 4, 5, 6, 7].map((d) => [d, d]), S.hora.dias)}
    <h2>E quantas horas por dia?</h2>
    ${opcoes('horas', [2, 4, 6, 8, 10].map((h) => [h, `${h} horas`]), S.hora.horas)}
    ${continuar()}`,
  dias(el) { S.hora.dias = Number(el.dataset.v); salvar(); render(); },
  horas(el) { S.hora.horas = Number(el.dataset.v); salvar(); render(); },
  continuar() { salvar(); ir('#/hora4'); },
};

const LUCROS = [0.2, 0.3, 0.4, 0.5];
let outroLucro = false;

T.hora4 = {
  render: () => {
    const l = S.hora.lucro;
    const marcado = outroLucro || !LUCROS.includes(l) ? 'outro' : l;
    return `${topo('Pergunta 4 de 4', '#/hora3')}
      ${pergunta('Quanto de lucro você quer?', 'O lucro é o que sobra depois de pagar o seu ganho e os gastos. Ele ajuda a costura a crescer: comprar uma máquina, fazer um curso.')}
      ${opcoes('lucro', [...LUCROS.map((v) => [v, pctTxt(v)]), ['outro', 'Outro']], marcado)}
      ${marcado === 'outro' ? `<h2>Quantos por cento?</h2><label class="dinheiro"><input id="lucro" inputmode="decimal" value="${Math.round(l * 100)}" placeholder="20"><b>%</b></label>` : ''}
      <p class="dica">20% é o mínimo recomendado. Se as clientes aceitam bem os seus preços ou a sua agenda vive cheia, você pode subir. Em cada orçamento dá para mudar também.</p>
      ${continuar('continuar', 'Ver quanto vale a minha hora')}`;
  },
  lucro(el) {
    outroLucro = el.dataset.v === 'outro';
    if (!outroLucro) S.hora.lucro = Number(el.dataset.v);
    salvar(); render();
    if (outroLucro) document.getElementById('lucro')?.focus();
  },
  continuar() {
    const el = document.getElementById('lucro');
    if (el) S.hora.lucro = lucroValido(lerNum(el.value) / 100);
    outroLucro = false;
    S.configurado = true; salvar(); ir('#/horaFim');
  },
};

T.horaFim = {
  render: () => `${topo('', '#/hora4')}
    <div class="resultado-hora">
      <p>Sua hora de trabalho vale</p>
      <strong>${brl(valorDaHora(S.hora))}</strong>
      <p class="ajuda">Esse valor já paga o que você quer ganhar e os gastos da costura. O app usa ele em todas as contas, com ${pctTxt(S.hora.lucro)} de lucro no preço ideal.</p>
    </div>
    <a class="btn principal" href="#/inicio">Calcular um preço</a>`,
};

// --- Conserto ---

T.conserto = {
  render: () => `${topo('Conserto ou ajuste', S.adicionando ? '#/lista' : '#/inicio')}
    ${pergunta(S.adicionando ? 'Qual o outro serviço?' : 'Qual serviço?')}
    <div class="lista-servicos">
      ${S.servicos.map((s) => `<button class="btn servico" data-acao="escolher" data-id="${s.id}">${esc(s.nome)}</button>`).join('')}
      <button class="btn servico outro" data-acao="outro">Outro serviço</button>
    </div>`,
  escolher(el) {
    const s = S.servicos.find((x) => x.id === el.dataset.id);
    S.atual = { tipo: 'conserto', servicoId: s.id, nome: s.nome, min: s.min, material: 0, temMaterial: false, fixo: s.preco || 0 };
    salvar(); ir('#/tempo');
  },
  outro() { S.atual = { tipo: 'conserto', servicoId: null, nome: '', min: 30, material: 0, temMaterial: false }; salvar(); ir('#/outroNome'); },
};

T.outroNome = {
  render: () => `${topo('Conserto ou ajuste', '#/conserto')}
    ${pergunta('Que serviço é?')}
    <input class="texto" id="nome" value="${esc(S.atual?.nome)}" placeholder="Ex.: ajuste de alça" autocomplete="off">
    ${continuar()}`,
  continuar() {
    const v = document.getElementById('nome').value.trim();
    if (!v) return aviso('Escreva o nome do serviço.');
    S.atual.nome = v; salvar(); ir('#/tempo');
  },
};

T.tempo = {
  render: () => {
    const a = S.atual;
    return `${topo('Conserto ou ajuste', a.servicoId ? '#/conserto' : '#/outroNome')}
      ${pergunta(`Quanto tempo você leva para fazer: ${esc(a.nome.toLowerCase())}?`, a.servicoId ? 'Já vem marcado o tempo médio. Ajuste se você for mais rápida ou mais devagar.' : '')}
      <div class="ajuste-tempo">
        <button class="btn redondo" data-acao="menos" aria-label="Menos 15 minutos">− 15 min</button>
        <output aria-live="polite">${tempoTxt(a.min)}</output>
        <button class="btn redondo" data-acao="mais" aria-label="Mais 15 minutos">+ 15 min</button>
      </div>
      ${continuar()}`;
  },
  menos() { S.atual.min = Math.max(5, S.atual.min - 15); salvar(); render(); },
  mais() { S.atual.min += 15; salvar(); render(); },
  continuar() {
    const s = S.servicos.find((x) => x.id === S.atual.servicoId);
    if (s) s.min = S.atual.min; // o tempo dela fica guardado para a próxima vez
    salvar(); ir('#/material');
  },
};

T.material = {
  render: () => {
    const a = S.atual;
    const voltar = a.tipo === 'peca' ? '#/peca2' : '#/tempo';
    if (a.tipo === 'peca') {
      return `${topo('Peça nova', voltar)}
        ${pergunta('Quanto você gastou de tecido e material?', 'Some tecido, forro, zíper, botões, linha e o que mais for usar nesta peça.')}
        ${campoDinheiro('material', a.material, 'Valor do material')}
        ${continuar('continuar', S.adicionando ? 'Colocar na lista' : 'Ver o preço')}`;
    }
    return `${topo('Conserto ou ajuste', voltar)}
      ${pergunta('Vai usar algum material?', 'Por exemplo: zíper, botão, entretela, elástico.')}
      ${opcoes('tem', [['nao', 'Não'], ['sim', 'Sim']], a.temMaterial ? 'sim' : 'nao')}
      ${a.temMaterial ? `<h2>Quanto custa o material?</h2>${campoDinheiro('material', a.material, 'Valor do material')}` : ''}
      ${continuar('continuar', S.adicionando ? 'Colocar na lista' : 'Ver o preço')}`;
  },
  tem(el) { S.atual.temMaterial = el.dataset.v === 'sim'; if (!S.atual.temMaterial) S.atual.material = 0; salvar(); render(); if (S.atual.temMaterial) document.getElementById('material')?.focus(); },
  continuar() {
    const el = document.getElementById('material');
    S.atual.material = el ? lerNum(el.value) : 0;
    if (S.adicionando) return paraLista();
    salvar(); ir('#/resultado');
  },
};

// --- Peça nova ---

T.peca1 = {
  render: () => `${topo('Peça nova', S.adicionando ? '#/lista' : '#/inicio')}
    ${pergunta('Que peça é?', 'Se não quiser escrever, é só tocar em Continuar.')}
    <input class="texto" id="nome" value="${esc(S.atual?.nome)}" placeholder="Ex.: vestido de festa" autocomplete="off">
    ${continuar()}`,
  continuar() {
    S.atual.nome = document.getElementById('nome').value.trim();
    salvar(); ir('#/peca2');
  },
};

function opcoesTempoPeca() {
  const dia = S.hora.horas * 60;
  return [[120, '2 horas'], [240, '4 horas'], [dia, '1 dia'], [dia * 2, '2 dias'], [dia * 3, '3 dias'], [dia * S.hora.dias, '1 semana']];
}

T.peca2 = {
  render: () => {
    const a = S.atual;
    const lista = opcoesTempoPeca();
    const escolhido = lista.some(([v]) => v === a.min) ? a.min : (a.outroTempo ? 'outro' : '');
    return `${topo('Peça nova', '#/peca1')}
      ${pergunta('Quanto tempo leva para fazer?', `Conte tudo: tirar medidas, cortar, costurar, provar e acabar. Um dia de trabalho, para você, tem ${S.hora.horas} horas.`)}
      ${opcoes('tempo', [...lista, ['outro', 'Outro']], escolhido)}
      ${a.outroTempo ? `<h2>Quantas horas, mais ou menos?</h2><label class="dinheiro"><input id="horas" inputmode="decimal" value="${esc(mostrarNum(a.min / 60))}" placeholder="0"><b>horas</b></label>` : ''}
      ${continuar()}`;
  },
  tempo(el) {
    if (el.dataset.v === 'outro') { S.atual.outroTempo = true; } else { S.atual.outroTempo = false; S.atual.min = Number(el.dataset.v); }
    salvar(); render();
    if (S.atual.outroTempo) document.getElementById('horas')?.focus();
  },
  continuar() {
    if (S.atual.outroTempo) S.atual.min = Math.round(lerNum(document.getElementById('horas').value) * 60);
    if (!S.atual.min) return aviso('Escolha quanto tempo leva.');
    salvar(); ir('#/material');
  },
};

// --- Resultado ---

const descricaoAtual = () => S.atual.nome || (S.atual.tipo === 'peca' ? 'Peça nova' : 'Conserto');

function paraLista() {
  const a = S.atual;
  S.lista ||= { itens: [], lucro: a.lucro ?? S.hora.lucro };
  S.lista.itens.push({ id: uid(), nome: descricaoAtual(), min: a.min, material: a.material, qtd: 1, fixo: a.fixo || 0 });
  S.atual = null; S.adicionando = false;
  salvar(); ir('#/lista');
}

T.resultado = {
  render: () => {
    const a = S.atual;
    a.lucro ??= S.hora.lucro;
    const p = preco(S.hora, a.min, a.material, a.lucro, a.fixo);
    const naTabela = a.tipo === 'conserto' && (a.servicoId || S.servicos.some((s) => s.nome === a.nome));
    return `${topo('', '#/material')}
      <p class="sobre">${esc(descricaoAtual())} · ${tempoTxt(a.min)}${a.material ? ` · material ${brl(a.material)}` : ''}</p>
      <div class="preco minimo"><span>Não cobre menos de</span><strong>${brlRedondo(p.minimo)}</strong><p>Abaixo disso, você paga para trabalhar.</p></div>
      ${p.fixo
        ? `<div class="preco ideal"><span>Seu preço da tabela${a.material ? ' + material' : ''}</span><strong>${brlRedondo(p.ideal)}</strong>${p.ideal < p.minimo ? '<p class="alerta-preco">Atenção: está abaixo do mínimo. Reveja o preço na sua tabela.</p>' : '<p>É o preço que você definiu para este serviço.</p>'}</div>`
        : `<div class="preco ideal"><span>O ideal é</span><strong>${brlRedondo(p.ideal)}</strong><p>Assim sobra um dinheiro para a sua costura crescer.</p></div>
      ${lucroCtl(a.lucro)}`}
      <button class="btn principal" data-acao="orcamento">Fazer orçamento para a cliente</button>
      <button class="btn secundario" data-acao="lista">Mais peças ou outro serviço</button>
      ${a.tipo === 'conserto' && !naTabela ? '<button class="btn secundario" data-acao="tabela">Colocar na minha tabela</button>' : ''}
      <a class="btn secundario" href="#/inicio">Calcular outro</a>`;
  },
  lucroMenos() { S.atual.lucro = mudaLucro(S.atual.lucro, -0.05); salvar(); render(); },
  lucroMais() { S.atual.lucro = mudaLucro(S.atual.lucro, 0.05); salvar(); render(); },
  lista: paraLista,
  orcamento() {
    const p = preco(S.hora, S.atual.min, S.atual.material, S.atual.lucro, S.atual.fixo);
    S.orc = { descricao: descricaoAtual(), valor: p.ideal, minimo: p.minimo, cliente: '', prazo: somaDias(hojeISO(), 7), prazoOpcao: 7, obs: '' };
    salvar(); ir('#/orc1');
  },
};

// --- Vários serviços para a mesma cliente ---

const resumoItens = (itens) => itens.map((i) => `${i.qtd > 1 ? `${i.qtd}× ` : ''}${i.nome}`).join(', ');
const acharItem = (el) => S.lista.itens.find((i) => i.id === el.dataset.id);

T.lista = {
  render: () => {
    const t = totalLista(S.hora, S.lista.itens, S.lista.lucro);
    return `${topo('Serviços da cliente', '#/inicio')}
      ${pergunta('Serviços da mesma cliente', 'Toque em + para mais peças iguais, como 2 barras de calça.')}
      <div class="itens">${t.linhas.map((l) => `<div class="item">
        <div class="item-nome"><b>${esc(l.nome)}</b><span>${brlRedondo(l.unIdeal)} cada · ${tempoTxt(l.min)}${l.material ? ` · material ${brl(l.material)}` : ''}</span></div>
        <div class="item-qtd">
          <button class="btn redondo" data-acao="menos" data-id="${l.id}" aria-label="Uma peça a menos de ${esc(l.nome)}">−</button>
          <output aria-live="polite">${l.qtd}</output>
          <button class="btn redondo" data-acao="mais" data-id="${l.id}" aria-label="Uma peça a mais de ${esc(l.nome)}">+</button>
        </div>
        <div class="item-total"><b>${brlRedondo(l.ideal)}</b><button class="link" data-acao="tirar" data-id="${l.id}">Tirar</button></div>
      </div>`).join('')}</div>
      <div class="mais-servico">
        <button class="btn secundario" data-acao="outroConserto">+ Outro conserto</button>
        <button class="btn secundario" data-acao="outraPeca">+ Peça nova</button>
      </div>
      <div class="preco minimo"><span>Não cobre menos de</span><strong>${brlRedondo(t.minimo)}</strong></div>
      <div class="preco ideal"><span>O ideal é</span><strong>${brlRedondo(t.ideal)}</strong></div>
      ${lucroCtl(S.lista.lucro)}
      <button class="btn principal" data-acao="orcamento">Fazer orçamento para a cliente</button>
      <button class="link" data-acao="limpar">Apagar a lista e começar de novo</button>`;
  },
  mais(el) { acharItem(el).qtd += 1; salvar(); render(); },
  menos(el) { const i = acharItem(el); if (i.qtd > 1) { i.qtd -= 1; salvar(); render(); } else this.tirar(el); },
  tirar(el) {
    const i = acharItem(el);
    if (!confirm(`Tirar ${i.nome} da lista?`)) return;
    S.lista.itens = S.lista.itens.filter((x) => x.id !== i.id);
    if (!S.lista.itens.length) { S.lista = null; salvar(); return ir('#/inicio'); }
    salvar(); render();
  },
  lucroMenos() { S.lista.lucro = mudaLucro(S.lista.lucro, -0.05); salvar(); render(); },
  lucroMais() { S.lista.lucro = mudaLucro(S.lista.lucro, 0.05); salvar(); render(); },
  outroConserto() { S.adicionando = true; salvar(); ir('#/conserto'); },
  outraPeca() { S.adicionando = true; S.atual = { tipo: 'peca', nome: '', min: 0, material: 0, outroTempo: false }; salvar(); ir('#/peca1'); },
  limpar() {
    if (!confirm('Apagar a lista? Os serviços dela vão sumir.')) return;
    S.lista = null; salvar(); ir('#/inicio');
  },
  orcamento() {
    const t = totalLista(S.hora, S.lista.itens, S.lista.lucro);
    S.orc = {
      descricao: resumoItens(t.linhas),
      itens: t.linhas.map((l) => ({ nome: l.nome, qtd: l.qtd, valor: l.ideal })),
      valor: t.ideal, minimo: t.minimo, cliente: '', prazo: somaDias(hojeISO(), 7), prazoOpcao: 7, obs: '',
    };
    salvar(); ir('#/orc1');
  },
  tabela() {
    const s = { id: uid(), nome: S.atual.nome, min: S.atual.min };
    S.servicos.push(s); S.atual.servicoId = s.id; salvar();
    aviso('Serviço colocado na sua tabela'); render();
  },
};

// --- Orçamento para a cliente ---

T.orc1 = {
  render: () => `${topo('Orçamento', S.orc.itens ? '#/lista' : '#/resultado')}
    ${pergunta('Qual o nome da cliente?')}
    <input class="texto" id="cliente" value="${esc(S.orc.cliente)}" placeholder="Ex.: Maria" autocomplete="off" autocapitalize="words">
    ${continuar()}`,
  continuar() {
    const v = document.getElementById('cliente').value.trim();
    if (!v) return aviso('Escreva o nome da cliente.');
    S.orc.cliente = v; salvar(); ir('#/orc2');
  },
};

T.orc2 = {
  render: () => `${topo('Orçamento', '#/orc1')}
    ${pergunta(S.orc.itens ? 'Qual o valor total?' : 'Qual o valor?', `O valor ideal já está preenchido. O mínimo é ${brlRedondo(S.orc.minimo)}.`)}
    ${S.orc.itens ? '<p class="ajuda">Se der um desconto, ele aparece no orçamento.</p>' : ''}
    ${campoDinheiro('valor', S.orc.valor, 'Valor do orçamento')}
    <p class="alerta" id="abaixo" ${S.orc.valor < S.orc.minimo ? '' : 'hidden'}>Esse valor está abaixo do mínimo. Você vai pagar para trabalhar.</p>
    ${continuar()}`,
  continuar() {
    const v = lerNum(document.getElementById('valor').value);
    if (!v) return aviso('Escreva o valor.');
    S.orc.valor = v; salvar(); ir('#/orc3');
  },
};

T.orc3 = {
  render: () => `${topo('Orçamento', '#/orc2')}
    ${pergunta('Quando fica pronto?')}
    ${opcoes('prazo', [[2, '2 dias'], [7, '1 semana'], [14, '2 semanas'], ['data', 'Escolher data']], S.orc.prazoOpcao)}
    ${S.orc.prazoOpcao === 'data' ? `<input class="texto" type="date" id="data" value="${S.orc.prazo}" min="${hojeISO()}">` : `<p class="destaque-data">Pronto até <b>${dataBR(S.orc.prazo)}</b></p>`}
    ${continuar()}`,
  prazo(el) {
    const v = el.dataset.v;
    S.orc.prazoOpcao = v === 'data' ? 'data' : Number(v);
    if (v !== 'data') S.orc.prazo = somaDias(hojeISO(), Number(v));
    salvar(); render();
  },
  continuar() {
    const d = document.getElementById('data');
    if (d) { if (!d.value) return aviso('Escolha a data.'); S.orc.prazo = d.value; }
    salvar(); ir('#/orc4');
  },
};

const SUGESTOES_OBS = ['Metade do valor para começar', 'Pagamento na entrega', 'Aceito Pix'];

T.orc4 = {
  render: () => `${topo('Orçamento', '#/orc3')}
    ${pergunta('Quer escrever alguma observação?', 'Não é obrigatório. Toque numa sugestão ou escreva a sua.')}
    <div class="sugestoes">${SUGESTOES_OBS.map((s) => `<button class="chip" data-acao="sugestao" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <textarea class="texto" id="obs" rows="3" placeholder="Observação (opcional)">${esc(S.orc.obs)}</textarea>
    ${continuar('continuar', 'Ver o orçamento')}`,
  sugestao(el) {
    const t = document.getElementById('obs');
    t.value = t.value.trim() ? `${t.value.trim()}. ${el.dataset.v}` : el.dataset.v;
    S.orc.obs = t.value; salvar();
  },
  continuar() {
    S.orc.obs = document.getElementById('obs').value.trim(); salvar();
    if (!S.atelie.nome) return ir('#/atelie');
    criarOrcamento();
  },
};

T.atelie = {
  render: () => `${topo('Orçamento', '#/orc4')}
    ${pergunta('Qual o nome do seu ateliê?', 'Ele aparece no topo do orçamento. Você só preenche uma vez.')}
    <input class="texto" id="nome" value="${esc(S.atelie.nome)}" placeholder="Ex.: Costura da Rosa" autocomplete="off">
    <h2>E o seu WhatsApp? <small>(opcional)</small></h2>
    <input class="texto" id="tel" type="tel" inputmode="tel" value="${esc(S.atelie.telefone)}" placeholder="(11) 99999-9999">
    ${continuar('continuar', 'Ver o orçamento')}`,
  continuar() {
    const nome = document.getElementById('nome').value.trim();
    if (!nome) return aviso('Escreva o nome do ateliê.');
    S.atelie = { ...S.atelie, nome, telefone: document.getElementById('tel').value.trim() };
    salvar();
    if (S.orc) criarOrcamento(); else ir('#/tabela');
  },
};

function criarOrcamento() {
  const o = { id: uid(), criadoEm: hojeISO(), ...S.orc, entregue: false };
  delete o.prazoOpcao;
  S.orcamentos.unshift(o);
  if (o.itens) S.lista = null; // a lista virou orçamento
  S.orc = null;
  salvar();
  ir(`#/pronto/${o.id}`);
}

const achar = (id) => S.orcamentos.find((o) => o.id === id);

async function enviar(o) {
  const texto = textoOrcamento(o, S.atelie);
  try {
    const blob = await imagemOrcamento(o, S.atelie);
    const arq = new File([blob], `orcamento-${o.cliente.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arq] })) {
      await navigator.share({ files: [arq], text: texto });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return; // ela desistiu de enviar
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); aviso('Texto copiado. Agora é só colar.'); } catch { aviso('Não foi possível copiar.'); }
}

async function mostrarImagem(o) {
  const img = document.getElementById('previa');
  if (!img) return;
  const blob = await imagemOrcamento(o, S.atelie);
  img.src = URL.createObjectURL(blob);
}

T.pronto = {
  render: (id) => {
    const o = achar(id);
    if (!o) return `${topo('', '#/inicio')}<p>Orçamento não encontrado.</p>`;
    setTimeout(() => mostrarImagem(o));
    return `${topo('Orçamento pronto', '#/inicio')}
      <img id="previa" class="previa" alt="Orçamento para ${esc(o.cliente)}: ${esc(o.descricao)}, ${brl(o.valor)}">
      <button class="btn principal whats" data-acao="enviar">Mandar pelo WhatsApp</button>
      <button class="btn secundario" data-acao="copiar">Copiar texto</button>
      <a class="btn secundario" href="#/inicio">Voltar ao início</a>`;
  },
  enviar: () => enviar(achar(rotaId())),
  copiar: () => copiar(textoOrcamento(achar(rotaId()), S.atelie)),
};

// --- Meus orçamentos ---

T.orcamentos = {
  render: () => {
    const lista = [...S.orcamentos].sort((a, b) => Number(a.entregue) - Number(b.entregue));
    return `${topo('Meus orçamentos', '#/inicio')}
      ${lista.length ? `<div class="lista-orc">${lista.map((o) => `<a class="orc ${o.entregue ? 'entregue' : ''}" href="#/orcamento/${o.id}">
          <div><b>${o.entregue ? '✓ ' : ''}${esc(o.cliente)}</b><span>${esc(o.descricao)}</span></div>
          <div class="orc-dir"><b>${brl(o.valor)}</b><span>${o.entregue ? 'Entregue' : `Até ${diaMes(o.prazo)}`}</span></div>
        </a>`).join('')}</div>`
        : '<p class="vazio">Você ainda não fez nenhum orçamento. Calcule um preço e toque em <b>Fazer orçamento para a cliente</b>.</p>'}
      <a class="btn secundario" href="#/inicio">Voltar ao início</a>`;
  },
};

T.orcamento = {
  render: (id) => {
    const o = achar(id);
    if (!o) return `${topo('', '#/orcamentos')}<p>Orçamento não encontrado.</p>`;
    setTimeout(() => mostrarImagem(o));
    return `${topo('Orçamento', '#/orcamentos')}
      <img id="previa" class="previa" alt="Orçamento para ${esc(o.cliente)}: ${esc(o.descricao)}, ${brl(o.valor)}">
      <button class="btn principal whats" data-acao="enviar">Mandar de novo</button>
      <button class="btn secundario" data-acao="entregue">${o.entregue ? 'Desmarcar entregue' : 'Marcar como entregue'}</button>
      <button class="btn perigo" data-acao="apagar">Apagar</button>`;
  },
  enviar: () => enviar(achar(rotaId())),
  entregue() { const o = achar(rotaId()); o.entregue = !o.entregue; salvar(); aviso(o.entregue ? 'Marcado como entregue' : 'Desmarcado'); render(); },
  apagar() {
    const o = achar(rotaId());
    if (!confirm(`Apagar o orçamento de ${o.cliente}?`)) return;
    S.orcamentos = S.orcamentos.filter((x) => x.id !== o.id); salvar(); ir('#/orcamentos');
  },
};

// --- Minha tabela de preços ---

const precoServico = (s) => preco(S.hora, s.min, 0, S.hora.lucro, s.preco).ideal;

T.tabela = {
  render: () => `${topo('Minha tabela de preços', '#/inicio')}
    <div class="tabela-impressa">
      <h1 class="tabela-titulo">${esc(S.atelie.nome || 'Tabela de preços')}</h1>
      ${S.atelie.nome ? '<p class="tabela-sub">Tabela de preços</p>' : ''}
      <ul class="tabela">${S.servicos.map((s) => `<li><button data-acao="editar" data-id="${s.id}"><span>${esc(s.nome)}</span><b>${brlRedondo(precoServico(s))}</b></button></li>`).join('')}</ul>
      ${S.atelie.telefone ? `<p class="tabela-sub">WhatsApp ${esc(S.atelie.telefone)}</p>` : ''}
      ${S.atelie.endereco ? `<p class="tabela-sub">${esc(S.atelie.endereco)}</p>` : ''}
    </div>
    <p class="ajuda nao-imprime">Toque num serviço para mudar o nome, o tempo ou colocar o seu próprio preço.</p>
    <button class="btn secundario nao-imprime" data-acao="novo">+ Novo serviço</button>
    <button class="btn principal whats nao-imprime" data-acao="enviar">Mandar pelo WhatsApp</button>
    <button class="btn secundario nao-imprime" data-acao="imprimir">Imprimir</button>`,
  editar(el) { S.edit = null; ir(`#/servico/${el.dataset.id}`); },
  novo() { S.edit = null; ir('#/servico/novo'); },
  enviar() {
    const texto = textoTabela(S.servicos.map((s) => [s.nome, precoServico(s)]), S.atelie);
    if (navigator.share) navigator.share({ text: texto }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  },
  imprimir: () => window.print(),
};

// Editar (ou criar) um serviço da tabela: nome, tempo, preço do app ou preço dela, ordem e apagar.
T.servico = {
  render(id) {
    const s = S.servicos.find((x) => x.id === id);
    if (!S.edit || S.edit.id !== id) S.edit = { id, nome: s?.nome || '', min: s?.min || 30, proprio: !!s?.preco, preco: s?.preco || 0 };
    const e = S.edit;
    const calc = preco(S.hora, e.min, 0, S.hora.lucro);
    const i = S.servicos.indexOf(s);
    return `${topo(s ? 'Editar serviço' : 'Novo serviço', '#/tabela')}
      <h2>Nome do serviço</h2>
      <input class="texto" id="nome-servico" value="${esc(e.nome)}" placeholder="Ex.: Barra de vestido" autocomplete="off">
      <h2>Quanto tempo você leva?</h2>
      <div class="ajuste-tempo">
        <button class="btn redondo" data-acao="menos" aria-label="Menos 5 minutos">− 5 min</button>
        <output aria-live="polite">${tempoTxt(e.min)}</output>
        <button class="btn redondo" data-acao="mais" aria-label="Mais 5 minutos">+ 5 min</button>
      </div>
      <h2>Preço</h2>
      ${opcoes('qualPreco', [['app', `Do app: ${brlRedondo(calc.ideal)}`], ['meu', 'O meu preço']], e.proprio ? 'meu' : 'app')}
      ${e.proprio ? `${campoDinheiro('preco-servico', e.preco, 'Seu preço')}
        <p class="ajuda">O app sugere ${brlRedondo(calc.ideal)}. Não cobre menos de ${brlRedondo(calc.minimo)}.</p>` : '<p class="ajuda">O preço muda sozinho se você mudar o valor da sua hora ou o lucro.</p>'}
      ${continuar('salvar', 'Salvar')}
      ${s ? `<div class="mover">
          <button class="btn secundario" data-acao="subir" ${i <= 0 ? 'disabled' : ''}>↑ Subir na lista</button>
          <button class="btn secundario" data-acao="descer" ${i >= S.servicos.length - 1 ? 'disabled' : ''}>↓ Descer</button>
        </div>
        <button class="btn perigo" data-acao="apagar">Apagar este serviço</button>` : ''}`;
  },
  lerTela() {
    const e = S.edit;
    e.nome = document.getElementById('nome-servico')?.value.trim() ?? e.nome;
    const p = document.getElementById('preco-servico');
    if (p) e.preco = lerNum(p.value);
  },
  menos() { this.lerTela(); S.edit.min = Math.max(5, S.edit.min - 5); render(); },
  mais() { this.lerTela(); S.edit.min += 5; render(); },
  qualPreco(el) { this.lerTela(); S.edit.proprio = el.dataset.v === 'meu'; render(); if (S.edit.proprio) document.getElementById('preco-servico')?.focus(); },
  salvar() {
    this.lerTela();
    const e = S.edit;
    if (!e.nome) return aviso('Escreva o nome do serviço.');
    if (e.proprio && !e.preco) return aviso('Escreva o seu preço.');
    let s = S.servicos.find((x) => x.id === e.id);
    if (!s) { s = { id: uid() }; S.servicos.push(s); }
    Object.assign(s, { nome: e.nome, min: e.min, preco: e.proprio ? e.preco : 0 });
    S.edit = null; salvar(); aviso('Serviço salvo'); ir('#/tabela');
  },
  mover(d) {
    const i = S.servicos.findIndex((x) => x.id === S.edit.id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= S.servicos.length) return;
    [S.servicos[i], S.servicos[j]] = [S.servicos[j], S.servicos[i]];
    salvar(); this.lerTela(); render();
  },
  subir() { this.mover(-1); },
  descer() { this.mover(1); },
  apagar() {
    const s = S.servicos.find((x) => x.id === S.edit.id);
    if (!confirm(`Apagar "${s.nome}" da sua tabela?`)) return;
    S.servicos = S.servicos.filter((x) => x.id !== s.id);
    S.edit = null; salvar(); aviso('Serviço apagado'); ir('#/tabela');
  },
};

// --- Ajustes ---

T.ajustes = {
  render: () => `${topo('Ajustes', '#/inicio')}
    ${pergunta('Seu ateliê', 'Aparece no orçamento e na tabela de preços que você manda para a cliente.')}
    <h2>Nome do ateliê</h2>
    <input class="texto" id="a-nome" value="${esc(S.atelie.nome)}" placeholder="Ex.: Costura da Rosa" autocomplete="off">
    <h2>WhatsApp</h2>
    <input class="texto" id="a-tel" type="tel" inputmode="tel" value="${esc(S.atelie.telefone)}" placeholder="(11) 99999-9999">
    <h2>Endereço <small>(opcional)</small></h2>
    <input class="texto" id="a-end" value="${esc(S.atelie.endereco)}" placeholder="Ex.: Rua das Flores, 120" autocomplete="off">
    ${continuar('salvar', 'Salvar')}
    <h2 class="ajustes-sec">Seus preços</h2>
    <a class="btn secundario" href="#/tabela">Minha tabela de preços</a>
    <a class="btn secundario" href="#/hora1">Mudar o valor da minha hora</a>
    <p class="ajuda">Sua hora vale <b>${brl(valorDaHora(S.hora))}</b>, com lucro de <b>${pctTxt(S.hora.lucro)}</b>.</p>`,
  salvar() {
    S.atelie = {
      nome: document.getElementById('a-nome').value.trim(),
      telefone: document.getElementById('a-tel').value.trim(),
      endereco: document.getElementById('a-end').value.trim(),
    };
    salvar(); aviso('Dados do ateliê salvos'); ir('#/inicio');
  },
};

// ---------- Navegação ----------

const rota = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
const rotaId = () => rota()[1];
const ir = (h) => { if (location.hash === h) render(); else location.hash = h; };

function render() {
  let [nome, id] = rota();
  // Telas do meio de um cálculo precisam de um cálculo em andamento.
  if (['tempo', 'material', 'resultado', 'outroNome', 'peca2'].includes(nome) && !S.atual) nome = 'inicio';
  if (nome.startsWith('orc') && nome.length === 4 && !S.orc) nome = 'inicio';
  if (nome === 'lista' && !S.lista?.itens.length) nome = 'inicio';
  if (!S.configurado && !nome.startsWith('hora')) nome = 'inicio';
  if (nome === 'inicio') S.adicionando = false;
  if (nome === 'peca1' && S.atual?.tipo !== 'peca') S.atual = { tipo: 'peca', nome: '', min: 0, material: 0, outroTempo: false };
  const tela = T[nome] || T.inicio;
  $app.innerHTML = tela.render(id) + '<p class="selo">Desenvolvido por <b>Ingrid Castro Academy</b></p>';
  $app.dataset.tela = nome;
  window.scrollTo(0, 0);
  const foco = $app.querySelector('input:not([type=date]), textarea');
  if (foco && !('ontouchstart' in window)) foco.focus();
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  if (el.dataset.acao === 'novaPeca') { S.atual = { tipo: 'peca', nome: '', min: 0, material: 0, outroTempo: false }; salvar(); return; }
  const tela = T[($app.dataset.tela)];
  const f = tela?.[el.dataset.acao];
  if (!f) return;
  ev.preventDefault();
  f.call(tela, el);
});

// Enter no teclado = Continuar.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || ev.target.tagName === 'TEXTAREA') return;
  const b = $app.querySelector('[data-acao="continuar"]');
  if (b && ev.target.tagName === 'INPUT') { ev.preventDefault(); b.click(); }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.item) { // "Me ajude a somar"
    S.hora.itens[el.dataset.item] = lerNum(el.value);
    const total = Object.values(S.hora.itens).reduce((t, v) => t + (v || 0), 0);
    document.getElementById('gastos').value = mostrarNum(total);
    salvar();
  }
  if (el.type === 'tel' && el.selectionStart === el.value.length) {
    const f = formatarTelefone(el.value);
    if (f !== el.value) el.value = f;
  }
  if (el.id === 'valor') document.getElementById('abaixo').hidden = !(lerNum(el.value) && lerNum(el.value) < S.orc.minimo);
});

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
