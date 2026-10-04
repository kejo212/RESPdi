from flask import Flask, request, jsonify, render_template
import json, glob, os
from datetime import datetime

app = Flask(__name__)

# ==========================================
# 1. SISTEMA DE LOGS INTERNO (Terminal do Davi)
# ==========================================
sys_logs = []

def registrar_log(mensagem):
    hora = datetime.now().strftime("%H:%M:%S")
    linha = f"[{hora}] {mensagem}"
    print(linha, flush=True)  # Mantém no Render
    sys_logs.append(linha)
    if len(sys_logs) > 100: sys_logs.pop(0)  # Guarda só as últimas 100 linhas

# ==========================================
# 2. CARREGAMENTO DO BANCO DE QUESTÕES (BULLETPROOF)
# ==========================================
banco_questoes = []
log_erros_leitura = [] # Guarda os erros pro Raio-X
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Força a busca exata usando caminho absoluto
arquivos_json = [os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR) if f.lower().startswith("questao_") and f.lower().endswith(".json")]
arquivos_json.sort()

registrar_log("="*40)
registrar_log(f"INICIANDO SISTEMA: {len(arquivos_json)} arquivos JSON de questões encontrados na pasta {BASE_DIR}.")

for caminho_arquivo in arquivos_json:
    nome = os.path.basename(caminho_arquivo)
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
            
            # Limpeza preventiva
            for q in dados:
                if 'temas_dinamicos' not in q or not q['temas_dinamicos']: q['temas_dinamicos'] = ['Geral', 'Geral', 'Geral']
                if 'enunciado' not in q or q['enunciado'] is None: q['enunciado'] = 'Questão sem enunciado.'
                if 'alternativas' not in q or not q['alternativas']: q['alternativas'] = []
                
            banco_questoes.extend(dados)
            registrar_log(f"[OK] {nome} lido com sucesso (UTF-8).")
            
    except UnicodeDecodeError:
        try:
            with open(caminho_arquivo, 'r', encoding='latin-1') as f:
                banco_questoes.extend(json.load(f))
                registrar_log(f"[OK] {nome} lido com sucesso (Windows/Latin-1).")
        except Exception as e2:
            erro = f"[ERRO CRÍTICO] Formato inválido em {nome}: {str(e2)}"
            registrar_log(erro)
            log_erros_leitura.append(erro)
            
    except Exception as e:
        erro = f"[ERRO CRÍTICO] Falha ao abrir {nome}: {str(e)}"
        registrar_log(erro)
        log_erros_leitura.append(erro)

registrar_log(f"SISTEMA PRONTO: {len(banco_questoes)} questões na memória.")
registrar_log("="*40)

# ==========================================
# 3. ROTA SECRETA DO RAIO-X (DEBUG)
# ==========================================
@app.route('/api/debug')
def debug():
    return jsonify({
        "1_pasta_raiz_lida": BASE_DIR,
        "2_arquivos_questoes_encontrados": [os.path.basename(f) for f in arquivos_json],
        "3_total_questoes_carregadas_com_sucesso": len(banco_questoes),
        "4_erros_de_leitura_registrados": log_erros_leitura,
        "5_todos_os_arquivos_presentes_na_pasta": os.listdir(BASE_DIR)
    })

# ==========================================
# 4. GESTÃO DE USUÁRIOS
# ==========================================
ARQUIVO_USUARIOS = os.path.join(BASE_DIR, 'usuarios.json')

def carregar_usuarios():
    if not os.path.exists(ARQUIVO_USUARIOS):
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump({"davi": {"senha": "1234", "status": "aprovado", "tags": []}}, f)
    with open(ARQUIVO_USUARIOS, 'r') as f:
        return json.load(f)

def salvar_usuarios(db):
    with open(ARQUIVO_USUARIOS, 'w') as f:
        json.dump(db, f, indent=4)

# ==========================================
# 5. ROTAS HTML E APIs
# ==========================================
@app.route('/')
def route_login(): return render_template('login.html')
@app.route('/dashboard')
def route_dashboard(): return render_template('dashboard.html')
@app.route('/questoes')
def route_questoes(): return render_template('questoes.html')
@app.route('/perfil')
def route_perfil(): return render_template('perfil.html')

@app.route('/api/login', methods=['POST'])
def login():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db and db[user]['senha'] == dados.get('password'):
        if db[user]['status'] == 'pendente': return jsonify({"erro": "Seu cadastro ainda está em análise pelo Davi."}), 403
        if db[user]['status'] == 'negado': return jsonify({"erro": "Seu cadastro foi negado pelo administrador."}), 403
        registrar_log(f"Login efetuado: {user}")
        return jsonify({"sucesso": True, "admin": user == 'davi'})
    return jsonify({"erro": "Usuário ou senha incorretos."}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db: return jsonify({"erro": "Este nome de usuário já existe."}), 400
    db[user] = {"senha": dados.get('password'), "status": "pendente", "tags": dados.get('tags', [])}
    salvar_usuarios(db)
    registrar_log(f"Novo cadastro pendente: {user}")
    return jsonify({"sucesso": True})

@app.route('/api/admin/pendentes', methods=['GET'])
def listar_pendentes():
    return jsonify({k: v for k, v in carregar_usuarios().items() if v['status'] == 'pendente'})

@app.route('/api/admin/resolver', methods=['POST'])
def resolver_pendencia():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db:
        db[user]['status'] = dados.get('acao')
        salvar_usuarios(db)
        registrar_log(f"Usuário {user} foi {dados.get('acao')} por Davi.")
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Usuário não encontrado"}), 404

@app.route('/api/admin/logs', methods=['GET'])
def obter_logs():
    return jsonify(sys_logs)

@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    categorias = {}
    for q in banco_questoes:
        t = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        m, a, s = t[0], (t[1] if len(t)>1 else "Geral"), (t[2] if len(t)>2 else "Geral")
        if m not in categorias: categorias[m] = {"count": 0, "assuntos": {}}
        categorias[m]["count"] += 1
        if a not in categorias[m]["assuntos"]: categorias[m]["assuntos"][a] = {"count": 0, "subs": {}}
        categorias[m]["assuntos"][a]["count"] += 1
        if s not in categorias[m]["assuntos"][a]["subs"]: categorias[m]["assuntos"][a]["subs"][s] = 0
        categorias[m]["assuntos"][a]["subs"][s] += 1
    return jsonify(categorias)

@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    f = request.json
    pagina, por_pagina = f.get('pagina', 1), f.get('limite', 20)
    mat, ass, sub = f.get('materia', 'Todos'), f.get('assunto', 'Todos'), f.get('subassunto', 'Todos')
    filtradas = []
    for q in banco_questoes:
        t = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        if mat != 'Todos' and t[0] != mat: continue
        if ass != 'Todos' and (len(t) < 2 or t[1] != ass): continue
        if sub != 'Todos' and (len(t) < 3 or t[2] != sub): continue
        filtradas.append(q)
    return jsonify({"total": len(filtradas), "questoes": filtradas[(pagina-1)*por_pagina : pagina*por_pagina]})

@app.route('/api/reportar', methods=['POST'])
def reportar():
    dados = request.json
    registrar_log(f"ALERTA: Questão {dados.get('id')} reportada ({dados.get('motivo')})")
    return jsonify({"sucesso": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
