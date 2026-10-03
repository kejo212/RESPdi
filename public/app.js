let progressoUsuario = {};
let arvoreCategorias = {};
let paginaAtual = 1;
let totalResultados = 0;
let cachePaginas = {}; // Armazena as páginas requisitadas para não baixar de novo

const user = 'davi';
const pass = '1234';

// Troca de Tema
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
});
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
}

// Autenticação Forçada
document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    if (u === user && p === pass) {
        localStorage.setItem('auth', 'true');
        iniciarApp();
    } else {
        alert("Credenciais inválidas. Use davi / 1234");
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('auth');
    window.location.reload();
});

if (localStorage.getItem('auth') === 'true') {
    iniciarApp();
}

function iniciarApp() {
    progressoUsuario = JSON.parse(localStorage.getItem('progresso_davi')) || {};
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('btn-logout').classList.remove('hidden');
    
    atualizarEstatisticas();
    carregarCategoriasAPI();
}

// Navegação de Telas
function mostrarDashboard() {
    document.getElementById('questoes-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    atualizarEstatisticas();
}

function mostrarSessaoQuestoes() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('questoes-view').classList.remove('hidden');
    document.getElementById('questoes-view').classList.add('flex');
    aplicarFiltros();
}

function atualizarEstatisticas() {
    const idsFeitos = Object.keys(progressoUsuario);
    let acertos = 0;
    
    idsFeitos.forEach(id => {
        if (progressoUsuario[id].acertou) acertos++;
    });

    const erros = idsFeitos.length - acertos;
    
    document.getElementById('stat-total').innerText = idsFeitos.length;
    document.getElementById('stat-acertos').innerText = acertos;
    document.getElementById('stat-erros').innerText = erros;
}

// Integração com API (Backend Python)
async function carregarCategoriasAPI() {
    try {
        const res = await fetch('/api/categorias');
        arvoreCategorias = await res.json();
        preencherDropdowns();
    } catch (e) {
        console.error("Erro ao carregar categorias. O servidor Python está rodando?");
    }
}

function preencherDropdowns() {
    const sMat = document.getElementById('filtro-materia');
    const sAss = document.getElementById('filtro-assunto');
    const sSub = document.getElementById('filtro-subassunto');
    
    Object.keys(arvoreCategorias).sort().forEach(m => sMat.appendChild(new Option(m, m)));

    sMat.addEventListener('change', () => {
        sAss.innerHTML = '<option value="Todos">Todos os Conteúdos</option>';
        sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
        sSub.disabled = true; sSub.classList.add('opacity-50');

        if (sMat.value === "Todos") {
            sAss.disabled = true; sAss.classList.add('opacity-50');
            return;
        }

        Object.keys(arvoreCategorias[sMat.value]).sort().forEach(a => sAss.appendChild(new Option(a, a)));
        sAss.disabled = false; sAss.classList.remove('opacity-50');
    });

    sAss.addEventListener('change', () => {
        sSub.innerHTML = '<option value="Todos">Todos os Assuntos</option>';
        if (sAss.value === "Todos") {
            sSub.disabled = true; sSub.classList.add('opacity-50');
            return;
        }

        arvoreCategorias[sMat.value][sAss.value].sort().forEach(s => sSub.appendChild(new Option(s, s)));
        sSub.disabled = false; sSub.classList.remove('opacity-50');
    });
}

function getEstadoFiltros() {
    return {
        palavraChave: document.getElementById('filtro-busca').value,
        materia: document.getElementById('filtro-materia').value,
        assunto: document.getElementById('filtro-assunto').value,
        subassunto: document.getElementById('filtro-subassunto').value,
        ineditas: document.getElementById('chk-ineditas').checked,
        acertos: document.getElementById('chk-acertos').checked,
        erradas: document.getElementById('chk-erradas').checked,
        progresso: progressoUsuario // Envia pro servidor saber o que já foi feito
    };
}

