// ==========================================
// 1. VARIÁVEIS GLOBAIS
// ==========================================
let currentUser = localStorage.getItem('currentUser') || 'visitante';
let progressoUsuario = {};
try {
    let salvo = localStorage.getItem(`progresso_${currentUser}`);
    if(salvo) progressoUsuario = JSON.parse(salvo);
} catch(e) {}

let paginaAtual = 1;

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
            alert("Cadastro enviado! Aguarde a aprovação.");
            alternarTela('form-login');
        } else { alert(data.erro); }
    } catch (e) { alert("Erro crítico de conexão."); }
}

// ==========================================
// 3. PAINEL DO DAVI (APROVAR, BLOQUEAR E LOGS)
// ==========================================
async function carregarPainelAdmin() {
    // 1. Carrega Pendentes
    try {
        const resP = await fetch('/api/admin/pendentes');
        const dataP = await resP.json();
        const usersP = Object.keys(dataP);
        if(document.getElementById('contador-pendentes')) document.getElementById('contador-pendentes').innerText = `${usersP.length} na fila`;
        const contP = document.getElementById('lista-pendentes');
        if(contP) {
            contP.innerHTML = usersP.length === 0 ? '<div class="text-gray-400 text-sm">Vazio.</div>' : usersP.map(u => `
                <div class="p-3 bg-gray-50 border rounded-lg flex justify-between items-center">
                    <span class="font-bold text-gray-800">${u}</span>
                    <div class="flex gap-1">
                        <button onclick="resolverPendente('${u}', 'aprovado')" class="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm">✓</button>
                        <button onclick="resolverPendente('${u}', 'negado')" class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm">✗</button>
                    </div>
                </div>`).join('');
        }
    } catch(e) {}

    // 2. Carrega Ativos (Gestão)
    try {
        const resA = await fetch('/api/admin/usuarios_ativos');
        const dataA = await resA.json();
        const usersA = Object.keys(dataA);
        const contA = document.getElementById('lista-ativos');
        if(contA) {
            contA.innerHTML = usersA.length === 0 ? '<div class="text-gray-400 text-sm">Nenhum outro usuário.</div>' : usersA.map(u => {
                const bloqueado = dataA[u].status === 'bloqueado';
                return `
                <div class="p-3 ${bloqueado ? 'bg-red-50' : 'bg-gray-50'} border rounded-lg flex justify-between items-center">
                    <div>
                        <span class="font-bold ${bloqueado ? 'text-red-900' : 'text-gray-800'}">${u}</span>
                        <span class="text-xs ml-2 ${bloqueado ? 'text-red-500' : 'text-green-500'}">${bloqueado ? 'Bloqueado' : 'Ativo'}</span>
                    </div>
                    <button onclick="resolverPendente('${u}', '${bloqueado ? 'aprovado' : 'bloqueado'}')" class="${bloqueado ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'} text-white px-2 py-1 rounded text-xs font-bold transition">
                        ${bloqueado ? 'Desbloquear' : 'Bloquear'}
                    </button>
                </div>`;
            }).join('');
        }
    } catch(e) {}
}

