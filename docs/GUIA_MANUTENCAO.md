# RESPdi — Guia de manutenção e transferência técnica

> **Objetivo:** permitir que outra pessoa desenvolva, corrija e mantenha o RESPdi com segurança, entendendo as regras do projeto, a estrutura do código, as principais mudanças já feitas e os pontos que ainda exigem atenção.
>
> **Repositório:** https://github.com/kejo212/RESPdi  
> **Branch principal:** `main`  
> **Stack identificada:** Python + Flask, templates HTML/Jinja, JavaScript e CSS; Gunicorn para execução em produção; Firebase Realtime Database acessado por HTTP.  
> **Atualização desta documentação:** 28/10/2026.

---

## 1. Regras obrigatórias de desenvolvimento

Estas regras refletem as preferências definidas para o projeto e devem ser seguidas por qualquer pessoa que trabalhe nele.

1. **Edite o código-fonte no repositório GitHub**, na branch `main`, e não diretamente no Lovable.
2. **Use Lovable somente para visualizar/pré-visualizar**, quando esse ambiente estiver disponível. Ele não é a fonte oficial do código.
3. **Preserve as funcionalidades existentes.** Não remova, desative ou deixe de funcionar uma função antiga para implementar outra ou fazer uma mudança visual.
4. Antes de editar, leia a implementação atual e identifique dependências, chamadas de API, seletores CSS, eventos e templates relacionados.
5. Prefira alterações pequenas e localizadas. Não substitua arquivos inteiros sem necessidade.
6. Evite duplicar funções JavaScript, rotas Flask, regras CSS ou carregamentos de arquivos. Uma regressão anterior no login foi associada a declarações duplicadas em `static/app.js`.
7. Depois de editar, revise o diff, faça testes funcionais e confirme o resultado do commit e da implantação. Não declare que algo foi testado visualmente ou publicado se isso não foi verificado.
8. Mantenha a interface consistente entre desktop e celular. Uma correção de CSS deve ser verificada nos dois tamanhos quando afetar componentes compartilhados.
9. Não coloque senhas, tokens, chaves privadas ou segredos em código público, templates, JavaScript ou documentação.
10. Registre mudanças relevantes em commits com mensagens claras e mantenha esta documentação atualizada.

### Fluxo de trabalho recomendado

1. Confirmar que a branch de trabalho é `main` e consultar os últimos commits.
2. Examinar os arquivos relevantes antes de mudar qualquer coisa.
3. Fazer a menor alteração capaz de resolver o problema.
4. Verificar sintaxe e dependências; testar localmente, se possível.
5. Testar os fluxos afetados e também os fluxos próximos que possam ter sido impactados.
6. Conferir o diff e os arquivos alterados.
7. Fazer commit em `main`.
8. Conferir o estado do GitHub Actions/Azure ou da hospedagem atual.
9. Validar o site publicado, se o ambiente estiver acessível.
10. Documentar limitações e resultados reais dos testes.

---

## 2. Visão geral da arquitetura

### Backend

- **`app.py`** é o principal arquivo da aplicação Flask. Nele ficam rotas de páginas, endpoints de API, integração com o Firebase, lógica de autenticação e funções auxiliares.
- **`requirements.txt`** registra as dependências Python conhecidas:
  - `Flask==3.0.3`
  - `gunicorn==21.2.0`
  - `requests==2.32.3`
- A aplicação usa **Gunicorn** no contexto de hospedagem de produção. Confirme o comando de inicialização na configuração atual do serviço e nos workflows antes de alterar a implantação.

### Frontend

- **`templates/`** contém páginas HTML/Jinja. Os nomes observados incluem `questoes.html`, `cadernos.html`, `listas.html`, `dashboard.html`, `materiais.html`, `module.html`, `perfil.html` e `sidebar.html`.
- **`static/app.js`** contém boa parte da lógica de interface e das interações do usuário, incluindo login/cadastro no frontend, sincronização de dados, progresso, cadernos, listas, simulados, favoritos, histórico, anotações e agenda.
- **`static/theme.css`** contém regras de estilo e o sistema visual compartilhado.
- **`static/mobile-nav.css`** participa dos estilos de navegação responsiva. Como alguns seletores e regras são compartilhados entre arquivos, verificar a cascata antes de duplicar regras.
- Outros arquivos em `static/` e `templates/` podem conter estilos ou lógica específicos de cada tela. Consulte a árvore atual do repositório em vez de presumir que esta lista é completa.

