import { SITE } from '@/lib/site'

/** Footer with the source, the studio and the current year. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 sm:flex-row">
        <p>
          © {new Date().getFullYear()}{' '}
          <a
            href={SITE.laststanceUrl}
            className="hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Laststance.io
          </a>
        </p>
        <nav className="flex items-center gap-6">
          <a
            href={SITE.repositoryUrl}
            className="hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href={`${SITE.repositoryUrl}/releases`}
            className="hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Releases
          </a>
          <a href={SITE.raindropUrl} className="hover:text-white" target="_blank" rel="noreferrer">
            Raindrop.io
          </a>
        </nav>
      </div>
    </footer>
  )
}
