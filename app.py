from flask import Flask, request, jsonify, render_template, send_from_directory, redirect
import json, glob, os, random, requests, hmac, gzip
from datetime import datetime

app = Flask(__name__)

# Reduz o tráfego de HTML, CSS, JavaScript e JSON e aproveita o cache do navegador.
@app.after_request
def otimizar_resposta_http(response):
    if request.method == "GET":
        if request.path.startswith("/static/") and request.args.get("v"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.path in ("/api/categorias", "/api/questao-filtros") or request.path.startswith("/api/questao-resolucao/"):
            response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"

    mime = (response.mimetype or "").lower()
    compressivel = (
        mime.startswith("text/")
        or mime in ("application/json", "application/javascript", "application/xhtml+xml", "application/xml")
        or mime.endswith("+json")
    )
    if (
        compressivel
        and response.status_code == 200
        and not response.headers.get("Content-Encoding")
        and request.accept_encodings["gzip"] > 0
    ):
        response.vary.add("Accept-Encoding")
        try:
            response.direct_passthrough = False
            corpo = response.get_data()
            if len(corpo) >= 1024:
                comprimido = gzip.compress(corpo, compresslevel=6, mtime=0)
                if len(comprimido) < len(corpo):
                    response.set_data(comprimido)
                    response.headers["Content-Encoding"] = "gzip"
                    # O ETag da versão sem compressão não pode ser reaproveitado.
                    response.headers.pop("ETag", None)
        except (OSError, RuntimeError, TypeError):
            pass
    return response


MODULE_PAGES = {
 "estudos":{"key":"estudos","title":"Estudos em andamento","eyebrow":"Sua rotina","description":"Retome atividades e acompanhe o que você já começou.","cards":[{"icon":"↗","title":"Retomar banco de questões","description":"Continue praticando a partir do seu histórico de respostas.","action":"questoes","status":"Disponível"},{"icon":"▤","title":"Meus cadernos","description":"Acesse as coleções que você salvou para revisar.","action":"cadernos","status":"Disponível"},{"icon":"◷","title":"Meu desempenho","description":"Veja questões respondidas, acertos e erros registrados.","action":"desempenho","status":"Disponível"}]},
 "cursos":{"key":"cursos","title":"Todos os cursos","eyebrow":"Conteúdo de estudo","description":"Explore as áreas disponíveis no banco de questões. Cursos completos ainda não foram cadastrados.","cards":[]},
 "desempenho":{"key":"desempenho","title":"Meu desempenho","eyebrow":"Acompanhamento","description":"Acompanhe os registros reais de resolução desta conta.","cards":[]},
 "ranking":{"key":"ranking","title":"Ranking","eyebrow":"Comparação de resultados","description":"A estrutura visual está preparada. Uma classificação coletiva depende de regras e dados comparáveis.","cards":[{"icon":"♜","title":"Posição no ranking","description":"Ainda não há classificação coletiva calculada para exibir.","action":"none","status":"Em preparação"},{"icon":"↗","title":"Seu progresso","description":"Consulte seus resultados enquanto o ranking é preparado.","action":"desempenho","status":"Disponível"}]},
 "favoritos":{"key":"favoritos","title":"Meus favoritos","eyebrow":"Revisão rápida","description":"As questões favoritas ficarão disponíveis aqui para consulta posterior.","cards":[]},
 "ajuda":{"key":"ajuda","title":"Ajuda e suporte","eyebrow":"Estamos aqui","description":"Reporte problemas nas próprias questões ou retorne às áreas funcionais do RESPdi.","cards":[{"icon":"⚑","title":"Reportar problema em questão","description":"Use o botão de reporte junto a uma questão para enviar o problema ao painel administrativo.","action":"questoes","status":"Disponível"},{"icon":"⌂","title":"Voltar ao início","description":"Retorne à mesa de estudos.","action":"dashboard","status":"Disponível"}]}
}

FIREBASE_URL = "https://respdi-1b63d-default-rtdb.firebaseio.com"
CODIGO_CADASTRO_PADRAO = "78467812836"

# ==========================================
# 1. FUNÇÕES DO FIREBASE (AGORA COM ANTI-CACHE)
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
        # ?t=... força o Firebase a não usar cache, trazendo a resposta em tempo real sempre
        timestamp = int(datetime.now().timestamp())
        res = requests.get(f"{FIREBASE_URL}/{path}.json?t={timestamp}")
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

# Índice para carregar a resolução só quando o estudante a solicitar.
questoes_por_id = {}
for _questao in banco_questoes:
    questoes_por_id.setdefault(str(_questao.get("id", "X")), _questao)


def remover_comentarios_de_questoes_salvas(valor):
    """Não envia resoluções grandes junto com todo o histórico salvo do usuário."""
    if isinstance(valor, dict):
        questao_id = str(valor.get("id", "X"))
        eh_questao = "enunciado" in valor and ("alternativas" in valor or "gabarito_letra" in valor)
        # Preserva comentário de questões antigas que não existem mais no banco atual.
        if eh_questao and questao_id in questoes_por_id:
            valor.pop("comentario", None)
        for filho in valor.values():
            remover_comentarios_de_questoes_salvas(filho)
    elif isinstance(valor, list):
        for filho in valor:
            remover_comentarios_de_questoes_salvas(filho)


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


@app.route('/listas')
def route_listas(): return render_template('listas.html')

@app.route('/materiais')
def route_materiais(): return render_template('materiais.html')


# Biblioteca pública do Drive: API exclusivamente de leitura.
GOOGLE_DRIVE_API_KEY = os.environ.get("GOOGLE_DRIVE_API_KEY", "").strip()
GOOGLE_DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "13tBBSrXMsu2NGW0jCSvrzIE9epV-Bw47").strip()
GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files"