document.getElementById('btn-filtrar').addEventListener('click', aplicarFiltros);

async function aplicarFiltros() {
    paginaAtual = 1;
    cachePaginas = {}; // Limpa o cache ao mudar filtros
    await carregarPagina(paginaAtual);
}

// O Pre-Fetch (Carrega até 2 páginas por vez, só a que visualiza e a próxima)
async function requisitarApi(pagina) {
    if (cachePaginas[pagina]) return cachePaginas[pagina];

    const payload = getEstadoFiltros();
    payload.pagina = pagina;

    const res = await fetch('/api/questoes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    const dados = await res.json();
    cachePaginas[pagina] = dados;
    return dados;
}

async function carregarPagina(pagina) {
    paginaAtual = pagina;
    const container = document.getElementById('questoes-container');
    container.innerHTML = '<p class="text-center py-10 font-bold text-blue-600 animate-pulse text-justify">Buscando questões no servidor...</p>';

    const dados = await requisitarApi(pagina);
    totalResultados = dados.total;
    
    document.getElementById('contador-questoes').innerText = `${totalResultados} encontradas`;
    renderizarQuestoes(dados.questoes);
    renderizarPaginacao();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Pre-Fetch Silencioso: Se houver próxima página, já baixa no background
    if ((pagina * 20) < totalResultados) {
        requisitarApi(pagina + 1);
    }
}

function renderizarQuestoes(questoes) {
    const container = document.getElementById('questoes-container');
    container.innerHTML = '';

    if (questoes.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-10 text-justify">Nenhuma questão encontrada.</p>';
        return;
    }

    questoes.forEach(q => {
        const statusAnterior = progressoUsuario[q.id]; 
        const div = document.createElement('div');
        div.className = "bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl shadow-sm border dark:border-gray-700";
        
        let temasBadge = q.temas_dinamicos ? q.temas_dinamicos.join(" > ") : "Sem Tema";
        let imagemHtml = q.imagem ? `<img src="${q.imagem}" class="my-6 max-h-80 mx-auto rounded-lg shadow" loading="lazy">` : '';
        
        let enunciadoLimpo = q.enunciado;
        if (enunciadoLimpo.toLowerCase().startsWith('enunciado:')) {
            enunciadoLimpo = enunciadoLimpo.substring(10).trim();
        }
        
        let botoesAlternativas = `<div class="mt-6 space-y-3">`;
        if (q.alternativas) {
            q.alternativas.forEach(alt => {
                const letra = alt.charAt(0).toUpperCase();
                let classesBotao = "w-full text-justify leading-relaxed p-4 border rounded-lg transition ";
                let isDisabled = statusAnterior ? "disabled" : "";
                
                if (statusAnterior) {
                    if (letra === q.gabarito_letra) {
                        classesBotao += "bg-green-100 border-green-500 text-green-900 dark:bg-green-900/50 dark:border-green-500 dark:text-green-100 font-bold border-2";
                    } else if (letra === statusAnterior.escolhida && !statusAnterior.acertou) {
                        classesBotao += "bg-red-100 border-red-500 text-red-900 dark:bg-red-900/50 dark:border-red-500 dark:text-red-100 border-2";
                    } else {
                        classesBotao += "opacity-50 dark:border-gray-600";
                    }
                } else {
                    classesBotao += "hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 cursor-pointer";
                }
                botoesAlternativas += `<button ${isDisabled} onclick="responderQuestao(this, '${q.id}', '${letra}', '${q.gabarito_letra}')" class="${classesBotao}">${alt}</button>`;
            });
        }
        botoesAlternativas += `</div>`;

        let comentarioHtml = '';
        if (q.comentario || q.gabarito_letra) {
            const showComentario = statusAnterior ? 'block' : 'hidden';
            comentarioHtml = `
                <div class="${showComentario} mt-6 p-5 bg-blue-50/50 dark:bg-gray-700/50 border dark:border-gray-600 rounded-lg text-justify" id="comentario-${q.id}">
                    <p class="font-bold text-green-700 dark:text-green-400 mb-3">Gabarito Oficial: ${q.gabarito_letra || 'N/A'}</p>
                    <p class="text-sm md:text-base leading-relaxed text-justify">${q.comentario || 'Sem comentário.'}</p>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between text-xs text-gray-500 dark:text-gray-400 mb-5 pb-3 border-b dark:border-gray-700 gap-2 text-justify">
                <span class="font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded w-fit">ID: ${q.id}</span>
                <span class="truncate italic">${temasBadge}</span>
            </div>
            <p class="text-base md:text-lg text-justify leading-relaxed font-medium">${enunciadoLimpo}</p>
            ${imagemHtml}
            ${botoesAlternativas}
            ${comentarioHtml}
        `;
        container.appendChild(div);
    });
}

function responderQuestao(botao, idQuestao, letraEscolhida, letraCorreta) {
    const alternativas = botao.parentElement.children;
    const acertou = (letraEscolhida === letraCorreta);
    
    for (let btn of alternativas) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        btn.classList.remove('hover:bg-gray-50', 'dark:hover:bg-gray-700');
    }
    
    botao.classList.remove('opacity-60');
    if (acertou) {
        botao.classList.add('bg-green-100', 'border-green-500', 'text-green-900', 'dark:bg-green-900/50', 'dark:border-green-500', 'dark:text-green-100', 'border-2', 'font-bold');
    } else {
        botao.classList.add('bg-red-100', 'border-red-500', 'text-red-900', 'dark:bg-red-900/50', 'dark:border-red-500', 'dark:text-red-100', 'border-2');
        for (let btn of alternativas) {
            if (btn.innerText.trim().toUpperCase().startsWith(letraCorreta)) {
                btn.classList.remove('opacity-60');
                btn.classList.add('bg-green-100', 'border-green-500', 'text-green-900', 'dark:bg-green-900/50', 'dark:border-green-500', 'dark:text-green-100', 'border-2', 'font-bold');
            }
        }
    }

    progressoUsuario[idQuestao] = { respondida: true, acertou: acertou, escolhida: letraEscolhida };
    localStorage.setItem('progresso_davi', JSON.stringify(progressoUsuario));
    
    const comentarioDiv = document.getElementById(`comentario-${idQuestao}`);
    if(comentarioDiv) {
        comentarioDiv.classList.remove('hidden');
        comentarioDiv.classList.add('block');
    }
}

function renderizarPaginacao() {
    const container = document.getElementById('paginacao-container');
    container.innerHTML = '';
    const totalPaginas = Math.ceil(totalResultados / 20);
    
    if (totalPaginas <= 1) return;

    if (paginaAtual > 1) container.innerHTML += `<button onclick="carregarPagina(${paginaAtual - 1})" class="page-link bg-white dark:bg-gray-800 text-justify">Anterior</button>`;

    let inicio = Math.max(1, paginaAtual - 2);
    let fim = Math.min(totalPaginas, inicio + 4);
    if (fim - inicio < 4) inicio = Math.max(1, fim - 4);

    if (inicio > 1) container.innerHTML += `<span class="px-2 py-1 text-gray-500 text-justify">...</span>`;

    for (let i = inicio; i <= fim; i++) {
        const activeClass = (i === paginaAtual) ? 'active' : 'bg-white dark:bg-gray-800';
        container.innerHTML += `<button onclick="carregarPagina(${i})" class="page-link ${activeClass} text-justify">${i}</button>`;
    }

    if (fim < totalPaginas) container.innerHTML += `<span class="px-2 py-1 text-gray-500 text-justify">...</span>`;
    if (paginaAtual < totalPaginas) container.innerHTML += `<button onclick="carregarPagina(${paginaAtual + 1})" class="page-link bg-white dark:bg-gray-800 text-justify">Próxima</button>`;
}