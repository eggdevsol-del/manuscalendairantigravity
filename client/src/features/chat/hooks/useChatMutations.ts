import { useMemo, type Dispatch, type SetStateAction } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Server message IDs are positive; local pending IDs remain unique across threads.
let nextOptimisticMessageId = -Date.now();

interface ChatState {
  setMessageText: Dispatch<SetStateAction<string>>;
  setShowClientConfirmDialog: (show: boolean) => void;
  setUploadingImage: (uploading: boolean) => void;
}

export function useChatMutations(
  conversationId: number,
  user: any,
  state: ChatState
) {
  const utils = trpc.useUtils();

  const pinConsultationMutation =
    trpc.conversations.pinConsultation.useMutation({
      onSuccess: () => {
        utils.conversations.getById.invalidate(conversationId);
        toast.success("Consultation pinned status updated");
      },
      onError: err => {
        toast.error("Failed to update pin status");
      },
    });

  const markAsReadMutation = trpc.conversations.markAsRead.useMutation();

  const updateMetadataMutation = trpc.messages.updateMetadata.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ conversationId });
    },
  });

  const sendMessageMutation = trpc.messages.send.useMutation({
    onMutate: async newMessage => {
      await utils.messages.list.cancel({ conversationId });
      const previousMessages = utils.messages.list.getData({ conversationId });

      const optimisticMessage = {
        id: nextOptimisticMessageId--,
        conversationId: newMessage.conversationId,
        senderId: user?.id || "",
        content: newMessage.content,
        messageType: newMessage.messageType || "text",
        metadata: newMessage.metadata || null,
        readBy: null,
        createdAt: new Date().toISOString(),
        sender: {
          id: user?.id,
          name: user?.name,
          avatar: user?.avatar,
          role: user?.role,
        },
      };

      utils.messages.list.setData({ conversationId }, (old: any) =>
        old ? [...old, optimisticMessage] : [optimisticMessage]
      );

      return { previousMessages, optimisticId: optimisticMessage.id };
    },
    onError: (error: any, newMessage, context) => {
      if (context) {
        utils.messages.list.setData({ conversationId }, (current: any) =>
          current
            ? current.filter(
                (message: { id: number }) => message.id !== context.optimisticId
              )
            : context.previousMessages || []
        );
      }
      toast.error("Failed to send message: " + error.message);
    },
    onSuccess: async (_data, sentMessage) => {
      if (!sentMessage.messageType || sentMessage.messageType === "text") {
        state.setMessageText(current =>
          current === sentMessage.content ? "" : current
        );
      }
      await utils.messages.list.invalidate({ conversationId });
    },
  });

  const bookProjectMutation = trpc.appointments.bookProject.useMutation({
    onSuccess: data => {
      toast.success(`${data.count} appointments booked successfully!`);
      utils.messages.list.invalidate({ conversationId });
      state.setShowClientConfirmDialog(false);
    },
    onError: err => {
      toast.error("Failed to book project: " + err.message);
    },
  });

  const uploadImageMutation = trpc.upload.uploadImage.useMutation({
    onSuccess: data => {
      sendMessageMutation.mutate({
        conversationId,
        content: data.url,
        messageType: "image",
      });
      state.setUploadingImage(false);
    },
    onError: (error: any) => {
      toast.error("Failed to upload image: " + error.message);
      state.setUploadingImage(false);
    },
  });

  const deleteProposalMutation = trpc.appointments.deleteProposal.useMutation({
    onSuccess: () => {
      toast.success("Proposal revoked");
      utils.messages.list.invalidate({ conversationId });
      utils.appointments.getByConversation.invalidate(conversationId);
    },
    onError: err => {
      toast.error("Failed to revoke proposal: " + err.message);
    },
  });

  const value = useMemo(
    () => ({
      utils,
      pinConsultationMutation,
      markAsReadMutation,
      updateMetadataMutation,
      sendMessageMutation,
      bookProjectMutation,
      uploadImageMutation,
      deleteProposalMutation,
    }),
    [
      utils,
      pinConsultationMutation.isPending,
      pinConsultationMutation.status,
      markAsReadMutation.mutate,
      updateMetadataMutation.mutate,
      updateMetadataMutation.isPending,
      sendMessageMutation.mutate,
      sendMessageMutation.isPending,
      bookProjectMutation.mutate,
      bookProjectMutation.isPending,
      uploadImageMutation.mutate,
      uploadImageMutation.isPending,
      deleteProposalMutation.mutate,
      deleteProposalMutation.isPending,
    ]
  );

  return value;
}