async function resolverPendente(user, acao) {
    await fetch('/api/admin/resolver', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, acao: acao}) });
    carregarPainelAdmin();
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
// 4. MOTOR DE QUESTÕES E FEEDBACK VISUAL
// ==========================================
let categoriasDB = {};
async function carregarFiltros() {
    try {
        const res = await fetch('/api/categorias');
        categoriasDB = await res.json();
        const sMat = document.getElementById('f-mat');
        if(!sMat) return;

        sMat.innerHTML = '<option value="Todos">Todas as Matérias</option>';
        Object.keys(categoriasDB).sort().forEach(m => { sMat.innerHTML += `<option value="${m}">${m} (${categoriasDB[m].count})</option>`; });
        
        sMat.addEventListener('change', () => {
            const sAss = document.getElementById('f-ass'); const sSub = document.getElementById('f-sub');
            sAss.innerHTML = '<option value="Todos">Todos os Conteúdos</option>'; sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
            sSub.disabled = true;
            if (sMat.value !== "Todos") {
                const assData = categoriasDB[sMat.value].assuntos;
                Object.keys(assData).sort().forEach(a => { sAss.innerHTML += `<option value="${a}">${a} (${assData[a].count})</option>`; });
                sAss.disabled = false;
            }
        });

        document.getElementById('f-ass').addEventListener('change', () => {
            const sMat = document.getElementById('f-mat').value; const sAss = document.getElementById('f-ass').value; const sSub = document.getElementById('f-sub');
            sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
            if (sAss !== "Todos") {
                const subData = categoriasDB[sMat].assuntos[sAss].subs;
                Object.keys(subData).sort().forEach(s => { sSub.innerHTML += `<option value="${s}">${s} (${subData[s]})</option>`; });
                sSub.disabled = false;
            }
        });
    } catch(e) {}
}

