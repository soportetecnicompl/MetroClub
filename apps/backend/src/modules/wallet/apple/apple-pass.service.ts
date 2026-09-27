import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PKPass } from 'passkit-generator';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client, WalletPass } from '@prisma/client';

const MODEL_PATH = path.join(__dirname, 'model.pass');

export interface ApplePassInput {
  client: Pick<Client, 'id' | 'name' | 'stamps' | 'points'>;
  walletPass: Pick<WalletPass, 'serialNumber' | 'authToken'>;
}

/**
 * Genera el archivo `.pkpass` real (firmado) de la tarjeta MetroClub usando
 * `passkit-generator`. Requiere un Pass Type ID de Apple Developer, su
 * certificado (+ llave privada) y el certificado WWDR de Apple — ver
 * docs/wallet-integration.md.
 */
@Injectable()
export class ApplePassService {
  private readonly logger = new Logger(ApplePassService.name);

  constructor(private readonly config: ConfigService) {}

  /** true solo si las credenciales de Apple están configuradas. */
  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('APPLE_PASS_TYPE_IDENTIFIER') &&
        this.config.get<string>('APPLE_TEAM_IDENTIFIER') &&
        this.config.get<string>('APPLE_PASS_CERT_PATH') &&
        this.config.get<string>('APPLE_PASS_KEY_PATH') &&
        this.config.get<string>('APPLE_PASS_CERT_PASSWORD') &&
        this.config.get<string>('APPLE_WWDR_CERT_PATH'),
    );
  }

  async generate(input: ApplePassInput): Promise<Buffer | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Apple Wallet no está configurado (faltan APPLE_PASS_* / APPLE_WWDR_CERT_PATH) — se omite la generación del .pkpass.',
      );
      return null;
    }

    const passTypeIdentifier = this.config.getOrThrow<string>('APPLE_PASS_TYPE_IDENTIFIER');
    const teamIdentifier = this.config.getOrThrow<string>('APPLE_TEAM_IDENTIFIER');
    const certPath = this.config.getOrThrow<string>('APPLE_PASS_CERT_PATH');
    const keyPath = this.config.getOrThrow<string>('APPLE_PASS_KEY_PATH');
    const certPassword = this.config.getOrThrow<string>('APPLE_PASS_CERT_PASSWORD');
    const wwdrPath = this.config.getOrThrow<string>('APPLE_WWDR_CERT_PATH');
    const webServiceBaseUrl = this.config.get<string>('PUBLIC_API_BASE_URL', 'http://localhost:3000/api');

    const pass = await PKPass.from(
      {
        model: MODEL_PATH,
        certificates: {
          wwdr: fs.readFileSync(wwdrPath),
          signerCert: fs.readFileSync(certPath),
          signerKey: fs.readFileSync(keyPath),
          signerKeyPassphrase: certPassword,
        },
      },
      {
        serialNumber: input.walletPass.serialNumber,
        description: 'Tarjeta MetroClub',
        organizationName: 'Metrocinemas',
        passTypeIdentifier,
        teamIdentifier,
        authenticationToken: input.walletPass.authToken,
        webServiceURL: `${webServiceBaseUrl}/wallet/apple`,
      },
    );

    pass.type = 'storeCard';
    pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: input.client.id, messageEncoding: 'iso-8859-1' });
    pass.headerFields.push({ key: 'points', label: 'Puntos', value: input.client.points });
    pass.primaryFields.push({ key: 'stamps', label: 'Sellos', value: `${input.client.stamps}` });
    pass.secondaryFields.push({ key: 'name', label: 'Cliente', value: input.client.name });
    pass.backFields.push({
      key: 'terms',
      label: 'Metrocinemas',
      value: 'Tarjeta de fidelización MetroClub. Consulta reglas y premios en tu complejo.',
    });

    return pass.getAsBuffer();
  }
}
