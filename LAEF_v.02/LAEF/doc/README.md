# LAEF — Laboratório de Atividades e Estudos em Física

**Universidade Federal de Pernambuco (UFPE) — Centro Acadêmico do Agreste (CAA)**

Documentação técnica consolidada · Versão 1.0 · 26/11/2026

## 1. Sobre o projeto

O sistema LAEF reúne um site público de divulgação institucional e acadêmica e um painel administrativo para gerenciamento de conteúdos. Seu objetivo é facilitar a divulgação de atividades de ensino, pesquisa e extensão, integrantes, materiais didáticos e produção científica do laboratório.

O frontend utiliza HTML, CSS e JavaScript nativo, com módulos ES. O Supabase fornece autenticação, banco PostgreSQL e armazenamento de arquivos. A hospedagem estática pelo Netlify é a opção proposta; a publicação efetiva ainda não foi confirmada.

## 2. Documentação técnica

| Documento | Conteúdo |
|---|---|
| [01 — Estrutura e arquitetura](docs/01-estrutura-do-projeto-LAEF.pdf) | Inventário de arquivos e organização dos módulos |
| [02 — Banco de dados](docs/02-banco-de-dados-LAEF.pdf) | Dicionário de dados, relacionamentos, índices, funções e triggers |
| [03 — Storage e segurança](docs/03-storage-e-seguranca-LAEF.pdf) | Buckets, RLS, privilégios e URLs assinadas |
| [04 — Funcionalidades](docs/04-funcionalidades-LAEF.pdf) | Recursos públicos e administrativos |
| [05 — Configuração e publicação](docs/05-configuracao-e-publicacao-LAEF.pdf) | Configuração, execução e hospedagem |
| [06 — Pendências e manutenção](docs/06-pendencias-e-manutencao-LAEF.pdf) | Backlog, critérios de aceite e manutenção |

Os links pressupõem que os seis PDFs sejam colocados em `docs/`, na raiz do projeto. Mantenha a documentação interna fora da cópia publicada quando não for destinada ao público.

## 3. Tecnologias

- HTML5, CSS e JavaScript com módulos ES.
- Supabase Auth, PostgreSQL, Row Level Security (RLS) e Storage.
- Hospedagem estática HTTPS (Netlify como opção sugerida).
- Não é necessário instalar Node.js nem compilar o projeto para o fluxo manual proposto.

## 4. Estrutura de arquivos

Inventário original: 42 arquivos (16 HTML, 9 CSS e 17 JS), distribuídos em nove diretórios internos. `docs/` e `README.md` são acréscimos documentais propostos.

```text
LAEF/
├── index.html
├── sobre.html
├── ensino.html
├── equipe.html
├── extensao.html
├── materiais.html
├── pesquisa.html
├── publicacoes.html
├── adm/
│   ├── dashboard.html
│   ├── login.html
│   ├── ensino.html
│   ├── equipe.html
│   ├── extensao.html
│   ├── materiais.html
│   ├── pesquisa.html
│   ├── publicacoes.html
│   ├── css/
│   │   ├── admin.css
│   │   ├── extensao.css
│   │   ├── materiais.css
│   │   └── publicacoes.css
│   ├── js/
│   │   ├── config.js
│   │   ├── dashboard.js
│   │   ├── login.js
│   │   ├── ensino.js
│   │   ├── equipe.js
│   │   ├── extensao.js
│   │   ├── materiais.js
│   │   ├── pesquisa.js
│   │   └── publicacoes.js
│   └── supabase/
├── assets/img/icons/
├── css/
│   ├── atuacao.css
│   ├── conteudo.css
│   ├── responsive.css
│   ├── sobre.css
│   └── style.css
├── js/
│   ├── ensino.js
│   ├── equipe.js
│   ├── extensao.js
│   ├── main.js
│   ├── materiais.js
│   ├── pesquisa.js
│   ├── publicacoes.js
│   └── storage.js
├── docs/                  # adicionar os seis PDFs
└── README.md              # este documento
```

## 5. Funcionalidades

| Módulo | Área pública | Área administrativa |
|---|---|---|
| Ensino | Conteúdos, categorias, busca e documentos | Cadastro, edição, exclusão, filtros e arquivos |
| Equipe | Integrantes agrupados por categoria, fotos e contatos | Gerenciamento de integrantes e ordenação |
| Extensão | Projetos, responsáveis, imagens e documentos | Gerenciamento de projetos |
| Materiais | Busca, filtros, imagens, PDF e links externos | Gerenciamento de recursos didáticos |
| Pesquisa | Projetos, áreas, responsáveis e materiais | Gerenciamento de pesquisas e arquivos |
| Publicações | Produção científica, busca, categoria, ano, DOI e PDF | Gerenciamento de publicações e validação do ano |

