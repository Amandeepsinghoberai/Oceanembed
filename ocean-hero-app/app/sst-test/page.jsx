"use client";
import { useEffect, useState } from 'react';
import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';

export default function TestPage() {
    const [log, setLog] = useState(["Running test..."]);
    
    useEffect(() => {
        async function runTest() {
            try {
                await RealSSTDataProvider.load();
                const dates = RealSSTDataProvider.getAvailableDates();
                const info = RealSSTDataProvider.getGridInfo();
                const sstIn0 = RealSSTDataProvider.getSST(15.42, 63.18, 0);
                const sstIn1 = RealSSTDataProvider.getSST(15.42, 63.18, 1);
                const sstIn2 = RealSSTDataProvider.getSST(15.42, 63.18, 2);
                
                setLog([
                    "Available dates:",
                    dates.join("\n"),
                    "",
                    "SST at 15.42°N, 63.18°E:",
                    `index 0 -> ${sstIn0} °C -> ${dates[0] || "N/A"}`,
                    `index 1 -> ${sstIn1} °C -> ${dates[1] || "N/A"}`,
                    `index 2 -> ${sstIn2} °C -> ${dates[2] || "N/A"}`
                ]);
            } catch (e) {
                setLog(["Error: " + e.message]);
            }
        }
        runTest();
    }, []);
    
    return (
        <div style={{ padding: '2rem', color: '#fff', background: '#000', fontFamily: 'monospace' }}>
            <h1>RealSSTDataProvider Test</h1>
            <pre id="test-output">{log.join('\n')}</pre>
        </div>
    );
}
