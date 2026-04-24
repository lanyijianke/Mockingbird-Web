import Link from 'next/link';
import { buildRankingsLayoutMetadata } from '@/lib/seo/metadata';

export const metadata = buildRankingsLayoutMetadata();

const tabs = [
    { href: '/rankings/github', icon: 'bi-github', label: 'GitHub Trending', color: '#58a6ff' },
    { href: '/rankings/producthunt', icon: 'bi-rocket-takeoff', label: 'ProductHunt', color: '#ff6154' },
    { href: '/rankings/skills-trending', icon: 'bi-fire', label: 'Skills Trending', color: '#f0883e' },
    { href: '/rankings/skills-hot', icon: 'bi-lightning-charge', label: 'Skills Hot', color: '#e040fb' },
];

export default function RankingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Tab navigation */}
            <div className="ranking-tabs">
                {tabs.map(tab => (
                    <Link key={tab.href} href={tab.href} className="ranking-tab">
                        <i className={`bi ${tab.icon}`} style={{ color: tab.color }} />
                        <span>{tab.label}</span>
                    </Link>
                ))}
            </div>

            {children}
        </>
    );
}