async function aplicarFiltros(pagina = 1) {
    paginaAtual = pagina;
    const limit = document.getElementById('limite-pagina') ? document.getElementById('limite-pagina').value : 20;
    const mat = document.getElementById('f-mat') ? document.getElementById('f-mat').value : "Todos";
    
    const aviso = document.getElementById('aviso-aleatorio');
    if (aviso) { (mat !== "Todos") ? aviso.classList.add('hidden') : aviso.classList.remove('hidden'); }

    const payload = { pagina: paginaAtual, limite: parseInt(limit), materia: mat, assunto: document.getElementById('f-ass') ? document.getElementById('f-ass').value : "Todos", subassunto: document.getElementById('f-sub') ? document.getElementById('f-sub').value : "Todos" };

    try {
        const res = await fetch('/api/questoes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const dados = await res.json();
        renderizarQuestoesUI(dados.questoes);
        renderizarPaginacaoUI(dados.total, parseInt(limit));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e) {}
}

function renderizarQuestoesUI(questoes) {
    const container = document.getElementById('questoes-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(!questoes || questoes.length === 0) { 
        container.innerHTML = '<div class="p-8 bg-white rounded-2xl text-center text-gray-500">Nenhuma questão encontrada.</div>'; 
        return; 
    }

    questoes.forEach((q, idx) => {
        const status = progressoUsuario[q.id];
        let tag = '';
        if (status && status.timestamp && ((Date.now() - status.timestamp) / 3600000 >= 1)) {
            const cor = status.acertou ? 'bg-green-500' : 'bg-red-500';
            tag = `<div class="absolute -top-3 right-6 md:right-10 ${cor} text-white px-3 py-1 rounded-full text-[10px] md:text-xs font-bold shadow-lg animate-fade-in">${status.acertou ? 'Correta' : 'Incorreta'}</div>`;
        }

        let alts = `<div class="mt-5 space-y-3" id="alts-${q.id}">`;
        q.alternativas.forEach(alt => {
            const letra = alt.charAt(0);
            // text-sm para celular, md:text-base para PC (aumenta o texto das alternativas)
            let btnClasses = "w-full text-left p-4 border rounded-xl transition-all duration-300 text-sm md:text-base ";
            if (status) {
                btnClasses += "cursor-not-allowed opacity-80 ";
                if (letra === q.gabarito_letra) btnClasses += "bg-green-50 border-green-400 text-green-900 font-bold "; 
                else if (!status.acertou && status.escolhida === letra) btnClasses += "bg-red-50 border-red-300 text-red-900 "; 
                else btnClasses += "bg-gray-50 border-gray-200 text-gray-500 "; 
            } else { btnClasses += "bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-white text-gray-700 "; }
            alts += `<button id="btn-${q.id}-${letra}" ${status ? 'disabled' : ''} onclick="responderMestre('${q.id}', '${letra}', '${q.gabarito_letra}')" class="${btnClasses}">${alt}</button>`;
        });
        alts += `</div>`;

        const iconeBandeira = `<svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>`;
        const btnReport = `<button onclick="document.getElementById('report-box-${q.id}').classList.toggle('hidden')" class="text-gray-300 hover:text-red-500 transition" title="Reportar erro nesta questão">${iconeBandeira}</button>`;
        const boxReport = `
            <div id="report-box-${q.id}" class="hidden mt-4 p-4 bg-red-50 border border-red-100 rounded-xl animate-fade-in">
                <p class="text-[10px] md:text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">Reportar Problema</p>
                <textarea id="texto-report-${q.id}" rows="2" class="w-full p-3 rounded-lg border border-red-200 text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none" placeholder="Ex: Gabarito incorreto, alternativa faltando..."></textarea>
                <div class="flex justify-end gap-3 mt-2">
                    <button onclick="document.getElementById('report-box-${q.id}').classList.add('hidden')" class="text-sm text-gray-500 hover:underline">Cancelar</button>
                    <button onclick="enviarReporte('${q.id}')" class="text-sm bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-1.5 rounded transition">Enviar ao Davi</button>
                </div>
            </div>`;

        const btnRes = `<div class="flex justify-between items-center mt-5">
                            <button onclick="mostrarResolucao('${q.id}', false)" class="text-blue-600 text-sm md:text-base font-bold hover:underline">Ver Resolução</button>
                            ${btnReport}
                        </div>`;
        const comHtml = `<div id="com-${q.id}" class="hidden mt-4 p-5 bg-blue-50 border border-blue-100 rounded-xl text-left animate-fade-in"><p class="font-black text-blue-900 mb-2 text-sm md:text-base">Gabarito Oficial: ${q.gabarito_letra}</p><p class="text-gray-700 leading-relaxed text-sm md:text-base">${q.comentario}</p></div>`;

        container.innerHTML += `
            <div class="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 relative">
                ${tag}
                <!-- Diminui os temas no mobile text-[10px] e permite quebrar a linha -->
                <div class="text-[10px] md:text-xs text-gray-400 mb-3 font-bold tracking-widest uppercase break-words leading-relaxed">${q.temas_dinamicos.join(' • ')}</div>
                
                <!-- Enunciado com fonte equilibrada -->
                <p class="text-base md:text-lg text-left leading-relaxed font-medium text-gray-800">${q.enunciado}</p>
                
                ${alts}
                ${btnRes}
                ${boxReport}
                ${comHtml}
            </div>`;
    });
}

function responderMestre(id, escolhida, correta) {
    progressoUsuario[id] = { acertou: (escolhida === correta), escolhida: escolhida, timestamp: Date.now() };
    localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
    
    const container = document.getElementById(`alts-${id}`);
    const botoes = container.getElementsByTagName('button');
    for (let btn of botoes) {
        btn.disabled = true;
        btn.classList.add('cursor-not-allowed', 'opacity-80');
        btn.classList.remove('hover:border-blue-300', 'hover:bg-white', 'text-gray-700');
        const letraBtn = btn.id.split('-').pop();
        if (letraBtn === correta) { btn.classList.add('bg-green-50', 'border-green-400', 'text-green-900', 'font-bold'); btn.classList.remove('bg-gray-50', 'border-gray-200'); }
        else if (letraBtn === escolhida && escolhida !== correta) { btn.classList.add('bg-red-50', 'border-red-300', 'text-red-900'); btn.classList.remove('bg-gray-50', 'border-gray-200'); }
        else { btn.classList.add('text-gray-500'); }
    }
    mostrarResolucao(id, true);
    atualizarNumerosEstatisticas();
}

function mostrarResolucao(id, autoAberta = false) {
    const box = document.getElementById(`com-${id}`);
    if (box) box.classList.remove('hidden');
    if (!autoAberta && !progressoUsuario[id]) {
        progressoUsuario[id] = { acertou: false, escolhida: '-', timestamp: Date.now() }; 
        localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
        const botoes = document.getElementById(`alts-${id}`).children;
        for (let b of botoes) { b.disabled = true; b.classList.add('opacity-50', 'cursor-not-allowed'); b.classList.remove('hover:border-blue-300', 'hover:bg-white'); }
        atualizarNumerosEstatisticas();
    }
}

// NOVO: Função de Enviar Reporte
async function enviarReporte(idQuestao) {
    const textoBox = document.getElementById(`texto-report-${idQuestao}`);
    const motivo = textoBox.value.trim();
    if (!motivo) return alert("Por favor, descreva o erro antes de enviar.");

    try {
        await fetch('/api/reportar', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: idQuestao, motivo: motivo, usuario: currentUser })
        });
        document.getElementById(`report-box-${idQuestao}`).classList.add('hidden');
        textoBox.value = '';
        alert("Erro reportado com sucesso. Muito obrigado!");
    } catch(e) { alert("Falha ao enviar reporte. Tente novamente."); }
}

