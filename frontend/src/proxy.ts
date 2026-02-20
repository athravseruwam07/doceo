import { withAuth } from "next-auth/middleware";
import { decodeAuthJwt } from "@/lib/auth-jwt";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
  jwt: {
    decode: decodeAuthJwt,
  },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: ["/app/:path*", "/lesson/:path*", "/history/:path*", "/exam-cram/:path*"],
};