@app.route('/api/materiais/drive', methods=['GET'])
def api_materiais_drive():
    if not GOOGLE_DRIVE_API_KEY:
        return jsonify({
            "configurado": False,
            "erro": "A biblioteca precisa ser configurada no servidor com uma chave de API do Google Drive."
        }), 503

    parent_id = request.args.get("parentId", GOOGLE_DRIVE_FOLDER_ID).strip()
    caracteres_id_validos = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
    if not parent_id or len(parent_id) > 200 or not all(c in caracteres_id_validos for c in parent_id):
        return jsonify({"erro": "Identificador de pasta inválido."}), 400

    params = {
        "key": GOOGLE_DRIVE_API_KEY,
        "q": "'" + parent_id + "' in parents and trashed = false",
        "pageSize": 100,
        "orderBy": "folder,name",
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
        "fields": "nextPageToken,files(id,name,mimeType,modifiedTime,size,thumbnailLink,resourceKey)"
    }
    page_token = request.args.get("pageToken", "").strip()
    if page_token:
        if len(page_token) > 4096:
            return jsonify({"erro": "Token de paginação inválido."}), 400
        params["pageToken"] = page_token

    try:
        resposta = requests.get(GOOGLE_DRIVE_API_URL, params=params, timeout=12)
        if resposta.status_code == 403:
            return jsonify({
                "erro": "O Google recusou a listagem. Confirme se a Drive API está ativada e se a chave de API está configurada corretamente."
            }), 502
        if resposta.status_code == 404:
            return jsonify({"erro": "A pasta não foi encontrada ou não está acessível por link público."}), 404
        resposta.raise_for_status()
        dados = resposta.json()
    except requests.Timeout:
        return jsonify({"erro": "O Google Drive demorou para responder. Tente novamente."}), 504
    except requests.RequestException:
        return jsonify({"erro": "Não foi possível consultar o Google Drive agora."}), 502
    except ValueError:
        return jsonify({"erro": "O Google Drive retornou uma resposta inválida."}), 502

    arquivos = []
    for arquivo in dados.get("files", []):
        arquivos.append({
            "id": arquivo.get("id", ""),
            "name": arquivo.get("name", "Arquivo sem nome"),
            "mimeType": arquivo.get("mimeType", "application/octet-stream"),
            "modifiedTime": arquivo.get("modifiedTime"),
            "size": arquivo.get("size"),
            "thumbnailLink": arquivo.get("thumbnailLink"),
            "resourceKey": arquivo.get("resourceKey")
        })

    response = jsonify({
        "configurado": True,
        "folderId": parent_id,
        "files": arquivos,
        "nextPageToken": dados.get("nextPageToken")
    })
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response

@app.route('/catalogo')
def route_catalogo_removido(): return redirect('/dashboard')

def _registrar_rota_modulo(slug):
    def _view(slug=slug):
        return render_template('module.html', module=MODULE_PAGES[slug])
    app.add_url_rule('/' + slug, endpoint='route_modulo_' + slug, view_func=_view)

