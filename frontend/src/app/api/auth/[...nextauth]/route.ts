import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { decodeAuthJwt, encodeAuthJwt } from "@/lib/auth-jwt";
import { findCredentialUserByEmail } from "@/lib/credential-user-store";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const googleOAuthEnabled = Boolean(googleClientId && googleClientSecret);

const providers: NonNullable<NextAuthOptions["providers"]> = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const email = String(credentials.email).trim().toLowerCase();
      const password = String(credentials.password);
      try {
        const user = await findCredentialUserByEmail(email);

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      } catch (error) {
        console.error("[auth] Credentials lookup failed", error);
        throw new Error("AUTH_UNAVAILABLE");
      }
    },
  }),
];

if (googleOAuthEnabled) {
  providers.unshift(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    })
  );
} else {
  console.warn(
    "[auth] Google OAuth disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in frontend/.env.local"
  );
}

const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  jwt: {
    encode: encodeAuthJwt,
    decode: decodeAuthJwt,
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const id = (token.id ?? token.sub) as string | undefined;
        if (id) session.user.id = id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
