import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const Map = ({ source, destination }) => {
  return (
    <MapContainer
      center={[21.1458, 79.0882]}
      zoom={6}
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {source && (
        <Marker position={source}>
          <Popup>
            Starting Location
          </Popup>
        </Marker>
      )}

      {destination && (
        <Marker position={destination}>
          <Popup>
            Destination
          </Popup>
        </Marker>
      )}

    </MapContainer>
  );
};

export default Map;