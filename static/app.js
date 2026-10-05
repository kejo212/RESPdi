// ==========================================
// 1. PROTEÇÃO DE ROTAS E VARIÁVEIS GLOBAIS
// ==========================================
let rawUser = localStorage.getItem('currentUser');
let path = window.location.pathname;

// SISTEMA DE SEGURANÇA (Route Guard)
// Se não estiver logado e tentar acessar qualquer página que não seja a de login, volta pro login!
if (!rawUser && path !== '/') {
    window.location.replace('/');
}
// Se já estiver logado e tentar abrir a página de login, entra direto no painel!
if (rawUser && path === '/') {
    window.location.replace('/dashboard');
}

// Inicialização das variáveis de nuvem
let currentUser = rawUser || 'visitante';
let progressoUsuario = {};
let cadernosUsuario = [];
let historicoUsuario = [];
let paginaAtual = 1;

// Motor de Sincronização em Nuvem (Firebase via Python)
async function syncDB(tipo, dados) {
    if(currentUser === 'visitante') return;
    try {
        await fetch(`/api/sync/${currentUser}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({tipo: tipo, dados: dados})
        });
    } catch(e) { console.error("Erro ao sincronizar com nuvem", e); }
}

// ==========================================
// 2. SISTEMA DE LOGIN E CADASTRO
// ==========================================
function alternarTela(alvo) {
    ['form-login', 'form-cadastro-1', 'form-cadastro-2'].forEach(id => {
        let el = document.getElementById(id);
        if(el) { el.classList.add('hidden', 'translate-x-full', 'absolute'); el.classList.remove('translate-x-0', 'relative'); }
    });
    let target = document.getElementById(alvo);
    if(target) { target.classList.remove('hidden', 'translate-x-full', 'absolute'); target.classList.add('translate-x-0', 'relative'); }
}

async function fazerLogin() {
    const u = document.getElementById('username').value.trim(); 
    const p = document.getElementById('password').value.trim();
    if (!u || !p) return alert("Preencha o usuário e a senha!");
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        const data = await res.json();
        if(res.ok && data.sucesso) {
            localStorage.setItem('currentUser', u);
            window.location.replace('/dashboard');
        } else { alert(data.erro || "Erro ao fazer login."); }
    } catch (e) { alert("Erro de conexão com o servidor."); }
}

async function enviarCadastro() {
    const u = document.getElementById('new-user').value.trim(); 
    const p = document.getElementById('new-pass').value.trim();
    const tags = Array.from(document.querySelectorAll('.tag-check:checked')).map(el => el.value);
    if (!u || !p) return alert("Preencha todos os campos!");
    try {
        const res = await fetch('/api/cadastro', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p, tags: tags}) });
        const data = await res.json();
        if(res.ok && data.sucesso) { 
            alert("Cadastro enviado! Aguarde a aprovação."); 
            alternarTela('form-login'); 
        } else { alert(data.erro); }
    } catch (e) {}
}

// ==========================================
// 3. ADMIN: PAINEL DO DAVI E EXCLUSÃO
// ==========================================
async function carregarPainelAdmin() {
    try {
        const resP = await fetch('/api/admin/pendentes'); const dataP = await resP.json(); const usersP = Object.keys(dataP);
        if(document.getElementById('contador-pendentes')) document.getElementById('contador-pendentes').innerText = `${usersP.length} na fila`;
        const contP = document.getElementById('lista-pendentes');
        if(contP) contP.innerHTML = usersP.length === 0 ? '<div class="text-gray-400 text-sm">Vazio.</div>' : usersP.map(u => `
            <div class="p-3 bg-gray-50 border rounded-lg flex justify-between items-center"><span class="font-bold text-gray-800">${u}</span>
            <div class="flex gap-1"><button onclick="resolverPendente('${u}', 'aprovado')" class="bg-green-500 text-white px-2 py-1 rounded shadow-sm hover:bg-green-600">✓</button><button onclick="resolverPendente('${u}', 'negado')" class="bg-red-500 text-white px-2 py-1 rounded shadow-sm hover:bg-red-600">✗</button></div></div>`).join('');
    } catch(e) {}
    try {
        const resA = await fetch('/api/admin/usuarios_ativos'); const dataA = await resA.json(); const usersA = Object.keys(dataA);
        const contA = document.getElementById('lista-ativos');
        if(contA) contA.innerHTML = usersA.length === 0 ? '<div class="text-gray-400 text-sm">Nenhum outro usuário.</div>' : usersA.map(u => {
            const block = dataA[u].status === 'bloqueado';
            return `<div class="p-3 ${block ? 'bg-red-50' : 'bg-gray-50'} border rounded-lg flex flex-col gap-2">
                <div class="flex justify-between items-center">
                    <div><span class="font-bold ${block ? 'text-red-900' : 'text-gray-800'}">${u}</span><span class="text-[10px] ml-2 ${block ? 'text-red-500' : 'text-green-500'}">${block ? 'Bloqueado' : 'Ativo'}</span></div>
                    <div class="flex gap-1">
                        <button onclick="resolverPendente('${u}', '${block ? 'aprovado' : 'bloqueado'}')" class="${block ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'} text-white px-2 py-1 rounded text-xs font-bold transition shadow-sm">${block ? 'Desbloq.' : 'Bloquear'}</button>
                        <button onclick="excluirUsuario('${u}')" class="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold hover:bg-black transition shadow-sm">Excluir</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {}
}

async function resolverPendente(user, acao) { 
    await fetch('/api/admin/resolver', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, acao: acao}) }); 
    carregarPainelAdmin(); 
}

