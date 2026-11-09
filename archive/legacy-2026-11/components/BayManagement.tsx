import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutGrid, RefreshCw, Car, Users, Clock, Wrench, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const BayManagement: React.FC = () => {
  const { bays, refreshBay, updateBayStatus, employees, orders } = useApp();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-cyan-400" />
            <span>Gestion des Pistes de Lavage (Wash Bay Stations)</span>
          </h2>
          <p className="text-xs text-gray-400">
            Supervision technique, pression d'eau, karcher, état des pistes et affectation des équipes
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-[#202532] border border-[#2c3343] font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {bays.filter(b => b.status === 'operational').length} Pistes en service
          </span>
        </div>
      </div>

      {/* Grid of all 8 Wash Bay Stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {bays.map(bay => {
          const isOperational = bay.status === 'operational';
          const assignedWashers = employees.filter(e => bay.washerIds.includes(e.id));

          return (
            <div
              key={bay.id}
              className={`bg-[#1c202a] border rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between ${
                isOperational ? 'border-[#272d3b] hover:border-cyan-500/50' : 'border-rose-900/40 opacity-80'
              }`}
            >
              <div>
                {/* Bay Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#272e3d]">
                  <div>
                    <h3 className="font-bold text-white text-base">{bay.name}</h3>
                    <span className="text-[10px] text-gray-400">Haute pression 180 bars</span>
                  </div>

                  <span
                    className={`w-3 h-3 rounded-full ${
                      isOperational ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' : 'bg-rose-500'
                    }`}
                  />
                </div>

                {/* Current Vehicle */}
                <div className="py-3 space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Véhicule en cours</span>
                  <div className="p-2.5 rounded-xl bg-[#222734] border border-[#2c3343] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{bay.currentVehicleInfo || 'Piste disponible'}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{bay.currentVehiclePlate || 'Libre'}</div>
                    </div>
                    {bay.washCategory && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3b2d54] text-purple-200">
                        {bay.washCategory}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics: Queue, Time, Staff */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs py-2">
                  <div className="bg-[#222734] p-2 rounded-xl">
                    <span className="text-[10px] text-gray-400 block">EN ATTENTE</span>
                    <span className="font-bold text-white text-sm mt-0.5 block">{bay.inQueueCount}</span>
                  </div>

                  <div className="bg-[#222734] p-2 rounded-xl">
                    <span className="text-[10px] text-gray-400 block">TEMPS MOY.</span>
                    <span className="font-bold text-cyan-400 text-sm mt-0.5 block">{bay.avgTimeMinutes}m</span>
                  </div>

                  <div className="bg-[#222734] p-2 rounded-xl">
                    <span className="text-[10px] text-gray-400 block">STAFF</span>
                    <span className="font-bold text-white text-sm mt-0.5 block">{bay.assignedStaffCount}</span>
                  </div>
                </div>

                {/* Assigned Laveurs */}
                <div className="mt-3">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Équipe affectée
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {assignedWashers.map(washer => (
                      <span key={washer.id} className="px-2 py-0.5 rounded-md bg-[#293040] text-gray-300 text-[10px]">
                        {washer.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bay Actions */}
              <div className="pt-3 border-t border-[#272d3b] space-y-2">
                <button
                  onClick={() => refreshBay(bay.id)}
                  className="w-full py-2 px-3 rounded-xl bg-[#252b39] hover:bg-[#2f3749] text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualiser Piste</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateBayStatus(bay.id, isOperational ? 'out_of_service' : 'operational')}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold border transition-colors ${
                      isOperational
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isOperational ? 'Mettre hors-service' : 'Rendre opérationnelle'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
