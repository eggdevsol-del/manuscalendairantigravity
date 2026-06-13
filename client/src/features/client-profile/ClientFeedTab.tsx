import { useState, useMemo } from "react";
import { MessageCircle, MapPin, Search } from "lucide-react";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues in React
import L from "leaflet";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface ClientFeedTabProps {
  conversations: any[];
  setIsShopExpanded: (expanded: boolean) => void;
}

export function ClientFeedTab({ conversations, setIsShopExpanded }: ClientFeedTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mapRadius, setMapRadius] = useState(5000); // meters

  // Default center (e.g. Brisbane or user location)
  const mapCenter: [number, number] = [-27.4705, 153.026];

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const artist = conv.otherUser;
      if (!artist) return false;
      
      const name = (artist.name || artist.firstName || "").toLowerCase();
      const keywords = (artist.keywords || "").toLowerCase();
      
      return name.includes(query) || keywords.includes(query);
    });
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Scrollable Feed Area */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-4 pb-[100px] space-y-6">
        
        {/* Discover Nearby Map Widget */}
        <div className="rounded-2xl overflow-hidden border border-border shadow-lg bg-card flex flex-col">
          <div className="p-3 bg-secondary/30 flex items-center gap-2 border-b border-border">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Discover Nearby</h3>
          </div>
          <div className="h-[200px] w-full relative z-0">
            <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Circle center={mapCenter} radius={mapRadius} pathOptions={{ color: 'var(--primary)', fillColor: 'var(--primary)', fillOpacity: 0.2 }} />
              {/* Dummy marker for demonstration */}
              <Marker position={mapCenter}>
                <Popup>Your search area</Popup>
              </Marker>
            </MapContainer>
            {/* Radius Adjuster Overlay */}
            <div className="absolute bottom-2 right-2 z-[400] bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border flex items-center gap-2">
              <span className="text-xs font-medium">Radius:</span>
              <select 
                className="bg-transparent text-xs outline-none cursor-pointer"
                value={mapRadius}
                onChange={(e) => setMapRadius(Number(e.target.value))}
              >
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={25000}>25 km</option>
              </select>
            </div>
          </div>
        </div>

        {/* My Artists Section */}
        <div>
          <h3 className="font-bold text-lg mb-3">My Artists</h3>
          
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No artists found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConversations.map((conv: any) => (
                <ClientArtistCard 
                  key={conv.id} 
                  conv={conv} 
                  onShopToggle={setIsShopExpanded}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Anchored Search Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border z-40"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="relative flex items-center">
          <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, style (e.g. realism)..."
            className="w-full pl-10 h-12 rounded-full bg-secondary/50 border-border focus-visible:ring-primary shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
