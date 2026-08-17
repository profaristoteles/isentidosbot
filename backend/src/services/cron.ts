import cron from 'node-cron';
import Parser from 'rss-parser';
import { query } from '../db';
import { sendMediaMessage, sendTextMessage } from './evolution';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InstitutoSentidosBot/1.0' },
});

const FORTALEZA_TZ = 'America/Fortaleza';

/**
 * 1. Cron de Agendamento de Arquivos e Mensagens (Roda a cada minuto)
 */
async function processScheduledDispatches() {
  try {
    // Buscar agendamentos pendentes cuja data_envio seja menor ou igual ao horário atual em Fortaleza
    const selectRes = await query(`
      SELECT a.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM agendamentos a
      JOIN grupos g ON a.grupo_id = g.id
      WHERE a.status = 'pendente' 
        AND g.ativo = true
        AND a.data_envio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Fortaleza')
      ORDER BY a.data_envio ASC
    `);

    if (selectRes.rows.length === 0) return;

    console.log(`⏰ [CRON] Encontrado(s) ${selectRes.rows.length} envio(s) agendado(s) para processar...`);

    for (const item of selectRes.rows) {
      try {
        let response;
        if (item.arquivo_url && item.arquivo_url.trim() !== '') {
          // Enviar arquivo / mídia
          response = await sendMediaMessage(
            item.jid_whatsapp,
            item.arquivo_url,
            item.nome_arquivo || 'arquivo.pdf',
            item.mensagem || ''
          );
        } else if (item.mensagem) {
          // Enviar apenas texto
          response = await sendTextMessage(item.jid_whatsapp, item.mensagem);
        }

        // Atualizar status para enviado
        await query(
          `UPDATE agendamentos SET status = 'enviado', erro_mensagem = NULL WHERE id = $1`,
          [item.id]
        );

        // Registrar log de sucesso
        await query(
          `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
          [
            'agendamento',
            item.grupo_id,
            `Arquivo/Mensagem "${item.nome_arquivo || 'Texto'}" enviado com sucesso para o grupo "${item.grupo_nome}"`,
            'sucesso',
          ]
        );

        console.log(`✅ [CRON] Agendamento #${item.id} enviado para o grupo ${item.grupo_nome}`);
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro desconhecido ao enviar agendamento';
        
        await query(
          `UPDATE agendamentos SET status = 'erro', erro_mensagem = $1 WHERE id = $2`,
          [errorMsg, item.id]
        );

        await query(
          `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
          [
            'agendamento',
            item.grupo_id,
            `Falha ao enviar agendamento #${item.id} ("${item.nome_arquivo}"): ${errorMsg}`,
            'erro',
          ]
        );
      }
    }
  } catch (error) {
    console.error('❌ [CRON Error] Erro no processamento de agendamentos:', error);
  }
}

/**
 * 2. Cron de Monitoramento de Conteúdos (Instagram via RSSHub, YouTube, Blogs)
 */
