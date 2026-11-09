import React from 'react';
import { BayStation } from '../../types';

interface WashBaysGridProps {
    bays: BayStation[];
    bayFilter: 'operational' | 'out_of_service' | 'all';
    setBayFilter: (filter: 'operational' | 'out_of_service' | 'all') => void;
}

export const WashBaysGrid: React.FC<WashBaysGridProps> = ({
    bays,
    bayFilter,
    setBayFilter,
}) => {
    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-white tracking-wide">Pistes de Lavage (Wash Bays)</h3>
                <div className="flex items-center gap-1 border-b border-[#282f3e] pb-1">
                    <button
                        onClick={() => setBayFilter('operational')}
                        className={`text-xs font-semibold px-2 py-1 transition-all ${bayFilter === 'operational'
                                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Opérationnelles
                    </button>
                    <button
                        onClick={() => setBayFilter('out_of_service')}
                        className={`text-xs font-semibold px-2 py-1 transition-all ${bayFilter === 'out_of_service'
                                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Hors service
                    </button>
                    <button
                        onClick={() => setBayFilter('all')}
                        className={`text-xs font-semibold px-2 py-1 transition-all ${bayFilter === 'all'
                                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Toutes
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {bays.slice(0, 4).map((bay) => (
                    <div
                        key={bay.id}
                        className="bg-[#212633] border border-[#2c3343] rounded-xl p-3.5 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-200">{bay.name}</span>
                            <span
                                className={`w-2 h-2 rounded-full ${bay.status === 'operational'
                                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                        : 'bg-rose-500'
                                    }`}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-[#29303f]">
                            <div>
                                <div className="font-bold text-gray-100 truncate">
                                    {bay.currentVehicleInfo || 'Disponible'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};