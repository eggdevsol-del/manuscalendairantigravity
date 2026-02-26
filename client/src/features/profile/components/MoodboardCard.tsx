import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Assuming standard Shadcn dialog

interface Board {
  id: number;
  title: string;
  previewImages: string[];
  itemCount: number;
}

interface MoodboardCardProps {
  boards: Board[];
  isEditMode: boolean;
  onCreateBoard: (title: string) => Promise<void>;
  onDeleteBoard: (id: number) => Promise<void>;
  onAddImage: (boardId: number, url: string) => Promise<void>;
}

export function MoodboardCard({
  boards,
  isEditMode,
  onCreateBoard,
  onDeleteBoard,
  onAddImage,
}: MoodboardCardProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  const selectedBoard = boards?.find(b => b.id === selectedBoardId);

  const handleCreate = async () => {
    if (!newBoardTitle.trim()) return;
    await onCreateBoard(newBoardTitle);
    setNewBoardTitle("");
    setIsCreateOpen(false);
  };

  if (selectedBoard) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="h-full"
      >
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedBoardId(null)}
            className="-ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-xl font-bold">{selectedBoard.title}</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Add Image Placeholder */}
          <div
            className="aspect-square rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => {
              // Trigger image upload flow - simplistic prompt for now or file input
              const url = prompt("Enter image URL (mock):"); // Replace with file picker later
              if (url) onAddImage(selectedBoard.id, url);
            }}
          >
            <Plus className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-medium">Add Image</span>
          </div>

          {selectedBoard.previewImages.map((img, idx) => (
            <div
              key={idx}
              className="aspect-square rounded-xl overflow-hidden bg-muted relative group"
            >
              <img src={img} className="w-full h-full object-cover" />
              {isEditMode && (
                <button className="absolute top-1 right-1 bg-black/50 p-1.5 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="h-full">
      {/* Create Board Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Moodboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Board Title (e.g., Tattoo Ideas)"
              value={newBoardTitle}
              onChange={e => setNewBoardTitle(e.target.value)}
            />
            <Button onClick={handleCreate} className="w-full">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {isEditMode && (
          <Button
            variant="outline"
            className="w-full h-12 border-dashed border-white/20 bg-white/5 text-muted-foreground"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Board
          </Button>
        )}

        {boards?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground opacity-60">
            <div className="bg-white/5 p-4 rounded-full mb-3">
              <ImageIcon className="w-8 h-8" />
            </div>
            <p>No moodboards ye</p>
          </div>
        ) : (
          boards?.map(board => (
            <motion.div
              key={board.id}
              layoutId={`board-${board.id}`}
              className="group relative overflow-hidden rounded-2xl bg-muted/30 border border-white/5 p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => setSelectedBoardId(board.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-black/20 overflow-hidden grid grid-cols-2 gap-0.5">
                  {/* Mini Preview Grid */}
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="bg-white/5 h-full w-full">
                      {board.previewImages[i] && (
                        <img
                          src={board.previewImages[i]}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{board.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {board.itemCount} items
                  </p>
                </div>
              </div>

              {isEditMode ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-500/10 hover:text-red-500 z-10"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm("Delete this board?")) onDeleteBoard(board.id);
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              ) : (
                <div className="text-muted-foreground/30">
                  {/* Chevron or similar indicator if needed */}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
