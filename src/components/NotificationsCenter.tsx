import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, Wrench, MessageSquare, AlertTriangle, AlertCircle, CheckCircle, Plus, Filter, X } from 'lucide-react';
import { RecentEvent } from '../types';

export const NotificationsCenter: React.FC = () => {
  const { recentEvents, addRecentEvent, showBanner } = useApp();
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'bay_service' | 'review' | 'delay' | 'complaint'>('bay_service');

  const filteredEvents = recentEvents.filter(e => {
    if (filterType === 'all') return true;
    return e.type === filterType;
  });

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    addRecentEvent({
      type,
      title,
      description,
    });
    setTitle('');
    setDescription('');
    setShowAddModal(false);
    showBanner('Notification enregistrée dans le journal de station');
  };

  const getEventIcon = (t: string) => {
    switch (t) {
      case 'bay_service':
        return { icon: Wrench, color: 'bg-[#3d242c] text-[#ff758f]' };
      case 'review':
        return { icon: MessageSquare, color: 'bg-[#322849] text-[#c084fc]' };
      case 'delay':
        return { icon: AlertTriangle, color: 'bg-[#1b3443] text-[#38bdf8]' };
      case 'complaint':
        return { icon: AlertCircle, color: 'bg-[#3d3319] text-[#facc15]' };
      default:
        return { icon: Bell, color: 'bg-[#252b39] text-gray-300' };
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <span>Centre de Notifications & Alertes Station</span>
          </h2>
          <p className="text-xs text-gray-400">
            Suivi des entretiens de pistes, avis clients, retards de livraison et signalements opérationnels
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#202532] p-1 rounded-xl border border-[#2c3343] text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400 ml-2 mr-1" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-transparent text-gray-300 focus:outline-none cursor-pointer pr-2"
            >
              <option value="all" className="bg-[#202532]">Tous les événements</option>
              <option value="bay_service" className="bg-[#202532]">Entretiens Pistes</option>
              <option value="review" className="bg-[#202532]">Avis Clients</option>
              <option value="delay" className="bg-[#202532]">Retards Détectés</option>
              <option value="complaint" className="bg-[#202532]">Plaintes / Qualité</option>
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouvelle Alerte</span>
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm divide-y divide-[#242b38]">
        {filteredEvents.map(event => {
          const { icon: Icon, color } = getEventIcon(event.type);
          return (
            <div key={event.id} className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{event.title}</h4>
                    {event.bayArea && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#272e3d] text-cyan-300">
                        Piste {event.bayArea}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{event.description}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0 space-y-2">
                <span className="text-[11px] text-gray-400 font-medium block">{event.timeAgo}</span>
                <button
                  onClick={() => showBanner(`Alerte "${event.title}" prise en charge`)}
                  className="px-2.5 py-1 rounded-lg bg-[#242a38] hover:bg-[#2d3444] text-[10px] font-bold text-gray-300 transition-colors"
                >
                  Traiter
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add Notification */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Créer une Notification</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Titre de l'Alerte</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="ex: Rappel vidange compresseur Piste 3"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Catégorie d'événement</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="bay_service">Entretien Piste / Matériel</option>
                  <option value="delay">Retard de Livraison</option>
                  <option value="complaint">Réclamation Client</option>
                  <option value="review">Avis / Témoignage Client</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Détails</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Préciser les éléments constatés..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-md"
                >
                  Publier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
