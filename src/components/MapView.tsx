import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
iconUrl: markerIcon,
shadowUrl: markerShadow,
iconSize: [25, 41],
iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
onLocationSelect: (lat: number, lng: number) => void;
selectedLayer: string;
timeHorizon: string;
}

function LocationMarker({ onSelect, setCoords }: {
onSelect: (lat: number, lng: number) => void,
setCoords: (lat: string, lng: string) => void
}) {
const [position, setPosition] = useState<L.LatLng | null>(null);
const map = useMapEvents({
click(e) {
setPosition(e.latlng);
onSelect(e.latlng.lat, e.latlng.lng);
setCoords(e.latlng.lat.toFixed(3), e.latlng.lng.toFixed(3));
map.flyTo(e.latlng, map.getZoom());
},
});
return position === null ? null : <Marker position={position}><Popup>Selected Area</Popup></Marker>;
}

export function MapView({ onLocationSelect, selectedLayer, timeHorizon }: MapViewProps) {
const [displayCoords, setDisplayCoords] = useState({ lat: '51.505', lng: '-0.090' });

const getLayerColor = () => {
switch (selectedLayer) {
case 'ndvi': return '#10b981';
case 'sar': return '#3b82f6';
case 'degradation': return '#ef4444';
default: return '#10b981';
}
};

return (
<div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 relative">
<MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
<LocationMarker onSelect={onLocationSelect} setCoords={(lat, lng) => setDisplayCoords({ lat, lng })} />
<Polygon
positions={[[51.505, -0.09], [51.51, -0.1], [51.51, -0.08]]}
pathOptions={{ color: getLayerColor(), fillColor: getLayerColor(), fillOpacity: 0.4 }}
/>
</MapContainer>
<div className="absolute bottom-4 left-4 z-[400] glass-panel px-4 py-2 text-xs font-mono flex items-center gap-4">
<span>COORD: {displayCoords.lat}° N, {displayCoords.lng}° W</span>
</div>
</div>
);
}