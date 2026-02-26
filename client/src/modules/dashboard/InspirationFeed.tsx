import { Button, Card, CardContent } from "@/components/ui";
import { Heart } from "lucide-react";
import { Link } from "wouter";

interface InspirationFeedProps {
  likes: any[];
}

export function InspirationFeed({ likes }: InspirationFeedProps) {
  if (!likes || likes.length === 0) {
    return (
      <div className="mb-24">
        <h2 className="text-lg font-semibold mb-3">Inspiration</h2>
        <Card className="bg-muted/50 border-dashed border-2">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              Start exploring to find your next style
            </p>
            <Link href="/explore">
              <Button variant="outline">Explore Artists</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-24">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Favorites</h2>
        <Link href="/explore">
          <Button variant="link" size="sm" className="h-auto p-0 text-primary">
            View All
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {likes.map(like => (
          <div
            key={like.id}
            className="aspect-square rounded-xl overflow-hidden relative group"
          >
            <img
              src={like.portfolio?.imageUrl}
              alt="Portfolio item"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-2 left-2 right-2">
              <p className="text-white text-xs font-medium truncate drop-shadow-md">
                {like.portfolio?.artist?.name}
              </p>
            </div>
            <div className="absolute top-2 right-2">
              <div className="bg-black/40 backdrop-blur-sm p-1.5 rounded-full">
                <Heart className="w-3 h-3 text-red-500 fill-red-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
