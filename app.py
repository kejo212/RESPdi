from flask import Flask, request, jsonify, render_template, send_from_directory
import json, glob, os, random, requests
from datetime import datetime

app = Flask(__name__)
FIREBASE_URL = "https://respdi-1b63d-default-rtdb.firebaseio.com"

# ==========================================
# 1. FUNÇÕES DO FIREBASE & LOGS
# ==========================================
sys_logs = []
def registrar_log(mensagem):
    hora = datetime.now().strftime("%H:%M:%S")
    linha = f"[{hora}] {mensagem}"
    print(linha, flush=True)
    sys_logs.append(linha)
    if len(sys_logs) > 100: sys_logs.pop(0)

def fb_get(path):
    try: 
        res = requests.get(f"{FIREBASE_URL}/{path}.json")
        dados = res.json()
        if isinstance(dados, dict) and 'error' in dados: return {}
        return dados or {}
    except: return {}

def fb_put(path, data): 
    try: return requests.put(f"{FIREBASE_URL}/{path}.json", json=data).ok
    except: return False
def fb_post(path, data): requests.post(f"{FIREBASE_URL}/{path}.json", json=data)
def fb_patch(path, data): requests.patch(f"{FIREBASE_URL}/{path}.json", json=data)

# ==========================================
# 2. CARREGAMENTO DO BANCO DE QUESTÕES
# ==========================================
banco_questoes = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
arquivos_json = [os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR) if f.lower().startswith("questao_") and f.lower().endswith(".json")]
arquivos_json.sort()

for caminho_arquivo in arquivos_json:
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f: banco_questoes.extend(json.load(f))
    except UnicodeDecodeError:
        try:
            with open(caminho_arquivo, 'r', encoding='latin-1') as f: banco_questoes.extend(json.load(f))
        except: pass
    except: pass

# ==========================================
# 3. GESTÃO DE USUÁRIOS
# ==========================================
def carregar_usuarios():
    db = fb_get('usuarios')
    if not db: 
        db = {"davi": {"senha": "1234", "status": "aprovado", "tags": []}}
        fb_put('usuarios', db)
    return db
def salvar_usuarios(db): fb_put('usuarios', db)

# ==========================================
# 4. ROTAS DAS PÁGINAS HTML
# ==========================================
@app.route('/')
def route_login(): return render_template('login.html')
@app.route('/dashboard')
def route_dashboard(): return render_template('dashboard.html')
@app.route('/questoes')
def route_questoes(): return render_template('questoes.html')
@app.route('/cadernos')
def route_cadernos(): return render_template('cadernos.html')
@app.route('/perfil')
def route_perfil(): return render_template('perfil.html')

@app.route('/<path:filename>')
def serve_google_verification(filename):
    if filename.startswith('google') and filename.endswith('.html'): return send_from_directory(BASE_DIR, filename)
    return "Página não encontrada", 404

