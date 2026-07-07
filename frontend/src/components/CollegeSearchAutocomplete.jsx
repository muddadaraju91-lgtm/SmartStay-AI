import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { collegeService } from '../services/api';

export default function CollegeSearchAutocomplete({ 
    onSelect, 
    onChange,
    placeholder = "Enter college name or city area...",
    className = "",
    initialValue = ""
}) {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length >= 2 && isOpen) {
                fetchColleges(query);
            } else if (query.trim().length < 2) {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, isOpen]);

    // Handle outside clicks
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchColleges = async (searchQuery) => {
        setLoading(true);
        try {
            const res = await collegeService.search(searchQuery);
            setResults(res.data?.colleges || []);
        } catch (err) {
            console.error('Error fetching colleges:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (college) => {
        setQuery(college.name);
        setIsOpen(false);
        onSelect(college);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
                type="text"
                placeholder={placeholder}
                className={`form-input pl-12 text-sm w-full ${className}`}
                value={query}
                onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    setIsOpen(true);
                    if (onChange) onChange(val);
                }}
                onFocus={() => setIsOpen(true)}
            />
            {loading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-500 w-4 h-4 animate-spin" />
            )}

            {isOpen && query.length >= 2 && !loading && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in max-h-60 overflow-y-auto">
                    {results.length > 0 ? (
                        <ul className="py-2">
                            {results.map(college => (
                                <li 
                                    key={college.id}
                                    className="px-4 py-3 hover:bg-slate-800 cursor-pointer flex flex-col gap-1 transition-colors"
                                    onClick={() => handleSelect(college)}
                                >
                                    <span className="text-sm font-semibold text-white">{college.name}</span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {college.city}, {college.state}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-4 py-4 text-xs text-slate-400 text-center">
                            No colleges found matching "{query}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
