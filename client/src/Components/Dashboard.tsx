import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { jwtDecode } from "jwt-decode";
import HelpModal from "../model/Helpmodel";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import socket from "../socket/socket";

// Distance Calculation Utility
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function Dashboard() {
  const [name, setName] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [id, setId] = useState();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allDrivers, setAllDrivers] = useState([]);
  const [helpAccepted, setHelpAccepted] = useState(null); // accepted help

  const openHelpModal = () => setIsModalOpen(true);
  const closeHelpModal = () => setIsModalOpen(false);

  const handleSend = async (issue) => {
    const res = await axios.post("http://localhost:3000/api/request/help-request", {
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      requesterId: id,
      issue,
    });

    const helpRequestId = res.data.helpRequest.id;
    socket.emit("send-help-request", { helpRequestId });

    alert("Help request sent!");
    closeHelpModal();
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      if (decoded?.name) {
        setName(decoded.name);
        setId(decoded.userid);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationInfo({ latitude, longitude });

          axios
            .get("http://localhost:3000/api/drivers")
            .then((res) => {
              const nearbyDrivers = res.data.drivers.filter((driver) =>
                getDistanceFromLatLonInKm(
                  latitude,
                  longitude,
                  driver.latitude,
                  driver.longitude
                ) <= 6
              );
              setAllDrivers(nearbyDrivers);
            })
            .catch((err) => {
              console.error("Failed to fetch drivers", err);
            });
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const handleHelpAccepted = (data) => {
      console.log("Help Accepted:", data);
      setHelpAccepted(data);
    };

    socket.on("help-accepted", handleHelpAccepted);

    return () => {
      socket.off("help-accepted", handleHelpAccepted);
    };
  }, []);

  return (
    <div>
      <Navbar />

      <div className="flex p-6 gap-6">
        {/* LEFT SIDE */}
        <div className="w-1/2 space-y-4">
          <h1 className="text-2xl font-bold">📋 Dashboard</h1>

          <div>
            👤 Your name: <strong>{name}</strong>
          </div>

          {locationInfo ? (
            <div>
              📍 Your current location:
              <br />
              Latitude: <strong>{locationInfo.latitude.toFixed(4)}</strong>
              <br />
              Longitude: <strong>{locationInfo.longitude.toFixed(4)}</strong>
            </div>
          ) : (
            <div>📡 Fetching your location...</div>
          )}

          <button
            onClick={openHelpModal}
            className="mt-4 border rounded-2xl p-2 bg-red-600 text-white"
          >
            🚨 Need Help
          </button>

          <HelpModal
            isOpen={isModalOpen}
            onClose={closeHelpModal}
            onSend={handleSend}
          />

          {/* Show if help has been accepted */}
          {helpAccepted && helpAccepted.requesterId === id && (
            <div className="mt-6 p-4 bg-blue-100 border border-blue-400 text-blue-900 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">🚨 Help Request Accepted</h2>
              <p>
                <strong>👨‍🔧 Helper:</strong> {helpAccepted.helperName}
              </p>
              <p>
                <strong>🧑‍💼 You (Requester):</strong> {helpAccepted.requesterName}
              </p>
              <p>
                <strong>🛠 Issue:</strong> {helpAccepted.issue}
              </p>
              <p>
                <strong>📍 Helper Location:</strong>{" "}
                {helpAccepted.location.latitude.toFixed(4)},{" "}
                {helpAccepted.location.longitude.toFixed(4)}
              </p>
              <p>
                <strong>📍 Your Location:</strong>{" "}
                {locationInfo.latitude.toFixed(4)},{" "}
                {locationInfo.longitude.toFixed(4)}
              </p>
              <p>
                <strong>📏 Distance:</strong>{" "}
                {getDistanceFromLatLonInKm(
                  helpAccepted.location.latitude,
                  helpAccepted.location.longitude,
                  locationInfo.latitude,
                  locationInfo.longitude
                ).toFixed(2)}{" "}
                km
              </p>
              <p>
                <strong>🕒 Accepted At:</strong>{" "}
                {new Date(helpAccepted.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: MAP */}
        <div className="w-1/2 h-[500px]">
          {locationInfo && (
            <MapContainer
              center={[locationInfo.latitude, locationInfo.longitude]}
              zoom={14}
              scrollWheelZoom={true}
              className="h-full w-full rounded-lg shadow"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Requester Marker */}
              <Marker position={[locationInfo.latitude, locationInfo.longitude]}>
                <Popup>You (Requester)</Popup>
              </Marker>

              {/* Nearby Drivers */}
              {allDrivers.map((driver) => (
                <Marker
                  key={driver.id}
                  position={[driver.latitude, driver.longitude]}
                >
                  <Popup>
                    🚕 Driver: <strong>{driver.name}</strong>
                    <br />
                    Status: {driver.status}
                  </Popup>
                </Marker>
              ))}

              {/* Helper Marker */}
              {helpAccepted?.helperId && (
                <Marker
                  position={[
                    helpAccepted.location.latitude,
                    helpAccepted.location.longitude,
                  ]}
                >
                  <Popup>Helper: {helpAccepted.helperName}</Popup>
                </Marker>
              )}

              {/* Polyline between helper and requester */}
              {helpAccepted?.helperId && (
                <Polyline
                  positions={[
                    [locationInfo.latitude, locationInfo.longitude],
                    [
                      helpAccepted.location.latitude,
                      helpAccepted.location.longitude,
                    ],
                  ]}
                  color="blue"
                />
              )}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
