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
    
    // Executar Schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(sql);
      
      // Aplicar migrações para tabelas existentes
      await client.query(`
        ALTER TABLE integracoes ADD COLUMN IF NOT EXISTS gotejamento_quantidade INTEGER DEFAULT 1;
        ALTER TABLE integracoes ADD COLUMN IF NOT EXISTS gotejamento_periodo VARCHAR(20) DEFAULT 'dia';

        CREATE TABLE IF NOT EXISTS integracao_grupos (
            id SERIAL PRIMARY KEY,
            integracao_id INTEGER REFERENCES integracoes(id) ON DELETE CASCADE,
            grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
            UNIQUE(integracao_id, grupo_id)
        );

        INSERT INTO integracao_grupos (integracao_id, grupo_id)
        SELECT id, grupo_id FROM integracoes WHERE grupo_id IS NOT NULL
        ON CONFLICT (integracao_id, grupo_id) DO NOTHING;
      `);

      console.log('✅ Tabelas, migrações de múltiplos grupos e colunas de gotejamento verificadas/criadas com sucesso.');
    }

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
