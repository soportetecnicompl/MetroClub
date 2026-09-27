import { Injectable } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 1032;
const HEIGHT = 336;
const NAVY = '#09142e';
const GOLD = '#fca101';
const TRACK = '#2a3660';

export interface HeroImageInput {
  stamps: number;
  totalStamps: number | null;
  rewardName: string | null;
}

/**
 * Dibuja el "heroImage" del loyaltyObject: la barra de progreso de sellos que se ve
 * en la vista principal del pase de Google Wallet (RF-05). La Wallet API no soporta
 * gráficos personalizados por texto, así que este es el único punto de extensión
 * para replicar el mockup de diseño (segmentos + próximo premio).
 */
@Injectable()
export class HeroImageService {
  render({ stamps, totalStamps, rewardName }: HeroImageInput): Buffer {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const title = rewardName ?? '¡Ya tienes premios listos!';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 44px sans-serif';
    ctx.fillText(title, 48, 96);

    const total = totalStamps && totalStamps > 0 ? totalStamps : Math.max(stamps, 1);
    const filled = Math.min(stamps, total);

    const barY = 150;
    const barHeight = 40;
    const gap = 20;
    const barWidth = (WIDTH - 48 * 2 - gap * (total - 1)) / total;

    for (let i = 0; i < total; i += 1) {
      const x = 48 + i * (barWidth + gap);
      ctx.fillStyle = i < filled ? GOLD : TRACK;
      this.roundedRect(ctx, x, barY, barWidth, barHeight, barHeight / 2);
      ctx.fill();
    }

    ctx.fillStyle = '#c7cede';
    ctx.font = '500 32px sans-serif';
    ctx.fillText(`${stamps} de ${total} sellos`, 48, barY + barHeight + 56);

    return canvas.toBuffer('image/png');
  }

  private roundedRect(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}
