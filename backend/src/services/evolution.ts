import axios from 'axios';

const getEvolutionConfig = () => {
  const baseURL = (process.env.EVOLUTION_API_URL || 'http://204.168.132.246:8080').trim().replace(/\/$/, '');
  const apiKey = (process.env.EVOLUTION_API_KEY || '').trim();
  const instance = (process.env.EVOLUTION_INSTANCE || 'isentidos').trim();

  return {
    baseURL,
    apiKey,
    instance,
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
  };
};

export async function sendTextMessage(jid: string, text: string) {
  const { baseURL, instance, headers } = getEvolutionConfig();
  const url = `${baseURL}/message/sendText/${instance}`;

  const payload = {
    number: jid,
    text: text,
    delay: 1200,
  };

  console.log(`🚀 [Evolution API Call] Disparando POST em ${url} | Instância: "${instance}"`);

  try {
    const response = await axios.post(url, payload, { headers, timeout: 20000 });
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data || error.message;
    console.error(`❌ Erro ao enviar mensagem para ${jid} via Evolution API:`, detail);
    throw new Error(`Evolution API (${url}): ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
  }
}

export async function sendMediaMessage(jid: string, mediaUrl: string, fileName: string, caption?: string) {
  const { baseURL, instance, headers } = getEvolutionConfig();
  const url = `${baseURL}/message/sendMedia/${instance}`;

  let mediaType = 'document';
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) {
    mediaType = 'image';
  } else if (lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv')) {
    mediaType = 'video';
  }

  const payload = {
    number: jid,
    media: mediaUrl,
    mediatype: mediaType,
    fileName: fileName,
    caption: caption || '',
  };

  console.log(`🚀 [Evolution API Call] Disparando POST em ${url} | Instância: "${instance}"`);

  try {
    const response = await axios.post(url, payload, { headers, timeout: 35000 });
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data || error.message;
    console.error(`❌ Erro ao enviar mídia para ${jid} via Evolution API:`, detail);
    throw new Error(`Evolution API (${url}): ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
  }
}

export async function fetchGroupsFromEvolution() {
  const { baseURL, instance, headers } = getEvolutionConfig();
  const url = `${baseURL}/group/fetchAllGroups/${instance}?getParticipants=false`;

  console.log(`🚀 [Evolution API Call] Disparando GET para URL: ${url} | Instância: "${instance}" | Timeout: 45000ms`);

  try {
    const response = await axios.get(url, { headers, timeout: 45000 });
    const data = response.data;

    let groupsList: any[] = [];
    if (Array.isArray(data)) {
      groupsList = data;
    } else if (data && typeof data === 'object') {
      groupsList = data.groups || data.response || data.data || Object.values(data);
    }

    if (Array.isArray(groupsList)) {
      return groupsList
        .map((g: any) => ({
          jid: g.id || g.jid || g.groupJid,
          nome: g.subject || g.name || g.groupName || 'Grupo sem nome',
        }))
        .filter((g: any) => g.jid && typeof g.jid === 'string' && g.jid.includes('@g.us'));
    }

    return [];
  } catch (error: any) {
    const status = error?.response?.status;
    const errorData = error?.response?.data;
    const msg = errorData?.message || errorData?.error || error.message || 'Timeout ou erro de rede';
    
    console.error(`❌ [Evolution API Error] GET ${url} (Status: ${status || 'N/A'}):`, msg);

    throw new Error(`Falha no fetchAllGroups [Instância: "${instance}"] ${status ? `(HTTP ${status})` : ''}: ${typeof errorData === 'object' ? JSON.stringify(errorData) : msg}`);
  }
}
