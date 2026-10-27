import type { Locale } from '@metrobet/contracts';

export type NotificationChannel = 'email' | 'sms';
export type NotificationTemplate = 'verify_contact' | 'reset_password';

export type Notification = {
  channel: NotificationChannel;
  to: string;
  template: NotificationTemplate;
  locale: Locale;
  params: { code: string };
};

/**
 * Outbound messages port. The dev adapter logs and keeps an in-memory outbox; production
 * binds email (e.g. SES/Postmark) and SMS (e.g. a Georgian SMS gateway) adapters.
 */
export abstract class Notifier {
  abstract send(notification: Notification): Promise<void>;
}

const TEXTS: Record<NotificationTemplate, Record<Locale, (code: string) => string>> = {
  verify_contact: {
    ka: (code) => `Metrobet: თქვენი დადასტურების კოდია ${code}. მოქმედებს 10 წუთი.`,
    en: (code) => `Metrobet: your verification code is ${code}. It expires in 10 minutes.`,
    ru: (code) => `Metrobet: ваш код подтверждения ${code}. Действует 10 минут.`,
  },
  reset_password: {
    ka: (code) => `Metrobet: პაროლის აღდგენის კოდია ${code}. თუ ეს თქვენ არ ხართ, უგულებელყავით.`,
    en: (code) =>
      `Metrobet: your password reset code is ${code}. If this wasn't you, ignore this message.`,
    ru: (code) =>
      `Metrobet: код для сброса пароля ${code}. Если это были не вы, проигнорируйте сообщение.`,
  },
};

export const renderNotification = ({ template, locale, params }: Notification) =>
  TEXTS[template][locale](params.code);
