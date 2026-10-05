from flask import Flask, request, jsonify, render_template, send_from_directory
import json, glob, os, random
from datetime import datetime

app = Flask(__name__)

# ==========================================
# 1. SISTEMA DE LOGS INTERNO (Terminal do Davi)
# ==========================================
sys_logs = []
def registrar_log(mensagem):
    hora = datetime.now().strftime("%H:%M:%S")
    linha = f"[{hora}] {mensagem}"
    print(linha, flush=True)
    sys_logs.append(linha)
    if len(sys_logs) > 100: sys_logs.pop(0)

# ==========================================
# 2. CARREGAMENTO DO BANCO DE QUESTÕES
# ==========================================
banco_questoes = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

arquivos_json = [os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR) if f.lower().startswith("questao_") and f.lower().endswith(".json")]
arquivos_json.sort()

registrar_log("="*40)
registrar_log(f"INICIANDO SISTEMA: {len(arquivos_json)} pacotes encontrados.")

for caminho_arquivo in arquivos_json:
    nome = os.path.basename(caminho_arquivo)
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            banco_questoes.extend(json.load(f))
    except UnicodeDecodeError:
        try:
            with open(caminho_arquivo, 'r', encoding='latin-1') as f:
                banco_questoes.extend(json.load(f))
        except: pass
    except: pass

registrar_log(f"SISTEMA PRONTO: {len(banco_questoes)} questões na memória.")

# ==========================================
# 3. GESTÃO DE USUÁRIOS E REPORTES
# ==========================================
ARQUIVO_USUARIOS = os.path.join(BASE_DIR, 'usuarios.json')
ARQUIVO_REPORTES = os.path.join(BASE_DIR, 'reportes.json')

def carregar_usuarios():
    if not os.path.exists(ARQUIVO_USUARIOS):
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump({"davi": {"senha": "1234", "status": "aprovado", "tags": []}}, f)
    with open(ARQUIVO_USUARIOS, 'r') as f: return json.load(f)

def salvar_usuarios(db):
    with open(ARQUIVO_USUARIOS, 'w') as f: json.dump(db, f, indent=4)

# ==========================================
# 4. ROTAS DAS PÁGINAS HTML E GOOGLE SEARCH CONSOLE
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
    if filename.startswith('google') and filename.endswith('.html'):
        return send_from_directory(BASE_DIR, filename)
    return "Página não encontrada", 404