async function excluirUsuario(user) {
    if(!confirm(`⚠️ ATENÇÃO!\nTem certeza que deseja apagar o usuário '${user}' permanentemente do Firebase?`)) return;
    try { 
        await fetch('/api/admin/excluir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user}) }); 
        carregarPainelAdmin(); 
    } catch(e) { alert("Erro ao excluir usuário."); }
}

async function carregarLogsServidor() {
    try {
        const res = await fetch('/api/admin/logs'); const logs = await res.json(); const container = document.getElementById('server-logs');
        if(!container) return;
        let htmlLogs = logs.map(linha => {
            if (linha.includes("EXCLUÍDO") || linha.includes("[ERRO CRÍTICO]")) return `<div class="text-red-400 font-bold">${linha}</div>`;
            if (linha.includes("[OK]")) return `<div class="text-green-300">${linha}</div>`;
            if (linha.includes("ALERTA:")) return `<div class="text-yellow-400">${linha}</div>`;
            return `<div>${linha}</div>`;
        }).join('');
        const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
        container.innerHTML = htmlLogs || '<div class="text-gray-500">Aguardando...</div>';
        if (isAtBottom) container.scrollTop = container.scrollHeight;
    } catch(e) {}
}

// ==========================================
// 4. MOTOR DE FILTROS MÚLTIPLOS E BUSCA
// ==========================================
let categoriasDB = {};
const getSelectedValues = (id) => { const el = document.getElementById(id); return el ? Array.from(el.selectedOptions).map(opt => opt.value) : []; };

async function carregarFiltros() {
    try {
        const res = await fetch('/api/categorias'); categoriasDB = await res.json();
        const sMat = document.getElementById('f-mat'); if(!sMat) return;
        sMat.innerHTML = '';
        Object.keys(categoriasDB).sort().forEach(m => { sMat.innerHTML += `<option value="${m}">${m} (${categoriasDB[m].count})</option>`; });
        
        sMat.addEventListener('change', () => {
            const mats = getSelectedValues('f-mat'); const sAss = document.getElementById('f-ass'); const sSub = document.getElementById('f-sub');
            sAss.innerHTML = ''; sSub.innerHTML = ''; sSub.disabled = true;
            if (mats.length > 0) {
                mats.forEach(mat => { 
                    Object.keys(categoriasDB[mat].assuntos).sort().forEach(a => { 
                        sAss.innerHTML += `<option value="${a}">${a} (${categoriasDB[mat].assuntos[a].count})</option>`; 
                    }); 
                });
                sAss.disabled = false;
            } else { sAss.disabled = true; }
        });

        document.getElementById('f-ass').addEventListener('change', () => {
            const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const sSub = document.getElementById('f-sub');
            sSub.innerHTML = '';
            if (asss.length > 0) {
                mats.forEach(mat => { 
                    asss.forEach(ass => { 
                        if(categoriasDB[mat].assuntos[ass]) { 
                            Object.keys(categoriasDB[mat].assuntos[ass].subs).sort().forEach(s => { 
                                sSub.innerHTML += `<option value="${s}">${s} (${categoriasDB[mat].assuntos[ass].subs[s]})</option>`; 
                            }); 
                        } 
                    }); 
                });
                sSub.disabled = false;
            } else { sSub.disabled = true; }
        });
        renderizarHistoricoFiltros();
    } catch(e) {}
}

async function aplicarFiltros(pagina = 1) {
    paginaAtual = pagina;
    const limit = document.getElementById('limite-pagina') ? document.getElementById('limite-pagina').value : 20;
    const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const subs = getSelectedValues('f-sub');
    const palavra = document.getElementById('f-busca') ? document.getElementById('f-busca').value.trim() : "";
    
    const aviso = document.getElementById('aviso-aleatorio');
    if (aviso) { (mats.length > 0 || palavra) ? aviso.classList.add('hidden') : aviso.classList.remove('hidden'); }
    const payload = { pagina: paginaAtual, limite: parseInt(limit), materia: mats, assunto: asss, subassunto: subs, palavraChave: palavra };
    
    if(pagina === 1 && (mats.length > 0 || palavra)) { registrarHistoricoFiltro({mats, asss, subs, palavra}); }

    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        renderizarQuestoesUI(dados.questoes); renderizarPaginacaoUI(dados.total, parseInt(limit));
        if(document.getElementById('f-mat')) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e) {}
}

