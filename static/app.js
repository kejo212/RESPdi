// --- ADMIN DO DAVI ---
async function carregarPendentes() {
    const res = await fetch('/api/admin/pendentes');
    const data = await res.json();
    const container = document.getElementById('lista-pendentes');
    const users = Object.keys(data);
    
    document.getElementById('contador-pendentes').innerText = `${users.length} na fila`;
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500 font-medium">Nenhum usuário aguardando aprovação no momento.</div>';
        return;
    }
    
    users.forEach(user => {
        let tagsHtml = data[user].tags.map(t => `<span class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded font-bold border border-blue-200">${t}</span>`).join(' ');
        container.innerHTML += `
            <div class="p-4 bg-gray-50 border rounded-xl hover:shadow-md transition-shadow">
                <div class="flex justify-between items-center mb-3">
                    <p class="font-bold text-lg text-gray-900">${user}</p>
                    <div class="flex gap-2">
                        <button onclick="resolverPendente('${user}', 'aprovado')" class="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition" title="Aprovar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                        <button onclick="resolverPendente('${user}', 'negado')" class="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition" title="Negar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">${tagsHtml}</div>
            </div>
        `;
    });
}

async function resolverPendente(user, acao) {
    await fetch('/api/admin/resolver', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, acao: acao})
    });
    carregarPendentes(); // Atualiza a lista instantaneamente
}

// O Terminal do Servidor
async function carregarLogsServidor() {
    try {
        const res = await fetch('/api/admin/logs');
        const logs = await res.json();
        const container = document.getElementById('server-logs');
        
        // Formata os erros críticos em vermelho e OK em verde no console
        let htmlLogs = logs.map(linha => {
            if (linha.includes("[ERRO CRÍTICO]")) return `<div class="text-red-400 font-bold">${linha}</div>`;
            if (linha.includes("[OK]")) return `<div class="text-green-300">${linha}</div>`;
            if (linha.includes("ALERTA:")) return `<div class="text-yellow-400">${linha}</div>`;
            return `<div>${linha}</div>`;
        }).join('');
        
        // Verifica se scroll está no final para rolar automático
        const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
        container.innerHTML = htmlLogs || '<div class="text-gray-500">Nenhum log registrado ainda.</div>';
        if (isAtBottom) container.scrollTop = container.scrollHeight;
    } catch (e) {
        document.getElementById('server-logs').innerHTML = '<div class="text-red-500">Falha ao conectar com o servidor.</div>';
    }
}

// --- ESTATÍSTICAS E INICIALIZAÇÃO DA DASHBOARD ---
function carregarEstatisticas() {
    const ids = Object.keys(progressoUsuario);
    let acertos = 0;
    ids.forEach(id => { if (progressoUsuario[id].acertou) acertos++; });
    
    const eTot = document.getElementById('stat-total');
    if(eTot) eTot.innerText = ids.length;
    const eAc = document.getElementById('stat-acertos');
    if(eAc) eAc.innerText = acertos;
    const eEr = document.getElementById('stat-erros');
    if(eEr) eEr.innerText = ids.length - acertos;
    
    const avatar = document.getElementById('sidebar-avatar');
    if(avatar && currentUser) avatar.innerText = currentUser.charAt(0).toUpperCase();

    // Se o usuário for o Davi, inicializa o Painel Admin
    if (currentUser === 'davi') {
        const adminPanel = document.getElementById('admin-panel');
        if(adminPanel) {
            adminPanel.classList.remove('hidden');
            carregarPendentes();
            carregarLogsServidor();
            // Atualiza o terminal a cada 3 segundos como um servidor real
            setInterval(carregarLogsServidor, 3000); 
        }
    }
}
// Dentro do app.js
async function aplicarFiltros(pagina = 1) {
    // ... codigo existente
    const mat = document.getElementById('f-mat').value;
    const aviso = document.getElementById('aviso-aleatorio');
    
    // Esconde o aviso se o usuário escolheu uma matéria
    if (aviso) {
        if (mat !== "Todos") aviso.classList.add('hidden');
        else aviso.classList.remove('hidden');
    }
}// ... continua o fetch

// Quando a página carrega, ele chama carregarEstatisticas()
document.addEventListener("DOMContentLoaded", () => {
    carregarEstatisticas();
});
