// --- RENDERIZAÇÃO DE QUESTÕES E TAGS ---
function renderizarQuestoes(questoes) {
    const container = document.getElementById('questoes-container');
    container.innerHTML = '';

    questoes.forEach(q => {
        const div = document.createElement('div');
        div.className = "bg-white p-8 rounded-xl shadow-md mb-6 transform transition-all duration-300 hover:shadow-xl relative";
        
        let statusBadge = "";
        const status = progressoUsuario[q.id];
        
        if (status) {
            const cor = status.acertou ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
            const texto = status.acertou ? "Respondida Corretamente" : "Respondida Incorretamente";
            statusBadge = `<div class="absolute top-4 right-16 ${cor} px-3 py-1 rounded-full text-xs font-bold shadow-sm animate-fade-in">${texto}</div>`;
        }

        // Botão Alarme
        const btnAlarme = `
            <button onclick="abrirModalReport('${q.id}')" class="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors tooltip" title="Reportar Erro">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </button>
        `;

        let botoesAlternativas = `<div class="mt-6 space-y-3" id="alts-${q.id}">`;
        q.alternativas.forEach(alt => {
            const letra = alt.charAt(0).toUpperCase();
            const disabled = status ? "disabled opacity-70 cursor-not-allowed" : "hover:scale-[1.01] hover:bg-blue-50";
            botoesAlternativas += `<button ${disabled} onclick="responder('${q.id}', '${letra}', '${q.gabarito_letra}')" class="w-full text-justify p-4 border rounded-lg transition-all ${disabled}">${alt}</button>`;
        });
        botoesAlternativas += `</div>`;

        // Botão Resolução
        const btnResolucao = `<button onclick="verResolucao('${q.id}', '${q.gabarito_letra}')" class="mt-4 text-blue-600 font-bold hover:underline flex items-center gap-2 transition-all"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> Resolução Completa</button>`;
        
        const comentarioHtml = `<div id="res-${q.id}" class="hidden mt-4 p-5 bg-gray-50 border-l-4 border-blue-500 text-justify animate-fade-in-up"><p class="font-bold text-blue-800 mb-2">Gabarito: ${q.gabarito_letra}</p><p>${q.comentario}</p></div>`;

        div.innerHTML = `
            ${statusBadge}
            ${btnAlarme}
            <div class="text-xs text-gray-400 mb-4 tracking-widest uppercase">${q.temas_dinamicos.join(' • ')}</div>
            <p class="text-lg text-justify leading-relaxed font-medium">${q.enunciado}</p>
            ${botoesAlternativas}
            ${btnResolucao}
            ${comentarioHtml}
        `;
        container.appendChild(div);
    });
}

// Resposta Padrão
function responder(id, escolhida, correta) {
    const acertou = (escolhida === correta);
    progressoUsuario[id] = { acertou: acertou, usadaResolucao: false };
    localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
    // Recarrega o visual da questão imediatamente
    aplicarFiltros(); 
}

// Resolução com Penalidade
function verResolucao(id, gabarito) {
    document.getElementById(`res-${id}`).classList.remove('hidden');
    
    // Se nunca respondeu, pune marcando como errada ao colar a resposta
    if (!progressoUsuario[id]) {
        progressoUsuario[id] = { acertou: false, usadaResolucao: true };
        localStorage.setItem(`progresso_${currentUser}`, JSON.stringify(progressoUsuario));
        
        // Desabilita botões
        const botoes = document.getElementById(`alts-${id}`).children;
        for (let b of botoes) {
            b.disabled = true;
            b.classList.add('opacity-70', 'cursor-not-allowed');
            b.classList.remove('hover:scale-[1.01]', 'hover:bg-blue-50');
        }
    }
}

// --- PAGINAÇÃO (Regra dos ... e Última Página) ---
function renderizarPaginacao() {
    const container = document.getElementById('paginacao-container');
    container.innerHTML = '';
    const itemsPorPagina = parseInt(document.getElementById('select-qnt').value);
    const totalPaginas = Math.ceil(totalResultados / itemsPorPagina);
    
    if (totalPaginas <= 1) return;

    if (paginaAtual > 1) container.innerHTML += `<button onclick="mudarPagina(${paginaAtual - 1})" class="page-link">Anterior</button>`;

    let exibirUltima = false;

    for (let i = 1; i <= totalPaginas; i++) {
        if (i <= 3 || i === paginaAtual || i === paginaAtual - 1 || i === paginaAtual + 1) {
            const active = (i === paginaAtual) ? 'active' : '';
            container.innerHTML += `<button onclick="mudarPagina(${i})" class="page-link ${active}">${i}</button>`;
        } else if (i === 4 && paginaAtual < 3) {
            container.innerHTML += `<span class="px-2">...</span>`;
            exibirUltima = true;
            break;
        } else if (i > paginaAtual + 1 && i < totalPaginas) {
            if (!exibirUltima) {
                container.innerHTML += `<span class="px-2">...</span>`;
                exibirUltima = true;
            }
        }
    }
    
    if (exibirUltima || paginaAtual < totalPaginas - 1) {
        container.innerHTML += `<button onclick="mudarPagina(${totalPaginas})" class="page-link">${totalPaginas}</button>`;
    }

    if (paginaAtual < totalPaginas) container.innerHTML += `<button onclick="mudarPagina(${paginaAtual + 1})" class="page-link">Próxima</button>`;
}

// --- GERAÇÃO DE PDF (Opcional jsPDF) ---
async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Busca 100 questoes do filtro via backend sem paginar
    const res = await fetch('/api/questoes', { method: 'POST', body: JSON.stringify({...getEstadoFiltros(), limite: 100}) });
    const dados = await res.json();
    
    let y = 20;
    let gabaritoArr = [];
    
    doc.setFontSize(16);
    doc.text("RESPdi - Simulado Personalizado", 10, y);
    y += 10;
    doc.setFontSize(10);

    dados.questoes.forEach((q, idx) => {
        gabaritoArr.push([idx + 1, q.gabarito_letra]);
        
        let textoQuestao = `Questão ${idx + 1}: ${q.enunciado}\n`;
        q.alternativas.forEach(alt => textoQuestao += `${alt}\n`);
        
        const lines = doc.splitTextToSize(textoQuestao, 180);
        if (y + (lines.length * 5) > 280) { doc.addPage(); y = 20; }
        
        doc.text(lines, 10, y);
        y += (lines.length * 5) + 10;
    });

    // Adiciona Tabela de Gabarito no Final
    doc.addPage();
    doc.text("Gabarito do Simulado", 10, 20);
    doc.autoTable({ startY: 30, head: [['Questão', 'Alternativa Correta']], body: gabaritoArr });
    
    doc.save("Simulado_RESPdi.pdf");
}