function registrarHistoricoFiltro(f) {
    const rotulo = (f.palavra ? `"${f.palavra}"` : '') + (f.mats.length ? ` [${f.mats.join(', ')}]` : '');
    if(!rotulo.trim()) return;
    if(historicoUsuario.length > 0 && historicoUsuario[0].rotulo === rotulo) return;
    
    historicoUsuario.unshift({ rotulo: rotulo, config: f });
    if(historicoUsuario.length > 5) historicoUsuario.pop();
    
    syncDB('historico', historicoUsuario);
    renderizarHistoricoFiltros();
}

function renderizarHistoricoFiltros() {
    const ctr1 = document.getElementById('historico-container'); const ctr2 = document.getElementById('historico-container-mobile');
    const html = historicoUsuario.length === 0 ? '<span class="text-xs text-gray-400">Nenhum histórico</span>' : historicoUsuario.map((h, i) => `<button onclick="aplicarHistorico(${i})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full border border-gray-200 transition whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] inline-block shadow-sm" title="${h.rotulo}">⏰ ${h.rotulo}</button>`).join('');
    if(ctr1) ctr1.innerHTML = html; if(ctr2) ctr2.innerHTML = html;
}

function aplicarHistorico(index) {
    if(!historicoUsuario[index]) return; const conf = historicoUsuario[index].config;
    if(document.getElementById('f-busca')) document.getElementById('f-busca').value = conf.palavra || "";
    const payload = { pagina: 1, limite: document.getElementById('limite-pagina') ? parseInt(document.getElementById('limite-pagina').value) : 20, materia: conf.mats, assunto: conf.asss, subassunto: conf.subs, palavraChave: conf.palavra };
    fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }).then(res => res.json()).then(dados => {
        if(document.getElementById('aviso-aleatorio')) document.getElementById('aviso-aleatorio').classList.add('hidden');
        renderizarQuestoesUI(dados.questoes); renderizarPaginacaoUI(dados.total, payload.limite);
    });
}

// ==========================================
// 5. SISTEMA DE CADERNOS DE QUESTÕES
// ==========================================
function abrirModalCaderno() { 
    document.getElementById('modal-caderno').classList.replace('hidden', 'flex'); 
    document.body.classList.add('overflow-hidden'); 
}

function fecharModalCaderno() { 
    document.getElementById('modal-caderno').classList.replace('flex', 'hidden'); 
    document.body.classList.remove('overflow-hidden'); 
    document.getElementById('nome-caderno').value = ""; 
    document.getElementById('qtd-caderno').value = ""; 
}

async function salvarCaderno() {
    const nome = document.getElementById('nome-caderno').value.trim(); 
    const qtd = parseInt(document.getElementById('qtd-caderno').value);
    if(!nome || !qtd || qtd <= 0) return alert("Preencha nome e quantidade válida.");
    
    const mats = getSelectedValues('f-mat'); const asss = getSelectedValues('f-ass'); const subs = getSelectedValues('f-sub');
    const palavra = document.getElementById('f-busca') ? document.getElementById('f-busca').value.trim() : "";
    const payload = { pagina: 1, limite: 10000, materia: mats, assunto: asss, subassunto: subs, palavraChave: palavra };
    
    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        if (dados.questoes.length === 0) return alert("Nenhuma questão encontrada para criar o caderno.");
        
        let sorteio = dados.questoes.sort(() => 0.5 - Math.random()).slice(0, qtd);
        cadernosUsuario.push({ id: Date.now().toString(), nome: nome, data: new Date().toLocaleDateString('pt-BR'), questoes: sorteio });
        syncDB('cadernos', cadernosUsuario);
        
        fecharModalCaderno(); 
        alert(`Caderno "${nome}" criado com sucesso! Acesse a aba Cadernos.`);
    } catch(e) { alert("Erro ao criar caderno."); }
}

