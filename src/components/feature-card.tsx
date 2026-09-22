import type { FEATURES } from '@/lib/site'

type Feature = (typeof FEATURES)[number]

/** One tile of the features grid. */
export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-violet-400/40 hover:bg-white/[0.05]">
      <span className="font-mono text-xs tracking-widest text-violet-400">{feature.id}</span>
      <h3 className="mt-2 text-lg font-semibold text-white">{feature.title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{feature.description}</p>
    </li>
  )
}
