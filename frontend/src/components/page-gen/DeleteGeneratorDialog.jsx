import { useState } from "react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function DeleteGeneratorDialog({ open, onOpenChange, generator, onDone }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!generator?.id) return;
        setDeleting(true);
        try {
            await api.delete(`/page-generators/${generator.id}`);
            toast.success(`"${generator.name}" deleted`);
            onDone?.();
            onOpenChange(false);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Generator?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete <strong>{generator?.name}</strong> and all its generated pages.
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel data-testid="delete-cancel-btn">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleDelete}
                        disabled={deleting}
                        data-testid="delete-confirm-btn"
                    >
                        {deleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
