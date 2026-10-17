let rawUser = localStorage.getItem('currentUser');
let path = window.location.pathname;

if (!rawUser && path !== '/') window.location.replace('/');
if (rawUser && path === '/') window.location.replace('/dashboard');

let currentUser = rawUser || 'visitante';
let progressoUsuario = {};
let cadernosUsuario = [];
let historicoUsuario = [];
let paginaAtual = 1;
let listasUsuario = [];
let simuladosUsuario = [];
let favoritosUsuario = [];
let tentativasUsuario = [];
let anotacoesUsuario = [];
let agendaUsuario = [];
let leitorConcluidoUsuario = false;
let fonteLeitorUsuario = 16;
let temporizadorSimulado = null;

async function syncDB(tipo, dados) {
    if(currentUser === 'visitante') return;
    try { await fetch(`/api/sync/${currentUser}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({tipo: tipo, dados: dados}) }); } catch(e) {}
}

function alternarTela(alvo) {
    ['form-login', 'form-cadastro-1', 'form-cadastro-2'].forEach(id => {
        let el = document.getElementById(id); if(el) { el.classList.add('hidden', 'translate-x-full', 'absolute'); el.classList.remove('translate-x-0', 'relative'); }
    });
    let target = document.getElementById(alvo); if(target) { target.classList.remove('hidden', 'translate-x-full', 'absolute'); target.classList.add('translate-x-0', 'relative'); }
}

async function fazerLogin() {
    const u = document.getElementById('username').value.trim(); const p = document.getElementById('password').value.trim();
    if (!u || !p) return alert("Preencha o usuário e a senha!");
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        const data = await res.json();
        if(res.ok && data.sucesso) { localStorage.setItem('currentUser', u); window.location.replace('/dashboard'); } else { alert(data.erro); }
    } catch (e) { alert("Erro de conexão."); }
}

async function enviarCadastro() {
    const u = document.getElementById('new-user').value.trim();
    const p = document.getElementById('new-pass').value.trim();
    const tags = Array.from(document.querySelectorAll('.tag-check:checked')).map(el => el.value);
    const codigoInput = document.getElementById('codigo-cadastro');
    const codigo = codigoInput ? codigoInput.value.trim() : '';
    if (!u || !p) return alert("Preencha todos os campos!");
    if (codigo && !/^\d{1,20}$/.test(codigo)) return alert("O código de acesso deve conter somente números.");
    try {
        const res = await fetch('/api/cadastro', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p, tags: tags, codigo_cadastro: codigo})
        });
        const data = await res.json();
        if (res.ok && data.sucesso) {
            if (data.aprovado_automaticamente) {
                alert("Cadastro aprovado automaticamente! Você já pode entrar com seu usuário e senha.");
            } else if (codigo) {
                alert("Código não reconhecido. Sua solicitação foi enviada para aprovação do administrador.");
            } else {
                alert("Cadastro enviado! Aguarde a aprovação.");
            }
            if (codigoInput) codigoInput.value = '';
            alternarTela('form-login');
        } else {
            alert(data.erro || "Não foi possível concluir o cadastro.");
        }
    } catch (e) {
        alert("Erro de conexão ao enviar o cadastro.");
    }
}

function alternarTemas() {
    const check = document.getElementById('toggle-temas'); const dot = document.querySelector('.toggle-dot');
    if(check && check.checked) {
        document.body.classList.add('hide-temas'); if(dot) dot.style.transform = 'translateX(100%)'; localStorage.setItem('hideTemas', 'true');
    } else {
        document.body.classList.remove('hide-temas'); if(dot) dot.style.transform = 'translateX(0)'; localStorage.setItem('hideTemas', 'false');
    }
}

// ==========================================
// PAINEL DE ADMINISTRAÇÃO AVANÇADO (DAVI)
// ==========================================
async function carregarConfigGlobal() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        const toggle = document.getElementById('toggle-ocultar-incompletas');
        if (toggle) toggle.checked = config.ocultar_incompletas || false;
    } catch(e) {}
}

async function carregarCodigoCadastro() {
    const input = document.getElementById('codigo-cadastro-admin');
    const status = document.getElementById('status-codigo-cadastro');
    if (!input) return;
    try {
        const res = await fetch('/api/admin/codigo-cadastro?username=' + encodeURIComponent(currentUser), {cache:'no-store'});
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Não foi possível carregar o código atual.');
        input.value = String(data.codigo || '');
        if (status) status.textContent = 'Código atual carregado. Você pode substituí-lo acima.';
    } catch (error) {
        if (status) status.textContent = error.message || 'Erro ao carregar o código.';
    }
}

async function salvarCodigoCadastro() {
    const input = document.getElementById('codigo-cadastro-admin');
    const status = document.getElementById('status-codigo-cadastro');
    const button = document.getElementById('btn-salvar-codigo-cadastro');
    if (!input) return;
    const codigo = input.value.trim();
    if (!/^\d{1,20}$/.test(codigo)) {
        if (status) status.textContent = 'Digite somente números (de 1 a 20 dígitos).';
        input.focus();
        return;
    }
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    try {
        const res = await fetch('/api/admin/codigo-cadastro', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: currentUser, codigo: codigo})
        });
        const data = await res.json();
        if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Não foi possível salvar o código.');
        if (status) status.textContent = 'Código atualizado. Novos cadastros usarão o novo código.';
        mostrarToast('Código de cadastro atualizado.');
    } catch (error) {
        if (status) status.textContent = error.message || 'Erro ao salvar o código.';
    } finally {
        if (button) { button.disabled = false; button.textContent = 'Salvar código'; }
    }
}

async function salvarConfigGlobal() {
    const toggle = document.getElementById('toggle-ocultar-incompletas');
    if(!toggle) return;
    const ocultar = toggle.checked;
    try {
        const res = await fetch('/api/admin/config', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: currentUser, ocultar_incompletas: ocultar})
        });
        if(!res.ok) { 
            alert("Erro ao salvar configuração!"); 
            toggle.checked = !ocultar; 
        } else {
            // ALERTA DE FEEDBACK NOVO AQUI:
            alert(`Configuração atualizada! Ocultar Questões Incompletas está: ${ocultar ? 'LIGADO' : 'DESLIGADO'}.\nIsso se aplicará instantaneamente a todos os usuários.`);
        }
    } catch(e) { alert("Erro de conexão."); toggle.checked = !ocultar; }
}

async function carregarPainelAdmin() {
    try {
        const resP = await fetch('/api/admin/pendentes'); const dataP = await resP.json(); const usersP = Object.keys(dataP);
        if(document.getElementById('contador-pendentes')) document.getElementById('contador-pendentes').innerText = `${usersP.length} na fila`;
        const contP = document.getElementById('lista-pendentes');
        if(contP) contP.innerHTML = usersP.length === 0 ? '<div class="text-gray-400 text-sm">Vazio.</div>' : usersP.map(u => `<div class="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center"><span class="font-bold text-gray-800">${u}</span><div class="flex gap-1"><button onclick="resolverPendente('${u}', 'aprovado')" class="bg-green-500 text-white px-2 py-1 rounded shadow-sm">✓</button><button onclick="resolverPendente('${u}', 'negado')" class="bg-red-500 text-white px-2 py-1 rounded shadow-sm">✗</button></div></div>`).join('');
        
        const resA = await fetch('/api/admin/usuarios_ativos'); const dataA = await resA.json(); const usersA = Object.keys(dataA);
        const contA = document.getElementById('lista-ativos');
        if(contA) contA.innerHTML = usersA.length === 0 ? '<div class="text-gray-400 text-sm">Nenhum outro usuário.</div>' : usersA.map(u => {
            const block = dataA[u].status === 'bloqueado';
            return `<div class="p-3 ${block ? 'bg-red-50' : 'bg-gray-50'} border border-gray-100 rounded-xl flex flex-col gap-2"><div class="flex justify-between items-center"><div><span class="font-bold ${block ? 'text-red-900' : 'text-gray-800'}">${u}</span><span class="text-[10px] ml-2 ${block ? 'text-red-500' : 'text-green-500'}">${block ? 'Bloqueado' : 'Ativo'}</span></div><div class="flex gap-1"><button onclick="resolverPendente('${u}', '${block ? 'aprovado' : 'bloqueado'}')" class="${block ? 'bg-green-500' : 'bg-orange-500'} text-white px-2 py-1 rounded text-xs font-bold shadow-sm">${block ? 'Desbloq.' : 'Bloquear'}</button><button onclick="excluirUsuario('${u}')" class="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Excluir</button></div></div></div>`;
        }).join('');
    } catch(e) {}

    try {
        const resR = await fetch('/api/admin/reportes'); const reps = await resR.json();
        const contR = document.getElementById('lista-reportes');
        if(contR) contR.innerHTML = reps.length === 0 ? '<div class="text-gray-400 text-sm">Nenhuma reclamação registrada.</div>' : reps.map(r => `
            <div class="p-4 bg-red-50 border border-red-100 rounded-xl text-sm mb-3 shadow-sm">
                <div class="flex justify-between font-black text-red-900 mb-2 border-b border-red-200 pb-2">
                    <span>ID Questão: ${r.id_questao}</span><span class="text-xs font-medium text-red-500">${r.data}</span>
                </div>
                <p class="text-gray-800"><span class="font-bold text-gray-900">Usuário: ${r.usuario}</span><br>Motivo: ${r.erro}</p>
            </div>`).reverse().join('');
    } catch(e) {}

    try {
        const resE = await fetch('/api/admin/estatisticas_usuarios'); const stats = await resE.json();
        const contE = document.getElementById('tabela-usuarios-body');
        if(contE) {
            contE.innerHTML = stats.length === 0 ? '<tr><td colspan="4" class="p-4 text-center text-gray-400">Nenhum usuário cadastrado.</td></tr>' : stats.map(s => `
                <tr class="hover:bg-blue-50 transition">
                    <td class="p-4 font-bold text-gray-900">${s.usuario}</td>
                    <td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold ${s.status === 'aprovado' ? 'bg-green-100 text-green-700' : (s.status === 'bloqueado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}">${s.status}</span></td>
                    <td class="p-4 text-center font-black text-blue-600">${s.questoes_respondidas}</td>
                    <td class="p-4 text-right text-xs text-gray-500 font-medium">${s.ultimo_acesso}</td>
                </tr>`).join('');
        }
    } catch(e) {}
}

