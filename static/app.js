// ==========================================
// 1. VARIÁVEIS GLOBAIS (BLINDADAS)
// ==========================================
let currentUser = localStorage.getItem('currentUser') || 'visitante';
let progressoUsuario = {};
try {
    let salvo = localStorage.getItem(`progresso_${currentUser}`);
    if(salvo) progressoUsuario = JSON.parse(salvo);
} catch(e) { console.error("Erro ao ler progresso."); }

let paginaAtual = 1;
let questaoAtualReport = null;

// ==========================================
// 2. SISTEMA DE LOGIN E CADASTRO
// ==========================================
function alternarTela(alvo) {
    const d1 = document.getElementById('form-login');
    const d2 = document.getElementById('form-cadastro-1');
    const d3 = document.getElementById('form-cadastro-2');
    
    [d1, d2, d3].forEach(el => {
        if(el) { el.classList.add('hidden', 'translate-x-full', 'absolute'); el.classList.remove('translate-x-0', 'relative'); }
    });
    
    const target = document.getElementById(alvo);
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
            window.location.href = '/dashboard';
        } else { alert(data.erro || "Erro ao fazer login."); }
    } catch (e) { alert("Erro de conexão com o servidor."); }
}

async function enviarCadastro() {
    const u = document.getElementById('new-user').value.trim();
    const p = document.getElementById('new-pass').value.trim();
    const tags = Array.from(document.querySelectorAll('.tag-check:checked')).map(el => el.value);
    
    if (!u || !p) return alert("Preencha usuário e senha para cadastrar!");
    try {
        const res = await fetch('/api/cadastro', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p, tags: tags}) });
        const data = await res.json();
        if(res.ok && data.sucesso) {
            alert("Cadastro enviado! Aguarde a aprovação do Davi.");
            alternarTela('form-login');
        } else { alert(data.erro || "Erro ao realizar cadastro."); }
    } catch (e) { alert("Erro crítico de conexão."); }
}

// ==========================================
// 3. PAINEL DO DAVI E TERMINAL
// ==========================================
async function carregarPendentes() {
    try {
        const res = await fetch('/api/admin/pendentes');
        const data = await res.json();
        const container = document.getElementById('lista-pendentes');
        if(!container) return;
        
        const users = Object.keys(data);
        const cont = document.getElementById('contador-pendentes');
        if(cont) cont.innerText = `${users.length} na fila`;
        container.innerHTML = '';
        
        if (users.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500 font-medium">Nenhum usuário aguardando.</div>';
            return;
        }
        
        users.forEach(user => {
            let tagsHtml = data[user].tags.map(t => `<span class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200">${t}</span>`).join(' ');
            container.innerHTML += `
                <div class="p-4 bg-gray-50 border rounded-xl mb-3 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-lg text-gray-900">${user}</p>
                        <div class="flex gap-2 mt-1">${tagsHtml}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="resolverPendente('${user}', 'aprovado')" class="bg-green-500 text-white p-2 rounded hover:bg-green-600">Aprovar</button>
                        <button onclick="resolverPendente('${user}', 'negado')" class="bg-red-500 text-white p-2 rounded hover:bg-red-600">Negar</button>
                    </div>
                </div>`;
        });
    } catch(e) { console.error("Erro painel:", e); }
}

async function resolverPendente(user, acao) {
    await fetch('/api/admin/resolver', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, acao: acao}) });
    carregarPendentes();
}

async function carregarLogsServidor() {
    try {
        const res = await fetch('/api/admin/logs');
        const logs = await res.json();
        const container = document.getElementById('server-logs');
        if(!container) return;
        
        let htmlLogs = logs.map(linha => {
            if (linha.includes("[ERRO CRÍTICO]")) return `<div class="text-red-400 font-bold">${linha}</div>`;
            if (linha.includes("[OK]")) return `<div class="text-green-300">${linha}</div>`;
            if (linha.includes("ALERTA:")) return `<div class="text-yellow-400">${linha}</div>`;
            return `<div>${linha}</div>`;
        }).join('');
        
        const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
        container.innerHTML = htmlLogs || '<div class="text-gray-500">Aguardando logs...</div>';
        if (isAtBottom) container.scrollTop = container.scrollHeight;
    } catch (e) { }
}

