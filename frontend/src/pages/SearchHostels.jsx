import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hostelService } from '../services/api';
import { Search, MapPin, ShieldAlert, Sparkles, Filter, CheckSquare, Square, X, Compass, Star } from 'lucide-react';
import CollegeSearchAutocomplete from '../components/CollegeSearchAutocomplete';

export default function SearchHostels() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlQuery = searchParams.get('search') || '';

    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [search, setSearch] = useState(urlQuery);
    const [collegeLat, setCollegeLat] = useState(searchParams.get('collegeLat') || '');
    const [collegeLng, setCollegeLng] = useState(searchParams.get('collegeLng') || '');
    const [minPrice, setMinPrice] = useState('5000');
    const [maxPrice, setMaxPrice] = useState('10000');
    const [isVerified, setIsVerified] = useState(false);
    const [selectedAmenities, setSelectedAmenities] = useState([]);

    const amenitiesOptions = ['WiFi', 'AC', 'Food', 'Gym', 'Laundry', 'Power Backup'];

    useEffect(() => {
        fetchHostels();
    }, [searchParams]);

    const fetchHostels = async () => {
        setLoading(true);
        try {
            const params = {
                search: searchParams.get('search') || '',
                collegeLat: searchParams.get('collegeLat') || '',
                collegeLng: searchParams.get('collegeLng') || '',
                minPrice: searchParams.get('minPrice') || '',
                maxPrice: searchParams.get('maxPrice') || '',
                isVerified: searchParams.get('isVerified') || '',
                amenities: searchParams.get('amenities') || ''
            };
            const res = await hostelService.getAll(params);
            setHostels(res.data.hostels || []);
        } catch (err) {
            console.error('Error querying hostels:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilters = (e) => {
        if (e) e.preventDefault();
        const params = {};
        if (search) params.search = search;
        if (collegeLat) params.collegeLat = collegeLat;
        if (collegeLng) params.collegeLng = collegeLng;
        if (minPrice) params.minPrice = minPrice;
        if (maxPrice) params.maxPrice = maxPrice;
        if (isVerified) params.isVerified = 'true';
        if (selectedAmenities.length > 0) params.amenities = selectedAmenities.join(',');

        setSearchParams(params);
    };

    const handleResetFilters = () => {
        setSearch('');
        setCollegeLat('');
        setCollegeLng('');
        setMinPrice('');
        setMaxPrice('');
        setIsVerified(false);
        setSelectedAmenities([]);
        setSearchParams({});
    };

    const toggleAmenity = (amenity) => {
        if (selectedAmenities.includes(amenity)) {
            setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
        } else {
            setSelectedAmenities([...selectedAmenities, amenity]);
        }
    };

    return (
        <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in flex flex-col md:flex-row gap-8">
            
            {/* Filters Sidebar (Left Pane) */}
            <aside className="w-full md:w-[280px] shrink-0 glass-panel p-6 rounded-2xl h-fit border border-slate-900 shadow-xl">
                <div className="flex items-center justify-between mb-6 border-b border-slate-900 pb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Filter className="w-4.5 h-4.5 text-brand-400" />
                        Smart Filters
                    </h2>
                    <button 
                        onClick={handleResetFilters}
                        className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
                    >
                        Clear All
                    </button>
                </div>

                <form onSubmit={handleApplyFilters} className="space-y-6">
                    {/* Keyword Search */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400">Search Location</label>
                        <CollegeSearchAutocomplete 
                            initialValue={search}
                            onChange={(text) => {
                                setSearch(text);
                                setCollegeLat('');
                                setCollegeLng('');
                            }}
                            onSelect={(college) => {
                                setSearch(college.name);
                                setCollegeLat(college.latitude);
                                setCollegeLng(college.longitude);
                            }}
                        />
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400">Rent Range (₹/month)</label>
                        <div className="flex gap-2 items-center">
                           <input
    type="number"
    placeholder="5000"
    min="5000"
    max="10000"
    className="form-input text-xs px-2 py-2"
    value={minPrice}
    onChange={(e) => setMinPrice(e.target.value)}
/>

<span className="text-slate-600 text-xs">-</span>

<input
    type="number"
    placeholder="10000"
    min="5000"
    max="10000"
    className="form-input text-xs px-2 py-2"
    value={maxPrice}
    onChange={(e) => setMaxPrice(e.target.value)}
/>
                        </div>
                    </div>

                    {/* Verified Only */}
                    <div className="flex items-center justify-between py-2 border-y border-slate-900">
                        <label className="text-xs font-semibold text-slate-300">Verified Stays Only</label>
                        <button
                            type="button"
                            onClick={() => setIsVerified(!isVerified)}
                            className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${isVerified ? 'bg-brand-600' : 'bg-slate-800'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isVerified ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* Amenities checklist */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-400">Amenities Offered</label>
                        <div className="space-y-2.5">
                            {amenitiesOptions.map(amenity => {
                                const isChecked = selectedAmenities.includes(amenity);
                                return (
                                    <button
                                        type="button"
                                        key={amenity}
                                        onClick={() => toggleAmenity(amenity)}
                                        className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white text-left w-full"
                                    >
                                        {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-brand-500 fill-brand-500/20" />
                                        ) : (
                                            <Square className="w-4 h-4 text-slate-600" />
                                        )}
                                        <span>{amenity}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <button type="submit" className="btn-primary w-full text-xs py-3">
                        Apply Filter Parameters
                    </button>
                </form>
            </aside>

            {/* Hostels List & Map Pane (Right Pane) */}
            <main className="flex-grow space-y-6">
                
                {/* Metrics Header */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                    <span className="text-sm text-slate-400">
                        Showing <strong className="text-slate-100 font-semibold">{hostels.length}</strong> accommodations
                    </span>
                </div>

                {/* List container */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[200px] bg-slate-900/50 rounded-2xl border border-slate-850 animate-pulse"></div>
                        ))}
                    </div>
                ) : hostels.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {hostels.map(hostel => (
                            <div key={hostel.id} className="glass-card rounded-2xl overflow-hidden p-6 flex flex-col sm:flex-row gap-6">
                                {/* Left Side Description */}
                                <div className="flex-grow space-y-3">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h3 className="text-xl font-bold text-white">{hostel.name}</h3>
                                        {hostel.is_verified && (
                                            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full text-[10px] font-semibold flex items-center gap-1">
                                                <Compass className="w-3 h-3" /> Verified
                                            </span>
                                        )}
                                        <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-full text-[10px] font-semibold flex items-center gap-1">
                                            Trust: {hostel.trust_score}%
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
                                        <span>{hostel.address}</span>
                                    </p>

                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {(hostel.amenities || []).map(a => (
                                            <span key={a} className="bg-slate-900 border border-slate-800 text-[10px] text-slate-400 px-2 py-0.5 rounded-md">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Side Costings & Actions */}
                                <div className="sm:w-[180px] shrink-0 flex flex-col justify-between items-end gap-4 border-t sm:border-t-0 sm:border-l border-slate-850 pt-4 sm:pt-0 sm:pl-6">
                                    <div className="text-right w-full">
                                        <span className="text-[10px] uppercase text-slate-500 block">Starting rent</span>
                                        <span className="text-2xl font-extrabold text-white">₹{hostel.starting_price}</span>
                                        <span className="text-slate-500 text-xs block">/ month</span>
                                    </div>

                                    <div className="w-full space-y-1.5">
                                        <div className="text-right text-[10px] text-brand-400 font-semibold mb-1">
                                            Vacancy: {hostel.total_vacancy} beds
                                        </div>
                                        <Link to={`/hostels/${hostel.id}`} className="btn-primary w-full py-2 text-xs">
                                            View Rooms
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
                        <Compass className="w-12 h-12 text-slate-500 mb-4 animate-pulse" />
                        <h3 className="text-lg font-bold text-white mb-1">No Hostels Match Your Criteria</h3>
                        <p className="text-xs text-slate-400 max-w-sm mb-4">We couldn't find listings near this area. Try adjusting price parameters or location queries.</p>
                        <button onClick={handleResetFilters} className="btn-secondary py-2 text-xs">Reset All Filters</button>
                    </div>
                )}
            </main>
        </div>
    );
}