async function resolverPendente(user, acao) { await fetch('/api/admin/resolver', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, acao: acao}) }); carregarPainelAdmin(); }
async function excluirUsuario(user) { if(confirm(`Apagar '${user}'?`)) { await fetch('/api/admin/excluir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user}) }); carregarPainelAdmin(); } }
async function carregarLogsServidor() { try { const res = await fetch('/api/admin/logs'); const logs = await res.json(); const container = document.getElementById('server-logs'); if(!container) return; let htmlLogs = logs.map(linha => { if (linha.includes("EXCLUÍDO") || linha.includes("[ERRO CRÍTICO]")) return `<div class="text-red-400 font-bold">${linha}</div>`; if (linha.includes("[OK]")) return `<div class="text-green-300">${linha}</div>`; return `<div>${linha}</div>`; }).join(''); const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight; container.innerHTML = htmlLogs || '<div class="text-gray-500">Aguardando...</div>'; if (isAtBottom) container.scrollTop = container.scrollHeight; } catch(e) {} }

// ==========================================
// FILTROS AVANÇADOS
// ==========================================
let categoriasDB = {};
const getSelectedValues = (id) => { const el = document.getElementById(id); return el ? Array.from(el.selectedOptions).map(opt => opt.value).filter(v => v !== 'todas') : []; };

async function carregarFiltros() {
    try {
        const res = await fetch('/api/categorias'); categoriasDB = await res.json();
        const sMat = document.getElementById('f-mat'); if(!sMat) return;
        sMat.innerHTML = ''; Object.keys(categoriasDB).sort().forEach(m => { sMat.innerHTML += `<option value="${m}">${m} (${categoriasDB[m].count})</option>`; });
        sMat.addEventListener('change', () => {
            const mats = getSelectedValues('f-mat'); const sAss = document.getElementById('f-ass'); const sSub = document.getElementById('f-sub');
            sAss.innerHTML = ''; sSub.innerHTML = ''; sSub.disabled = true;
            if (mats.length > 0) { mats.forEach(mat => { Object.keys(categoriasDB[mat].assuntos).sort().forEach(a => { sAss.innerHTML += `<option value="${a}">${a} (${categoriasDB[mat].assuntos[a].count})</option>`; }); }); sAss.disabled = false; }
        });
        document.getElementById('f-ass').addEventListener('change', () => {
            const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const sSub = document.getElementById('f-sub');
            sSub.innerHTML = '';
            if (asss.length > 0) { mats.forEach(mat => { asss.forEach(ass => { if(categoriasDB[mat].assuntos[ass]) { Object.keys(categoriasDB[mat].assuntos[ass].subs).sort().forEach(s => { sSub.innerHTML += `<option value="${s}">${s} (${categoriasDB[mat].assuntos[ass].subs[s]})</option>`; }); } }); }); sSub.disabled = false; }
        });
        renderizarHistoricoFiltros();
    } catch(e) {}
}

async function aplicarFiltros(pagina = 1) {
    paginaAtual = pagina;
    const limit = document.getElementById('limite-pagina') ? document.getElementById('limite-pagina').value : 20;
    const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const subs = getSelectedValues('f-sub');
    const statusBox = document.getElementById('f-status'); const statusProg = statusBox && statusBox.value ? statusBox.value : 'todas';
    const palavra = document.getElementById('f-busca') ? document.getElementById('f-busca').value.trim() : "";
    
    const feitas = Object.keys(progressoUsuario);
    const erradas = feitas.filter(id => progressoUsuario[id].acertou === false);

    const aviso = document.getElementById('aviso-aleatorio');
    if (aviso) { (mats.length > 0 || palavra || statusProg !== 'todas') ? aviso.classList.add('hidden') : aviso.classList.remove('hidden'); }
    
    const payload = { pagina: paginaAtual, limite: parseInt(limit), materia: mats, assunto: asss, subassunto: subs, palavraChave: palavra, statusProgresso: statusProg, feitas_ids: feitas, erradas_ids: erradas, metadados: coletarMetadadosSelecionados(), filtrosAvancados: coletarFiltrosAvancados() };
    if(pagina === 1 && (mats.length > 0 || palavra || statusProg !== 'todas')) { registrarHistoricoFiltro(payload); }

    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        renderizarQuestoesUI(dados.questoes, false); renderizarPaginacaoUI(dados.total, parseInt(limit));
        const contador=document.getElementById('questoes-count'); if(contador) contador.textContent=Number(dados.total||0).toLocaleString('pt-BR'); atualizarResumoFiltros();
        // Mantém a posição atual da página após carregar o resultado da busca.
    } catch(e) {}
}

function resumoVisualFiltroRecente(config = {}) {
    const lista = valor => Array.isArray(valor) ? valor.filter(Boolean).map(String) : (valor ? [String(valor)] : []);
    const materias = lista(config.materia);
    const assuntos = lista(config.assunto);
    const subassuntos = lista(config.subassunto);
    const palavra = String(config.palavraChave || '').trim();
    const statusLabels = { ineditas: 'Questões inéditas', feitas: 'Questões já feitas', erradas: 'Questões erradas' };
    const status = statusLabels[config.statusProgresso] || '';

    const titulo = assuntos.length ? assuntos.join(', ')
        : materias.length ? materias.join(', ')
        : palavra ? palavra
        : status || 'Questões filtradas';

    const detalhes = [];
    if (assuntos.length && materias.length) detalhes.push(materias.join(', '));
    if (subassuntos.length) detalhes.push(subassuntos.length === 1 ? subassuntos[0] : subassuntos.length + ' subassuntos');
    if (palavra && titulo !== palavra) detalhes.push('Busca: ' + palavra);
    if (status && titulo !== status) detalhes.push(status.replace(/^Questões /, ''));
    return { titulo, detalhe: detalhes.slice(0, 2).join(' · ') };
}

function registrarHistoricoFiltro(f) {
    const resumo = resumoVisualFiltroRecente(f);
    if (!resumo.titulo.trim()) return;
    const assinatura = JSON.stringify([resumo.titulo, resumo.detalhe]);
    const resumoAnterior = historicoUsuario.length ? resumoVisualFiltroRecente(historicoUsuario[0].config || {}) : null;
    if (resumoAnterior && JSON.stringify([resumoAnterior.titulo, resumoAnterior.detalhe]) === assinatura) return;

    historicoUsuario = [
        { rotulo: resumo.titulo, config: f },
        ...historicoUsuario.filter(item => {
            const existente = resumoVisualFiltroRecente(item.config || {});
            return JSON.stringify([existente.titulo, existente.detalhe]) !== assinatura;
        })
    ].slice(0, 8);
    syncDB('historico', historicoUsuario);
    renderizarHistoricoFiltros();
}

function renderizarHistoricoFiltros() {
    const ctr1 = document.getElementById('historico-container');
    const ctr2 = document.getElementById('historico-container-mobile');
    const vazio = '<p class="question-recent-filter-empty">Nenhum filtro recente</p>';
    const html = historicoUsuario.length === 0 ? vazio : historicoUsuario.map((h, i) => {
        const resumo = resumoVisualFiltroRecente(h.config || {});
        const titulo = textoSeguro(resumo.titulo);
        const detalhe = textoSeguro(resumo.detalhe);
        return '<button type="button" onclick="aplicarHistorico(' + i + ')" class="question-recent-filter" title="' + titulo + '" aria-label="Reaplicar filtros: ' + titulo + '">' +
            '<span class="question-recent-filter-title">' + titulo + '</span>' +
            (detalhe ? '<span class="question-recent-filter-detail">' + detalhe + '</span>' : '') +
            '</button>';
    }).join('');
    if (ctr1) ctr1.innerHTML = html;
    if (ctr2) ctr2.innerHTML = html;
}

function aplicarHistorico(index) {
    if(!historicoUsuario[index]) return; const conf = historicoUsuario[index].config;
    if(document.getElementById('f-busca')) document.getElementById('f-busca').value = conf.palavraChave || "";
    if(document.getElementById('f-status')) document.getElementById('f-status').value = conf.statusProgresso || "todas";
    fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(conf) }).then(res => res.json()).then(dados => {
        if(document.getElementById('aviso-aleatorio')) document.getElementById('aviso-aleatorio').classList.add('hidden');
        renderizarQuestoesUI(dados.questoes, false); renderizarPaginacaoUI(dados.total, conf.limite);
    });
}

// ==========================================
// CADERNOS
// ==========================================
function abrirModalCaderno() { document.getElementById('modal-caderno').classList.replace('hidden', 'flex'); document.body.classList.add('overflow-hidden'); }
function fecharModalCaderno() { document.getElementById('modal-caderno').classList.replace('flex', 'hidden'); document.body.classList.remove('overflow-hidden'); document.getElementById('nome-caderno').value = ""; document.getElementById('qtd-caderno').value = ""; }

async function salvarCaderno() {
    const nome = document.getElementById('nome-caderno').value.trim(); const qtd = parseInt(document.getElementById('qtd-caderno').value);
    if(!nome || !qtd || qtd <= 0) return alert("Preencha nome e quantidade válida.");
    
    document.getElementById('btn-salvar-caderno').innerText = "Processando...";
    const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const subs = getSelectedValues('f-sub');
    const palavra = document.getElementById('f-busca') ? document.getElementById('f-busca').value.trim() : "";
    const statusBox = document.getElementById('f-status'); const statusProg = statusBox ? statusBox.value : 'todas';
    const feitas = Object.keys(progressoUsuario); const erradas = feitas.filter(id => progressoUsuario[id].acertou === false);
    
    const payload = { pagina: 1, limite: 10000, materia: mats, assunto: asss, subassunto: subs, palavraChave: palavra, statusProgresso: statusProg, feitas_ids: feitas, erradas_ids: erradas };
    
    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        document.getElementById('btn-salvar-caderno').innerText = "Criar Caderno";
        if (dados.questoes.length === 0) return alert("Nenhuma questão encontrada para este filtro.");
        
        let sorteio = dados.questoes.sort(() => 0.5 - Math.random()).slice(0, qtd);
        cadernosUsuario.push({ id: Date.now().toString(), nome: nome, data: new Date().toLocaleDateString('pt-BR'), questoes: sorteio });
        syncDB('cadernos', cadernosUsuario);
        fecharModalCaderno(); alert(`Sucesso! Caderno "${nome}" criado com ${sorteio.length} questões.`);
    } catch(e) { alert("Erro ao criar caderno."); document.getElementById('btn-salvar-caderno').innerText = "Criar Caderno"; }
}

function renderizarListaCadernos() {
    const container = document.getElementById('lista-cadernos'); if(!container) return;
    if (cadernosUsuario.length === 0) { container.innerHTML = `<div class="col-span-full p-10 bg-white rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">Você não tem cadernos salvos. Crie um na aba de Questões.</div>`; return; }
    container.innerHTML = cadernosUsuario.map(c => `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:border-yellow-400 transition transform hover:-translate-y-1">
            <h3 class="text-xl font-bold text-gray-900 mb-1">${c.nome}</h3><p class="text-xs text-gray-400 font-medium mb-5">Criado em ${c.data} • ${c.questoes.length} questões</p>
            <div class="mt-auto flex gap-2">
                <button onclick="abrirCaderno('${c.id}')" class="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition shadow-sm">Iniciar Resolução</button>
                <button onclick="excluirCaderno('${c.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-3 rounded-xl text-sm transition shadow-sm"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
        </div>`).reverse().join('');
}

function abrirCaderno(id) {
    let cad = cadernosUsuario.find(c => c.id === id); if(!cad) return;
    document.getElementById('lista-cadernos').classList.add('hidden'); document.getElementById('caderno-ativo-container').classList.remove('hidden');
    document.getElementById('titulo-caderno-ativo').innerText = `Resolvendo: ${cad.nome}`;
    renderizarQuestoesUI(cad.questoes, true); 
}

function fecharCaderno() { document.getElementById('lista-cadernos').classList.remove('hidden'); document.getElementById('caderno-ativo-container').classList.add('hidden'); document.getElementById('questoes-container').innerHTML = ''; }
function excluirCaderno(id) { if(!confirm("Apagar este caderno definitivo?")) return; cadernosUsuario = cadernosUsuario.filter(c => c.id !== id); syncDB('cadernos', cadernosUsuario); renderizarListaCadernos(); }

// ==========================================
// RENDERIZAÇÃO MESTRE & ESTATÍSTICAS
// ==========================================
function renderizarQuestoesUI(questoes, isCaderno = false) {
    const container = document.getElementById('questoes-container'); if(!container) return; container.innerHTML = '';
    if(!questoes || questoes.length === 0) { container.innerHTML = '<div class="p-8 bg-white rounded-2xl text-center text-gray-500 font-medium">Nenhuma questão encontrada com estes filtros.</div>'; return; }

    questoes.forEach((q, idx) => {
        const status = progressoUsuario[q.id];
        const respostaAnterior = Boolean(status && status.timestamp && status.escolhida && status.escolhida !== '-');
        const classeResultado = respostaAnterior ? (status.acertou ? 'question-result-correct' : 'question-result-wrong') : 'is-hidden';
        const textoResultado = respostaAnterior ? (status.acertou ? 'Você Acertou' : 'Você Errou') : '';
        const tag = `<div id="resultado-questao-${q.id}" class="question-result-tag ${classeResultado}" role="status" aria-live="polite">${textoResultado}</div>`;

        let textoEnunciado = q.enunciado.replace(/^Enunciado\s*:\s*/i, '');
        let prefixoNumeracao = isCaderno ? `<span class="font-black text-blue-600 block mb-2 md:inline md:mr-2">Questão ${idx + 1}:</span>` : '';

        let alts = `<div class="mt-6 space-y-3 w-full" id="alts-${q.id}">`;
        q.alternativas.forEach(alt => {
            const letra = alt.charAt(0);
            const btnClasses = "w-full text-justify p-4 border rounded-xl transition-all duration-300 text-base md:text-lg break-words shadow-sm font-medium bg-gray-50 border-gray-200 hover:border-green-400 hover:bg-white text-gray-800 ";
            alts += `<button id="btn-${q.id}-${letra}" onclick="responderMestre('${q.id}', '${letra}', '${q.gabarito_letra}')" class="${btnClasses}">${alt}</button>`;
        });
        alts += `</div>`;

        const iconeBandeira = `<svg class="w-6 h-6 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>`;
        const btnReport = `<button type="button" onclick="document.getElementById('report-box-${q.id}').classList.toggle('hidden')" class="resp-question-action resp-question-report" title="Reportar erro" aria-label="Reportar erro">${iconeBandeira}<span class="sr-only">Reportar erro</span></button>`;
        const boxReport = `<div id="report-box-${q.id}" class="hidden mt-4 p-5 bg-red-50 border border-red-100 rounded-xl animate-fade-in w-full"><p class="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">Reportar Problema</p><textarea id="texto-report-${q.id}" rows="2" class="w-full p-4 rounded-xl border border-red-200 text-base outline-none focus:ring-2 focus:ring-red-400 resize-none shadow-sm" placeholder="Ex: Gabarito incorreto..."></textarea><div class="flex justify-end gap-3 mt-3"><button onclick="document.getElementById('report-box-${q.id}').classList.add('hidden')" class="text-base text-gray-500 hover:underline px-3 font-medium">Cancelar</button><button onclick="enviarReporte('${q.id}')" class="text-base bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2 rounded-xl transition shadow-sm">Enviar ao Suporte</button></div></div>`;
        const btnRes = `<div class="question-controls-footer mt-6 w-full border-t border-gray-100 pt-4"><button type="button" onclick="mostrarResolucao('${q.id}', false)" class="question-resolution-link">Ver Resolução</button><div class="resp-question-actions">${btnReport}</div></div>`;
        const comHtml = `<div id="com-${q.id}" class="hidden mt-4 p-6 bg-blue-50 border border-blue-100 rounded-xl text-justify animate-fade-in w-full shadow-sm"><p class="font-black text-blue-900 mb-3 text-base md:text-lg">Gabarito: ${q.gabarito_letra}</p><p class="text-gray-800 leading-relaxed text-base break-words font-medium">${q.comentario}</p></div>`;

        container.innerHTML += `<div class="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200 mb-8 relative w-full">${tag}<div class="tema-dinamico-badge text-xs text-blue-500 bg-blue-50 inline-block px-3 py-1 rounded-full mb-4 font-bold tracking-widest uppercase break-words border border-blue-100">${q.temas_dinamicos.join(' • ')}</div><p class="text-base md:text-lg text-justify leading-relaxed font-bold text-gray-900 break-words">${prefixoNumeracao}${textoEnunciado}</p>${alts}${btnRes}${boxReport}${comHtml}</div>`;
    });
}

