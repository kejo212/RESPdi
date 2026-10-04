from flask import Flask, request, jsonify, render_template
import json, glob, os, sys

app = Flask(__name__)

# ==========================================
# 1. CARREGAMENTO DO BANCO DE QUESTÕES (À Prova de Falhas)
# ==========================================
banco_questoes = []
arquivos_json = sorted(glob.glob("questao_*.json"))

print("="*50, flush=True)
print(f"-> INICIANDO SERVIDOR: {len(arquivos_json)} arquivos JSON encontrados.", flush=True)

for arquivo in arquivos_json:
    try:
        # Tenta ler com a codificação padrão da internet (utf-8)
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
            
            # Limpa falhas dentro do JSON para o site não travar
            for q in dados:
                if 'temas_dinamicos' not in q or not q['temas_dinamicos']:
                    q['temas_dinamicos'] = ['Geral', 'Geral', 'Geral']
                if 'enunciado' not in q or q['enunciado'] is None:
                    q['enunciado'] = 'Questão sem enunciado.'
                if 'alternativas' not in q or not q['alternativas']:
                    q['alternativas'] = []
                    
            banco_questoes.extend(dados)
            print(f"[OK] {arquivo} carregado com sucesso.", flush=True)
            
    except UnicodeDecodeError:
        print(f"[AVISO] Erro de codificação no {arquivo}. Tentando formato Windows...", flush=True)
        try:
            with open(arquivo, 'r', encoding='latin-1') as f:
                dados = json.load(f)
                banco_questoes.extend(dados)
                print(f"[OK] {arquivo} carregado usando formato alternativo.", flush=True)
        except Exception as e2:
            print(f"[ERRO CRÍTICO] O arquivo {arquivo} está corrompido: {e2}", flush=True)
            
    except Exception as e:
        print(f"[ERRO CRÍTICO] Falha geral ao ler {arquivo}: {e}", flush=True)

print(f"-> TOTAL DE QUESTÕES NA MEMÓRIA: {len(banco_questoes)}", flush=True)
print("="*50, flush=True)


# ==========================================
# 2. GESTÃO DE USUÁRIOS
# ==========================================
ARQUIVO_USUARIOS = 'usuarios.json'

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
# 3. ROTAS HTML
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
# 4. APIs DE AUTENTICAÇÃO E ADMIN
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    
    if user in db and db[user]['senha'] == dados.get('password'):
        if db[user]['status'] == 'pendente':
            return jsonify({"erro": "Seu cadastro ainda está em análise pelo Davi."}), 403
        if db[user]['status'] == 'negado':
            return jsonify({"erro": "Seu cadastro foi negado pelo administrador."}), 403
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
    return jsonify({"sucesso": True, "msg": "Enviado para aprovação."})

@app.route('/api/admin/pendentes', methods=['GET'])
def listar_pendentes():
    db = carregar_usuarios()
    return jsonify({k: v for k, v in db.items() if v['status'] == 'pendente'})

@app.route('/api/admin/resolver', methods=['POST'])
def resolver_pendencia():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db:
        db[user]['status'] = dados.get('acao')
        salvar_usuarios(db)
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Usuário não encontrado"}), 404


# ==========================================
# 5. APIs DE QUESTÕES E MOTOR DO SIMULADOR
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    categorias = {}
    for q in banco_questoes:
        temas = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        m = temas[0]
        a = temas[1] if len(temas)>1 else "Geral"
        s = temas[2] if len(temas)>2 else "Geral"
        
        if m not in categorias: categorias[m] = {"count": 0, "assuntos": {}}
        categorias[m]["count"] += 1
        
        if a not in categorias[m]["assuntos"]: categorias[m]["assuntos"][a] = {"count": 0, "subs": {}}
        categorias[m]["assuntos"][a]["count"] += 1
        
        if s not in categorias[m]["assuntos"][a]["subs"]: categorias[m]["assuntos"][a]["subs"][s] = 0
        categorias[m]["assuntos"][a]["subs"][s] += 1
    return jsonify(categorias)


@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    filtros = request.json
    pagina = filtros.get('pagina', 1)
    por_pagina = filtros.get('limite', 20)
    
    mat = filtros.get('materia', 'Todos')
    ass = filtros.get('assunto', 'Todos')
    sub = filtros.get('subassunto', 'Todos')
    
    filtradas = []
    
    for q in banco_questoes:
        temas = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        if mat != 'Todos' and temas[0] != mat: continue
        if ass != 'Todos' and (len(temas) < 2 or temas[1] != ass): continue
        if sub != 'Todos' and (len(temas) < 3 or temas[2] != sub): continue
        filtradas.append(q)

    total_questoes = len(filtradas)
    inicio = (pagina - 1) * por_pagina
    fim = inicio + por_pagina
    
    return jsonify({
        "total": total_questoes,
        "questoes": filtradas[inicio:fim]
    })


@app.route('/api/reportar', methods=['POST'])
def reportar():
    return jsonify({"sucesso": True, "msg": "Problema reportado."})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
