'use client';

import { MEDIA_MIME_TYPES } from '@metrobet/contracts';
import { Button, cn, Label } from '@metrobet/ui';
import { ImageUp } from 'lucide-react';
import { useId, useRef, useState, useTransition } from 'react';

import { resolveMediaUrl } from '@/lib/media';

import { uploadPromotionImage } from '../actions';

type ImageFieldProps = {
  label: string;
  /** Required artwork size, shown to the editor. */
  size: string;
  aspectClassName: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
};

export function ImageField({
  label,
  size,
  aspectClassName,
  value,
  onChange,
  error,
}: ImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const message = uploadError ?? error;

  const upload = (file: File) => {
    const body = new FormData();
    body.append('file', file);
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadPromotionImage(body);
      if (result.ok) onChange(result.data);
      else setUploadError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="font-normal">({size})</span>
      </Label>
      <div
        className={cn(
          'relative overflow-hidden rounded-md border bg-muted',
          aspectClassName,
          message && 'border-destructive',
        )}
      >
        {value ? (
          // oxlint-disable-next-line nextjs/no-img-element -- preview of an arbitrary media URL
          <img
            src={resolveMediaUrl(value)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept={MEDIA_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <ImageUp />
          {pending ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </Button>
        <span className="truncate text-xs text-muted-foreground">
          PNG, JPEG, WebP or AVIF · max 5 MB
        </span>
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
