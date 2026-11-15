// A conta do Preço Fácil. Mesma lógica do Quanto Cobrar, simplificada e escondida da usuária.

export const PRODUTIVIDADE = 0.7; // ninguém costura todas as horas em que está no ateliê
export const SEMANAS_NO_MES = 4.3;
export const RESERVA = 0.1;       // imprevistos: refazer, perda de tecido
export const LUCRO = 0.2;         // margem mínima recomendada (padrão)
export const LUCRO_MAX = 0.7;

const n = (v) => Number(v) || 0;

export function horasNoMes(h) {
  return n(h.dias) * SEMANAS_NO_MES * n(h.horas) * PRODUTIVIDADE;
}

export function valorDaHora(h) {
  const horas = horasNoMes(h);
  return horas > 0 ? (n(h.ganhar) + n(h.gastos)) / horas : 0;
}

// Arredonda para cima em múltiplos de R$ 5.
export const arredondar5 = (v) => (v > 0 ? Math.ceil(Math.round(v * 100) / 500) * 5 : 0); // centavos primeiro

// Lucro entre 0% e 70%; sem valor, usa o padrão.
export const lucroValido = (l) => Math.min(LUCRO_MAX, Math.max(0, l == null ? LUCRO : n(l)));

// minutos de trabalho + material → preço mínimo e ideal (com o lucro escolhido)
export function preco(h, minutos, material, lucro = LUCRO) {
  const custo = (n(minutos) / 60) * valorDaHora(h) + n(material);
  const comReserva = custo * (1 + RESERVA);
  return {
    custo,
    minimo: arredondar5(comReserva),
    ideal: arredondar5(comReserva / (1 - lucroValido(lucro))),
  };
}

// Vários serviços para a mesma cliente: preço de cada um (já arredondado) × quantidade.
export function totalLista(h, itens, lucro) {
  const linhas = itens.map((i) => {
    const p = preco(h, i.min, i.material, lucro);
    const qtd = Math.max(1, Math.round(n(i.qtd) || 1));
    return { ...i, qtd, unMinimo: p.minimo, unIdeal: p.ideal, minimo: p.minimo * qtd, ideal: p.ideal * qtd };
  });
  return {
    linhas,
    minimo: linhas.reduce((t, l) => t + l.minimo, 0),
    ideal: linhas.reduce((t, l) => t + l.ideal, 0),
  };
}

export function tempoTxt(min) {
  min = Math.round(n(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  const horas = `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return m ? `${horas} e ${m} min` : horas;
}

export function hojeISO(d = new Date()) {
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function somaDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return hojeISO(new Date(a, m - 1, d + dias));
}

export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const diaMes = (iso) => dataBR(iso).slice(0, 5);
