from flask import Flask, request, jsonify, render_template
import json, glob, os

app = Flask(__name__)

# Memória de questões e usuários
banco_questoes = []
for arquivo in sorted(glob.glob("questao_*.json")):
    with open(arquivo, 'r', encoding='utf-8') as f:
        try: banco_questoes.extend(json.load(f))
        except: pass

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

# Rotas de Interface HTML
@app.route('/')
def route_login(): return render_template('login.html')

@app.route('/dashboard')
def route_dashboard(): return render_template('dashboard.html')

@app.route('/questoes')
def route_questoes(): return render_template('questoes.html')

@app.route('/perfil')
def route_perfil(): return render_template('perfil.html')

# API de Autenticação e Admin
@app.route('/api/login', methods=['POST'])
def login():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    
    if user in db and db[user]['senha'] == dados.get('password'):
        if db[user]['status'] == 'pendente':
            return jsonify({"erro": "Cadastro em análise pelo admin."}), 403
        return jsonify({"sucesso": True, "admin": user == 'davi'})
    return jsonify({"erro": "Credenciais inválidas"}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    
    if user in db: return jsonify({"erro": "Usuário já existe"}), 400
    
    db[user] = {
        "senha": dados.get('password'),
        "status": "pendente",
        "tags": dados.get('tags', [])
    }
    salvar_usuarios(db)
    return jsonify({"sucesso": True, "msg": "Enviado para aprovação do Davi."})

@app.route('/api/admin/pendentes', methods=['GET'])
def listar_pendentes():
    db = carregar_usuarios()
    pendentes = {k: v for k, v in db.items() if v['status'] == 'pendente'}
    return jsonify(pendentes)

@app.route('/api/admin/resolver', methods=['POST'])
def resolver_pendencia():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    if user in db:
        db[user]['status'] = dados.get('acao') # 'aprovado' ou 'negado'
        salvar_usuarios(db)
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Usuário não encontrado"}), 404

# API de Questões com Contagem
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    # Retorna as hierarquias E as contagens embutidas
    categorias = {}
    for q in banco_questoes:
        temas = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        m, a, s = temas[0], (temas[1] if len(temas)>1 else "Geral"), (temas[2] if len(temas)>2 else "Geral")
        
        if m not in categorias: categorias[m] = {"count": 0, "assuntos": {}}
        categorias[m]["count"] += 1
        
        if a not in categorias[m]["assuntos"]: categorias[m]["assuntos"][a] = {"count": 0, "subs": {}}
        categorias[m]["assuntos"][a]["count"] += 1
        
        if s not in categorias[m]["assuntos"][a]["subs"]: categorias[m]["assuntos"][a]["subs"][s] = 0
        categorias[m]["assuntos"][a]["subs"][s] += 1

    return jsonify(categorias)

@app.route('/api/reportar', methods=['POST'])
def reportar():
    # Na prática, salvaria num report.json
    return jsonify({"sucesso": True, "msg": "Problema reportado ao banco central."})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