function atualizarTagResultadoQuestao(id) {
    const tag = document.getElementById(`resultado-questao-${id}`);
    const status = progressoUsuario[id];
    if (!tag || !status || !status.escolhida || status.escolhida === '-') return;
    tag.className = 'question-result-tag ' + (status.acertou ? 'question-result-correct' : 'question-result-wrong');
    tag.textContent = status.acertou ? 'Você Acertou' : 'Você Errou';
}

function responderMestre(id, escolhida, correta) {
    tentativasUsuario.unshift({id:String(id),escolhida:escolhida,correta:correta,acertou:(escolhida===correta),timestamp:Date.now()}); if(tentativasUsuario.length>1000)tentativasUsuario=tentativasUsuario.slice(0,1000); syncDB('tentativas',tentativasUsuario);
    progressoUsuario[id] = { acertou: (escolhida === correta), escolhida: escolhida, timestamp: Date.now() }; syncDB('progresso', progressoUsuario);
    atualizarTagResultadoQuestao(id);
    const botoes = document.getElementById(`alts-${id}`).getElementsByTagName('button');
    for (let btn of botoes) {
        btn.disabled = true; btn.classList.add('cursor-not-allowed', 'opacity-80'); btn.classList.remove('hover:border-green-400', 'hover:bg-white', 'text-gray-800');
        const letraBtn = btn.id.split('-').pop();
        if (letraBtn === correta) { btn.classList.add('bg-green-50', 'border-green-400', 'text-green-900', 'font-bold'); btn.classList.remove('bg-gray-50', 'border-gray-200', 'font-medium'); }
        else if (letraBtn === escolhida && escolhida !== correta) { btn.classList.add('bg-red-50', 'border-red-300', 'text-red-900', 'font-bold'); btn.classList.remove('bg-gray-50', 'border-gray-200', 'font-medium'); }
        else { btn.classList.add('text-gray-400'); }
    }
    mostrarResolucao(id, true); atualizarNumerosEstatisticas();
}

function mostrarResolucao(id, autoAberta = false) {
    const box = document.getElementById(`com-${id}`);
    if (box) box.classList.remove('hidden');
}

async function enviarReporte(id) { const tb = document.getElementById(`texto-report-${id}`); const motivo = tb.value.trim(); if (!motivo) return alert("Descreva o erro."); try { await fetch('/api/reportar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: id, motivo: motivo, usuario: currentUser }) }); document.getElementById(`report-box-${id}`).classList.add('hidden'); tb.value = ''; alert("Erro reportado na nuvem com sucesso!"); } catch(e) {} }

function atualizarNumerosEstatisticas() {
    const ids = Object.keys(progressoUsuario); 
    let acertos = 0; 
    ids.forEach(id => { if (progressoUsuario[id].acertou) acertos++; });
    let erros = ids.length - acertos;
    
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = ids.length;
    if(document.getElementById('stat-acertos')) document.getElementById('stat-acertos').innerText = acertos;
    if(document.getElementById('stat-erros')) document.getElementById('stat-erros').innerText = erros;

    let taxa = ids.length > 0 ? Math.round((acertos / ids.length) * 100) : 0;
    let gauge = document.getElementById('gauge-arc');
    let txtTaxa = document.getElementById('stat-taxa');
    
    if (gauge && txtTaxa) {
        txtTaxa.innerText = `${taxa}%`;
        let offset = 125.6 - (125.6 * (taxa / 100));
        gauge.style.strokeDashoffset = offset;
        
        if (taxa < 50) { gauge.setAttribute('stroke', '#EF4444'); txtTaxa.classList.replace('text-gray-800', 'text-red-600'); }
        else if (taxa < 75) { gauge.setAttribute('stroke', '#F59E0B'); txtTaxa.classList.replace('text-gray-800', 'text-yellow-600'); }
        else { gauge.setAttribute('stroke', '#10B981'); txtTaxa.classList.replace('text-gray-800', 'text-green-600'); }
    }
}

function renderizarPaginacaoUI(total, limit) {
    const container = document.getElementById('paginacao-container'); if(!container) return; container.innerHTML = '';
    const totalPags = Math.ceil(total / limit); if (totalPags <= 1) return;
    if (paginaAtual > 1) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual - 1})" class="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm font-bold">« Anterior</button>`;
    
    let mostrouUltima = false;
    for (let i = 1; i <= totalPags; i++) {
        if (i <= 3 || i === paginaAtual || i === paginaAtual - 1 || i === paginaAtual + 1) {
            const active = (i === paginaAtual) ? 'bg-green-600 text-white font-black border-green-600' : 'bg-white hover:bg-gray-50 text-gray-700 font-bold border-gray-200';
            container.innerHTML += `<button onclick="aplicarFiltros(${i})" class="w-10 h-10 border rounded-xl transition shadow-sm ${active}">${i}</button>`;
        } else if (i === 4 && paginaAtual < 3) { container.innerHTML += `<span class="px-2 text-gray-400 self-center">...</span>`; mostrouUltima = true; break;
        } else if (i > paginaAtual + 1 && i < totalPags) { if (!mostrouUltima) { container.innerHTML += `<span class="px-2 text-gray-400 self-center">...</span>`; mostrouUltima = true; } }
    }
    if (mostrouUltima || paginaAtual < totalPags - 1) container.innerHTML += `<button onclick="aplicarFiltros(${totalPags})" class="w-10 h-10 border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm font-bold">${totalPags}</button>`;
    if (paginaAtual < totalPags) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual + 1})" class="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm font-bold">Próxima »</button>`;
}

async function gerarPDF() {
    alert("Iniciando geração do PDF...");
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const payload = { pagina: 1, limite: 100, materia: getSelectedValues('f-mat') };
    const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const dados = await res.json();
    let y = 20; let gabaritoArr = [];
    doc.setFontSize(16); doc.text("RESPdi - Simulado", 10, y); y += 10; doc.setFontSize(10);
    dados.questoes.forEach((q, idx) => {
        gabaritoArr.push([idx + 1, q.gabarito_letra]);
        let textoQuestao = `Questao ${idx + 1}: ${q.enunciado.replace(/^Enunciado\s*:\s*/i, '')}\n`;
        q.alternativas.forEach(alt => textoQuestao += `${alt}\n`);
        const lines = doc.splitTextToSize(textoQuestao, 180);
        if (y + (lines.length * 5) > 280) { doc.addPage(); y = 20; }
        doc.text(lines, 10, y); y += (lines.length * 5) + 10;
    });
    doc.addPage(); doc.text("Gabarito do Simulado", 10, 20);
    doc.autoTable({ startY: 30, head: [['Questao', 'Alternativa Correta']], body: gabaritoArr });
    doc.save("Simulado_RESPdi.pdf");
}

document.addEventListener("DOMContentLoaded", async () => {
    if (currentUser !== 'visitante') {
        try {
            const res = await fetch(`/api/sync/${currentUser}`); const data = await res.json();
            progressoUsuario = data.progresso || {}; cadernosUsuario = data.cadernos || []; historicoUsuario = data.historico || []; listasUsuario = data.listas || []; simuladosUsuario = data.simulados || []; favoritosUsuario = data.favoritos || []; tentativasUsuario = data.tentativas || []; anotacoesUsuario = data.anotacoes || []; agendaUsuario = data.agenda || []; leitorConcluidoUsuario = data.leitorConcluido || false;
        } catch(e) {}
    }
    atualizarNumerosEstatisticas();
    if(document.getElementById('sidebar-avatar') && currentUser) document.getElementById('sidebar-avatar').innerText = currentUser.charAt(0).toUpperCase();
    const topbarUsername = document.getElementById('topbar-username');
    const topbarAvatar = document.getElementById('topbar-avatar');
    if(topbarUsername && currentUser !== 'visitante') topbarUsername.innerText = currentUser;
    if(topbarAvatar && currentUser) topbarAvatar.innerText = currentUser.charAt(0).toUpperCase();
    if (currentUser === 'davi' && document.getElementById('admin-panel')) { 
        document.getElementById('admin-panel').classList.remove('hidden'); 
        carregarConfigGlobal();
        carregarCodigoCadastro();
        carregarPainelAdmin(); 
        carregarLogsServidor(); 
        setInterval(carregarLogsServidor, 3000); 
    }
    if(document.getElementById('f-mat')) { carregarFiltros().then(async () => { await carregarOpcoesMetadados(); bindQuestionFilterInterface(); const p=new URLSearchParams(location.search); const mat=p.get('materia'); if(mat){const el=document.getElementById('f-mat');Array.from(el.options).forEach(o=>{o.selected=o.value===mat;});el.dispatchEvent(new Event('change'));} await aplicarFiltros(1); const pending=p.get('acao')||localStorage.getItem('respPendingCollection'); if(pending==='lista')setTimeout(abrirModalLista,150); if(pending==='simulado')setTimeout(abrirModalSimulado,150); }); }
    if(document.getElementById('lista-cadernos')) { renderizarListaCadernos(); }
    if(document.getElementById('listas-table-body')) { renderizarGerenciadorListas(); document.getElementById('busca-listas')?.addEventListener('input',renderizarGerenciadorListas); document.getElementById('tipo-listas')?.addEventListener('change',renderizarGerenciadorListas); document.getElementById('ordenar-listas')?.addEventListener('click',e=>{const b=e.currentTarget;b.dataset.order=b.dataset.order==='desc'?'asc':'desc';b.textContent=b.dataset.order==='desc'?'Criação ↓':'Criação ↑';renderizarGerenciadorListas();}); }
    renderizarResumoDesempenho(); renderizarEstudosEmAndamento(); renderizarCatalogoMaterias(); renderizarListaFavoritos(); renderizarAgendaDashboard();
    const reader=document.getElementById('ldi-anotacao'); if(reader){const note=anotacoesUsuario.find(n=>n.chave==='leitor-geral');if(note)reader.value=note.texto||'';fonteLeitorUsuario=parseInt(localStorage.getItem('respReaderFont')||'16',10);ajustarFonteLeitor(0);const status=document.getElementById('ldi-status'),btn=document.getElementById('btn-concluir-leitura');if(status)status.textContent=leitorConcluidoUsuario?'Leitura marcada como concluída':'Leitura não concluída';if(btn)btn.textContent=leitorConcluidoUsuario?'✓ Concluído':'○ Concluir';}
});


