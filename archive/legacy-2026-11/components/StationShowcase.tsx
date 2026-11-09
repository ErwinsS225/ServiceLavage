/**
 * StationShowcase Component
 * 
 * Vitrine commerciale publique pour la station de lavage avec galerie de photos,
 * formulaire de réservation et boutons de contact WhatsApp.
 * 
 * Features:
 * - Page publique accessible sur cleanit.ci/stations/[slug]
 * - Galerie de 4 photos avec tags (Lavage Extérieur, Habitacle, Detailing Pro, Espace Attente)
 * - Formulaire de réservation (nom, téléphone, modèle véhicule, formule)
 * - Bouton WhatsApp direct pour contact client
 * - Affichage des horaires d'ouverture
 * - Affichage des formules populaires avec prix
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Globe, MapPin, Phone, Clock, Sparkles, MessageCircle, Navigation, Share2, Star, ShieldCheck, CheckCircle, Camera, Car
} from 'lucide-react';