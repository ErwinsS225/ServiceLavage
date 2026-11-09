import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
    const features = [
        {
            icon: <Zap className="w-5 h-5" />,
            title: "Rapide & Efficace",
            description: "Gérez votre centre de lavage en temps réel"
        },
        {
            icon: <Shield className="w-5 h-5" />,
            title: "Sécurisé",
            description: "Vos données sont protégées et sauvegardées"
        },
        {
            icon: <TrendingUp className="w-5 h-5" />,
            title: "Performant",
            description: "Augmentez votre productivité de 40%"
        }
    ];

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a0e17] via-[#0d1321] to-[#0f172a]">
            {/* Background effects */}
            <div className="absolute inset-0 w-full h-full">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    transition={{ duration: 1.5 }}
                    className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500 rounded-full filter blur-[120px]"
                />
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    transition={{ duration: 1.5, delay: 0.3 }}
                    className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full filter blur-[100px]"
                />
            </div>

            {/* Main hero image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=1920&h=1080"
                    alt="Centre de lavage automobile moderne"
                    className="w-full h-full object-cover opacity-15"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-[#0a0e17]" />
            </div>

            <div className="relative z-10 container mx-auto px-6 py-24">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-8"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-cyan-300 backdrop-blur-sm"
                        >
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <span>Nouvelle version 2.0 disponible</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="text-5xl md:text-7xl font-bold leading-tight tracking-tight"
                        >
                            <span className="text-white">Gérez votre</span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                centre de lavage
                            </span>
                            <br />
                            <span className="text-white">en toute simplicité</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.5 }}
                            className="text-xl text-gray-400 leading-relaxed max-w-xl"
                        >
                            Clean It ERP est la solution SaaS complète pour automatiser et optimiser la gestion de votre entreprise de lavage automobile.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.7 }}
                            className="flex flex-wrap gap-4"
                        >
                            <Button
                                size="lg"
                                className="group bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold px-8 py-6 rounded-2xl text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
                            >
                                Commencer gratuitement
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                            <Button
                                size="lg"
                                variant="secondary"
                                className="px-8 py-6 rounded-2xl text-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white backdrop-blur-sm transition-all duration-300"
                            >
                                Voir la démo
                            </Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.9 }}
                            className="flex flex-wrap gap-6 pt-4"
                        >
                            {['Aucune carte bancaire requise', '14 jours d\'essai gratuit', 'Support dédié'].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </motion.div>
                    </motion.div>

                    {/* Right content - Dashboard preview */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.9, delay: 0.4 }}
                        className="relative"
                    >
                        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl bg-white/5">
                            <img
                                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200&h=800"
                                alt="Dashboard Clean It ERP"
                                className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/80 to-transparent" />
                        </div>

                        {/* Floating cards */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.8 }}
                            className="absolute -left-8 top-1/4 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-lg shadow-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-white font-semibold">+47%</p>
                                    <p className="text-xs text-gray-400">de croissance</p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 1.0 }}
                            className="absolute -right-4 bottom-1/3 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-lg shadow-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-white font-semibold">2.4s</p>
                                    <p className="text-xs text-gray-400">temps de réponse</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Feature grid */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.1 }}
                    className="grid md:grid-cols-3 gap-6 mt-32"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                {feature.icon}
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default HeroSection;