function textoSeguro(v){return String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function valorSelecionado(id){const el=document.getElementById(id);return el?String(el.value||'').trim():'';}
function valoresSelecionados(id){const el=document.getElementById(id);return el?Array.from(el.selectedOptions).map(o=>o.value).filter(Boolean):[];}
function mostrarToast(msg, opcoes = {}) {
    let host = document.getElementById('resp-notification-stack');
    if (!host) {
        host = document.createElement('div');
        host.id = 'resp-notification-stack';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-relevant', 'additions');
        host.setAttribute('aria-atomic', 'false');
        document.body.appendChild(host);
    }
    const card = document.createElement('article');
    card.className = 'resp-notification';
    card.setAttribute('role', 'status');
    card.innerHTML = `
        <span class="resp-notification-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg></span>
        <span class="resp-notification-copy"><strong class="resp-notification-title"></strong><span class="resp-notification-message"></span></span>
        <button type="button" class="resp-notification-close" aria-label="Fechar notificação">×</button>`;
    card.querySelector('.resp-notification-title').textContent = String(opcoes.titulo || 'RESPdi');
    card.querySelector('.resp-notification-message').textContent = String(msg == null ? '' : msg);
    let removendo = false;
    const remover = () => {
        if (removendo) return;
        removendo = true;
        clearTimeout(card._respNotificationTimer);
        card.classList.add('is-leaving');
        setTimeout(() => card.remove(), 220);
    };
    card.querySelector('.resp-notification-close').addEventListener('click', remover);
    card._respNotificationTimer = setTimeout(remover, 4500);
    host.appendChild(card);
    while (host.children.length > 4) host.firstElementChild.remove();
}
function executarAcaoModulo(acao){const routes={questoes:'/questoes',cadernos:'/cadernos',listas:'/listas',desempenho:'/desempenho',favoritos:'/favoritos',cursos:'/cursos',ldi:'/ldi'};if(routes[acao]){window.location.href=routes[acao];return;}mostrarNotificacoes();}
function mostrarNotificacoes(){mostrarToast('Você não tem notificações novas.');}
function coletarMetadadosSelecionados(){return{instituicao:valoresSelecionados('f-inst'),ano:valoresSelecionados('f-ano'),regiao:valoresSelecionados('f-regiao'),finalidade:valoresSelecionados('f-finalidade'),professor:valoresSelecionados('f-professor')};}
function coletarFiltrosAvancados(){return{tipos:Array.from(document.querySelectorAll('input[name="f-tipo"]:checked')).map(e=>e.value),solucaoTexto:valorSelecionado('f-solucao-texto'),video:valorSelecionado('f-video'),vigencia:valorSelecionado('f-vigencia')};}
function atualizarResumoFiltros(){
 const box=document.getElementById('question-filter-summary-chips');if(!box)return;const chips=[];
 [['Status','f-status',false],['Matéria','f-mat',true],['Assunto','f-ass',true],['Subassunto','f-sub',true],['Instituição','f-inst',true],['Ano','f-ano',true],['Região','f-regiao',true],['Finalidade','f-finalidade',true],['Professor','f-professor',true]].forEach(s=>{const el=document.getElementById(s[1]);if(!el)return;const opts=s[2]?Array.from(el.selectedOptions):(el.value&&el.value!=='todas'?[el.options[el.selectedIndex]]:[]);opts.forEach(o=>{if(o&&o.value)chips.push({id:s[1],value:o.value,text:o.textContent.trim()});});});
 const word=valorSelecionado('f-busca');if(word)chips.push({id:'f-busca',value:word,text:'“'+word+'”'});
 document.querySelectorAll('input[name="f-tipo"]:checked').forEach(e=>chips.push({id:'f-tipo',value:e.value,text:e.parentElement.textContent.trim()}));
 [['f-solucao-texto','Solução'],['f-video','Vídeo'],['f-vigencia','Vigência']].forEach(s=>{const el=document.getElementById(s[0]);if(el&&el.value)chips.push({id:s[0],value:el.value,text:el.options[el.selectedIndex].textContent.trim()});});
 box.innerHTML=chips.length?chips.map(c=>'<button type="button" class="question-filter-chip" data-chip-id="'+textoSeguro(c.id)+'" data-chip-value="'+textoSeguro(c.value)+'"><span>'+textoSeguro(c.text)+'</span><b>×</b></button>').join(''):'<span class="question-summary-empty">Sem filtros adicionais. O banco inteiro está selecionado.</span>';
}
function removerFiltroQuestao(id,value){
 const el=document.getElementById(id);
 if(id==='f-tipo')document.querySelectorAll('input[name="f-tipo"]').forEach(x=>{if(x.value===value)x.checked=false;});
 else if(el&&el.multiple)Array.from(el.options).forEach(x=>{if(x.value===value)x.selected=false;});
 else if(el)el.value=id==='f-status'?'todas':'';
 if(id==='f-mat'){document.getElementById('f-ass').innerHTML='';document.getElementById('f-ass').disabled=true;document.getElementById('f-sub').innerHTML='';document.getElementById('f-sub').disabled=true;el?.dispatchEvent(new Event('change'));}
 if(id==='f-ass'){document.getElementById('f-sub').innerHTML='';document.getElementById('f-sub').disabled=true;el?.dispatchEvent(new Event('change'));}
 atualizarResumoFiltros();if(document.getElementById('f-mat'))aplicarFiltros(1);
}
function redefinirFiltrosQuestao(){
 ['f-inst','f-ano','f-regiao','f-finalidade','f-professor','f-ass','f-sub'].forEach(id=>{const el=document.getElementById(id);if(el)Array.from(el.options).forEach(o=>o.selected=false);});
 ['f-solucao-texto','f-video','f-vigencia'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
 document.querySelectorAll('input[name="f-tipo"]').forEach(el=>el.checked=false);
 if(document.getElementById('f-status'))document.getElementById('f-status').value='todas';
 if(document.getElementById('f-busca'))document.getElementById('f-busca').value='';
 const mat=document.getElementById('f-mat');if(mat)Array.from(mat.options).forEach(o=>o.selected=false);
 atualizarResumoFiltros();if(mat)aplicarFiltros(1);
}
function bindQuestionFilterInterface(){
 document.querySelectorAll('[data-filter-tab]').forEach(btn=>btn.addEventListener('click',()=>{const target=btn.dataset.filterTab;document.querySelectorAll('[data-filter-tab]').forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',on?'true':'false');});document.querySelectorAll('[data-filter-group]').forEach(g=>{g.hidden=g.dataset.filterGroup!==target;g.classList.toggle('is-active',g.dataset.filterGroup===target);});}));
 document.querySelectorAll('.question-filter-group select,#f-busca,input[name="f-tipo"]').forEach(el=>{el.addEventListener('change',atualizarResumoFiltros);el.addEventListener('input',atualizarResumoFiltros);});
 const chips=document.getElementById('question-filter-summary-chips');if(chips)chips.addEventListener('click',e=>{const b=e.target.closest('[data-chip-id]');if(b)removerFiltroQuestao(b.dataset.chipId,b.dataset.chipValue);});
 atualizarResumoFiltros();
}
async function carregarOpcoesMetadados(){
 const ids={instituicao:'f-inst',ano:'f-ano',regiao:'f-regiao',finalidade:'f-finalidade',professor:'f-professor'};
 try{
  const response=await fetch('/api/questao-filtros');const data=await response.json();
  Object.keys(ids).forEach(k=>{const el=document.getElementById(ids[k]);if(!el)return;el.innerHTML='';const opts=data.opcoes&&data.opcoes[k]?data.opcoes[k]:[];
   if(!opts.length){const o=document.createElement('option');o.value='';o.textContent='Sem metadados disponíveis nesta base';o.disabled=true;el.appendChild(o);el.disabled=true;const help=document.querySelector('[data-metadata-help="'+k+'"]');if(help)help.textContent='A base atual não fornece os dados necessários para este filtro.';}
   else{opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});el.disabled=false;}
  });
  const av=data.disponibilidade||{};const video=document.getElementById('f-video');if(video&&!av.video){video.disabled=true;const h=document.getElementById('advanced-filter-help');if(h)h.textContent='Não há metadados de vídeo disponíveis; o controle fica desativado até existir essa informação.';}
  const vig=document.getElementById('f-vigencia');if(vig&&!av.vigencia)Array.from(vig.options).forEach(o=>{if(o.value==='desatualizadas')o.disabled=true;});
 }catch(e){Object.values(ids).forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=true;el.innerHTML='<option>Metadados indisponíveis</option>';}});}
}
function montarPayloadFiltroCompleto(limite){
 const feitas=Object.keys(progressoUsuario||{}),erradas=feitas.filter(id=>progressoUsuario[id]&&progressoUsuario[id].acertou===false),st=document.getElementById('f-status');
 return{pagina:1,limite:limite||1000,materia:getSelectedValues('f-mat'),assunto:getSelectedValues('f-ass'),subassunto:getSelectedValues('f-sub'),palavraChave:valorSelecionado('f-busca'),statusProgresso:st&&st.value?st.value:'todas',feitas_ids:feitas,erradas_ids:erradas,metadados:coletarMetadadosSelecionados(),filtrosAvancados:coletarFiltrosAvancados()};
}
async function carregarQuestoesComFiltros(limit){const r=await fetch('/api/questoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(montarPayloadFiltroCompleto(limit))});const d=await r.json();if(!r.ok||d.erro_interno)throw new Error(d.erro_interno||'Não foi possível carregar questões.');return d;}
function abrirModalLista(){const el=document.getElementById('modal-lista');if(el){el.classList.remove('hidden');const inlineNaPaginaQuestoes=document.body.classList.contains('page-questions');if(!inlineNaPaginaQuestoes)document.body.classList.add('overflow-hidden');const input=document.getElementById('nome-lista');input?.focus();if(inlineNaPaginaQuestoes)el.scrollIntoView({behavior:'smooth',block:'nearest'});}}
function fecharModalLista(){document.getElementById('modal-lista')?.classList.add('hidden');document.body.classList.remove('overflow-hidden');}
async function salvarListaAtual(){
 const input=document.getElementById('nome-lista'),nome=input?input.value.trim():'';if(!nome){mostrarToast('Informe um nome para a lista.');input?.focus();return;}
 const btn=document.getElementById('btn-criar-lista');if(btn){btn.disabled=true;btn.textContent='Criando…';}
 try{const data=await carregarQuestoesComFiltros(1000);if(!data.questoes?.length){mostrarToast('Nenhuma questão corresponde aos filtros atuais.');return;}
 const folder=localStorage.getItem('respPastaDestino')||null;listasUsuario.push({id:Date.now().toString(),tipo:'lista',nome,data:new Date().toLocaleDateString('pt-BR'),criadaEm:Date.now(),questoes:data.questoes,filtro:montarPayloadFiltroCompleto(1000),pasta_id:folder});
 await syncDB('listas',listasUsuario);localStorage.removeItem('respPendingCollection');localStorage.removeItem('respPastaDestino');fecharModalLista();mostrarToast('Lista criada com '+data.questoes.length+' questões.');if(location.pathname==='/listas')renderizarGerenciadorListas();else if(confirm('Lista salva. Abrir Listas e Simulados?'))location.href='/listas';
 }catch(e){mostrarToast(e.message||'Erro ao criar a lista.');}finally{if(btn){btn.disabled=false;btn.textContent='Salvar lista';}}
}
function abrirModalSimulado(){const el=document.getElementById('modal-simulado');if(el){el.classList.remove('hidden');document.body.classList.add('overflow-hidden');document.getElementById('nome-simulado')?.focus();}}
function fecharModalSimulado(){document.getElementById('modal-simulado')?.classList.add('hidden');document.body.classList.remove('overflow-hidden');}
async function salvarSimuladoAtual(){
 const n=document.getElementById('nome-simulado'),nome=n?n.value.trim():'',h=parseInt(valorSelecionado('tempo-simulado-h')||'0',10),m=parseInt(valorSelecionado('tempo-simulado-m')||'0',10),q=parseInt(valorSelecionado('qtd-simulado')||'0',10),duration=h*60+m;
 if(!nome){mostrarToast('Informe um nome para o simulado.');n?.focus();return;}if(duration<=0||m<0||m>59||h<0||q<1||q>1000){mostrarToast('Revise o tempo e a quantidade de questões.');return;}
 const btn=document.getElementById('btn-criar-simulado');if(btn){btn.disabled=true;btn.textContent='Criando…';}
 try{const data=await carregarQuestoesComFiltros(Math.min(q,1000));if(!data.questoes?.length){mostrarToast('Nenhuma questão corresponde aos filtros atuais.');return;}
 const folder=localStorage.getItem('respPastaDestino')||null;simuladosUsuario.push({id:Date.now().toString(),tipo:'simulado',nome,data:new Date().toLocaleDateString('pt-BR'),criadaEm:Date.now(),duracaoMinutos:duration,questoes:data.questoes.slice(0,q),filtro:montarPayloadFiltroCompleto(Math.min(q,1000)),pasta_id:folder});
 await syncDB('simulados',simuladosUsuario);localStorage.removeItem('respPendingCollection');localStorage.removeItem('respPastaDestino');fecharModalSimulado();mostrarToast('Simulado criado com '+Math.min(q,data.questoes.length)+' questões.');if(location.pathname==='/listas')renderizarGerenciadorListas();else if(confirm('Simulado salvo. Abrir Listas e Simulados?'))location.href='/listas';
 }catch(e){mostrarToast(e.message||'Erro ao criar o simulado.');}finally{if(btn){btn.disabled=false;btn.textContent='Criar simulado';}}
}
function abrirCriacaoPorFiltro(tipo){localStorage.setItem('respPendingCollection',tipo);localStorage.setItem('respPastaDestino',new URLSearchParams(location.search).get('pasta')||'');window.location.href='/questoes?acao='+encodeURIComponent(tipo);}
function abrirModalPasta(){const el=document.getElementById('modal-pasta');if(el){el.classList.remove('hidden');document.body.classList.add('overflow-hidden');document.getElementById('nome-pasta')?.focus();}}
function fecharModalPasta(){document.getElementById('modal-pasta')?.classList.add('hidden');document.body.classList.remove('overflow-hidden');}
async function salvarPasta(){const input=document.getElementById('nome-pasta'),nome=input?input.value.trim():'';if(!nome){mostrarToast('Informe um nome para a pasta.');return;}listasUsuario.push({id:Date.now().toString(),tipo:'pasta',nome,data:new Date().toLocaleDateString('pt-BR'),criadaEm:Date.now(),pasta_id:new URLSearchParams(location.search).get('pasta')||null,questoes:[]});await syncDB('listas',listasUsuario);fecharModalPasta();input.value='';renderizarGerenciadorListas();mostrarToast('Pasta criada.');}
function itemPorId(id){return listasUsuario.find(i=>String(i.id)===String(id))||simuladosUsuario.find(i=>String(i.id)===String(id));}
function abrirPasta(id){location.href='/listas?pasta='+encodeURIComponent(id);}
function mostrarColecaoSalva(item){if(!item)return;['listas-table-container','listas-mobile-cards','listas-empty','listas-summary'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));const a=document.getElementById('colecao-ativa');if(!a)return;a.classList.remove('hidden');document.getElementById('colecao-titulo').textContent=item.nome;document.getElementById('colecao-tipo').textContent=item.tipo==='simulado'?'Simulado':'Lista de questões';document.getElementById('colecao-detalhes').textContent=(item.questoes||[]).length+' questões · '+(item.data||'');const t=document.getElementById('simulado-timer-container');if(item.tipo==='simulado'&&item.duracaoMinutos){t.classList.remove('hidden');iniciarCronometroSimulado(item);}else{t.classList.add('hidden');pararCronometroSimulado();}renderizarQuestoesUI(item.questoes||[],true);}
function fecharColecaoSalva(){pararCronometroSimulado();document.getElementById('colecao-ativa')?.classList.add('hidden');['listas-table-container','listas-mobile-cards','listas-summary'].forEach(id=>document.getElementById(id)?.classList.remove('hidden'));renderizarGerenciadorListas();}
function iniciarCronometroSimulado(item){pararCronometroSimulado();let rest=Math.max(0,Number(item.duracaoMinutos)||0)*60;const el=document.getElementById('simulado-timer');const draw=()=>{if(el){const h=Math.floor(rest/3600),m=Math.floor(rest%3600/60),s=rest%60;el.textContent=(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}};draw();temporizadorSimulado=setInterval(()=>{rest--;draw();if(rest<=0){pararCronometroSimulado();mostrarToast('O tempo configurado para o simulado terminou.');}},1000);}
function pararCronometroSimulado(){if(temporizadorSimulado){clearInterval(temporizadorSimulado);temporizadorSimulado=null;}}
function duplicarColecao(id,modo){const item=itemPorId(id);if(!item)return;let qs=item.questoes||[];if(modo==='erros')qs=qs.filter(q=>progressoUsuario[String(q.id)]&&progressoUsuario[String(q.id)].acertou===false);if(modo==='acertos')qs=qs.filter(q=>progressoUsuario[String(q.id)]&&progressoUsuario[String(q.id)].acertou===true);if(modo==='nao-respondidas')qs=qs.filter(q=>!progressoUsuario[String(q.id)]);if(modo==='respondidas')qs=qs.filter(q=>!!progressoUsuario[String(q.id)]);if(!qs.length){mostrarToast('Não há questões para duplicar com esse critério.');return;}const c=JSON.parse(JSON.stringify(item));c.id=Date.now().toString();c.nome=item.nome+' — '+(modo==='tudo'?'cópia':modo);c.data=new Date().toLocaleDateString('pt-BR');c.criadaEm=Date.now();c.questoes=qs;if(item.tipo==='simulado'){simuladosUsuario.push(c);syncDB('simulados',simuladosUsuario);}else{c.tipo='lista';listasUsuario.push(c);syncDB('listas',listasUsuario);}renderizarGerenciadorListas();mostrarToast('Cópia criada; a original foi preservada.');}
function editarColecao(id){const x=itemPorId(id);if(!x)return;const name=prompt('Novo nome:',x.nome);if(name===null)return;if(!name.trim()){mostrarToast('O nome não pode ficar vazio.');return;}x.nome=name.trim();syncDB(x.tipo==='simulado'?'simulados':'listas',x.tipo==='simulado'?simuladosUsuario:listasUsuario);renderizarGerenciadorListas();}
function excluirColecao(id){const x=itemPorId(id);if(!x||!confirm('Excluir "'+x.nome+'"? O histórico de respostas será preservado.'))return;if(x.tipo==='simulado'){simuladosUsuario=simuladosUsuario.filter(y=>String(y.id)!==String(id));syncDB('simulados',simuladosUsuario);}else{listasUsuario=listasUsuario.filter(y=>String(y.id)!==String(id));syncDB('listas',listasUsuario);}renderizarGerenciadorListas();mostrarToast('Coleção excluída.');}
function alternarMenuColecao(id){const e=document.getElementById('menu-colecao-'+id);if(!e)return;document.querySelectorAll('.resp-row-menu').forEach(m=>{if(m!==e)m.classList.add('hidden');});e.classList.toggle('hidden');}
function abrirItemColecao(id){const x=itemPorId(id);if(x&&x.tipo==='pasta')return abrirPasta(id);mostrarColecaoSalva(x);}
function renderizarGerenciadorListas(){
 const body=document.getElementById('listas-table-body');if(!body)return;const mob=document.getElementById('listas-mobile-cards'),params=new URLSearchParams(location.search),folder=params.get('pasta'),query=valorSelecionado('busca-listas').toLocaleLowerCase('pt-BR'),kind=valorSelecionado('tipo-listas')||'todos',order=document.getElementById('ordenar-listas')?.dataset.order||'desc';
 let rows=[...listasUsuario,...simuladosUsuario].filter(x=>String(x.pasta_id||'')===String(folder||''));const folders=listasUsuario.filter(x=>x.tipo==='pasta'&&String(x.pasta_id||'')===String(folder||''));if(kind!=='todos')rows=rows.filter(x=>x.tipo===kind);if(query)rows=rows.filter(x=>(x.nome||'').toLocaleLowerCase('pt-BR').includes(query));rows.sort((a,b)=>(Number(a.criadaEm||0)-Number(b.criadaEm||0))*(order==='asc'?1:-1));if(kind==='todos'||kind==='pasta')rows=[...folders.filter(x=>!query||x.nome.toLocaleLowerCase('pt-BR').includes(query)),...rows.filter(x=>x.tipo!=='pasta')];else rows=rows.filter(x=>x.tipo!=='pasta');
 const tq=document.getElementById('listas-total'),tq2=document.getElementById('listas-questoes-total');if(tq)tq.textContent=rows.length;if(tq2)tq2.textContent=rows.reduce((n,x)=>n+(x.questoes||[]).length,0);const empty=document.getElementById('listas-empty'),table=document.getElementById('listas-table-container');if(empty)empty.classList.toggle('hidden',rows.length>0);if(table)table.classList.toggle('hidden',rows.length===0);if(mob)mob.classList.toggle('hidden',rows.length===0);
 const crumb=document.getElementById('listas-breadcrumb');if(crumb){const parent=folder?itemPorId(folder):null;crumb.innerHTML='<a href="/listas">Listas e simulados</a><span>›</span><strong>'+textoSeguro(parent?parent.nome:'Início')+'</strong>';}
 function menu(x){const id=textoSeguro(x.id);return '<div class="resp-row-actions"><button class="resp-icon-button" onclick="alternarMenuColecao(\''+id+'\')" aria-label="Ações">⋮</button><div class="resp-row-menu hidden" id="menu-colecao-'+id+'">'+(x.tipo==='pasta'?'<button onclick="abrirPasta(\''+id+'\')">Abrir pasta</button>':'<button onclick="abrirItemColecao(\''+id+'\')">Abrir</button>')+'<button onclick="editarColecao(\''+id+'\')">Renomear</button>'+(x.tipo==='pasta'?'':'<button onclick="duplicarColecao(\''+id+'\',\'tudo\')">Duplicar</button><button onclick="duplicarColecao(\''+id+'\',\'erros\')">Duplicar erros</button><button onclick="duplicarColecao(\''+id+'\',\'acertos\')">Duplicar acertos</button><button onclick="duplicarColecao(\''+id+'\',\'nao-respondidas\')">Duplicar não respondidas</button><button onclick="duplicarColecao(\''+id+'\',\'respondidas\')">Duplicar respondidas</button>')+'<button onclick="excluirColecao(\''+id+'\')">Excluir</button></div></div>';}
 function row(x){const id=textoSeguro(x.id),qs=x.questoes||[],done=qs.filter(q=>progressoUsuario[String(q.id)]).length,correct=qs.filter(q=>progressoUsuario[String(q.id)]&&progressoUsuario[String(q.id)].acertou).length,label=x.tipo==='pasta'?'Pasta':x.tipo==='simulado'?'Simulado':'Lista';return '<tr><td><button class="resp-collection-name" onclick="'+(x.tipo==='pasta'?'abrirPasta':'abrirItemColecao')+'(\''+id+'\')"><span class="resp-collection-icon">'+(x.tipo==='pasta'?'▰':x.tipo==='simulado'?'◷':'▤')+'</span><span><strong>'+textoSeguro(x.nome)+'</strong><small>'+label+'</small></span></button></td><td>'+label+'</td><td>'+textoSeguro(x.data||'—')+'</td><td>'+qs.length+'</td><td>'+done+'</td><td>'+correct+'</td><td>'+(done-correct)+'</td><td>'+menu(x)+'</td></tr>';}
 body.innerHTML=rows.map(row).join('');
 if(mob)mob.innerHTML=rows.map(x=>'<article class="resp-module-card"><h2>'+textoSeguro(x.nome)+'</h2><p>'+textoSeguro(x.data||'—')+' · '+(x.tipo==='simulado'?'Simulado':x.tipo==='pasta'?'Pasta':'Lista')+' · '+(x.questoes||[]).length+' questões</p><div class="resp-module-card-actions">'+(x.tipo==='pasta'?'<button class="question-action-primary" onclick="abrirPasta(\''+textoSeguro(x.id)+'\')">Abrir pasta</button>':'<button class="question-action-primary" onclick="abrirItemColecao(\''+textoSeguro(x.id)+'\')">Abrir</button>')+menu(x)+'</div></article>').join('');
}
function alternarFavoritoQuestao(id) {
    const questaoId = String(id);
    const questao = (window.respQuestionCache || {})[questaoId]
        || favoritosUsuario.find(item => String(item.id) === questaoId);
    if (!questao) {
        mostrarToast('Não foi possível localizar os dados desta questão.', { titulo: 'Favoritos' });
        return;
    }
    const indice = favoritosUsuario.findIndex(item => String(item.id) === questaoId);
    const foiFavoritada = indice < 0;
    if (foiFavoritada) favoritosUsuario.unshift(JSON.parse(JSON.stringify(questao)));
    else favoritosUsuario.splice(indice, 1);
    syncDB('favoritos', favoritosUsuario);

    document.querySelectorAll('[data-question-action="favorite"]').forEach(botao => {
        if (String(botao.dataset.questionId) !== questaoId) return;
        botao.classList.toggle('is-favorite', foiFavoritada);
        botao.textContent = foiFavoritada ? '★' : '☆';
        botao.setAttribute('aria-pressed', String(foiFavoritada));
        botao.setAttribute('aria-label', foiFavoritada
            ? 'Remover questão ' + questaoId + ' dos favoritos'
            : 'Favoritar questão ' + questaoId);
        botao.title = foiFavoritada ? 'Remover dos favoritos' : 'Favoritar questão';
    });

    renderizarListaFavoritos();
    mostrarToast(
        foiFavoritada
            ? 'Questão ID ' + questaoId + ' foi favoritada.'
            : 'Questão ID ' + questaoId + ' foi removida dos favoritos.',
        { titulo: 'Favoritos' }
    );
}

function mostrarHistoricoQuestao(id) {
    const questaoId = String(id);
    const respostas = tentativasUsuario
        .filter(tentativa => String(tentativa.id) === questaoId)
        .slice()
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

    let modal = document.getElementById('resp-history-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'resp-history-modal';
        modal.className = 'resp-modal-backdrop resp-history-backdrop';
        modal.addEventListener('click', evento => {
            if (evento.target === modal) fecharModalHistoricoQuestao();
        });
        document.body.appendChild(modal);
    }

    const linhas = respostas.length
        ? respostas.map((tentativa, indice) => {
            const data = tentativa.timestamp
                ? new Date(Number(tentativa.timestamp)).toLocaleString('pt-BR')
                : 'Data não disponível';
            const resultado = tentativa.acertou ? 'Acerto' : 'Erro';
            const classeResultado = tentativa.acertou ? 'is-good' : 'is-error';
            const escolhida = textoSeguro(tentativa.escolhida || '—');
            const correta = tentativa.correta
                ? '<span>Gabarito: <strong>' + textoSeguro(tentativa.correta) + '</strong></span>'
                : '';
            return `
                <article class="resp-history-row">
                    <div class="resp-history-row-heading"><strong>Tentativa ${indice + 1}</strong><span class="resp-history-result ${classeResultado}">${resultado}</span></div>
                    <p>${data}</p>
                    <div class="resp-history-details"><span>Marcada: <strong>${escolhida}</strong></span>${correta}</div>
                </article>`;
        }).join('')
        : '<div class="resp-history-empty"><strong>Nenhuma resposta registrada</strong><p>Esta questão ainda não tem tentativas no histórico.</p></div>';

    modal.innerHTML = `
        <section class="resp-modal-card resp-history-card" role="dialog" aria-modal="true" aria-labelledby="resp-history-title" tabindex="-1">
            <header class="resp-modal-heading resp-history-heading">
                <div><span class="resp-eyebrow">Registro de respostas</span><h3 id="resp-history-title">Histórico da questão ID ${textoSeguro(questaoId)}</h3><p>${respostas.length} ${respostas.length === 1 ? 'tentativa registrada' : 'tentativas registradas'}</p></div>
                <button type="button" class="resp-icon-button resp-history-close" aria-label="Fechar histórico">×</button>
            </header>
            <div class="resp-history-list">${linhas}</div>
            <footer class="resp-history-footer"><button type="button" class="question-action-primary resp-history-close">Fechar</button></footer>
        </section>`;
    modal.querySelectorAll('.resp-history-close').forEach(botao => {
        botao.addEventListener('click', fecharModalHistoricoQuestao);
    });
    document.body.classList.add('overflow-hidden');
    modal.querySelector('.resp-history-card').focus();
}

function fecharModalHistoricoQuestao() {
    const modal = document.getElementById('resp-history-modal');
    if (modal) modal.remove();
    document.body.classList.remove('overflow-hidden');
}

function renderizarResumoDesempenho(){const ids=Object.keys(progressoUsuario||{}),correct=ids.filter(id=>progressoUsuario[id]?.acertou).length,wrong=ids.length-correct,rate=ids.length?Math.round(correct/ids.length*100):0;[['module-stat-total',ids.length],['module-stat-acertos',correct],['module-stat-erros',wrong],['module-stat-taxa',rate+'%']].forEach(p=>{const el=document.getElementById(p[0]);if(el)el.textContent=p[1];});const h=document.getElementById('desempenho-historico');if(h)h.innerHTML=tentativasUsuario.length?tentativasUsuario.slice(0,30).map(t=>'<div class="resp-activity-item"><span class="resp-activity-dot '+(t.acertou?'is-good':'is-error')+'"></span><div><strong>Questão '+textoSeguro(t.id)+'</strong><p>'+(t.acertou?'Resposta correta':'Resposta incorreta')+' · '+new Date(t.timestamp).toLocaleString('pt-BR')+'</p></div></div>').join(''):'<div class="resp-empty-inline">Respostas novas serão registradas aqui; o progresso já existente segue contabilizado acima.</div>';}
function renderizarEstudosEmAndamento(){const c=document.getElementById('estudos-atividade');if(!c)return;c.innerHTML=tentativasUsuario.length?tentativasUsuario.slice(0,20).map(t=>'<div class="resp-activity-item"><span class="resp-activity-dot '+(t.acertou?'is-good':'is-error')+'"></span><div><strong>Questão '+textoSeguro(t.id)+'</strong><p>'+(t.acertou?'Acertou':'Errou')+' · '+new Date(t.timestamp).toLocaleString('pt-BR')+'</p></div><a href="/questoes">Praticar →</a></div>').join(''):'<div class="resp-empty-inline">Ainda não há tentativas detalhadas nesta versão. Abra o banco de questões para continuar estudando.</div>';}
async function renderizarCatalogoMaterias(){const c=document.getElementById('areas-cursos');if(!c)return;try{const d=await(await fetch('/api/categorias')).json(),entries=Object.entries(d||{});c.innerHTML=entries.sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(e=>'<article class="resp-course-item"><span class="resp-course-icon">▤</span><div><h3>'+textoSeguro(e[0])+'</h3><p>'+Number(e[1].count||0).toLocaleString('pt-BR')+' questões no banco</p></div><a href="/questoes?materia='+encodeURIComponent(e[0])+'">Estudar →</a></article>').join('')||'<div class="resp-empty-inline">Nenhuma categoria disponível.</div>';}catch(e){c.innerHTML='<div class="resp-empty-inline">Não foi possível carregar as categorias.</div>';}}
function renderizarListaFavoritos(){if(!document.querySelector('.page-module-favoritos'))return;const q=favoritosUsuario.filter(x=>x&&x.enunciado&&Array.isArray(x.alternativas));const c=document.getElementById('questoes-container');if(!c)return;if(!q.length)c.innerHTML='<div class="resp-empty-inline">Você ainda não tem questões favoritas. Use “Favoritar” em uma questão do banco.</div>';else renderizarQuestoesUI(q,true);}
function salvarAnotacaoLeitor(){const input=document.getElementById('ldi-anotacao');if(!input)return;const value=input.value.trim();anotacoesUsuario=anotacoesUsuario.filter(n=>n.chave!=='leitor-geral');if(value)anotacoesUsuario.push({chave:'leitor-geral',texto:value,atualizadaEm:Date.now()});syncDB('anotacoes',anotacoesUsuario);const msg=document.getElementById('ldi-anotacao-salva');if(msg)msg.textContent=value?'Anotação salva em '+new Date().toLocaleString('pt-BR'):'Anotação removida.';mostrarToast(value?'Anotação salva.':'Anotação removida.');}
function ajustarFonteLeitor(delta){fonteLeitorUsuario=Math.min(26,Math.max(13,(Number(fonteLeitorUsuario)||16)+delta));const e=document.getElementById('ldi-demo-text');if(e)e.style.fontSize=fonteLeitorUsuario+'px';localStorage.setItem('respReaderFont',String(fonteLeitorUsuario));}
function alternarConclusaoLeitor(){leitorConcluidoUsuario=!leitorConcluidoUsuario;syncDB('leitorConcluido',leitorConcluidoUsuario);const s=document.getElementById('ldi-status'),b=document.getElementById('btn-concluir-leitura');if(s)s.textContent=leitorConcluidoUsuario?'Leitura marcada como concluída':'Leitura não concluída';if(b)b.textContent=leitorConcluidoUsuario?'✓ Concluído':'○ Concluir';}
function alternarFavoritoLeitor(){const i=favoritosUsuario.findIndex(q=>q.tipo==='material'&&q.id==='ldi-leitor');if(i>=0)favoritosUsuario.splice(i,1);else favoritosUsuario.push({id:'ldi-leitor',tipo:'material',nome:'Leitor de estudo'});syncDB('favoritos',favoritosUsuario);mostrarToast('Preferência de favorito atualizada.');}



const renderizarQuestoesBaseSuite = renderizarQuestoesUI;
renderizarQuestoesUI = function(questoes, isCaderno = false) {
    window.respQuestionCache = window.respQuestionCache || {};
    (questoes || []).forEach(questao => { window.respQuestionCache[String(questao.id)] = questao; });
    renderizarQuestoesBaseSuite(questoes, isCaderno);
    document.querySelectorAll('#questoes-container > div').forEach(card => {
        const match = card.innerHTML.match(/id="alts-([^"]+)"/);
        const id = match ? match[1] : '';
        if (!id) return;
        const footer = card.querySelector('.question-controls-footer');
        const actions = footer && footer.querySelector('.resp-question-actions');
        if (!actions || actions.querySelector('[data-question-action="favorite"]')) return;

        const historico = document.createElement('button');
        historico.type = 'button';
        historico.className = 'resp-question-action resp-question-history';
        historico.dataset.questionAction = 'history';
        historico.dataset.questionId = id;
        historico.title = 'Ver histórico da questão ' + id;
        historico.setAttribute('aria-label', 'Ver histórico da questão ' + id);
        historico.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l3 2"></path></svg><span>Histórico</span>`;
        actions.appendChild(historico);

        const ativa = favoritosUsuario.some(item => String(item.id) === String(id));
        const favorito = document.createElement('button');
        favorito.type = 'button';
        favorito.className = 'resp-question-favorite' + (ativa ? ' is-favorite' : '');
        favorito.dataset.questionAction = 'favorite';
        favorito.dataset.questionId = id;
        favorito.textContent = ativa ? '★' : '☆';
        favorito.setAttribute('aria-pressed', String(ativa));
        favorito.setAttribute('aria-label', ativa ? 'Remover questão ' + id + ' dos favoritos' : 'Favoritar questão ' + id);
        favorito.title = ativa ? 'Remover dos favoritos' : 'Favoritar questão';
        actions.appendChild(favorito);
    });
};
document.addEventListener('click', evento => {
    const acao = evento.target.closest('[data-question-action]');
    if (acao) {
        const id = acao.dataset.questionId;
        if (acao.dataset.questionAction === 'favorite') alternarFavoritoQuestao(id);
        if (acao.dataset.questionAction === 'history') mostrarHistoricoQuestao(id);
    }
    if (!evento.target.closest('.resp-row-actions')) document.querySelectorAll('.resp-row-menu').forEach(menu => menu.classList.add('hidden'));
});
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') {
        fecharModalHistoricoQuestao();
        ['modal-lista', 'modal-simulado', 'modal-pasta', 'modal-caderno'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.body.classList.remove('overflow-hidden');
        document.querySelectorAll('.resp-row-menu').forEach(menu => menu.classList.add('hidden'));
    }
});

