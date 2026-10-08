export interface AppConfig {
  appName: string;
  tagline: string;
  description: string;
  showSlots: boolean;
  logoSrc?: string;
}

// Customize your login screen here; keep authentication plumbing unchanged.
export const appConfig: AppConfig = {
  appName: 'Your App Name',
  tagline: "One line on what your app does with a person's Fulcra data.",
  description:
    'A starter template you can clone and build on. Sign-in and user accounts work from the first commit — replace this copy with your own and start shipping.',
  showSlots: true
};