// ==========================================
// 4. MOTOR DE QUESTÕES E FILTROS
// ==========================================
let categoriasDB = {};
async function carregarFiltros() {
    try {
        const res = await fetch('/api/categorias');
        categoriasDB = await res.json();
        
        const sMat = document.getElementById('f-mat');
        if(!sMat) return;

        sMat.innerHTML = '<option value="Todos">Todas as Matérias</option>';
        Object.keys(categoriasDB).sort().forEach(m => {
            sMat.innerHTML += `<option value="${m}">${m} (${categoriasDB[m].count})</option>`;
        });

        sMat.addEventListener('change', () => {
            const sAss = document.getElementById('f-ass');
            const sSub = document.getElementById('f-sub');
            sAss.innerHTML = '<option value="Todos">Todos os Conteúdos</option>';
            sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
            sSub.disabled = true;

            if (sMat.value !== "Todos") {
                const assData = categoriasDB[sMat.value].assuntos;
                Object.keys(assData).sort().forEach(a => {
                    sAss.innerHTML += `<option value="${a}">${a} (${assData[a].count})</option>`;
                });
                sAss.disabled = false;
            }
        });

        document.getElementById('f-ass').addEventListener('change', () => {
            const sMat = document.getElementById('f-mat').value;
            const sAss = document.getElementById('f-ass').value;
            const sSub = document.getElementById('f-sub');
            sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
            
            if (sAss !== "Todos") {
                const subData = categoriasDB[sMat].assuntos[sAss].subs;
                Object.keys(subData).sort().forEach(s => {
                    sSub.innerHTML += `<option value="${s}">${s} (${subData[s]})</option>`;
                });
                sSub.disabled = false;
            }
        });
    } catch(e) { console.error("Erro ao carregar filtros:", e); }
}

async function aplicarFiltros(pagina = 1) {
    paginaAtual = pagina;
    const limit = document.getElementById('limite-pagina') ? document.getElementById('limite-pagina').value : 20;
    const mat = document.getElementById('f-mat') ? document.getElementById('f-mat').value : "Todos";
    
    // Controle do aviso Aleatório
    const aviso = document.getElementById('aviso-aleatorio');
    if (aviso) {
        if (mat !== "Todos") aviso.classList.add('hidden');
        else aviso.classList.remove('hidden');
    }

    const payload = {
        pagina: paginaAtual,
        limite: parseInt(limit),
        materia: mat,
        assunto: document.getElementById('f-ass') ? document.getElementById('f-ass').value : "Todos",
        subassunto: document.getElementById('f-sub') ? document.getElementById('f-sub').value : "Todos"
    };

    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        renderizarQuestoesUI(dados.questoes);
        renderizarPaginacaoUI(dados.total, parseInt(limit));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e) { console.error("Erro ao puxar questões:", e); }
}

function renderizarQuestoesUI(questoes) {
    const container = document.getElementById('questoes-container');
    if(!container) return;
    container.innerHTML = '';

    if(!questoes || questoes.length === 0) {
        container.innerHTML = '<div class="p-8 bg-white rounded-2xl text-center text-gray-500 shadow-sm border border-gray-100">Nenhuma questão encontrada para este filtro.</div>';
        return;
    }

    questoes.forEach((q, idx) => {
        const status = progressoUsuario[q.id];
        let tag = '';
        if (status) {
            const cor = status.acertou ? 'bg-green-500' : 'bg-red-500';
            const texto = status.acertou ? 'Respondida Corretamente' : 'Respondida Incorretamente';
            tag = `<div class="absolute -top-3 right-10 ${cor} text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">${texto}</div>`;
        }

        let alts = `<div class="mt-6 space-y-3" id="alts-${q.id}">`;
        q.alternativas.forEach(alt => {
            const letra = alt.charAt(0);
            alts += `<button ${status ? 'disabled' : ''} onclick="responder('${q.id}', '${letra}', '${q.gabarito_letra}')" class="w-full text-justify p-4 border border-gray-200 bg-gray-50 rounded-xl transition-all ${status ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300 hover:bg-white'}">${alt}</button>`;
        });
        alts += `</div>`;

        const btnRes = `<button onclick="mostrarResolucao('${q.id}')" class="mt-4 text-blue-600 font-bold hover:underline flex items-center gap-2">Ver Resolução</button>`;
        const comHtml = `<div id="com-${q.id}" class="hidden mt-6 p-6 bg-blue-50 border border-blue-100 rounded-xl text-justify"><p class="font-black text-blue-900 mb-2">Gabarito: ${q.gabarito_letra}</p><p class="text-gray-700">${q.comentario}</p></div>`;

        container.innerHTML += `
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 relative">
                ${tag}
                <div class="text-xs text-gray-400 mb-4 font-bold tracking-widest uppercase">${q.temas_dinamicos.join(' • ')}</div>
                <p class="text-lg text-justify leading-relaxed font-medium text-gray-800">${q.enunciado}</p>
                ${alts}
                ${btnRes}
                ${comHtml}
            </div>
        `;
    });
}

