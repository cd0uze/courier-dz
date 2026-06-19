/**
 * Immutable metadata record for a shipping provider.
 *
 * Returned by getProviderMetadata() and available via any adapter's metadata() method.
 * Useful for building provider-selection UIs, displaying logos, linking to tracking pages, etc.
 */
export class ProviderMetadata {
  /**
   * @param {object} params
   * @param {string} params.name - Internal machine-readable identifier, e.g. "Yalidine"
   * @param {string} params.title - Human-readable display name, e.g. "Yalidine"
   * @param {string} params.website - Provider's public website
   * @param {string} params.description - Short description of the provider
   * @param {string|null} [params.logo] - URL of the provider's logo image
   * @param {string|null} [params.apiDocs] - URL to the provider's API documentation
   * @param {string|null} [params.support] - URL to the provider's support page
   * @param {string|null} [params.trackingUrl] - Public tracking URL for end-customers
   */
  constructor({ name, title, website, description, logo = null, apiDocs = null, support = null, trackingUrl = null }) {
    this.name = name;
    this.title = title;
    this.website = website;
    this.description = description;
    this.logo = logo;
    this.apiDocs = apiDocs;
    this.support = support;
    this.trackingUrl = trackingUrl;
  }

  toJSON() {
    return {
      name: this.name,
      title: this.title,
      website: this.website,
      description: this.description,
      logo: this.logo,
      api_docs: this.apiDocs,
      support: this.support,
      tracking_url: this.trackingUrl,
    };
  }
}
