"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Customer-facing product image slider. The main image plus any gallery
 * images become slides; clicking a thumbnail (or the arrows) swaps the
 * large image. Server pages pass plain data — all state lives here.
 */
export function ProductGallery({
  name,
  mainImage,
  gallery,
  discountPercent,
}: {
  name: string;
  mainImage: string | null;
  gallery: string[];
  discountPercent: number;
}) {
  // Main image first (when present), then the gallery images.
  const images = [mainImage, ...gallery].filter(Boolean) as string[];
  const [active, setActive] = useState(0);

  const current = images[active] ?? null;
  const hasMany = images.length > 1;
  const go = (delta: number) =>
    setActive((i) => (i + delta + images.length) % images.length);

  return (
    <div className="flex flex-col bg-stone-50 lg:h-full">
      <div className="relative aspect-square w-full bg-stone-200 lg:aspect-auto lg:min-h-0 lg:flex-1">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">
            ☕
          </div>
        )}

        <Link
          href="/menu"
          className="group absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:w-auto hover:gap-1.5 hover:bg-white hover:px-4 hover:text-stone-900 active:scale-95"
          aria-label="Back to menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="hidden text-sm font-medium group-hover:inline">
            Back
          </span>
        </Link>

        {discountPercent > 0 && (
          <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white shadow">
            -{discountPercent}% OFF
          </span>
        )}

        {hasMany && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-stone-700 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-stone-700 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="flex gap-3 overflow-x-auto p-4">
          {images.map((url, index) => (
            <button
              type="button"
              key={`${url}-${index}`}
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              className={`shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                index === active
                  ? "ring-stone-900"
                  : "ring-stone-200 hover:ring-stone-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${index + 1}`}
                className="h-20 w-20 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