function responder(id, escolhida, correta) {
    progressoUsuario[id] = { acertou: escolhida === correta };
    localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
    aplicarFiltros(paginaAtual);
}

function mostrarResolucao(id) {
    document.getElementById(`com-${id}`).classList.remove('hidden');
    if (!progressoUsuario[id]) {
        progressoUsuario[id] = { acertou: false }; 
        localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
        const botoes = document.getElementById(`alts-${id}`).children;
        for (let b of botoes) { b.disabled = true; b.classList.add('opacity-50', 'cursor-not-allowed'); }
    }
}

function renderizarPaginacaoUI(total, limit) {
    const container = document.getElementById('paginacao-container');
    if(!container) return;
    container.innerHTML = '';
    const totalPags = Math.ceil(total / limit);
    if (totalPags <= 1) return;

    if (paginaAtual > 1) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual - 1})" class="p-2 border rounded">«</button>`;
    
    let mostrouUltima = false;
    for (let i = 1; i <= totalPags; i++) {
        if (i <= 3 || i === paginaAtual || i === paginaAtual - 1 || i === paginaAtual + 1) {
            const active = (i === paginaAtual) ? 'bg-blue-600 text-white' : 'bg-white';
            container.innerHTML += `<button onclick="aplicarFiltros(${i})" class="p-2 border rounded ${active}">${i}</button>`;
        } else if (i === 4 && paginaAtual < 3) {
            container.innerHTML += `<span class="px-2">...</span>`; mostrouUltima = true; break;
        } else if (i > paginaAtual + 1 && i < totalPags) {
            if (!mostrouUltima) { container.innerHTML += `<span class="px-2">...</span>`; mostrouUltima = true; }
        }
    }
    
    if (mostrouUltima || paginaAtual < totalPags - 1) container.innerHTML += `<button onclick="aplicarFiltros(${totalPags})" class="p-2 border rounded">${totalPags}</button>`;
    if (paginaAtual < totalPags) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual + 1})" class="p-2 border rounded">»</button>`;
}

// PDF Exportação
async function gerarPDF() {
    alert("Iniciando geração do PDF...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const payload = { pagina: 1, limite: 100, materia: document.getElementById('f-mat') ? document.getElementById('f-mat').value : 'Todos' };
    
    const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const dados = await res.json();
    
    let y = 20; let gabaritoArr = [];
    doc.setFontSize(16); doc.text("RESPdi - Simulado", 10, y); y += 10; doc.setFontSize(10);

    dados.questoes.forEach((q, idx) => {
        gabaritoArr.push([idx + 1, q.gabarito_letra]);
        let textoQuestao = `Questao ${idx + 1}: ${q.enunciado}\n`;
        q.alternativas.forEach(alt => textoQuestao += `${alt}\n`);
        const lines = doc.splitTextToSize(textoQuestao, 180);
        if (y + (lines.length * 5) > 280) { doc.addPage(); y = 20; }
        doc.text(lines, 10, y); y += (lines.length * 5) + 10;
    });

    doc.addPage(); doc.text("Gabarito do Simulado", 10, 20);
    doc.autoTable({ startY: 30, head: [['Questao', 'Alternativa Correta']], body: gabaritoArr });
    doc.save("Simulado_RESPdi.pdf");
}

// ==========================================
// 5. INICIALIZAÇÃO AUTOMÁTICA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const ids = Object.keys(progressoUsuario);
    let acertos = 0;
    ids.forEach(id => { if (progressoUsuario[id].acertou) acertos++; });
    
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = ids.length;
    if(document.getElementById('stat-acertos')) document.getElementById('stat-acertos').innerText = acertos;
    if(document.getElementById('stat-erros')) document.getElementById('stat-erros').innerText = ids.length - acertos;
    if(document.getElementById('sidebar-avatar') && currentUser) document.getElementById('sidebar-avatar').innerText = currentUser.charAt(0).toUpperCase();

    if (currentUser === 'davi' && document.getElementById('admin-panel')) {
        document.getElementById('admin-panel').classList.remove('hidden');
        carregarPendentes(); carregarLogsServidor(); setInterval(carregarLogsServidor, 3000); 
    }

    if(document.getElementById('f-mat')) {
        carregarFiltros().then(() => aplicarFiltros(1));
    }
});
