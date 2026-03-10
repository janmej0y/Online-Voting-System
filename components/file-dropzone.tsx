"use client";

import Image from "next/image";
import { FileImage, FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  label: string;
  description: string;
  value?: string;
  onChange: (value: string) => void;
  accept?: string;
};

export function FileDropzone({ label, description, value, onChange, accept = "image/*,.pdf" }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
  }

  const isImage = value?.startsWith("data:image");
  const isPdf = value?.startsWith("data:application/pdf");

  return (
    <div className="grid gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div
        className={cn(
          "rounded-2xl border border-dashed p-5 transition",
          dragging ? "border-primary bg-primary/5" : "border-border/70 bg-background/60"
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        {!value ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <div className="text-sm font-medium">Drop file here or browse</div>
            <div className="text-xs text-muted-foreground">Images or PDF are converted locally for preview and submission.</div>
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              Select file
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-secondary/40">
              {isImage ? (
                <div className="relative h-48 w-full">
                  <Image src={value} alt={`${label} preview`} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                  {isPdf ? <FileText className="size-4" /> : <FileImage className="size-4" />}
                  Preview ready
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Document preview is attached locally and will be submitted with your verification package.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                  Replace file
                </Button>
                <Button type="button" variant="ghost" onClick={() => onChange("")}>
                  <X className="mr-2 size-4" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
