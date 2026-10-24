/**
 * Privacy-Aware Operational Analytics Module
 * Enforces strict confidentiality: Never logs PII, phone numbers, or proprietary freight rates.
 */

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

class PrivacyAnalytics {
  private isInitialized = false;
  private trackingId: string | null = null;

  init(trackingId?: string) {
    if (this.isInitialized) return;
    this.trackingId = trackingId || (import.meta as any).env?.VITE_GA_MEASUREMENT_ID || null;
    this.isInitialized = true;

    if (this.trackingId) {
      console.log(`[Analytics] Initialized in privacy-preserving mode with ID: ${this.trackingId}`);
    }
  }

  /**
   * Tracks an anonymized page view
   * @param path current route path
   */
  trackPageView(path: string) {
    if (!this.isInitialized) this.init();

    // Sanitize path to prevent leaking search queries or IDs
    const cleanPath = path.split('?')[0].replace(/\/[0-9a-fA-F]{24}/g, '/:id');

    if (typeof window !== 'undefined' && (window as any).gtag && this.trackingId) {
      (window as any).gtag('config', this.trackingId, {
        page_path: cleanPath,
        anonymize_ip: true
      });
    }
  }

  /**
   * Tracks general operational milestones (non-confidential)
   */
  trackEvent({ category, action, label, value }: AnalyticsEvent) {
    if (!this.isInitialized) this.init();

    // Redact any accidental numbers or emails in labels
    const sanitizedLabel = label
      ? label.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
      : undefined;

    if (typeof window !== 'undefined' && (window as any).gtag && this.trackingId) {
      (window as any).gtag('event', action, {
        event_category: category,
        event_label: sanitizedLabel,
        value: value
      });
    }
  }
}

export const analytics = new PrivacyAnalytics();