function renderizarAgendaDashboard(){
 const list=document.getElementById('agenda-list');if(!list)return;
 const today=new Date(),iso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
 const date=document.getElementById('agenda-data');if(date&&!date.value)date.value=iso;
 const label=document.getElementById('agenda-data-atual');if(label)label.textContent=today.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
 if(!agendaUsuario.length){list.innerHTML='<div class="resp-empty-inline">Nenhuma tarefa adicionada. Use o formulário acima para organizar sua revisão.</div>';return;}
 list.innerHTML=agendaUsuario.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')).map(task=>'<div class="resp-activity-item"><input type="checkbox" '+(task.concluida?'checked':'')+' onchange="alternarTarefaAgenda(\''+textoSeguro(task.id)+'\',this.checked)" aria-label="Marcar tarefa como concluída"><div class="'+(task.concluida?'is-complete':'')+'"><strong>'+textoSeguro(task.titulo)+'</strong><p>'+textoSeguro(task.data||'Sem data')+'</p></div><button type="button" class="resp-icon-button" onclick="removerTarefaAgenda(\''+textoSeguro(task.id)+'\')" aria-label="Remover tarefa">×</button></div>').join('');
}
async function adicionarTarefaAgenda(event){
 event.preventDefault();const titulo=valorSelecionado('agenda-tarefa'),data=valorSelecionado('agenda-data');if(!titulo||!data)return;
 agendaUsuario.push({id:Date.now().toString(),titulo:titulo,data:data,concluida:false,criadaEm:Date.now()});await syncDB('agenda',agendaUsuario);
 const input=document.getElementById('agenda-tarefa');if(input)input.value='';renderizarAgendaDashboard();mostrarToast('Tarefa adicionada ao planejamento.');
}
function alternarTarefaAgenda(id,checked){const task=agendaUsuario.find(t=>String(t.id)===String(id));if(!task)return;task.concluida=Boolean(checked);syncDB('agenda',agendaUsuario);renderizarAgendaDashboard();}
function removerTarefaAgenda(id){agendaUsuario=agendaUsuario.filter(t=>String(t.id)!==String(id));syncDB('agenda',agendaUsuario);renderizarAgendaDashboard();mostrarToast('Tarefa removida.');}


