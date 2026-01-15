# Event Flow

Event Flow é uma aplicação web para gerenciamento de eventos, permitindo que os usuários se cadastrem, criem eventos, reservem ingressos e acompanhem seus eventos e ingressos adquiridos.

## Funcionalidades

- **Cadastro de Usuários**: Permite que novos usuários se registrem na plataforma.
- **Login com autenticação JWT**: Os usuários podem fazer login e receber um token JWT para autenticação.
- **Criação de Eventos**: Usuários autenticados podem criar eventos com informações como título, descrição, data, local, preço e imagem.
- **Listagem de Eventos**: Todos os usuários podem visualizar os eventos disponíveis, incluindo informações sobre o organizador.
- **Reserva de Ingressos**: Usuários autenticados podem reservar ingressos para eventos disponíveis.
- **Meus Ingressos**: Usuários autenticados podem visualizar os ingressos que reservaram, com detalhes dos eventos.
- **Meus Eventos**: Usuários autenticados podem visualizar os eventos que criaram, incluindo a contagem de ingressos gerados.
- **Exclusão de Eventos**: Usuários podem excluir eventos que criaram, garantindo a integridade referencial ao deletar os ingressos associados.

## Tecnologias Utilizadas

- **Node.js**: Plataforma de execução do JavaScript no servidor.
- **Express**: Framework para construção de APIs.
- **Prisma**: ORM para interação com o banco de dados.
- **PostgreSQL**: Banco de dados relacional utilizado para armazenar as informações.
- **JWT (JSON Web Token)**: Para autenticação e autorização de usuários.
- **bcryptjs**: Para hash de senhas.
- **dotenv**: Para gerenciar variáveis de ambiente.
- **CORS**: Para permitir requisições de diferentes origens.

## Estrutura do Projeto

```
project-root/
├── prisma/
│   ├── schema.prisma          # Definição do esquema do banco de dados
│   ├── migrations/            # Migrações do banco de dados
│       ├── migration_lock.toml
│       └── 20260113115943_init/
│           └── migration.sql
├── src/
│   ├── index.js               # Arquivo principal da aplicação
│   └── middlewares/
│       └── auth.js            # Middleware de autenticação
├── .env                       # Variáveis de ambiente (não versionado)
├── .gitignore                 # Arquivos e pastas ignorados pelo Git
├── package.json               # Configurações do projeto e dependências
└── prisma.config.js           # Configuração do Prisma
```

## Configuração do Ambiente

1. **Clone o repositório**:

   ```bash
   git clone https://github.com/DavidSouzaxz/event-flow-server.git
   cd event-flow/server
   ```

2. **Instale as dependências**:

   ```bash
   npm install
   ```

3. **Configure o arquivo `.env`**:
   Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis:

   ```env
   DATABASE_URL="postgresql://<USUARIO>:<SENHA>@<HOST>:<PORTA>/<NOME_DO_BANCO>?schema=public"
   JWT_SECRET="sua_chave_secreta_aqui"
   ```

4. **Configure o banco de dados**:
   Certifique-se de que o PostgreSQL está rodando e execute as migrações do Prisma:

   ```bash
   npx prisma migrate dev
   ```

5. **Inicie o servidor**:

   ```bash
   npm start
   ```

   O servidor estará disponível em: `http://localhost:3000`

## Endpoints da API

### Autenticação

#### Registro de Usuário

- **POST** `/register`
- **Descrição**: Registra um novo usuário.
- **Body**:
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string"
  }
  ```

#### Login

- **POST** `/login`
- **Descrição**: Autentica um usuário e retorna um token JWT.
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

### Eventos

#### Listar Eventos

- **GET** `/events`
- **Descrição**: Retorna todos os eventos disponíveis.

#### Criar Evento

- **POST** `/events`
- **Descrição**: Cria um novo evento (requer autenticação).
- **Body**:
  ```json
  {
    "title": "string",
    "description": "string",
    "date": "YYYY-MM-DD",
    "location": "string",
    "price": "number",
    "imageUrl": "string"
  }
  ```

#### Detalhes de um Evento

- **GET** `/events/:id`
- **Descrição**: Retorna os detalhes de um evento específico.

#### Excluir Evento

- **DELETE** `/events/:id`
- **Descrição**: Exclui um evento criado pelo usuário autenticado.

### Ingressos

#### Reservar Ingresso

- **POST** `/bookings`
- **Descrição**: Reserva um ingresso para um evento (requer autenticação).
- **Body**:
  ```json
  {
    "eventId": "string"
  }
  ```

#### Meus Ingressos

- **GET** `/my-tickets`
- **Descrição**: Retorna os ingressos reservados pelo usuário autenticado.

### Meus Eventos

- **GET** `/my-events`
- **Descrição**: Retorna os eventos criados pelo usuário autenticado.

## Contribuição

1. Faça um fork do repositório.
2. Crie uma branch para sua feature ou correção: `git checkout -b minha-feature`.
3. Faça commit das suas alterações: `git commit -m 'Minha nova feature'`.
4. Envie para o repositório remoto: `git push origin minha-feature`.
5. Abra um Pull Request.

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
