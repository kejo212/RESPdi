from flask import Flask, request, jsonify, send_from_directory
import json
import glob
import os

app = Flask(__name__, static_folder='public')

# Carrega as questões na memória do servidor ao iniciar
print("Carregando banco de questões particionado...")
banco_questoes = []
# Lê todos os arquivos menores (ex: questao_1.json, questao_2.json)
arquivos_json = sorted(glob.glob("questao_*.json"))

for arquivo in arquivos_json:
    with open(arquivo, 'r', encoding='utf-8') as f:
        try:
            banco_questoes.extend(json.load(f))
        except:
            pass

print(f"Servidor iniciado com {len(banco_questoes)} questões.")

# Rotas para servir os arquivos do site (HTML, JS)
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

# API de Busca e Filtragem com Paginação
@app.route('/api/questoes', methods=['POST'])
def obter_questoes():
    filtros = request.json
    pagina = filtros.get('pagina', 1)
    por_pagina = 20

    palavra_chave = filtros.get('palavraChave', '').lower()
    mat = filtros.get('materia', 'Todos')
    ass = filtros.get('assunto', 'Todos')
    sub = filtros.get('subassunto', 'Todos')

    # Filtros de Status (enviados pelo frontend com base no progresso)
    progresso = filtros.get('progresso', {})
    chk_ineditas = filtros.get('ineditas', False)
    chk_acertos = filtros.get('acertos', False)
    chk_erradas = filtros.get('erradas', False)

    filtradas = []

    for q in banco_questoes:
        # Filtro de Palavra
        if palavra_chave:
            enunciado = q.get('enunciado', '').lower()
            comentario = q.get('comentario', '').lower()
            if palavra_chave not in enunciado and palavra_chave not in comentario:
                continue

        # Filtro Hierárquico
        temas = q.get('temas_dinamicos', ['Geral', 'Geral', 'Geral'])
        if mat != 'Todos' and temas[0] != mat: continue
        if ass != 'Todos' and (len(temas) < 2 or temas[1] != ass): continue
        if sub != 'Todos' and (len(temas) < 3 or temas[2] != sub): continue

        # Filtro de Status
        status = progresso.get(str(q['id']))
        is_respondida = bool(status)
        is_correta = is_respondida and status.get('acertou')
        is_errada = is_respondida and not status.get('acertou')
        is_inedita = not is_respondida

        if chk_ineditas or chk_acertos or chk_erradas:
            if not ((chk_ineditas and is_inedita) or
                    (chk_acertos and is_correta) or
                    (chk_erradas and is_errada)):
                continue

        filtradas.append(q)

    total_questoes = len(filtradas)
    inicio = (pagina - 1) * por_pagina
    fim = inicio + por_pagina
    questoes_pagina = filtradas[inicio:fim]

    return jsonify({
        "total": total_questoes,
        "pagina_atual": pagina,
        "questoes": questoes_pagina
    })

# Rota para extrair a lista de categorias disponíveis no banco
@app.route('/api/categorias', methods=['GET'])
def obter_categorias():
    categorias = {}
    for q in banco_questoes:
        temas = q.get('temas_dinamicos', [])
        if not temas or len(temas) == 0: continue

        m = temas[0]
        a = temas[1] if len(temas) > 1 else "Geral"
        s = temas[2] if len(temas) > 2 else "Geral"

        if m not in categorias: categorias[m] = {}
        if a not in categorias[m]: categorias[m][a] = set()
        categorias[m][a].add(s)

    # Converter sets para listas
    for m in categorias:
        for a in categorias[m]:
            categorias[m][a] = list(categorias[m][a])

    return jsonify(categorias)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