// Biblioteca Google Drive: a busca abre a interface oficial com o filtro aplicado à pasta compartilhada.
const RESP_ACERVO_DRIVE_ID = "13tBBSrXMsu2NGW0jCSvrzIE9epV-Bw47";
const RESP_ACERVO_DRIVE_URL = "https://drive.google.com/drive/folders/" + RESP_ACERVO_DRIVE_ID;
function abrirAcervoDrive() {
    window.open(RESP_ACERVO_DRIVE_URL, "_blank", "noopener,noreferrer");
}
function pesquisarAcervoDrive(termoRapido) {
    const campo = document.getElementById("drive-search-term");
    const termo = String(typeof termoRapido === "string" ? termoRapido : (campo ? campo.value : "")).trim();
    if (!termo) {
        if (campo) campo.focus();
        mostrarToast("Digite um tema, nome de arquivo ou palavra-chave para pesquisar.");
        return;
    }
    if (campo) campo.value = termo;
    const consulta = "in:" + RESP_ACERVO_DRIVE_ID + " " + termo;
    const url = "https://drive.google.com/drive/u/0/search?q=" + encodeURIComponent(consulta);
    window.open(url, "_blank", "noopener,noreferrer");
    mostrarToast("Pesquisa aberta no Google Drive em uma nova aba.");
}
async function copiarLinkAcervoDrive() {
    try {
        await navigator.clipboard.writeText(RESP_ACERVO_DRIVE_URL);
        mostrarToast("Link da biblioteca copiado.");
    } catch (e) {
        window.prompt("Copie o link da biblioteca do Google Drive:", RESP_ACERVO_DRIVE_URL);
    }
}


// ==========================================
// NOVA INTERFACE VISUAL DOS FILTROS DO BANCO
// ==========================================
let respMetadataCounts = {};
let respExpandedMaterias = new Set();
let respExpandedAssuntos = new Set();

function respFormatoNumero(valor) {
    const numero = Number(valor || 0);
    return numero.toLocaleString('pt-BR');
}

function respSetSelectOptions(id, items) {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = new Set(Array.from(select.selectedOptions || []).map(option => option.value));
    select.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = String(item.value);
        option.textContent = String(item.label);
        if (item.count != null) option.dataset.count = String(item.count);
        if (selected.has(option.value)) option.selected = true;
        select.appendChild(option);
    });
}

