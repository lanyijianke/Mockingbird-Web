'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function TopNavMobileRankingsMenu() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    return (
        <div ref={containerRef} className="nav-mobile-rankings" data-open={open ? 'true' : 'false'}>
            <button
                type="button"
                className="nav-link nav-mobile-rankings-trigger"
                aria-expanded={open}
                aria-controls="mobile-rankings-menu"
                onClick={() => setOpen((current) => !current)}
            >
                热榜 <i className={`bi bi-chevron-${open ? 'up' : 'down'} nav-dropdown-arrow`} />
            </button>

            <div id="mobile-rankings-menu" className="nav-mobile-rankings-menu">
                <Link href="/rankings/github" className="nav-dropdown-item" onClick={() => setOpen(false)}>
                    <i className="bi bi-github" style={{ color: '#58a6ff' }} />
                    <span>GitHub Trending</span>
                </Link>
                <Link href="/rankings/producthunt" className="nav-dropdown-item" onClick={() => setOpen(false)}>
                    <i className="bi bi-rocket-takeoff" style={{ color: '#ff6154' }} />
                    <span>ProductHunt</span>
                </Link>
                <Link href="/rankings/skills-trending" className="nav-dropdown-item" onClick={() => setOpen(false)}>
                    <i className="bi bi-fire" style={{ color: '#f0883e' }} />
                    <span>Skills Trending</span>
                </Link>
                <Link href="/rankings/skills-hot" className="nav-dropdown-item" onClick={() => setOpen(false)}>
                    <i className="bi bi-lightning-charge" style={{ color: '#a371f7' }} />
                    <span>Skills Hot</span>
                </Link>
            </div>
        </div>
    );
}
