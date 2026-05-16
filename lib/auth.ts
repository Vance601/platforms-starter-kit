import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  userCompanies,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "owner" | "manager" | "dispatcher" | "driver";
      companyIds: string[];
      activeCompanyId: string | null;
      homeLocationId: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      const companies = await db
        .select({ companyId: userCompanies.companyId })
        .from(userCompanies)
        .where(eq(userCompanies.userId, user.id));

      session.user.id = user.id;
      session.user.role = userRecord?.role ?? "driver";
      session.user.companyIds = companies.map((c) => c.companyId);
      session.user.homeLocationId = userRecord?.homeLocationId ?? null;
      session.user.activeCompanyId = companies[0]?.companyId ?? null;

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});