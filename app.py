from flask import Flask, request, jsonify, render_template
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
    print(linha, flush=True)  # Mantém no log do Render
    sys_logs.append(linha)
    if len(sys_logs) > 100: sys_logs.pop(0)  # Guarda só as últimas 100 linhas

# ==========================================
# 2. CARREGAMENTO DO BANCO DE QUESTÕES (BULLETPROOF)
# ==========================================
banco_questoes = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

arquivos_json = [os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR) if f.lower().startswith("questao_") and f.lower().endswith(".json")]
arquivos_json.sort()

registrar_log("="*40)
registrar_log(f"INICIANDO SISTEMA: {len(arquivos_json)} pacotes de questões encontrados.")

for caminho_arquivo in arquivos_json:
    nome = os.path.basename(caminho_arquivo)
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
            banco_questoes.extend(dados)
            registrar_log(f"[OK] {nome} lido (UTF-8).")
    except UnicodeDecodeError:
        try:
            with open(caminho_arquivo, 'r', encoding='latin-1') as f:
                banco_questoes.extend(json.load(f))
                registrar_log(f"[OK] {nome} lido (Windows/Latin-1).")
        except Exception as e2:
            registrar_log(f"[ERRO CRÍTICO] Formato inválido em {nome}: {str(e2)}")
    except Exception as e:
        registrar_log(f"[ERRO CRÍTICO] Falha ao abrir {nome}: {str(e)}")

registrar_log(f"SISTEMA PRONTO: {len(banco_questoes)} questões extraídas para a memória.")
registrar_log("="*40)


# ==========================================
# 3. GESTÃO DE USUÁRIOS E ADMINISTRAÇÃO
# ==========================================
ARQUIVO_USUARIOS = os.path.join(BASE_DIR, 'usuarios.json')

def carregar_usuarios():
    # Se não existir, cria o Davi (mestre) automaticamente
    if not os.path.exists(ARQUIVO_USUARIOS):
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump({"davi": {"senha": "1234", "status": "aprovado", "tags": []}}, f)
    with open(ARQUIVO_USUARIOS, 'r') as f:
        return json.load(f)

def salvar_usuarios(db):
    with open(ARQUIVO_USUARIOS, 'w') as f:
        json.dump(db, f, indent=4)


# ==========================================
# 4. ROTAS DAS PÁGINAS HTML (FRONTEND)
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
# 5. APIs DE AUTENTICAÇÃO E TRIBUNAL DO DAVI
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
            
        registrar_log(f"Login efetuado: {user}")
        return jsonify({"sucesso": True, "admin": user == 'davi'})
        
    return jsonify({"erro": "Usuário ou senha incorretos."}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.json
    db = carregar_usuarios()
    user = dados.get('username')
    
    if user in db: 
        return jsonify({"erro": "Este nome de usuário já existe."}), 400
        
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
        db[user]['status'] = dados.get('acao') # 'aprovado' ou 'negado'
        salvar_usuarios(db)
        registrar_log(f"Usuário {user} foi {dados.get('acao')} por Davi.")
        return jsonify({"sucesso": True})
    return jsonify({"erro": "Usuário não encontrado"}), 404

@app.route('/api/admin/logs', methods=['GET'])
def obter_logs():
    return jsonify(sys_logs)


# ==========================================
# 6. APIs DO MOTOR DE QUESTÕES E FILTROS
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    # Lê a árvore de categorias pré-calculada pelo seu PC
    try:
        caminho = os.path.join(BASE_DIR, 'filtros.json')
        with open(caminho, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except Exception as e:
        registrar_log(f"[ERRO API CATEGORIAS] Falha ao ler filtros.json: {e}")
        return jsonify({"erro_interno": "O arquivo filtros.json não foi encontrado."})

@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    try:
        f = request.json or {}
        mat = str(f.get('materia', 'Todos'))
        ass = str(f.get('assunto', 'Todos'))
        sub = str(f.get('subassunto', 'Todos'))
        palavra = str(f.get('palavraChave', '')).lower()
        
        # MODO 1: EXPLORAÇÃO ALEATÓRIA INICIAL (Quando não há filtros escolhidos)
        if mat == 'Todos' and not palavra:
            if not banco_questoes: return jsonify({"total": 0, "questoes": []})
            
            qtd = min(100, len(banco_questoes))
            sorteadas_brutas = random.sample(banco_questoes, qtd)
            sorteadas_limpas = []
            
            for q in sorteadas_brutas:
                alts = q.get("alternativas", [])
                sorteadas_limpas.append({
                    "id": str(q.get("id", "X")),
                    "temas_dinamicos": q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral']),
                    "enunciado": str(q.get("enunciado", "Sem enunciado")),
                    "alternativas": [str(a) for a in alts] if isinstance(alts, list) else [],
                    "gabarito_letra": str(q.get("gabarito_letra", "A")).strip().upper(),
                    "comentario": str(q.get("comentario", "Sem comentários."))
                })
            return jsonify({"total": 100, "questoes": sorteadas_limpas})
            
        # MODO 2: FILTRAGEM TRADICIONAL
        pagina = int(f.get('pagina', 1))
        por_pagina = int(f.get('limite', 20))
        filtradas = []
        
        for q in banco_questoes:
            # Proteção contra dados sujos
            t = q.get('temas_dinamicos', [])
            if not isinstance(t, (list, tuple)): t = []
            t_clean = list(t)
            while len(t_clean) < 3: t_clean.append('Geral')
            
            m, a, s = str(t_clean[0]).strip(), str(t_clean[1]).strip(), str(t_clean[2]).strip()
            
            if mat != 'Todos' and m != mat: continue
            if ass != 'Todos' and a != ass: continue
            if sub != 'Todos' and s != sub: continue
            
            if palavra:
                en = str(q.get("enunciado", "")).lower()
                co = str(q.get("comentario", "")).lower()
                if palavra not in en and palavra not in co: continue
            
            alts_brutas = q.get("alternativas", [])
            alts_limpas = [str(x) for x in alts_brutas] if isinstance(alts_brutas, list) else []
            
            filtradas.append({
                "id": str(q.get("id", "X")),
                "temas_dinamicos": [m, a, s],
                "enunciado": str(q.get("enunciado", "Sem enunciado.")),
                "alternativas": alts_limpas,
                "gabarito_letra": str(q.get("gabarito_letra", "X")).strip().upper(),
                "comentario": str(q.get("comentario", "Sem comentários disponíveis."))
            })

        inicio = (pagina - 1) * por_pagina
        return jsonify({
            "total": len(filtradas),
            "questoes": filtradas[inicio : inicio + por_pagina]
        })
    except Exception as e:
        registrar_log(f"[ERRO API QUESTOES] {str(e)}")
        return jsonify({"erro_interno": str(e)})

@app.route('/api/reportar', methods=['POST'])
def reportar():
    dados = request.json or {}
    registrar_log(f"ALERTA: Questão {dados.get('id', '?')} reportada ({dados.get('motivo', '?')})")
    return jsonify({"sucesso": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
