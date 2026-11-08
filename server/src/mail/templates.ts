/**
 * The e-mails the app sends, in the recipient's language (catalogue keys 'server.email.*'):
 *   - password reset: greeting with the first name, the link, the 6-digit code, the expiry and
 *     "if you did not ask for this, ignore this e-mail";
 *   - "your password was changed" notice after a reset;
 *   - the owner's test e-mail from the mail settings card.
 * Each one has a plain-text and a small HTML version (lang/dir of the locale, no images, no
 * external resources). The brand "Your Personal Diary" is never translated.
 */
import { APP_NAME } from '@shared/constants';
import { formatTimestamp, localeDef, t, type Locale } from '@shared/i18n';
import type { MailContent } from './mime';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

type Block = { kind: 'p'; text: string } | { kind: 'link'; href: string; label: string } | { kind: 'code'; text: string } | { kind: 'small'; text: string };

/** Renders blocks as plain text and as HTML in the locale's direction. */
function render(locale: Locale, to: string, subject: string, blocks: Block[]): MailContent {
  const text: string[] = [];
  const html: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'p':
      case 'small':
        text.push(b.text);
        html.push(`<p style="margin:0 0 14px;${b.kind === 'small' ? 'font-size:13px;color:#555;' : ''}">${escapeHtml(b.text)}</p>`);
        break;
      case 'link':
        text.push(b.href);
        html.push(
          `<p style="margin:0 0 14px;"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:10px 18px;background:#2f5d8a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${escapeHtml(b.label)}</a></p>` +
            `<p style="margin:0 0 14px;font-size:13px;color:#555;direction:ltr;text-align:left;word-break:break-all;">${escapeHtml(b.href)}</p>`,
        );
        break;
      case 'code':
        text.push(b.text);
        html.push(
          `<p style="margin:0 0 14px;font-family:Consolas,'Courier New',monospace;font-size:26px;letter-spacing:6px;font-weight:bold;direction:ltr;">${escapeHtml(b.text)}</p>`,
        );
        break;
    }
  }
  text.push('', APP_NAME);
  const { dir } = localeDef(locale);
  const page =
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:24px;background:#f6f6f4;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">` +
    `<div dir="${dir}" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">` +
    html.join('') +
    `<p style="margin:24px 0 0;font-weight:bold;">${escapeHtml(APP_NAME)}</p></div></body></html>`;
  return { to, subject, text: text.join('\n\n').replace(/\n\n\n+/g, '\n\n') + '\n', html: page };
}

export interface ResetEmailInput {
  to: string;
  firstName: string;
  username: string;
  /** `<base>/#/reset-password?token=<token>` */
  link: string;
  code: string;
  minutes: number;
  /** True when the link points at this computer (http://127.0.0.1:<port>) - it works only there. */
  localLink: boolean;
}

/** The password-reset e-mail. */
export function resetEmail(locale: Locale, input: ResetEmailInput): MailContent {
  const tr = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  const blocks: Block[] = [
    { kind: 'p', text: tr('server.email.greeting', { firstName: input.firstName }) },
    { kind: 'p', text: tr('server.email.reset.intro', { username: input.username }) },
    { kind: 'p', text: tr('server.email.reset.linkIntro') },
    { kind: 'link', href: input.link, label: tr('server.email.reset.button') },
  ];
  if (input.localLink) blocks.push({ kind: 'small', text: tr('server.email.reset.localLink') });
  blocks.push(
    { kind: 'p', text: tr('server.email.reset.codeIntro') },
    { kind: 'code', text: input.code },
    { kind: 'p', text: tr('server.email.reset.expiry', { minutes: input.minutes }) },
    { kind: 'p', text: tr('server.email.reset.diaryKept') },
    { kind: 'p', text: tr('server.email.reset.ignore') },
    { kind: 'small', text: tr('server.email.footer') },
  );
  return render(locale, input.to, tr('server.email.reset.subject'), blocks);
}

/**
 * The answer to a reset request for an account that has no recovery key yet (registered before
 * password reset existed, not signed in since): no link and no code - its diary cannot be opened
 * without the password - but the reason and the way out ("sign in once"), so the owner of the
 * mailbox does not wait for a link. Sent only to the account's own address, like a reset e-mail,
 * so the requester learns nothing.
 */
export function resetUnavailableEmail(locale: Locale, input: { to: string; firstName: string; username: string }): MailContent {
  const tr = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  return render(locale, input.to, tr('server.email.reset.subject'), [
    { kind: 'p', text: tr('server.email.greeting', { firstName: input.firstName }) },
    { kind: 'p', text: tr('server.email.reset.intro', { username: input.username }) },
    { kind: 'p', text: tr('server.reset.unavailable') },
    { kind: 'p', text: tr('server.email.reset.ignore') },
    { kind: 'small', text: tr('server.email.footer') },
  ]);
}

export interface ChangedEmailInput {
  to: string;
  firstName: string;
  username: string;
  /** ISO time of the change. */
  at: string;
}

/** "Your password was changed" notice, sent after a reset. */
export function passwordChangedEmail(locale: Locale, input: ChangedEmailInput): MailContent {
  const tr = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  return render(locale, input.to, tr('server.email.changed.subject'), [
    { kind: 'p', text: tr('server.email.greeting', { firstName: input.firstName }) },
    { kind: 'p', text: tr('server.email.changed.body', { username: input.username, when: formatTimestamp(locale, input.at) }) },
    { kind: 'p', text: tr('server.email.changed.signedOut') },
    { kind: 'p', text: tr('server.email.changed.notYou') },
    { kind: 'small', text: tr('server.email.footer') },
  ]);
}

/**
 * "The e-mail address of your account was changed" notice, sent to the PREVIOUS address after an
 * e-mail change (the new address is not named, so a mistyped one leaks nothing).
 */
export function emailChangedEmail(locale: Locale, input: ChangedEmailInput): MailContent {
  const tr = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  return render(locale, input.to, tr('server.email.emailChanged.subject'), [
    { kind: 'p', text: tr('server.email.greeting', { firstName: input.firstName }) },
    { kind: 'p', text: tr('server.email.emailChanged.body', { username: input.username, when: formatTimestamp(locale, input.at) }) },
    { kind: 'p', text: tr('server.email.emailChanged.notYou') },
    { kind: 'small', text: tr('server.email.footer') },
  ]);
}

/** The owner's test e-mail (Settings > "E-mail for password reset" > "Send test e-mail"). */
export function testEmail(locale: Locale, input: { to: string; firstName: string; from: string }): MailContent {
  const tr = (key: string, params?: Record<string, string | number>) => t(locale, key, params);
  return render(locale, input.to, tr('server.email.test.subject'), [
    { kind: 'p', text: tr('server.email.greeting', { firstName: input.firstName }) },
    { kind: 'p', text: tr('server.email.test.body', { from: input.from }) },
    { kind: 'small', text: tr('server.email.footer') },
  ]);
}
