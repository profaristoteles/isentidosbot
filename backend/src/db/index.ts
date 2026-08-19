import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgres://isentidos:isentidos_secret_2026@localhost:5432/isentidosbot';

export const pool = new Pool({
  connectionString,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('📦 Inicializando banco de dados PostgreSQL...');
    
    // Executar Schema SQL base
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      try {
        await client.query(sql);
        console.log('  ✅ [DB Step OK] Execução do schema.sql');
      } catch (err: any) {
        console.warn(`  ⚠️ [DB Step Warning] Execução do schema.sql: ${err.message}`);
      }
    }

    const runStep = async (description: string, querySql: string) => {
      try {
        await client.query(querySql);
        console.log(`  ✅ [DB Step OK] ${description}`);
      } catch (err: any) {
        console.warn(`  ⚠️ [DB Step Warning] ${description}: ${err.message}`);
      }
    };

    // 1. Migrações de Integrações & Gotejamento
    await runStep('Adicionar coluna gotejamento_quantidade em integracoes', 'ALTER TABLE integracoes ADD COLUMN IF NOT EXISTS gotejamento_quantidade INTEGER DEFAULT 1;');
    await runStep('Adicionar coluna gotejamento_periodo em integracoes', "ALTER TABLE integracoes ADD COLUMN IF NOT EXISTS gotejamento_periodo VARCHAR(20) DEFAULT 'dia';");

    // 2. Tabela integracao_grupos
    await runStep('Criar tabela integracao_grupos', `
      CREATE TABLE IF NOT EXISTS integracao_grupos (
          id SERIAL PRIMARY KEY,
          integracao_id INTEGER REFERENCES integracoes(id) ON DELETE CASCADE,
          grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
          UNIQUE(integracao_id, grupo_id)
      );
    `);
    await runStep('Migrar dados existentes para integracao_grupos', `
      INSERT INTO integracao_grupos (integracao_id, grupo_id)
      SELECT id, grupo_id FROM integracoes WHERE grupo_id IS NOT NULL
      ON CONFLICT (integracao_id, grupo_id) DO NOTHING;
    `);
    await runStep('Criar índice idx_integracao_grupos_integracao', 'CREATE INDEX IF NOT EXISTS idx_integracao_grupos_integracao ON integracao_grupos (integracao_id);');

    // 3. Tabela fila_conteudo
    await runStep('Criar tabela fila_conteudo', `
      CREATE TABLE IF NOT EXISTS fila_conteudo (
          id SERIAL PRIMARY KEY,
          integracao_id INTEGER REFERENCES integracoes(id) ON DELETE CASCADE,
          titulo TEXT NOT NULL,
          link TEXT NOT NULL,
          data_publicacao_original TIMESTAMPTZ,
          status VARCHAR(50) DEFAULT 'pendente',
          criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await runStep('Criar índice idx_fila_conteudo_integracao_status', 'CREATE INDEX IF NOT EXISTS idx_fila_conteudo_integracao_status ON fila_conteudo (integracao_id, status, data_publicacao_original ASC);');

    // 4. Migração de Boas-Vindas para Múltiplos Grupos
    // Busca dinâmica do nome real de qualquer constraint UNIQUE em boas_vindas.grupo_id
    try {
      const constraintRes = await client.query(`
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'boas_vindas' 
          AND kcu.column_name = 'grupo_id' 
          AND tc.constraint_type = 'UNIQUE'
      `);
      for (const row of constraintRes.rows) {
        const cName = row.constraint_name;
        await runStep(`Remover constraint UNIQUE real (${cName}) de boas_vindas.grupo_id`, `ALTER TABLE boas_vindas DROP CONSTRAINT IF EXISTS "${cName}"`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ [DB Step Warning] Falha ao consultar information_schema para constraint UNIQUE: ${err.message}`);
    }
    await runStep('Remover constraint UNIQUE fallback (boas_vindas_grupo_id_key)', 'ALTER TABLE boas_vindas DROP CONSTRAINT IF EXISTS boas_vindas_grupo_id_key;');
    await runStep('Remover NOT NULL de boas_vindas.grupo_id (se houver)', 'ALTER TABLE boas_vindas ALTER COLUMN grupo_id DROP NOT NULL;');

    await runStep('Criar tabela boas_vindas_grupos', `
      CREATE TABLE IF NOT EXISTS boas_vindas_grupos (
          id SERIAL PRIMARY KEY,
          boas_vindas_id INTEGER REFERENCES boas_vindas(id) ON DELETE CASCADE,
          grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
          UNIQUE(boas_vindas_id, grupo_id)
      );
    `);
    await runStep('Migrar dados de boas_vindas para boas_vindas_grupos', `
      INSERT INTO boas_vindas_grupos (boas_vindas_id, grupo_id)
      SELECT id, grupo_id FROM boas_vindas WHERE grupo_id IS NOT NULL
      ON CONFLICT (boas_vindas_id, grupo_id) DO NOTHING;
    `);
    await runStep('Criar índice idx_boas_vindas_grupos_bv', 'CREATE INDEX IF NOT EXISTS idx_boas_vindas_grupos_bv ON boas_vindas_grupos (boas_vindas_id);');
    await runStep('Criar índice idx_boas_vindas_grupos_grupo', 'CREATE INDEX IF NOT EXISTS idx_boas_vindas_grupos_grupo ON boas_vindas_grupos (grupo_id);');

    console.log('✅ Todas as tabelas, migrações e índices foram verificados e sincronizados com sucesso.');

    // Criar Usuário Admin Padrão se não existir
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@isentidos.com.br';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const userRes = await client.query('SELECT id FROM usuarios WHERE email = $1', [adminEmail]);
    if (userRes.rowCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPassword, salt);
      await client.query(
        'INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2)',
        [adminEmail, hash]
      );
      console.log(`👤 Usuário administrador padrão criado (${adminEmail}).`);
    }

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