function renderizarListaCadernos() {
    const container = document.getElementById('lista-cadernos'); if(!container) return;
    if (cadernosUsuario.length === 0) { 
        container.innerHTML = `<div class="col-span-full p-10 bg-white rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">Você não tem cadernos salvos. Crie um na aba de Questões.</div>`; 
        return; 
    }
    container.innerHTML = cadernosUsuario.map(c => `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:border-green-300 transition">
            <h3 class="text-xl font-bold text-gray-900 mb-1">${c.nome}</h3><p class="text-xs text-gray-400 font-medium mb-4">Criado em ${c.data} •${c.questoes.length} questões</p>
            <div class="mt-auto flex gap-2">
                <button onclick="abrirCaderno('${c.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-sm transition shadow-sm">Resolver</button>
                <button onclick="excluirCaderno('${c.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-2 rounded-xl text-sm transition shadow-sm"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
        </div>`).reverse().join('');
}

function abrirCaderno(id) {
    let cad = cadernosUsuario.find(c => c.id === id); if(!cad) return;
    document.getElementById('lista-cadernos').classList.add('hidden'); 
    document.getElementById('caderno-ativo-container').classList.remove('hidden');
    document.getElementById('titulo-caderno-ativo').innerText = `Resolvendo: ${cad.nome}`;
    renderizarQuestoesUI(cad.questoes); 
    if(document.getElementById('paginacao-container')) document.getElementById('paginacao-container').innerHTML = '';
}

function fecharCaderno() { 
    document.getElementById('lista-cadernos').classList.remove('hidden'); 
    document.getElementById('caderno-ativo-container').classList.add('hidden'); 
    document.getElementById('questoes-container').innerHTML = ''; 
}

function excluirCaderno(id) {
    if(!confirm("Deseja apagar este caderno?")) return;
    cadernosUsuario = cadernosUsuario.filter(c => c.id !== id);
    syncDB('cadernos', cadernosUsuario); 
    renderizarListaCadernos();
}

// ==========================================
// 6. RENDERIZAÇÃO DAS QUESTÕES (MESTRE)
// ==========================================
function renderizarQuestoesUI(questoes) {
    const container = document.getElementById('questoes-container'); if(!container) return; container.innerHTML = '';
    if(!questoes || questoes.length === 0) { container.innerHTML = '<div class="p-8 bg-white rounded-2xl text-center text-gray-500">Nenhuma questão encontrada.</div>'; return; }

    questoes.forEach((q, idx) => {
        const status = progressoUsuario[q.id]; let tag = '';
        if (status && status.timestamp && ((Date.now() - status.timestamp) / 3600000 >= 1)) {
            const cor = status.acertou ? 'bg-green-500' : 'bg-red-500'; 
            tag = `<div class="absolute -top-3 right-4 md:right-10 ${cor} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-fade-in">${status.acertou ? 'Correta' : 'Incorreta'}</div>`;
        }

        let textoEnunciado = q.enunciado.replace(/^Enunciado\s*:\s*/i, '');
        let alts = `<div class="mt-5 space-y-3 w-full" id="alts-${q.id}">`;
        
        q.alternativas.forEach(alt => {
            const letra = alt.charAt(0);
            let btnClasses = "w-full text-justify p-4 border rounded-xl transition-all duration-300 text-base md:text-lg break-words shadow-sm ";
            if (status) {
                btnClasses += "cursor-not-allowed opacity-80 ";
                if (letra === q.gabarito_letra) btnClasses += "bg-green-50 border-green-400 text-green-900 font-bold "; 
                else if (!status.acertou && status.escolhida === letra) btnClasses += "bg-red-50 border-red-300 text-red-900 "; 
                else btnClasses += "bg-gray-50 border-gray-200 text-gray-500 "; 
            } else { btnClasses += "bg-gray-50 border-gray-200 hover:border-green-300 hover:bg-white text-gray-800 "; }
            alts += `<button id="btn-${q.id}-${letra}" ${status ? 'disabled' : ''} onclick="responderMestre('${q.id}', '${letra}', '${q.gabarito_letra}')" class="${btnClasses}">${alt}</button>`;
        });
        alts += `</div>`;

        const iconeBandeira = `<svg class="w-6 h-6 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>`;
        const btnReport = `<button onclick="document.getElementById('report-box-${q.id}').classList.toggle('hidden')" class="text-gray-300 hover:text-red-500 transition p-2" title="Reportar erro">${iconeBandeira}</button>`;
        const boxReport = `<div id="report-box-${q.id}" class="hidden mt-4 p-4 bg-red-50 border border-red-100 rounded-xl animate-fade-in w-full"><p class="text
