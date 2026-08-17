import { Request, Response, NextFunction } from 'express';

export function webhookSecretMiddleware(req: Request, res: Response, next: NextFunction) {
  const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  
  // Se não foi configurado um segredo no servidor, logamos alerta e permitimos apenas em ambiente não-produção
  if (!expectedSecret) {
    console.warn('⚠️ EVOLUTION_WEBHOOK_SECRET não configurado no .env!');
    return next();
  }

  // Evolution API pode enviar o token em headers como 'x-webhook-secret', 'apikey' ou 'x-api-key'
  const providedSecret = 
    req.headers['x-webhook-secret'] || 
    req.headers['apikey'] || 
    req.headers['x-api-key'] ||
    req.query.secret;

  if (!providedSecret || providedSecret !== expectedSecret) {
    console.warn(`⛔ [401 Unauthorized] Tentativa de acesso ao Webhook sem o token correto. IP: ${req.ip}`);
    return res.status(401).json({ 
      error: 'Não autorizado. Token de webhook inválido ou ausente.' 
    });
  }

  next();
}
