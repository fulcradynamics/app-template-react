import React from 'react';

export default function FulcraBranding() {
  return (
    <aside
      aria-label="Built with Fulcra"
      className="relative z-30 flex flex-col items-center justify-between gap-3 border-b border-fulcra-teal/30 bg-fulcra-black px-6 py-4 text-fulcra-white sm:flex-row"
    >
      <a
        href="https://fulcra.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fulcra-teal"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-icon_152.png" alt="" className="h-8 w-8 rounded-md" />
        <span className="text-sm">
          Powered by <strong className="text-lg font-medium">Fulcra</strong>
        </span>
      </a>
      <a
        href="https://github.com/fulcradynamics/community-skills/tree/main/skills/fulcra-app-starter"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-fulcra-teal/20 px-4 py-2 text-center text-sm font-medium text-fulcra-teal transition-colors hover:bg-fulcra-teal hover:text-fulcra-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fulcra-teal"
      >
        Build your own app with Fulcra
      </a>
    </aside>
  );
}
