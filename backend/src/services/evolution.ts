import axios from 'axios';

const getEvolutionConfig = () => {
  const baseURL = (process.env.EVOLUTION_API_URL || 'http://204.168.132.246:8080').replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  const instance = process.env.EVOLUTION_INSTANCE || 'isentidos';

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

  try {
    const response = await axios.post(url, payload, { headers, timeout: 15000 });
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

  try {
    const response = await axios.post(url, payload, { headers, timeout: 25000 });
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data || error.message;
    console.error(`❌ Erro ao enviar mídia para ${jid} via Evolution API:`, detail);
    throw new Error(`Evolution API (${url}): ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
  }
}

export async function fetchGroupsFromEvolution() {
  const { baseURL, instance, headers } = getEvolutionConfig();
  
  // Tentar endpoints conhecidos da Evolution API v2
  const endpoints = [
    `${baseURL}/group/fetchAllGroups/${instance}?getParticipants=false`,
    `${baseURL}/group/findGroupInfos/${instance}`,
  ];

  let lastError: any = null;

  for (const url of endpoints) {
    try {
      console.log(`🔍 [Evolution API] Tentando buscar grupos em ${url}...`);
      const response = await axios.get(url, { headers, timeout: 15000 });
      const data = response.data;

      let groupsList: any[] = [];
      if (Array.isArray(data)) {
        groupsList = data;
      } else if (data && typeof data === 'object') {
        groupsList = data.groups || data.response || data.data || Object.values(data);
      }

      if (Array.isArray(groupsList) && groupsList.length > 0) {
        return groupsList.map((g: any) => ({
          jid: g.id || g.jid || g.groupJid,
          nome: g.subject || g.name || g.groupName || 'Grupo sem nome',
        })).filter(g => g.jid && g.jid.includes('@g.us'));
      }
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error.message;
      console.warn(`⚠️ [Evolution API] Falha no endpoint ${url} (Status ${status}): ${msg}`);
    }
  }

  const errMsg = lastError?.response?.data?.message 
    || lastError?.response?.data?.error 
    || lastError?.message 
    || 'Não foi possível conectar à Evolution API';

  throw new Error(`URL (${baseURL}) / Instância (${instance}): ${errMsg}`);
}
