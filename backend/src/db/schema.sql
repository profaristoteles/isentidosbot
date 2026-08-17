-- Database Schema for Bot de WhatsApp - Instituto Sentidos / ISP Preparatórios

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grupos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    jid_whatsapp VARCHAR(255) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boas_vindas (
    id SERIAL PRIMARY KEY,
    grupo_id INTEGER UNIQUE REFERENCES grupos(id) ON DELETE CASCADE,
    mensagem TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
    arquivo_url TEXT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(100),
    mensagem TEXT,
    data_envio TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    erro_mensagem TEXT,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integracoes (
    id SERIAL PRIMARY KEY,
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'youtube', 'instagram', 'blog'
    url_referencia TEXT NOT NULL,
    ultimo_id_verificado TEXT,
    intervalo_minutos INTEGER DEFAULT 15,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL, -- 'boas_vindas', 'agendamento', 'youtube', 'instagram', 'blog', 'sistema'
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE SET NULL,
    detalhe TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sucesso', 'erro'
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_data ON agendamentos (status, data_envio);
CREATE INDEX IF NOT EXISTS idx_integracoes_ativo ON integracoes (ativo);
CREATE INDEX IF NOT EXISTS idx_logs_criado_em ON logs (criado_em DESC);
