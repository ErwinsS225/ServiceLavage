import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Globe, 
  MapPin, 
  Phone, 
  Clock, 
  Sparkles, 
  MessageCircle, 
  Navigation, 
  Share2, 
  Star, 
  ShieldCheck, 
  CheckCircle,
  Camera,
  Car
} from 'lucide-react';

export const StationShowcase: React.FC = () => {
  const { currentTenant, services, formatCurrency, showBanner } = useApp();

  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('+225 ');
  const [bookingCar, setBookingCar] = useState('');
  const [bookingService, setBookingService] = useState('Shine');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const galleryImages = [
    {
      url: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&auto=format&fit=crop&q=80',
      title: 'Canon à mousse active haute densité',
      tag: 'Lavage Extérieur'
    },
    {
      url: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=600&auto=format&fit=crop&q=80',
      title: 'Nettoyage intérieur vapeur & sièges',
      tag: 'Habitacle & Tapis'
    },
    {
      url: 'https://images.unsplash.com/photo-1552930294-6b595f4c2974?w=600&auto=format&fit=crop&q=80',
      title: 'Polissage & lustrage céramique carrosserie',
      tag: 'Detailing Pro'
    },
    {
      url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600&auto=format&fit=crop&q=80',
      title: 'Salon VIP climatisé avec Wi-Fi & café offert',
      tag: 'Espace Attente'
    }
  ];

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSuccess(true);
    showBanner('Demande de réservation transmise à la station !');
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.origin + `/stations/${currentTenant.slug}`);
    showBanner('Lien de la vitrine copié dans le presse-papier !', 'info');
  };

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto text-gray-200">
      {/* Top Banner: Mode Aperçu Vitrine Publique */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Vitrine Commerciale Publique de la Station
            </span>
            <p className="text-xs text-gray-300">
              Lien public pour vos clients : <span className="font-mono text-cyan-300">cleanit.ci/stations/{currentTenant.slug}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-xl bg-[#202532] hover:bg-[#2a3142] border border-[#2e3748] text-xs font-semibold text-gray-200 flex items-center gap-1.5 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Partager le lien</span>
          </button>
          <a
            href={`https://wa.me/${currentTenant.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Tester WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Hero Showcase Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#272d3b] bg-[#161922] shadow-2xl">
        {/* Cover backdrop image */}
        <div className="h-64 sm:h-80 w-full relative">
          <img
            src="https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=1400&auto=format&fit=crop&q=80"
            alt="Station de lavage"
            className="w-full h-full object-cover brightness-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#161922] via-[#161922]/40 to-transparent" />
          
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/90 text-white backdrop-blur-md flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Station Ouverte
            </span>
          </div>
        </div>

        {/* Content Overlap */}
        <div className="px-6 sm:px-10 pb-10 -mt-20 relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-1 shadow-2xl ring-4 ring-[#161922]">
                <div className="w-full h-full rounded-xl bg-[#161922] flex items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center text-white">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {currentTenant.name}
                </h1>
                <p className="text-xs sm:text-sm text-cyan-400 font-semibold flex items-center gap-1.5 mt-1">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>{currentTenant.quarter}, {currentTenant.commune} • Abidjan</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <a
                href={`tel:${currentTenant.phone}`}
                className="px-4 py-2.5 rounded-xl bg-[#222734] hover:bg-[#2c3343] text-white text-xs font-bold flex items-center gap-2 border border-[#2f3748] transition-colors"
              >
                <Phone className="w-4 h-4 text-cyan-400" />
                <span>Appeler</span>
              </a>

              <a
                href={`https://wa.me/${currentTenant.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, je souhaite des informations sur vos prestations de lavage auto.')}`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Direct</span>
              </a>
            </div>
          </div>

          {/* Description & Station Badges */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-[#262c3a]">
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">À propos de notre station</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                {currentTenant.description}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#202532] text-gray-300 border border-[#2b3342] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Mousse PH Neutre anti-rayures
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#202532] text-gray-300 border border-[#2b3342] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {currentTenant.openingHours}
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#202532] text-gray-300 border border-[#2b3342] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Paiements Wave, Orange & MTN acceptés
                </span>
              </div>
            </div>

            {/* Quick Hours & Location */}
            <div className="p-4 rounded-2xl bg-[#1e2330] border border-[#293140] space-y-2.5 text-xs">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] block">Horaires & Contact</span>
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>{currentTenant.openingHours}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{currentTenant.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Navigation className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{currentTenant.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Services & Pricing Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Nos Formules & Tarifs Publics</span>
            </h3>
            <p className="text-xs text-gray-400">Prestations garanties avec produits professionnels certifiés</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map(srv => (
            <div
              key={srv.id}
              className="bg-[#1c202a] border border-[#272d3b] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#3b2d54] text-purple-200">
                    {srv.category}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">À PARTIR DE</span>
                    <span className="text-lg font-extrabold text-cyan-400">
                      {formatCurrency(srv.basePrice)}
                    </span>
                  </div>
                </div>

                <h4 className="text-base font-bold text-white mt-3">{srv.name}</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{srv.description}</p>
              </div>

              <div className="pt-3 border-t border-[#272d3b] flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  ~ {srv.durationMinutes} minutes
                </span>
                <a
                  href={`https://wa.me/${currentTenant.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, je souhaite réserver la prestation "${srv.name}" chez vous.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Réserver sur WhatsApp →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Photo Gallery: Installations & Avant/Après */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            <span>Galerie Photos des Installations & Réalisations</span>
          </h3>
          <p className="text-xs text-gray-400">Découvrez nos pistes, équipements et finitions haut de gamme</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {galleryImages.map((img, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl overflow-hidden border border-[#272d3b] bg-[#1a1e27] h-56 shadow-sm hover:border-cyan-500/50 transition-all"
            >
              <img
                src={img.url}
                alt={img.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500 text-white w-max mb-1">
                  {img.tag}
                </span>
                <span className="text-xs font-bold text-white leading-tight">
                  {img.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demande de RDV / Devis Rapide */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="max-w-xl">
          <h3 className="text-base font-bold text-white">Prendre rendez-vous ou demander un devis</h3>
          <p className="text-xs text-gray-400 mt-1">
            Évitez les files d'attente en réservant votre créneau dans notre station à {currentTenant.commune}.
          </p>
        </div>

        {bookingSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Merci ! Votre demande a été enregistrée. L'équipe Clean It vous contacte par SMS ou WhatsApp.</span>
          </div>
        ) : (
          <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <div>
              <input
                type="text"
                required
                placeholder="Votre nom complet"
                value={bookingName}
                onChange={e => setBookingName(e.target.value)}
                className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <input
                type="tel"
                required
                placeholder="+225 07..."
                value={bookingPhone}
                onChange={e => setBookingPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <input
                type="text"
                required
                placeholder="Modèle véhicule (ex: Prado)"
                value={bookingCar}
                onChange={e => setBookingCar(e.target.value)}
                className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-[0.98]"
            >
              Envoyer la Demande
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
