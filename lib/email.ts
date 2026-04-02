import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'Ventoux Training <noreply@ventoux.app>'
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3002'

export async function sendVerificationEmail(email: string, token: string, name: string) {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Confirmez votre compte Ventoux Training',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #FF6B35; font-size: 24px; margin-bottom: 8px;">Ventoux Training</h1>
        <p>Bonjour ${name},</p>
        <p>Bienvenue sur Ventoux Training ! Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #FF6B35; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Vérifier mon email
        </a>
        <p style="color: #888; font-size: 13px;">Ou copiez ce lien : ${verifyUrl}</p>
        <p style="color: #888; font-size: 13px;">Ce lien est valable 24 heures.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string, name: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #FF6B35; font-size: 24px; margin-bottom: 8px;">Ventoux Training</h1>
        <p>Bonjour ${name},</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #FF6B35; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color: #888; font-size: 13px;">Ou copiez ce lien : ${resetUrl}</p>
        <p style="color: #888; font-size: 13px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      </div>
    `,
  })
}

export function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  for (const b of bytes) token += chars[b % chars.length]
  return token
}
