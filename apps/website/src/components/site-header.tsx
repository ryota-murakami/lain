import Image from 'next/image'

import { SITE } from '@/lib/site'

/** Top bar: logo, section links and the GitHub link. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0713]/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold">
          <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md" />
          {SITE.name}
        </a>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#screenshots" className="transition-colors hover:text-white">
            Screenshots
          </a>
          <a
            href={SITE.repositoryUrl}
            className="transition-colors hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}
