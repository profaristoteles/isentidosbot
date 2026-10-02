import cron from 'node-cron';
import Parser from 'rss-parser';
import { query } from '../db';
import { sendMediaMessage, sendTextMessage } from './evolution';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InstitutoSentidosBot/1.0' },
});

const FORTALEZA_TZ = 'America/Fortaleza';

/**
 * Helper para obter detalhes de data e hora no fuso America/Fortaleza
 */
function getFortalezaComponents(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FORTALEZA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const m: Record<string, string> = {};
  parts.forEach((p) => {
    m[p.type] = p.value;
  });
  let hr = m.hour === '24' ? '00' : m.hour;
  if (hr.length === 1) hr = '0' + hr;
  let min = m.minute;
  if (min.length === 1) min = '0' + min;

  const dayOfWeekMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayOfWeekMap[m.weekday] ?? 0;

  const dateStr = `${m.year}-${m.month}-${m.day}`; // YYYY-MM-DD em Fortaleza
  const timeStr = `${hr}:${min}`; // HH:mm em Fortaleza

  return { dateStr, timeStr, dayOfWeek, hour: Number(hr), minute: Number(min) };
}

/**
 * 1. Cron de Agendamento de Arquivos e Mensagens Únicas (Roda a cada minuto)
 */
async function processScheduledDispatches() {
  try {
    // Buscar agendamentos pendentes (únicos, recorrente = false ou NULL) cuja data_envio seja <= horário atual em Fortaleza
    const selectRes = await query(`
      SELECT a.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM agendamentos a
      JOIN grupos g ON a.grupo_id = g.id
      WHERE a.status = 'pendente' 
        AND (a.recorrente = false OR a.recorrente IS NULL)
        AND g.ativo = true
        AND a.data_envio IS NOT NULL
        AND a.data_envio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Fortaleza')
      ORDER BY a.data_envio ASC
    `);

    if (selectRes.rows.length === 0) return;

    console.log(`⏰ [CRON] Encontrado(s) ${selectRes.rows.length} envio(s) agendado(s) único(s) para processar...`);

    for (let i = 0; i < selectRes.rows.length; i++) {
      const item = selectRes.rows[i];
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

      // Pausa de segurança anti-bloqueio entre envios para diferentes grupos
      if (i < selectRes.rows.length - 1) {
        const delaySec = item.intervalo_envio_segundos || 15;
        const jitter = (Math.random() * 3) - 1; // Variação natural entre -1s e +2s
        const waitSec = Math.max(3, delaySec + jitter);
        console.log(`⏳ [CRON Anti-Bloqueio] Aguardando ${waitSec.toFixed(1)}s antes do próximo envio agendado (${i + 2}/${selectRes.rows.length})...`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      }
    }
  } catch (error) {
    console.error('❌ [CRON Error] Erro no processamento de agendamentos únicos:', error);
  }
}

/**
 * 1b. Cron de Processamento de Agendamentos Recorrentes (Roda a cada minuto)
 */
export async function processRecurringDispatches() {
  try {
    const selectRes = await query(`
      SELECT a.*, g.jid_whatsapp, g.nome as grupo_nome
      FROM agendamentos a
      JOIN grupos g ON a.grupo_id = g.id
      WHERE a.recorrente = true
        AND a.status = 'ativo'
        AND g.ativo = true
      ORDER BY a.id ASC
    `);

    if (selectRes.rows.length === 0) return;

    const now = new Date();
    const currentFortaleza = getFortalezaComponents(now);

    for (let i = 0; i < selectRes.rows.length; i++) {
      const item = selectRes.rows[i];
      try {
        // 1. Verificar se data_fim está definida e já passou
        if (item.data_fim) {
          const endTimestamp = new Date(item.data_fim).getTime();
          if (endTimestamp < now.getTime()) {
            await query(`UPDATE agendamentos SET status = 'inativo' WHERE id = $1`, [item.id]);
            console.log(`ℹ️ [CRON Recorrente] Agendamento #${item.id} expirou data_fim e foi marcado como inativo.`);
            continue;
          }
        }

        // 2. Verificar horário do dia (horario no formato HH:mm ou HH:mm:ss)
        if (!item.horario) continue;
        const itemHorarioStr = String(item.horario).slice(0, 5); // Ex: "09:00"
        if (itemHorarioStr !== currentFortaleza.timeStr) {
          continue; // Não é o minuto exato de disparo
        }

        // 3. Regra de Recorrência
        if (item.tipo_recorrencia === 'dias_semana') {
          const diasSemana: number[] = Array.isArray(item.dias_semana) ? item.dias_semana : [];
          if (!diasSemana.includes(currentFortaleza.dayOfWeek)) {
            continue; // Hoje não é um dos dias da semana configurados
          }

          // Verificar se já foi executado hoje (fuso America/Fortaleza)
          if (item.ultima_execucao) {
            const lastExecFortaleza = getFortalezaComponents(new Date(item.ultima_execucao));
            if (lastExecFortaleza.dateStr === currentFortaleza.dateStr) {
              continue; // Já executou hoje
            }
          }
        } else if (item.tipo_recorrencia === 'intervalo_dias') {
          const intervalo = Number(item.intervalo_dias) || 1;
          const refDate = item.ultima_execucao ? new Date(item.ultima_execucao) : new Date(item.criado_em);
          const diffMs = now.getTime() - refDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (item.ultima_execucao && diffDays < (intervalo - 0.05)) {
            continue; // Ainda não se passaram intervalo_dias desde a última execução
          }
        } else {
          continue;
        }

        // 4. Travar concorrência: Atualizar ultima_execucao imediatamente para a hora atual
        const previousUltimaExecucao = item.ultima_execucao;
        await query(`UPDATE agendamentos SET ultima_execucao = CURRENT_TIMESTAMP WHERE id = $1`, [item.id]);

        // 5. Realizar disparo
        try {
          let response;
          if (item.arquivo_url && item.arquivo_url.trim() !== '') {
            response = await sendMediaMessage(
              item.jid_whatsapp,
              item.arquivo_url,
              item.nome_arquivo || 'arquivo.pdf',
              item.mensagem || ''
            );
          } else if (item.mensagem) {
            response = await sendTextMessage(item.jid_whatsapp, item.mensagem);
          }

          // Gravar Log de sucesso com tipo_evento: "agendamento_recorrente"
          await query(
            `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
            [
              'agendamento_recorrente',
              item.grupo_id,
              `Disparo recorrente #${item.id} ("${item.nome_arquivo || 'Texto'}") enviado com sucesso para o grupo "${item.grupo_nome}"`,
              'sucesso',
            ]
          );

          console.log(`✅ [CRON Recorrente] Agendamento #${item.id} enviado com sucesso para o grupo ${item.grupo_nome}`);
        } catch (sendErr: any) {
          const errorMsg = sendErr?.message || 'Falha ao enviar disparo recorrente';
          // Rollback do timestamp de ultima_execucao em caso de falha de envio para permitir re-tentativa posterior
          await query(`UPDATE agendamentos SET ultima_execucao = $1, erro_mensagem = $2 WHERE id = $3`, [
            previousUltimaExecucao,
            errorMsg,
            item.id,
          ]);

          await query(
            `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
            [
              'agendamento_recorrente',
              item.grupo_id,
              `Falha no disparo recorrente #${item.id} ("${item.nome_arquivo || 'Texto'}"): ${errorMsg}`,
              'erro',
            ]
          );
        }

        // Pausa de segurança anti-bloqueio entre envios recorrentes para diferentes grupos
        if (i < selectRes.rows.length - 1) {
          const delaySec = item.intervalo_envio_segundos || 15;
          const jitter = (Math.random() * 3) - 1;
          const waitSec = Math.max(3, delaySec + jitter);
          console.log(`⏳ [CRON Recorrente Anti-Bloqueio] Aguardando ${waitSec.toFixed(1)}s antes do próximo grupo (${i + 2}/${selectRes.rows.length})...`);
          await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        }
      } catch (itemErr: any) {
        console.error(`❌ [CRON Recorrente Error] Falha ao processar item #${item.id}:`, itemErr.message);
      }
    }
  } catch (error) {
    console.error('❌ [CRON Error] Erro no processamento de agendamentos recorrentes:', error);
  }
}

