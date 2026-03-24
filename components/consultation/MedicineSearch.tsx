"use client";
import React, { useState, useEffect } from "react";

export default function MedicineSearch({ onSelect }: { onSelect: (product: any) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q) return setResults([]);
      setLoading(true);
      try {
        const res = await fetch(`/api/pharmacy/masters/products?search=${encodeURIComponent(q)}&limit=10`);
        const json = await res.json();
        "use client";
        import React, { useState, useEffect, useRef } from "react";

        type Suggestion = {
          id: string;
          brandName: string;
          genericName?: string | null;
          strength?: string | null;
          defaultDosage?: string | null;
        };

        export default function MedicineSearch({ onSelect, onAdd }: { onSelect: (s: Suggestion) => void; onAdd: (name: string) => void; }) {
          const [query, setQuery] = useState("");
          const [results, setResults] = useState<Suggestion[]>([]);
          const [loading, setLoading] = useState(false);
          const cache = useRef(new Map<string, Suggestion[]>());
          const timerRef = useRef<number | null>(null);

          useEffect(() => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            if (!query || query.length < 2) {
              setResults([]);
              return;
            }

            if (cache.current.has(query)) {
              setResults(cache.current.get(query) || []);
              return;
            }

            timerRef.current = window.setTimeout(async () => {
              setLoading(true);
              try {
                const res = await fetch(`/api/consultation/medicines/search?q=${encodeURIComponent(query)}&limit=10`);
                const payload = await res.json();
                if (payload?.success) {
                  cache.current.set(query, payload.data || []);
                  setResults(payload.data || []);
                }
              } catch (e) {
                console.error('Medicine search failed', e);
              } finally {
                setLoading(false);
              }
            }, 300);

            return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
          }, [query]);

          return (
            <div>
              <input placeholder="Search medicine (min 2 chars)" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full" />
              <div className="bg-white shadow rounded max-h-48 overflow-auto">
                {loading && <div className="p-2">Loading</div>}
                {results.map((r) => (
                  <div key={r.id} className="p-2 border-b flex justify-between items-center">
                    <div>
                      <div className="font-medium">{r.brandName}</div>
                      <div className="text-sm text-muted">{r.genericName || ''} {r.strength || ''}</div>
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => onSelect(r)} className="btn">✓ Select</button>
                      <button onClick={() => onAdd(r.brandName)} className="btn-outline">+ Add</button>
                    </div>
                  </div>
                ))}
                {!loading && results.length === 0 && query.length >= 2 && <div className="p-2">No results</div>}
              </div>
            </div>
          );
        }
        setLoading(false);
