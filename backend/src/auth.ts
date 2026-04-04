import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { bearer } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { env } from "./env";

// Create Resend client (lazy - only if key is present)
const getResend = () => env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BACKEND_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const resend = getResend();
      if (!resend) {
        console.log(`[Auth] No RESEND_API_KEY — skipping password reset email for ${user.email}`);
        return;
      }
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Reset your password",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>Hi ${user.name || user.email},</p>
            <p>We received a request to reset your password. Click the button below to choose a new one.</p>
            <a href="${url}" style="display: inline-block; background: #00CF35; color: #001935; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Reset Password</a>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
      if (error) {
        console.error(`[Auth] Failed to send password reset email to ${user.email}:`, error);
      } else {
        console.log(`[Auth] Password reset email sent to ${user.email}`);
      }
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const resend = getResend();
      if (!resend) {
        console.log(`[Auth] Email verification URL for ${user.email}: ${url}`);
        return;
      }
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Verify your email",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify your email</h2>
            <p>Hi ${user.name || user.email},</p>
            <p>Thanks for signing up! Please verify your email address to get started.</p>
            <a href="${url}" style="display: inline-block; background: #00CF35; color: #001935; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Verify Email</a>
            <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
      if (error) {
        console.error(`[Auth] Failed to send verification email to ${user.email}:`, error);
      } else {
        console.log(`[Auth] Verification email sent to ${user.email} from ${env.RESEND_FROM_EMAIL}`);
      }
    },
    autoSignInAfterVerification: true,
  },
  trustedOrigins: [
    "vibecode://*/*",
    "exp://*/*",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.dev.vibecode.run",
    "https://*.vibecode.run",
    "https://*.vibecodeapp.com",
    "https://*.vibecode.dev",
    "https://vibecode.dev",
  ],
  plugins: [expo(), bearer()],
  advanced: {
    trustedProxyHeaders: true,
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },
});