async function processContentIntegrations() {
  try {
    const integracoesRes = await query(`
      SELECT i.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM integracoes i
      JOIN grupos g ON i.grupo_id = g.id
      WHERE i.ativo = true AND g.ativo = true
    `);

    if (integracoesRes.rows.length === 0) return;

    for (const integ of integracoesRes.rows) {
      try {
        if (integ.tipo === 'instagram') {
          await checkInstagramIntegration(integ);
        } else if (integ.tipo === 'youtube') {
          await checkYouTubeIntegration(integ);
        } else if (integ.tipo === 'blog') {
          await checkBlogIntegration(integ);
        }
      } catch (err: any) {
        console.error(`❌ [CRON Integracao #${integ.id} (${integ.tipo})] Erro:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ [CRON Error] Erro ao monitorar integrações:', error);
  }
}

/**
 * Checagem de Instagram via container local RSSHub
 */
export async function checkInstagramIntegration(integ: any) {
  const rsshubUrl = process.env.RSSHUB_URL || 'http://rsshub:1200';
  let username = integ.url_referencia.trim();
  
  // Extrair username se for enviado como URL completa (ex: instagram.com/isentidos)
  if (username.includes('instagram.com/')) {
    const parts = username.split('instagram.com/')[1].split('/')[0].replace('@', '');
    username = parts;
  } else {
    username = username.replace('@', '');
  }

  const targetFeedUrl = `${rsshubUrl}/instagram/user/${username}`;
  
  const feed = await parser.parseURL(targetFeedUrl);
  if (!feed.items || feed.items.length === 0) return;

  const latestItem = feed.items[0];
  const itemId = latestItem.guid || latestItem.link || latestItem.id || latestItem.pubDate;

  // Se já foi enviado anteriormente, ignorar
  if (integ.ultimo_id_verificado === itemId) return;

  // Se é a primeira execução (ultimo_id_verificado é null), gravamos sem spam
  if (!integ.ultimo_id_verificado) {
    await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [itemId, integ.id]);
    return;
  }

  // Novo post detectado!
  const postTitle = latestItem.contentSnippet || latestItem.title || 'Nova publicação';
  const postLink = latestItem.link || `https://instagram.com/${username}`;

  const messageText = `📸 *Novo Post no Instagram!* (@${username})\n\n${postTitle.slice(0, 200)}...\n\n👉 Confira aqui: ${postLink}`;

  await sendTextMessage(integ.jid_whatsapp, messageText);

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [itemId, integ.id]);

  await query(
    `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
    [
      'instagram',
      integ.grupo_id,
      `Novo post do Instagram publicado no grupo ${integ.grupo_nome}: ${postLink}`,
      'sucesso',
    ]
  );
}

/**
 * Checagem de YouTube via Feed RSS oficial
 */
export async function checkYouTubeIntegration(integ: any) {
  let feedUrl = integ.url_referencia.trim();

  // Converter link de canal para link de feed RSS do YouTube
  if (feedUrl.includes('youtube.com/channel/')) {
    const channelId = feedUrl.split('youtube.com/channel/')[1].split('/')[0].split('?')[0];
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  } else if (!feedUrl.includes('youtube.com/feeds/videos.xml')) {
    // Se for URL customizada ou de usuário, tentar ler diretamente como feed
    feedUrl = integ.url_referencia;
  }

  const feed = await parser.parseURL(feedUrl);
  if (!feed.items || feed.items.length === 0) return;

  const latestItem = feed.items[0];
  const videoId = latestItem.id || latestItem.guid || latestItem.link;

  if (integ.ultimo_id_verificado === videoId) return;

  if (!integ.ultimo_id_verificado) {
    await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [videoId, integ.id]);
    return;
  }

  const videoTitle = latestItem.title || 'Novo vídeo';
  const videoLink = latestItem.link || feedUrl;

  const messageText = `🎥 *Vídeo Novo no YouTube!*\n\n*${videoTitle}*\n\n👉 Assista agora: ${videoLink}`;

  await sendTextMessage(integ.jid_whatsapp, messageText);

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [videoId, integ.id]);

  await query(
    `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
    [
      'youtube',
      integ.grupo_id,
      `Novo vídeo do YouTube publicado no grupo ${integ.grupo_nome}: "${videoTitle}"`,
      'sucesso',
    ]
  );
}

/**
 * Checagem de Feed RSS de Blog (isentidos.com.br, isppreparatorios.com.br)
 */
export async function checkBlogIntegration(integ: any) {
  let feedUrl = integ.url_referencia.trim();
  if (!feedUrl.endsWith('/feed') && !feedUrl.endsWith('/rss') && !feedUrl.endsWith('.xml')) {
    feedUrl = feedUrl.replace(/\/$/, '') + '/feed';
  }

  const feed = await parser.parseURL(feedUrl);
  if (!feed.items || feed.items.length === 0) return;

  const latestItem = feed.items[0];
  const postGuid = latestItem.guid || latestItem.link || latestItem.title;

  if (integ.ultimo_id_verificado === postGuid) return;

  if (!integ.ultimo_id_verificado) {
    await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [postGuid, integ.id]);
    return;
  }

  const postTitle = latestItem.title || 'Novo Artigo publicado';
  const postSnippet = (latestItem.contentSnippet || latestItem.content || '').slice(0, 180);
  const postLink = latestItem.link || feedUrl;

  const messageText = `📰 *Novo Artigo no Blog!*\n\n*${postTitle}*\n\n${postSnippet}...\n\n👉 Leia na íntegra: ${postLink}`;

  await sendTextMessage(integ.jid_whatsapp, messageText);

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [postGuid, integ.id]);

  await query(
    `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
    [
      'blog',
      integ.grupo_id,
      `Novo post do Blog publicado no grupo ${integ.grupo_nome}: "${postTitle}"`,
      'sucesso',
    ]
  );
}

/**
 * Inicializador de Agendadores Cron com Timezone America/Fortaleza
 */
export function initCronJobs() {
  console.log(`⏰ Inicializando agendadores de tarefas (Fuso: ${FORTALEZA_TZ})...`);

  // Disparo de mensagens e mídias a cada 1 minuto
  cron.schedule('* * * * *', () => {
    processScheduledDispatches();
  }, { timezone: FORTALEZA_TZ });

  // Checagem de novas publicações (YouTube, Instagram, Blogs) a cada 15 minutos
  cron.schedule('*/15 * * * *', () => {
    processContentIntegrations();
  }, { timezone: FORTALEZA_TZ });
}