for _slug_modulo in MODULE_PAGES:
    _registrar_rota_modulo(_slug_modulo)


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
        db[user]['ultimo_acesso'] = datetime.now().strftime("%d/%m/%Y %H:%M")
        salvar_usuarios(db)
        return jsonify({"sucesso": True, "admin": user == 'davi'})
    return jsonify({"erro": "Usuário ou senha incorretos."}), 401

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.get_json(silent=True) or {}
    db = carregar_usuarios()
    user = str(dados.get('username', '')).strip()
    senha = str(dados.get('password', '')).strip()
    if not user or not senha: return jsonify({"erro": "Preencha o usuário e a senha."}), 400
    if any(c in user for c in ['.', '$', '#', '[', ']', '/']): return jsonify({"erro": "O nome não pode conter pontos ou símbolos especiais."}), 400
    if user in db: return jsonify({"erro": "Usuário já existe."}), 400

    codigo_informado = str(dados.get('codigo_cadastro') or '').strip()
    codigo_valido = codigo_informado.isdigit() and hmac.compare_digest(codigo_informado, obter_codigo_cadastro())
    status = "aprovado" if codigo_valido else "pendente"
    db[user] = {"senha": senha, "status": status, "tags": dados.get('tags', []), "ultimo_acesso": "Nunca"}
    if not fb_put('usuarios', db): return jsonify({"erro": "Erro no Firebase."}), 500
    return jsonify({"sucesso": True, "aprovado_automaticamente": bool(codigo_valido), "status": status})

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

# ROTAS DA CONFIGURAÇÃO GLOBAL DO DAVI
def obter_codigo_cadastro():
    cfg = fb_get('config')
    if not isinstance(cfg, dict): cfg = {}
    codigo = str(cfg.get('codigo_cadastro') or CODIGO_CADASTRO_PADRAO)
    return codigo if codigo.isdigit() else CODIGO_CADASTRO_PADRAO

@app.route('/api/admin/codigo-cadastro', methods=['POST'])
def gerenciar_codigo_cadastro():
    dados = request.get_json(silent=True) or {}
    if dados.get('username') != 'davi':
        return jsonify({"erro": "Não autorizado"}), 403

    admin = carregar_usuarios().get('davi', {})
    senha_informada = str(dados.get('senha_admin') or '')
    senha_correta = str(admin.get('senha') or '')
    if admin.get('status') != 'aprovado' or not senha_correta or not hmac.compare_digest(senha_informada, senha_correta):
        return jsonify({"erro": "Confirme a senha do administrador para continuar."}), 403

    acao = dados.get('acao', 'salvar')
    cfg = fb_get('config')
    if not isinstance(cfg, dict): cfg = {}
    if acao == 'consultar':
        return jsonify({"codigo": obter_codigo_cadastro()})
    if acao != 'salvar':
        return jsonify({"erro": "Ação inválida."}), 400

    codigo = str(dados.get('codigo') or '').strip()
    if not codigo.isdigit() or len(codigo) > 20:
        return jsonify({"erro": "Informe um código composto somente por números (até 20 dígitos)."}), 400

    cfg['codigo_cadastro'] = codigo
    if not fb_put('config', cfg): return jsonify({"erro": "Não foi possível salvar o código."}), 500
    registrar_log("ADMIN: Código de cadastro atualizado.")
    return jsonify({"sucesso": True})

@app.route('/api/admin/config', methods=['POST'])
def update_config():
    dados = request.get_json(silent=True) or {}
    if dados.get('username') != 'davi': return jsonify({"erro": "Não autorizado"}), 403
    novo_status = bool(dados.get('ocultar_incompletas', False))
    cfg = fb_get('config')
    if not isinstance(cfg, dict): cfg = {}
    cfg['ocultar_incompletas'] = novo_status
    if not fb_put('config', cfg): return jsonify({"erro": "Erro ao salvar a configuração."}), 500
    registrar_log(f"ADMIN: Ocultar Incompletas alterado para = {novo_status}")
    return jsonify({"sucesso": True})

@app.route('/api/config', methods=['GET'])
def get_config():
    cfg = fb_get('config')
    if not isinstance(cfg, dict): cfg = {}
    return jsonify({"ocultar_incompletas": bool(cfg.get("ocultar_incompletas", False))})

@app.route('/api/admin/estatisticas_usuarios', methods=['GET'])
def estatisticas_usuarios():
    db_users = carregar_usuarios()
    all_userdata = fb_get('userdata') 
    stats = []
    for u, info in db_users.items():
        if u == 'davi': continue
        q_respondidas = 0
        if all_userdata and u in all_userdata and 'progresso' in all_userdata[u]: q_respondidas = len(all_userdata[u]['progresso'])
        stats.append({ "usuario": u, "status": info.get('status', 'pendente'), "ultimo_acesso": info.get('ultimo_acesso', 'Nunca'), "questoes_respondidas": q_respondidas })
    return jsonify(stats)