function atualizarNumerosEstatisticas() {
    const ids = Object.keys(progressoUsuario); let acertos = 0;
    ids.forEach(id => { if (progressoUsuario[id].acertou) acertos++; });
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = ids.length;
    if(document.getElementById('stat-acertos')) document.getElementById('stat-acertos').innerText = acertos;
    if(document.getElementById('stat-erros')) document.getElementById('stat-erros').innerText = ids.length - acertos;
}

function renderizarPaginacaoUI(total, limit) {
    const container = document.getElementById('paginacao-container');
    if(!container) return;
    container.innerHTML = '';
    const totalPags = Math.ceil(total / limit);
    if (totalPags <= 1) return;
    if (paginaAtual > 1) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual - 1})" class="p-2 border rounded hover:bg-gray-50 transition">«</button>`;
    
    let mostrouUltima = false;
    for (let i = 1; i <= totalPags; i++) {
        if (i <= 3 || i === paginaAtual || i === paginaAtual - 1 || i === paginaAtual + 1) {
            const active = (i === paginaAtual) ? 'bg-blue-600 text-white font-bold' : 'bg-white hover:bg-gray-50';
            container.innerHTML += `<button onclick="aplicarFiltros(${i})" class="p-2 border rounded transition ${active}">${i}</button>`;
        } else if (i === 4 && paginaAtual < 3) {
            container.innerHTML += `<span class="px-2 text-gray-400">...</span>`; mostrouUltima = true; break;
        } else if (i > paginaAtual + 1 && i < totalPags) {
            if (!mostrouUltima) { container.innerHTML += `<span class="px-2 text-gray-400">...</span>`; mostrouUltima = true; }
        }
    }
    if (mostrouUltima || paginaAtual < totalPags - 1) container.innerHTML += `<button onclick="aplicarFiltros(${totalPags})" class="p-2 border rounded hover:bg-gray-50 transition">${totalPags}</button>`;
    if (paginaAtual < totalPags) container.innerHTML += `<button onclick="aplicarFiltros(${paginaAtual + 1})" class="p-2 border rounded hover:bg-gray-50 transition">»</button>`;
}

async function gerarPDF() {
    alert("Iniciando geração do PDF...");
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
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
// 5. INICIALIZAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    atualizarNumerosEstatisticas();
    if(document.getElementById('sidebar-avatar') && currentUser) document.getElementById('sidebar-avatar').innerText = currentUser.charAt(0).toUpperCase();

    if (currentUser === 'davi' && document.getElementById('admin-panel')) {
        document.getElementById('admin-panel').classList.remove('hidden');
        carregarPainelAdmin(); carregarLogsServidor(); setInterval(carregarLogsServidor, 3000); 
    }
    if(document.getElementById('f-mat')) { carregarFiltros().then(() => aplicarFiltros(1)); }
});