async function carregarFiltros() {
    try {
        const response = await fetch('/api/categorias');
        const data = await response.json();
        categoriasDB = data && typeof data === 'object' ? data : {};
        const materias = [];
        const assuntos = new Map();
        const subassuntos = new Map();

        Object.keys(categoriasDB).sort((a,b) => a.localeCompare(b,'pt-BR')).forEach(materia => {
            const registro = categoriasDB[materia] || {};
            materias.push({value:materia,label:materia,count:Number(registro.count || 0)});
            Object.entries(registro.assuntos || {}).forEach(([assunto,info]) => {
                assuntos.set(assunto,(assuntos.get(assunto)||0)+Number((info||{}).count || 0));
                Object.entries((info||{}).subs || {}).forEach(([subassunto,count]) => {
                    subassuntos.set(subassunto,(subassuntos.get(subassunto)||0)+Number(count||0));
                });
            });
        });

        respSetSelectOptions('f-mat',materias);
        respSetSelectOptions('f-ass',Array.from(assuntos,([value,count])=>({value,label:value,count})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')));
        respSetSelectOptions('f-sub',Array.from(subassuntos,([value,count])=>({value,label:value,count})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')));
        renderizarArvoreTemas();
        renderizarHistoricoFiltros();
    } catch (error) {
        categoriasDB = {};
        const host = document.getElementById('filter-list-tema');
        if (host) host.innerHTML = '<div class="question-option-empty">Não foi possível carregar as especialidades agora.</div>';
    }
}

async function carregarOpcoesMetadados() {
    const ids = {instituicao:'f-inst',ano:'f-ano',regiao:'f-regiao',finalidade:'f-finalidade',professor:'f-professor'};
    try {
        const response = await fetch('/api/questao-filtros');
        if (!response.ok) throw new Error('Erro ao carregar opções.');
        const data = await response.json();
        respMetadataCounts = data.contagens || {};
        Object.keys(ids).forEach(campo => {
            const select = document.getElementById(ids[campo]);
            if (!select) return;
            const previous = new Set(Array.from(select.selectedOptions).map(option=>option.value));
            const options = (data.opcoes && data.opcoes[campo]) || [];
            select.innerHTML = '';
            options.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                option.dataset.count = String(((respMetadataCounts[campo] || {})[value]) || 0);
                if (previous.has(value)) option.selected = true;
                select.appendChild(option);
            });
            select.disabled = options.length === 0;
            const help = document.querySelector('[data-metadata-help="' + campo + '"]');
            if (help) help.textContent = options.length ? 'Opções com contagem baseada nas questões disponíveis.' : 'A base atual não fornece opções para este filtro.';
        });

        const disponibilidade = data.disponibilidade || {};
        document.querySelectorAll('[data-advanced-select="f-video"]').forEach(input => {
            input.disabled = !disponibilidade.video;
        });
        if (!disponibilidade.video) {
            const help = document.getElementById('advanced-filter-help');
            if (help) help.textContent = 'A base atual ainda não fornece informação suficiente para filtrar por vídeo.';
        }
        renderizarListasMetadados();
    } catch (error) {
        Object.values(ids).forEach(id => {
            const select = document.getElementById(id);
            if (select) select.innerHTML = '';
        });
        renderizarListasMetadados();
    }
}

function renderizarArvoreTemas() {
    const host = document.getElementById('filter-list-tema');
    if (!host) return;
    const scrollTop = host.scrollTop;
    const searchInput = document.querySelector('[data-filter-search="tema"]');
    const termo = String(searchInput ? searchInput.value : '').trim().toLocaleLowerCase('pt-BR');
    const materiasSel = new Set(getSelectedValues('f-mat'));
    const assuntosSel = new Set(getSelectedValues('f-ass'));
    const subsSel = new Set(getSelectedValues('f-sub'));
    let html = '';
    let totalMaterias = 0;
    let totalVisiveis = 0;

    Object.keys(categoriasDB || {}).sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(materia => {
        const registro = categoriasDB[materia] || {};
        const assuntos = Object.entries(registro.assuntos || {}).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
        const assuntosCorrespondentes = assuntos.filter(([assunto,info]) => {
            const subs = Object.keys((info||{}).subs || {});
            return !termo || materia.toLocaleLowerCase('pt-BR').includes(termo) || assunto.toLocaleLowerCase('pt-BR').includes(termo) || subs.some(sub=>sub.toLocaleLowerCase('pt-BR').includes(termo));
        });
        if (termo && !materia.toLocaleLowerCase('pt-BR').includes(termo) && !assuntosCorrespondentes.length) return;
        totalMaterias++;
        const materiaExpandida = respExpandedMaterias.has(materia) || (Boolean(termo) && !materia.toLocaleLowerCase('pt-BR').includes(termo)) || assuntos.some(([assunto])=>assuntosSel.has(assunto));
        totalVisiveis++;
        html += '<div class="question-tree-item">';
        html += '<div class="question-tree-row question-tree-level-0" data-theme-row-materia="' + textoSeguro(materia) + '"><label class="question-option-label"><input type="checkbox" data-theme-kind="materia" data-filter-value="' + textoSeguro(materia) + '"' + (materiasSel.has(materia)?' checked':'') + '><span class="question-option-name">' + textoSeguro(materia) + '</span></label><span class="question-option-count">' + respFormatoNumero(registro.count) + '</span>';
        if (assuntos.length) html += '<button type="button" class="question-tree-expand" data-expand-materia="' + textoSeguro(materia) + '" aria-expanded="' + String(materiaExpandida) + '" aria-label="' + (materiaExpandida?'Recolher ':'Expandir ') + textoSeguro(materia) + '">' + (materiaExpandida?'−':'+') + '</button>';
        html += '</div>';

        if (materiaExpandida) {
            assuntos.forEach(([assunto,info]) => {
                const subsObj = (info||{}).subs || {};
                const subs = Object.keys(subsObj).sort((a,b)=>a.localeCompare(b,'pt-BR'));
                const matches = !termo || materia.toLocaleLowerCase('pt-BR').includes(termo) || assunto.toLocaleLowerCase('pt-BR').includes(termo) || subs.some(sub=>sub.toLocaleLowerCase('pt-BR').includes(termo));
                if (!matches) return;
                const key = materia + '::' + assunto;
                const assuntoExpandido = respExpandedAssuntos.has(key) || (Boolean(termo) && !assunto.toLocaleLowerCase('pt-BR').includes(termo) && subs.some(sub=>sub.toLocaleLowerCase('pt-BR').includes(termo))) || subs.some(sub=>subsSel.has(sub));
                totalVisiveis++;
                html += '<div class="question-tree-row question-tree-level-1" data-theme-row-materia="' + textoSeguro(materia) + '" data-theme-row-assunto="' + textoSeguro(assunto) + '"><label class="question-option-label"><input type="checkbox" data-theme-kind="assunto" data-filter-value="' + textoSeguro(assunto) + '"' + (assuntosSel.has(assunto)?' checked':'') + '><span class="question-option-name">' + textoSeguro(assunto) + '</span></label><span class="question-option-count">' + respFormatoNumero((info||{}).count) + '</span>';
                if (subs.length) html += '<button type="button" class="question-tree-expand" data-expand-assunto="' + textoSeguro(materia) + '" data-assunto="' + textoSeguro(assunto) + '" aria-expanded="' + String(assuntoExpandido) + '" aria-label="' + (assuntoExpandido?'Recolher ':'Expandir ') + textoSeguro(assunto) + '">' + (assuntoExpandido?'−':'+') + '</button>';
                html += '</div>';
                if (assuntoExpandido) {
                    subs.forEach(subassunto => {
                        if (termo && !materia.toLocaleLowerCase('pt-BR').includes(termo) && !assunto.toLocaleLowerCase('pt-BR').includes(termo) && !subassunto.toLocaleLowerCase('pt-BR').includes(termo)) return;
                        totalVisiveis++;
                        html += '<div class="question-tree-row question-tree-level-2"><label class="question-option-label"><input type="checkbox" data-theme-kind="subassunto" data-filter-value="' + textoSeguro(subassunto) + '"' + (subsSel.has(subassunto)?' checked':'') + '><span class="question-option-name">' + textoSeguro(subassunto) + '</span></label><span class="question-option-count">' + respFormatoNumero(subsObj[subassunto]) + '</span></div>';
                    });
                }
            });
        }
        html += '</div>';
    });

    host.innerHTML = html || '<div class="question-option-empty">Nenhuma opção corresponde à sua busca.</div>';
    host.scrollTop = scrollTop;
    const total = document.getElementById('filter-total-tema');
    if (total) total.textContent = respFormatoNumero(totalVisiveis) + ' opções encontradas';
    const panelCount = document.getElementById('filter-visible-tema');
    if (panelCount) panelCount.textContent = respFormatoNumero(totalMaterias) + ' especialidades';
}

function renderizarListaMetadados(campo) {
    const ids = {instituicao:'f-inst',ano:'f-ano',regiao:'f-regiao',finalidade:'f-finalidade',professor:'f-professor'};
    const select = document.getElementById(ids[campo]);
    const host = document.getElementById('filter-list-' + campo);
    if (!select || !host) return;
    const searchInput = document.querySelector('[data-filter-search="' + campo + '"]');
    const termo = String(searchInput ? searchInput.value : '').trim().toLocaleLowerCase('pt-BR');
    const options = Array.from(select.options).filter(option => option.textContent.toLocaleLowerCase('pt-BR').includes(termo));
    const total = document.getElementById('filter-total-' + campo);
    if (total) total.textContent = respFormatoNumero(options.length) + ' opções encontradas';

    host.innerHTML = options.length ? options.map(option => {
        const count = (respMetadataCounts[campo] || {})[option.value] || option.dataset.count || 0;
        return '<label class="question-option-row"><input type="checkbox" data-filter-source="' + ids[campo] + '" data-filter-value="' + textoSeguro(option.value) + '"' + (option.selected?' checked':'') + '><span class="question-option-name">' + textoSeguro(option.textContent) + '</span><span class="question-option-count">' + respFormatoNumero(count) + '</span></label>';
    }).join('') : '<div class="question-option-empty">' + (select.options.length ? 'Nenhum resultado para esta busca.' : 'Sem metadados disponíveis nesta base.') + '</div>';
}

function renderizarListasMetadados() {
    ['instituicao','ano','regiao','finalidade','professor'].forEach(renderizarListaMetadados);
}

function respSincronizarControlesVisuais() {
    const status = document.getElementById('f-status');
    document.querySelectorAll('[data-status-choice]').forEach(button => {
        const active = status && status.value === button.dataset.statusChoice;
        button.classList.toggle('is-active',Boolean(active));
        button.setAttribute('aria-pressed',String(Boolean(active)));
    });
    document.querySelectorAll('[data-advanced-select]').forEach(input => {
        const select = document.getElementById(input.dataset.advancedSelect);
        input.checked = Boolean(select && select.value === input.dataset.advancedValue);
        if (input.parentElement) input.parentElement.classList.toggle('is-on',input.checked);
    });
}

function respAtualizarInterfaceFiltros() {
    renderizarArvoreTemas();
    renderizarListasMetadados();
    respSincronizarControlesVisuais();
    atualizarResumoFiltros();
}

function respAgendarContagemFiltros() {
    if (window.respQuestionCountTimer) clearTimeout(window.respQuestionCountTimer);
    window.respQuestionCountTimer = setTimeout(atualizarContagemFiltros,350);
}

async function atualizarContagemFiltros() {
    const sequencia = (window.respQuestionCountSequence || 0) + 1;
    window.respQuestionCountSequence = sequencia;
    try {
        const payload = montarPayloadFiltroCompleto(1);
        payload.pagina = 1;
        payload.limite = 1;
        const response = await fetch('/api/questoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data = await response.json();
        if (sequencia !== window.respQuestionCountSequence) return;
        if (!response.ok || data.erro_interno) throw new Error(data.erro_interno || 'Falha ao contar questões');
        const count = document.getElementById('questoes-count');
        if (count) count.textContent = respFormatoNumero(data.total || 0);
    } catch (error) {
        const count = document.getElementById('questoes-count');
        if (count && count.textContent === '—') count.textContent = '—';
    }
}

function bindQuestionFilterInterface() {
    const left = document.getElementById('question-filter-left');
    if (left && left.dataset.filterEventsBound !== 'true') {
        left.dataset.filterEventsBound = 'true';
        left.addEventListener('change',event => {
            const input = event.target;
            if (input.matches('[data-theme-kind]')) {
                const kind = input.dataset.themeKind;
                const map = {materia:'f-mat',assunto:'f-ass',subassunto:'f-sub'};
                const select = document.getElementById(map[kind]);
                if (select) {
                    const option = Array.from(select.options).find(item=>item.value===input.dataset.filterValue);
                    if (option) option.selected = input.checked;
                }

                // Ao interagir com uma especialidade/assunto, abrir suas subopções imediatamente.
                const row = input.closest('[data-theme-row-materia]');
                const materia = row ? row.dataset.themeRowMateria : '';
                if (kind === 'materia') {
                    respExpandedMaterias.add(input.dataset.filterValue);
                } else if (kind === 'assunto' && materia) {
                    respExpandedMaterias.add(materia);
                    respExpandedAssuntos.add(materia + '::' + input.dataset.filterValue);
                }

                respAtualizarInterfaceFiltros();
                respAgendarContagemFiltros();
                return;
            }
            if (input.matches('[data-filter-source]')) {
                const select = document.getElementById(input.dataset.filterSource);
                if (select) {
                    const option = Array.from(select.options).find(item=>item.value===input.dataset.filterValue);
                    if (option) option.selected = input.checked;
                }
                respAtualizarInterfaceFiltros();
                respAgendarContagemFiltros();
                return;
            }
            if (input.matches('[data-advanced-select]')) {
                const select = document.getElementById(input.dataset.advancedSelect);
                const group = input.dataset.advancedGroup;
                if (input.checked) {
                    document.querySelectorAll('[data-advanced-group="' + group + '"]').forEach(other=>{if(other!==input){other.checked=false;if(other.parentElement)other.parentElement.classList.remove('is-on');}});
                    if (select) select.value = input.dataset.advancedValue;
                } else if (select && select.value === input.dataset.advancedValue) {
                    select.value = '';
                }
                respSincronizarControlesVisuais();
                atualizarResumoFiltros();
                respAgendarContagemFiltros();
                return;
            }
            if (input.matches('input[name="f-tipo"]')) {
                atualizarResumoFiltros();
                respAgendarContagemFiltros();
            }
        });
        left.addEventListener('click',event => {
            const expandeMateria = event.target.closest('[data-expand-materia]');
            if (expandeMateria) {
                const key = expandeMateria.dataset.expandMateria;
                if (respExpandedMaterias.has(key)) respExpandedMaterias.delete(key); else respExpandedMaterias.add(key);
                renderizarArvoreTemas();
                return;
            }
            const expandeAssunto = event.target.closest('[data-expand-assunto]');
            if (expandeAssunto) {
                const key = expandeAssunto.dataset.expandAssunto + '::' + expandeAssunto.dataset.assunto;
                if (respExpandedAssuntos.has(key)) respExpandedAssuntos.delete(key); else respExpandedAssuntos.add(key);
                renderizarArvoreTemas();
                return;
            }
            const status = event.target.closest('[data-status-choice]');
            if (status) {
                const select = document.getElementById('f-status');
                if (select) select.value = status.dataset.statusChoice;
                respSincronizarControlesVisuais();
                atualizarResumoFiltros();
                respAgendarContagemFiltros();
            }
        });
        left.addEventListener('input',event => {
            const search = event.target.closest('[data-filter-search]');
            if (!search) return;
            const campo = search.dataset.filterSearch;
            if (campo === 'tema') renderizarArvoreTemas();
            else renderizarListaMetadados(campo);
        });
    }

    document.querySelectorAll('[data-filter-tab]').forEach(button => {
        if (button.dataset.tabEventsBound === 'true') return;
        button.dataset.tabEventsBound = 'true';
        button.addEventListener('click',() => {
            const target = button.dataset.filterTab;
            document.querySelectorAll('[data-filter-tab]').forEach(item => {
                const active = item === button;
                item.classList.toggle('is-active',active);
                item.setAttribute('aria-selected',String(active));
            });
            document.querySelectorAll('[data-filter-group]').forEach(group => {
                const active = group.dataset.filterGroup === target;
                group.hidden = !active;
                group.classList.toggle('is-active',active);
            });
        });
    });

    document.querySelectorAll('.question-filter-source').forEach(select => {
        if (select.dataset.sourceEventsBound === 'true') return;
        select.dataset.sourceEventsBound = 'true';
        select.addEventListener('change',() => {
            respAtualizarInterfaceFiltros();
            respAgendarContagemFiltros();
        });
    });

    const busca = document.getElementById('f-busca');
    if (busca && busca.dataset.questionSearchBound !== 'true') {
        busca.dataset.questionSearchBound = 'true';
        busca.addEventListener('input',() => {
            atualizarResumoFiltros();
            respAgendarContagemFiltros();
        });
    }

    const chips = document.getElementById('question-filter-summary-chips');
    if (chips && chips.dataset.chipsBound !== 'true') {
        chips.dataset.chipsBound = 'true';
        chips.addEventListener('click',event => {
            const chip = event.target.closest('[data-chip-id]');
            if (chip) removerFiltroQuestao(chip.dataset.chipId,chip.dataset.chipValue);
        });
    }

    const edit = document.getElementById('question-summary-edit');
    if (edit && edit.dataset.editBound !== 'true') {
        edit.dataset.editBound = 'true';
        edit.addEventListener('click',() => {
            const summary = document.querySelector('.question-filter-summary');
            const active = edit.getAttribute('aria-pressed') !== 'true';
            edit.setAttribute('aria-pressed',String(active));
            edit.classList.toggle('is-active',active);
            if (summary) summary.classList.toggle('is-editing',active);
        });
    }

    respAtualizarInterfaceFiltros();
}

function atualizarResumoFiltros() {
    const box = document.getElementById('question-filter-summary-chips');
    if (!box) return;
    const chips = [];
    const status = document.getElementById('f-status');
    if (status && status.value && status.value !== 'todas') {
        const option = status.options[status.selectedIndex];
        chips.push({id:'f-status',value:status.value,text:option ? option.textContent : status.value});
    }

    const fields = [
        ['f-mat','Especialidade'],
        ['f-ass','Assunto'],
        ['f-sub','Subassunto'],
        ['f-inst','Instituição'],
        ['f-ano','Ano'],
        ['f-regiao','Região'],
        ['f-finalidade','Finalidade'],
        ['f-professor','Professor']
    ];
    fields.forEach(([id,label]) => {
        const select = document.getElementById(id);
        if (!select) return;
        Array.from(select.selectedOptions).forEach(option => {
            chips.push({id,value:option.value,text:label + ': ' + (option.dataset.label || option.textContent)});
        });
    });

    const word = valorSelecionado('f-busca');
    if (word) chips.push({id:'f-busca',value:word,text:'Busca: ' + word});
    document.querySelectorAll('input[name="f-tipo"]:checked').forEach(input => {
        chips.push({id:'f-tipo',value:input.value,text:input.parentElement.textContent.trim()});
    });
    const advancedLabels = {
        'f-solucao-texto':{'com':'Com solução em texto','sem':'Sem solução em texto'},
        'f-video':{'com':'Com solução por vídeo','sem':'Sem solução por vídeo'},
        'f-vigencia':{'validas':'Gabarito válido','anuladas':'Questões anuladas','desatualizadas':'Questões desatualizadas'}
    };
    Object.keys(advancedLabels).forEach(id => {
        const select = document.getElementById(id);
        if (select && select.value) chips.push({id,value:select.value,text:advancedLabels[id][select.value] || select.value});
    });

    box.innerHTML = chips.length ? chips.map(chip => (
        '<button type="button" class="question-filter-chip" data-chip-id="' + textoSeguro(chip.id) + '" data-chip-value="' + textoSeguro(chip.value) + '"><span>' + textoSeguro(chip.text) + '</span><b aria-hidden="true">×</b></button>'
    )).join('') : '<span class="question-summary-empty">Nenhum critério adicional selecionado. Você pode explorar o banco inteiro.</span>';
    const emptyNote = document.querySelector('.question-summary-footnote');
    if (emptyNote) emptyNote.style.opacity = chips.length ? '1' : '.62';
}

function removerFiltroQuestao(id,value) {
    const select = document.getElementById(id);
    if (id === 'f-tipo') {
        document.querySelectorAll('input[name="f-tipo"]').forEach(input=>{if(input.value===value)input.checked=false;});
    } else if (select && select.multiple) {
        Array.from(select.options).forEach(option=>{if(option.value===value)option.selected=false;});
    } else if (select) {
        select.value = id === 'f-status' ? 'todas' : '';
    } else if (id === 'f-busca') {
        const search = document.getElementById('f-busca');
        if (search) search.value = '';
    }
    respAtualizarInterfaceFiltros();
    aplicarFiltros(1);
}

function redefinirFiltrosQuestao() {
    ['f-mat','f-ass','f-sub','f-inst','f-ano','f-regiao','f-finalidade','f-professor'].forEach(id=>{
        const select=document.getElementById(id);
        if(select)Array.from(select.options).forEach(option=>option.selected=false);
    });
    ['f-solucao-texto','f-video','f-vigencia'].forEach(id=>{const select=document.getElementById(id);if(select)select.value='';});
    const status=document.getElementById('f-status');if(status)status.value='todas';
    const busca=document.getElementById('f-busca');if(busca)busca.value='';
    document.querySelectorAll('input[name="f-tipo"]').forEach(input=>input.checked=false);
    document.querySelectorAll('[data-filter-search]').forEach(input=>input.value='');
    respExpandedMaterias.clear();
    respExpandedAssuntos.clear();
    respAtualizarInterfaceFiltros();
    aplicarFiltros(1);
}

function respTemFiltrosAtivos(payload) {
    const dados = payload || montarPayloadFiltroCompleto(20);
    const avancados = dados.filtrosAvancados || {};
    const metadados = dados.metadados || {};
    return Boolean(
        (dados.materia||[]).length || (dados.assunto||[]).length || (dados.subassunto||[]).length ||
        dados.palavraChave || (dados.statusProgresso && dados.statusProgresso !== 'todas') ||
        Object.values(metadados).some(valores=>Array.isArray(valores)&&valores.length) ||
        (avancados.tipos||[]).length || avancados.solucaoTexto || avancados.video || avancados.vigencia
    );
}

async function aplicarFiltros(pagina = 1) {
    paginaAtual = pagina;
    const limite = parseInt(valorSelecionado('limite-pagina') || '20',10);
    const payload = montarPayloadFiltroCompleto(limite);
    payload.pagina = paginaAtual;
    const aviso = document.getElementById('aviso-aleatorio');
    if (aviso) aviso.classList.toggle('hidden',respTemFiltrosAtivos(payload));

    if (pagina === 1 && respTemFiltrosAtivos(payload)) registrarHistoricoFiltro(payload);
    try {
        const response = await fetch('/api/questoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data = await response.json();
        if (!response.ok || data.erro_interno) throw new Error(data.erro_interno || 'Não foi possível carregar as questões.');
        renderizarQuestoesUI(data.questoes || [],false);
        renderizarPaginacaoUI(Number(data.total||0),limite);
        const count = document.getElementById('questoes-count');
        if (count) count.textContent = respFormatoNumero(data.total || 0);
        atualizarResumoFiltros();
        // Mantém a posição atual da página após carregar o resultado da busca.
    } catch (error) {
        mostrarToast(error.message || 'Erro ao aplicar os filtros.',{titulo:'Banco de questões'});
    }
}

function resumoVisualFiltroRecente(config = {}) {
    const lista = value => Array.isArray(value) ? value.filter(Boolean).map(String) : (value ? [String(value)] : []);
    const materias=lista(config.materia), assuntos=lista(config.assunto), subassuntos=lista(config.subassunto);
    const meta=config.metadados||{}, av=config.filtrosAvancados||{};
    const statusLabels={ineditas:'Não resolvidas',feitas:'Já resolvidas',erradas:'Questões que errei'};
    const details=[];
    if (assuntos.length) details.push('Assunto: '+assuntos.slice(0,2).join(', '));
    if (subassuntos.length) details.push('Subassunto: '+subassuntos.slice(0,2).join(', '));
    if (lista(meta.instituicao).length) details.push('Instituição: '+lista(meta.instituicao).slice(0,2).join(', '));
    if (lista(meta.ano).length) details.push('Ano: '+lista(meta.ano).slice(0,2).join(', '));
    if (lista(meta.regiao).length) details.push('Região: '+lista(meta.regiao).slice(0,2).join(', '));
    if (lista(meta.finalidade).length) details.push('Finalidade: '+lista(meta.finalidade).slice(0,2).join(', '));
    if (lista(meta.professor).length) details.push('Professor: '+lista(meta.professor).slice(0,2).join(', '));
    if (av.tipos && av.tipos.length) details.push('Tipo: '+av.tipos.join(', '));
    if (av.solucaoTexto) details.push(av.solucaoTexto==='com'?'Com solução em texto':'Sem solução em texto');
    if (av.video) details.push(av.video==='com'?'Com vídeo':'Sem vídeo');
    if (av.vigencia) details.push('Vigência: '+av.vigencia);
    const word=String(config.palavraChave||'').trim();
    const status=statusLabels[config.statusProgresso]||'';
    const titulo=assuntos[0] || materias[0] || (lista(meta.instituicao)[0]) || (lista(meta.ano)[0]) || word || status || 'Questões filtradas';
    if (word && titulo!==word) details.push('Busca: '+word);
    if (status && titulo!==status) details.push(status);
    if (materias.length && titulo!==materias[0]) details.push('Especialidade: '+materias.slice(0,2).join(', '));
    return {titulo,detalhe:details.filter(x=>x!==titulo).slice(0,2).join(' · ')};
}

function registrarHistoricoFiltro(config) {
    const resumo=resumoVisualFiltroRecente(config);
    const signature=JSON.stringify({
        materia:config.materia||[],assunto:config.assunto||[],subassunto:config.subassunto||[],
        palavraChave:config.palavraChave||'',statusProgresso:config.statusProgresso||'todas',
        metadados:config.metadados||{},filtrosAvancados:config.filtrosAvancados||{}
    });
    const older=historicoUsuario.map(item=>({item,signature:JSON.stringify({
        materia:item.config?.materia||[],assunto:item.config?.assunto||[],subassunto:item.config?.subassunto||[],
        palavraChave:item.config?.palavraChave||'',statusProgresso:item.config?.statusProgresso||'todas',
        metadados:item.config?.metadados||{},filtrosAvancados:item.config?.filtrosAvancados||{}
    })}));
    if (older[0] && older[0].signature===signature) return;
    historicoUsuario=[{rotulo:resumo.titulo,config:config},...historicoUsuario.filter(item=>{
        const oldSignature=JSON.stringify({
            materia:item.config?.materia||[],assunto:item.config?.assunto||[],subassunto:item.config?.subassunto||[],
            palavraChave:item.config?.palavraChave||'',statusProgresso:item.config?.statusProgresso||'todas',
            metadados:item.config?.metadados||{},filtrosAvancados:item.config?.filtrosAvancados||{}
        });
        return oldSignature!==signature;
    })].slice(0,8);
    syncDB('historico',historicoUsuario);
    renderizarHistoricoFiltros();
}

function aplicarHistorico(index) {
    const item=historicoUsuario[index];
    if (!item || !item.config) return;
    const config=item.config;
    const multi={
        materia:'f-mat',assunto:'f-ass',subassunto:'f-sub',
        instituicao:'f-inst',ano:'f-ano',regiao:'f-regiao',finalidade:'f-finalidade',professor:'f-professor'
    };
    Object.keys(multi).forEach(campo=>{
        const select=document.getElementById(multi[campo]);
        const values=Array.isArray(config[campo])?config[campo]:[];
        if(select)Array.from(select.options).forEach(option=>option.selected=values.includes(option.value));
    });
    const search=document.getElementById('f-busca');if(search)search.value=config.palavraChave||'';
    const status=document.getElementById('f-status');if(status)status.value=config.statusProgresso||'todas';
    const adv=config.filtrosAvancados||{};
    ['f-solucao-texto','f-video','f-vigencia'].forEach((id,index)=>{
        const key=['solucaoTexto','video','vigencia'][index],select=document.getElementById(id);
        if(select)select.value=adv[key]||'';
    });
    document.querySelectorAll('input[name="f-tipo"]').forEach(input=>input.checked=(adv.tipos||[]).includes(input.value));
    respAtualizarInterfaceFiltros();
    fetch('/api/questoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}).then(async response=>{
        const data=await response.json();
        if(!response.ok || data.erro_interno)throw new Error(data.erro_interno||'Falha ao reaplicar o filtro.');
        renderizarQuestoesUI(data.questoes||[],false);
        renderizarPaginacaoUI(Number(data.total||0),Number(config.limite||20));
        const count=document.getElementById('questoes-count');if(count)count.textContent=respFormatoNumero(data.total||0);
        respAgendarContagemFiltros();
    }).catch(error=>mostrarToast(error.message||'Não foi possível recuperar o filtro.'));
}