@app.route('/api/admin/reportes', methods=['GET'])
def admin_reportes():
    reps = fb_get('reportes')
    if isinstance(reps, dict): return jsonify([v for k, v in reps.items()])
    return jsonify([])

@app.route('/api/sync/<user>', methods=['GET'])
def get_user_data(user):
    dados = fb_get(f'userdata/{user}')
    remover_comentarios_de_questoes_salvas(dados)
    return jsonify(dados)
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
# 6. MOTOR DE QUESTÕES E FILTROS BLINDADOS
# ==========================================
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    try:
        with open(os.path.join(BASE_DIR, 'filtros.json'), 'r', encoding='utf-8') as f: return jsonify(json.load(f))
    except: return jsonify({"erro_interno": "Filtros não encontrados."})


METADATA_ALIASES = {
 "instituicao":["instituicao","instituição","nome_instituicao","instituicao_prova","banca","orgao","órgão"],
 "ano":["ano","ano_prova","year","ano_concurso"],
 "regiao":["regiao","região","uf","estado","localidade"],
 "finalidade":["finalidade","tipo_prova","categoria_prova","objetivo","tipo_concurso"],
 "professor":["professor","docente","responsavel_resolucao","responsável_resolução"],
 "video":["tem_video","tem_video_resolucao","solucao_video","solução_video","video_resolucao","url_video","video"],
 "tipo":["tipo_questao","tipo","formato_questao"],
 "vigencia":["vigencia","vigência","status_vigencia","status_questao"]
}
def _valor_metadado(questao,campo):
    for chave in METADATA_ALIASES.get(campo,[campo]):
        if chave in questao and questao.get(chave) not in (None,""):
            valor=questao.get(chave)
            if isinstance(valor,(list,tuple,set)): valor=", ".join(str(x) for x in valor if x not in (None,""))
            if isinstance(valor,bool): valor="sim" if valor else "nao"
            if isinstance(valor,dict): valor=valor.get("nome",valor.get("label",valor.get("valor","")))
            return str(valor).strip()
    return ""
def _normalizar_valores(valor):
    if valor is None or valor=="": return []
    if isinstance(valor,list): return [str(x).strip().casefold() for x in valor if str(x).strip()]
    return [str(valor).strip().casefold()]
def _metadados_saida(questao):
    saida={}
    for campo in ["instituicao","ano","regiao","finalidade","professor"]:
        valor=_valor_metadado(questao,campo)
        if valor: saida[campo]=valor
    return saida

@app.route('/api/questao-filtros', methods=['GET'])
def obter_opcoes_filtros_questoes():
    opcoes={campo:set() for campo in ["instituicao","ano","regiao","finalidade","professor"]}
    contagens={campo:{} for campo in ["instituicao","ano","regiao","finalidade","professor"]}
    tem_video=False
    tem_vigencia=False
    for questao in banco_questoes:
        for campo in opcoes:
            valor=_valor_metadado(questao,campo)
            if valor:
                opcoes[campo].add(valor)
                contagens[campo][valor]=contagens[campo].get(valor,0)+1
        tem_video=tem_video or bool(_valor_metadado(questao,"video"))
        tem_vigencia=tem_vigencia or bool(_valor_metadado(questao,"vigencia"))
    return jsonify({
        "opcoes":{campo:sorted(list(valores),key=lambda x:x.casefold())[:500] for campo,valores in opcoes.items()},
        "contagens":contagens,
        "disponibilidade":{"video":tem_video,"vigencia":tem_vigencia,**{campo:bool(valores) for campo,valores in opcoes.items()}}
    })

@app.route('/api/questao-resolucao/<questao_id>', methods=['GET'])
def obter_resolucao_questao(questao_id):
    questao = questoes_por_id.get(str(questao_id))
    if not questao:
        return jsonify({"erro": "Questão não encontrada."}), 404
    return jsonify({
        "id": str(questao.get("id", "X")),
        "gabarito_letra": str(questao.get("gabarito_letra", "X")).strip().upper(),
        "comentario": str(questao.get("comentario", ""))
    })


