import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Mock Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        name: { label: "Name", type: "text", placeholder: "Draft Master" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        try {
          let user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.name || "Draft Enthusiast",
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.warn("Database connection not ready, signing in with mock user profile.");
          return {
            id: "mock-user-id",
            email: credentials.email,
            name: credentials.name || "Draft Master (Mock)",
          };
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "default-secret-development-key",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
