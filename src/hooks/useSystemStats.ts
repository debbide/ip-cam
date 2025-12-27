import { useState, useEffect } from 'react';

interface SystemStatsData {
    cpu: number;
    memory: {
        used: number;
        total: number;
        usedPercent: number;
    };
    disk: {
        used: number;
        total: number;
        usedPercent: number;
    };
    uptime: number;
}

export function useSystemStats(refreshInterval = 5000) {
    const [stats, setStats] = useState<SystemStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/system-stats');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                setStats(data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch system stats:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchStats();

        // Periodic refresh
        const interval = setInterval(fetchStats, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    return { stats, loading, error };
}
