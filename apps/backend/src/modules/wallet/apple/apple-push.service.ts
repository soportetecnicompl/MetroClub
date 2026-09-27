import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http2 from 'node:http2';
import * as fs from 'node:fs';
import * as jwt from 'jsonwebtoken';

const APNS_HOST = 'https://api.push.apple.com';
/** El token JWT de proveedor de APNs se reutiliza hasta 55 min (Apple lo invalida a la hora). */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * Envía el push "silencioso" que le dice a un dispositivo iOS que su pass
 * cambió, para que vuelva a pedirlo al web service (RF-05). Usa autenticación
 * por token (.p8) en vez de certificado, como recomienda Apple.
 * Requiere APNS_KEY_ID, APNS_TEAM_ID y APNS_AUTH_KEY_PATH — ver
 * docs/wallet-integration.md.
 */
@Injectable()
export class ApplePushService {
  private readonly logger = new Logger(ApplePushService.name);
  private cachedToken: { value: string; issuedAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('APNS_KEY_ID') &&
        this.config.get<string>('APNS_TEAM_ID') &&
        this.config.get<string>('APNS_AUTH_KEY_PATH'),
    );
  }

  private getProviderToken(): string {
    if (this.cachedToken && Date.now() - this.cachedToken.issuedAt < TOKEN_TTL_MS) {
      return this.cachedToken.value;
    }

    const keyId = this.config.getOrThrow<string>('APNS_KEY_ID');
    const teamId = this.config.getOrThrow<string>('APNS_TEAM_ID');
    const authKeyPath = this.config.getOrThrow<string>('APNS_AUTH_KEY_PATH');
    const privateKey = fs.readFileSync(authKeyPath, 'utf8');

    const token = jwt.sign({ iss: teamId, iat: Math.floor(Date.now() / 1000) }, privateKey, {
      algorithm: 'ES256',
      keyid: keyId,
    });

    this.cachedToken = { value: token, issuedAt: Date.now() };
    return token;
  }

  /** Envía un push vacío (`{}`) al dispositivo para que refresque el pass. */
  async notifyDevice(pushToken: string, passTypeIdentifier: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('APNs no está configurado (APNS_KEY_ID/APNS_TEAM_ID/APNS_AUTH_KEY_PATH) — push omitido.');
      return;
    }

    const client = http2.connect(APNS_HOST);
    try {
      await new Promise<void>((resolve, reject) => {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${pushToken}`,
          authorization: `bearer ${this.getProviderToken()}`,
          'apns-topic': passTypeIdentifier,
          'apns-priority': '10',
        });

        let responseStatus = 0;
        req.on('response', (headers) => {
          responseStatus = Number(headers[':status']);
        });
        req.on('end', () => {
          if (responseStatus >= 200 && responseStatus < 300) {
            resolve();
          } else {
            reject(new Error(`APNs respondió ${responseStatus} para el token ${pushToken}`));
          }
        });
        req.on('error', reject);
        req.end(JSON.stringify({}));
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el push de Apple Wallet: ${(error as Error).message}`);
    } finally {
      client.close();
    }
  }
}
