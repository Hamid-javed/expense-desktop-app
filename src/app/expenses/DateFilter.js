"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/Button";

export function DateFilter({ currentPeriod, currentDate, currentMonth, currentYear }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const updateFilter = (updates) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        router.push(`/expenses?${params.toString()}`);
    };

    return (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1">
                <Button
                    variant={currentPeriod === "daily" ? "primary" : "outline"}
                    className="h-8 text-xs px-3"
                    onClick={() => updateFilter({ period: "daily" })}
                >
                    Daily
                </Button>
                <Button
                    variant={currentPeriod === "weekly" ? "primary" : "outline"}
                    className="h-8 text-xs px-3"
                    onClick={() => updateFilter({ period: "weekly" })}
                >
                    Weekly
                </Button>
                <Button
                    variant={currentPeriod === "monthly" ? "primary" : "outline"}
                    className="h-8 text-xs px-3"
                    onClick={() => updateFilter({ period: "monthly" })}
                >
                    Monthly
                </Button>
                <Button
                    variant={currentPeriod === "yearly" ? "primary" : "outline"}
                    className="h-8 text-xs px-3"
                    onClick={() => updateFilter({ period: "yearly" })}
                >
                    Yearly
                </Button>
            </div>

            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2">
                {currentPeriod === "daily" && (
                    <input
                        type="date"
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                        value={currentDate}
                        onChange={(e) => updateFilter({ date: e.target.value })}
                    />
                )}

                {currentPeriod === "monthly" && (
                    <input
                        type="month"
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                        value={currentMonth}
                        onChange={(e) => updateFilter({ month: e.target.value })}
                    />
                )}

                {currentPeriod === "yearly" && (
                    <select
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                        value={currentYear}
                        onChange={(e) => updateFilter({ year: e.target.value })}
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
}
