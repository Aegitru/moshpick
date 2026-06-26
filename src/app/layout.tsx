import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/AuthProvider"
import Navigation from "@/components/Navigation"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "MoshPick — Festival Planner",
  description: "Rate artists and plan your festival days",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f0f0f] text-gray-100">
        <AuthProvider>
          <Navigation />
          <main className="flex-1">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
