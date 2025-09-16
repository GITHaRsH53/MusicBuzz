"use client"; // must be a client file

import { SessionProvider } from "next-auth/react";

// Wraps children with NextAuth SessionProvider
export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
