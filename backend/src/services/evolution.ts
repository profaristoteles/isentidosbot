import axios from 'axios';

const getEvolutionConfig = () => {
  const baseURL = process.env.EVOLUTION_API_URL || 'http://204.168.132.246:8080';
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
    delay: 1200, // pequeno delay natural
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error: any) {
    console.error(`❌ Erro ao enviar mensagem para ${jid} via Evolution API:`, error?.response?.data || error.message);
    throw new Error(error?.response?.data?.message || 'Falha ao comunicação com a Evolution API');
  }
}

export async function sendMediaMessage(jid: string, mediaUrl: string, fileName: string, caption?: string) {
  const { baseURL, instance, headers } = getEvolutionConfig();
  const url = `${baseURL}/message/sendMedia/${instance}`;

  // Determinar mediatype básico (image, document, video, audio)
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
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error: any) {
    console.error(`❌ Erro ao enviar mídia para ${jid} via Evolution API:`, error?.response?.data || error.message);
    throw new Error(error?.response?.data?.message || 'Falha ao enviar arquivo via Evolution API');
  }
}

export async function fetchGroupsFromEvolution() {
  const { baseURL, instance, headers } = getEvolutionConfig();
  const url = `${baseURL}/group/fetchAllGroups/${instance}?getParticipants=false`;

  try {
    const response = await axios.get(url, { headers });
    const data = response.data;

    // Normalizar formato de retorno da Evolution API (Array ou Objeto)
    let groupsList: any[] = [];
    if (Array.isArray(data)) {
      groupsList = data;
    } else if (data && typeof data === 'object') {
      groupsList = data.groups || data.response || Object.values(data);
    }

    return groupsList.map((g: any) => ({
      jid: g.id || g.jid || g.groupJid,
      nome: g.subject || g.name || g.groupName || 'Grupo sem nome',
    }));
  } catch (error: any) {
    console.error('❌ Erro ao buscar grupos na Evolution API:', error?.response?.data || error.message);
    return [];
  }
}
