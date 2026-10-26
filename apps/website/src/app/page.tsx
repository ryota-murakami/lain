import Image from 'next/image'

import { FeatureCard } from '@/components/feature-card'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { FEATURES, SITE } from '@/lib/site'

export default function Home() {
  return (
    <div id="top" className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.35),transparent_60%)]" />
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-24 pb-16 text-center">
            <Image
              src="/icon.png"
              alt="Lain app icon"
              width={96}
              height={96}
              priority
              className="rounded-[22px] shadow-2xl shadow-violet-500/30"
            />
            <p className="mt-8 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium tracking-wide text-violet-200 uppercase">
              Pre-alpha · macOS
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              {SITE.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              A native macOS client for power users. Search in context, browse in four views,
              organize by drag &amp; drop and never leave the keyboard.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <a
                href={SITE.downloadUrl}
                className="rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-colors hover:bg-violet-400"
              >
                Download for macOS
              </a>
              <a
                href={SITE.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/40 hover:text-white"
              >
                View on GitHub
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">{SITE.requirements}</p>
          </div>

          <div className="mx-auto w-full max-w-6xl px-6 pb-24">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141018] shadow-2xl shadow-black/60">
              <Image
                src="/screenshots/lain-dark.png"
                alt="Lain showing the Development collection in list view with the detail panel open"
                width={2880}
                height={1800}
                priority
                sizes="(min-width: 1152px) 1104px, 100vw"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for 1,000+ bookmarks
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
            Everything the Raindrop.io web app does not do for power organizers, research collectors
            and developers.
          </p>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </ul>
        </section>

        {/* Screenshots */}
        <section id="screenshots" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Light or dark, your call
          </h2>
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <figure>
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-xl shadow-black/50">
                <Image
                  src="/screenshots/lain-light.png"
                  alt="Lain in light mode"
                  width={2880}
                  height={1800}
                  sizes="(min-width: 1024px) 540px, 100vw"
                />
              </div>
              <figcaption className="mt-3 text-center text-sm text-zinc-500">
                Light mode · list view with the detail panel
              </figcaption>
            </figure>
            <figure>
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-xl shadow-black/50">
                <Image
                  src="/screenshots/lain-dark-grid.png"
                  alt="Lain in dark mode showing the grid view"
                  width={2880}
                  height={1800}
                  sizes="(min-width: 1024px) 540px, 100vw"
                />
              </div>
              <figcaption className="mt-3 text-center text-sm text-zinc-500">
                Dark mode · grid view
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Requirements */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold text-white">Requirements</h2>
            <p className="mt-3 text-zinc-300">{SITE.requirements}</p>
            <p className="mt-2 text-sm text-zinc-500">
              Lain is open source and in pre-alpha: builds are early, unsigned and change quickly.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
