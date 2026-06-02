import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db/prisma"
import { compare } from "bcrypt"
import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limiter"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours (session expiration)
    updateAge: 60 * 60, // 1 hour (refresh session every hour)
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase()

        // Rate limiting by email to prevent account enumeration
        const rateLimitResult = checkRateLimit(
          `auth:${email}`,
          RATE_LIMIT_CONFIGS.login
        )

        if (!rateLimitResult.success) {
          console.warn(`[SECURITY] Rate limit exceeded for auth: ${email}`)
          throw new Error("TooManyRequests")
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) {
          // Constant-time comparison to prevent timing attacks
          await compare(
            credentials.password as string,
            "$2b$12$invalidhashtopreventtimingattacks"
          )
          return null
        }

        if (!user.isActive) {
          console.warn(`[SECURITY] Login attempt by deactivated user: ${email}`)
          // Reset rate limit so it doesn't accumulate while account is disabled —
          // when the account is re-enabled the user can log in immediately.
          resetRateLimit(`auth:${email}`)
          throw new Error("AccountDisabled")
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          console.warn(`[SECURITY] Invalid password attempt for: ${email}`)
          return null
        }

        // Reset rate limit on successful authentication
        resetRateLimit(`auth:${email}`)

        console.info(`[AUTH] User authenticated: ${email}`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.iat = Math.floor(Date.now() / 1000)
        token.lastActiveCheck = Math.floor(Date.now() / 1000)
      }

      // Check absolute expiration (24h max)
      const tokenAge = Math.floor(Date.now() / 1000) - (token.iat as number || 0)
      if (tokenAge > 24 * 60 * 60) {
        console.warn(`[SECURITY] Token expired for user: ${token.email}`)
        return { ...token, expired: true }
      }

      // Every 5 minutes, verify the user is still active in DB
      const now = Math.floor(Date.now() / 1000)
      const lastCheck = (token.lastActiveCheck as number) || 0
      if (!user && token.id && now - lastCheck > 5 * 60) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true },
        })
        if (!dbUser?.isActive) {
          console.warn(`[SECURITY] Session terminated for deactivated user: ${token.email}`)
          return { ...token, expired: true }
        }
        token.lastActiveCheck = now
      }

      return token
    },
    async session({ session, token }) {
      if (token.expired) {
        // Force re-authentication
        return { ...session, user: undefined, expires: new Date(0).toISOString() }
      }

      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string | null
        session.user.image = token.picture as string | null
      }
      return session
    },
    async signIn({ user, account }) {
      if (!user?.email) {
        return false
      }
      return true
    },
  },
  events: {
    async signIn({ user }) {
      console.info(`[AUTH] Sign in event: ${user.email}`)
    },
    async signOut(message) {
      if ('token' in message) {
        console.info(`[AUTH] Sign out event: ${message.token?.email}`)
      }
    },
  },
})
