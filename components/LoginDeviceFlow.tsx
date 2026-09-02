'use client';

import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import type { VerificationInfo } from '@/lib/auth0-device-flow';

// ---- fill these in for your app ----
const appName = 'Your App Name';
const tagline = "One line on what your app does with a person's Fulcra data.";
const description =
  'A starter template you can clone and build on. Sign-in and user accounts work from the first commit — replace this copy with your own and start shipping.';
const showSlots = true; // set false once you've replaced the placeholders

export default function LoginDeviceFlow() {
  const user = useUser();

  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLogin() {
    try {
      setError(null);
      const info = await user.startLogin();
      setVerificationInfo(info);

      // Open verification URL in popup
      const popup = window.open(
        info.verificationUri,
        'auth0-device-flow',
        'width=500,height=700,left=100,top=100'
      );

      // Start polling for token
      setPolling(true);
      await user.completeLogin(info.deviceCode, info.interval);

      // Close popup if still open
      if (popup && !popup.closed) {
        popup.close();
      }

      // If we get here, login succeeded
      setPolling(false);
      setVerificationInfo(null);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setPolling(false);
      setVerificationInfo(null);
    }
  }

  return (
    // -m-3 cancels the global p-3 gutter from layout.tsx so the screen is full-bleed
    <div className="relative -m-3 flex min-h-screen flex-col bg-fulcra-black text-fulcra-white">
      {/* grid wash */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(#ffffff0a_1px,transparent_1px),linear-gradient(90deg,#ffffff0a_1px,transparent_1px)] [mask-image:radial-gradient(70%_55%_at_50%_40%,#000_0%,transparent_100%)] bg-[length:72px_72px]"></div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#22222a_0%,transparent_62%)]"></div>

      <header className="sticky top-0 z-20 flex flex-none items-center justify-between gap-6 bg-fulcra-black/70 px-7 py-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* replace this slot with <img src="/your-logo.svg" alt={appName} className="h-[30px]" /> */}
          <div className="grid h-[30px] min-w-[86px] place-items-center rounded-[7px] border border-dashed border-[#3d3d44] bg-[repeating-linear-gradient(135deg,#ffffff08_0_6px,transparent_6px_12px)] px-3">
            <span className="font-mono text-[9.5px] tracking-[0.09em] text-fulcra-gray uppercase">
              your logo
            </span>
          </div>
          <span className="text-[11px] leading-none tracking-[0.06em] text-fulcra-gray uppercase">
            powered by
          </span>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/app-icon_152.png"
              alt="Fulcra"
              className="block h-[26px] w-[26px] rounded-md"
            />
            <span className="text-[13.5px] font-medium tracking-[0.01em]">Fulcra</span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[13px]">
          <a
            href="https://docs.fulcradynamics.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fulcra-gray hover:text-fulcra-white"
          >
            Docs
          </a>
          <a
            href="https://support.fulcradynamics.com/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fulcra-gray hover:text-fulcra-white"
          >
            Support
          </a>
        </div>
      </header>

      <main className="relative grid flex-1 place-items-center px-6 pt-6 pb-14">
        <div className="w-full max-w-[452px]">
          <div className="mb-9 flex flex-col gap-3.5">
            {showSlots && (
              <span className="self-start rounded-[5px] border border-fulcra-black-25 px-[7px] py-1 font-mono text-[10px] tracking-[0.1em] text-fulcra-gray uppercase">
                app_name
              </span>
            )}
            <h1 className="text-[38px] leading-[1.08] font-medium tracking-[-0.02em]">{appName}</h1>
            <p className="text-[16.5px] leading-[1.5] tracking-[-0.008em] text-pretty text-[#d6d6da]">
              {tagline}
            </p>
            <p className="mt-1 text-[14.5px] leading-[1.65] text-pretty text-fulcra-gray">
              {description}
            </p>
          </div>

          <div className="rounded-lg border border-solid border-fulcra-black-25 bg-[#1b1b23] p-[22px]">
            <h2 className="mb-4 text-[15px] font-medium tracking-[-0.01em]">Get started</h2>

            {!verificationInfo ? (
              <>
                <div className="flex flex-col gap-2.5">
                  <button
                    className="btn h-12 w-full rounded-lg bg-fulcra-teal/20 text-[14.5px] font-medium text-fulcra-teal transition-colors hover:bg-fulcra-teal/50 hover:text-fulcra-black"
                    onClick={startLogin}
                  >
                    Sign In
                  </button>
                  <button
                    className="btn h-12 w-full rounded-lg border border-solid border-fulcra-black-25 bg-transparent text-[14.5px] font-normal text-fulcra-white transition-colors hover:border-fulcra-black-20 hover:bg-fulcra-black-50"
                    onClick={startLogin}
                  >
                    Create Account
                  </button>
                </div>

                {error && <p className="mt-3 text-[13px] text-fulcra-error">{error}</p>}

                <p className="mt-4 text-[12px] leading-[1.6] text-pretty text-fulcra-gray">
                  Opens a secure Auth0 window. By continuing you agree to the{' '}
                  <a
                    href="https://fulcra.ai/legal/terms-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fulcra-gray underline hover:text-fulcra-white"
                  >
                    Terms
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://fulcra.ai/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fulcra-gray underline hover:text-fulcra-white"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-[1.6] text-fulcra-gray">
                  A popup window has opened. Enter this code to continue:
                </p>
                <div className="mt-3 rounded-lg border border-solid border-fulcra-black-25 bg-fulcra-black-50 px-3 py-3 text-center">
                  <span className="font-mono text-2xl tracking-widest text-fulcra-white">
                    {verificationInfo.userCode}
                  </span>
                </div>

                {polling && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-fulcra-gray">
                    <div className="loading loading-sm loading-spinner"></div>
                    <span className="text-[13px]">Waiting for authentication…</span>
                  </div>
                )}

                <p className="mt-4 text-[12px] leading-[1.6] text-fulcra-gray">
                  Popup blocked?{' '}
                  <a
                    href={verificationInfo.verificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fulcra-teal underline hover:text-fulcra-white"
                  >
                    Open the verification page
                  </a>
                  .
                </p>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2.5 pl-0.5">
            <span className="h-[5px] w-[5px] flex-none rounded-full bg-fulcra-teal"></span>
            <p className="text-[12.5px] text-fulcra-gray">
              Sign-in handled by Auth0. Data access via the{' '}
              <a
                href="https://docs.fulcradynamics.com"
                className="text-fulcra-gray underline hover:text-fulcra-white"
              >
                Fulcra API
              </a>
              .
            </p>
          </div>

          {showSlots && (
            <div className="mt-7 flex flex-col gap-[7px] border-t border-fulcra-black-25 pt-4">
              <p className="font-mono text-[11px] leading-[1.7] text-fulcra-gray">
                Template slots on this screen: your logo, app_name, tagline, description.
              </p>
              <p className="font-mono text-[11px] leading-[1.7] text-fulcra-gray">
                Replace them in your fork, then set showSlots to false.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
