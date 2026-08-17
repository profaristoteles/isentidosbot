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
      console.log('✅ Tabelas verificadas/criadas com sucesso.');
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