Os seis módulos utilizam estados `rascunho` e `publicado`. A área pública consulta registros publicados. Os módulos administrativos foram revisados para operações CRUD e gerenciamento de arquivos. A existência de código implementado não comprova funcionamento integral no navegador. A página inicial, a página institucional, o login e o dashboard constam do inventário; seus códigos gerais não foram integralmente reavaliados nesta etapa. Não foi confirmado um módulo administrativo dedicado a destaques.

## 6. Banco de dados

| Tabela | Colunas | Finalidade |
|---|---:|---|
| destaques | 10 | Destaques institucionais |
| ensino | 9 | Conteúdos de ensino |
| equipe | 13 | Integrantes |
| extensao | 10 | Projetos de extensão |
| materiais | 14 | Recursos didáticos |
| perfis | 7 | Perfis de usuários |
| permissoes_acesso | 5 | Permissões específicas por módulo |
| pesquisa | 11 | Projetos de pesquisa |
| publicacoes | 13 | Produção científica |

Total: 9 tabelas, 92 colunas, 23 restrições (9 PK, 2 FK, 2 UNIQUE e 10 CHECK), 20 índices B-tree, 6 funções e 9 triggers habilitados.

Relacionamentos confirmados:

```text
auth.users.id (1) ── (0..1) perfis.id
perfis.id     (1) ── (0..N) permissoes_acesso.usuario_id
```

As duas chaves estrangeiras utilizam `ON DELETE CASCADE`. As demais tabelas não possuem chaves estrangeiras identificadas. O e-mail de perfil e o par usuário/módulo são únicos. Oito triggers atualizam `updated_at`; um valida o ano de publicação (1900 até o ano corrente, permitindo NULL).

| Função | Responsabilidade |
|---|---|
| `is_admin()` | Identificar administrador ativo |
| `pode_gerenciar_modulo(text)` | Autorização específica, mantida para eventual expansão |
| `pode_gerenciar_equipe()` | Função legada de autorização |
| `arquivo_esta_publicado(text,text)` | Verificar vínculo com conteúdo publicado |
| `atualizar_updated_at()` | Atualizar data de modificação |
| `validar_ano_publicacao()` | Validar ano |

O Documento 02 contém o dicionário detalhado. Não constitui um backup SQL executável.

## 7. Segurança e armazenamento

RLS habilitada nas nove tabelas públicas e nas dez tabelas do esquema storage identificadas na auditoria. A autorização de escrita dos módulos é centralizada em `is_admin()`, que exige perfil ativo com cargo `Administrador`. Perfis novos têm `ativo = false` por padrão e não recebem cargo administrativo automaticamente. As funções legadas não concedem por si só acesso administrativo pelas políticas atuais.

| Grupo | Leitura | Escrita |
|---|---|---|
| Seis módulos | Público: somente publicados; administrador: todos | Administrador ativo |
| destaques | Público: ativos; administrador: todos | Administrador ativo |
| perfis | Próprio perfil ou administrador autenticado | Sem privilégio DML para anon/authenticated no levantamento |
| permissoes_acesso | Sem privilégio de leitura para anon/authenticated | Sem privilégio DML para anon/authenticated |

Privilégios SQL e RLS atuam em conjunto. TRUNCATE, TRIGGER e REFERENCES foram revogados dos papéis públicos/clientes nas nove tabelas.

### Buckets

| Bucket | Limite por arquivo | Tipos permitidos | Caminhos utilizados |
|---|---|---|---|
| ensino | 20 MiB | Imagens e documentos | `imagens/`, `documentos/` |
| equipe | 5 MiB | JPEG, PNG, WebP | `integrantes/` |
| extensao | 20 MiB | Imagens e documentos | `imagens/`, `documentos/` |
| materiais | 20 MiB | JPEG, PNG, WebP, PDF | `imagens/`, `arquivos/` |
| pesquisa | 20 MiB | Imagens e documentos | `imagens/`, `documentos/` |
| publicacoes | 20 MiB | PDF | Raiz do bucket |

Ensino, extensão e pesquisa admitem JPEG, PNG, WebP, PDF, DOC, DOCX, PPT, PPTX, ODT e ODP. O código administrativo limita as imagens desses três módulos a 5 MiB. Os limites de frontend não substituem os controles do Storage.

Há quatro políticas administrativas em `storage.objects` (SELECT, INSERT, UPDATE, DELETE) e uma política de SELECT público condicionada a `arquivo_esta_publicado()`. O helper `js/storage.js` normaliza referências antigas e caminhos relativos e gera URLs assinadas com validade de 300 segundos. Os documentos recebem uma nova assinatura ao serem abertos pelo fluxo revisado.

**Atenção:** os seis buckets continuam públicos. URLs públicas diretas podem permitir acesso a arquivos não publicados, independentemente da política de leitura de metadados. A migração para privados permanece pendente. URLs assinadas já emitidas podem continuar válidas até expirar.

## 8. Configuração e execução

