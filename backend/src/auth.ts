import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { bearer } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { env } from "./env";

// Create Resend client once at startup if key is present
const resend = env.RESEND_API_KEY ? (() => {
  console.log("[Auth] Resend client initialized with API key");
  return new Resend(env.RESEND_API_KEY);
})() : null;

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
      try {
        if (!resend) {
          console.log(`[Auth] No RESEND_API_KEY — skipping password reset email for ${user.email}`);
          return;
        }
        console.log(`[Auth] Sending password reset email to ${user.email} via Resend`);
        const resendResponse = await resend.emails.send({
          from: "Openly <noreply@openlypal.com>",
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
        console.log(`[Auth] Resend full response for password reset email to ${user.email}:`, JSON.stringify(resendResponse));
        if (resendResponse.error) {
          console.error(`[Auth] Resend error sending password reset email to ${user.email}:`, JSON.stringify(resendResponse.error));
        } else {
          console.log(`[Auth] Password reset email sent successfully to ${user.email}, id: ${resendResponse.data?.id}`);
        }
      } catch (err) {
        console.error(`[Auth] Unexpected error sending password reset email to ${user.email}:`, err);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        console.log(`[Auth] Email verification URL for ${user.email}: ${url}`);
        if (!resend) {
          console.log(`[Auth] No RESEND_API_KEY — skipping verification email send for ${user.email}`);
          return;
        }
        console.log(`[Auth] Sending verification email to ${user.email} via Resend`);
        const resendResponse = await resend.emails.send({
          from: "Openly <noreply@openlypal.com>",
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
        console.log(`[Auth] Resend full response for verification email to ${user.email}:`, JSON.stringify(resendResponse));
        if (resendResponse.error) {
          console.error(`[Auth] Resend error sending verification email to ${user.email}:`, JSON.stringify(resendResponse.error));
        } else {
          console.log(`[Auth] Verification email sent successfully to ${user.email}, id: ${resendResponse.data?.id}`);
        }
      } catch (err) {
        console.error(`[Auth] Unexpected error sending verification email to ${user.email}:`, err);
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
