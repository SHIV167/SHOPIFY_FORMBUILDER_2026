type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER || 'console';

  if (provider === 'resend') return sendWithResend(payload);
  if (provider === 'sendgrid') return sendWithSendGrid(payload);

  // console fallback
  console.log('--- EMAIL (console) ---');
  console.log(`To: ${payload.to} | Subject: ${payload.subject}`);
  return { success: true };
}

async function sendWithResend(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text, reply_to: payload.replyTo }),
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function sendWithSendGrid(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { success: false, error: 'SENDGRID_API_KEY or EMAIL_FROM not configured' };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: from },
        reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
        subject: payload.subject,
        content: [
          { type: 'text/plain', value: payload.text || '' },
          { type: 'text/html', value: payload.html },
        ],
      }),
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