1. Preserve a estrutura de pastas e os caminhos relativos.
2. Utilize o projeto Supabase existente com as tabelas, funções, políticas e buckets documentados.
3. Confira a conexão central em `adm/js/config.js`.
4. Utilize somente a URL do projeto e a chave pública publishable ou anon legada no frontend. Nunca inclua service_role, secret keys, senhas ou tokens pessoais.
5. Confira o perfil administrativo pelo Supabase Auth e pela tabela `perfis`, usando um acesso autorizado.
6. Abra o site por HTTP(S), com navegador moderno e JavaScript habilitado. Não execute diretamente por `file://`, pois os módulos ES podem ser bloqueados por CORS.

Exemplo ilustrativo de configuração (não é uma transcrição do arquivo existente):

```js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_KEY = "SUA_CHAVE_PUBLICA";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

Preserve o método de importação existente se estiver funcionando. Em caso de mudança de projeto Supabase, revise também a origem configurada no helper de Storage e as referências legadas na função `arquivo_esta_publicado()`.

## 9. Publicação sugerida — Netlify

1. Prepare uma cópia da pasta LAEF com `index.html` na raiz e todos os arquivos necessários ao site.
2. Retire dessa cópia backups, credenciais privadas, `.git` e documentos internos não destinados ao público.
3. Acesse [Netlify Drop](https://app.netlify.com/drop) e autentique-se.
4. Envie a pasta preparada pela interface de publicação manual.
5. Registre o endereço HTTPS e a versão do deploy. A página administrativa de entrada é `adm/login.html`.
6. Quando os testes forem autorizados, valide navegação, login, filtros, imagens, documentos e operações administrativas antes de considerar a publicação definitiva.

Para atualizar, publique uma nova cópia completa preservando a estrutura. A reversão de um deploy estático não reverte alterações no Supabase. Consulte o Documento 05 para detalhes. Nenhuma publicação foi realizada nesta etapa.

## 10. Estado do desenvolvimento

### Trabalho registrado como implementado ou verificado parcialmente

- [x] Inventário da estrutura de arquivos e banco de dados.
- [x] Revisão das políticas RLS e privilégios SQL.
- [x] Consolidação das políticas do Storage e configuração dos limites MIME.
- [x] Função de verificação de arquivos publicados.
- [x] Revisão dos seis módulos públicos e seis administrativos para URLs assinadas.
- [x] Busca textual por dependências de URLs públicas no código.
- [x] Validação do ano de publicação no banco, com testes SQL anteriores.
- [x] Elaboração dos seis documentos técnicos e deste README.

Testes SQL anteriores verificaram cenários específicos de leitura, autorização e CRUD; não cobrem todas as operações de todos os módulos. A revisão de código não equivale a teste de integração.

### Backlog atual

| ID | Prioridade | Pendência |
|---|---|---|
| P01 | Alta | Conferir versões locais, sintaxe e importações dos 12 módulos e helper |
| P02 | Alta | Validar seis módulos públicos por HTTP(S) |
| P03 | Alta | Validar login, CRUD e bloqueios administrativos |
| P04 | Alta | Validar emissão, abertura e expiração de URLs assinadas |
| P05 | Alta | Migrar seis buckets para privados após P01–P04 e autorização |
| P06 | Alta | Validar segurança após migração, incluindo URLs públicas antigas |
| P07 | Média | Conferir dois candidatos a arquivos órfãos antes de excluir |
| P08 | Média | Confirmar publicação, navegação, responsividade e acessibilidade |
| P09 | Média | Revisar funções legadas, concorrência e tratamento de falhas |

A auditoria registrou oito arquivos, seis vinculados a cinco registros publicados e dois candidatos a órfãos. Não foram identificados arquivos referenciados ausentes naquele levantamento. Esses números são históricos e devem ser reconferidos antes de qualquer limpeza. Não exclua objetos diretamente por SQL; utilize a interface ou API de Storage após verificar referências.

## 11. Manutenção e continuidade

- Preserve cópias versionadas do código e registre alterações de configuração.
- Faça backups do banco e dos arquivos separadamente; confirme as condições do plano Supabase e a possibilidade de restauração.
- Revise periodicamente contas administrativas, privilégios, políticas, limites de armazenamento e arquivos sem referência.
- Não remova funções legadas sem verificar dependências.
- Após alterações autorizadas, valide o módulo afetado e atualize a documentação e o backlog.
- Registre data, responsável, versão, evidências e critérios de aceite de cada tarefa concluída.

## 12. Limitações e controle documental

Esta versão consolida os documentos técnicos 01–06 e os resultados de auditoria registrados até 26/11/2026. Não houve nova consulta ao ambiente, instalação, teste, publicação ou alteração do sistema para produzir este README. As versões finais dos arquivos locais não foram integralmente comparadas. Os testes de navegador foram suspensos por decisão do responsável. A segurança integral do armazenamento ainda depende da migração e validação dos buckets privados.

Os procedimentos de publicação, prioridades e rotinas de manutenção são recomendações. Os links relativos dependem da organização local indicada na seção 2. Credenciais privadas e identificadores pessoais foram omitidos. Não há licença de software confirmada nesta documentação.
