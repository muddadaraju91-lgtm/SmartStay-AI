import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hostelService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Hotel, MapPin, Compass, Sparkles, Loader2 } from 'lucide-react';

export default function AddHostel() {
    const navigate = useNavigate();
    const toast = useToast();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [description, setDescription] = useState('');
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const amenitiesOptions = ['WiFi', 'AC', 'Food', 'Gym', 'Laundry', 'Power Backup'];

    const toggleAmenity = (amenity) => {
        if (selectedAmenities.includes(amenity)) {
            setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
        } else {
            setSelectedAmenities([...selectedAmenities, amenity]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await hostelService.create({
                name,
                address,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                description,
                amenities: selectedAmenities
            });
            toast.success('Hostel registered successfully! Awaiting verification.');
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Property registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center py-16 px-4 relative">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-xl glass-panel p-8 rounded-2xl relative z-10 shadow-2xl border border-slate-900 animate-slide-up space-y-6">
                <div className="text-center pb-4 border-b border-slate-900">
                    <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-2">
                        <Hotel className="w-8 h-8 text-brand-400" />
                        Onboard New Property
                    </h2>
                    <p className="text-sm text-slate-400 mt-2">Submit coordinates, addresses, and facilities lists.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Hostel Name</label>
                        <input 
                            type="text" 
                            required
                            placeholder="St. John's Luxury Stay"
                            className="form-input text-xs"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Property Address</label>
                        <textarea 
                            rows={3}
                            required
                            placeholder="123, Campus Road, Near Christ University, Bengaluru"
                            className="form-input text-xs"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>

                    {/* Coordinates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3 text-brand-400" /> Latitude</label>
                            <input 
                                type="number" 
                                step="any"
                                required
                                placeholder="12.9716"
                                className="form-input text-xs"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3 text-brand-400" /> Longitude</label>
                            <input 
                                type="number" 
                                step="any"
                                required
                                placeholder="77.5946"
                                className="form-input text-xs"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Description</label>
                        <textarea 
                            rows={3}
                            placeholder="Describe rules, sharing structures, and surrounding areas..."
                            className="form-input text-xs"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Amenities Offered */}
                    <div className="space-y-2.5">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Amenities Offered</label>
                        <div className="grid grid-cols-3 gap-2">
                            {amenitiesOptions.map(amenity => {
                                const isChecked = selectedAmenities.includes(amenity);
                                return (
                                    <button
                                        type="button"
                                        key={amenity}
                                        onClick={() => toggleAmenity(amenity)}
                                        className={`py-2 text-[10px] font-semibold border rounded-lg text-center transition-all ${isChecked ? 'bg-brand-600/20 border-brand-500 text-brand-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        {amenity}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Submit */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full py-3 text-xs mt-4"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Hostel Property'}
                    </button>
                </form>
            </div>
        </div>
    );
}