# ==========================================
# 5. APIs DE AUTENTICAÇÃO E ADMINISTRAÇÃO
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db and db[user]['senha'] == dados.get('password'):
        if db[user]['status'] == 'pendente': return jsonify({"erro": "Cadastro em análise pelo Davi."}), 403
        if db[user]['status'] == 'negado': return jsonify({"erro": "Cadastro negado."}), 403
        if db[user]['status'] == 'bloqueado': return jsonify({"erro": "Conta bloqueada."}), 403
        
        # Registra o último acesso
        db[user]['ultimo_acesso'] = datetime.now().strftime("%d/%m/%Y %H:%M")
        salvar_usuarios(db)
        
        return jsonify({"sucesso": True, "admin": user == 'davi'})
    return jsonify({"erro": "Usuário ou senha incorretos."}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username', '').strip()
    if any(c in user for c in ['.', '$', '#', '[', ']', '/']): return jsonify({"erro": "O nome não pode conter pontos ou símbolos especiais."}), 400
    if user in db: return jsonify({"erro": "Usuário já existe."}), 400
    db[user] = {"senha": dados.get('password'), "status": "pendente", "tags": dados.get('tags', []), "ultimo_acesso": "Nunca"}
    if not fb_put('usuarios', db): return jsonify({"erro": "Erro no Firebase."}), 500
    return jsonify({"sucesso": True})

@app.route('/api/admin/pendentes', methods=['GET'])
def listar_pendentes(): return jsonify({k: v for k, v in carregar_usuarios().items() if v['status'] == 'pendente'})
@app.route('/api/admin/usuarios_ativos', methods=['GET'])
def listar_usuarios_ativos(): return jsonify({k: v for k, v in carregar_usuarios().items() if k != 'davi' and v['status'] != 'pendente'})

@app.route('/api/admin/resolver', methods=['POST'])
def resolver_pendencia():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db:
        db[user]['status'] = dados.get('acao')
        salvar_usuarios(db)
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Não encontrado"}), 404

@app.route('/api/admin/excluir', methods=['POST'])
def excluir_usuario():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db and user != 'davi':
        del db[user]
        salvar_usuarios(db)
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Não autorizado"}), 403

@app.route('/api/admin/logs', methods=['GET'])
def obter_logs(): return jsonify(sys_logs)

# NOVAS ROTAS DO PAINEL ADMIN AVANÇADO
@app.route('/api/admin/estatisticas_usuarios', methods=['GET'])
def estatisticas_usuarios():
    db_users = carregar_usuarios()
    all_userdata = fb_get('userdata') # Puxa todos os progressos de uma vez para não travar
    stats = []
    for u, info in db_users.items():
        if u == 'davi': continue
        q_respondidas = 0
        if all_userdata and u in all_userdata and 'progresso' in all_userdata[u]:
            q_respondidas = len(all_userdata[u]['progresso'])
        stats.append({
            "usuario": u,
            "status": info.get('status', 'pendente'),
            "ultimo_acesso": info.get('ultimo_acesso', 'Nunca'),
            "questoes_respondidas": q_respondidas
        })
    return jsonify(stats)

@app.route('/api/admin/reportes', methods=['GET'])
def admin_reportes():
    reps = fb_get('reportes')
    if isinstance(reps, dict):
        return jsonify([v for k, v in reps.items()])
    return jsonify([])

@app.route('/api/sync/<user>', methods=['GET'])
def get_user_data(user): return jsonify(fb_get(f'userdata/{user}'))
@app.route('/api/sync/<user>', methods=['POST'])
def update_user_data(user):
    payload = request.json
    fb_patch(f'userdata/{user}', {payload.get('tipo'): payload.get('dados')})
    return jsonify({"sucesso": True})

@app.route('/api/reportar', methods=['POST'])
def reportar():
    dados = request.json or {}
    fb_post('reportes', { "id_questao": dados.get('id', '?'), "erro": dados.get('motivo', '?'), "usuario": dados.get('usuario', 'visitante'), "data": datetime.now().strftime("%d/%m/%Y %H:%M") })
    return jsonify({"sucesso": True})

# ==========================================
# 6. MOTOR DE QUESTÕES E FILTROS APRIMORADOS
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    try:
        with open(os.path.join(BASE_DIR, 'filtros.json'), 'r', encoding='utf-8') as f: return jsonify(json.load(f))
    except: return jsonify({"erro_interno": "Filtros não encontrados."})

@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    try:
        f = request.json or {}
        mat_raw = f.get('materia', [])
        ass_raw = f.get('assunto', [])
        sub_raw = f.get('subassunto', [])
        palavra = str(f.get('palavraChave', '')).lower()
        
        status_prog = str(f.get('statusProgresso', 'todas'))
        feitas = set(f.get('feitas_ids', []))
        erradas = set(f.get('erradas_ids', []))
        
        mats = mat_raw if isinstance(mat_raw, list) else ([mat_raw] if mat_raw and mat_raw != 'Todos' else [])
        asss = ass_raw if isinstance(ass_raw, list) else ([ass_raw] if ass_raw and ass_raw != 'Todos' else [])
        subs = sub_raw if isinstance(sub_raw, list) else ([sub_raw] if sub_raw and sub_raw != 'Todos' else [])
        
        filtradas = []
        for q in banco_questoes:
            q_id = str(q.get("id", "X"))
            if status_prog == 'ineditas' and q_id in feitas: continue
            if status_prog == 'feitas' and q_id not in feitas: continue
            if status_prog == 'erradas' and q_id not in erradas: continue
            
            t = q.get('temas_dinamicos', [])
            if not isinstance(t, (list, tuple)): t = []
            t_clean = list(t)
            while len(t_clean) < 3: t_clean.append('Geral')
            m, a, s = str(t_clean[0]).strip(), str(t_clean[1]).strip(), str(t_clean[2]).strip()
            
            if mats and m not in mats: continue
            if asss and a not in asss: continue
            if subs and s not in subs: continue
            if palavra:
                en = str(q.get("enunciado", "")).lower()
                co = str(q.get("comentario", "")).lower()
                if palavra not in en and palavra not in co: continue
            
            alts_brutas = q.get("alternativas", [])
            filtradas.append({
                "id": q_id, "temas_dinamicos": [m, a, s],
                "enunciado": str(q.get("enunciado", "")),
                "alternativas": [str(x) for x in alts_brutas] if isinstance(alts_brutas, list) else [],
                "gabarito_letra": str(q.get("gabarito_letra", "X")).strip().upper(), "comentario": str(q.get("comentario", ""))
            })
            
        pagina = int(f.get('pagina', 1))
        por_pagina = int(f.get('limite', 20))
        inicio = (pagina - 1) * por_pagina
        return jsonify({"total": len(filtradas), "questoes": filtradas[inicio : inicio + por_pagina]})
    except Exception as e: return jsonify({"erro_interno": str(e)})

if __name__ == '__main__': app.run(debug=True, port=5000)
