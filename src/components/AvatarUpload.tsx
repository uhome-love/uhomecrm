import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarUploadProps {
  avatarUrl: string | null;
  nome: string;
  size?: "sm" | "md" | "lg";
  onUploaded?: (url: string) => void;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
};

const iconSizeMap = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export default function AvatarUpload({ avatarUrl, nome, size = "md", onUploaded }: AvatarUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = nome
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBust })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setCurrentUrl(urlWithCacheBust);
      onUploaded?.(urlWithCacheBust);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Erro ao enviar foto: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
      <Avatar className={`${sizeMap[size]} ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all`}>
        <AvatarImage src={currentUrl || undefined} alt={nome} />
        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? (
          <Loader2 className={`${iconSizeMap[size]} text-white animate-spin`} />
        ) : (
          <Camera className={`${iconSizeMap[size]} text-white`} />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
        disabled={uploading}
      />
    </div>
  );
}