@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    try:
        f = request.json or {}
        mat_raw = f.get('materia', [])
        ass_raw = f.get('assunto', [])
        sub_raw = f.get('subassunto', [])
        palavra = str(f.get('palavraChave', '')).lower()
        metadados_filtro = f.get('metadados', {}) or {}
        filtros_avancados = f.get('filtrosAvancados', {}) or {}
        
        status_prog = str(f.get('statusProgresso', 'todas'))
        feitas = set(f.get('feitas_ids', []))
        erradas = set(f.get('erradas_ids', []))
        
        mats = mat_raw if isinstance(mat_raw, list) else ([mat_raw] if mat_raw and mat_raw != 'Todos' else [])
        asss = ass_raw if isinstance(ass_raw, list) else ([ass_raw] if ass_raw and ass_raw != 'Todos' else [])
        subs = sub_raw if isinstance(sub_raw, list) else ([sub_raw] if sub_raw and sub_raw != 'Todos' else [])
        
        # Puxa o status REAL-TIME do Firebase (sem cache)
        config_nuvem = fb_get('config')
        ocultar_incompletas = False
        if isinstance(config_nuvem, dict):
            ocultar_incompletas = config_nuvem.get("ocultar_incompletas", False)

        filtradas = []
        
        for q in banco_questoes:
            # --- PENTE FINO EXTREMO DE QUALIDADE (SE LIGADO PELO ADMIN) ---
            if ocultar_incompletas:
                gab = str(q.get("gabarito_letra", "")).strip().upper()
                com = str(q.get("comentario", "")).strip().lower()
                
                # Regra 1: O gabarito tem que ser EXATAMENTE uma dessas letras. Se for X, vazio, anulada, ele corta.
                if gab not in ['A', 'B', 'C', 'D', 'E']:
                    continue
                    
                # Regra 2: Resoluções falsas (textos automáticos curtos) ou menor que 15 letras são cortadas.
                palavras_proibidas = ['sem coment', 'não comentada', 'sem resolu', 'não possui coment', 'anulada']
                if len(com) < 15 or any(p in com for p in palavras_proibidas):
                    continue
            
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
            alternativas = [str(x) for x in alts_brutas] if isinstance(alts_brutas, list) else []
            gabarito = str(q.get("gabarito_letra", "X")).strip().upper()
            comentario = str(q.get("comentario", ""))
            mismatch = False
            for campo in ["instituicao","ano","regiao","finalidade","professor"]:
                escolhidos = _normalizar_valores(metadados_filtro.get(campo))
                if escolhidos and _valor_metadado(q,campo).casefold() not in escolhidos:
                    mismatch = True
                    break
            if mismatch: continue
            tipos = _normalizar_valores(filtros_avancados.get("tipos"))
            tipo_real = _valor_metadado(q,"tipo").casefold()
            if not tipo_real: tipo_real = "multipla_escolha" if len(alternativas)>=3 else ("certo_errado" if len(alternativas)==2 else "discursiva")
            tipo_alias = {"múltipla escolha":"multipla_escolha","multipla escolha":"multipla_escolha","certo/errado":"certo_errado","certo e errado":"certo_errado"}
            tipo_real = tipo_alias.get(tipo_real,tipo_real.replace(" ","_"))
            if tipos and tipo_real not in tipos: continue
            solucao_texto = str(filtros_avancados.get("solucaoTexto", "")).casefold()
            tem_texto = bool(comentario.strip())
            if solucao_texto=="com" and not tem_texto: continue
            if solucao_texto=="sem" and tem_texto: continue
            video_valor = _valor_metadado(q,"video").casefold()
            tem_video_questao = video_valor in ["sim","true","1","yes","com","video","vídeo"] or (video_valor.startswith("http") and "video" in video_valor)
            filtro_video = str(filtros_avancados.get("video", "")).casefold()
            if filtro_video=="com" and not tem_video_questao: continue
            if filtro_video=="sem" and tem_video_questao: continue
            vigencia_filtro = str(filtros_avancados.get("vigencia", "")).casefold()
            if vigencia_filtro=="anuladas" and gabarito in ["A","B","C","D","E"]: continue
            if vigencia_filtro=="validas" and gabarito not in ["A","B","C","D","E"]: continue
            if vigencia_filtro=="desatualizadas" and _valor_metadado(q,"vigencia").casefold() not in ["desatualizada","desatualizadas","inativa","obsoleta","obsoleto"]: continue
            filtradas.append({
                "id": q_id, "temas_dinamicos": [m, a, s],
                "enunciado": str(q.get("enunciado", "")),
                "alternativas": alternativas,
                "gabarito_letra": gabarito,
                "metadados": _metadados_saida(q), "tem_video": tem_video_questao,
                "tipo_questao": tipo_real, "anulada": gabarito not in ["A","B","C","D","E"]
            })
            
        pagina = int(f.get('pagina', 1))
        por_pagina = int(f.get('limite', 20))
        inicio = (pagina - 1) * por_pagina
        return jsonify({"total": len(filtradas), "questoes": filtradas[inicio : inicio + por_pagina]})
    except Exception as e: return jsonify({"erro_interno": str(e)})

if __name__ == '__main__': app.run(debug=True, port=5000)
