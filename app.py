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
    print(linha, flush=True)
    sys_logs.append(linha)
    if len(sys_logs) > 100: sys_logs.pop(0)

# ==========================================
# 2. CARREGAMENTO DO BANCO DE QUESTÕES
# ==========================================
banco_questoes = []
log_erros_leitura = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

arquivos_json = [os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR) if f.lower().startswith("questao_") and f.lower().endswith(".json")]
arquivos_json.sort()

registrar_log("="*40)
registrar_log(f"INICIANDO SISTEMA: {len(arquivos_json)} arquivos JSON de questões.")

for caminho_arquivo in arquivos_json:
    nome = os.path.basename(caminho_arquivo)
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
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
# 3. ROTA SECRETA DO RAIO-X
# ==========================================
@app.route('/api/debug')
def debug():
    return jsonify({
        "1_pasta_raiz_lida": BASE_DIR,
        "2_arquivos_questoes_encontrados": [os.path.basename(f) for f in arquivos_json],
        "3_total_questoes_carregadas": len(banco_questoes),
        "4_erros_de_leitura": log_erros_leitura
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
# 5. ROTAS HTML (AS PÁGINAS DO SITE QUE EU APAGUEI ANTES)
# ==========================================
@app.route('/')
def route_login(): return render_template('login.html')
@app.route('/dashboard')
def route_dashboard(): return render_template('dashboard.html')
@app.route('/questoes')
def route_questoes(): return render_template('questoes.html')
@app.route('/perfil')
def route_perfil(): return render_template('perfil.html')

# ==========================================
# 6. APIs DE AUTENTICAÇÃO E ADMIN
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db and db[user]['senha'] == dados.get('password'):
        if db[user]['status'] == 'pendente': return jsonify({"erro": "Em análise pelo Davi."}), 403
        if db[user]['status'] == 'negado': return jsonify({"erro": "Cadastro negado."}), 403
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
        registrar_log(f"Usuário {user} foi {dados.get('acao')}.")
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Não encontrado"}), 404

@app.route('/api/admin/logs', methods=['GET'])
def obter_logs():
    return jsonify(sys_logs)

# ==========================================
# 7. APIs DE QUESTÕES E MOTOR (BLINDADO)
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    try:
        categorias = {}
        for q in banco_questoes:
            t = q.get('temas_dinamicos')
            if not isinstance(t, list): t = ['Geral', 'Geral', 'Geral']
            while len(t) < 3: t.append('Geral')
            
            m, a, s = str(t[0]), str(t[1]), str(t[2])
            
            if m not in categorias: categorias[m] = {"count": 0, "assuntos": {}}
            categorias[m]["count"] += 1
            
            if a not in categorias[m]["assuntos"]: categorias[m]["assuntos"][a] = {"count": 0, "subs": {}}
            categorias[m]["assuntos"][a]["count"] += 1
            
            if s not in categorias[m]["assuntos"][a]["subs"]: categorias[m]["assuntos"][a]["subs"][s] = 0
            categorias[m]["assuntos"][a]["subs"][s] += 1
            
        return jsonify(categorias)
    except Exception as e:
        registrar_log(f"[ERRO API CATEGORIAS] {str(e)}")
        return jsonify({"erro": str(e)}), 500

@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    try:
        f = request.json or {}
        pagina = int(f.get('pagina', 1))
        por_pagina = int(f.get('limite', 20))
        
        mat = str(f.get('materia', 'Todos'))
        ass = str(f.get('assunto', 'Todos'))
        sub = str(f.get('subassunto', 'Todos'))
        
        filtradas = []
        
        for q in banco_questoes:
            t = q.get('temas_dinamicos')
            if not isinstance(t, list): t = ['Geral', 'Geral', 'Geral']
            while len(t) < 3: t.append('Geral')
            
            m, a, s = str(t[0]), str(t[1]), str(t[2])
            
            if mat != 'Todos' and m != mat: continue
            if ass != 'Todos' and a != ass: continue
            if sub != 'Todos' and s != sub: continue
            
            q_segura = {
                "id": str(q.get("id", "sem-id")),
                "temas_dinamicos": [m, a, s],
                "enunciado": str(q.get("enunciado", "Questão com enunciado em branco.")),
                "alternativas": q.get("alternativas") if isinstance(q.get("alternativas"), list) else [],
                "gabarito_letra": str(q.get("gabarito_letra", "A")),
                "comentario": str(q.get("comentario", "Sem comentários do professor."))
            }
            filtradas.append(q_segura)

        inicio = (pagina - 1) * por_pagina
        return jsonify({
            "total": len(filtradas),
            "questoes": filtradas[inicio : inicio + por_pagina]
        })
    except Exception as e:
        registrar_log(f"[ERRO API QUESTOES] {str(e)}")
        return jsonify({"erro": str(e)}), 500

@app.route('/api/reportar', methods=['POST'])
def reportar():
    dados = request.json or {}
    registrar_log(f"ALERTA: Questão {dados.get('id', '?')} reportada ({dados.get('motivo', '?')})")
    return jsonify({"sucesso": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
