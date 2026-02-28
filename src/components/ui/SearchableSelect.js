"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Portal } from "./Portal";
import clsx from "clsx";

/**
 * A reusable searchable dropdown component.
 * It combines a text input with a filtered dropdown list.
 */
export function SearchableSelect({
    label,
    options = [],
    value,
    onChange,
    placeholder,
    name,
    required,
    className,
    error,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Find the label for the current value
    const selectedOption = useMemo(
        () => options.find((opt) => String(opt.id) === String(value)),
        [options, value]
    );

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const query = search.toLowerCase();
        return options.filter((opt) =>
            String(opt.label).toLowerCase().includes(query)
        );
    }, [options, search]);

    // Handle clicking outside to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            const isInsideContainer = containerRef.current && containerRef.current.contains(event.target);
            const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

            if (!isInsideContainer && !isInsideDropdown) {
                setIsOpen(false);
                setSearch("");
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Update position when menu opens
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // We want to account for the label height if present
            const trigger = containerRef.current.querySelector('.dropdown-trigger');
            const triggerRect = trigger ? trigger.getBoundingClientRect() : rect;

            setCoords({
                top: triggerRect.bottom + window.scrollY,
                left: triggerRect.left + window.scrollX,
                width: triggerRect.width,
            });
        }
    }, [isOpen]);

    const handleSelect = (option) => {
        onChange?.(option.id);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div className={clsx("relative flex flex-col gap-1", className)} ref={containerRef}>
            {label && <span className="text-xs font-medium text-slate-600">{label}</span>}

            {/* Hidden input for standard form submission compatibility */}
            <input type="hidden" name={name} value={value || ""} required={required} />

            {/* Trigger div */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "dropdown-trigger flex h-8 cursor-pointer items-center justify-between rounded-md border bg-white px-2 text-xs text-slate-900 shadow-sm outline-none transition-colors",
                    isOpen ? "border-slate-500 ring-1 ring-slate-500" : "border-slate-300",
                    error && "border-red-500 focus-within:ring-red-500",
                )}
            >
                <span className={clsx("truncate", !selectedOption && "text-slate-400")}>
                    {selectedOption ? selectedOption.label : placeholder || "Select option..."}
                </span>
                <svg
                    className={clsx("h-3 w-3 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Dropdown menu (using Portal) */}
            {isOpen && (
                <Portal>
                    <div
                        ref={dropdownRef}
                        style={{
                            position: 'absolute',
                            top: coords.top,
                            left: coords.left,
                            width: coords.width,
                        }}
                        className="z-50 mt-1 rounded-md border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5"
                    >
                        {/* Search Input */}
                        <div className="relative mb-1">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                autoFocus
                                type="text"
                                className="block w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                                placeholder="Filter..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Options List */}
                        <div className="max-h-48 overflow-y-auto">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => (
                                    <div
                                        key={opt.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(opt);
                                        }}
                                        className={clsx(
                                            "cursor-pointer px-2 py-1.5 text-xs hover:bg-slate-100 rounded transition-colors",
                                            String(value) === String(opt.id) ? "bg-slate-50 font-semibold text-blue-600" : "text-slate-700"
                                        )}
                                    >
                                        {opt.label}
                                    </div>
                                ))
                            ) : (
                                <div className="px-2 py-2 text-[11px] text-slate-500 italic text-center">No matches found</div>
                            )}
                        </div>
                    </div>
                </Portal>
            )}

            {error && <span className="text-xs font-normal text-red-600">{error}</span>}
        </div>
    );
}