/**
 * Busca todos os grupos ativos vinculados a uma integração via integracao_grupos
 */
async function getActiveGroupsForIntegration(integracaoId: number) {
  const res = await query(
    `SELECT g.id, g.nome, g.jid_whatsapp
     FROM integracao_grupos ig
     JOIN grupos g ON ig.grupo_id = g.id
     WHERE ig.integracao_id = $1 AND g.ativo = true`,
    [integracaoId]
  );
  return res.rows;
}

/**
 * 2. Cron de Monitoramento de Conteúdos (Instagram via RSSHub, YouTube, Blogs)
 */
async function processContentIntegrations() {
  try {
    const integracoesRes = await query(`
      SELECT * FROM integracoes WHERE ativo = true
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

  if (integ.ultimo_id_verificado === itemId) return;

  if (!integ.ultimo_id_verificado) {
    await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [itemId, integ.id]);
    return;
  }

  const groups = await getActiveGroupsForIntegration(integ.id);
  if (groups.length === 0) return;

  const postTitle = latestItem.contentSnippet || latestItem.title || 'Nova publicação';
  const postLink = latestItem.link || `https://instagram.com/${username}`;
  const messageText = `📸 *Novo Post no Instagram!* (@${username})\n\n${postTitle.slice(0, 200)}...\n\n👉 Confira aqui: ${postLink}`;

  for (const g of groups) {
    try {
      await sendTextMessage(g.jid_whatsapp, messageText);
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'instagram',
          g.id,
          `Novo post do Instagram publicado no grupo ${g.nome}: ${postLink}`,
          'sucesso',
        ]
      );
      // Delay de 2 a 3 segundos entre envios para grupos diferentes
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
    } catch (err: any) {
      console.error(`Erro ao enviar Instagram para grupo ${g.nome}:`, err.message);
    }
  }

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [itemId, integ.id]);
}