# ==========================================
# 5. APIs DE AUTENTICAÇÃO E TRIBUNAL DO DAVI
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
        registrar_log(f"Login efetuado: {user}")
        return jsonify({"sucesso": True, "admin": user == 'davi'})
    return jsonify({"erro": "Usuário ou senha incorretos."}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db: return jsonify({"erro": "Usuário já existe."}), 400
    db[user] = {"senha": dados.get('password'), "status": "pendente", "tags": dados.get('tags', [])}
    salvar_usuarios(db)
    registrar_log(f"Novo cadastro pendente: {user}")
    return jsonify({"sucesso": True})

@app.route('/api/admin/pendentes', methods=['GET'])
def listar_pendentes(): return jsonify({k: v for k, v in carregar_usuarios().items() if v['status'] == 'pendente'})

@app.route('/api/admin/usuarios_ativos', methods=['GET'])
def listar_usuarios_ativos():
    db = carregar_usuarios()
    return jsonify({k: v for k, v in db.items() if k != 'davi' and v['status'] != 'pendente'})

@app.route('/api/admin/resolver', methods=['POST'])
def resolver_pendencia():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db:
        db[user]['status'] = dados.get('acao')
        salvar_usuarios(db)
        registrar_log(f"Status de '{user}' alterado para '{dados.get('acao')}'.")
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Não encontrado"}), 404

# NOVA ROTA: Exclusão Definitiva de Usuário
@app.route('/api/admin/excluir', methods=['POST'])
def excluir_usuario():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db and user != 'davi':
        del db[user]
        salvar_usuarios(db)
        registrar_log(f"Usuário '{user}' EXCLUÍDO definitivamente.")
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Não autorizado"}), 403

@app.route('/api/admin/logs', methods=['GET'])
def obter_logs(): return jsonify(sys_logs)

# ==========================================
# 6. APIs DO MOTOR DE QUESTÕES E FILTROS MÚLTIPLOS
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    try:
        with open(os.path.join(BASE_DIR, 'filtros.json'), 'r', encoding='utf-8') as f: return jsonify(json.load(f))
    except Exception as e: return jsonify({"erro_interno": "Filtros não encontrados."})

@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    try:
        f = request.json or {}
        
        # Agora o backend aceita Listas de filtros para seleção múltipla
        mat_raw = f.get('materia', [])
        ass_raw = f.get('assunto', [])
        sub_raw = f.get('subassunto', [])
        palavra = str(f.get('palavraChave', '')).lower()
        
        mats = mat_raw if isinstance(mat_raw, list) else ([mat_raw] if mat_raw and mat_raw != 'Todos' else [])
        asss = ass_raw if isinstance(ass_raw, list) else ([ass_raw] if ass_raw and ass_raw != 'Todos' else [])
        subs = sub_raw if isinstance(sub_raw, list) else ([sub_raw] if sub_raw and sub_raw != 'Todos' else [])
        
        if not mats and not asss and not subs and not palavra:
            if not banco_questoes: return jsonify({"total": 0, "questoes": []})
            qtd = min(100, len(banco_questoes))
            sorteadas = []
            for q in random.sample(banco_questoes, qtd):
                alts = q.get("alternativas", [])
                sorteadas.append({
                    "id": str(q.get("id", "X")), "temas_dinamicos": q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral']),
                    "enunciado": str(q.get("enunciado", "")), "alternativas": [str(a) for a in alts] if isinstance(alts, list) else [],
                    "gabarito_letra": str(q.get("gabarito_letra", "A")).strip().upper(), "comentario": str(q.get("comentario", ""))
                })
            return jsonify({"total": 100, "questoes": sorteadas})
            
        pagina = int(f.get('pagina', 1))
        por_pagina = int(f.get('limite', 20))
        filtradas = []
        
        for q in banco_questoes:
            t = q.get('temas_dinamicos', [])
            if not isinstance(t, (list, tuple)): t = []
            t_clean = list(t)
            while len(t_clean) < 3: t_clean.append('Geral')
            m, a, s = str(t_clean[0]).strip(), str(t_clean[1]).strip(), str(t_clean[2]).strip()
            
            # Lógica de Filtragem Múltipla (Se a lista tem filtros, verifica se a questão pertence a algum deles)
            if mats and m not in mats: continue
            if asss and a not in asss: continue
            if subs and s not in subs: continue
            
            if palavra:
                en = str(q.get("enunciado", "")).lower()
                co = str(q.get("comentario", "")).lower()
                if palavra not in en and palavra not in co: continue
            
            alts_brutas = q.get("alternativas", [])
            filtradas.append({
                "id": str(q.get("id", "X")), "temas_dinamicos": [m, a, s],
                "enunciado": str(q.get("enunciado", "")),
                "alternativas": [str(x) for x in alts_brutas] if isinstance(alts_brutas, list) else [],
                "gabarito_letra": str(q.get("gabarito_letra", "X")).strip().upper(),
                "comentario": str(q.get("comentario", ""))
            })
        inicio = (pagina - 1) * por_pagina
        return jsonify({"total": len(filtradas), "questoes": filtradas[inicio : inicio + por_pagina]})
    except Exception as e: return jsonify({"erro_interno": str(e)})

@app.route('/api/reportar', methods=['POST'])
def reportar():
    dados = request.json or {}
    novo_reporte = { "id_questao": dados.get('id', '?'), "erro": dados.get('motivo', '?'), "usuario": dados.get('usuario', 'visitante'), "data": datetime.now().strftime("%d/%m/%Y %H:%M") }
    reportes = []
    if os.path.exists(ARQUIVO_REPORTES):
        try:
            with open(ARQUIVO_REPORTES, 'r', encoding='utf-8') as f: reportes = json.load(f)
        except: pass
    reportes.append(novo_reporte)
    with open(ARQUIVO_REPORTES, 'w', encoding='utf-8') as f: json.dump(reportes, f, indent=4)
    registrar_log(f"ALERTA: Usuário {novo_reporte['usuario']} reportou erro.")
    return jsonify({"sucesso": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
