import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';
import type { Logger } from './logger';

/**
 * Pengiriman email bersifat ASINKRON dan kegagalannya TIDAK menggagalkan transaksi
 * (ADR-006). SMTP mati tidak boleh membuat registrasi gagal, akun tetap dibuat dan
 * kegagalan email hanya dicatat di log supaya bisa dikirim ulang operator.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter === null) {
    transporter = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // MailHog tidak memakai TLS maupun autentikasi.
      secure: false,
      ignoreTLS: true,
    });
  }
  return transporter;
}

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Kirim tanpa ditunggu pemanggil. Sengaja mengembalikan void: kalau controller
 * menunggu SMTP, waktu respons registrasi jadi bergantung pada kesehatan mail server.
 */
export function sendMailAsync(payload: MailPayload, log: Logger): void {
  void getTransporter()
    .sendMail({ from: env.MAIL_FROM, ...payload })
    .then(() => {
      log.info('email terkirim', { to: payload.to, subject: payload.subject });
    })
    .catch((error: unknown) => {
      // Isi email (berisi kredensial sementara) TIDAK ikut di-log.
      log.error('email gagal dikirim, transaksi tetap dilanjutkan', {
        to: payload.to,
        subject: payload.subject,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
}