/**
 * Checagem de YouTube via Feed RSS oficial
 */
export async function checkYouTubeIntegration(integ: any) {
  let feedUrl = integ.url_referencia.trim();

  if (feedUrl.includes('youtube.com/channel/')) {
    const channelId = feedUrl.split('youtube.com/channel/')[1].split('/')[0].split('?')[0];
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  } else if (!feedUrl.includes('youtube.com/feeds/videos.xml')) {
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

  const groups = await getActiveGroupsForIntegration(integ.id);
  if (groups.length === 0) return;

  const videoTitle = latestItem.title || 'Novo vídeo';
  const videoLink = latestItem.link || feedUrl;
  const messageText = `🎥 *Vídeo Novo no YouTube!*\n\n*${videoTitle}*\n\n👉 Assista agora: ${videoLink}`;

  for (const g of groups) {
    try {
      await sendTextMessage(g.jid_whatsapp, messageText);
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'youtube',
          g.id,
          `Novo vídeo do YouTube publicado no grupo ${g.nome}: "${videoTitle}"`,
          'sucesso',
        ]
      );
      // Delay de 2 a 3 segundos entre envios para grupos diferentes
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
    } catch (err: any) {
      console.error(`Erro ao enviar YouTube para grupo ${g.nome}:`, err.message);
    }
  }

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [videoId, integ.id]);
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

  const groups = await getActiveGroupsForIntegration(integ.id);
  if (groups.length === 0) return;

  const postTitle = latestItem.title || 'Novo Artigo publicado';
  const postSnippet = (latestItem.contentSnippet || latestItem.content || '').slice(0, 180);
  const postLink = latestItem.link || feedUrl;
  const messageText = `📰 *Novo Artigo no Blog!*\n\n*${postTitle}*\n\n${postSnippet}...\n\n👉 Leia na íntegra: ${postLink}`;

  for (const g of groups) {
    try {
      await sendTextMessage(g.jid_whatsapp, messageText);
      await query(
        `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
        [
          'blog',
          g.id,
          `Novo post do Blog publicado no grupo ${g.nome}: "${postTitle}"`,
          'sucesso',
        ]
      );
      // Delay de 2 a 3 segundos entre envios para grupos diferentes
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
    } catch (err: any) {
      console.error(`Erro ao enviar Blog para grupo ${g.nome}:`, err.message);
    }
  }

  await query(`UPDATE integracoes SET ultimo_id_verificado = $1 WHERE id = $2`, [postGuid, integ.id]);
}

/**
 * Executa busca retroativa (backfill) de uma integração e enfileira os itens em fila_conteudo.
 * Em vez de enviar imediatamente, grava com status 'pendente' ordenados por data de publicação original (mais antigo primeiro).
 */
export async function runBackfillForIntegration(integ: any) {
  let targetFeedUrl = integ.url_referencia.trim();

  if (integ.tipo === 'instagram') {
    const rsshubUrl = process.env.RSSHUB_URL || 'http://rsshub:1200';
    let username = targetFeedUrl;
    if (username.includes('instagram.com/')) {
      username = username.split('instagram.com/')[1].split('/')[0].replace('@', '');
    } else {
      username = username.replace('@', '');
    }
    targetFeedUrl = `${rsshubUrl}/instagram/user/${username}`;
  } else if (integ.tipo === 'youtube') {
    if (targetFeedUrl.includes('youtube.com/channel/')) {
      const channelId = targetFeedUrl.split('youtube.com/channel/')[1].split('/')[0].split('?')[0];
      targetFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    }
  } else if (integ.tipo === 'blog') {
    if (!targetFeedUrl.endsWith('/feed') && !targetFeedUrl.endsWith('/rss') && !targetFeedUrl.endsWith('.xml')) {
      targetFeedUrl = targetFeedUrl.replace(/\/$/, '') + '/feed';
    }
  }

  const feed = await parser.parseURL(targetFeedUrl);
  if (!feed.items || feed.items.length === 0) {
    return { itensAdicionados: 0 };
  }

  // Mapear itens extraídos
  const extractedItems = feed.items.map((item: any) => {
    const titulo = item.title || item.contentSnippet || 'Publicação sem título';
    const link = item.link || targetFeedUrl;
    let pubDate = item.pubDate || item.isoDate;
    let dateObj = pubDate ? new Date(pubDate) : new Date();
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    return {
      titulo,
      link,
      data_publicacao_original: dateObj.toISOString(),
    };
  });

  // Ordenar por data_publicacao_original ASC (mais antigo primeiro)
  extractedItems.sort((a: any, b: any) => new Date(a.data_publicacao_original).getTime() - new Date(b.data_publicacao_original).getTime());

  let itensAdicionados = 0;

  for (const item of extractedItems) {
    const checkRes = await query(
      `SELECT id FROM fila_conteudo WHERE integracao_id = $1 AND link = $2`,
      [integ.id, item.link]
    );

    if (checkRes.rowCount === 0) {
      await query(
        `INSERT INTO fila_conteudo (integracao_id, titulo, link, data_publicacao_original, status)
         VALUES ($1, $2, $3, $4, 'pendente')`,
        [integ.id, item.titulo, item.link, item.data_publicacao_original]
      );
      itensAdicionados++;
    }
  }

  await query(
    `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
    [
      'gotejamento',
      null,
      `Backfill executado para integração #${integ.id} (${integ.tipo}): ${itensAdicionados} item(ns) adicionado(s) à fila de gotejamento.`,
      'sucesso',
    ]
  );

  return { itensAdicionados };
}

/**
 * 3. Cron de Liberação por Gotejamento (Drip)
 * Roda diariamente às 09:00 (America/Fortaleza) e processa os N itens mais antigos com status 'pendente'
 */
export async function processContentDrip() {
  try {
    const now = new Date();
    const dayOfWeekStr = new Intl.DateTimeFormat('en-US', { timeZone: FORTALEZA_TZ, weekday: 'short' }).format(now);
    const isMonday = dayOfWeekStr.toLowerCase().startsWith('mon');

    const integracoesRes = await query(`
      SELECT * FROM integracoes WHERE ativo = true
    `);

    if (integracoesRes.rows.length === 0) return;

    for (const integ of integracoesRes.rows) {
      try {
        const periodo = integ.gotejamento_periodo || 'dia';
        const quantidade = integ.gotejamento_quantidade || 1;

        if (periodo === 'semana' && !isMonday) {
          continue;
        }

        const filaRes = await query(
          `SELECT * FROM fila_conteudo
           WHERE integracao_id = $1 AND status = 'pendente'
           ORDER BY data_publicacao_original ASC, id ASC
           LIMIT $2`,
          [integ.id, quantidade]
        );

        if (filaRes.rows.length === 0) continue;

        const groups = await getActiveGroupsForIntegration(integ.id);
        if (groups.length === 0) continue;

        console.log(`💧 [DRIP] Processando gotejamento da integração #${integ.id} (${integ.tipo}): ${filaRes.rows.length} item(ns) pendente(s) para ${groups.length} grupo(s)`);

        for (const item of filaRes.rows) {
          try {
            let messageText = '';
            if (integ.tipo === 'youtube') {
              messageText = `🎥 *Vídeo em Destaque!*\n\n*${item.titulo}*\n\n👉 Assista agora: ${item.link}`;
            } else if (integ.tipo === 'instagram') {
              const username = integ.url_referencia.replace('@', '');
              messageText = `📸 *Publicação em Destaque!* (@${username})\n\n${item.titulo.slice(0, 200)}...\n\n👉 Confira aqui: ${item.link}`;
            } else {
              messageText = `📰 *Conteúdo em Destaque no Blog!*\n\n*${item.titulo}*\n\n👉 Leia na íntegra: ${item.link}`;
            }

            // Enviar para cada grupo vinculado à integração
            for (const g of groups) {
              try {
                await sendTextMessage(g.jid_whatsapp, messageText);
                await query(
                  `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
                  [
                    'gotejamento',
                    g.id,
                    `Gotejamento enviado com sucesso para o grupo "${g.nome}": "${item.titulo}"`,
                    'sucesso',
                  ]
                );
                console.log(`✅ [DRIP] Item #${item.id} enviado para o grupo "${g.nome}"`);

                // Delay de 2 a 3 segundos entre envios a diferentes grupos
                await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
              } catch (groupErr: any) {
                console.error(`Falha no gotejamento para grupo ${g.nome}:`, groupErr.message);
              }
            }

            await query(`UPDATE fila_conteudo SET status = 'enviado' WHERE id = $1`, [item.id]);

            // Delay de 3 a 5 segundos entre itens diferentes da fila
            await new Promise((resolve) => setTimeout(resolve, 3000 + Math.floor(Math.random() * 2000)));
          } catch (itemErr: any) {
            const errorMsg = itemErr?.message || 'Erro desconhecido ao enviar gotejamento';
            await query(`UPDATE fila_conteudo SET status = 'erro' WHERE id = $1`, [item.id]);
            await query(
              `INSERT INTO logs (tipo_evento, grupo_id, detalhe, status) VALUES ($1, $2, $3, $4)`,
              [
                'gotejamento',
                null,
                `Falha no gotejamento item #${item.id} ("${item.titulo}"): ${errorMsg}`,
                'erro',
              ]
            );
          }
        }
      } catch (integErr: any) {
        console.error(`❌ [DRIP Error] Erro ao processar integração #${integ.id}:`, integErr.message);
      }
    }
  } catch (error) {
    console.error('❌ [DRIP Error] Erro no processamento de gotejamento:', error);
  }
}

/**
 * Inicializador de Agendadores Cron com Timezone America/Fortaleza
 */
export function initCronJobs() {
  console.log(`⏰ Inicializando agendadores de tarefas (Fuso: ${FORTALEZA_TZ})...`);

  // Disparo de mensagens e mídias a cada 1 minuto (Únicos e Recorrentes)
  cron.schedule('* * * * *', () => {
    processScheduledDispatches();
    processRecurringDispatches();
  }, { timezone: FORTALEZA_TZ });

  // Checagem de novas publicações (YouTube, Instagram, Blogs) a cada 15 minutos
  cron.schedule('*/15 * * * *', () => {
    processContentIntegrations();
  }, { timezone: FORTALEZA_TZ });

  // Liberação por gotejamento diária às 09:00
  cron.schedule('0 9 * * *', () => {
    processContentDrip();
  }, { timezone: FORTALEZA_TZ });
}