### Dados e conteúdo

- **Firebase Realtime Database:** `app.py` define a URL do banco e possui funções auxiliares para leitura/escrita via HTTP (`fb_get` e `fb_put`, entre outras). Confirme as regras de segurança do Firebase e a estrutura atual dos dados antes de modificar a integração.
- **`filtros.json`** contém dados de filtros.
- Arquivos como **`questao_1.json`, `questao_10.json`** e outros arquivos de questões são grandes fontes de conteúdo. Não os regrave nem os reformate em massa sem motivo: podem conter muitos megabytes e uma alteração desnecessária aumenta o risco de perda de conteúdo e de diffs enormes.
- A raiz também contém um arquivo HTML de verificação do Google. Preserve-o, a menos que haja uma razão confirmada para alterá-lo.

> **Importante:** esta documentação não substitui a inspeção do código atual. Os nomes de arquivos e detalhes da arquitetura devem ser conferidos na branch `main) antes de uma alteração, pois o projeto pode evoluir.

---

## 3. Como os dados do usuário são tratados

O frontend mantém um identificador de usuário em `localStorage` (`currentUser`) e usa chamadas para o backend para autenticação e sincronização. Em `static/app.js`, existe também um cache temporário em `sessionStorage` para campos de dados do usuário, com validade de 10 minutos.

Os campos que o código frontend prepara para sincronização incluem:

- progresso;
- cadernos;
- histórico;
- listas;
- simulados;
- favoritos;
- tentativas;
- anotações;
- agenda;
- estado de conclusão do leitor.

O backend possui o endpoint de sincronização no padrão `/api/sync/<usuário>`. Confirme a implementação e as regras de autorização antes de alterar o formato ou os nomes dos campos.

### Cuidados críticos

- Não altere o nome dos campos, o formato dos objetos ou as chaves do banco sem planejar compatibilidade com os dados já existentes.
- Não assuma que `localStorage` autentica uma pessoa de forma segura: é apenas armazenamento no navegador. A autorização deve ser validada no servidor.
- Verifique se um usuário consegue ler ou gravar dados de outro usuário ao testar APIs.
- Faça backup antes de migrações, mudanças de esquema ou troca de hospedagem.
- Verifique as regras de acesso do Firebase e evite que o banco fique publicamente gravável.
- A sincronização e o cache devem falhar de forma segura: uma falha de rede não pode apagar dados já salvos nem exibir um sucesso falso.
- Não coloque credenciais reais em arquivos do frontend. Qualquer valor enviado ao navegador deve ser considerado público.

---

## 4. Funcionalidades e áreas conhecidas

O projeto inclui ou já teve trabalho de implementação nas seguintes áreas. **A lista não garante que cada função esteja plenamente operacional na versão publicada**: confira o código e teste o ambiente atual.

- Login, cadastro e fluxo de aprovação/código de cadastro.
- Dashboard/mesa de estudos.
- Banco de questões e filtros.
- Cadernos.
- Perfil.
- Favoritos e histórico de questões.
- Listas e simulados.
- Progresso, tentativas, anotações e agenda.
- Reporte de problemas em questões e recursos administrativos.
- Materiais e integração/área de Google Drive.
- Páginas-base para módulos ainda sem conteúdo ou dados suficientes.

Algumas áreas podem ter estrutura visual pronta, mas não possuir lógica completa ou dados reais. Antes de apresentar uma área como concluída, diferencie claramente **interface pronta**, **função conectada** e **função testada em produção**.

### Seções que o usuário pediu para retirar

Em decisões anteriores, o usuário pediu a remoção de referências/áreas antigas de **Monitorias, RESPdi Cast, Sala Vip, Leitor** e, posteriormente, do **catálogo de produtos**. Antes de restaurar alguma dessas áreas, confirme se a decisão continua válida e verifique se ainda há links, rotas, dados ou referências residuais. Não reintroduza essas seções automaticamente.

---

## 5. Mudanças e correções recentes documentadas

Esta seção registra as principais mudanças realizadas ou relatadas no histórico de desenvolvimento até 17/10/2026. O estado final deve ser confirmado na branch atual e no site publicado.

### 5.1 Navegação lateral no desktop

Objetivos definidos pelo usuário:

- sidebar recolhida exibe somente ícones;
- ao passar o mouse, expande sobre o conteúdo em vez de empurrar a página;
- os ícones permanecem fixos, enquanto os textos aparecem;
- animação suave, sem tremulação nem deslocamento vertical;
- o conteúdo da página utiliza a área disponível;
- a barra superior não deve ficar por cima da sidebar recolhida.

Commits relacionados:

- `f874badfa7c680e46d28ab6e889e6e5ac84c7ed0` — “Mantém os ícones fixos e anima somente os textos da lateral”.
- `2536951d92bf640cfccbc37668fbacd860badb4e` — “Fixa os ícones durante a expansão da barra lateral”.
- `4e5f94aae0cc968cc87301c11bfab64e085c91da` — primeira correção de sobreposição da barra superior.
- `c50214d90240283ef8126ec1b554f8dc48817143` — correção subsequente da barra superior e sidebar.
- `953a5ecd11bfe997b02ea668c620e52b7196ae99` — atualização do parâmetro de cache da navegação.

Arquivos envolvidos nas correções recentes incluem `static/theme.css`, `static/mobile-nav.css` e `templates/sidebar.html`.

**Atenção:** a sobreposição da barra superior persistiu após a primeira tentativa, motivando novas regras. A última atualização registrada ajusta a barra superior para iniciar em 76 px no desktop, mas o resultado visual final ainda precisa ser confirmado no navegador. Não assuma que a questão está definitivamente resolvida sem testar.

### 5.2 Barra de busca de questões

Foram feitas correções de estilo para o campo de busca, especialmente no mobile e no desktop, envolvendo a largura, o alinhamento, o fundo do campo e a transparência do input. O CSS mobile foi ajustado e o parâmetro de versão de `theme.css` foi atualizado em `templates/questoes.html`.

O usuário relatou anteriormente defeitos visuais na barra de busca tanto no celular quanto no desktop. Portanto, testar:
- desktop com sidebar recolhida e expandida;
- celular em largura real;
- foco, digitação, limpar busca e envio;
- visual dos resultados depois da busca;
- ausência de rolagem automática indesejada ao atualizar os resultados.

### 5.3 Feedback ao salvar cadernos, listas e simulados

Foi alterado o feedback de criação de caderno para usar a notificação visual do próprio site (`mostrarToast`) em vez de um `alert()`. Também foram removidos diálogos nativos de confirmação que apareciam após salvar listas ou simulados, mantendo a atualização/renderização da interface conforme o fluxo existente.

Arquivo de lógica envolvido: `static/app.js`. Arquivos de templates tiveram seus parâmetros de cache atualizados.

Ao alterar esses fluxos, testar criação, persistência após recarregar, navegação entre páginas e tratamento de erros. Não substituir todos os alertas do sistema indiscriminadamente: a mudança foi localizada, e outros diálogos podem cumprir funções distintas.

### 5.4 Desempenho e transferência de dados

O backend recebeu otimizações documentadas no commit:

- `984fa308a7a862dfa28e35a301b0e0314205b1be` — “Reduz transferência de dados com gzip, cache e resoluções sob demanda”.

A implementação em `app.py` inclui compressão gzip para respostas textuais elegíveis e cabeçalhos de cache para determinados recursos. Arquivos estáticos com parâmetro de versão podem receber cache de longa duração; algumas APIs de filtros/resoluções recebem cache de uma hora com revalidação posterior.

**Regra para mudanças futuras:** ao modificar arquivos estáticos, atualizar o parâmetro de versão na referência do template quando necessário. Caso contrário, o navegador pode continuar usando uma versão antiga. Ao mudar dados de API, verificar se o cabeçalho de cache continua apropriado e não deixa dados pessoais desatualizados ou compartilhados entre usuários.

### 5.5 Publicação e regressões anteriores

Houve falhas de publicação no Azure relatadas em outubro de 2026. Entre os commits citados no histórico estão `dedfb54`, `2536951` e `0b267af`. Em determinados casos, o build passou, mas a etapa de deploy falhou; em outro incidente, foi relatado problema de login após alterações em JavaScript. O histórico também registra uma correção posterior relacionada a declarações duplicadas em `static/app.js` e cache versionado.

Um commit posterior `dac8914` foi relatado como tendo build e deploy bem-sucedidos após uma falha anterior de OneDeploy HTTP 409. Esses relatos históricos não confirmam o estado atual da hospedagem.

**Lição:** build aprovado não significa que a aplicação esteja funcionando. Depois de cada deploy, testar login, dashboard, questões e gravação de dados. Consultar o log real do workflow/deploy para distinguir falha de build, conflito de publicação e erro em tempo de execução.

---

## 6. Cache de arquivos estáticos

O projeto usa parâmetros de versão em URLs de CSS/JavaScript, por exemplo `theme.css?v=...` e `mobile-nav.css?v=...`. O backend identifica alguns desses recursos e permite cache longo.

Ao alterar um arquivo estático:

1. Identifique todos os templates que carregam esse arquivo.
2. Incremente o parâmetro de versão de forma consistente nos locais relevantes.
3. Não altere apenas uma das referências se outras páginas carregarem a mesma folha.
4. Teste com cache limpo e também em uma sessão normal.
5. Evite criar versões diferentes sem necessidade entre páginas que deveriam compartilhar o mesmo CSS/JS.

Se um usuário continuar vendo um defeito após o deploy, verificar primeiro se o novo arquivo foi publicado e se o navegador está carregando o parâmetro de versão correto. Uma atualização forçada do navegador pode ajudar no diagnóstico, mas não substitui corrigir as referências de cache.

---

## 7. Layout responsivo e regras visuais

O design compartilhado em `static/theme.css` define variáveis como cores, tipografia, bordas e sombras. Antes de adicionar uma cor ou regra isolada, verificar se existe variável ou componente reutilizável.

Diretrizes de interface definidas pelo usuário:

- visual consistente entre páginas;
- desktop e mobile devem ser tratados como experiências próprias, sem deixar elementos exclusivos de uma versão aparecerem indevidamente na outra;
- sidebar de desktop expandida deve sobrepor o conteúdo, não empurrá-lo;
- ícones da sidebar não devem mudar de posição quando os rótulos aparecem;
- navegação mobile inferior foi desenhada para ter três opções principais: **Mesa de Estudos**, **Questões** e **Outros**;
- em notificações, a preferência é um cartão pequeno semelhante a uma notificação de sistema, no canto inferior esquerdo;
- evitar excesso de cartões explicativos, emojis e controles visuais redundantes;
- na tela de questões, ações como reporte, favorito e histórico devem ficar agrupadas e não competir com o enunciado.

Essas são diretrizes de projeto, não uma garantia de que todos os itens estejam implementados exatamente assim em todas as páginas.

### Cuidados com CSS

- Confira especificidade, ordem de carregamento e media queries antes de inserir `!important`.
- Procure regras duplicadas em `theme.css`, `mobile-nav.css` e estilos embutidos nos templates.
- Teste a sidebar com mouse e teclado, além de telas touch.
- Verifique se elementos fixos não cobrem conteúdo, campos de formulário ou botões.
- Prefira classes semânticas e reutilizáveis a seletores muito genéricos.
- Evite corrigir um defeito de desktop com regra que quebre o mobile, e vice-versa.

---

## 8. Segurança: itens que merecem revisão

A leitura do código atual identificou pontos que merecem uma revisão de segurança antes de ampliar o uso público:

1. **Autenticação e armazenamento no navegador:** o frontend usa `localStorage` para manter `currentUser`. Isso não deve ser considerado, por si só, uma sessão autenticada segura. Avaliar sessões seguras no servidor, cookies `HttpOnly`, `Secure`, `SameSite` e proteção contra CSRF conforme a arquitetura adotada.
2. **Autorização por usuário:** verificar cada endpoint de leitura/escrita para impedir acesso aos dados de outro usuário apenas alterando o identificador enviado na URL.
3. **Código de cadastro:** o backend contém uma constante de código de cadastro padrão. Rever se é apropriado manter um segredo ou código de acesso fixo no código-fonte, principalmente em repositório público. Não documentar nem divulgar seu valor.
4. **Firebase:** confirmar regras de autenticação e acesso do Realtime Database. Uma URL de banco não é segredo; regras permissivas podem permitir leitura/escrita indevidas.
5. **Senhas:** verificar como são armazenadas e comparadas no backend. Senhas não devem ser armazenadas em texto puro; usar hash apropriado e salt, por exemplo com uma biblioteca consolidada.
6. **HTTPS e dados pessoais:** garantir HTTPS e limitar dados pessoais em logs, respostas de API e mensagens de erro.
7. **Validação:** validar tipos, tamanho e conteúdo de entradas recebidas em endpoints; não confiar em validação feita apenas no navegador.
8. **Dependências:** revisar versões e atualizações de segurança sem atualizar tudo de uma vez sem testes.

Esses pontos são **itens de auditoria recomendados**, não afirmações de que todas essas vulnerabilidades já foram comprovadas. Uma pessoa responsável deve verificar a implementação completa antes de concluir a análise.

---

## 9. Integração com Google Drive

O objetivo solicitado para a integração é permitir a navegação de uma pasta pública dentro do RESPdi, sem obrigar o usuário a sair para o aplicativo do Drive, com foco em:

- listar conteúdo de uma pasta compartilhada por link;
- visualizar PDFs dentro do site;
- visualizar imagens e permitir ampliá-las;
- reproduzir vídeos quando as permissões e o formato permitirem;
- manter o acesso somente para leitura, sem editar arquivos do Drive.

Uma listagem automática de arquivos de uma pasta do Google Drive pode exigir configuração da API do Google e uma chave no servidor. Se essa integração for implementada:

- guardar a chave como variável de ambiente/configuração segura da hospedagem;
- nunca colocar a chave em `static/`, em HTML ou JavaScript do navegador;
- não publicar a chave em commits nem nesta documentação;
- verificar permissões da pasta, limites de API e comportamento para arquivos indisponíveis;
- manter mensagens claras quando um arquivo não puder ser incorporado;
- testar PDF, imagem e vídeo em desktop e mobile.

**Estado:** a intenção e os requisitos estão registrados; não considerar a integração completa sem conferir a implementação atual e testá-la.

---

## 10. Hospedagem, implantação e migração

A hospedagem usada no histórico é o Azure Web App, com workflow citado como “Build and deploy Python app to Azure Web App - respdi”. O usuário deseja que a hospedagem possa ser substituída no futuro, inclusive por uma opção gratuita, mas o repositório continua sendo a fonte oficial do código.

Antes de trocar o Azure por outra plataforma:

1. Identificar o comando de inicialização, variáveis de ambiente, versão de Python e dependências.
2. Mapear todo o armazenamento persistente: Firebase, arquivos locais, uploads, conteúdo estático e configurações.
3. Fazer backup e testar a restauração.
4. Não presumir que o sistema de arquivos da nova hospedagem seja persistente.
5. Não mover apenas o código sem verificar dados, autenticação, APIs e integrações.
6. Configurar variáveis de ambiente no painel da nova hospedagem, nunca em arquivos públicos.
7. Testar um ambiente de homologação antes de apontar o endereço usado pelos usuários.
8. Manter o serviço antigo disponível até a nova versão ser validada, quando possível.
9. Monitorar logs, limites gratuitos, suspensão por inatividade, tráfego e custos de banco/armazenamento.
10. Ter plano de retorno à versão anterior.

As alternativas Render, Google Cloud Run, Oracle Cloud e PythonAnywhere foram discutidas como candidatas, mas nenhuma migração foi registrada como concluída nesta documentação. Planos gratuitos, limites e preços mudam; verificar a documentação oficial da plataforma antes de decidir.

---

## 11. Checklist mínimo antes de publicar

### Funcionalidade
- [ ] Login válido e inválido.
- [ ] Cadastro e aprovação conforme as regras atuais.
- [ ] Logout e comportamento ao abrir uma rota sem autenticação.
- [ ] Dashboard e navegação entre páginas.
- [ ] Busca de questões, filtros e resultados.
- [ ] Responder questão e conferir persistência do resultado.
- [ ] Favoritar/desfavoritar e conferir depois de recarregar.
- [ ] Histórico e cadernos.
- [ ] Criar/editar listas e simulados, conforme implementado.
- [ ] Anotações, agenda e progresso.
- [ ] Notificações de sucesso e erro.
- [ ] Reporte de erro e painel administrativo, se aplicável.
- [ ] Nenhum dado de uma conta aparece em outra.

### Visual e acessibilidade
- [ ] Desktop: sidebar recolhida e expandida.
- [ ] Barra superior sem sobreposição indevida.
- [ ] Campo de busca alinhado, legível e funcional.
- [ ] Mobile: navegação inferior, cabeçalho e área de conteúdo.
- [ ] Sem rolagem automática inesperada.
- [ ] Botões e campos acessíveis por teclado.
- [ ] Sem erros visíveis no console do navegador.

### Dados e implantação
- [ ] Dados continuam disponíveis após novo login/recarregamento.
- [ ] Logs sem segredos ou dados pessoais desnecessários.
- [ ] Build/deploy concluído.
- [ ] Smoke test feito na URL publicada.
- [ ] Commit e resultado da implantação anotados.
- [ ] Backup disponível antes de mudanças que afetem dados.

---

## 12. Diagnóstico rápido de problemas

| Sintoma | O que conferir primeiro |
|---|---|
| Mudança de CSS não aparece | Parâmetro `?v=`, cache do navegador, URL do arquivo e se o deploy publicou o commit esperado. |
| Login parou de funcionar | Console do navegador, resposta de `/api/login`, erros em `static/app.js`, duplicação de funções e logs do backend. |
| Dados somem após recarregar | Resposta de `/api/sync/<usuário>`, chamadas de gravação, permissões do Firebase, erros de rede e chaves dos campos. |
| Um usuário vê dados de outro | Revisar autorização no backend, identificadores fornecidos pelo cliente e regras do Firebase imediatamente. |
| Deploy falha, mas build passa | Examinar a etapa específica do deploy e logs do provedor; não presumir que seja erro de código. |
| Barra superior cobre sidebar | Verificar regras finais de `.resp-topbar`, largura real da sidebar, ordem dos CSS e breakpoints. |
| Layout mobile desalinhado | Conferir media queries, CSS carregado por último, largura do viewport e estilos embutidos. |
| Resposta da API parece antiga | Rever cabeçalhos de cache e se a rota pode servir dados personalizados. |

---

## 13. Registro de commits recentes de referência

Links diretos para commits relevantes no histórico:

- [Redução de transferência com gzip, cache e resoluções sob demanda](https://github.com/kejo212/RESPdi/commit/984fa308a7a862dfa28e35a301b0e0314205b1be)
- [Ícones fixos durante a expansão da sidebar](https://github.com/kejo212/RESPdi/commit/f874badfa7c680e46d28ab6e889e6e5ac84c7ed0)
- [Correção da sobreposição entre barra superior e sidebar — tentativa inicial](https://github.com/kejo212/RESPdi/commit/4e5f94aae0cc968cc87301c11bfab64e085c91da)
- [Correção subsequente da barra superior](https://github.com/kejo212/RESPdi/commit/c50214d90240283ef8126ec1b554f8dc48817143)
- [Atualização do cache da navegação](https://github.com/kejo212/RESPdi/commit/953a5ecd11bfe997b02ea668c620e52b7196ae99)

Consulte o histórico completo da branch `main` para mudanças posteriores ou commits intermediários.

---

## 14. Como manter esta documentação

Atualize este arquivo quando:

- uma rota, integração ou funcionalidade for criada/removida;
- houver mudança no modelo de dados;
- mudar a hospedagem, banco, autenticação ou configuração;
- uma regressão importante for corrigida;
- houver uma decisão de produto que limite ou proíba determinada abordagem;
- um fluxo de teste passar a ser obrigatório.

Para cada mudança importante, registrar: **data, motivo, arquivos afetados, comportamento esperado, testes realizados, commit e estado do deploy**. Não guardar segredos ou dados pessoais neste documento.

---

## 15. Fontes oficiais úteis

- Repositório e histórico: https://github.com/kejo212/RESPdi
- Documentação Flask: https://flask.palletsprojects.com/
- Documentação Gunicorn: https://docs.gunicorn.org/
- Documentação Firebase Realtime Database: https://firebase.google.com/docs/database
- Documentação Azure App Service: https://learn.microsoft.com/azure/app-service/
- Documentação Google Drive API: https://developers.google.com/drive/api/guides/about-sdk

**Nota final:** esta é uma transferência técnica baseada no código e no histórico disponível até 28/10/2026. Antes de executar alterações críticas, o novo responsável deve conferir a versão atual de `main`, as configurações reais de produção, as regras do Firebase e os logs da hospedagem.